#!/usr/bin/env bun
// audit-tick-history-bounded-growth.ts — checks whether
// docs/hygiene-history/loop-tick-history.md is within its
// bounded-growth threshold.
//
// TypeScript+Bun port of audit-tick-history-bounded-growth.sh,
// slice 5 of the TS+Bun migration. See
// docs/best-practices/repo-scripting.md for conventions.
//
// Default threshold: 500 lines (per inline mini-ADR in bash
// original). Override with --threshold N. Two modes: summary
// human-readable; default terse machine-friendly.
//
// Usage:
//   bun tools/hygiene/audit-tick-history-bounded-growth.ts            # terse
//   bun tools/hygiene/audit-tick-history-bounded-growth.ts --summary  # multi-line
//   bun tools/hygiene/audit-tick-history-bounded-growth.ts --threshold 1000
//
// Exit codes:
//   0   within bounds (or approaching but not over)
//   1   usage error / target file not found
//   2   over threshold (archive action due)

import { readFileSync } from "node:fs";
import {
  spawnSync,
  type SpawnSyncReturns,
} from "node:child_process";

type AuditExitCode = 0 | 1 | 2;

interface Args {
  readonly summary: boolean;
  readonly threshold: number;
}

type ParseResult =
  | { readonly kind: "args"; readonly args: Args }
  | { readonly kind: "help" }
  | { readonly kind: "error"; readonly message: string };

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;
const DEFAULT_THRESHOLD = 500;
const TARGET_REL = "docs/hygiene-history/loop-tick-history.md";

function classifyFailure(
  cmd: string,
  args: readonly string[],
  result: SpawnSyncReturns<string>,
): string | null {
  if (result.error) {
    return `Failed to start '${cmd} ${args.join(" ")}': ${result.error.message}`;
  }
  if (result.status === null) {
    return `'${cmd} ${args.join(" ")}' terminated before reporting an exit code`;
  }
  if (result.status !== 0) {
    return `'${cmd} ${args.join(" ")}' exited ${String(result.status)}`;
  }
  return null;
}

function repoRoot(): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  const failure = classifyFailure("git", ["rev-parse"], result);
  if (failure !== null) throw new Error(failure);
  return result.stdout.trim();
}

function reduceFlag(
  arg: string,
  next: string | undefined,
  state: { summary: boolean; threshold: number },
): { ok: true; consumed: 1 | 2 } | { ok: false; message: string } {
  if (arg === "--summary") {
    state.summary = true;
    return { ok: true, consumed: 1 };
  }
  if (arg === "--threshold") {
    if (next === undefined) {
      return { ok: false, message: "error: --threshold requires a value" };
    }
    const n = Number(next);
    if (!Number.isFinite(n) || n <= 0) {
      return { ok: false, message: `error: --threshold requires a positive number, got: ${next}` };
    }
    state.threshold = n;
    return { ok: true, consumed: 2 };
  }
  return { ok: false, message: `error: unknown argument: ${arg}` };
}

function parseArgs(argv: readonly string[]): ParseResult {
  const state = { summary: false, threshold: DEFAULT_THRESHOLD };
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i] ?? "";
    if (arg === "-h" || arg === "--help") return { kind: "help" };
    const r = reduceFlag(arg, argv[i + 1], state);
    if (!r.ok) return { kind: "error", message: r.message };
    i += r.consumed;
  }
  return { kind: "args", args: { summary: state.summary, threshold: state.threshold } };
}

function lineCount(path: string): number {
  // Match bash `wc -l < FILE`: counts newline characters.
  let content: string;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    return -1;
  }
  let count = 0;
  for (const ch of content) {
    if (ch === "\n") count += 1;
  }
  return count;
}

function emitSummary(target: string, lc: number, threshold: number): string {
  const remaining = threshold - lc;
  const pct = Math.floor((lc * 100) / threshold);
  const lines: string[] = [];
  lines.push("tick-history-bounded-growth audit");
  lines.push(`  target:           ${target}`);
  lines.push(`  line count:       ${String(lc)}`);
  lines.push(`  threshold:        ${String(threshold)}`);
  lines.push(`  remaining room:   ${String(remaining)} lines (${String(100 - pct)}%)`);
  if (lc > threshold) {
    lines.push("  status:           OVER THRESHOLD — archive action due");
  } else if (pct >= 80) {
    lines.push(`  status:           approaching threshold (${String(pct)}%)`);
  } else {
    lines.push(`  status:           within bounds (${String(pct)}%)`);
  }
  return lines.join("\n");
}

function emitTerse(lc: number, threshold: number): { text: string; code: AuditExitCode } {
  const pct = Math.floor((lc * 100) / threshold);
  if (lc > threshold) {
    return {
      text: [
        `OVER threshold: ${String(lc)}/${String(threshold)} lines (${String(pct)}%). Archive action due.`,
        "Expected action: move first 80% of rows to docs/hygiene-history/loop-tick-history-YYYY-QN-archive.md and leave a pointer.",
      ].join("\n"),
      code: 2,
    };
  }
  if (pct >= 80) {
    return {
      text: `APPROACHING threshold: ${String(lc)}/${String(threshold)} lines (${String(pct)}%).`,
      code: 0,
    };
  }
  return {
    text: `within bounds: ${String(lc)}/${String(threshold)} lines (${String(pct)}%).`,
    code: 0,
  };
}

export function main(argv: readonly string[]): AuditExitCode {
  const parsed = parseArgs(argv);
  if (parsed.kind === "help") {
    process.stdout.write(
      "Usage: audit-tick-history-bounded-growth.ts [--summary] [--threshold N]\n",
    );
    return 0;
  }
  if (parsed.kind === "error") {
    process.stderr.write(`${parsed.message}\n`);
    return 1;
  }
  const { args } = parsed;
  const root = repoRoot();
  const target = `${root}/${TARGET_REL}`;
  const lc = lineCount(target);
  if (lc < 0) {
    process.stderr.write(`error: target file not found: ${target}\n`);
    return 1;
  }

  if (args.summary) {
    process.stdout.write(`${emitSummary(target, lc, args.threshold)}\n`);
    return lc > args.threshold ? 2 : 0;
  }
  const out = emitTerse(lc, args.threshold);
  process.stdout.write(`${out.text}\n`);
  return out.code;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
