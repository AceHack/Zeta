#!/usr/bin/env bun
// no-directives-otto-prose.ts — advisory lint that flags Otto-authored
// prose using "directive" framing for maintainer input in CHANGED FILES.
//
// TypeScript+Bun port of no-directives-otto-prose.sh, slice 8 of the
// TS+Bun migration. See docs/best-practices/repo-scripting.md.
//
// Diff-based scope (does NOT retrofit historical content):
//   pr (default)         — diff between BASE_REF and HEAD
//   worktree             — unstaged + staged + committed + untracked
//
// Otto-authored prose surfaces (path filter applied to changed files):
//   memory/*.md (top-level only, NOT memory/persona/)
//   docs/hygiene-history/ticks/**/*.md
//   docs/research/*.md
//   docs/active-trajectory.md
//   .github/copilot-instructions.md
//
// Pattern (per Amara's narrowed regex):
//   "Aaron's directive" / "maintainer directive" / "QoL directive" /
//   "human directive" / "directive from Aaron" / etc.
//
// Whitelist (NOT flagged):
//   - lines starting with `> ` (markdown blockquote)
//   - the rule-documentation files themselves
//
// Usage:
//   bun tools/lint/no-directives-otto-prose.ts             # PR-diff advisory
//   bun tools/lint/no-directives-otto-prose.ts --strict    # PR-diff strict
//   SCOPE=worktree bun tools/lint/no-directives-otto-prose.ts
//
// Env:
//   BASE_REF — base ref to diff against (default: origin/main)
//   SCOPE    — "pr" (default) or "worktree"
//
// Exit codes:
//   0  no hits OR advisory mode
//   1  --strict + hits found

import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

type ExitCode = 0 | 1;
type Mode = "advisory" | "strict";
type Scope = "pr" | "worktree";

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;

const PROSE_PATH_RE =
  /^(?:memory\/[^/]+\.md|docs\/hygiene-history\/ticks\/.*\.md|docs\/research\/[^/]+\.md|docs\/active-trajectory\.md|\.github\/copilot-instructions\.md)$/;

const RULE_DOC_RE =
  /(feedback_input_is_not_directive_|feedback_otto_357_no_directives_|feedback_free_will_is_paramount_external_directives_|no-directives-otto-prose)/;

// Pattern split into 4 sub-regexes (each under sonarjs/regex-complexity).
// Each pattern uses explicit non-alpha boundaries `(^|\W)` and
// `(\W|$)` to mirror the bash POSIX-portable boundary form.
const DIRECTIVE_PATTERNS: readonly RegExp[] = [
  /(^|\W)(?:maintainer|QoL|human)[^|]*directive(?:\W|$)/,
  /(^|\W)directive[^|]*(?:maintainer|QoL|human)(?:\W|$)/,
  /(^|\W)[A-Z][a-z]+'?s[\t ]+directive(?:\W|$)/,
  /(^|\W)directive[\t ]+from[\t ]+[A-Z][a-z]+(?:\W|$)/,
];

const BLOCKQUOTE_RE = /^[\t ]*>/;

interface AddedLine {
  readonly file: string;
  readonly content: string;
}

function gitOutput(args: readonly string[]): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", args, {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  // git diff exits non-zero in some legitimate states (e.g., "couldn't
  // resolve ref"); we still want the stdout when present, but propagate
  // errors that produced no output.
  if (result.status !== 0 && result.stdout.length === 0) return "";
  return result.stdout;
}

function repoRoot(): string {
  const out = gitOutput(["rev-parse", "--show-toplevel"]);
  return out.trim() || process.cwd();
}

interface ParsedArgs {
  readonly mode: Mode;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  for (const arg of argv) {
    if (arg === "--strict") return { mode: "strict" };
  }
  return { mode: "advisory" };
}

function getScope(): Scope {
  const env = process.env.SCOPE;
  return env === "worktree" ? "worktree" : "pr";
}

function getBaseRef(): string {
  return process.env.BASE_REF ?? "origin/main";
}

function splitLines(s: string): readonly string[] {
  if (s === "") return [];
  return s.split("\n").filter((l) => l.length > 0);
}

function changedFilesPr(baseRef: string): readonly string[] {
  return splitLines(
    gitOutput(["diff", "--name-only", "--diff-filter=AMR", `${baseRef}...HEAD`]),
  );
}

function changedFilesWorktree(baseRef: string): readonly string[] {
  const sets = [
    splitLines(gitOutput(["diff", "--name-only", "--diff-filter=AMR"])),
    splitLines(
      gitOutput(["diff", "--cached", "--name-only", "--diff-filter=AMR"]),
    ),
    splitLines(
      gitOutput([
        "diff",
        "--name-only",
        "--diff-filter=AMR",
        `${baseRef}...HEAD`,
      ]),
    ),
    splitLines(gitOutput(["ls-files", "--others", "--exclude-standard"])),
  ];
  const merged = new Set<string>();
  for (const s of sets) for (const v of s) merged.add(v);
  return [...merged].sort((a, b) => a.localeCompare(b));
}

