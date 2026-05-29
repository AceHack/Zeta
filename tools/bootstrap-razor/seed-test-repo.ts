#!/usr/bin/env bun
/**
 * B-0343 bounded slice 2 (re-decomposed per "assume decomposition mistakes" rule).
 * Builds on the merged manifest-reader + --dry-run stub (PRs #2716/#2722/#2723).
 *
 * This slice adds glob RESOLUTION: turning the manifest's include/exclude
 * patterns into the concrete file set that would be seeded. Still no gh,
 * no create, no repo mutation — only a read-only filesystem scan of the
 * include-pattern subtrees. This is the prerequisite computation for
 * AC 1 ("seed exactly the files listed") and AC 3 (idempotency = compare
 * the resolved set against the target repo). Follow-up slices will add
 * gh api + idempotency + commit logic.
 *
 * Scan discipline: candidate collection scans each ROOTED include pattern
 * directly (e.g. `tools/tla/specs/*.tla`), never a recursive glob from the
 * repo root, so the gitignored `references/upstreams/` mirror is never
 * walked (.claude/rules/references-upstreams-not-our-code-search-excludes.md).
 */

import { parseArgs } from "node:util";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type ExitCode = 0 | 1;
type ManifestSection = "include" | "exclude";

interface SeedManifest {
  readonly include: readonly string[];
  readonly exclude: readonly string[];
}

/**
 * One resolved seed file paired with its git blob SHA — the content-addressable
 * identity GitHub's git-data/contents API returns verbatim for the same bytes.
 * A future idempotency slice (AC 3) compares this `{path, sha}` set against the
 * target repo's tree, so "is the repo already seeded with exactly these files?"
 * becomes a pure set comparison with no remote-content download.
 */
export interface SeedTreeEntry {
  readonly path: string;
  readonly sha: string;
}

/**
 * The subset of GitHub's `GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1`
 * response this slice reads. The API returns more fields (`mode`, `size`, `url`)
 * but idempotency only needs `path`, `type` (to keep blobs, drop sub-trees and
 * submodule `commit` entries), and `sha` (the same content-addressable blob
 * identity `gitBlobSha` produces). `truncated` is load-bearing: GitHub caps the
 * recursive tree at ~100k entries and sets `truncated: true` when it elides some —
 * an elided tree is NOT a safe idempotency basis (a missing entry would diff as a
 * spurious "create"), so the parser rejects it rather than silently under-reporting.
 */
interface GitTreeResponse {
  readonly tree: readonly { readonly path: string; readonly type: string; readonly sha: string }[];
  readonly truncated: boolean;
}

/** One desired seed path classified against the target repo's current tree. */
type SeedFileAction = "unchanged" | "create" | "update";

interface SeedDiffEntry {
  readonly path: string;
  readonly action: SeedFileAction;
  readonly desiredSha: string;
  /** The target's current blob SHA; null only when `action === "create"`. */
  readonly existingSha: string | null;
}

/**
 * Idempotency comparison result (AC 3). `entries` classifies every DESIRED path;
 * `extraneous` lists files present in the target tree but absent from the desired
 * set. Extraneous files do NOT break idempotency: seeding only creates/updates the
 * manifest's files and never deletes (a freshly-created repo's auto-README is
 * reported, not clobbered). `idempotent` is therefore true exactly when no path
 * needs a create or an update.
 */
interface SeedTreeDiff {
  readonly entries: readonly SeedDiffEntry[];
  readonly extraneous: readonly SeedTreeEntry[];
  readonly idempotent: boolean;
}

/**
 * One entry in the `tree` array of GitHub's `POST /repos/{owner}/{repo}/git/trees`
 * request body. `mode` is always `100644` (a regular non-executable file blob) for
 * seed content; `type` is always `"blob"`; `sha` references a blob the seeding flow
 * uploaded just before (a prior `POST /git/blobs` of the file's bytes returns this
 * same content-addressable SHA). The seed never writes directory rows or executable
 * bits, so the broader git-tree shape (`040000` sub-trees, `100755` exec, `120000`
 * symlinks, `160000` submodule gitlinks) is intentionally unrepresented.
 */
