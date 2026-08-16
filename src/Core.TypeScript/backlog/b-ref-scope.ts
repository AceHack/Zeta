/**
 * b-ref-scope.ts — the ONE definition of which trees the legacy-B-NNNN tooling
 * may read and rewrite.
 *
 * Why this module exists: `lint-b-refs-resolve.ts` (which reports drift) and
 * `rebuild-legacy-b-id-aliases.ts` (the remedy the linter tells you to run)
 * had *no* shared scope. The linter deliberately skipped four archival trees;
 * the remedy skipped only `node_modules` and `.git`. So the advertised fix was
 * strictly wider than the check advertising it, and running it rewrote ~1,700
 * files across archives the linter had refused to police — a blast radius big
 * enough to exceed a 500s timeout and get killed mid-rewrite.
 *
 * A check and its remedy that disagree about scope is the bug. They now import
 * the same list.
 *
 * Membership rule: a prefix belongs here only if the tree is ARCHIVAL (a record
 * of what something said at the time) or GENERATED (re-materialised by a tool,
 * so edits do not survive). Never add a live authored surface — that would make
 * the lint unfalsifiable. Boundary tests in `lint-b-refs-resolve.test.ts` pin
 * this.
 *
 * Note the asymmetry with `b-ref-resolve.ts`: the recovered-orphan-branch
 * archive is exempt from being POLICED (it is a record, and rewriting it would
 * falsify an archive — manifesto §5) while still counting as a RESOLUTION
 * target. A ref into the archive points at a real file; the archive's own refs
 * are history and are left alone.
 */

/** Repo-relative directory prefixes exempt from legacy-id policing and rewriting. */
export const SKIP_DIR_PREFIXES = [
  // Archival: recovered orphan-branch history — records of what old branches said.
  // Rewriting them falsifies an archive (manifesto §5, memory preservation).
  "docs/recovered-orphan-branches-2026-05/",

  // Generated + archival: PR review history, written by pr-archive-on-merge.yml.
  "docs/history/",

  // Generated + archival: the GitHub PR mirror (manifest.jsonl + per-PR shards).
  // Shard fields are verbatim PR titles/bodies as merged, and the SAME workflow
  // step that writes docs/history/ above re-materialises these from the GitHub
  // API on every merge — so a rewrite here both falsifies the mirror and is
  // re-introduced by the next merge carrying a legacy id in its title.
  "docs/github/prs/",

  // Archival: agent memory — others' recorded observations, never curated.
  "memory/",

  // Archival: retired rules, kept for lineage.
  ".claude/rules.bak/",

  // Generated: gitignored build output with zero tracked files, so it never
  // exists in CI. Scanning it locally produced offenders CI could not see.
  "dist/",
] as const;

/** Directory names skipped everywhere, at any depth. */
export const SKIP_DIR_NAMES: ReadonlySet<string> = new Set(["node_modules", ".git"]);

/** File extensions the legacy-id tooling reads. */
export const SCAN_EXTENSIONS: ReadonlySet<string> = new Set([
  ".md", ".ts", ".tsx", ".js", ".json", ".yaml", ".yml", ".jsonc", ".sh", ".fs", ".fsx",
]);

/**
 * True when `relDir` (repo-relative, no trailing slash, POSIX separators) is
 * inside an exempt tree.
 *
 * Prefix-precise by construction: `dist/` matches `dist` and `dist/...` but not
 * `distributed`, and `docs/github/prs/` does not match `docs/github/prs-notes`.
 */
export function shouldSkipDir(relDir: string): boolean {
  if (relDir.length === 0) return false;
  return SKIP_DIR_PREFIXES.some(
    (prefix) => relDir === prefix.slice(0, -1) || relDir.startsWith(prefix),
  );
}
