#!/usr/bin/env bun
// detect-clause-drift.ts — alignment-clause cross-reference (blast-radius) scan.
//
// 081KRQ1AB0008QG0R001BPDBHT (decomposed from 081KQ3HBZ0008QG0R002S674CG): pre-renegotiation impact survey.
// Scans the repository working tree for references to alignment clauses
// (HC-1..HC-7, SD-1..SD-9, DIR-1..DIR-5) from docs/ALIGNMENT.md and
// reports which files reference each clause. Answers "who depends on
// this clause, and what breaks if it moves?" BEFORE an ALIGNMENT.md
// renegotiation is accepted.
//
// Distinct from audit_clause_drift.ts (081KQ3HBZ0008QG0R002S674CG slice 2), which diffs
// docs/ALIGNMENT.md between two git refs to detect WHAT changed. This
// tool detects WHO references the clauses (the blast radius). The two
// compose: audit_clause_drift.ts names the changed clauses; this tool
// surveys their cross-references across the working tree.
//
// Usage:
//   bun src/Core.TypeScript/alignment/detect-clause-drift.ts            # all clauses
//   bun src/Core.TypeScript/alignment/detect-clause-drift.ts HC-1       # one clause
//   bun src/Core.TypeScript/alignment/detect-clause-drift.ts --json
//
// Exit codes:
//   0  Clean run (references emitted, or none found)
//   2  Script error / bad args

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

type ExitCode = 0 | 2;

// Canonical valid clause set + matcher, aligned with
// src/Core.TypeScript/alignment/audit_clause_coverage.ts extractClauses(). Word
// boundaries + bounded numeric ranges prevent false positives on
// out-of-range IDs (HC-0, SD-99, etc.). A fresh RegExp per line keeps
// the matcher stateless (no shared /g lastIndex skipping matches).
const CLAUSE_PATTERN = "\\b(HC-[1-7]|SD-[1-9]|DIR-[1-5])\\b";

// Heavy / non-source trees that would make a full walk take minutes and
// drown the signal. references/ (and references/prior-art/) is the big
// one — gigabytes of mirrored OTHER-repo source per the repo convention
// (.claude/rules/references-prior-art-not-our-code-search-excludes.md).
const IGNORE_DIRS: readonly string[] = [
  "node_modules", ".git", ".vscode", ".idea", "dist", "build",
  "bin", "obj", "target", "references",
];
const IGNORE_EXTS: readonly string[] = [
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".pdf",
  ".zip", ".gz", ".tar", ".DS_Store",
];

export interface ClauseMatch {
  readonly file: string;
  readonly line: number;
  readonly clause: string;
  readonly text: string;
}

/** Resolve the git repository root so the scan covers the whole repo
 *  regardless of the caller's CWD. Falls back to the given dir. */
function repoRoot(fallback: string): string {
  const res = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf-8",
  });
  if (res.status === 0 && typeof res.stdout === "string") {
    const root = res.stdout.trim();
    if (root.length > 0) return root;
  }
  return fallback;
}

function searchInFile(filePath: string): ClauseMatch[] {
  if (IGNORE_EXTS.some((ext) => filePath.endsWith(ext))) return [];

  const matches: ClauseMatch[] = [];
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    // Unreadable / binary file — skip silently.
    return matches;
  }

  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    // Fresh RegExp per line: matchAll over a non-shared instance avoids
    // the cross-line lastIndex skipping that a module-level /g regex has.
    for (const m of line.matchAll(new RegExp(CLAUSE_PATTERN, "g"))) {
      const clause = m[0];
      matches.push({ file: filePath, line: i + 1, clause, text: line.trim() });
    }
  }
  return matches;
}

function searchInDirectory(dirPath: string): ClauseMatch[] {
  let allMatches: ClauseMatch[] = [];
  const entries = readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORE_DIRS.includes(entry.name)) continue;
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      allMatches = allMatches.concat(searchInDirectory(fullPath));
    } else if (entry.isFile()) {
      allMatches = allMatches.concat(searchInFile(fullPath));
    }
  }
  return allMatches;
}

/** Build a clause → referencing-files map for the given root. */
export function findClauseReferences(dirPath: string): Map<string, string[]> {
  const references = new Map<string, string[]>();
  for (const match of searchInDirectory(dirPath)) {
    const files = references.get(match.clause) ?? [];
    if (!files.includes(match.file)) files.push(match.file);
    references.set(match.clause, files);
  }
  return references;
}

export function main(argv: readonly string[]): ExitCode {
  const json = argv.includes("--json");
  const targetClause = argv.find((a) => !a.startsWith("--"));

  const root = repoRoot(process.cwd());
  const allMatches = searchInDirectory(root);

  const filtered = targetClause
    ? allMatches.filter(
        (m) => m.clause.toUpperCase() === targetClause.toUpperCase(),
      )
    : allMatches;

  if (json) {
    const grouped: Record<string, ClauseMatch[]> = {};
    for (const m of filtered) (grouped[m.clause] ??= []).push(m);
    process.stdout.write(
      JSON.stringify({ root, references: grouped }, null, 2) + "\n",
    );
    return 0;
  }

  process.stdout.write(`Alignment-clause references under ${root}\n`);
  if (filtered.length === 0) {
    process.stdout.write("No alignment clause references found.\n");
    return 0;
  }

  const groupedByClause: Record<string, ClauseMatch[]> = {};
  for (const m of filtered) (groupedByClause[m.clause] ??= []).push(m);

  for (const clause of Object.keys(groupedByClause).sort()) {
    const group = groupedByClause[clause];
    if (group === undefined) continue;
    process.stdout.write(`\n--- ${group.length} references to ${clause} ---\n`);
    for (const match of group) {
      process.stdout.write(`${match.file}:${match.line} - ${match.text}\n`);
    }
  }
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
