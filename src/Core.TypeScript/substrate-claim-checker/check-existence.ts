#!/usr/bin/env bun
/**
 * substrate-claim-checker / check-existence.ts (v0.6.0)
 *
 * Existence-drift sub-class checker — catches claims that a file or
 * directory exists when it doesn't. Per the verify-then-claim memo,
 * one of 7 sub-classes 081KQNJ500008QG0R003SCWBDV v1+ should mechanize.
 *
 * v0.6 changes:
 * - Gitignore awareness: paths that exist on disk but are gitignored
 *   are flagged as "exists-on-disk-not-in-git" findings (substrate
 *   convention: references should point to git-tracked paths or stable
 *   URLs, not to local-mirror sync state). Caught via `git check-ignore`.
 *   Empirical seed: PR #1322 review found `references/prior-art/efcore/...`
 *   reference in a tick shard; references/prior-art/* is gitignored per
 *   the upstream-mirror sync convention.
 */

import { readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

interface Finding {
  file: string;
  line: number;
  pathClaim: string;
  reason: string;
  /** v0.6: severity hint for downstream filtering. */
  severity?: "drift" | "warning";
}

interface PathClaim {
  line: number;
  path: string;
  raw: string;
}

function statExists(p: string): {
  exists: boolean;
  isFile: boolean;
  isDirectory: boolean;
  errorCode?: string;
} {
  try {
    const s = statSync(p);
    return { exists: true, isFile: s.isFile(), isDirectory: s.isDirectory() };
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException;
    // ENOENT means definitively not present. Other errors (EACCES,
    // EPERM, ELOOP, ENAMETOOLONG, ...) mean we couldn't tell — surface
    // the error code so the caller can avoid emitting a false-positive
    // existence-drift finding for unreadable-but-extant paths.
    if (err.code === "ENOENT") {
      return { exists: false, isFile: false, isDirectory: false };
    }
    return {
      exists: false,
      isFile: false,
      isDirectory: false,
      errorCode: err.code ?? "EUNKNOWN",
    };
  }
}

/**
 * Check whether a path is gitignored, by invoking `git check-ignore`.
 * Returns true if the path matches a gitignore rule (would not be tracked
 * by git).
 *
 * Uses spawnSync (no shell) per the project's avoid-command-injection
 * discipline. The path argument is passed as a separate argv entry.
 *
 * Edge cases:
 * - If git is not on PATH (highly unusual), returns false (safe default —
 *   don't flag everything as gitignored)
 * - If path is outside the git working tree, returns false
 * - If git returns 0, the path IS gitignored; if 1, it's NOT; other exit
 *   codes treated as "unknown — assume not gitignored"
 */
function isGitIgnored(absPath: string, repoRoot: string): boolean {
  try {
    const result = spawnSync("git", ["check-ignore", "--quiet", absPath], {
      cwd: repoRoot,
      stdio: "ignore",
      timeout: 5000,
    });
    // Exit 0 = path IS gitignored; Exit 1 = NOT gitignored; other = unknown
    return result.status === 0;
  } catch {
    return false;
  }
}

function findRepoRoot(startPath: string): string {
  let cur = isAbsolute(startPath) ? startPath : resolve(startPath);
  if (statExists(cur).isFile) cur = dirname(cur);
  while (cur !== "/" && cur !== "") {
    const gitPath = join(cur, ".git");
    if (statExists(gitPath).exists) return cur;
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return process.cwd();
}

function looksLikePath(s: string): boolean {
  if (s.includes(" ")) return false;
  if (/<[^>]+>/.test(s)) return false;
  if (/\{[^}]+\}/.test(s)) return false;
  // Reject only when the WHOLE string is a placeholder token (so
  // legitimate filenames like docs/TODO.md or notes/tbd-changes.md
  // still get checked).
  if (/^(XXX+|YYY+|TODO|TBD)$/i.test(s)) return false;
  if (s.length < 3) return false;
  if (s.startsWith("http://") || s.startsWith("https://")) return false;
  if (s.startsWith("#")) return false;
  if (s.startsWith("mailto:")) return false;
  // Reject absolute paths in any platform notation. `path.isAbsolute()`
  // is platform-specific (returns false for `C:\foo` on POSIX), so we
  // add explicit cross-platform regex checks for Windows drive paths
  // and UNC paths.
  if (isAbsolute(s)) return false;
  if (/^[A-Za-z]:[\\/]/.test(s)) return false; // Windows drive (C:\, C:/)
  if (/^\\\\/.test(s)) return false; // Windows UNC (\\server\share)
  if (/^\$/.test(s)) return false;
  // Reject version-number-shaped strings (e.g. v0.69.4, 10.0.203,
  // 1.2.3-rc1) — these have dot-separated parts that look like file
  // extensions but are NOT paths. Require either at least one path
  // separator, OR a known doc/code/config extension. Drops the loose
  // `\.[a-z0-9]{1,5}$` extension match that produced false-positives
  // on PR #1298 review (e.g., `v0.69.4` was treated as a path).
  const knownExt =
    /\.(md|markdown|ts|tsx|js|jsx|fs|fsi|fsx|fsproj|csproj|sln|sh|bash|zsh|yaml|yml|json|toml|tla|alloy|lean|lean4|py|rs|go|java|kt|kts|c|h|cpp|cc|hpp|fish|gradle|conf|ini|cfg|env|html|css|scss|less|sql|graphql|proto)$/i;
  if (/^\.{0,2}\//.test(s)) return true;
  if (s.includes("/") && !/^\d+(\.\d+)+(-[\w.]+)?$/.test(s)) return true;
  if (knownExt.test(s)) return true;
  return false;
}

function isFutureStateContext(line: string, contextBefore: string, contextAfter: string): boolean {
  const window = `${contextBefore} ${line} ${contextAfter}`.toLowerCase();
  const futureMarkers = [
    "(proposed)", "(planned)", "(future)", "(would be)", "(not yet)",
    "(tbd)", "(deferred)", "(pending)",
    "would be", "will be", "to be authored", "to be built",
    "not yet exists", "not yet built", "not yet shipped", "not yet implemented",
    "doesn't yet exist", "does not yet exist", "doesn't exist yet",
    "future-state", "row deliverable",
    "i'm guessing", "guessing the path",
    "concretely something like", "something like",
    "do not yet exist", "does not exist yet",
    "will probably", "would probably",
    "lower confidence", "low confidence",
    "**later**:", "**soon**:",
    "optionally mechanize", "eventual mechanization",
    "mechanization path", "future mechanization",
    "could become", "would become", "may need",
    "if implemented", "when implemented",
    "**proposed**", "proposed, not yet",
    "not yet landed", "not landed yet",
  ];
  for (const marker of futureMarkers) {
    if (window.includes(marker)) return true;
  }
  return false;
}

function findPathClaims(lines: string[]): PathClaim[] {
  const claims: PathClaim[] = [];
  let inFence = false;
  let fenceChar = "";
  let fenceLen = 0;
  const backtickRe = /`([^`\n]+?)`/g;
  // Markdown link target regex. Supports balanced parens inside the
  // target (so `[text](docs/api(v2).md)` captures `docs/api(v2).md`).
  // The target is one or more groups of either non-paren chars or
  // a balanced (...) pair (one level of nesting; two-level nesting is
  // out of scope for v0.5).
  const linkRe = /\[([^\]\n]+?)\]\(((?:[^()\n]|\([^()\n]*\))+)\)/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const fenceMatch = line.match(/^(\s*)(`{3,}|~{3,})(.*)$/);
    if (fenceMatch) {
      const delim = fenceMatch[2] ?? "";
      const tail = fenceMatch[3] ?? "";
      if (!inFence) {
        inFence = true;
        fenceChar = delim[0] ?? "";
        fenceLen = delim.length;
      } else if (delim[0] === fenceChar && delim.length >= fenceLen && tail.trim() === "") {
        inFence = false;
        fenceChar = "";
        fenceLen = 0;
      }
      continue;
    }
    if (inFence) continue;

    backtickRe.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = backtickRe.exec(line)) !== null) {
      const candidate = m[1] ?? "";
      if (looksLikePath(candidate)) {
        claims.push({ line: i + 1, path: candidate, raw: m[0] });
      }
    }

    linkRe.lastIndex = 0;
    while ((m = linkRe.exec(line)) !== null) {
      let target = m[2] ?? "";
      // CommonMark allows angle-bracket-wrapped link destinations
      // (e.g. `[spec](<docs/foo bar.md>)`). Strip the brackets so
      // the target shape matches the rest of the pipeline.
      if (target.startsWith("<") && target.endsWith(">")) {
        target = target.slice(1, -1);
      }
      // Strip URL anchor (#...) and query string (?...) BEFORE
      // path-shape validation. Otherwise the validation can pass on
      // the dirty target but produce a different (cleaned) string
      // for path-resolution, leading to inconsistent state.
      const cleanTarget = target.split("#")[0]?.split("?")[0] ?? "";
      if (cleanTarget && looksLikePath(cleanTarget)) {
        claims.push({ line: i + 1, path: cleanTarget, raw: m[0] });
      }
    }
  }
  return claims;
}