export interface GitTreeRequestEntry {
  readonly path: string;
  readonly mode: "100644";
  readonly type: "blob";
  readonly sha: string;
}

/**
 * The `POST /repos/{owner}/{repo}/git/commits` request body for the seed commit —
 * the next git-data step after `buildSeedTreeRequest`'s tree is submitted. `tree`
 * is the SHA `POST /git/trees` returns; `parents` is the target ref's current commit
 * SHA wrapped in a one-element array, OR the empty array for a brand-new repo's root
 * commit (GitHub accepts `parents: []` as a parentless root commit). `message` carries
 * the provenance line linking back to B-0193 / B-0343 so the recreation experiment's
 * history is self-documenting (AC: "commits the seed with a clear provenance message
 * linking back to B-0193"). GitHub's commit API accepts more optional fields
 * (`author`, `committer`, `signature`) — the seed sets none, letting the token's
 * identity author the commit, so they are intentionally unrepresented.
 */
export interface GitCommitRequest {
  readonly message: string;
  readonly tree: string;
  readonly parents: readonly string[];
}

/**
 * The git-refs API call that points the seed branch at the new commit — the last
 * git-data write step after `buildSeedCommitRequest`, named by that builder's doc
 * comment ("→ `PATCH /git/refs/heads/<branch>` to fast-forward the ref"). GitHub
 * splits this across two endpoints with DIFFERENT shapes (verified against
 * docs.github.com/en/rest/git/refs, API version 2022-11-28):
 *   - branch does NOT exist yet → `POST /repos/{owner}/{repo}/git/refs` with a body
 *     naming the FULL ref `refs/heads/<branch>` plus the commit `sha`.
 *   - branch already exists      → `PATCH /repos/{owner}/{repo}/git/refs/heads/<branch>`
 *     with `{ sha, force }`. The `git/refs/` path already carries the `refs/` prefix,
 *     so the path suffix is the SHORT `heads/<branch>` form, NOT `refs/heads/<branch>`.
 * The two `path` values therefore encode the FULL-vs-SHORT distinction GitHub's two
 * endpoints require; getting it wrong yields a 404 (PATCH `refs/heads/heads/...`) or a
 * 422 (POST with a short ref). A discriminated union on `method` lets the network slice
 * dispatch with no further branching: POST the create body, or PATCH the update body.
 */
export type GitRefUpdateRequest =
  | {
      readonly method: "POST";
      readonly path: string;
      readonly body: { readonly ref: string; readonly sha: string };
    }
  | {
      readonly method: "PATCH";
      readonly path: string;
      readonly body: { readonly sha: string; readonly force: boolean };
    };

const MANIFEST_DISPLAY_PATH = "docs/bootstrap-razor/SEED-MANIFEST.md";
const MANIFEST_PATH = fileURLToPath(new URL("../../docs/bootstrap-razor/SEED-MANIFEST.md", import.meta.url));
// Repo root = two levels up from tools/bootstrap-razor/.
const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));

function usage(): string {
  return [
    "Usage: bun seed-test-repo.ts [--dry-run] [--help]",
    "  --dry-run   Show the manifest seed plan without side effects",
    "",
  ].join("\n");
}

function stripYamlComment(value: string): string {
  return value.replace(/\s+#.*$/, "").trim();
}

export function parseSeedManifest(content: string): SeedManifest {
  const include: string[] = [];
  const exclude: string[] = [];
  let inYaml = false;
  let section: ManifestSection | null = null;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "```yaml") {
      inYaml = true;
      section = null;
      continue;
    }
    if (inYaml && line === "```") {
      inYaml = false;
      section = null;
      continue;
    }
    if (!inYaml) continue;
    if (line === "include:") {
      section = "include";
      continue;
    }
    if (line === "exclude:") {
      section = "exclude";
      continue;
    }
    if (!section || !line.startsWith("- ")) continue;

    const item = stripYamlComment(line.slice(2));
    if (item.length === 0) continue;
    if (section === "include") include.push(item);
    else exclude.push(item);
  }

  return { include, exclude };
}

