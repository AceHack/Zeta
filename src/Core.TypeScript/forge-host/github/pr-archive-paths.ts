/**
 * pr-archive-paths.ts — where a PR-review archive body lives, and how to find one
 * that was cited at its old address.
 *
 * 081M28KF7P5087G0R00046KB5M.
 *
 * THE PROBLEM
 * -----------
 * `docs/history/pr-reviews/` was ONE FLAT DIRECTORY holding **14,378** archive bodies
 * (93 MB) and growing. Its sibling index, `docs/github/prs/shards/`, indexes the same
 * 14,378 PRs and has been bucketed since 2026-08-13 at ~660–820 files per directory.
 * Same corpus, one bucketed and one not.
 *
 * Aaron, 2026-09-06: *"one per pr would be best, and they can be in dated folders so we
 * don't end up with too many files in one folder"* and *"we rarely want to add more than
 * one directory per day on a cadence too."*
 *
 * So: **one file per PR stays** — that part was right. Only the directory changes.
 *
 * WHY DAILY (`YYYY/MM/DD/`) AND NOT MONTHLY — MEASURED, NOT ASSUMED
 * -----------------------------------------------------------------
 * Monthly looks right if you extrapolate from the current ~25 merged PRs/day: 750/dir,
 * which matches the shard convention. That extrapolation is WRONG for this corpus. The
 * actual `merged_at` distribution over all 14,378 shards, measured 2026-09-11:
 *
 * | layout            | dirs | median/dir | p90/dir | **max/dir** |
 * |-------------------|-----:|-----------:|--------:|------------:|
 * | monthly `YYYY/MM` |    6 |      2,703 |       — |   **4,871** |
 * | weekly            |   22 |        573 |   1,231 |   **2,077** |
 * | **daily `YYYY/MM/DD`** | **119** | **93** | **265** | **522** |
 *
 * Monthly would land 4,871 files in `2026/08/` — six times the fan-out of the sibling
 * store this change exists to match, and worse than the flat directory is at its own
 * busiest month. The repo's merge rate is not 25/day; it peaked at **522 merges in one
 * day** (2026-08-17). Daily is the only one of the three whose worst directory (522)
 * stays under the shard store's own bucket ceiling (≤1000, observed 660–820).
 *
 * Daily also satisfies Aaron's cadence constraint *by construction* rather than by
 * argument: a layout keyed to the day creates **exactly one new directory per day**, and
 * cannot create two. Monthly satisfies it more loosely; per-PR or per-hour would violate
 * it. And because the buckets nest, no level ever fans out far: `YYYY/` holds 12, `MM/`
 * holds ≤31, `DD/` holds the records.
 *
 * WHY `merged_at` AND NOT THE ARCHIVE-RUN DATE
 * ---------------------------------------------
 * The archive can be backfilled — `backfill-pr-archive.ts` exists precisely to re-archive
 * old PRs — so bucketing by when we happened to write the file would scatter one PR's
 * neighbours across whatever days the backfill ran on, and a re-run would move records
 * that did not change. `merged_at` is a property of the PR, is already carried in every
 * shard, and never changes once set.
 *
 * THE PATH-INSTABILITY OBJECTION, ANSWERED
 * -----------------------------------------
 * `pr-manifest-shards.ts` rejects date-derived paths for the SHARD, and is right to:
 *
 * > *"`merged_at` is `null` for a PR archived while OPEN (PR #1702) and becomes non-null
 * > when that PR later merges — so the id, and therefore the path, would MOVE, and the
 * > same PR would end up with two shards. An identity that changes when the substrate
 * > updates is not an identity."*
 *
 * That argument is decisive **for a key** and does not carry to a **body**. The shard's
 * path IS its identity — nothing records it, so a move forks the record. The body's path
 * is *recorded*, in the shard's own `archive_path` field, so a move is an upsert of one
 * field rather than a fork. The shard stays number-keyed and immovable; the body moves
 * once, and the shard is corrected in the same change.
 *
 * The one case that moves is handled explicitly rather than guessed at: a record with no
 * `merged_at` goes to {@link UNDATED_BUCKET} — a named bucket, not a silently-picked date
 * — and relocates exactly once if and when the PR merges and is re-archived. Guessing a
 * date for an unmerged PR would be the worse failure: it looks dated and is fiction.
 *
 * THE READ BOUNDARY
 * -----------------
 * Append-only ledgers and prose cite the OLD flat paths and must not be rewritten
 * (`.claude/rules/preservation-has-one-namespace-per-kind.md`; the carved remedy for a
 * moved file cited by an append-only record is to **translate at the read boundary**).
 * {@link resolveArchivePath} is that translation: it takes any cited path — flat or
 * bucketed, current or stale — and answers where the bytes are now, in O(1), by reading
 * the PR's shard. No directory scan, no index rebuild.
 *
 * Beacon anchors: Linstedt & Olschimke, *Building a Scalable Data Warehouse with Data
 * Vault 2.0* — hub/link/satellite partitioned by change rate; the archive is a pure
 * satellite and the date is its natural partition key. Shapiro, Preguiça, Baquero &
 * Zawirski, *Conflict-free Replicated Data Types* (INRIA RR-7687, 2011) — one file per PR
 * under a writer-disjoint path keeps the merge a set union, which the bucketing preserves
 * exactly (a bucket is a prefix, not a shared file).
 */

