#!/usr/bin/env bun
// audit-git-hotspots.ts — surface high-churn files in the repo
// over a configurable window.
//
// TypeScript+Bun port of audit-git-hotspots.sh, slice 2 of the
// TS+Bun migration. See `docs/best-practices/repo-scripting.md`
// for the per-slice audit checklist + Zeta scripting conventions.
//
// What this does:
//   Tallies (commit, file) touches via `git log --name-only`
//   over a window (default 60 days), excluding by-design hot
//   prefixes (hygiene-history fire logs, openspec staging,
//   prior-art mirrors). Renders a markdown ranking with
//   touches / unique authors / PR count per top-N file. The
//   action (split / freeze / archive / watch) is a judgment
//   call, not an enforcement.
//
// DST-friendliness:
//   The "Generated" timestamp is the only non-deterministic
//   surface. A clock can be injected into renderReport() for
//   tests; CLI uses real wall time. Per the universal-DST gate
//   in `typescript.md`.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-git-hotspots.ts                # 60d window, top 20
//   bun src/Core.TypeScript/hygiene/audit-git-hotspots.ts --window 30d   # custom window
//   bun src/Core.TypeScript/hygiene/audit-git-hotspots.ts --top 40       # show more rows
//   bun src/Core.TypeScript/hygiene/audit-git-hotspots.ts --report PATH  # write markdown report
//
// Exit codes:
//   0   always (detect-only, no enforcement)
//   64  argument error
//   128 not inside a git worktree

import {
  spawnSync,
  type SpawnSyncReturns,
} from "node:child_process";
import { writeFileSync } from "node:fs";

type AuditExitCode = 0 | 64 | 128;

interface Args {
  readonly window: string;
  readonly top: number;
  readonly report: string | null;
}

type ParseResult =
  | { readonly kind: "args"; readonly args: Args }
  | { readonly kind: "help" }
  | { readonly kind: "error"; readonly message: string };

interface FileTally {
  readonly file: string;
  readonly touches: number;
}

interface FileSummary {
  readonly file: string;
  readonly touches: number;
  readonly authors: number;
  readonly prCount: number;
}

interface AuditResult {
  readonly window: string;
  readonly top: number;
  readonly excludedPrefixes: readonly string[];
  readonly summaries: readonly FileSummary[];
  readonly emptyWindow: boolean;
}

interface Clock {
  readonly nowUtcIso: () => string;
}

const DEFAULT_WINDOW = "60 days";
const DEFAULT_TOP = 20;
const SPAWN_MAX_BUFFER = 64 * 1024 * 1024; // 64 MiB

const EXCLUDED_PREFIXES: readonly string[] = [
  "docs/hygiene-history/",
  "openspec/changes/",
  "references/prior-art/",
];

const PR_TRAILER_RE = /\(#\d+\)$/;
const POSITIVE_INT_RE = /^[1-9]\d*$/;

const HELP_TEXT =
  "Usage: audit-git-hotspots.ts [--window WINDOW] [--top N] [--report PATH]\n";

type ParseAcc =
  | { readonly kind: "ok"; readonly window: string; readonly top: number; readonly report: string | null }
  | { readonly kind: "error"; readonly message: string };

function reduceFlag(
  acc: ParseAcc,
  flag: string,
  value: string | undefined,
): ParseAcc {
  if (acc.kind === "error") return acc;
  if (value === undefined) {
    return { kind: "error", message: `error: ${flag} requires a value` };
  }
  if (flag === "--window") return { ...acc, window: value };
  if (flag === "--report") return { ...acc, report: value };
  if (flag === "--top") {
    if (!POSITIVE_INT_RE.test(value)) {
      return {
        kind: "error",
        message: `error: --top requires a positive integer, got: ${value}`,
      };
    }
    return { ...acc, top: Number(value) };
  }
  return { kind: "error", message: `unknown arg: ${flag}` };
}

function parseArgs(argv: readonly string[]): ParseResult {
  let acc: ParseAcc = {
    kind: "ok",
    window: DEFAULT_WINDOW,
    top: DEFAULT_TOP,
    report: null,
  };
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i] ?? "";
    if (arg === "-h" || arg === "--help") return { kind: "help" };
    acc = reduceFlag(acc, arg, argv[i + 1]);
    if (acc.kind === "error") return { kind: "error", message: acc.message };
    i += 2;
  }
  return {
    kind: "args",
    args: { window: acc.window, top: acc.top, report: acc.report },
  };
}

