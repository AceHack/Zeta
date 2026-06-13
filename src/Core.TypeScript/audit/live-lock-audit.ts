#!/usr/bin/env bun
// live-lock-audit.ts — classify the last N commits on origin/main into
// external (src/tests/samples/bench), internal-factory (tick-history /
// BACKLOG / round-history / .claude), or speculative (research / memory /
// DECISIONS), and flag the live-lock smell when the external ratio is
// overwhelmed.
//
// TypeScript+Bun port of live-lock-audit.sh, slice 8 of the TS+Bun
// migration. See docs/best-practices/repo-scripting.md.
//
// Factory-health signal: external-code motion (product-surface changes)
// should not be zero over a rolling window. When it is, the factory is
// spinning on process work without shipping — live-lock.
//
// Usage:
//   bun tools/audit/live-lock-audit.ts [N]
//   N defaults to 25.
//
// Exit codes:
//   0  healthy — external ratio at or above threshold
//   1  smell firing — external ratio below threshold
//   2  usage / environment error (bad WINDOW, no origin/main, etc.)
//
// Env:
//   LIVELOCK_MIN_EXT_PCT — minimum healthy external-commit % (default 20)

import { spawnSync } from "node:child_process";

type ExitCode = 0 | 1 | 2;

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;

const DEFAULT_WINDOW = 25;
const DEFAULT_THRESHOLD = 20;

const POSITIVE_INT_RE = /^[1-9]\d*$/;
const EXT_RE = /^(?:src|tests|samples|bench)\//;
const RESEARCH_RE = /^(?:docs\/research|memory|docs\/DECISIONS)\//;
const META_RE = /^(?:docs\/ROUND-HISTORY|docs\/hygiene-history|\.claude|docs\/BACKLOG)/;

interface Counts {
  readonly ext: number;
  readonly intl: number;
  readonly spec: number;
  readonly other: number;
  readonly lines: readonly string[];
}

function gitOutput(args: readonly string[]): {
  status: number;
  stdout: string;
} {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", args, {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  return { status: result.status ?? 1, stdout: result.stdout };
}

function parseWindow(arg: string | undefined): number | null {
  if (arg === undefined) return DEFAULT_WINDOW;
  if (!POSITIVE_INT_RE.test(arg)) return null;
  return Number.parseInt(arg, 10);
}

function getThreshold(): number {
  const env = process.env.LIVELOCK_MIN_EXT_PCT;
  if (env === undefined) return DEFAULT_THRESHOLD;
  if (!POSITIVE_INT_RE.test(env)) return DEFAULT_THRESHOLD;
  return Number.parseInt(env, 10);
}

