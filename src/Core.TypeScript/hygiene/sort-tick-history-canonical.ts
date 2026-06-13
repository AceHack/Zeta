#!/usr/bin/env bun
// sort-tick-history-canonical.ts — sort + dedupe
// docs/hygiene-history/loop-tick-history.md to canonical chronological
// order.
//
// TypeScript+Bun port of the prior Python implementation, per the
// 2026-04-29 directive to canonicalize on TS+Bun for tooling. See
// memory/feedback_typescript_bun_default_step_out_carefully_aaron_2026_04_28.md
// for the substrate decision (filename retains the date-stamp slug per
// memory/* convention; in-code references should use role-refs).
// Behavior is preserved bit-for-bit against the Python source — see
// the equivalence-check protocol in B-0086.
//
// Why this exists (per maintainer 2026-04-26):
//     "maybe this should be substraite built in instead of dynamic python"
//
// What this does:
// - Reads `docs/hygiene-history/loop-tick-history.md`
// - Identifies the data-rows region (after the schema separator)
// - Extracts each row's ISO-8601 timestamp prefix
// - Stably sorts rows by (timestamp, original_position)
// - Removes exact-content duplicates
// - Writes the canonical-order file back
// - Prints a summary
//
// Composes with:
// - tools/hygiene/check-tick-history-order.ts (the detection check;
//   this script is the fix; .sh removed 2026-05-03 after #1380
//   .sh→.ts CI conversion)
// - Otto-229 (append-only tick-history; one-case override authorized
//   for canonical-order preservation since git history retains prior
//   state)
// - Otto-341 (mechanism over vigilance; tools/hygiene/ is the canonical
//   home for substrate-integrity tooling)
//
// Usage:
//     bun tools/hygiene/sort-tick-history-canonical.ts [--dry-run] [--file PATH]
//
//     Default: writes changes back to the file.
//     --dry-run: prints what would change; does not modify the file.
//
// Exit codes:
//     0 — sort + dedupe applied (or no changes needed)
//     1 — error (file not found, malformed)
//     2 — argument error

import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

interface Stats {
  rows_in: number;
  rows_out: number;
  duplicates_removed: number;
  reordered: boolean;
  trailing_lines_preserved: number;
}

interface Args {
  dryRun: boolean;
  file: string;
}

type DataRow = readonly [timestamp: string, originalIndex: number, line: string];
type UnmatchedRow = readonly [originalIndex: number, line: string];

function parseArgs(argv: readonly string[]): Args {
  const args: Args = {
    dryRun: false,
    file: "docs/hygiene-history/loop-tick-history.md",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === undefined) continue;
    if (a === "--dry-run") {
      args.dryRun = true;
    } else if (a === "--file") {
      const next = argv[i + 1];
      if (next === undefined) {
        process.stderr.write("ERROR: --file requires a value\n");
        process.exit(2);
      }
      args.file = next;
      i += 1;
    } else if (a.startsWith("--file=")) {
      args.file = a.slice("--file=".length);
    } else if (a === "-h" || a === "--help") {
      printHelp();
      process.exit(0);
    } else {
      process.stderr.write(`ERROR: unknown argument: ${a}\n`);
      process.exit(2);
    }
  }
  return args;
}

function printHelp(): void {
  const lines = [
    "sort-tick-history-canonical.ts — sort + dedupe tick-history.md",
    "",
    "Usage:",
    "  bun tools/hygiene/sort-tick-history-canonical.ts [--dry-run] [--file PATH]",
    "",
    "Default --file: docs/hygiene-history/loop-tick-history.md",
    "  (relative paths resolve to repo root via 'git rev-parse --show-toplevel';",
    "  if not in a git checkout, falls back to current working directory)",
  ];
  console.log(lines.join("\n"));
}

// Resolve the repo root via `git rev-parse --show-toplevel`. Mirrors
// sibling hygiene scripts (and the Python source) which invoke `git`
// from PATH. Returns null if not in a git repo (caller falls back to
// CWD).
function repoRoot(): string | null {
  try {
    // sonarjs/no-os-command-from-path: matches Python source's
    // `subprocess.run(["git", ...])` convention. `git` from PATH is
    // load-bearing for the hygiene-script family.
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8",
    });
    if (result.status !== 0) return null;
    const out = result.stdout.trim();
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

// Return the line index of the markdown table separator (last
// occurrence — the file has a sample schema row earlier in prose).
function findSeparatorLine(lines: readonly string[]): number | null {
  let sepIdx: number | null = null;
  const sepPattern = /^\|[-|\s]+\|$/;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line !== undefined && sepPattern.test(line.trim())) {
      sepIdx = i;
    }
  }
  return sepIdx;
}

