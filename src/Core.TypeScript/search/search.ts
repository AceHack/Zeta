#!/usr/bin/env bun
// src/Core.TypeScript/search/search.ts — the repo's own content search, with the
// constraints carried by the TOOL instead of by prose an agent has to remember.
//
//   bun src/Core.TypeScript/search/search.ts <pattern> [paths...] [flags]
//
// THE FAILURE THIS EXISTS FOR (2026-08-22, measured):
// `CLAUDE.md` warns in every agent's startup context that an unconstrained
// recursive grep here is a multi-hour runaway. An agent that had that text
// resident ran `grep -rn ... .` from the repo root anyway; two background jobs
// ran over an hour. Aaron's read: "this is one of the main reasons we want to
// dogfood our own clis and not ever rely on bash or random clis from others,
// they don't have our constraints built in to avoid things like this."
//
// WHAT MAKES THIS DIFFERENT FROM THE TOOL THAT WAS ALREADY HERE:
// `search/grep.ts` (2026-05-31) already baked in the same exclusion list, for the
// same stated reason — and it did not prevent today's incident. Two reasons, both
// worth naming because they are the design:
//
//   (a) IT WAS UNADVERTISED AND UNUSED. Nothing in the repo imports it except its
//       own test. `CLAUDE.md` names the constraint but never names the tool. A
//       tool nobody is pointed at is not a mechanism; it is a second document.
//
//   (b) IT IS ITSELF A RUNAWAY. Measured on this host: `bun grep.ts <needle>`
//       over the whole tree did not finish in 300s and printed NOTHING while it
//       ran — 0.66s user, 0% CPU, blocked in synchronous per-file reads. It has
//       no time bound, no file-count bound, and no output until completion, so a
//       user cannot distinguish "still working" from "no matches". An agent that
//       tried the in-repo tool first and hit that would reach for bash next, which
//       is precisely what happened. A guard that makes the safe path slower than
//       the unsafe one has selected for the unsafe one.
//
// SO THE GUARD HERE IS A SCOPE BUDGET, NOT A DIRECTORY BLACKLIST:
// The dominant cost on this machine is per-file-OPEN, not per-byte — Microsoft
// Defender's on-access scanner sat at 464% CPU with load average 36.6, and
// `rg --files` (metadata, no opens) walked 40,984 files in 0.33s while `rg -c`
// (opens + reads them) had not finished at 180s. So this tool:
//
//   1. WALKS FIRST (cheap, metadata only) to count exactly what it would open;
//   2. REFUSES if that count exceeds the budget, naming the count, the directories
//      responsible, and the flag that would allow it deliberately;
//   3. only then opens files.
//
// Step 2 is the whole point, and it is why the budget is checked BEFORE any read:
// the decision costs ~0.3s and the thing it is deciding about costs minutes.
//
// FAIL CLOSED, NEVER SILENTLY NARROW. A search that quietly skipped a tree and
// returned "no matches" is worse than one that ran away: the runaway is loud and
// you kill it, whereas the confident empty result is believed. Every narrowing
// this tool performs is reported on stderr, and a target that lies inside an
// excluded tree is REFUSED (naming --allow) rather than silently yielding zero.

import { readdirSync, openSync, fstatSync, readFileSync, closeSync, statSync, type Dirent } from "node:fs";
import { resolve, join } from "node:path";
import {
  EXCLUDE_BASENAMES,
  matchExcludedTree,
  relPosix,
  type HeavyTree,
} from "./exclusions.ts";

/** Default ceiling on files OPENED. Sized from the measurement above: ~40k files
 *  in this tree did not finish in 180s, so a full-tree content search is refused
 *  by default and must be asked for on purpose. */
export const DEFAULT_MAX_FILES = 4000;

/** Files larger than this are skipped (data/binary, not source). */
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

export interface SearchMatch {
  readonly file: string;
  readonly line: number;
  readonly text: string;
}

/** A tree the walk pruned, kept so narrowing is REPORTED and never silent. */
export interface SkippedTree {
  readonly path: string;
  readonly rule: string;
}

