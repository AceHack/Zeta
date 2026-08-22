#!/usr/bin/env bun
// audit-no-raw-nul-in-source.ts — a source file that greps read as BINARY is a file every
// audit silently skips.
//
// WHY THIS EXISTS
// ---------------
// `tools/setup/persona-keys/frost-token-roster.ts` already carried the reasoning, written
// as a comment next to a `\u0000` escape:
//
//   "a RAW NUL makes this file read as binary to grep/rg, which scan the whole file — git
//    only sniffs the first 8KB, so git still rendered it as text and review saw nothing
//    wrong. An audit of this file then silently matches nothing instead of searching it:
//    a check that did not run, looking like one that passed."
//
// That was a CONVENTION, and a convention nobody checks is the vacuity class. When this
// audit was first run, ten tracked source files held raw NUL bytes — including
// `tools/setup/persona-keys/key-epoch-ledger.ts`, the revocation ledger, which is the
// single highest-audit-value file in the key stack, and
// `src/Core.TypeScript/hygiene/treaty-rule-alternatives.ts`, which is *itself* an audit
// tool. Every one of them sat inside a string or char literal where `\u0000` has the
// identical runtime value; none of them needed to be a raw byte.
//
// WHAT GOES WRONG, CONCRETELY
// ---------------------------
// `rg 'foldChain' key-epoch-ledger.ts` printed `binary file matches` and exit code 0 —
// ten real matches invisible, and a zero exit to whatever was consuming it. Tools that
// pipe `rg`/`grep` output into a check therefore see *no findings* and report *clean*.
// This is the same failure this repo hunts everywhere else: an under-report that reads
// exactly like a pass.
//
// THE RULE, AND WHY IT COSTS NOTHING
// ----------------------------------
// A raw NUL in source is never load-bearing. Every legitimate use is a separator or a
// sentinel inside a literal, and `\u0000` (TS/JS/F#/C#/Rust) is byte-identical at runtime
// while keeping the file text to every tool that reads it. So the rule is total, has no
// exception class to drift, and needs no allowlist:
//
//   NO TRACKED SOURCE FILE CONTAINS A RAW 0x00 BYTE.
//
// SCOPE. Code extensions only. Documentation and data (`.md`, `.json`, `.txt`) are
// deliberately NOT scanned here — not because a NUL would be harmless in them, but
// because this must stay fast enough to sit in a per-PR floor job, and the code tree is
// where greps drive checks. That is a stated limit, not a claim of coverage.
//
// NOT COVERED, said plainly: other bytes that make a tool treat a file as binary (lone
// surrogates, some control ranges) are not checked. `rg`'s own heuristic is NUL-based,
// which is why NUL is the one that bites.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

/** Extensions treated as code. Data/doc formats are out of scope — see the header. */
export const CODE_EXTENSIONS: readonly string[] = [
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".fs", ".fsx", ".fsi", ".cs", ".rs", ".go", ".zig",
  ".py", ".c", ".h", ".cpp", ".hpp", ".wat", ".sh", ".bash",
  ".sql", ".toml", ".yml", ".yaml",
];

export function isCodePath(path: string): boolean {
  return CODE_EXTENSIONS.some((e) => path.endsWith(e));
}

export interface RawNulSite {
  readonly path: string;
  /** 1-based line number of the first NUL on that line. */
  readonly line: number;
  /** How many raw NUL bytes are on that line. */
  readonly count: number;
}

/**
 * Locate every raw NUL byte, by line.
 *
 * Pure over injected bytes so the refusal is testable without planting a binary file in
 * the repo — which would itself be a file the tools skip.
 *
 * Counts LINES by 0x0A over the raw bytes rather than decoding first: decoding is exactly
 * the step that could normalise the byte away, and a check must not be able to lose the
 * thing it is looking for on the way in.
 */
export function findRawNulSites(path: string, bytes: Uint8Array): readonly RawNulSite[] {
  const perLine = new Map<number, number>();
  let line = 1;
  for (const b of bytes) {
    if (b === 0x0a) line += 1;
    else if (b === 0x00) perLine.set(line, (perLine.get(line) ?? 0) + 1);
  }
  return [...perLine.entries()]
    .sort((a, b) => a[0] - b[0]) // line numbers: numeric order, no collation involved
    .map(([l, count]) => ({ path, line: l, count }));
}

/** Tracked files, from git itself — never a directory walk that could miss a worktree. */
export function trackedFiles(): readonly string[] {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const res = spawnSync("git", ["ls-files", "-z"], { encoding: "buffer", maxBuffer: 1 << 28 });
  if (res.status !== 0) {
    throw new Error(`audit-no-raw-nul-in-source: git ls-files failed (status ${String(res.status)})`);
  }
  return res.stdout
    .toString("utf8")
    .split("\u0000")
    .filter((p) => p.length > 0);
}

export function auditRepo(): readonly RawNulSite[] {
  const out: RawNulSite[] = [];
  for (const path of trackedFiles()) {
    if (!isCodePath(path)) continue;
    let bytes: Uint8Array;
    try {
      bytes = readFileSync(path);
    } catch {
      continue; // deleted-but-tracked in a dirty tree; not this audit's business
    }
    out.push(...findRawNulSites(path, bytes));
  }
  return out;
}

if (import.meta.main) {
  const sites = auditRepo();
  if (sites.length === 0) {
    console.log("audit-no-raw-nul-in-source: clean — no tracked code file contains a raw NUL byte.");
    process.exit(0);
  }
  console.error(
    `audit-no-raw-nul-in-source: ${String(sites.length)} raw NUL site(s). These read as BINARY to\n` +
      "grep/rg, so every text audit silently skips them. Replace the byte with the escape\n" +
      "\\u0000 — identical runtime value, and the file stays searchable.\n",
  );
  for (const s of sites) {
    console.error(`  ${s.path}:${String(s.line)}  ${String(s.count)} raw NUL byte(s)`);
  }
  process.exit(1);
}
