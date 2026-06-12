#!/usr/bin/env bun
/**
 * substrate-claim-checker / check-counts.ts (v1.0)
 *
 * Per the verify-then-claim discipline memo
 * (`memory/feedback_verify_then_claim_discipline_dominant_failure_mode_substrate_authoring_otto_2026_05_03.md`).
 *
 * Catches count drift between narrative claims (e.g. "20 drift
 * instances", "13-row table", "5 procedure skills") and the
 * actual count of structured rows the claims reference.
 *
 * Iteration history (Copilot recursive review on PR #1260):
 *   v0   — initial ship: count-drift sub-class only
 *   v0.1 — strict-null guards; `+` semantics; hyphenated forms;
 *          fence + table-cell skip in findClaims; drop unused field
 *   v0.2 — fence skipping in findTables (asymmetric-discipline catch)
 *   v0.3 — separator regex requires `-`; export main + import.meta.main
 *          guard; B-0170 sub-class accuracy; indented-table v1 doc
 *   v0.4 — CommonMark fence-delimiter tracking (char + length match);
 *          directory rejection via statSync; readFileSync error wrap
 *   v0.4.1 — file header version label refresh; explicit error wrap
 *   v0.4.2 — collapse existsSync+statSync+readFileSync into single
 *            try/catch around readFileSync (eliminates TOCTOU race
 *            CodeQL flagged); categorize ENOENT / EISDIR by err.code
 *   v0.4.3 — bun:test unit-test suite (16 tests across findTables /
 *            findClaims / checkFile); README + B-0170 count drift
 *            switched to "memo's body table is canonical"
 *   v0.4.4 — fence-close requires whitespace-only after delimiter
 *            (closes "```bash" classified as opening info-string
 *            rather than closer)
 *   v1.0 — B-0170 smallest-slice claim: v1 sub-classes (existence,
 *          path-form, cross-surface, convention) now shipped in sibling
 *          modules; this file remains the count-drift anchor.
 *
 * Remaining (deferred per B-0170 re-decomp assumption):
 *   - Semantic-equivalence drift
 *   - Empirical-output drift
 *   - Self-recursive drift
 *
 * Usage:
 *   bun tools/substrate-claim-checker/check-counts.ts <file>
 *   bun tools/substrate-claim-checker/check-counts.ts <file1> <file2> ...
 *
 * Exit code:
 *   0  no drift detected
 *   1  drift detected, missing input file, or no inputs given
 */

import { readFileSync } from "node:fs";

interface Finding {
  file: string;
  line: number;
  claim: string;
  claimedCount: number;
  claimIsMinimum: boolean;
  actualCount: number;
  context: string;
}

interface Table {
  startLine: number;
  rowCount: number;
}

interface Claim {
  line: number;
  raw: string;
  n: number;
  /** True if the original claim used a `+` suffix ("20+" → minimum). */
  isMinimum: boolean;
  noun: string;
}

/**
 * Find all markdown tables in the file and count data rows in each.
 * Skips fenced code blocks so example tables in code fences aren't
 * miscounted as real tables. Same fence-tracking discipline as
 * `findClaims()`.
 */
