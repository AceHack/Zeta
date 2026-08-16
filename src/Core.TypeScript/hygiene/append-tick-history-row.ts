#!/usr/bin/env bun
// append-tick-history-row.ts — appends a row to the loop-tick-history
// using simple append (avoids the Edit-tool's reverse-chronological
// bug shape Aaron flagged 2026-04-26).
//
// TypeScript+Bun port of append-tick-history-row.sh, slice 10 of the
// TS+Bun migration. See docs/best-practices/repo-scripting.md.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/append-tick-history-row.ts "FULL_ROW_TEXT"
//
// The argument is the entire row including leading `| ` and trailing
// `|`. Caller is responsible for row content (signal-in-signal-out);
// this script is a dumb pipe + validator.
//
// Exit codes:
//   0   appended successfully
//   1   row malformed OR timestamp out of order
//   2   wrong number of arguments
//   3   row body is a repeated-token RUT (degenerate output) — NOT appended.
//       A rut tick must not be silently logged as a heartbeat; this is the
//       "artifact trips its own alarm" wiring (Aaron shadow*, 2026-06-14).
//       Healthy short bodies ("Green. Holding.") never trip it.

import { appendFileSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import { detectRepeatedTokenRut } from "./detect-repeated-token-rut";
import { stringCompare } from "../collation/collation";

type ExitCode = 0 | 1 | 2 | 3;

// Pipe-row schema: | ts | model | cron | BODY | PR | observation |
// split("|") → ["", ts, model, cron, body, pr, obs, ""] → body is index 4.
const BODY_FIELD_INDEX = 4;

/** Extract the trimmed body field from a full pipe-row, or null if the row
 *  has too few fields to carry a body. Pure; no I/O. */
export function extractBody(row: string): string | null {
  const fields = row.split("|");
  if (fields.length <= BODY_FIELD_INDEX) return null;
  return (fields[BODY_FIELD_INDEX] ?? "").trim();
}

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;

const TS_PREFIX_RE = /^\| (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z) /;
const ROW_TS_RE = /^\| (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)/;

function repoRoot(): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  if (result.status !== 0) return process.cwd();
  return result.stdout.trim();
}

function findLatestTimestamp(content: string): string {
  const timestamps: string[] = [];
  for (const line of content.split("\n")) {
    const m = ROW_TS_RE.exec(line);
    if (m !== null) timestamps.push(m[1] ?? "");
  }
  // ISO-8601 is lex-sortable; sort + take last for "latest".
  timestamps.sort((a, b) => stringCompare(a, b));
  return timestamps.length === 0 ? "" : (timestamps.at(-1) ?? "");
}

export function main(argv: readonly string[]): ExitCode {
  if (argv.length !== 1) {
    process.stderr.write(
      "usage: append-tick-history-row.ts \"<full row text including leading | and trailing |>\"\n",
    );
    return 2;
  }
  const row = argv[0];
  if (row === undefined) return 2;

  const m = TS_PREFIX_RE.exec(row);
  if (m === null) {
    process.stderr.write("ERROR: row must start with '| YYYY-MM-DDTHH:MM:SSZ '\n");
    process.stderr.write(`got: ${row.slice(0, 80)}...\n`);
    return 1;
  }
  const newTs = m[1] ?? "";

  const root = repoRoot();
  const tickFile = `${root}/docs/hygiene-history/loop-tick-history.md`;

  let existing: string;
  try {
    existing = readFileSync(tickFile, "utf8");
  } catch {
    process.stderr.write(`ERROR: cannot read tick-history at ${tickFile}\n`);
    return 1;
  }

  const latestTs = findLatestTimestamp(existing);
  if (latestTs !== "" && newTs < latestTs) {
    process.stderr.write(
      `ERROR: new row timestamp ${newTs} is BEFORE latest existing ${latestTs}\n`,
    );
    process.stderr.write("\n");
    process.stderr.write(
      "Tick-history is append-only with non-decreasing timestamps.\n",
    );
    process.stderr.write(
      "If your row is for a past tick, you have to either:\n",
    );
    process.stderr.write("  (a) update the timestamp to current UTC (preferred),\n");
    process.stderr.write("  (b) file an ADR explaining the back-dated correction\n");
    process.stderr.write("      and use a correction-row pattern per Otto-229.\n");
    return 1;
  }

  // Rut guard: refuse to log a tick whose body has collapsed into degenerate
  // repetition (the "court court court…" failure mode). The body is the loop
  // output; a rut there is attention with no entropy to attend to, and must
  // not be recorded as a heartbeat. Healthy terse bodies do not trip it
  // (short streams + no run >= maxRun). See ./detect-repeated-token-rut.
  const body = extractBody(row);
  if (body !== null) {
    const verdict = detectRepeatedTokenRut(body);
    if (verdict.isRut) {
      process.stderr.write(`ERROR: row body is a repeated-token rut — not appended.\n`);
      process.stderr.write(`  ${verdict.reason}\n`);
      process.stderr.write(`  body: ${body.slice(0, 120)}\n`);
      process.stderr.write(
        "A degenerate-output tick must not be logged as a heartbeat. Fix the\n" +
          "output (real signal or a named dependency), then re-append.\n",
      );
      return 3;
    }
  }

  appendFileSync(tickFile, `${row}\n`);
  process.stdout.write(`OK: appended row at ${newTs}\n`);
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