import { readdirSync, type Dirent } from "node:fs";

import { readFileBounded, type Result } from "../../io/safe-io.ts";
import { ordinalCompare, shardPathFor, type ManifestEntry } from "./pr-manifest-shards.ts";

/** The archive root. Unchanged — only what lives beneath it changes. */
export const ARCHIVE_ROOT_RELATIVE = "docs/history/pr-reviews";

/**
 * Where a record with no usable `merged_at` lands.
 *
 * NOT a guessed date. A PR archived while still OPEN has `merged_at: null` (PR #1702 is
 * the live instance), and inventing a bucket for it would produce a path that asserts a
 * merge date the record does not have. The bucket is named for what is true about the
 * record — that it is not dated — and `bucketFor` reports the reason alongside it.
 */
export const UNDATED_BUCKET = "undated";

/** Files under the archive root that are NOT archive bodies and must never be bucketed. */
export const ARCHIVE_ROOT_EXEMPT_FILES: readonly string[] = ["README.md"];

/** `PR-<number>-<slug>.md`. The `<slug>` may be empty for a title that slugifies to nothing. */
const ARCHIVE_FILENAME_RE = /^PR-(\d+)(?:-[^/]*)?\.md$/;

/**
 * A full ISO-8601 UTC instant, matched STRUCTURALLY rather than parsed with `new Date`.
 *
 * `new Date("2026-08")` succeeds and yields a January-adjacent instant in some engines;
 * `Date` also drags in host timezone behaviour that a bucket key must never depend on
 * (`.claude/rules/local-time-never-enters-the-shared-fold.md` — a local clock must not
 * steer a shared, replayed result). Slicing a validated string is culture-free, clock-free
 * and DST-replayable: the same `merged_at` yields the same bucket on every machine forever.
 *
 * The day range is checked as digits only; `2026-02-31` would pass. That is deliberate —
 * this is a partition key, not a calendar. A nonexistent day would still bucket
 * deterministically and hurt nothing, whereas a calendar-aware check would add a second
 * notion of "valid date" that the shard store does not share.
 */
const ISO_INSTANT_RE = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T/;

export interface BucketDecision {
  /** Repo-relative directory beneath {@link ARCHIVE_ROOT_RELATIVE}, `/`-separated. */
  readonly bucket: string;
  /** True when the bucket was derived from a real `merged_at`. */
  readonly dated: boolean;
  /** Why this bucket — always populated, so an undated record is never silent. */
  readonly reason: string;
}

/**
 * The bucket for one record, from its `merged_at`.
 *
 * TOTAL: every input produces a bucket. There is no throw and no `null`, because the
 * caller is always placing a real file somewhere and "I could not decide" would leave the
 * record homeless — which is how records get dropped during a migration.
 */
export function bucketFor(mergedAt: string | null | undefined): BucketDecision {
  if (typeof mergedAt !== "string") {
    return {
      bucket: UNDATED_BUCKET,
      dated: false,
      reason: `merged_at is ${mergedAt === null ? "null" : typeof mergedAt} — the PR was archived before it merged`,
    };
  }
  const m = ISO_INSTANT_RE.exec(mergedAt);
  if (m === null) {
    return {
      bucket: UNDATED_BUCKET,
      dated: false,
      reason: `merged_at ${JSON.stringify(mergedAt)} is not an ISO-8601 UTC instant`,
    };
  }
  return {
    bucket: `${m[1]}/${m[2]}/${m[3]}`,
    dated: true,
    reason: `merged_at ${mergedAt}`,
  };
}

/**
 * The repo-relative path a record with this filename and `merged_at` belongs at.
 *
 * Takes the FILENAME rather than the title, so a migration moves bytes without
 * re-slugifying. Re-deriving the slug during a move would silently rename any record whose
 * title contains characters the slugifier has since learned to treat differently — a
 * rename dressed as a move, and undetectable in a 14,378-file diff.
 */
export function archiveRelPathForFile(fileName: string, mergedAt: string | null | undefined): string {
  return `${ARCHIVE_ROOT_RELATIVE}/${bucketFor(mergedAt).bucket}/${fileName}`;
}

