#!/usr/bin/env bun
// src/Core.TypeScript/search/grep.ts — safe content-search wrapper with noise-dir excludes
// baked in. Distinct from concept-index.ts (a curated semantic index); this is
// the raw ad-hoc content grep an agent reaches for, made correct-by-construction.
//
// WHY (operator 2026-05-31): agents doing ad-hoc content search via raw
// recursive file-walks — PowerShell `Get-ChildItem -Recurse | Select-String`,
// bash `find | xargs grep` — do NOT honor .gitignore, so they walk into
// `references/prior-art/` (gigabytes of mirrored OTHER-repo code) + node_modules
// + build outputs: slow + noisy. Per
// `.claude/rules/references-prior-art-not-our-code-search-excludes.md` + the rule
// `architecture-is-safety-mechanism-not-discipline-structural-protections-vs-runtime-virtue-historical-innovation-parallel.md`
// (full filename, no ellipsis — keep it greppable) the fix is
// STRUCTURAL not behavioral — bake the excludes into a `.ts` so "call the tool"
// can't hit the noise even with a sloppy invocation. Operator's framing: "the
// .ts files have the excludes built in or they should at least."
//
// Cross-repo aware: `--repo ../SQLSharp` searches a sibling repo, still skipping
// THAT repo's references/prior-art (every repo mirrors the same convention).
//
//   bun src/Core.TypeScript/search/grep.ts <substring> [--repo <dir>] [--ext ts,md] [-i] [--files]
//
// Options:
//   --repo <dir>   root to search (default: cwd)
//   --ext a,b      only files with these extensions (no dot); default: all text
//   -i             case-insensitive
//   --files        print matching file paths only (not lines)
//
// MATCH SEMANTICS: literal substring (fixed-string, like `grep -F`), NOT regex —
// deliberately. This is the "safe quick search excluding noise" tool; literal is
// the common case, faster, and avoids constructing a regex from CLI input (no
// ReDoS / regex-injection surface). When you genuinely need a regex, the harness
// Grep tool (ripgrep) serves that AND honors .gitignore (so it also skips
// references/prior-art). This tool stays literal + zero-dep so the excludes hold
// EVERYWHERE — including this Windows laptop, which has no `rg` on PATH (2026-05-31).

import { resolve, relative, join, sep } from "node:path";
import { EXCLUDE_BASENAMES as SHARED_BASENAMES, matchExcludedTree } from "./exclusions.ts";
import { readdirSync, fstatSync, statSync, readFileSync, openSync, closeSync, type Dirent } from "node:fs";

// The exclusion set lives in ONE place (`exclusions.ts`) and is re-exported here
// so this file's existing consumers keep working unchanged. It used to be a
// second hand-maintained copy, which is how `references/prior-art` stayed at the
// centre of the list long after it went empty (8.0K, measured 2026-08-22) while
// the trees that actually cost hours — `src/Core.Lean4/.lake` at 6.9G, the cargo
// `target` dirs — were only caught incidentally by basename.
//
// NOTE, and read this before reaching for this file: `grep.ts` prunes noise but
// has NO scope budget, so on a large tree it is itself the runaway it was written
// to prevent (measured 2026-08-22: no output and no completion in 300s over this
// repo, 0% CPU, blocked in synchronous reads). For ad-hoc search prefer
// `search.ts`, which refuses an over-budget scope in ~2s instead of hanging.
export { EXCLUDE_BASENAMES, EXCLUDE_RELPATHS } from "./exclusions.ts";

/** Files larger than this are skipped (likely data/binary, not source). */
const MAX_FILE_BYTES = 2 * 1024 * 1024;

export interface GrepMatch {
  file: string; // repo-relative POSIX path
  line: number; // 1-based
  text: string;
}

export interface GrepOptions {
  root: string;
  needle: string; // literal substring to find
  ignoreCase?: boolean | undefined;
  // extensions without the dot; undefined = all text files. Explicit `| undefined`
  // so it composes under tsconfig `exactOptionalPropertyTypes: true`.
  exts?: Set<string> | undefined;
}

function relPosix(root: string, abs: string): string {
  return relative(root, abs).split(sep).join("/");
}

/** True if this directory should be pruned from the walk. */
export function isExcludedDir(root: string, absDir: string): boolean {
  const base = absDir.split(sep).pop() ?? "";
  if (SHARED_BASENAMES.has(base)) return true;
  return matchExcludedTree(relPosix(root, absDir)) !== null;
}

/** A NUL byte in the first 1KB → treat as binary, skip. (Char-code check so
 *  there's no NUL literal in this source file.) */
