#!/usr/bin/env bun
// doc-comment-history-audit.ts — scan source doc comments for
// factory-process tokens that belong in PR descriptions, history
// files, or round-notes rather than in code.
//
// TypeScript+Bun port of doc-comment-history-audit.sh, slice 7 of
// the TS+Bun migration. See docs/best-practices/repo-scripting.md.
//
// The rule: a code-file comment (`///`, `//`, `#`) should explain
// what the code DOES — math, invariants, input contracts,
// composition guidance. It should not carry process-lineage tags
// (round shipped, external collaborator who formalised it,
// correction number, persona attribution). That content belongs in
// the PR description, the commit message, `docs/hygiene-history/**`,
// or memory files.
//
// Scope:
//   src/**/*.fs, src/**/*.cs
//   tests/**/*.fs, tests/**/*.cs
//   bench/**/*.fs
//   tools/**/*.sh, tools/**/*.ts, tools/**/*.fs
//
// NOT scanned (these legitimately carry history):
//   docs/hygiene-history/**, docs/DECISIONS/**, docs/ROUND-HISTORY.md
//   openspec/** (spec files — history is part of the spec)
//   memory/** (memory is by design historical)
//   .git/, bin/, obj/, vendored mirrors
//
// Usage:
//   bun tools/lint/doc-comment-history-audit.ts
//                                  # check mode (vs baseline)
//   bun tools/lint/doc-comment-history-audit.ts --list
//                                  # all violations, exit 0
//   bun tools/lint/doc-comment-history-audit.ts --fail-any
//                                  # exit 1 on ANY violation
//   bun tools/lint/doc-comment-history-audit.ts --regenerate-baseline
//
// Exit codes:
//   0   no new violations vs baseline (or --list / --regenerate)
//   1   violations
//   2   baseline missing or unknown mode

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

type ExitCode = 0 | 1 | 2;
type Mode = "check" | "list" | "fail-any" | "regenerate-baseline";

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;

const BASELINE_REL = "tools/lint/doc-comment-history-audit.baseline";

const SCAN_ROOTS: readonly string[] = ["src", "tests", "bench", "tools"];

const SCAN_EXTS: readonly string[] = [".fs", ".cs", ".sh", ".ts"];

const SCAN_EXCLUDE_SEGMENTS: readonly string[] = [
  "bin",
  "obj",
  ".venv",
  "node_modules",
  // tools/lean4/.lake is the Lake build-output tree under tools/
  // — pulled in via SCAN_ROOTS, but contains a heavy mathlib
  // checkout that's not in scope. Excluded for both correctness
  // (mathlib references would dominate findings) and performance
  // (the directory walk gets very slow if .lake exists locally).
  ".lake",
];

const TOKEN_RE =
  /(Otto-\d+|Amara|Aaron|ferry|courier|graduation|Provenance:|Attribution:)/g;

// Comment-line patterns. `///` and `//` are F#/C# comment markers
// (and the F#-XML-doc shape is `///`). `#!` is a shell shebang (NOT
// a comment to scan). `#` is the shell-comment marker. Note: in
// F#/C# `#` typically denotes preprocessor / module directives
// rather than comments — but those still get scanned here, with
// the rationale that any `#`-prefixed line in a code file is a
// candidate for the same factory-process-token check (a bash
// shebang precondition + an F# `#nowarn` directive both legitimately
// describe what the code DOES, not its history).
const COMMENT_TRIPLE_SLASH_RE = /^[\t ]*\/\/\//;
const COMMENT_DOUBLE_SLASH_RE = /^[\t ]*\/\//;
const COMMENT_SHEBANG_RE = /^[\t ]*#!/;
const COMMENT_HASH_RE = /^[\t ]*#/;

const HELP_MEMORY_REF =
  "  memory/feedback_code_comments_explain_code_not_history_otto_220_2026_04_24.md";

function repoRoot(): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  if (result.status !== 0) return process.cwd();
  return result.stdout.trim();
}

