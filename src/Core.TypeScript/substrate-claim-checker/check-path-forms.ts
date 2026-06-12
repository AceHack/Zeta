#!/usr/bin/env bun
/**
 * substrate-claim-checker / check-path-forms.ts (v0.7.0)
 *
 * Path-form drift sub-class checker — catches inconsistent path forms
 * within a single document. When the same physical file is referenced
 * as both `tools/substrate-claim-checker/check-counts.ts` and
 * `check-counts.ts`, a reader may not realize they point to the same
 * file, and a grep for the full path misses the bare form.
 *
 * Per the verify-then-claim memo's 7-class taxonomy (B-0170):
 *   "fully-qualified vs bare paths consistent across document"
 *
 * Reuses findPathClaims() from check-existence.ts for path extraction.
 */

import { readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, resolve, relative } from "node:path";
import { findPathClaims, type PathClaim } from "./check-existence.ts";

interface Finding {
  file: string;
  line: number;
  resolvedPath: string;
  forms: { path: string; line: number }[];
  reason: string;
}

function statExists(p: string): boolean {
  try {
    statSync(p);
    return true;
  } catch {
    return false;
  }
}

function findRepoRoot(startPath: string): string {
  let cur = isAbsolute(startPath) ? startPath : resolve(startPath);
  try {
    if (statSync(cur).isFile()) cur = dirname(cur);
  } catch {
    cur = dirname(cur);
  }
  while (cur !== "/" && cur !== "") {
    const gitPath = join(cur, ".git");
    if (statExists(gitPath)) return cur;
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return process.cwd();
}

/**
 * Resolve a path claim to an absolute path using the same 3-root
 * resolution strategy as check-existence.ts:
 *   1. File's own directory
 *   2. Parent directory
 *   3. Repository root
 *
 * Returns null if the path doesn't resolve to any existing file.
 */
function resolveClaim(
  claimPath: string,
  fileDir: string,
  fileParentDir: string,
  repoRoot: string,
): string | null {
  const candidateRoots = [fileDir, fileParentDir, repoRoot];
  for (const root of candidateRoots) {
    const absPath = isAbsolute(claimPath) ? claimPath : join(root, claimPath);
    if (statExists(absPath)) return absPath;
  }
  return null;
}

interface CheckResult {
  findings: Finding[];
  ok: boolean;
}

/**
 * Check a single file for path-form drift.
 *
 * Strategy:
 *   1. Extract all path claims via findPathClaims()
 *   2. Resolve each claim to an absolute on-disk path
 *   3. Group claims by resolved absolute path
 *   4. For groups with >1 distinct string form, emit a finding
 */
export function checkFile(filePath: string): CheckResult {
  let content: string;
  try {
    content = readFileSync(filePath, "utf8");
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      console.error(`error: file not found: ${filePath}`);
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

  const fileDir = isAbsolute(filePath)
    ? dirname(filePath)
    : resolve(dirname(filePath));
  const fileParentDir = dirname(fileDir);

  // Group claims by resolved absolute path
  const groups = new Map<string, { path: string; line: number }[]>();
  for (const claim of claims) {
    const resolved = resolveClaim(claim.path, fileDir, fileParentDir, repoRoot);
    if (resolved === null) continue; // non-existent paths are check-existence's domain
    const entries = groups.get(resolved) ?? [];
    entries.push({ path: claim.path, line: claim.line });
    groups.set(resolved, entries);
  }

  const findings: Finding[] = [];
  for (const [absPath, entries] of groups) {
    // Deduplicate string forms (same path string used on multiple lines is fine)
    const distinctForms = new Set(entries.map((e) => e.path));
    if (distinctForms.size <= 1) continue;

    // Collect one representative occurrence per distinct form
    const formExamples: { path: string; line: number }[] = [];
    const seen = new Set<string>();
    for (const entry of entries) {
      if (!seen.has(entry.path)) {
        seen.add(entry.path);
        formExamples.push(entry);
      }
    }

    const relPath = relative(repoRoot, absPath);
    const formList = formExamples
      .map((f) => `"${f.path}" (line ${f.line})`)
      .join(", ");

    findings.push({
      file: filePath,
      line: formExamples[0]!.line,
      resolvedPath: relPath,
      forms: formExamples,
      reason: `same file referenced as ${formList} — use a consistent form`,
    });
  }

  return { findings, ok: true };
}

export { type Finding, type PathClaim };

export function main(): number {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error(
      "usage: bun tools/substrate-claim-checker/check-path-forms.ts <file> [<file> ...]",
    );
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
      console.log(
        `${f.file}:${f.line}: path-form drift — ${f.reason}`,
      );
      totalFindings++;
    }
  }
  if (inputErrors > 0) {
    console.error(`\n${inputErrors} input error(s).`);
    return 1;
  }
  if (totalFindings > 0) {
    console.log(`\n${totalFindings} path-form drift finding(s).`);
    return 1;
  }
  console.log("no path-form drift detected.");
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
