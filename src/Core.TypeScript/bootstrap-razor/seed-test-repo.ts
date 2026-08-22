#!/usr/bin/env bun
/**
 * 081KR2E4K0008QG0R002JW751Y bounded slice 2 (re-decomposed per "assume decomposition mistakes" rule).
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
 * repo root, so the gitignored `references/prior-art/` mirror is never
 * walked (.claude/rules/references-prior-art-not-our-code-search-excludes.md).
 */

import { parseArgs } from "node:util";
import { spawnSync } from "node:child_process";
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

/**
 * A read-only `GET` request — the seed flow's git-data READS carry no body, so
 * (unlike the write builders' `{path, body}` shape) a read request is just its
 * `path`. `gh api <path>` defaults to GET, so the network slice that follows runs
 * `gh api <path>` and feeds the parsed JSON to the matching parser. This is the
 * shape `buildGetTreeRequest` returns; future ref/commit read builders return it too.
 */
export interface GitReadRequest {
  readonly path: string;
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
 * The `POST /orgs/{org}/repos` request body for the recreation-experiment repo —
 * STEP 0, run once before any git-data write (the create that the blob → tree →
 * commit → ref chain below seeds into). `name` is the new repo's name; `private`
 * is true by default because this is a throwaway experiment repo, not a published
 * artifact (caller may override); `description` carries provenance back to the
 * seeding tool. `auto_init` is always FALSE and that is LOAD-BEARING: `auto_init:
 * true` makes GitHub write an initial README commit, which would (a) break the
 * seed's root-commit path (`buildSeedCommitRequest(parentSha=null)` → `parents: []`
 * only works on a repo with no commits) and (b) report that README as `extraneous`
 * in every idempotency diff. Keeping the repo empty lets the seed flow author the
 * root commit and create the branch fresh (`buildSeedRefUpdateRequest(refExists=false)`
 * → POST). Verified against docs.github.com/en/rest/repos/repos, API version
 * 2026-03-10: `POST /orgs/{org}/repos`, `name` required, `private`/`auto_init`/
 * `description` optional. GitHub's create-repo API accepts many more optional fields
 * (`homepage`, `has_issues`, `gitignore_template`, `license_template`, …) — the seed
 * sets none, so they are intentionally unrepresented.
 */
export interface GitCreateRepoRequest {
  readonly path: string;
  readonly body: {
    readonly name: string;
    readonly private: boolean;
    readonly auto_init: false;
    readonly description: string;
  };
}

/**
 * The four fields the seeding flow reads back from a created (or pre-existing) repo —
 * the parsed result of `parseCreateRepoResponse`, which `buildCreateRepoRequest`'s
 * `POST /orgs/{org}/repos` response feeds. `fullName` (`owner/repo`) and the
 * subsequent git-data writes target it; `htmlUrl` is the browser URL the seeder
 * prints for the experiment runner (AC 4: "Outputs the repo URL for the experiment
 * runner"); `cloneUrl` is the HTTPS git URL the runner clones to start the 23-hour
 * recreation test; `defaultBranch` is the branch the final `buildSeedRefUpdateRequest`
 * points at the seed commit. GitHub's repository object carries many more fields
 * (`id`, `node_id`, `ssh_url`, `permissions`, …); the seeder reads only these four,
 * so the rest are intentionally unrepresented. Verified against
 * docs.github.com/en/rest/repos/repos, API version 2026-03-10: `POST /orgs/{org}/repos`
 * → 201 with a repository object whose `full_name`/`html_url`/`clone_url`/`default_branch`
 * are standard string fields present on every repository response.
 */
export interface GitRepoInfo {
  readonly fullName: string;
  readonly htmlUrl: string;
  readonly cloneUrl: string;
  readonly defaultBranch: string;
}

