#!/usr/bin/env bun
// fix-markdown-md032-md026.ts — mechanical fix for two markdownlint
// violations:
//
// - MD032 (blanks-around-lists): inserts blank lines before/after list
//   blocks where they're missing
// - MD026 (no-trailing-punctuation): strips trailing `.,;:!?` from
//   ATX headings
//
// Language choice: bun + TypeScript per
// `docs/DECISIONS/2026-04-20-tools-scripting-language.md`. Replaces the
// prior Python implementation per the 2026-04-29 directive to
// canonicalize on TS+Bun for tooling. Behavioural equivalence with
// the (now-retired) Python source is verified via the protocol in
// B-0086.
//
// Why this exists (per maintainer 2026-04-26):
//     "in python shape should be a queue that we are missing substraight
//      primitives"
//
// Per Otto-346 principle (recurring dynamic Python = signal a substrate
// primitive is missing), the right home is `tools/hygiene/` checked
// into substrate. This tool is the formalized version of the recurring
// pattern.
//
// Usage:
//     bun tools/hygiene/fix-markdown-md032-md026.ts FILE [FILE ...]
//     bun tools/hygiene/fix-markdown-md032-md026.ts --dry-run FILE
//
// Always idempotent: running on already-clean file is no-op.
//
// Composes with:
// - markdownlint-cli2 (.github/workflows/gate.yml lint-markdown job)
//   — this tool produces input the linter accepts; the linter is the
//   detection check
// - Otto-341 (mechanism over discipline; markdownlint discipline
//   becomes mechanism via this tool)
// - Otto-346 candidate (recurring dynamic = missing primitive;
//   this tool IS the primitive that absorbs the recurring pattern)

import { readFile, writeFile } from "node:fs/promises";

// CommonMark unordered list markers (`-`, `*`, `+`) plus ordered
// (`\d+\.`). markdownlint MD004 is disabled in this repo, so alternate
// markers do appear in committed files.
const LIST_LINE = /^( {2})*(?:[-*+] |\d+\. )/;
const INDENTED_LINE = /^ {2,}\S/;

// ATX heading test. Trailing-punctuation stripping is done procedurally
// in stripHeadingPunctuation — no regex for the punctuation match. The
// procedural form (a) avoids ReDoS shapes (sonarjs/slow-regex) and
// (b) has no length bound, matching Python's `[.,;:!?]+$` behavior on
// any input including machine-generated headings with arbitrarily long
// punctuation runs (PR #849 review noted that an earlier 10-char bound
// regressed equivalence on long runs).
const HEADING_LINE = /^#+ /;
const HEADING_PUNCT_CHARS = ".,;:!?";

// Fenced-code-block opening delimiter: `^( {0,3})(`{3,}|~{3,})...`.
// We capture only the indent + fence chars; whatever follows is the
// info string, which we slice out separately to avoid a regex shape
// sonarjs flags as ReDoS-adjacent.
const FENCE_DELIM = /^( {0,3})(`{3,}|~{3,})/;

// YAML frontmatter line discriminator: matches a non-empty line that
// starts with a key followed by colon (with optional leading whitespace
// and optional value).
const YAML_KEY_LINE = /^\s*[A-Za-z_][\w-]*\s*:/;

const MAX_FRONTMATTER = 200;
const YAML_RATIO_MIN = 0.75;

// Discriminated-union result for fixFile — Result-style for the
// expected outcomes (`not-found` / `unchanged` / `fixed`) per Zeta's
// Result-over-exception convention (CLAUDE.md ground rules).
// Unexpected I/O errors (non-ENOENT read, write failures) still
// propagate as exceptions for the caller to convert to an exit code;
// only the expected-outcome surface is exception-free. The
// `bytesDiff` is the UTF-16 code-unit delta; for ASCII content it
// matches Python's `len(fixed) - len(original)`.
type FixResult =
  | { kind: "unchanged" }
  | { kind: "fixed"; bytesDiff: number }
  | { kind: "not-found" };

interface FenceState {
  openChar: string | null;
  openLen: number;
}

interface BlanksBeforePass {
  out: string[];
  outInside: boolean[];
}

interface Args {
  files: string[];
  dryRun: boolean;
}

// Strip trailing punctuation (with optional trailing whitespace) from
// an ATX heading line. Returns the cleaned line, or null if the line is
// not a heading or has no trailing punctuation. Procedural form avoids
// the lazy-quantifier shape sonarjs flags.
function stripHeadingPunctuation(line: string): string | null {
  if (!HEADING_LINE.test(line)) return null;
  const trimmed = line.trimEnd();
  // Find where the heading prefix ends (after `#+ `). Used to preserve
  // at least ONE character of heading text below — see floor comment.
  const prefixMatch = HEADING_LINE.exec(trimmed);
  const prefixEnd = prefixMatch ? prefixMatch[0].length : 0;
  // Walk backwards from end-of-string, counting trailing chars that
  // belong to the punctuation set. Procedural form (no regex) so:
  //   (a) no ReDoS shape (sonarjs/slow-regex stays clean)
  //   (b) no length bound (matches Python's `[.,;:!?]+$` on any input
  //       length, including machine-generated headings with arbitrarily
  //       long punctuation runs)
  //   (c) preserves at least one character of heading text — Python's
  //       `_HEADING_WITH_PUNCT` regex used `.+?` before the punctuation
  //       class, requiring at least one non-punct char between `#+ `
  //       and the trailing punctuation run. A punctuation-only heading
  //       like `# !!!` should keep one char (`# !!`), not be erased
  //       to `# `. The `i > prefixEnd + 1` floor enforces this.
  let i = trimmed.length;
  while (i > prefixEnd + 1 && HEADING_PUNCT_CHARS.includes(trimmed[i - 1] ?? "")) {
    i -= 1;
  }
  if (i === trimmed.length) return null; // no trailing punctuation
  return trimmed.slice(0, i);
}