function fetchOriginMain(): void {
  // Fire-and-forget; bash version uses `|| true`. Keep going regardless.
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  spawnSync("git", ["fetch", "origin", "main", "--quiet"], {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
}

function originMainResolves(): boolean {
  return (
    gitOutput(["rev-parse", "--verify", "--quiet", "origin/main"]).status === 0
  );
}

function listCommitShas(window: number): readonly string[] {
  const out = gitOutput([
    "log",
    "origin/main",
    `-${String(window)}`,
    "--format=%H",
  ]);
  return out.stdout.split("\n").filter((s) => s.length > 0);
}

function commitFiles(sha: string): readonly string[] {
  // -m --first-parent: classify merge commits by what they actually
  // *introduced* to origin/main (parent 1 diff), not the union of both
  // parents. Mirrors bash original (Codex P1 on PR #147).
  const out = gitOutput([
    "log",
    "-1",
    "-m",
    "--first-parent",
    "--name-only",
    "--format=",
    sha,
  ]);
  return out.stdout.split("\n").filter((s) => s.length > 0);
}

function commitSubject(sha: string): string {
  const out = gitOutput(["log", "-1", "--format=%s", sha]);
  return out.stdout.split("\n")[0]?.slice(0, 72) ?? "";
}

function classifyCommit(files: readonly string[]): "EXT " | "INTL" | "SPEC" | "OTHR" {
  const src = files.filter((f) => EXT_RE.test(f)).length;
  const research = files.filter((f) => RESEARCH_RE.test(f)).length;
  const meta = files.filter((f) => META_RE.test(f)).length;
  if (src > 0) return "EXT ";
  if (meta > 0 && research <= meta) return "INTL";
  if (research > 0) return "SPEC";
  return "OTHR";
}

function tallyCommits(shas: readonly string[]): Counts {
  let ext = 0;
  let intl = 0;
  let spec = 0;
  let other = 0;
  const lines: string[] = [];
  for (const sha of shas) {
    const files = commitFiles(sha);
    const subj = commitSubject(sha);
    const cat = classifyCommit(files);
    if (cat === "EXT ") ext++;
    else if (cat === "INTL") intl++;
    else if (cat === "SPEC") spec++;
    else other++;
    lines.push(`${cat}  ${subj}`);
  }
  return { ext, intl, spec, other, lines };
}

function emitReport(counts: Counts, window: number, threshold: number): ExitCode {
  const total = counts.ext + counts.intl + counts.spec + counts.other;
  if (total === 0) {
    process.stderr.write(
      `error: no commits found in window of ${String(window)} on origin/main.\n`,
    );
    return 2;
  }
  const extPct = Math.floor((100 * counts.ext) / total);
  const intlPct = Math.floor((100 * counts.intl) / total);
  const specPct = Math.floor((100 * counts.spec) / total);
  const otherPct = Math.floor((100 * counts.other) / total);

  process.stdout.write(
    `Live-lock audit — last ${String(window)} commits on origin/main\n`,
  );
  process.stdout.write(
    "======================================================\n",
  );
  for (const line of counts.lines) process.stdout.write(`${line}\n`);
  process.stdout.write("\n");
  process.stdout.write("Category totals:\n");
  process.stdout.write(
    `  EXT  (src/tests/samples/bench) : ${pad2(counts.ext)}   ${pad3(extPct)}%\n`,
  );
  process.stdout.write(
    `  INTL (tick-history/BACKLOG/...) : ${pad2(counts.intl)}   ${pad3(intlPct)}%\n`,
  );
  process.stdout.write(
    `  SPEC (research/memory/ADR)      : ${pad2(counts.spec)}   ${pad3(specPct)}%\n`,
  );
  process.stdout.write(
    `  OTHR (uncategorised)            : ${pad2(counts.other)}   ${pad3(otherPct)}%\n`,
  );
  process.stdout.write("\n");
  process.stdout.write(`Healthy threshold: EXT >= ${String(threshold)}%\n`);
  process.stdout.write("\n");

  if (extPct < threshold) {
    process.stdout.write(
      `SMELL FIRING: external-commit ratio ${String(extPct)}% < threshold ${String(threshold)}%.\n`,
    );
    process.stdout.write(
      "Factory may be live-locked — spinning on process work without product motion.\n",
    );
    process.stdout.write(
      "Response: pause speculative, ship one external-priority increment, re-measure.\n",
    );
    return 1;
  }
  process.stdout.write(
    `Healthy: external-commit ratio ${String(extPct)}% >= threshold ${String(threshold)}%.\n`,
  );
  return 0;
}

function pad2(n: number): string {
  const s = String(n);
  return s.padStart(2, " ");
}

function pad3(n: number): string {
  const s = String(n);
  return s.padStart(3, " ");
}

export function main(argv: readonly string[]): ExitCode {
  const window = parseWindow(argv[0]);
  if (window === null) {
    process.stderr.write("usage: live-lock-audit.ts [N]\n");
    process.stderr.write(
      `error: WINDOW must be a positive integer, got '${argv[0] ?? ""}'.\n`,
    );
    return 2;
  }

  fetchOriginMain();

  if (!originMainResolves()) {
    process.stderr.write(
      "error: cannot resolve origin/main (shallow clone, missing remote, or failed fetch).\n",
    );
    process.stderr.write(
      "refusing to report audit result — unresolved ref cannot be treated as healthy.\n",
    );
    return 2;
  }

  const threshold = getThreshold();
  const shas = listCommitShas(window);
  const counts = tallyCommits(shas);
  return emitReport(counts, window, threshold);
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