function parseMode(argv: readonly string[]): Mode | null {
  const arg = argv[0];
  if (arg === undefined || arg === "check" || arg === "") return "check";
  if (arg === "--list") return "list";
  if (arg === "--fail-any") return "fail-any";
  if (arg === "--regenerate-baseline") return "regenerate-baseline";
  return null;
}

function isCommentLine(line: string): boolean {
  if (COMMENT_TRIPLE_SLASH_RE.test(line)) return true;
  if (COMMENT_DOUBLE_SLASH_RE.test(line)) return true;
  if (COMMENT_SHEBANG_RE.test(line)) return false;
  if (COMMENT_HASH_RE.test(line)) return true;
  return false;
}

function isWordChar(ch: string | undefined): boolean {
  if (ch === undefined) return false;
  return /\w/.test(ch);
}

function isBoundary(line: string, pos: number): boolean {
  if (pos < 0 || pos >= line.length) return true;
  return !isWordChar(line[pos]);
}

function extractTokens(line: string): readonly string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null = TOKEN_RE.exec(line);
  while (match !== null) {
    const tok = match[0];
    const start = match.index;
    const end = start + tok.length;
    const trailingNeedsBoundary = !tok.endsWith(":");
    const leadingOk = isBoundary(line, start - 1);
    const trailingOk = !trailingNeedsBoundary || isBoundary(line, end);
    if (leadingOk && trailingOk && !seen.has(tok)) {
      seen.add(tok);
      order.push(tok);
    }
    match = TOKEN_RE.exec(line);
  }
  return order.sort((a, b) => a.localeCompare(b));
}

function sortLines(lines: readonly string[]): readonly string[] {
  return [...lines].sort((a, b) => a.localeCompare(b));
}

function shouldExcludeDir(rel: string): boolean {
  for (const seg of SCAN_EXCLUDE_SEGMENTS) {
    if (rel === seg || rel.endsWith(`/${seg}`) || rel.includes(`/${seg}/`)) {
      return true;
    }
  }
  return false;
}

function hasMatchingExt(name: string): boolean {
  for (const ext of SCAN_EXTS) {
    if (name.endsWith(ext)) return true;
  }
  return false;
}

// Normalize Node-style relative() paths to forward slashes — on
// Windows `relative()` returns `\\`-separated paths, but the bash
// original emits `/` paths and the baseline file uses `/` paths.
// Posix-relative-path everywhere, including baseline-diff comparisons.
function toPosixRel(p: string): string {
  return p.replace(/\\/g, "/");
}

function readDirEntries(
  dir: string,
): readonly import("node:fs").Dirent[] {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function processEntry(
  e: import("node:fs").Dirent,
  dir: string,
  root: string,
  stack: string[],
  out: string[],
): void {
  const full = join(dir, e.name);
  const rel = toPosixRel(relative(root, full));
  if (e.isDirectory()) {
    if (!shouldExcludeDir(rel)) stack.push(full);
  } else if (e.isFile() && hasMatchingExt(e.name)) {
    out.push(rel);
  }
}

function walkRoot(root: string, top: string, out: string[]): void {
  const stack: string[] = [join(root, top)];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (dir === undefined) continue;
    for (const e of readDirEntries(dir)) {
      processEntry(e, dir, root, stack, out);
    }
  }
}

function listScanFiles(root: string): readonly string[] {
  const out: string[] = [];
  for (const top of SCAN_ROOTS) walkRoot(root, top, out);
  return out;
}

function collectViolationsForFile(
  rel: string,
  absPath: string,
): readonly string[] {
  let content: string;
  try {
    content = readFileSync(absPath, "utf8");
  } catch {
    return [];
  }
  const lines = content.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!isCommentLine(line)) continue;
    const tokens = extractTokens(line);
    if (tokens.length === 0) continue;
    out.push(`${rel}:${String(i + 1)}:${tokens.join(",")}`);
  }
  return out;
}