// Return true if a line plausibly continues a YAML key's value:
// indented continuation (>= 2 spaces or tab) of any non-blank content.
// Does NOT match column-0 lines.
function isYamlContinuation(line: string): boolean {
  if (line.trim() === "") return false;
  return line.startsWith("  ") || line.startsWith("\t");
}

function isYamlOk(line: string): boolean {
  return (
    line.trim() === "" ||
    YAML_KEY_LINE.test(line) ||
    isYamlContinuation(line)
  );
}

function isList(line: string): boolean {
  return LIST_LINE.test(line);
}

function isListOrContinuation(line: string): boolean {
  return LIST_LINE.test(line) || INDENTED_LINE.test(line);
}

// Locate the closing `---` for a candidate YAML frontmatter block, or
// -1 if no closing fence appears within MAX_FRONTMATTER lines.
function findFrontmatterEnd(lines: readonly string[]): number {
  const upper = Math.min(lines.length, MAX_FRONTMATTER + 1);
  for (let j = 2; j < upper; j += 1) {
    if (lines[j]?.trimEnd() === "---") return j;
  }
  return -1;
}

// Compute the YAML-shaped ratio of non-blank lines between the bookends
// (frontmatter check (e)). Returns true if the ratio meets the minimum
// or if there are no non-blank lines (vacuously true).
function frontmatterRatioOk(lines: readonly string[], fmEnd: number): boolean {
  let yamlCount = 0;
  let nonBlank = 0;
  for (let j = 1; j < fmEnd; j += 1) {
    const lj = lines[j];
    if (lj === undefined || lj.trim() === "") continue;
    nonBlank += 1;
    if (YAML_KEY_LINE.test(lj) || isYamlContinuation(lj)) yamlCount += 1;
  }
  return nonBlank === 0 || yamlCount / nonBlank >= YAML_RATIO_MIN;
}

// YAML frontmatter region — only if all FIVE conditions hold:
// (a) line 0 is exactly `---` (after trailing-whitespace strip)
// (b) line 1 is YAML-shaped (matches `key:` at start, ignoring leading
//     whitespace)
// (c) a closing `---` line exists within the next 200 lines
// (d) the line immediately BEFORE the closing `---` is YAML-shaped,
//     blank, or a YAML continuation
// (e) at least 75% of non-blank lines BETWEEN the bookends are
//     YAML-shaped
//
// Returns -1 when no frontmatter is present, otherwise returns the
// index of the closing `---`.
function findFrontmatterRegion(lines: readonly string[]): number {
  if (lines.length < 2) return -1;
  const line0 = lines[0];
  const line1 = lines[1];
  if (line0 === undefined || line1 === undefined) return -1;
  if (line0.trimEnd() !== "---") return -1;
  if (!YAML_KEY_LINE.test(line1)) return -1;
  const fmEnd = findFrontmatterEnd(lines);
  if (fmEnd <= 0) return -1;
  if (!isYamlOk(lines[fmEnd - 1] ?? "")) return -1;
  if (!frontmatterRatioOk(lines, fmEnd)) return -1;
  return fmEnd;
}