export interface Candidates {
  readonly files: readonly string[];
  readonly skipped: readonly SkippedTree[];
  /** file count per top-level dir — what a refusal message needs to be useful. */
  readonly byDir: ReadonlyMap<string, number>;
}

export interface SearchOptions {
  readonly root: string;
  readonly pattern: string;
  readonly targets: readonly string[];
  readonly ignoreCase: boolean;
  readonly exts?: ReadonlySet<string> | undefined;
  readonly maxFiles: number;
  /** Excluded trees the caller opted INTO, by repo-relative path. */
  readonly allow: readonly string[];
}

/** Refusal — a typed value, not a thrown string, so callers can test it. */
export interface Refusal {
  readonly kind: "excluded-target" | "over-budget";
  readonly message: string;
}

export type ScopeResult = { ok: true; candidates: Candidates } | { ok: false; refusal: Refusal };

function isAllowed(relPath: string, allow: readonly string[]): boolean {
  return allow.some((a) => relPath === a || relPath.startsWith(a + "/"));
}

/**
 * Walk the targets collecting candidate files WITHOUT opening any of them.
 * Metadata only — this is the cheap step that makes the budget check affordable.
 */
export function collectCandidates(opts: SearchOptions): Candidates {
  const files: string[] = [];
  const skipped: SkippedTree[] = [];
  const byDir = new Map<string, number>();

  const walk = (absDir: string): void => {
    let entries: Dirent[];
    try {
      entries = readdirSync(absDir, { withFileTypes: true });
    } catch {
      return; // unreadable dir — skip rather than throw
    }
    for (const ent of entries) {
      const abs = join(absDir, ent.name);
      const rel = relPosix(opts.root, abs);
      if (ent.isDirectory()) {
        if (isAllowed(rel, opts.allow)) {
          walk(abs);
          continue;
        }
        if (EXCLUDE_BASENAMES.has(ent.name)) {
          skipped.push({ path: rel, rule: `basename "${ent.name}" is build output or vendored` });
          continue;
        }
        const heavy = matchExcludedTree(rel);
        if (heavy) {
          skipped.push({ path: rel, rule: `heavy tree (${heavy.measured})` });
          continue;
        }
        walk(abs);
        continue;
      }
      if (!ent.isFile()) continue;
      if (opts.exts) {
        const dot = ent.name.lastIndexOf(".");
        const ext = dot >= 0 ? ent.name.slice(dot + 1) : "";
        if (!opts.exts.has(ext)) continue;
      }
      files.push(rel);
      const top = rel.split("/")[0] ?? "";
      byDir.set(top, (byDir.get(top) ?? 0) + 1);
    }
  };

  for (const t of opts.targets) {
    const abs = resolve(opts.root, t);
    let st;
    try {
      st = statSync(abs);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(abs);
    else if (st.isFile()) {
      const rel = relPosix(opts.root, abs);
      files.push(rel);
      byDir.set(rel.split("/")[0] ?? "", (byDir.get(rel.split("/")[0] ?? "") ?? 0) + 1);
    }
  }

  return { files, skipped, byDir };
}

/**
 * Decide whether the search may proceed. This is the guard: it runs BEFORE any
 * file is opened, and it either returns the candidate set or a refusal that names
 * the excluded path / the count and the flag that would permit it deliberately.
 */
export function checkScope(opts: SearchOptions): ScopeResult {
  // (1) A target that lies inside an excluded tree is REFUSED, not silently
  //     narrowed to nothing. `CLAUDE.md` explicitly ENCOURAGES explicit-target
  //     search of prior-art, so the tree must be reachable — just on purpose.
  for (const t of opts.targets) {
    const rel = relPosix(opts.root, resolve(opts.root, t));
    if (isAllowed(rel, opts.allow)) continue;
    const heavy = matchExcludedTree(rel);
    if (heavy) {
      return {
        ok: false,
        refusal: {
          kind: "excluded-target",
          message: refuseExcludedTarget(rel, heavy),
        },
      };
    }
  }

  const candidates = collectCandidates(opts);

  // (2) Budget on files OPENED. Checked after the cheap walk, before any read.
  if (candidates.files.length > opts.maxFiles) {
    return {
      ok: false,
      refusal: { kind: "over-budget", message: refuseOverBudget(candidates, opts) },
    };
  }

  return { ok: true, candidates };
}

function refuseExcludedTarget(rel: string, heavy: HeavyTree): string {
  return [
    `REFUSED: "${rel}" is inside an excluded tree.`,
    ``,
    `  tree:     ${heavy.path}`,
    `  measured: ${heavy.measured}`,
    `  why:      ${heavy.why}`,
    ``,
    `This is a refusal and not a silent skip on purpose: quietly searching zero`,
    `files would have returned a confident "no matches" you had no way to doubt.`,
    ``,
    `To search it deliberately (this is a supported path — CLAUDE.md encourages`,
    `explicit-target search of prior art, and docs/PRIOR-ART-LIST.md is the index`,
    `to consult first):`,
    ``,
    `  bun src/Core.TypeScript/search/search.ts <pattern> ${rel} --allow ${heavy.path}`,
  ].join("\n");
}

function refuseOverBudget(candidates: Candidates, opts: SearchOptions): string {
  const top = [...candidates.byDir.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, 8)
    .map(([d, n]) => `    ${String(n).padStart(7)}  ${d || "."}`);
  return [
    `REFUSED: this search would open ${candidates.files.length} files; the budget is ${opts.maxFiles}.`,
    ``,
    `  Where they are:`,
    ...top,
    ``,
    `  Not a performance nicety. On this host the cost is per-file-OPEN: a walk of`,
    `  ~41k files costs ~0.3s, and READING them did not finish in 180s (on-access`,
    `  AV scanning, load average 36+). An unbounded run here is the multi-hour`,
    `  runaway CLAUDE.md warns about.`,
    ``,
    `  Narrow it (preferred — name the directory you actually mean):`,
    `    bun src/Core.TypeScript/search/search.ts <pattern> src/Core.TypeScript`,
    `    bun src/Core.TypeScript/search/search.ts <pattern> --ext ts,md`,
    ``,
    `  Or raise the budget deliberately, knowing what it costs:`,
    `    bun src/Core.TypeScript/search/search.ts <pattern> --max-files ${candidates.files.length}`,
  ].join("\n");
}

/** A NUL byte in the first 1KB → binary, skip. */
function looksBinary(buf: string): boolean {
  const n = Math.min(buf.length, 1024);
  for (let i = 0; i < n; i++) if (buf.charCodeAt(i) === 0) return true;
  return false;
}

/** Read via a single fd — fstat the OPEN handle, so there is no TOCTOU window
 *  between the size check and the read. */
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

/** Search the approved candidate set. Only called after `checkScope` says ok. */
export function searchFiles(root: string, candidates: Candidates, opts: SearchOptions): SearchMatch[] {
  const out: SearchMatch[] = [];
  const needle = opts.ignoreCase ? opts.pattern.toLowerCase() : opts.pattern;

  for (const rel of candidates.files) {
    const content = readTextCapped(join(root, rel));
    if (content === null) continue;
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const hit = (opts.ignoreCase ? line.toLowerCase() : line).includes(needle);
      if (hit) out.push({ file: rel, line: i + 1, text: line });
    }
  }
  return out;
}

