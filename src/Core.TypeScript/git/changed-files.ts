/**
 * changed-files — the TRACKED paths a clone is about to publish.
 *
 * Sibling of `tracked-files.ts`, and it exists for the same reason: a checker that
 * wants to run "only when this change touches my inputs" needs one answer to *what
 * did this change touch*, not a hand-rolled `git diff` per caller. The set is the
 * union of two questions a pre-push / pre-PR checker always means together:
 *
 *   1. what this BRANCH adds on top of its base   (`<base>..HEAD`)
 *   2. what the WORKING TREE + INDEX hold beyond HEAD (`git diff HEAD`)
 *
 * (2) is what makes a `git add`-ed but uncommitted file count — which is the state
 * an author is in when they run a preflight, and the state the guard has to catch.
 *
 * UNTRACKED FILES ARE DELIBERATELY EXCLUDED. Derivations in this repo read the
 * TRACKED set (`tracked-files.ts` — the machine-independence property), so an
 * untracked file changes no derived artifact until it is staged. Including it would
 * fire guards on scratch files, which is how a guard gets turned off.
 *
 * FAILURE IS LOUD, NOT EMPTY. If the base cannot be resolved the caller is handed
 * `undefined` rather than `[]`: an empty changed set reads as "nothing to check",
 * which is a skipped check wearing a passed check's face. Callers must decide
 * explicitly — the conservative decision being to check everything.
 */

import { execFileSync } from "node:child_process";
import { normalizeTrackedPath } from "./tracked-files";

/** Ordinal (UTF-16 code-unit) order — never `localeCompare`. */
function ordinal(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

function git(root: string, args: readonly string[]): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function namesFromNulSeparated(raw: string, into: Set<string>): void {
  // `-z` because a tracked path may legitimately contain a newline; splitting on
  // one would silently truncate the set (same reasoning as `tracked-files.ts`).
  for (const entry of raw.split("\0")) {
    const t = entry.trim();
    if (t !== "") into.add(normalizeTrackedPath(t));
  }
}

/**
 * The merge base of `HEAD` and `baseRef`, or `undefined` when it cannot be resolved
 * (no such ref — a clone with no `origin`, a detached CI checkout, a fresh repo).
 */
export function mergeBaseWith(root: string, baseRef: string): string | undefined {
  try {
    return git(root, ["merge-base", "HEAD", baseRef]).trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Tracked paths changed by this branch relative to `baseRef`, PLUS anything the
 * index/working tree holds beyond `HEAD`. `undefined` when the base is unresolvable
 * — see the module note: the caller decides what an unknown scope means.
 */
export function changedFiles(root: string, baseRef = "origin/main"): readonly string[] | undefined {
  const base = mergeBaseWith(root, baseRef);
  if (base === undefined) return undefined;
  const out = new Set<string>();
  try {
    namesFromNulSeparated(git(root, ["diff", "--name-only", "-z", `${base}..HEAD`]), out);
    namesFromNulSeparated(git(root, ["diff", "--name-only", "-z", "HEAD"]), out);
  } catch {
    return undefined;
  }
  const arr = [...out];
  arr.sort(ordinal);
  return arr;
}