function classifyGitFailure(
  args: readonly string[],
  result: SpawnSyncReturns<string>,
): string | null {
  if (result.error) {
    return `Failed to start 'git ${args.join(" ")}': ${result.error.message}`;
  }
  if (result.status === null) {
    if (result.signal !== null) {
      return `'git ${args.join(" ")}' terminated by signal ${result.signal}`;
    }
    return `'git ${args.join(" ")}' terminated before reporting an exit code`;
  }
  if (result.status !== 0) {
    const stderr = result.stderr.trim();
    return stderr !== ""
      ? stderr
      : `'git ${args.join(" ")}' exited ${String(result.status)}`;
  }
  return null;
}

function runGit(args: readonly string[]): string {
  // git is repo-pinned via .mise.toml; args are an explicit string array (no shell interpolation).
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", args, {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  const failure = classifyGitFailure(args, result);
  if (failure !== null) throw new Error(failure);
  return result.stdout;
}

function isInsideWorkTree(): boolean {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  return result.status === 0 && result.stdout.trim() === "true";
}

// Convert window shorthand (e.g. "60d", "2w", "3m", "1y") to a
// `git log --since=` value git actually understands. Git's --since
// parses approxidate strings like "60 days ago"; the bare "60d" is
// NOT a valid approxidate and silently matches zero commits.
// Empirically caught 2026-05-03 when the cadence workflow's first
// run reported "no commits in window '60d' (or all filtered)" while
// the repo had 1274 commits in that window. Pass-through if the
// input does not match the shorthand pattern (so callers can still
// supply a raw approxidate like "1 month ago").
function expandWindowShorthand(window: string): string {
  const match = /^(\d+)([dwmy])$/.exec(window);
  if (!match) return window;
  const n = match[1];
  const suffix = match[2];
  const unit =
    suffix === "d" ? "days" :
    suffix === "w" ? "weeks" :
    suffix === "m" ? "months" :
    "years";
  return `${n} ${unit} ago`;
}

function tallyTouches(window: string): readonly FileTally[] {
  const since = expandWindowShorthand(window);
  const raw = runGit([
    "log",
    `--since=${since}`,
    "--pretty=format:",
    "--name-only",
  ]);
  const lines = raw.split("\n").filter((s) => s.length > 0); // excludes blank lines per 081KQ8P5D0008QG0R0014HJFF5 stale-item resolution for 081KQ8P5D0008QG0R001D8RCZ9 log-line scoring
  const filtered = lines.filter(
    (f) => !EXCLUDED_PREFIXES.some((p) => f.startsWith(p)),
  );
  const counts = new Map<string, number>();
  for (const file of filtered) {
    counts.set(file, (counts.get(file) ?? 0) + 1);
  }
  const tallies: FileTally[] = [];
  for (const [file, touches] of counts) {
    tallies.push({ file, touches });
  }
  // Sort by touches desc; tie-break alphabetically for determinism.
  tallies.sort((a, b) => b.touches - a.touches || a.file.localeCompare(b.file));
  return tallies;
}

function uniqueLineCount(text: string): number {
  if (text.length === 0) return 0;
  const set = new Set<string>();
  for (const line of text.split("\n")) {
    if (line.length > 0) set.add(line);
  }
  return set.size;
}