/**
 * Regex search is REFUSED here, with a pointer rather than a shrug.
 *
 * Building a RegExp from a command-line argument is `js/regex-injection` (CodeQL
 * flagged exactly that on the first push of this file, at high severity), and the
 * concrete risk is catastrophic backtracking: JavaScript's engine has no timeout,
 * so one adversarial-or-careless pattern hangs the process with no budget able to
 * stop it. That is the SAME failure this tool exists to prevent — an unbounded
 * scope wearing a different costume — and shipping it inside the guard would have
 * been the guard undoing itself. `grep.ts` had already reasoned its way to literal
 * matching for this reason in 2026-05-31; this file regressed it and is corrected.
 *
 * The honest division of labour: literal search here, where the scope budget is;
 * regex in ripgrep, which has a linear-time engine that CANNOT backtrack (Cox
 * 2007, "Regular Expression Matching Can Be Simple And Fast") — and which the
 * `.ignore` shipped in this PR now makes safe by default on this tree.
 */
export const REGEX_REFUSAL = [
  "regex search is not supported by this tool, on purpose.",
  "",
  "  A RegExp built from CLI input can backtrack catastrophically, and JS has no",
  "  regex timeout — an unbounded search, which is what this tool exists to refuse.",
  "",
  "  Use ripgrep, whose engine is linear-time and cannot backtrack. The .ignore",
  "  file in this repo already keeps it off the heavy trees:",
  "",
  "    rg <your-regex>",
  "",
  "  Or search literally here:  bun src/Core.TypeScript/search/search.ts <text>",
].join("\n");