interface CheckResult {
  findings: Finding[];
  ok: boolean;
}

function checkFile(filePath: string): CheckResult {
  let content: string;
  try {
    content = readFileSync(filePath, "utf8");
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      console.error(`error: input file not found: ${filePath}`);
    } else if (err.code === "EISDIR") {
      console.error(`error: not a regular file (directory): ${filePath}`);
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`error: read failed for ${filePath}: ${msg}`);
    }
    return { findings: [], ok: false };
  }

  const lines = content.split("\n");
  const repoRoot = findRepoRoot(filePath);
  const claims = findPathClaims(lines);
  const findings: Finding[] = [];

  // Skip glob patterns — they're not real paths
  const isGlob = (p: string) => /[*?]/.test(p) || /\[.+\]/.test(p);

  // Three candidate roots, tried in priority order:
  //   1. File's own directory (cross-references within the same dir)
  //   2. Parent directory (bare-filename references when file is in a subdir
  //      like memory/architectural-intent-guesses/)
  //   3. Repository root (repo-relative paths)
  // Each candidate root MUST be inside repoRoot (security: don't probe
  // /etc/, /tmp/, or other system paths if a malicious claim escapes).
  // Stops on first hit. Reports relative paths (relative to repoRoot)
  // in finding reasons so logs don't leak local/CI absolute paths.
  const fileDir = isAbsolute(filePath) ? dirname(filePath) : resolve(dirname(filePath));
  const fileParentDir = dirname(fileDir);
  const allCandidates = [fileDir, fileParentDir, repoRoot];

  // Cross-platform containment: a path P is inside repoRoot iff
  // path.relative(repoRoot, P) returns a string that doesn't start with
  // ".." or hit the absolute-root case. Works on POSIX (sep="/") and
  // Windows (sep="\") because relative() handles separators per-platform.
  const isInsideRepo = (p: string): boolean => {
    if (p === repoRoot) return true;
    const rel = relative(repoRoot, p);
    return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
  };

  // Filter to candidates inside repoRoot.
  const candidateRoots = allCandidates.filter(isInsideRepo);

  const toRelative = (absPath: string): string => {
    if (absPath === repoRoot) return ".";
    const rel = relative(repoRoot, absPath);
    return rel === "" ? "." : rel;
  };

  for (const claim of claims) {
    if (isGlob(claim.path)) continue; // skip glob patterns

    const lineText = lines[claim.line - 1] ?? "";
    const before = lines[claim.line - 2] ?? "";
    const after = lines[claim.line] ?? "";
    if (isFutureStateContext(lineText, before, after)) continue;

    let isResolvedClaim = false;
    let resolvedAbsPath: string | null = null;
    let unreadableButExtant = false; // EACCES/EPERM/etc. — can't tell
    const triedRelative: string[] = [];
    for (const root of candidateRoots) {
      const absPath = isAbsolute(claim.path) ? claim.path : join(root, claim.path);
      // Reject claims that resolve outside repo (security: don't traverse out)
      if (!isInsideRepo(absPath)) continue;
      triedRelative.push(toRelative(absPath));
      const stat = statExists(absPath);
      if (stat.exists) {
        isResolvedClaim = true;
        resolvedAbsPath = absPath;
        break;
      }
      if (stat.errorCode && stat.errorCode !== "ENOENT") {
        // Path may exist but is unreadable — don't emit false-positive
        unreadableButExtant = true;
      }
    }
    if (!isResolvedClaim && !unreadableButExtant) {
      findings.push({
        file: filePath,
        line: claim.line,
        pathClaim: claim.path,
        reason: `path does not exist (tried relative-to-repo: ${triedRelative.join(", ")})`,
        severity: "drift",
      });
    } else if (isResolvedClaim && resolvedAbsPath !== null) {
      // v0.6: path exists on disk — but is it git-tracked? Substrate
      // references should point to git-tracked paths or stable URLs,
      // NOT to local-mirror sync state (e.g., `references/prior-art/*`
      // which is gitignored per the upstream-mirror sync convention).
      if (isGitIgnored(resolvedAbsPath, repoRoot)) {
        findings.push({
          file: filePath,
          line: claim.line,
          pathClaim: claim.path,
          reason: `path exists on disk but is gitignored (resolves to ${toRelative(resolvedAbsPath)}) — substrate references should point to git-tracked paths or stable URLs, not local-mirror sync state`,
          severity: "warning",
        });
      }
    }
  }
  return { findings, ok: true };
}