function summariseFile(window: string, file: string, touches: number): FileSummary {
  const since = expandWindowShorthand(window);
  const authorsRaw = runGit([
    "log",
    `--since=${since}`,
    "--pretty=format:%an",
    "--",
    file,
  ]);
  const authors = uniqueLineCount(authorsRaw.trim());
  const subjectsRaw = runGit([
    "log",
    `--since=${since}`,
    "--pretty=format:%s",
    "--",
    file,
  ]);
  const subjects = subjectsRaw.split("\n").filter((s) => s.length > 0);
  const prRefs = new Set<string>();
  for (const subject of subjects) {
    const match = PR_TRAILER_RE.exec(subject);
    if (match !== null) prRefs.add(match[0]);
  }
  return { file, touches, authors, prCount: prRefs.size };
}

export function auditRepo(args: Args): AuditResult {
  const tallies = tallyTouches(args.window);
  const top = tallies.slice(0, args.top);
  const summaries = top.map((t) => summariseFile(args.window, t.file, t.touches));
  return {
    window: args.window,
    top: args.top,
    excludedPrefixes: EXCLUDED_PREFIXES,
    summaries,
    emptyWindow: tallies.length === 0,
  };
}

export function renderReport(result: AuditResult, clock: Clock): string {
  const lines: string[] = [];
  lines.push("# Git hotspots report");
  lines.push("");
  lines.push(`- **Window:** last ${result.window}`);
  lines.push(`- **Generated:** ${clock.nowUtcIso()}`);
  lines.push(`- **Top:** ${String(result.top)} files by touch count`);
  lines.push(`- **Excluded prefixes:** ${result.excludedPrefixes.join(" ")}`);
  lines.push("");
  lines.push("## Ranking");
  lines.push("");
  lines.push("| file | touches | unique authors | PR count |");
  lines.push("|---|---:|---:|---:|");
  for (const s of result.summaries) {
    lines.push(
      `| ${s.file} | ${String(s.touches)} | ${String(s.authors)} | ${String(s.prCount)} |`,
    );
  }
  lines.push("");
  lines.push("## Suggested actions");
  lines.push("");
  lines.push("Detection-first. The action below is a prompt for human");
  lines.push("or Architect judgment, not an enforcement.");
  lines.push("");
  lines.push("- **split** — file has become a shared bottleneck; consider");
  lines.push("  per-swim-lane / per-subsystem decomposition");
  lines.push("- **freeze** — historical content is append-only; freeze");
  lines.push("  older rows to an archive and keep recent rows hot");
  lines.push("- **audit** — hotness may reflect real work; investigate");
  lines.push("  whether churn is healthy or pathological");
  lines.push("- **watch** — hot but not yet a problem; leave for next");
  lines.push("  audit cadence");
  lines.push("");
  lines.push("## What this report is NOT");
  lines.push("");
  lines.push("- Not an enforcement. The audit exits 0 regardless of");
  lines.push("  findings.");
  lines.push("- Not a blame tool. Author counts are descriptive of");
  lines.push("  collaboration shape, not performance.");
  lines.push("- Not a complete merge-conflict predictor. Two PRs can");
  lines.push("  conflict on a rarely-touched file; conversely, a");
  lines.push("  very hot file with careful coordination (append-only");
  lines.push("  rows) may see zero conflicts.");
  lines.push("");
  return lines.join("\n");
}

function realClock(): Clock {
  return {
    nowUtcIso: () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  };
}

export function main(argv: readonly string[]): AuditExitCode {
  const parsed = parseArgs(argv);
  if (parsed.kind === "help") {
    process.stdout.write(HELP_TEXT);
    return 0;
  }
  if (parsed.kind === "error") {
    process.stderr.write(`${parsed.message}\n`);
    return 64;
  }
  const { args } = parsed;

  if (!isInsideWorkTree()) {
    process.stderr.write(
      "error: src/Core.TypeScript/hygiene/audit-git-hotspots.ts must run inside a git worktree\n",
    );
    return 128;
  }

  const result = auditRepo(args);
  if (result.emptyWindow) {
    process.stderr.write(
      `no commits in window '${args.window}' (or all filtered)\n`,
    );
  }

  const rendered = renderReport(result, realClock());
  if (args.report !== null) {
    writeFileSync(args.report, rendered);
    process.stderr.write(`Report written: ${args.report}\n`);
  } else {
    process.stdout.write(rendered);
  }
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