export interface ParsedArgs extends SearchOptions {
  readonly filesOnly: boolean;
  readonly quiet: boolean;
}

export function parseArgs(argv: string[], cwd: string): ParsedArgs | { error: string } {
  let root = cwd;
  let maxFiles = DEFAULT_MAX_FILES;
  let ignoreCase = false;
  let filesOnly = false;
  let quiet = false;
  let exts: Set<string> | undefined;
  const allow: string[] = [];
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--root") {
      const v = argv[++i];
      if (!v) return { error: "--root requires a directory" };
      root = resolve(v);
    } else if (a === "--max-files") {
      const v = argv[++i];
      const n = Number(v);
      if (!v || !Number.isInteger(n) || n <= 0) return { error: "--max-files requires a positive integer" };
      maxFiles = n;
    } else if (a === "--allow") {
      const v = argv[++i];
      if (!v) return { error: "--allow requires a repo-relative path" };
      allow.push(v.replace(/\/+$/, ""));
    } else if (a === "--ext") {
      const v = argv[++i];
      if (!v) return { error: "--ext requires a comma-separated list" };
      exts = new Set(v.split(",").map((s) => s.trim().replace(/^\./, "")).filter(Boolean));
    } else if (a === "-i") ignoreCase = true;
    else if (a === "-e" || a === "--regex") return { error: REGEX_REFUSAL };
    else if (a === "--files") filesOnly = true;
    else if (a === "--quiet") quiet = true;
    else if (a.startsWith("-")) return { error: `unknown flag: ${a}` };
    else positionals.push(a);
  }

  const pattern = positionals[0] ?? "";
  if (!pattern) {
    return {
      error:
        "usage: bun src/Core.TypeScript/search/search.ts <pattern> [paths...] " +
        "[--ext ts,md] [-i] [--files] [--max-files N] [--allow <tree>] [--root <dir>]",
    };
  }
  const targets = positionals.slice(1);

  return {
    root,
    pattern,
    targets: targets.length > 0 ? targets : ["."],
    ignoreCase,
    exts,
    maxFiles,
    allow,
    filesOnly,
    quiet,
  };
}

export function main(argv: string[], cwd: string = process.cwd()): number {
  const parsed = parseArgs(argv, cwd);
  if ("error" in parsed) {
    console.error(parsed.error);
    return 2;
  }
  const scope = checkScope(parsed);
  if (!scope.ok) {
    console.error(scope.refusal.message);
    return 3; // distinct from "no matches" (1) and "error" (2)
  }
  // Narrowing is REPORTED, never silent — an agent must be able to tell that a
  // tree was skipped, otherwise an empty result reads as a complete one.
  if (!parsed.quiet && scope.candidates.skipped.length > 0) {
    const uniq = new Map<string, string>();
    for (const s of scope.candidates.skipped) uniq.set(s.path, s.rule);
    console.error(
      `[search] skipped ${uniq.size} excluded tree(s); searching ${scope.candidates.files.length} files. ` +
        `Use --allow <tree> to include one deliberately.`,
    );
  }
  const matches = searchFiles(parsed.root, scope.candidates, parsed);
  if (parsed.filesOnly) {
    const seen = new Set<string>();
    for (const m of matches) if (!seen.has(m.file)) { seen.add(m.file); console.log(m.file); }
  } else {
    for (const m of matches) console.log(`${m.file}:${m.line}:${m.text}`);
  }
  return matches.length > 0 ? 0 : 1;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
