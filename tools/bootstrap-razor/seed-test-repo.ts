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