// Parse a fence-delimiter line into { fenceChar, fenceLen, infoString }
// or null if the line is not a fence. Procedural to keep regex bounded;
// the info string is whatever follows the fence chars.
function parseFenceLine(line: string): {
  fenceChar: string;
  fenceLen: number;
  info: string;
} | null {
  const m = FENCE_DELIM.exec(line);
  if (m === null) return null;
  const fence = m[2] ?? "";
  const fenceChar = fence[0] ?? "";
  const fenceLen = fence.length;
  const tail = line.slice((m[1]?.length ?? 0) + fenceLen).trimStart();
  // The Python source enforced `([^`]*)$` on the info string for BOTH
  // backtick and tilde fences — a backtick anywhere in the info string
  // invalidates the fence delimiter regardless of fence char. We honour
  // the same constraint procedurally for behavioural parity with the
  // retired Python tool (`fix-markdown-md032-md026.py`).
  if (tail.includes("`")) return null;
  return { fenceChar, fenceLen, info: tail };
}

// Update fence state and the `inside` mark for a single line.
function processFenceLine(
  line: string,
  i: number,
  inside: boolean[],
  state: FenceState,
): void {
  const parsed = parseFenceLine(line);
  if (parsed === null) {
    inside[i] = state.openChar !== null;
    return;
  }
  if (state.openChar === null) {
    state.openChar = parsed.fenceChar;
    state.openLen = parsed.fenceLen;
    inside[i] = true;
    return;
  }
  // Possible closing fence — must be same char class, length >=
  // openLen, and have no info string.
  const isClose =
    parsed.fenceChar === state.openChar &&
    parsed.fenceLen >= state.openLen &&
    parsed.info === "";
  inside[i] = true; // both closing line and lookalike are inside
  if (isClose) {
    state.openChar = null;
    state.openLen = 0;
  }
}

// Return a boolean array `inside[i]` = true iff line `i` is inside a
// region that must NOT be touched by the MD032/MD026 transforms.
//
// Two such regions: YAML frontmatter (5-condition discriminator) and
// fenced code blocks (matching open/close char + length).
function classifyLines(lines: readonly string[]): boolean[] {
  const inside = new Array<boolean>(lines.length).fill(false);

  const fmEnd = findFrontmatterRegion(lines);
  if (fmEnd > 0) {
    for (let k = 0; k <= fmEnd; k += 1) inside[k] = true;
  }

  // Pass 2: fenced code blocks (skip lines already marked inside
  // frontmatter — they don't open / close fences).
  const state: FenceState = { openChar: null, openLen: 0 };
  for (let i = 0; i < lines.length; i += 1) {
    if (inside[i]) continue;
    const line = lines[i];
    if (line === undefined) continue;
    processFenceLine(line, i, inside, state);
  }
  return inside;
}

// Insert blank lines before list blocks (where the previous line is
// non-blank and not itself a list/continuation).
function insertBlanksBefore(
  lines: readonly string[],
  inside: readonly boolean[],
): BlanksBeforePass {
  const out: string[] = [];
  const outInside: boolean[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === undefined) continue;
    const prev = out.at(-1);
    const prevInside = outInside.at(-1) ?? false;
    if (
      !inside[i] &&
      isList(line) &&
      prev !== undefined &&
      prev.trim() !== "" &&
      !prevInside &&
      !isListOrContinuation(prev)
    ) {
      out.push("");
      outInside.push(false);
    }
    out.push(line);
    outInside.push(inside[i] ?? false);
  }
  return { out, outInside };
}

// Insert blank lines after list blocks (where the next line is
// non-blank and not part of the list).
function insertBlanksAfter(
  lines: readonly string[],
  inside: readonly boolean[],
): string[] {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === undefined) continue;
    out.push(line);
    const nxt = lines[i + 1];
    const nxtInside = inside[i + 1] ?? false;
    if (
      !inside[i] &&
      isList(line) &&
      nxt !== undefined &&
      nxt.trim() !== "" &&
      !nxtInside &&
      !isListOrContinuation(nxt)
    ) {
      out.push("");
    }
  }
  return out;
}