function getChangedFiles(scope: Scope, baseRef: string): readonly string[] {
  return scope === "worktree"
    ? changedFilesWorktree(baseRef)
    : changedFilesPr(baseRef);
}

function isProseFile(path: string): boolean {
  return PROSE_PATH_RE.test(path);
}

function isRuleDoc(path: string): boolean {
  return RULE_DOC_RE.test(path);
}

function isUntracked(file: string): boolean {
  const args = ["ls-files", "--error-unmatch", "--", file];
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", args, {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  return result.status !== 0;
}

function readFileAsAddedLines(file: string): readonly AddedLine[] {
  let content: string;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    return [];
  }
  return content
    .split("\n")
    .filter((l) => l.length > 0)
    .map((content) => ({ file, content }));
}

function diffOutput(
  scope: Scope,
  baseRef: string,
  file: string,
): readonly string[] {
  if (scope === "worktree") {
    return [
      gitOutput(["diff", "-U0", "--", file]),
      gitOutput(["diff", "--cached", "-U0", "--", file]),
      gitOutput(["diff", "-U0", `${baseRef}...HEAD`, "--", file]),
    ];
  }
  return [gitOutput(["diff", "-U0", `${baseRef}...HEAD`, "--", file])];
}

function isAddedContentLine(line: string): boolean {
  if (line.startsWith("\\ No newline")) return false;
  if (line.startsWith("@@")) return false;
  if (line.startsWith("---")) return false;
  if (line.startsWith("+++")) return false;
  if (line.startsWith("-")) return false;
  return line.startsWith("+");
}

function extractAddedLinesFromDiff(
  file: string,
  diffText: string,
): readonly AddedLine[] {
  const out: AddedLine[] = [];
  for (const line of diffText.split("\n")) {
    if (!isAddedContentLine(line)) continue;
    out.push({ file, content: line.slice(1) });
  }
  return out;
}

function extractAddedLines(
  scope: Scope,
  baseRef: string,
  file: string,
): readonly AddedLine[] {
  if (!existsSync(file)) return [];
  if (scope === "worktree" && isUntracked(file)) {
    return readFileAsAddedLines(file);
  }
  const out: AddedLine[] = [];
  for (const diff of diffOutput(scope, baseRef, file)) {
    out.push(...extractAddedLinesFromDiff(file, diff));
  }
  return out;
}

function matchesDirective(content: string): boolean {
  if (BLOCKQUOTE_RE.test(content)) return false;
  return DIRECTIVE_PATTERNS.some((re) => re.test(content));
}

function emitFooter(): void {
  process.stderr.write("\n");
  process.stderr.write(
    "Prose framing maintainer input as 'directive' (Aaron's directive /\n",
  );
  process.stderr.write(
    "maintainer directive / QoL directive / human directive) collapses\n",
  );
  process.stderr.write(
    "self-provenance into bot-execution. Use 'input' / 'framing' /\n",
  );
  process.stderr.write("'correction' / 'pass' instead.\n");
  process.stderr.write(
    "See memory/feedback_otto_357_no_directives_aaron_makes_autonomy_first_class_accountability_mine_2026_04_27.md\n",
  );
}

export function main(argv: readonly string[]): ExitCode {
  const root = repoRoot();
  process.chdir(root);

  const { mode } = parseArgs(argv);
  const scope = getScope();
  const baseRef = getBaseRef();

  const changed = getChangedFiles(scope, baseRef);
  if (changed.length === 0) {
    process.stdout.write(
      `no-directives-otto-prose: no changed files vs ${baseRef}; skipping\n`,
    );
    return 0;
  }

  const proseFiles = changed.filter(isProseFile);
  if (proseFiles.length === 0) {
    process.stdout.write(
      "no-directives-otto-prose: no Otto-prose surfaces changed; skipping\n",
    );
    return 0;
  }

  const filtered = proseFiles.filter((f) => !isRuleDoc(f));
  if (filtered.length === 0) {
    process.stdout.write(
      "no-directives-otto-prose: only rule-docs touched; skipping\n",
    );
    return 0;
  }

  const hits: AddedLine[] = [];
  for (const file of filtered) {
    const lines = extractAddedLines(scope, baseRef, file);
    for (const ln of lines) {
      if (matchesDirective(ln.content)) hits.push(ln);
    }
  }

  if (hits.length > 0) {
    process.stderr.write(
      `no-directives-otto-prose: found ${String(hits.length)} candidate hit(s) in added Otto-prose lines:\n`,
    );
    for (const h of hits) {
      process.stderr.write(`${h.file}: ${h.content}\n`);
    }
    emitFooter();
    if (mode === "strict") return 1;
    process.stderr.write(
      "(advisory mode; not failing build — pass --strict to fail)\n",
    );
    return 0;
  }

  process.stdout.write(
    "no-directives-otto-prose: clean (0 candidate hits in added Otto-prose lines)\n",
  );
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