// Return ISO-8601 timestamp prefix from a data row, or null if the line
// is not a data row.
//
// Handles two formats:
// - Full: `| 2026-04-26T03:38:42Z (...)` — direct timestamp
// - Placeholder: `| 2026-04-22T (round-44 tick, ...)` — date-only,
//   treated as 00:00:00Z for sort purposes
function getTimestamp(line: string): string | null {
  const full = /^\| (\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})Z?/.exec(line);
  if (full) {
    const date = full[1] ?? "";
    const time = full[2] ?? "";
    return `${date}T${time}Z`;
  }
  const placeholder = /^\| (\d{4}-\d{2}-\d{2})T /.exec(line);
  if (placeholder) {
    const date = placeholder[1] ?? "";
    return `${date}T00:00:00Z`;
  }
  return null;
}

// Bucket each data line into matched (timestamp-prefixed) or unmatched
// (table-shaped but no timestamp). Blank lines are skipped.
function bucketDataLines(data: readonly string[]): {
  dataRows: DataRow[];
  unmatchedTableRows: UnmatchedRow[];
} {
  const dataRows: DataRow[] = [];
  const unmatchedTableRows: UnmatchedRow[] = [];
  for (let originalIndex = 0; originalIndex < data.length; originalIndex += 1) {
    const line = data[originalIndex];
    if (line === undefined) continue;
    if (line.trim() === "") continue;
    const ts = getTimestamp(line);
    if (ts !== null) {
      dataRows.push([ts, originalIndex, line]);
    } else if (line.replace(/^\s+/, "").startsWith("|")) {
      unmatchedTableRows.push([originalIndex, line]);
    }
  }
  return { dataRows, unmatchedTableRows };
}

// Compute the trailing-prose lines preserved after the last table-shaped
// row. Returns [] when there is no trailing prose. Strips leading blank
// lines so the reconstructed file gets a single canonical blank between
// table-end and prose-start.
function computeTrailingLines(
  data: readonly string[],
  dataRows: readonly DataRow[],
  unmatchedTableRows: readonly UnmatchedRow[],
): string[] {
  const tableIndices = [
    ...dataRows.map((row) => row[1]),
    ...unmatchedTableRows.map((row) => row[0]),
  ].sort((a, b) => a - b);
  if (tableIndices.length === 0) return [];
  const lastTableIdx = tableIndices[tableIndices.length - 1] ?? 0;
  const trailingCandidate = data.slice(lastTableIdx + 1);
  let firstNonBlank = trailingCandidate.length;
  for (let i = 0; i < trailingCandidate.length; i += 1) {
    const tcLine = trailingCandidate[i];
    if (tcLine !== undefined && tcLine.trim() !== "") {
      firstNonBlank = i;
      break;
    }
  }
  if (firstNonBlank < trailingCandidate.length) {
    return trailingCandidate.slice(firstNonBlank);
  }
  return [];
}

// Apply both the P0 (schema-drift) and P1 (unmatched-row) guards. P0
// fires when there are unmatched rows AND zero matched rows — the
// schema regex has drifted. P1 fires whenever any unmatched rows
// remain — silently dropping rows is the failure mode this script
// must prevent. Throws on either violation.
function enforceRowGuards(
  rowsIn: number,
  unmatchedTableRows: readonly UnmatchedRow[],
  sepFileLine: number,
): void {
  const first = unmatchedTableRows[0];
  if (first === undefined) return;
  const firstIdx = first[0];
  const firstLine = first[1];
  if (rowsIn === 0) {
    throw new Error(
      `schema drift: ${String(unmatchedTableRows.length)} table-shaped row(s) ` +
        `found but ZERO matched the ISO-8601 timestamp regex. ` +
        `Refusing to write — would wipe tick-history. ` +
        `First unmatched row at file-line ` +
        `${String(sepFileLine + 1 + firstIdx)}: ` +
        firstLine.slice(0, 120),
    );
  }
  throw new Error(
    `refusing to drop ${String(unmatchedTableRows.length)} unmatched ` +
      `table row(s); per Otto-229 (append-only discipline) the ` +
      `sort tool must not silently lose rows. ` +
      `First unmatched at file-line ` +
      `${String(sepFileLine + 1 + firstIdx)}: ${firstLine.slice(0, 120)}`,
  );
}