function collectAllViolations(root: string): readonly string[] {
  const files = listScanFiles(root);
  const out: string[] = [];
  for (const rel of files) {
    out.push(...collectViolationsForFile(rel, join(root, rel)));
  }
  return sortLines(out);
}

function loadBaseline(path: string): readonly string[] | null {
  try {
    const content = readFileSync(path, "utf8");
    return sortLines(content.split("\n").filter((s) => s.length > 0));
  } catch {
    return null;
  }
}

function diffNew(
  current: readonly string[],
  baseline: readonly string[],
): readonly string[] {
  const baseSet = new Set(baseline);
  return current.filter((row) => !baseSet.has(row));
}

function emitListMode(violations: readonly string[]): ExitCode {
  for (const row of violations) process.stdout.write(`${row}\n`);
  return 0;
}

function emitFailAny(violations: readonly string[]): ExitCode {
  if (violations.length === 0) {
    process.stdout.write(
      "doc-comment-history-audit: no violations (strict mode clean)\n",
    );
    return 0;
  }
  process.stderr.write(
    "doc-comment-history-audit: violations found (strict mode):\n",
  );
  for (const row of violations) process.stderr.write(`${row}\n`);
  process.stderr.write(
    `doc-comment-history-audit: ${String(violations.length)} violation(s); see\n`,
  );
  process.stderr.write(`${HELP_MEMORY_REF}\n`);
  return 1;
}

function emitRegenerate(
  violations: readonly string[],
  baselinePath: string,
): ExitCode {
  const content =
    violations.length === 0 ? "" : `${violations.join("\n")}\n`;
  writeFileSync(baselinePath, content);
  process.stderr.write(
    `doc-comment-history-audit: baseline regenerated with ${String(violations.length)} entries\n`,
  );
  process.stderr.write(`  -> ${baselinePath}\n`);
  return 0;
}

function emitCheck(
  violations: readonly string[],
  baselinePath: string,
  scriptName: string,
): ExitCode {
  const baseline = loadBaseline(baselinePath);
  if (baseline === null) {
    process.stderr.write(
      `doc-comment-history-audit: baseline missing at ${baselinePath}\n`,
    );
    process.stderr.write(`  regenerate with: ${scriptName} --regenerate-baseline\n`);
    return 2;
  }
  const newViolations = diffNew(violations, baseline);
  if (newViolations.length === 0) {
    process.stdout.write(
      `doc-comment-history-audit: no new violations (${String(baseline.length)} entries in baseline)\n`,
    );
    return 0;
  }
  process.stderr.write("doc-comment-history-audit: new violations not in baseline:\n");
  for (const row of newViolations) process.stderr.write(`${row}\n`);
  process.stderr.write(
    `doc-comment-history-audit: ${String(newViolations.length)} new violation(s); see\n`,
  );
  process.stderr.write(`${HELP_MEMORY_REF}\n`);
  process.stderr.write(
    `  to legitimize a moved line, run: ${scriptName} --regenerate-baseline\n`,
  );
  return 1;
}

export function main(argv: readonly string[]): ExitCode {
  const root = repoRoot();
  process.chdir(root);
  const baselinePath = BASELINE_REL;
  const scriptName = "tools/lint/doc-comment-history-audit.ts";

  const mode = parseMode(argv);
  if (mode === null) {
    const arg0 = argv[0] ?? "";
    process.stderr.write(
      `doc-comment-history-audit: unknown mode '${arg0}'\n`,
    );
    process.stderr.write(
      `usage: ${scriptName} [--list|--fail-any|--regenerate-baseline]\n`,
    );
    return 2;
  }

  if (mode === "regenerate-baseline") {
    return emitRegenerate(collectAllViolations(root), baselinePath);
  }
  const violations = collectAllViolations(root);
  if (mode === "list") return emitListMode(violations);
  if (mode === "fail-any") return emitFailAny(violations);
  return emitCheck(violations, baselinePath, scriptName);
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