export { findPathClaims, looksLikePath, isFutureStateContext, checkFile };
export type { Finding, PathClaim };

export function main(): number {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("usage: bun src/Core.TypeScript/substrate-claim-checker/check-existence.ts <file> [<file> ...]");
    return 1;
  }
  let totalDrift = 0;
  let totalWarnings = 0;
  let inputErrors = 0;
  for (const arg of args) {
    const { findings, ok } = checkFile(arg);
    if (!ok) {
      inputErrors++;
      continue;
    }
    for (const f of findings) {
      const label = f.severity === "warning" ? "existence warning" : "existence drift";
      console.log(`${f.file}:${f.line}: ${label} — claim "${f.pathClaim}" — ${f.reason}`);
      if (f.severity === "warning") {
        totalWarnings++;
      } else {
        totalDrift++;
      }
    }
  }
  if (inputErrors > 0) {
    console.error(`\n${inputErrors} input error(s).`);
    return 1;
  }
  if (totalDrift > 0 || totalWarnings > 0) {
    const parts: string[] = [];
    if (totalDrift > 0) parts.push(`${totalDrift} drift finding(s)`);
    if (totalWarnings > 0) parts.push(`${totalWarnings} warning(s)`);
    console.log(`\n${parts.join(", ")}.`);
    // Drift findings are real failures (exit 1); warnings alone exit 0
    // (substrate-quality concern but not blocking) per v0.6 design.
    return totalDrift > 0 ? 1 : 0;
  }
  console.log("no existence drift detected.");
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
