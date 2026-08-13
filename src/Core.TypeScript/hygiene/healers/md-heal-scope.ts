#!/usr/bin/env bun
/**
 * md-heal-scope — the healer must not rewrite files the lint profile excludes.
 *
 * THE BUG THIS EXISTS TO CLOSE. `.markdownlint-cli2.jsonc` carries an `ignores` list, and one of
 * its entries is `docs/history/pr-reviews/**` with the reason stated inline: reformatting those to
 * satisfy MD007/MD012/MD032 "would violate the verbatim contract". But that list is consulted only
 * by `markdownlint-cli2` when CHECKING. The auto-heal path never read it — both call sites built
 * their worklist as:
 *
 *     mapfile -t files < <(git ls-files '*.md')
 *
 * i.e. every tracked markdown file in the repo, ignore-list unseen. On 2026-08-13 that rewrote
 * **414 preserved PR-review archives** with an MD032 fix, on a branch, minutes after they were
 * drained out of orphaned bot branches — the exact files `docs/history/pr-reviews/README.md` says
 * "Read, do not refactor" about, and the exact rule number the config named.
 *
 * The rule was right, documented, and cross-referenced in AGENT-BEST-PRACTICES. It was simply never
 * asked on the path that could act. That is the shape worth naming: a guard that exists and is
 * never consulted is indistinguishable from no guard at all — the check did not run, and nothing
 * said so.
 *
 * ONE SOURCE OF TRUTH. This reads the SAME `ignores` array the linter uses rather than restating
 * it. A second hand-maintained exclusion list would drift from the first the moment someone edited
 * one and not the other, which is how this class of defect regenerates.
 *
 * Usage (filter a NUL- or newline-separated list on stdin, emit the healable subset):
 *   git ls-files '*.md' | bun src/Core.TypeScript/hygiene/healers/md-heal-scope.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

export const LINT_CONFIG = ".markdownlint-cli2.jsonc";

/**
 * Pull the `ignores` globs out of the JSONC config.
 *
 * Hand-rolled rather than JSON.parse: the file is JSONC — `//` comments and trailing commas — so
 * a strict parser rejects it outright (verified: "Illegal trailing comma"). Scanning the array
 * body for quoted strings while skipping comment lines is robust to both, and to the comment
 * prose sitting between entries.
 */
export function parseIgnores(configText: string): readonly string[] {
  const start = configText.indexOf('"ignores"');
  if (start < 0) return [];
  const open = configText.indexOf("[", start);
  const close = configText.indexOf("]", open);
  if (open < 0 || close < 0) return [];

  const out: string[] = [];
  for (const rawLine of configText.slice(open + 1, close).split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("//")) continue; // a comment may itself contain quoted text
    const m = /"([^"]+)"/.exec(line);
    if (m?.[1] !== undefined) out.push(m[1]);
  }
  return out;
}

export function loadIgnores(root: string): readonly string[] {
  try {
    return parseIgnores(readFileSync(join(root, LINT_CONFIG), "utf8"));
  } catch {
    // NO SILENT PASS. A missing or unreadable config must not degrade into "heal everything" —
    // that is the failure mode this module exists to prevent, and it would be invisible.
    throw new Error(`md-heal-scope: cannot read ${LINT_CONFIG} — refusing to heal with no scope`);
  }
}

/** Does any ignore glob claim this path? Paths are repo-relative, forward-slashed. */
export function isIgnored(path: string, ignores: readonly string[]): boolean {
  return ignores.some((pattern) => new Bun.Glob(pattern).match(path));
}

/** The subset the healer is allowed to rewrite. */
export function healable(files: readonly string[], ignores: readonly string[]): readonly string[] {
  return files.filter((f) => f.trim() !== "" && !isIgnored(f.trim(), ignores));
}

const invokedDirectly =
  typeof process.argv[1] === "string" && /md-heal-scope\.(?:ts|js)$/.test(process.argv[1]);
if (invokedDirectly) {
  const i = process.argv.indexOf("--repo-root");
  const root = i >= 0 ? (process.argv[i + 1] ?? process.cwd()) : process.cwd();
  const ignores = loadIgnores(root);

  const stdin = readFileSync(0, "utf8");
  const files = stdin.split(/\r?\n|\0/).map((s) => s.trim()).filter((s) => s !== "");
  const keep = healable(files, ignores);

  // The count of what was WITHHELD goes to stderr so it is visible in the job log without
  // polluting the file list on stdout. Silence here would hide the guard doing its job.
  const withheld = files.length - keep.length;
  console.error(
    `[md-heal-scope] ${String(keep.length)} healable, ${String(withheld)} withheld by ${LINT_CONFIG} ignores`,
  );
  for (const f of keep) console.log(f);
}
