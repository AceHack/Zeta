#!/usr/bin/env bun
// check-tick-history-order.ts — validates that tick-history rows
// appear in non-decreasing chronological order (ISO-8601 UTC).
//
// TypeScript+Bun port of check-tick-history-order.sh, slice 6 of
// the TS+Bun migration. See docs/best-practices/repo-scripting.md.
//
// What this checks:
//   - Every row matching `| YYYY-MM-DDTHH:MM(:SS)?Z (...)` is extracted
//     in file order.
//   - Timestamps must be non-decreasing (duplicates allowed).
//   - First violation reported with surrounding context.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/check-tick-history-order.ts [TICK_FILE]
//
// Exit codes:
//   0  order is fine (or fewer than 2 rows)
//   1  one or more rows out of order
//   2  tick-history file not found

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

type ExitCode = 0 | 1 | 2;

interface Row {
  readonly lineNum: number;
  readonly ts: string;
  readonly sortTs: string;
  readonly raw: string;
}

interface Violation {
  readonly lineNum: number;
  readonly ts: string;
  readonly prevLineNum: number;
  readonly prevTs: string;
  readonly raw: string;
  readonly prevRaw: string;
}

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;

const ROW_RE = /^\| (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?Z)/;
const MINUTE_PRECISION_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})Z$/;

function normalizeTimestampForSort(ts: string): string {
  return ts.replace(MINUTE_PRECISION_RE, "$1:00Z");
}

function repoRoot(): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  if (result.status !== 0) return process.cwd();
  return result.stdout.trim();
}

function extractRows(content: string): readonly Row[] {
  const out: Row[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const m = ROW_RE.exec(line);
    if (m === null) continue;
    const ts = m[1] ?? "";
    out.push({ lineNum: i + 1, ts, sortTs: normalizeTimestampForSort(ts), raw: line });
  }
  return out;
}

function findViolations(rows: readonly Row[]): readonly Violation[] {
  if (rows.length < 2) return [];
  const out: Violation[] = [];
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1];
    const cur = rows[i];
    if (prev === undefined || cur === undefined) continue;
    if (cur.sortTs < prev.sortTs) {
      out.push({
        lineNum: cur.lineNum,
        ts: cur.ts,
        prevLineNum: prev.lineNum,
        prevTs: prev.ts,
        raw: cur.raw,
        prevRaw: prev.raw,
      });
    }
  }
  return out;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n);
}

export function main(argv: readonly string[]): ExitCode {
  const root = repoRoot();
  const tickFile = argv[0] ?? `${root}/docs/hygiene-history/loop-tick-history.md`;

  let content: string;
  try {
    content = readFileSync(tickFile, "utf8");
  } catch {
    process.stderr.write(`ERROR: tick-history file not found at ${tickFile}\n`);
    return 2;
  }

  const rows = extractRows(content);

  if (rows.length < 2) {
    process.stdout.write(`OK: tick-history has ${String(rows.length)} row(s); nothing to check\n`);
    return 0;
  }

  const violations = findViolations(rows);

  for (const v of violations) {
    process.stderr.write(`VIOLATION: row at line ${String(v.lineNum)} has timestamp ${v.ts}\n`);
    process.stderr.write(`  but previous row at line ${String(v.prevLineNum)} has timestamp ${v.prevTs}\n`);
    process.stderr.write("  (timestamps must be non-decreasing in file order)\n");
    process.stderr.write("\n");
    process.stderr.write("  context — offending row tail:\n");
    process.stderr.write(`    ${truncate(v.raw, 200)}\n`);
    process.stderr.write("\n");
    process.stderr.write("  context — preceding row tail:\n");
    process.stderr.write(`    ${truncate(v.prevRaw, 200)}\n`);
    process.stderr.write("\n");
  }

  if (violations.length > 0) {
    process.stderr.write("\n");
    process.stderr.write(`FAIL: ${String(violations.length)} row(s) out of chronological order in ${tickFile}\n`);
    process.stderr.write("\n");
    process.stderr.write("How to fix:\n");
    process.stderr.write("  - For NEW rows: revert and re-append using bash heredoc\n");
    process.stderr.write("    (cat >> file << EOF) or tools/hygiene/append-tick-history-row.sh\n");
    process.stderr.write("  - For HISTORICAL disorder: Otto-229 one-case override is\n");
    process.stderr.write("    authorized (Aaron 2026-04-26: 'we have git history to\n");
    process.stderr.write("    keep us honest so no risk of permanat loss'). Re-order\n");
    process.stderr.write("    rows physically; git preserves the prior state.\n");
    process.stderr.write("  - Do NOT add an opt-in flag to suppress these violations.\n");
    process.stderr.write("    That is the Otto-341 self-deception pattern Aaron caught.\n");
    return 1;
  }

  process.stdout.write(`OK: ${String(rows.length)} tick-history rows in non-decreasing chronological order\n`);
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