// Insert blank lines around list blocks. Skips lines inside fenced code
// blocks — inserting blanks there would mutate code examples (e.g.
// shell-script with `- option` flags would acquire spurious blanks).
function fixMd032(text: string): string {
  const lines = text.split("\n");
  const inside = classifyLines(lines);
  const before = insertBlanksBefore(lines, inside);
  return insertBlanksAfter(before.out, before.outInside).join("\n");
}

// Strip trailing punctuation (with optional trailing whitespace) from
// ATX heading lines. Skips lines inside fenced code blocks.
function fixMd026(text: string): string {
  const lines = text.split("\n");
  const inside = classifyLines(lines);
  return lines
    .map((line, i) => {
      if (inside[i]) return line;
      return stripHeadingPunctuation(line) ?? line;
    })
    .join("\n");
}

// Apply both fixes to a file. Returns a discriminated-union result.
//
// Uses try-readFile + catch ENOENT (instead of existsSync-then-readFile)
// to avoid TOCTOU race-condition (CWE-367, CodeQL flagged). The
// existsSync pattern leaves a race window where the file is deleted
// between the check and the read; catching ENOENT on the read itself
// is atomic at the OS-syscall level.
async function fixFile(path: string, dryRun: boolean): Promise<FixResult> {
  let original: string;
  try {
    original = await readFile(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { kind: "not-found" };
    }
    throw err;
  }
  const fixed = fixMd026(fixMd032(original));
  if (fixed === original) return { kind: "unchanged" };
  if (!dryRun) await writeFile(path, fixed);
  return { kind: "fixed", bytesDiff: fixed.length - original.length };
}

function fail(message: string, code: number): never {
  process.stderr.write(`ERROR: ${message}\n`);
  process.exit(code);
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = { files: [], dryRun: false };
  for (const a of argv) {
    if (a === "--dry-run") {
      args.dryRun = true;
    } else if (a === "-h" || a === "--help") {
      printHelp();
      process.exit(0);
    } else if (a.startsWith("--")) {
      fail(`unknown argument: ${a}`, 2);
    } else {
      args.files.push(a);
    }
  }
  if (args.files.length === 0) fail("at least one FILE is required", 2);
  return args;
}

function printHelp(): void {
  console.log(
    [
      "fix-markdown-md032-md026.ts — mechanical MD032/MD026 fix",
      "",
      "Usage:",
      "  bun tools/hygiene/fix-markdown-md032-md026.ts FILE [FILE ...]",
      "  bun tools/hygiene/fix-markdown-md032-md026.ts --dry-run FILE",
      "",
      "Always idempotent: running on already-clean file is no-op.",
    ].join("\n"),
  );
}

async function processOneFile(
  path: string,
  dryRun: boolean,
): Promise<{ changed: boolean; error: boolean }> {
  const result = await fixFile(path, dryRun);
  switch (result.kind) {
    case "not-found":
      process.stderr.write(`ERROR: file not found: ${path}\n`);
      return { changed: false, error: true };
    case "unchanged":
      return { changed: false, error: false };
    case "fixed": {
      const verb = dryRun ? "WOULD FIX" : "FIXED";
      const sign = result.bytesDiff >= 0 ? "+" : "";
      // Explicit String() coercion satisfies @typescript-eslint/restrict-
      // template-expressions (configured strict — won't accept number in
      // template literal without explicit conversion). Output equivalence
      // with Python's `+{n}` / `{n}` formatting is preserved.
      console.log(`${verb} ${path} (${sign}${String(result.bytesDiff)} bytes)`);
      return { changed: true, error: false };
    }
  }
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));

  let anyChanged = false;
  let anyError = false;
  for (const f of args.files) {
    const { changed, error } = await processOneFile(f, args.dryRun);
    if (changed) anyChanged = true;
    if (error) anyError = true;
  }

  if (anyError) return 1;
  if (!anyChanged) console.log("OK: no changes needed");
  return 0;
}

// Set process.exitCode (instead of process.exit) so pending stdout/
// stderr writes flush before the process terminates. Mirrors the
// tally.ts pattern.
process.exitCode = await main();