// Sort dataRows by (timestamp, originalIndex) and dedupe by exact row
// content. Returns the unique-row list and the original-order list as a
// pair. Stable sort matches Python's `list.sort(key=...)` behaviour.
function sortAndDedupe(dataRows: DataRow[]): {
  uniqueRows: string[];
  originalOrder: string[];
} {
  const originalOrder = dataRows.map((row) => row[2]);
  const sorted = [...dataRows].sort((a, b) => {
    if (a[0] < b[0]) return -1;
    if (a[0] > b[0]) return 1;
    return a[1] - b[1];
  });
  const seen = new Set<string>();
  const uniqueRows: string[] = [];
  for (const row of sorted) {
    const line = row[2];
    if (seen.has(line)) continue;
    seen.add(line);
    uniqueRows.push(line);
  }
  return { uniqueRows, originalOrder };
}

// Assemble the canonical-order text from header, sorted unique rows,
// and (optional) trailing prose. The blank-line separator between
// table-end and trailing-content is required by CommonMark to terminate
// the table and start a new block.
function assembleOutput(
  header: readonly string[],
  uniqueRows: readonly string[],
  trailingLines: readonly string[],
): string {
  const parts: string[] = [header.join("\n"), uniqueRows.join("\n")];
  if (trailingLines.length > 0) {
    parts.push("");
    parts.push(trailingLines.join("\n"));
  }
  return `${parts.join("\n")}\n`;
}

function detectReordering(
  uniqueRows: readonly string[],
  originalOrder: readonly string[],
  rowsIn: number,
): boolean {
  if (uniqueRows.length !== rowsIn) return true;
  for (let i = 0; i < uniqueRows.length; i += 1) {
    if (uniqueRows[i] !== originalOrder[i]) return true;
  }
  return false;
}

// Sort + dedupe data rows in tick-history content. Returns
// [new_text, stats].
function sortCanonical(text: string): [string, Stats] {
  const lines = text.split("\n");
  const sepIdx = findSeparatorLine(lines);
  if (sepIdx === null) {
    throw new Error("No markdown table separator found in tick-history file");
  }

  const header = lines.slice(0, sepIdx + 1);
  const data = lines.slice(sepIdx + 1);
  // 1-based file line number of separator, used for diagnostic line refs.
  const sepFileLine = sepIdx + 1;

  const { dataRows, unmatchedTableRows } = bucketDataLines(data);
  const rowsIn = dataRows.length;
  const trailingLines = computeTrailingLines(data, dataRows, unmatchedTableRows);

  enforceRowGuards(rowsIn, unmatchedTableRows, sepFileLine);

  const { uniqueRows, originalOrder } = sortAndDedupe(dataRows);
  const newText = assembleOutput(header, uniqueRows, trailingLines);
  const rowsOut = uniqueRows.length;
  const reordered = detectReordering(uniqueRows, originalOrder, rowsIn);

  return [
    newText,
    {
      rows_in: rowsIn,
      rows_out: rowsOut,
      duplicates_removed: rowsIn - rowsOut,
      reordered,
      trailing_lines_preserved: trailingLines.length,
    },
  ];
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));

  // Resolve --file relative to repo root when it is a relative path.
  let p = args.file;
  if (!isAbsolute(p)) {
    const root = repoRoot();
    if (root !== null) {
      p = resolve(root, args.file);
    }
  }

  // Try-readFile + catch ENOENT (instead of existsSync-then-readFile) to
  // avoid TOCTOU race-condition (CWE-367, CodeQL flagged). The existsSync
  // pattern leaves a race window where the file is deleted between check
  // and read; catching ENOENT on the read itself is atomic at the
  // OS-syscall level.
  let original: string;
  try {
    original = await readFile(p, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      process.stderr.write(`ERROR: file not found: ${p}\n`);
      return 1;
    }
    throw err;
  }
  let newText: string;
  let stats: Stats;
  try {
    [newText, stats] = sortCanonical(original);
  } catch (exc) {
    const msg = exc instanceof Error ? exc.message : String(exc);
    process.stderr.write(`ERROR: ${msg}\n`);
    return 1;
  }

  console.log(`rows_in:            ${String(stats.rows_in)}`);
  console.log(`rows_out:           ${String(stats.rows_out)}`);
  console.log(`duplicates_removed: ${String(stats.duplicates_removed)}`);
  // Python prints `True` / `False` (capitalized). Match exactly so
  // stat output diffs cleanly between the two implementations.
  console.log(`reordered:          ${stats.reordered ? "True" : "False"}`);

  if (newText === original) {
    console.log("OK: file already in canonical order; no changes");
    return 0;
  }

  if (args.dryRun) {
    console.log("DRY RUN: would write changes; --dry-run prevented");
    return 0;
  }

  await writeFile(p, newText);
  console.log(
    `WROTE ${p} (${String(original.length)} -> ${String(newText.length)} bytes)`,
  );
  return 0;
}

// Set process.exitCode (instead of process.exit) so pending stdout/
// stderr writes flush before the process terminates. Mirrors the
// tally.ts pattern.
process.exitCode = await main();