function looksBinary(buf: string): boolean {
  const n = Math.min(buf.length, 1024);
  for (let i = 0; i < n; i++) {
    if (buf.charCodeAt(i) === 0) return true;
  }
  return false;
}

/** Read a file via a single fd — fstat the OPEN handle (not a second path stat)
 *  so there's no time-of-check/time-of-use race between size-check and read.
 *  Returns null if too big, binary, or unreadable. */
function readTextCapped(abs: string): string | null {
  let fd: number;
  try {
    fd = openSync(abs, "r");
  } catch {
    return null;
  }
  try {
    if (fstatSync(fd).size > MAX_FILE_BYTES) return null;
    const content = readFileSync(fd, "utf8");
    return looksBinary(content) ? null : content;
  } catch {
    return null;
  } finally {
    closeSync(fd);
  }
}

/** Pure, testable core: walk `root`, skipping excluded dirs, return matches. */
export function grepTree(opts: GrepOptions): GrepMatch[] {
  const { root, needle, ignoreCase, exts } = opts;
  const cmpNeedle = ignoreCase ? needle.toLowerCase() : needle;
  const out: GrepMatch[] = [];

  const walk = (absDir: string): void => {
    let entries: Dirent[];
    try {
      entries = readdirSync(absDir, { withFileTypes: true });
    } catch {
      return; // unreadable dir — skip rather than throw
    }
    for (const ent of entries) {
      const abs = join(absDir, ent.name);
      if (ent.isDirectory()) {
        if (!isExcludedDir(root, abs)) walk(abs);
        continue;
      }
      if (!ent.isFile()) continue;
      if (exts) {
        const dot = ent.name.lastIndexOf(".");
        const ext = dot >= 0 ? ent.name.slice(dot + 1) : "";
        if (!exts.has(ext)) continue;
      }
      const content = readTextCapped(abs);
      if (content === null) continue;
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const hay = ignoreCase ? lines[i]!.toLowerCase() : lines[i]!;
        if (hay.includes(cmpNeedle)) {
          out.push({ file: relPosix(root, abs), line: i + 1, text: lines[i]! });
        }
      }
    }
  };

  walk(root);
  return out;
}

interface ParsedArgs {
  needle: string;
  repo: string;
  exts?: Set<string> | undefined;
  ignoreCase: boolean;
  filesOnly: boolean;
}

export function parseArgs(argv: string[]): ParsedArgs | { error: string } {
  let repo = process.cwd();
  let exts: Set<string> | undefined;
  let ignoreCase = false;
  let filesOnly = false;
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--repo") {
      const v = argv[++i];
      if (!v) return { error: "--repo requires a directory" };
      repo = resolve(v);
    } else if (a === "--ext") {
      const v = argv[++i];
      if (!v) return { error: "--ext requires a comma-separated list" };
      exts = new Set(v.split(",").map((s) => s.trim().replace(/^\./, "")).filter(Boolean));
    } else if (a === "-i") {
      ignoreCase = true;
    } else if (a === "--files") {
      filesOnly = true;
    } else if (a.startsWith("--")) {
      return { error: `unknown flag: ${a}` };
    } else {
      positionals.push(a);
    }
  }

  const needle = positionals.join(" ").trim();
  if (!needle) {
    return { error: "usage: bun src/Core.TypeScript/search/grep.ts <substring> [--repo <dir>] [--ext ts,md] [-i] [--files]" };
  }

  // Fail loud on a bad search root: a missing/non-directory --repo would otherwise
  // walk nothing, return 0 matches, and exit 0 — indistinguishable from a genuine
  // "no hits" (a silent false-negative). Validate so main() can exit non-zero.
  let repoStat;
  try {
    repoStat = statSync(repo);
  } catch {
    return { error: `--repo path does not exist: ${repo}` };
  }
  if (!repoStat.isDirectory()) {
    return { error: `--repo is not a directory: ${repo}` };
  }

  return { needle, repo, exts, ignoreCase, filesOnly };
}

export function main(argv: string[]): number {
  const parsed = parseArgs(argv);
  if ("error" in parsed) {
    console.error(parsed.error);
    return 1;
  }
  const matches = grepTree({
    root: parsed.repo,
    needle: parsed.needle,
    ignoreCase: parsed.ignoreCase,
    exts: parsed.exts,
  });
  if (parsed.filesOnly) {
    const seen = new Set<string>();
    for (const m of matches) {
      if (!seen.has(m.file)) {
        seen.add(m.file);
        console.log(m.file);
      }
    }
  } else {
    for (const m of matches) console.log(`${m.file}:${m.line}:${m.text}`);
  }
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