/**
 * The `POST /repos/{owner}/{repo}/git/blobs` request body for one seed file — the
 * FIRST git-data write step, run once per create/update file before the tree is
 * assembled. `content` is the file's bytes base64-encoded; `encoding` is always
 * `"base64"`. The blobs API also accepts `encoding: "utf-8"`, but seed files can be
 * binary (or carry mixed/non-UTF-8 bytes), and a `utf-8` upload would corrupt any
 * non-UTF-8 content — base64 is lossless for arbitrary bytes, so the seeder always
 * uses it (verified against docs.github.com/en/rest/git/blobs, API version
 * 2026-03-10: `content`/`encoding` body, `encoding` ∈ {`utf-8`, `base64`}, blobs up
 * to 100 MB). GitHub returns this blob's SHA, which is byte-identical to the SHA
 * `gitBlobSha` already predicts for the same bytes — so the seeding flow never has
 * to round-trip to learn it: it uploads each blob, then submits `buildSeedTreeRequest`'s
 * tree referencing those same SHAs.
 */
export interface GitBlobRequest {
  readonly content: string;
  readonly encoding: "base64";
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
 * the provenance line linking back to 081KQTPYE0008QG0R00392KABJ / 081KR2E4K0008QG0R002JW751Y so the recreation experiment's
 * history is self-documenting (AC: "commits the seed with a clear provenance message
 * linking back to 081KQTPYE0008QG0R00392KABJ"). GitHub's commit API accepts more optional fields
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

/**
 * The fields the seeding flow reads back from either git-refs endpoint after
 * `buildSeedRefUpdateRequest` runs. GitHub's create/update-ref responses share the
 * same shape: top-level `ref` names the full ref that now exists, while nested
 * `object.sha` is the commit the ref points at.
 */
export interface GitRefUpdateInfo {
  readonly ref: string;
  readonly sha: string;
}

export type GhApiMethod = "GET" | "POST" | "PATCH";

export type GhApiExecutableRequest =
  | GitReadRequest
  | GitCreateRepoRequest
  | GitRefUpdateRequest
  | {
      readonly method: "POST";
      readonly path: string;
      readonly body: unknown;
    };

export interface GhApiInvocation {
  readonly command: "gh";
  readonly args: readonly string[];
  readonly stdin: string | null;
}

export interface GhApiRunnerResult {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface GhApiRunner {
  run(command: string, args: readonly string[], stdin: string | null): GhApiRunnerResult;
}

export type GhApiJsonResult =
  | { readonly ok: true; readonly response: unknown }
  | { readonly ok: false; readonly error: string };

const MANIFEST_DISPLAY_PATH = "docs/bootstrap-razor/SEED-MANIFEST.md";
const MANIFEST_PATH = fileURLToPath(new URL("../../../docs/bootstrap-razor/SEED-MANIFEST.md", import.meta.url));
// Repo root = THREE levels up from src/Core.TypeScript/bootstrap-razor/.
// (Was `../..` when this lived at tools/bootstrap-razor/; #8050 moved the file
// one level deeper and the arithmetic was not moved with it, so both this and
// MANIFEST_PATH above resolved under `src/`.)
const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));

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

function requestMethod(request: GhApiExecutableRequest): GhApiMethod {
  if ("method" in request) return request.method;
  if ("body" in request) return "POST";
  return "GET";
}

function requestBody(request: GhApiExecutableRequest): unknown | null {
  return "body" in request ? request.body : null;
}

export function buildGhApiInvocation(request: GhApiExecutableRequest): GhApiInvocation {
  const body = requestBody(request);
  const args = ["api", "-X", requestMethod(request), request.path];
  if (body !== null) args.push("--input", "-");
  return {
    command: "gh",
    args,
    stdin: body === null ? null : `${JSON.stringify(body)}\n`,
  };
}

export function buildGhRunnerEnv(baseEnv: typeof process.env = process.env): typeof process.env {
  const pathEntries = [baseEnv.PATH, baseEnv.HOME ? `${baseEnv.HOME}/.bun/bin` : undefined]
    .flatMap((entry) => (entry ? entry.split(":") : []))
    .filter((entry, index, entries) => entry.length > 0 && entries.indexOf(entry) === index);
  return pathEntries.length === 0 ? { ...baseEnv } : { ...baseEnv, PATH: pathEntries.join(":") };
}

function spawnGhApiRunner(): GhApiRunner {
  return {
    run(command: string, args: readonly string[], stdin: string | null): GhApiRunnerResult {
      // eslint-disable-next-line sonarjs/no-os-command-from-path -- `gh` is intentionally resolved from the caller PATH; arguments are structured and never shell-expanded.
      const result = spawnSync(command, [...args], {
        input: stdin ?? undefined,
        encoding: "utf8",
        timeout: 60_000,
        maxBuffer: 32 * 1024 * 1024,
        env: buildGhRunnerEnv(),
      });
      return {
        status: result.status ?? 1,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? String(result.error ?? ""),
      };
    },
  };
}

export function runGhApiJson(
  request: GhApiExecutableRequest,
  runner: GhApiRunner = spawnGhApiRunner(),
): GhApiJsonResult {
  const invocation = buildGhApiInvocation(request);
  const result = runner.run(invocation.command, invocation.args, invocation.stdin);
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout).trim();
    return {
      ok: false,
      error: `gh api ${requestMethod(request)} ${request.path} failed (exit ${result.status})${detail ? `: ${detail}` : ""}`,
    };
  }

  try {
    return { ok: true, response: JSON.parse(result.stdout) };
  } catch {
    return { ok: false, error: `gh api ${requestMethod(request)} ${request.path} returned invalid JSON` };
  }
}