/** `PR-17275-foo.md` -> `17275`. Any other shape -> `null`. */
export function prNumberOfArchiveFileName(fileName: string): number | null {
  const m = ARCHIVE_FILENAME_RE.exec(fileName);
  if (m === null) return null;
  const n = Number.parseInt(m[1] ?? "", 10);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/**
 * Every archive body beneath `dirAbs`, as paths relative to it, in ordinal order.
 *
 * REPLACES the flat `readdirSync(dir)` that four consumers used. A flat read over a
 * bucketed tree returns the year directories and zero `.md` files, and every one of those
 * consumers would then report "no archives found" as a SUCCESS — a check that cannot fail,
 * arrived at by leaving a directory read unchanged. That is why this is a shared export
 * rather than four local walks.
 *
 * Tolerates the flat layout unchanged, so it is correct before, during and after the
 * migration. `README.md` and anything else in {@link ARCHIVE_ROOT_EXEMPT_FILES} is skipped
 * at the root only — a file of that name inside a bucket would be a real archive-shaped
 * path and is left to the filename check.
 */
export function walkArchiveDocs(dirAbs: string): string[] {
  const out: string[] = [];
  const visit = (absDir: string, relPrefix: string): void => {
    let raw: Dirent[];
    try {
      raw = readdirSync(absDir, { withFileTypes: true });
    } catch {
      // A directory that vanished mid-walk contributes nothing. The caller's own
      // existence check on the root is what distinguishes "empty" from "absent".
      return;
    }
    const entries = [...raw].sort((a, b) => ordinalCompare(a.name, b.name));
    for (const entry of entries) {
      const name = entry.name;
      const rel = relPrefix === "" ? name : `${relPrefix}/${name}`;
      if (entry.isDirectory()) {
        visit(`${absDir}/${name}`, rel);
        continue;
      }
      if (relPrefix === "" && ARCHIVE_ROOT_EXEMPT_FILES.includes(name)) continue;
      if (!name.endsWith(".md")) continue;
      out.push(rel);
    }
  };
  visit(dirAbs, "");
  return out;
}

export type ResolveFailure =
  | { readonly kind: "not-an-archive-path"; readonly message: string }
  | { readonly kind: "shard-missing"; readonly message: string }
  | { readonly kind: "shard-unreadable"; readonly message: string };

export interface ResolvedArchivePath {
  /** Repo-relative path where the bytes actually live now. */
  readonly path: string;
  /** True when the cited path was already correct. */
  readonly unchanged: boolean;
}

/**
 * Translate a cited archive path — flat, bucketed, current or years stale — into where the
 * bytes live now.
 *
 * THIS IS THE READ-BOUNDARY TRANSLATION, and it is the reason no ledger needs rewriting.
 * `db/mutation-findings/*.jsonl` and friends are append-only; a migration that edited them
 * to keep their paths valid would be falsifying the record to protect a link. Instead the
 * record keeps saying what it said, and readers come through here.
 *
 * O(1): the shard path is a pure function of the PR number
 * (`pr-manifest-shards.ts` — the number is the ZetaId's randomness field), so this is one
 * file read, never a scan of 14,378 entries.
 *
 * Read-then-interpret-ENOENT throughout: no `existsSync` probe, so there is no window
 * between the check and the use (`js/file-system-race`).
 */
export function resolveArchivePath(
  repoRoot: string,
  citedPath: string,
): Result<ResolvedArchivePath, ResolveFailure> {
  const normalized = citedPath.split("\\").join("/").replace(/^\.\//, "");
  const prefix = `${ARCHIVE_ROOT_RELATIVE}/`;
  if (!normalized.startsWith(prefix)) {
    return {
      ok: false,
      error: { kind: "not-an-archive-path", message: `${citedPath} is not under ${ARCHIVE_ROOT_RELATIVE}/` },
    };
  }
  const fileName = normalized.slice(normalized.lastIndexOf("/") + 1);
  const prNumber = prNumberOfArchiveFileName(fileName);
  if (prNumber === null) {
    return {
      ok: false,
      error: { kind: "not-an-archive-path", message: `${fileName} is not a PR-<number>-<slug>.md archive body` },
    };
  }

  const shardAbs = shardPathFor(prNumber, `${repoRoot}/${"docs/github/prs/shards"}`);
  const read = readFileBounded(shardAbs, { maxBytes: 8 * 1024 * 1024 });
  if (!read.ok) {
    const kind = read.error.kind === "not-found" ? "shard-missing" : "shard-unreadable";
    return {
      ok: false,
      error: { kind, message: `PR #${String(prNumber)}: cannot read its shard (${read.error.message})` },
    };
  }
  let entry: ManifestEntry;
  try {
    entry = JSON.parse(read.value.text) as ManifestEntry;
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: "shard-unreadable",
        message: `PR #${String(prNumber)}: shard is not JSON (${err instanceof Error ? err.message : String(err)})`,
      },
    };
  }
  const actual = typeof entry.archive_path === "string" ? entry.archive_path : "";
  if (actual === "") {
    return {
      ok: false,
      error: { kind: "shard-unreadable", message: `PR #${String(prNumber)}: shard carries no archive_path` },
    };
  }
  return { ok: true, value: { path: actual, unchanged: actual === normalized } };
}