function findTables(lines: string[]): Table[] {
  const tables: Table[] = [];
  let fenceChar: "`" | "~" | null = null;
  let fenceLen = 0;
  let i = 0;
  while (i < lines.length) {
    const cur = lines[i] ?? "";
    // CommonMark fence rules:
    //   - Opening fences may have an "info string" after the delimiter
    //     (e.g. "```bash" or "```{language=ts}").
    //   - Closing fences MUST be whitespace-only after the delimiter
    //     (per the CommonMark spec — "the closing fence must not have
    //     a info string"). Use two regexes to distinguish.
    const fenceOpen = /^\s*(`{3,}|~{3,})/.exec(cur);
    const fenceClose = /^\s*(`{3,}|~{3,})\s*$/.exec(cur);
    if (fenceOpen) {
      const delim = fenceOpen[1] ?? "";
      const ch = delim[0] === "`" ? "`" : "~";
      const len = delim.length;
      if (fenceChar === null) {
        // Opening fences are allowed to carry an info string.
        fenceChar = ch;
        fenceLen = len;
        i++;
        continue;
      }
      // Inside a fence — only a whitespace-only closer with same
      // char + at-least-equal length closes per CommonMark.
      if (fenceClose && ch === fenceChar && len >= fenceLen) {
        fenceChar = null;
        fenceLen = 0;
        i++;
        continue;
      }
      // Otherwise it's just a line inside the fence (e.g. nested
      // shorter delimiter, or a delimiter line with non-whitespace
      // trailing content like "```bash" used as info-string echo).
    }
    if (fenceChar !== null) {
      i++;
      continue;
    }
    const headerLine = cur;
    const sepLine = lines[i + 1] ?? "";
    // Separator must contain at least one `-` to be a real GFM table
    // separator; `|   |` or `||||` are not valid separators.
    if (
      /^\|.*\|\s*$/.test(headerLine) &&
      i + 1 < lines.length &&
      /^\|[\s\-:|]*-[\s\-:|]*\|\s*$/.test(sepLine)
    ) {
      const startLine = i + 1; // 1-indexed; header row is at i (0-indexed)
      let rowCount = 0;
      let j = i + 2;
      while (j < lines.length && /^\|.*\|\s*$/.test(lines[j] ?? "")) {
        rowCount++;
        j++;
      }
      tables.push({ startLine, rowCount });
      i = j;
    } else {
      i++;
    }
  }
  return tables;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Find narrative claims like "N drift instances", "N rows", "N items",
 * "N-row table". Skips fenced code blocks and lines that are clearly
 * markdown table cells (start with `|`).
 */
function findClaims(lines: string[]): Claim[] {
  const claims: Claim[] = [];
  const nounsToCheck = [
    "drift instances",
    "drift instance",
    "rows",
    "row",
    "items",
    "item",
    "procedure skills",
    "named-persona experts",
    "tools",
    "sub-classes",
    "check-types",
  ];
  // Match "20 rows" / "20+ rows" (whitespace-separated) or
  // "20-row" / "20+-row" (hyphenated), capturing integer + optional '+'.
  const nounAlt = nounsToCheck.map(escapeRegex).join("|");
  const pattern = new RegExp(
    `\\b(\\d+)(\\+?)[\\s-]+(${nounAlt})\\b`,
    "gi",
  );
  // CommonMark fence-tracking: opening fences may carry an info
  // string ("```bash"); closing fences MUST be whitespace-only
  // after the delimiter.
  let fenceChar: "`" | "~" | null = null;
  let fenceLen = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const fenceOpen = /^\s*(`{3,}|~{3,})/.exec(line);
    const fenceClose = /^\s*(`{3,}|~{3,})\s*$/.exec(line);
    if (fenceOpen) {
      const delim = fenceOpen[1] ?? "";
      const ch = delim[0] === "`" ? "`" : "~";
      const len = delim.length;
      if (fenceChar === null) {
        fenceChar = ch;
        fenceLen = len;
        continue;
      }
      if (fenceClose && ch === fenceChar && len >= fenceLen) {
        fenceChar = null;
        fenceLen = 0;
        continue;
      }
    }
    if (fenceChar !== null) continue;
    // Skip table rows (start with `|`) — they're data, not narrative.
    if (/^\s*\|/.test(line)) continue;
    for (const m of line.matchAll(pattern)) {
      const numStr = m[1];
      const plus = m[2];
      const noun = m[3];
      if (numStr === undefined || noun === undefined) continue;
      claims.push({
        line: i + 1,
        raw: m[0] ?? "",
        n: parseInt(numStr, 10),
        isMinimum: plus === "+",
        noun: noun.toLowerCase(),
      });
    }
  }
  return claims;
}

/**
 * For each claim, find the nearest table BELOW it within 50 lines and
 * check whether the claim's N matches the table's row count.
 *
 * "20+" is treated as a minimum-count claim: drift fires only when
 * actual < claimed. "20" (no plus) requires exact match.
 */
function checkFile(filePath: string): { findings: Finding[]; ok: boolean } {
  // Single try/catch around readFileSync — collapses prior
  // existsSync + statSync + readFileSync TOCTOU race into one
  // syscall; categorize errors by Node error code so the user
  // gets the same explicit messages (ENOENT / EISDIR / etc).
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      console.error(`error: file not found: ${filePath}`);
    } else if (code === "EISDIR") {
      console.error(`error: not a regular file (directory): ${filePath}`);
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`error: read failed for ${filePath}: ${msg}`);
    }
    return { findings: [], ok: false };
  }
  const lines = content.split("\n");
  const tables = findTables(lines);
  const claims = findClaims(lines);
  const findings: Finding[] = [];

  for (const claim of claims) {
    const nearestTable = tables.find(
      (t) => t.startLine > claim.line && t.startLine - claim.line <= 50,
    );
    if (!nearestTable) continue;
    const drift = claim.isMinimum
      ? nearestTable.rowCount < claim.n
      : nearestTable.rowCount !== claim.n;
    if (drift) {
      findings.push({
        file: filePath,
        line: claim.line,
        claim: claim.raw,
        claimedCount: claim.n,
        claimIsMinimum: claim.isMinimum,
        actualCount: nearestTable.rowCount,
        context: `nearest table at line ${nearestTable.startLine} has ${nearestTable.rowCount} data rows`,
      });
    }
  }
  return { findings, ok: true };
}

export { findTables, findClaims, checkFile };
export type { Finding, Table, Claim };

export function main(): number {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("usage: bun tools/substrate-claim-checker/check-counts.ts <file> [<file> ...]");
    return 1;
  }
  let totalFindings = 0;
  let inputErrors = 0;
  for (const arg of args) {
    const { findings, ok } = checkFile(arg);
    if (!ok) {
      inputErrors++;
      continue;
    }
    for (const f of findings) {
      const operator = f.claimIsMinimum ? ">=" : "==";
      console.log(
        `${f.file}:${f.line}: count drift — claim "${f.claim}" (expected ${operator} ${f.claimedCount}) vs actual ${f.actualCount} (${f.context})`,
      );
      totalFindings++;
    }
  }
  if (inputErrors > 0) {
    console.error(`\n${inputErrors} input error(s).`);
    return 1;
  }
  if (totalFindings > 0) {
    console.log(`\n${totalFindings} count-drift finding(s).`);
    return 1;
  }
  console.log("no count drift detected.");
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