function readManifest(path: string): SeedManifest | string {
  if (!existsSync(path)) return `missing seed manifest: ${MANIFEST_DISPLAY_PATH}`;
  const manifest = parseSeedManifest(readFileSync(path, "utf8"));
  if (manifest.include.length === 0) return `seed manifest has no include entries: ${MANIFEST_DISPLAY_PATH}`;
  if (manifest.exclude.length === 0) return `seed manifest has no exclude entries: ${MANIFEST_DISPLAY_PATH}`;
  return manifest;
}

/**
 * True when `path` matches any of `patterns`. Uses the same Bun.Glob engine
 * as candidate collection (`scanSync`) so resolution and scanning agree on
 * `**`/`*` semantics. Pure — operates on strings only, touches no filesystem.
 */
function matchesAny(path: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => new Bun.Glob(pattern).match(path));
}

/**
 * Pure resolver: from a candidate file list, keep paths that match an include
 * pattern AND match no exclude pattern (exclude wins). Independently testable
 * without a filesystem. The honest manifest semantics are include ∧ ¬exclude;
 * the "except bootstrap-razor/ itself" prose note in the manifest is NOT
 * encoded here (the include list does not name those files, so they are
 * neither included nor a false-exclude here).
 */
export function resolveSeedFiles(
  candidates: readonly string[],
  manifest: SeedManifest,
): readonly string[] {
  return candidates
    .filter((path) => matchesAny(path, manifest.include) && !matchesAny(path, manifest.exclude))
    .sort();
}

/**
 * Git's content-addressable blob identity: `sha1("blob " + byteLength + "\0" + content)`.
 * Byte-identical to `git hash-object` and to the `sha` GitHub returns in git-tree
 * and contents API responses. Pure — operates on the given bytes only. Uses the
 * raw byte length (NOT character count) so multi-byte content hashes correctly.
 */
export function gitBlobSha(content: Uint8Array): string {
  const header = Buffer.from(`blob ${content.length}\0`, "ascii");
  return createHash("sha1").update(header).update(content).digest("hex");
}

/**
 * Read each resolved seed file and pair it with its git blob SHA, sorted by path.
 * Read-only (one `readFileSync` per resolved file); no mutation, no network, no gh.
 * The resulting set is the "desired state" an idempotency slice diffs against the
 * target repo's tree. Output is canonically sorted by path REGARDLESS of input
 * order — this matches git's own path-sorted tree representation and makes the
 * idempotency comparison basis stable even if a caller passes an unsorted set
 * (`resolveSeedFiles` already sorts, but the contract does not depend on it).
 */
