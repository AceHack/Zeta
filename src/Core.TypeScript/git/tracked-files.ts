/**
 * tracked-files - the repository's TRACKED file set, ordinal-sorted.
 *
 * WHY THIS EXISTS AS A SHARED HELPER. The rule it encodes is one sentence long and the
 * repo has now learned it twice:
 *
 *   Evidence that a checker acts on must be derived from the TRACKED set, never from a
 *   walk of the working tree - so the derivation is identical on every checkout.
 *
 * It was learned first in `ace/build-graph.ts` (#10395), where a working-tree walk would
 * have fed build outputs and caches into a byte-compared quorum JSON. It was then learned
 * AGAIN, one subsystem over, by `hygiene/unexecuted-test-files.ts` (#10473,
 * 081KZYXRYR8087G0R003E6JZA4): that checker walked the working tree, picked up the
 * gitignored `dist/` that `bun run pages:build` fills with copies of `docs/`, and exited 1
 * on every developer machine that had built - while staying green in CI, which checks out
 * clean. Green where nobody looks and red where everybody does is the worst polarity a
 * checker can have, because it trains people to ignore it.
 *
 * The first fix lived only in a comment, so it did not travel. This module is that lesson
 * moved from prose into the harness, which is the whole argument of
 * `docs/research/2026-08-13-lessons-belong-in-the-harness-not-in-rules-the-externalization-ladder.md`:
 * a lesson that must be re-derived by each author is a lesson that will be missed by one.
 *
 * WHAT THE TRACKED SET DELIBERATELY INCLUDES. `git ls-files` lists what the index holds,
 * which is what a fresh checkout - CI included - will contain. A file deleted in the
 * working tree but still tracked therefore still appears, and that is CORRECT for these
 * callers: CI will have it. Machine-independence is the property being bought, and it is
 * bought in both directions.
 */

import { execFileSync } from "node:child_process";

/**
 * Ordinal (UTF-16 code-unit) order. NOT `localeCompare`, which is locale-sensitive: the
 * derived list is byte-compared across machines, so a locale-dependent order would make
 * two correct machines disagree. See `.claude/rules/culture-invariant-by-default.md`.
 */
function ordinal(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/** Strip a leading `./` and normalize separators, so Windows and POSIX agree. */
export function normalizeTrackedPath(p: string): string {
  let out = p.replace(/\\/g, "/");
  while (out.startsWith("./")) out = out.slice(2);
  return out;
}

/**
 * Every tracked path under `root`, repo-relative, ordinal-sorted.
 *
 * THROWS on failure rather than returning empty. An empty list would read to every caller
 * as "nothing to check" - a skipped check wearing a passed check's face, which is the
 * exact defect the callers of this function exist to prevent. `-z` because a path may
 * legitimately contain a newline, and splitting on one would silently truncate the set.
 */
export function trackedFiles(root: string): readonly string[] {
  let raw: string;
  try {
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    raw = execFileSync("git", ["-C", root, "ls-files", "-z"], {
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
    });
  } catch (err) {
    throw new Error(`tracked-files: \`git ls-files\` failed in ${root}`, { cause: err });
  }
  const out: string[] = [];
  for (const entry of raw.split("\0")) {
    const t = entry.trim();
    if (t !== "") out.push(normalizeTrackedPath(t));
  }
  out.sort(ordinal);
  return out;
}