export function executeGhApiRequest<T>(
  request: GhApiExecutableRequest,
  parseResponse: (response: unknown) => T | string,
  runner: GhApiRunner = spawnGhApiRunner(),
): T | string {
  const result = runGhApiJson(request, runner);
  if (!result.ok) return result.error;
  return parseResponse(result.response);
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
export function resolveSeedFiles(candidates: readonly string[], manifest: SeedManifest): readonly string[] {
  return candidates.filter((path) => matchesAny(path, manifest.include) && !matchesAny(path, manifest.exclude)).sort();
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
export function diffSeedTree(desired: readonly SeedTreeEntry[], existing: readonly SeedTreeEntry[]): SeedTreeDiff {
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
 * Pure builder for the `GET /repos/{owner}/{repo}/git/trees/{treeSha}?recursive=1`
 * read request — the REQUEST half of the read-side pair whose RESPONSE half is
 * `parseGitTreeResponse` (the parser's own doc comment names this exact endpoint as
 * its source). The seeding flow reads the target repo's tree this way to build the
 * idempotency `existing` set: a future ref → commit read chain yields `treeSha` (the
 * tree a commit points at), this request fetches that tree, and `parseGitTreeResponse`
 * turns the response into the `{path, sha}` blobs `diffSeedTree` diffs against.
 *
 * `recursive=1` is LOAD-BEARING and the whole reason this is a builder, not an inline
 * string at the call site: WITHOUT it GitHub returns only the tree's TOP-LEVEL entries
 * (immediate children, with sub-directories as unexpanded `type: "tree"` rows), so a
 * blob nested under any directory would be absent from the parsed set and mis-diff as a
 * spurious "create" — exactly the duplicate-write `parseGitTreeResponse`'s `truncated`
 * guard also protects against. WITH it GitHub walks the whole tree and lists every blob
 * by full path, which is the only shape the path-keyed diff can consume. (Any truthy
 * value enables recursion; `1` is the documented idiom.) The recursive tree is capped at
 * 100,000 entries / 7 MB and sets `truncated: true` past that — the parser rejects a
 * truncated response, so this request and that guard compose into a safe idempotency
 * basis. Verified against docs.github.com/en/rest/git/trees, API version 2026-03-10:
 * `GET /repos/{owner}/{repo}/git/trees/{tree_sha}`, `recursive` query parameter.
 *
 * Pure: operates on its three string arguments only; no gh, no network, no filesystem.
 */
export function buildGetTreeRequest(owner: string, repo: string, treeSha: string): GitReadRequest {
  return { path: `repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1` };
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
 * The two GitHub orgs the seeder is authorized to create the recreation-experiment
 * repo in (operator authorization 2026-05-05, recorded in this row's "Authorization
 * scope": LFG or AceHack only — NOT ServiceTitan). Names are the literal GitHub org
 * slugs. This is
 * the single source of truth for `buildCreateRepoRequest`'s scope guard; widening
 * the authorization means editing this list (and re-confirming the org is one the
 * operator authorized), never bypassing the guard at a call site.
 */
const AUTHORIZED_ORGS = ["Lucent-Financial-Group", "AceHack"] as const;

/**
 * Pure builder for the experiment repo's `POST /orgs/{org}/repos` body — STEP 0 of
 * the whole seeding flow, the create that precedes the blob → tree → commit → ref
 * write chain. The org is checked against `AUTHORIZED_ORGS` FIRST: an unauthorized
 * org (anything but LFG / AceHack — most importantly ServiceTitan, named off-limits
 * in this row's authorization scope) returns an error string rather than a request,
 * so the guard is enforced at the builder, not left to a call site to remember. The
 * `T | string` return is the same convention as `readManifest` / `parseGitTreeResponse`:
 * a `string` result is the refusal reason, a `GitCreateRepoRequest` is the green light.
 *
 * `options.private` defaults to true (throwaway experiment repo, not a published
 * artifact); `options.description` defaults to a provenance line naming the seeding
 * tool. `auto_init` is hard-wired false — see `GitCreateRepoRequest` for why an
 * auto-initialized README would break the seed's root-commit + fresh-branch paths.
 * Pure: operates on its arguments only; no gh, no network, no filesystem. The network
 * slice that follows is: this request (only if it is a request, not a refusal string)
 * → `POST /git/blobs` per create file → `POST /git/trees` → `POST /git/commits` →
 * `POST /git/refs` (the new repo is empty, so the seed always takes the create-branch
 * `refExists=false` path).
 */
export function buildCreateRepoRequest(
  org: string,
  repo: string,
  options?: { readonly private?: boolean; readonly description?: string },
): GitCreateRepoRequest | string {
  if (!(AUTHORIZED_ORGS as readonly string[]).includes(org)) {
    return `unauthorized org "${org}" — seeding is scoped to ${AUTHORIZED_ORGS.join(" or ")} only (NOT ServiceTitan, per 081KR2E4K0008QG0R002JW751Y authorization scope)`;
  }
  return {
    path: `orgs/${org}/repos`,
    body: {
      name: repo,
      private: options?.private ?? true,
      auto_init: false,
      description:
        options?.description ??
        "081KQTPYE0008QG0R00392KABJ bootstrap-razor recreation test repo (seeded by tools/bootstrap-razor/seed-test-repo.ts)",
    },
  };
}

/**
 * Pure parser: the read-side pair of `buildCreateRepoRequest`, the mirror of
 * `parseGitTreeResponse`. Turns the `POST /orgs/{org}/repos` response (or an idempotent
 * re-run's `GET /repos/{owner}/{repo}`, which returns the same repository object) into
 * the `GitRepoInfo` the rest of the flow consumes — most importantly the `htmlUrl` the
 * seeder prints for the experiment runner (AC 4) and the `defaultBranch` the final ref
 * update targets. Isolating it here keeps the network slice that follows trivial: one
 * `gh api -X POST orgs/<org>/repos` + `JSON.parse` + this function.
 *
 * Returns the parsed info on success, or an error string (same `T | string` convention
 * as `parseGitTreeResponse` / `buildCreateRepoRequest`) when the response is unusable:
 *   - not an object (null, array, scalar)                 → malformed
 *   - any of full_name / html_url / clone_url /
 *     default_branch missing or non-string               → malformed (a missing URL
 *     would leave the runner with nothing to clone; a missing branch would mis-target
 *     the ref update)
 *
 * Pure: no network, no gh, no filesystem; operates only on the already-parsed JSON value.
 */
export function parseCreateRepoResponse(response: unknown): GitRepoInfo | string {
  if (typeof response !== "object" || response === null || Array.isArray(response)) {
    return "create-repo response is not an object";
  }
  const { full_name, html_url, clone_url, default_branch } = response as Record<string, unknown>;
  if (typeof full_name !== "string") return "create-repo response missing string `full_name`";
  if (typeof html_url !== "string") return "create-repo response missing string `html_url`";
  if (typeof clone_url !== "string") return "create-repo response missing string `clone_url`";
  if (typeof default_branch !== "string") return "create-repo response missing string `default_branch`";
  return { fullName: full_name, htmlUrl: html_url, cloneUrl: clone_url, defaultBranch: default_branch };
}

/**
 * Pure builder for one seed file's `POST /git/blobs` body — the FIRST git-data write
 * step, the mirror of `gitBlobSha` (which predicts the SHA the same bytes will get).
 * Base64-encodes the raw bytes and tags `encoding: "base64"` so the upload is lossless
 * for arbitrary (incl. binary) content. Uses the byte length implicitly via `Buffer`'s
 * base64 codec, so multi-byte and non-UTF-8 content survive intact. Pure: operates on
 * the given bytes only; no gh, no network, no filesystem. The network slice runs this
 * once per create/update entry from `buildSeedTreeRequest`'s plan, collecting the
 * returned SHAs (each equal to `gitBlobSha` of the same file), then submits the tree.
 */
export function buildSeedBlobRequest(content: Uint8Array): GitBlobRequest {
  return { content: Buffer.from(content).toString("base64"), encoding: "base64" };
}

/**
 * Pure parser: the read-side pair of `buildSeedBlobRequest`, the mirror of
 * `parseCreateRepoResponse` at the FIRST git-data write step. Turns GitHub's
 * `POST /repos/{owner}/{repo}/git/blobs` (201) response — `{ "url": "...", "sha": "..." }`
 * (verified against docs.github.com/en/rest/git/blobs, API version 2026-03-10) — into
 * the one field the seeding flow consumes: the blob `sha`. That SHA is the same
 * content-addressable identity `gitBlobSha` already predicts for the same bytes
 * (`buildSeedBlobRequest`'s doc comment), so the flow does not need it to LEARN the
 * SHA — it needs it to reference each uploaded blob in `buildSeedTreeRequest`'s tree
 * entries, and (a future verify slice) to confirm the server's SHA matches the
 * prediction, catching any encoding/corruption bug before the tree is assembled.
 *
 * Returns `{ sha }` on success, or an error string (same `T | string` convention as
 * `parseCreateRepoResponse` / `parseGitTreeResponse`) when the response is unusable.
 * The success type is the single-field object `{ sha }` rather than a bare string so
 * the `typeof result === "string"` test means "error" unambiguously — a bare-string
 * success would collide with the error channel. Type-check only, no SHA-format
 * validation (same restraint as `parseCreateRepoResponse`, which never format-checks
 * its URLs): a malformed SHA would surface as a 422 at the tree-create call, not here.
 *
 * Refusals:
 *   - not an object (null, array, scalar)  → malformed
 *   - `sha` missing or non-string          → malformed (a missing SHA leaves the tree
 *     entry with nothing to reference; the seed cannot proceed)
 *
 * Pure: no network, no gh, no filesystem; operates only on the already-parsed JSON value.
 */
export function parseSeedBlobResponse(response: unknown): { readonly sha: string } | string {
  if (typeof response !== "object" || response === null || Array.isArray(response)) {
    return "blob-create response is not an object";
  }
  const { sha } = response as Record<string, unknown>;
  if (typeof sha !== "string") return "blob-create response missing string `sha`";
  return { sha };
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
 * Pure parser: the read-side pair of `buildSeedTreeRequest`, one step past
 * `parseSeedBlobResponse` in the git-data write chain. Turns GitHub's
 * `POST /repos/{owner}/{repo}/git/trees` (201) response — `{ "sha": "...", "url": "...",
 * "tree": [...], "truncated": bool }` (verified against docs.github.com/en/rest/git/trees,
 * API version 2026-03-10) — into the one field the next step consumes: the NEW tree's
 * `sha`. That SHA is what `buildSeedCommitRequest`'s `treeSha` argument takes, so the
 * network slice that follows is: take this SHA → `POST /git/commits` with it → fast-forward
 * the ref. Distinct from `parseGitTreeResponse`, which parses the *read* (`GET .../git/trees/
 * <sha>?recursive=1`) into the diff's `existing` entries; this parses the *write* response
 * into the single SHA the write chain threads forward.
 *
 * Returns `{ sha }` on success, or an error string (same `T | string` convention as
 * `parseSeedBlobResponse` / `parseCreateRepoResponse`) when the response is unusable. The
 * success type is the single-field object `{ sha }` rather than a bare string so the
 * `typeof result === "string"` test means "error" unambiguously — a bare-string success
 * would collide with the error channel. Type-check only, no SHA-format validation (same
 * restraint as `parseSeedBlobResponse`): a malformed SHA would surface as a 422 at the
 * commit-create call, not here.
 *
 * Refusals:
 *   - not an object (null, array, scalar)  → malformed
 *   - `truncated: true`                    → the tree we submitted exceeded GitHub's max
 *     entry limit, so the CREATED tree object is incomplete — a commit built on it would
 *     be missing seed files. Rejected loudly rather than committing a partial seed. (Same
 *     refusal as `parseGitTreeResponse`, opposite rationale: there a truncated READ would
 *     mis-diff a missing path as a "create"; here a truncated WRITE means the seed itself
 *     is short.)
 *   - `sha` missing or non-string          → malformed (the commit step has no tree to
 *     reference; the seed cannot proceed)
 *
 * Pure: no network, no gh, no filesystem; operates only on the already-parsed JSON value.
 */
export function parseSeedTreeResponse(response: unknown): { readonly sha: string } | string {
  if (typeof response !== "object" || response === null || Array.isArray(response)) {
    return "tree-create response is not an object";
  }
  const { sha, truncated } = response as Record<string, unknown>;
  if (truncated === true) {
    return "tree-create response is truncated — submitted tree exceeded the entry limit, created tree is incomplete";
  }
  if (typeof sha !== "string") return "tree-create response missing string `sha`";
  return { sha };
}

/**
 * The provenance commit message for the seed (AC: "clear provenance message linking
 * back to 081KQTPYE0008QG0R00392KABJ"). A conventional-commit subject naming the file count, then a body
 * citing the seed manifest as the source-of-truth and the 081KQTPYE0008QG0R00392KABJ parent / 081KR2E4K0008QG0R002JW751Y slice
 * lineage. Pure: a string function of the file count only. `fileCount` pluralizes the
 * subject ("1 file" vs "N files"); it is the count of files the seed WRITES (the diff's
 * create + update entries), so a re-seed that touches one file reads naturally. The
 * idempotent path never reaches a commit at all (`buildSeedTreeRequest` returns the
 * empty plan), so this is only ever called with `fileCount >= 1`.
 */
export function seedCommitMessage(fileCount: number): string {
  const noun = fileCount === 1 ? "file" : "files";
  return [
    `chore(081KR2E4K0008QG0R002JW751Y): seed bootstrap-razor recreation test repo (${fileCount} ${noun})`,
    "",
    `Seeded from ${MANIFEST_DISPLAY_PATH} per 081KQTPYE0008QG0R00392KABJ AC 1`,
    "(bootstrap razor + 23-hour recreation test).",
    "",
    "Parent: 081KQTPYE0008QG0R00392KABJ",
    "Slice:  081KR2E4K0008QG0R002JW751Y",
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
export function buildSeedCommitRequest(treeSha: string, parentSha: string | null, fileCount: number): GitCommitRequest {
  return {
    message: seedCommitMessage(fileCount),
    tree: treeSha,
    parents: parentSha === null ? [] : [parentSha],
  };
}

/**
 * Pure parser: the read-side pair of `buildSeedCommitRequest`, one step past
 * `parseSeedTreeResponse` in the git-data write chain. Turns GitHub's
 * `POST /repos/{owner}/{repo}/git/commits` (201) response — `{ "sha": "...", "tree":
 * { "sha": "...", "url": "..." }, "parents": [...], "message": "...", ... }` (verified
 * against docs.github.com/en/rest/git/commits, API version 2026-03-10) — into the one
 * field the final step consumes: the NEW commit's top-level `sha`. That SHA is what
 * `buildSeedRefUpdateRequest`'s `commitSha` argument takes, so the network slice that
 * follows is the last link: take this SHA → `POST`/`PATCH /git/refs` to point the seed
 * branch at it.
 *
 * Returns `{ sha }` on success, or an error string (same `T | string` convention as
 * `parseSeedTreeResponse` / `parseSeedBlobResponse` / `parseCreateRepoResponse`) when
 * the response is unusable. The success type is the single-field object `{ sha }`
 * rather than a bare string so `typeof result === "string"` means "error"
 * unambiguously — a bare-string success would collide with the error channel. The
 * top-level `sha` is read, NOT the nested `tree.sha`: the ref must point at the COMMIT,
 * and pointing it at the tree SHA would yield a ref to a non-commit object (a `git
 * update-ref` to a tree is malformed). Type-check only, no SHA-format validation (same
 * restraint as `parseSeedTreeResponse`): a malformed SHA would surface as a 422 at the
 * ref-update call, not here.
 *
 * Refusals:
 *   - not an object (null, array, scalar)  → malformed
 *   - `sha` missing or non-string          → malformed (the ref step has no commit to
 *     reference; the seed cannot proceed)
 *
 * Distinct from `parseSeedTreeResponse`, which has a `truncated: true` refusal: the
 * commits API returns no `truncated` field (a commit references exactly one tree, so
 * there is nothing to truncate), so that refusal is intentionally absent here.
 *
 * Pure: no network, no gh, no filesystem; operates only on the already-parsed JSON value.
 */
export function parseSeedCommitResponse(response: unknown): { readonly sha: string } | string {
  if (typeof response !== "object" || response === null || Array.isArray(response)) {
    return "commit-create response is not an object";
  }
  const { sha } = response as Record<string, unknown>;
  if (typeof sha !== "string") return "commit-create response missing string `sha`";
  return { sha };
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
 * Pure parser: the read-side pair of `buildSeedRefUpdateRequest`, the final response
 * parser in the git-data write chain. Turns GitHub's shared `POST /git/refs` and
 * `PATCH /git/refs/heads/<branch>` response shape — `{ "ref": "refs/heads/main",
 * "object": { "type": "commit", "sha": "..." }, ... }` (verified against
 * docs.github.com/en/rest/git/refs, API version 2022-11-28) — into the two fields the
 * seeding flow needs to report and verify: the full `ref` and the pointed-at commit
 * `sha`. The `sha` is intentionally read from `object.sha`, NOT a top-level field:
 * refs responses do not make the target object's SHA top-level, and a parser that did
 * so would silently lose the final commit identity.
 *
 * Returns `{ ref, sha }` on success, or an error string (same `T | string` convention
 * as the other response parsers) when the response is unusable. Type-check only, no
 * SHA-format or `object.type` validation: the preceding commit-create/ref-update calls
 * already enforce object existence and commit-ness server-side, and a malformed target
 * would surface as a GitHub API error before this parser runs.
 *
 * Refusals:
 *   - not an object (null, array, scalar)  -> malformed
 *   - `ref` missing or non-string          -> malformed (no branch to report)
 *   - `object` missing or non-object       -> malformed (no target object)
 *   - `object.sha` missing or non-string   -> malformed (no final commit to report)
 *
 * Pure: no network, no gh, no filesystem; operates only on the already-parsed JSON value.
 */
export function parseSeedRefUpdateResponse(response: unknown): GitRefUpdateInfo | string {
  if (typeof response !== "object" || response === null || Array.isArray(response)) {
    return "ref-update response is not an object";
  }
  const { ref, object } = response as Record<string, unknown>;
  if (typeof ref !== "string") return "ref-update response missing string `ref`";
  if (typeof object !== "object" || object === null || Array.isArray(object)) {
    return "ref-update response missing object field `object`";
  }
  const { sha } = object as Record<string, unknown>;
  if (typeof sha !== "string") return "ref-update response missing string `object.sha`";
  return { ref, sha };
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
  console.log(`[081KR2E4K0008QG0R002JW751Y] DRY-RUN: read ${MANIFEST_DISPLAY_PATH}`);
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

  // Step 1 of the git-data write chain: each create/update file is uploaded as a
  // base64 blob via `POST /git/blobs` BEFORE the tree references its SHA. For a fresh
  // repo that is every resolved file; an idempotent re-seed uploads nothing. Showing
  // the per-blob base64 size makes the upload cost visible without performing it.
  console.log(`POST /git/blobs uploads for a fresh repo (${freshRepoPlan.length} blobs, base64):`);
  for (const { path } of freshRepoPlan) {
    const blob = buildSeedBlobRequest(readFileSync(join(root, path)));
    console.log(`  ${blob.encoding} ${blob.content.length}b  ${path}`);
  }

  console.log(`POST /git/trees write plan for a fresh repo (${freshRepoPlan.length} entries):`);
  for (const { mode, type, sha, path } of freshRepoPlan) {
    console.log(`  ${mode} ${type} ${sha}  ${path}`);
  }

  console.log("Provenance commit would link to 081KQTPYE0008QG0R00392KABJ / 081KR2E4K0008QG0R002JW751Y.");

  // Step 0 of the flow: create the empty experiment repo (AC 1). Shown here for an
  // EXAMPLE authorized org/repo — `--dry-run` performs no creation (AC 4). The scope
  // guard refuses any org but LFG / AceHack, so the off-limits ServiceTitan case is
  // demonstrated alongside the authorized one to make the authorization scope visible.
  const exampleOrg = AUTHORIZED_ORGS[0];
  const createReq = buildCreateRepoRequest(exampleOrg, "zeta-recreation-experiment");
  if (typeof createReq === "string") {
    console.log(`POST /orgs create plan: REFUSED — ${createReq}`);
  } else {
    console.log(`POST /${createReq.path} create plan (example, no creation performed):`);
    console.log(
      `  name=${createReq.body.name} private=${createReq.body.private} auto_init=${createReq.body.auto_init}`,
    );
  }
  const refused = buildCreateRepoRequest("ServiceTitan", "zeta-recreation-experiment");
  console.log(
    `Authorization scope guard (ServiceTitan): ${
      typeof refused === "string" ? `REFUSED — ${refused}` : "ALLOWED (BUG — should be refused)"
    }`,
  );

  console.log("gh network integration (real create + seed + commit): follow-up slice.");
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

  console.log("This is the minimal TS stub for 081KR2E4K0008QG0R002JW751Y.");
  console.log("Re-run with --dry-run to see the manifest seed plan.");
  console.log("No repo creation performed (bounded slice).");
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