export function computeSeedTree(resolved: readonly string[], root: string): readonly SeedTreeEntry[] {
  return resolved
    .map((path) => ({
      path,
      sha: gitBlobSha(readFileSync(join(root, path))),
    }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/**
 * Pure idempotency diff (AC 3): classify each DESIRED `{path, sha}` against the
 * target repo's EXISTING `{path, sha}` tree. Per desired path:
 *   - absent from existing            → "create"
 *   - present, same blob SHA          → "unchanged"
 *   - present, different blob SHA     → "update"
 * Files present in `existing` but absent from `desired` are reported as
 * `extraneous` (never deleted — seeding is add/update only). The repo is
 * idempotent (already seeded with exactly these bytes) when no path needs a
 * create or update. Pure — operates on the two SHA sets only; no filesystem,
 * no network, no gh. This is the comparison `computeSeedTree`'s slice named as
 * its handoff; a follow-up slice fetches the target tree via gh and feeds it in.
 */
export function diffSeedTree(
  desired: readonly SeedTreeEntry[],
  existing: readonly SeedTreeEntry[],
): SeedTreeDiff {
  const byPath = new Map(existing.map((entry) => [entry.path, entry.sha]));
  const desiredPaths = new Set(desired.map((entry) => entry.path));
  const byPathSort = (a: { path: string }, b: { path: string }): number =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0;

  const entries = desired
    .map((entry): SeedDiffEntry => {
      const existingSha = byPath.get(entry.path);
      if (existingSha === undefined) {
        return { path: entry.path, action: "create", desiredSha: entry.sha, existingSha: null };
      }
      return {
        path: entry.path,
        action: existingSha === entry.sha ? "unchanged" : "update",
        desiredSha: entry.sha,
        existingSha,
      };
    })
    .sort(byPathSort);

  const extraneous = existing.filter((entry) => !desiredPaths.has(entry.path)).sort(byPathSort);
  const idempotent = entries.every((entry) => entry.action === "unchanged");

  return { entries, extraneous, idempotent };
}

/**
 * Pure parser: turn a GitHub git-tree API response into the `{path, sha}` set
 * `diffSeedTree` consumes as its `existing` (target-repo) argument. This is the
 * missing bridge between a future `gh api git/trees/<sha>?recursive=1` call and
 * the already-tested pure diff — isolating it here keeps the network slice that
 * follows trivial (one fetch + JSON.parse + this function). Pure: no network,
 * no gh, no filesystem; operates only on the already-parsed JSON value.
 *
 * Returns the sorted blob set on success, or an error string (same `T | string`
 * convention as `readManifest`) when the response is unusable:
 *   - not an object, or missing a `tree` array            → malformed
 *   - `truncated: true`                                   → incomplete basis (rejected,
 *     because a missing entry would mis-diff as a "create" and trigger a duplicate write)
 *   - a tree entry missing string `path`/`type`/`sha`     → malformed entry
 *
 * Non-blob entries (`type === "tree"` directories, `type === "commit"` submodule
 * gitlinks) are dropped: seeding compares files, and a recursive tree already
 * lists every blob with its full path, so the directory rows carry no information
 * the diff needs.
 */
export function parseGitTreeResponse(response: unknown): readonly SeedTreeEntry[] | string {
  if (typeof response !== "object" || response === null) {
    return "git tree response is not an object";
  }
  const candidate = response as Partial<GitTreeResponse>;
  if (!Array.isArray(candidate.tree)) {
    return "git tree response missing `tree` array";
  }
  if (candidate.truncated === true) {
    return "git tree response is truncated — cannot use as an idempotency basis";
  }

  const blobs: SeedTreeEntry[] = [];
  for (const entry of candidate.tree) {
    if (typeof entry !== "object" || entry === null) {
      return "git tree entry is not an object";
    }
    const { path, type, sha } = entry as Record<string, unknown>;
    if (typeof path !== "string" || typeof type !== "string" || typeof sha !== "string") {
      return "git tree entry missing string path/type/sha";
    }
    if (type === "blob") blobs.push({ path, sha });
  }

  return blobs.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/**
 * Pure write-side bridge — the mirror of `parseGitTreeResponse`. Where the parser
 * turns the target repo's git tree INTO the diff's `existing` input, this turns the
 * diff's verdict INTO the `tree` array a `POST /git/trees` call submits to write the
 * seed. Only paths whose action is "create" or "update" appear: "unchanged" paths are
 * carried implicitly by the request's `base_tree` (the target's current tree), so
 * re-listing them would be wasted bytes and a needless tree-object churn. Each entry
 * carries the DESIRED blob SHA (`desiredSha`), which is the same content-addressable
 * identity a prior `POST /git/blobs` of that file's bytes returns — so the network
 * slice that follows is: upload each create/update blob → submit this tree (with
 * base_tree = current ref tree) → create a commit → fast-forward the ref.
 *
 * Pure: operates only on the diff; no gh, no network, no filesystem. When the diff
 * is idempotent (`diff.idempotent === true`) the result is the empty array — the
 * repo already holds exactly these bytes, so there is no tree to write at all, and
 * the seeding flow can skip the blob/tree/commit/ref steps entirely (AC 3). Input
 * order is preserved: `diffSeedTree` already returns `entries` path-sorted, matching
 * git's own path-sorted tree representation, so the output stays canonically sorted.
 */
export function buildSeedTreeRequest(diff: SeedTreeDiff): readonly GitTreeRequestEntry[] {
  return diff.entries
    .filter((entry) => entry.action !== "unchanged")
    .map((entry) => ({ path: entry.path, mode: "100644", type: "blob", sha: entry.desiredSha }));
}

/**
 * The provenance commit message for the seed (AC: "clear provenance message linking
 * back to B-0193"). A conventional-commit subject naming the file count, then a body
 * citing the seed manifest as the source-of-truth and the B-0193 parent / B-0343 slice
 * lineage. Pure: a string function of the file count only. `fileCount` pluralizes the
 * subject ("1 file" vs "N files"); it is the count of files the seed WRITES (the diff's
 * create + update entries), so a re-seed that touches one file reads naturally. The
 * idempotent path never reaches a commit at all (`buildSeedTreeRequest` returns the
 * empty plan), so this is only ever called with `fileCount >= 1`.
 */
export function seedCommitMessage(fileCount: number): string {
  const noun = fileCount === 1 ? "file" : "files";
  return [
    `chore(B-0343): seed bootstrap-razor recreation test repo (${fileCount} ${noun})`,
    "",
    `Seeded from ${MANIFEST_DISPLAY_PATH} per B-0193 AC 1`,
    "(bootstrap razor + 23-hour recreation test).",
    "",
    "Parent: B-0193",
    "Slice:  B-0343",
  ].join("\n");
}

/**
 * Pure builder for the seed commit's `POST /git/commits` body — the mirror of
 * `buildSeedTreeRequest` one step further down the git-data write chain. Takes the
 * tree SHA the prior `POST /git/trees` returned, the target ref's current commit SHA
 * (or `null` for a brand-new repo with no commits yet), and the file count for the
 * provenance message. The `parentSha === null` case maps to `parents: []` — a root
 * commit — so a freshly-`gh`-created empty repo and an existing-ref fast-forward share
 * one builder. Pure: operates on the three arguments only; no gh, no network, no
 * filesystem. The network slice that follows is: submit this body → take the returned
 * commit SHA → `PATCH /git/refs/heads/<branch>` to fast-forward the ref.
 */
export function buildSeedCommitRequest(
  treeSha: string,
  parentSha: string | null,
  fileCount: number,
): GitCommitRequest {
  return {
    message: seedCommitMessage(fileCount),
    tree: treeSha,
    parents: parentSha === null ? [] : [parentSha],
  };
}

/**
 * Pure builder for the seed's git-refs API call — the final write-chain link, taking
 * the commit SHA `buildSeedCommitRequest`'s body produced once `POST /git/commits`
 * returns it, and pointing the seed branch at it. `refExists` selects the endpoint:
 * a brand-new repo whose seed branch does not exist yet CREATES it (`POST`); an
 * existing branch is fast-forwarded (`PATCH`). This is the same fresh-vs-existing fork
 * `buildSeedCommitRequest` makes on `parentSha === null` — kept pure so both paths are
 * unit-tested before any repo mutation exists.
 *
 * `force` is always false: the seed only ever fast-forwards. A non-fast-forward means
 * the branch diverged from the tree the diff was computed against, so the PATCH must
 * fail loudly (HTTP 422) rather than clobber peer commits — the same non-coercion
 * discipline as `git push --force-with-lease`. Pure: operates on its arguments only;
 * no gh, no network, no filesystem. The network slice that follows is the whole flow
 * end-to-end: `POST /git/blobs` (each create/update file) → `POST /git/trees`
 * (`buildSeedTreeRequest` with `base_tree`) → `POST /git/commits`
 * (`buildSeedCommitRequest`) → this request → done.
 */
export function buildSeedRefUpdateRequest(
  owner: string,
  repo: string,
  branch: string,
  commitSha: string,
  refExists: boolean,
): GitRefUpdateRequest {
  const base = `repos/${owner}/${repo}/git/refs`;
  if (!refExists) {
    return { method: "POST", path: base, body: { ref: `refs/heads/${branch}`, sha: commitSha } };
  }
  return { method: "PATCH", path: `${base}/heads/${branch}`, body: { sha: commitSha, force: false } };
}

/**
 * Read-only filesystem scan: collect the concrete files under each rooted
 * include pattern. Scans include patterns directly (never a recursive glob
 * from root) to avoid walking gitignored mirror trees. No mutation, no
 * network, no gh.
 */
function collectSeedCandidates(root: string, manifest: SeedManifest): readonly string[] {
  const found = new Set<string>();
  for (const pattern of manifest.include) {
    for (const file of new Bun.Glob(pattern).scanSync({ cwd: root, onlyFiles: true, dot: true })) {
      found.add(file);
    }
  }
  return [...found];
}

function emitDryRun(manifest: SeedManifest, root: string): void {
  console.log(`[B-0343] DRY-RUN: read ${MANIFEST_DISPLAY_PATH}`);
  console.log(`Manifest include patterns (${manifest.include.length}):`);
  for (const item of manifest.include) console.log(`  + ${item}`);
  console.log(`Manifest exclude patterns (${manifest.exclude.length}):`);
  for (const item of manifest.exclude) console.log(`  - ${item}`);

  const candidates = collectSeedCandidates(root, manifest);
  const resolved = resolveSeedFiles(candidates, manifest);
  const tree = computeSeedTree(resolved, root);
  console.log(`Resolved concrete seed files with git blob SHAs (${tree.length}):`);
  for (const { path, sha } of tree) console.log(`  • ${sha}  ${path}`);

  console.log("These blob SHAs are the idempotency comparison basis (AC 3):");
  console.log("a follow-up slice diffs them against the target repo's git tree.");

  // Against a FRESH (empty) repo every desired path is a create, so the diff's
  // write plan equals the full seed. This shows the exact `POST /git/trees` tree
  // array the seeding flow would submit for a brand-new repo (AC 1). For an
  // already-seeded repo the network slice fetches the real tree, and an idempotent
  // diff collapses this to the empty array (no writes).
  const freshRepoPlan = buildSeedTreeRequest(diffSeedTree(tree, []));
  console.log(`POST /git/trees write plan for a fresh repo (${freshRepoPlan.length} entries):`);
  for (const { mode, type, sha, path } of freshRepoPlan) {
    console.log(`  ${mode} ${type} ${sha}  ${path}`);
  }

  console.log("Provenance commit would link to B-0193 / B-0343.");
  console.log("gh create + real seeding + commit: follow-up slice.");
}

export function main(argv: readonly string[]): ExitCode {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
    strict: false,
  });

  if (values.help) {
    process.stdout.write(usage());
    return 0;
  }

  if (values["dry-run"]) {
    const manifest = readManifest(MANIFEST_PATH);
    if (typeof manifest === "string") {
      process.stderr.write(`${manifest}\n`);
      return 1;
    }
    emitDryRun(manifest, REPO_ROOT);
    return 0;
  }

  console.log("This is the minimal TS stub for B-0343.");
  console.log("Re-run with --dry-run to see the manifest seed plan.");
  console.log("No repo creation performed (bounded slice).");
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
