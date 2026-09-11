/**
 * pr-archive-paths.test.ts — falsifiers for the dated-bucket layout.
 *
 * 081M28KF7P5087G0R00046KB5M. Three things are pinned here, and each one fails a
 * specific mutation rather than merely exercising the code:
 *
 *   1. THE PATH BUILDER puts a record under its `merged_at` day. Mutate the bucket to the
 *      month and §"daily, not monthly" fails; mutate it to the wall clock and §"the bucket
 *      is the PR's date, never today's" fails.
 *   2. THE RESOLVER turns a LEGACY FLAT citation into the record's current home. This is
 *      the promise made to the append-only ledgers — that nothing has to be rewritten — so
 *      it is the test that says the promise is kept.
 *   3. A RECORD WITH NO `merged_at` IS HANDLED EXPLICITLY. Not silently dropped, and not
 *      silently given a guessed date: it lands in a NAMED bucket and carries a reason.
 *      This is the falsifier the migration's "nothing is lost" claim rests on.
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  ARCHIVE_ROOT_RELATIVE,
  UNDATED_BUCKET,
  archiveRelPathForFile,
  bucketFor,
  prNumberOfArchiveFileName,
  resolveArchivePath,
  walkArchiveDocs,
} from "./pr-archive-paths.ts";
import { SHARD_ROOT_RELATIVE, serializeShard, shardPathFor, type ManifestEntry } from "./pr-manifest-shards.ts";

function entry(pr: number, archivePath: string, mergedAt: string | null): ManifestEntry {
  return {
    pr_number: pr,
    archive_path: archivePath,
    source_ids: [],
    fetched_at: "2026-09-11T00:00:00.000Z",
    schema_version: "v1",
    commit_sha: "0".repeat(40),
    title: "t",
    state: mergedAt === null ? "OPEN" : "MERGED",
    merged_at: mergedAt,
    head_ref: "h",
  };
}

/** A throwaway repo root carrying one shard per supplied entry. */
function scratchRepo(entries: readonly ManifestEntry[]): string {
  const root = mkdtempSync(join(tmpdir(), "pr-archive-paths-"));
  for (const e of entries) {
    const p = shardPathFor(e.pr_number, join(root, SHARD_ROOT_RELATIVE));
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, serializeShard(e));
  }
  return root;
}

describe("bucketFor — daily, from merged_at, never from the clock", () => {
  test("a merged record buckets to its own YYYY/MM/DD", () => {
    const d = bucketFor("2026-08-17T04:04:25Z");
    expect(d.bucket).toBe("2026/08/17");
    expect(d.dated).toBe(true);
  });

  test("DAILY, NOT MONTHLY — the day component is present and load-bearing", () => {
    // The mutation this kills: `${y}/${m}` instead of `${y}/${m}/${d}`. Monthly was the
    // obvious choice and the measurement refuted it (4,871 files in 2026-08 vs 522 on the
    // busiest single day), so the day segment is pinned rather than assumed.
    expect(bucketFor("2026-08-17T04:04:25Z").bucket.split("/")).toHaveLength(3);
    // Two PRs merged in the same MONTH but on different DAYS must not share a directory.
    expect(bucketFor("2026-08-01T00:00:00Z").bucket).not.toBe(bucketFor("2026-08-31T23:59:59Z").bucket);
  });

  test("THE BUCKET IS THE PR'S DATE, NEVER TODAY'S", () => {
    // A backfill re-archiving a 2026-04 PR today must still write it under 2026/04.
    // The mutation this kills: reaching for `new Date()` because `merged_at` was to hand.
    const today = new Date().toISOString().slice(0, 10).split("-").join("/");
    const bucket = bucketFor("2026-04-12T09:00:00Z").bucket;
    expect(bucket).toBe("2026/04/12");
    expect(bucket).not.toBe(today);
  });

  test("the bucket does not depend on the host timezone", () => {
    // An instant late in the UTC day is the case where a local-time conversion would
    // silently shift the bucket by one — the leak `local-time-never-enters-the-shared-fold`
    // forbids. The key is sliced from the UTC string, so it cannot move.
    expect(bucketFor("2026-08-17T23:59:59Z").bucket).toBe("2026/08/17");
    expect(bucketFor("2026-08-17T00:00:00Z").bucket).toBe("2026/08/17");
  });

  test("archiveRelPathForFile composes root + bucket + the EXISTING filename", () => {
    expect(archiveRelPathForFile("PR-15186-skip-review.md", "2026-08-25T04:04:25Z")).toBe(
      `${ARCHIVE_ROOT_RELATIVE}/2026/08/25/PR-15186-skip-review.md`,
    );
  });
});

describe("no merged_at is handled EXPLICITLY, never silently", () => {
  // The falsifier for the migration's "nothing is dropped" claim. PR #1702 is the live
  // instance: archived while OPEN, so `merged_at` is null.
  test("a null merged_at lands in a NAMED bucket and is not dated", () => {
    const d = bucketFor(null);
    expect(d.bucket).toBe(UNDATED_BUCKET);
    expect(d.dated).toBe(false);
  });

  test("it carries a REASON — an undated record can never be silent", () => {
    // Mutation killed: returning a bare string instead of a decision, which would make the
    // undated case indistinguishable from a dated one at every call site.
    expect(bucketFor(null).reason).toContain("null");
    expect(bucketFor(undefined).reason.length).toBeGreaterThan(0);
    expect(bucketFor("").reason).toContain("ISO-8601");
  });

  test("a malformed merged_at is undated, NOT half-parsed into a wrong bucket", () => {
    // `"2026-08"` is the dangerous input: `new Date` accepts it and a naive slice would
    // produce `2026/08/un`. Structural matching refuses it outright.
    for (const bad of ["2026-08", "not-a-date", "2026-13-01T00:00:00Z", "2026-08-32T00:00:00Z"]) {
      const d = bucketFor(bad);
      expect(d.bucket).toBe(UNDATED_BUCKET);
      expect(d.dated).toBe(false);
    }
  });

  test("bucketFor is TOTAL — no input leaves a record homeless", () => {
    for (const v of [null, undefined, "", "x", "2026-08-17T04:04:25Z"]) {
      expect(bucketFor(v).bucket.length).toBeGreaterThan(0);
    }
  });
});

describe("resolveArchivePath — the read boundary for append-only citations", () => {
  test("A LEGACY FLAT PATH RESOLVES TO THE BUCKETED ONE", () => {
    // THE CENTRAL PROMISE. `db/` ledgers and prose cite the flat path and are never
    // rewritten; this is what makes that safe.
    const bucketed = `${ARCHIVE_ROOT_RELATIVE}/2026/06/21/PR-7242-feat-chip8observer.md`;
    const root = scratchRepo([entry(7242, bucketed, "2026-06-21T10:00:00Z")]);
    try {
      const r = resolveArchivePath(root, `${ARCHIVE_ROOT_RELATIVE}/PR-7242-feat-chip8observer.md`);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value.path).toBe(bucketed);
      expect(r.value.unchanged).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("resolution is by PR NUMBER, so a stale SLUG still resolves", () => {
    // A retitled PR changes its slug. The number is the key, so the old citation holds.
    const bucketed = `${ARCHIVE_ROOT_RELATIVE}/2026/06/21/PR-7242-the-new-title.md`;
    const root = scratchRepo([entry(7242, bucketed, "2026-06-21T10:00:00Z")]);
    try {
      const r = resolveArchivePath(root, `${ARCHIVE_ROOT_RELATIVE}/PR-7242-a-completely-different-old-slug.md`);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.path).toBe(bucketed);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("an already-correct citation reports unchanged", () => {
    const bucketed = `${ARCHIVE_ROOT_RELATIVE}/2026/06/21/PR-7242-x.md`;
    const root = scratchRepo([entry(7242, bucketed, "2026-06-21T10:00:00Z")]);
    try {
      const r = resolveArchivePath(root, bucketed);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.unchanged).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a PR with no shard FAILS LOUDLY — it does not fall back to the cited path", () => {
    // The tempting silent failure: hand back the input when lookup fails. The caller then
    // reads a path that does not exist and cannot tell why. `shard-missing` says which PR.
    const root = scratchRepo([]);
    try {
      const r = resolveArchivePath(root, `${ARCHIVE_ROOT_RELATIVE}/PR-999999-nope.md`);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.kind).toBe("shard-missing");
        expect(r.error.message).toContain("999999");
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a path outside the archive root is refused, not silently resolved", () => {
    const root = scratchRepo([]);
    try {
      const r = resolveArchivePath(root, "docs/github/prs/manifest.jsonl");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.kind).toBe("not-an-archive-path");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a non-archive filename under the root is refused", () => {
    const root = scratchRepo([]);
    try {
      const r = resolveArchivePath(root, `${ARCHIVE_ROOT_RELATIVE}/README.md`);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.kind).toBe("not-an-archive-path");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("prNumberOfArchiveFileName", () => {
  test("reads the number back out", () => {
    expect(prNumberOfArchiveFileName("PR-17275-a-slug.md")).toBe(17275);
    expect(prNumberOfArchiveFileName("PR-1.md")).toBe(1);
  });

  test("refuses anything that is not an archive body", () => {
    for (const n of ["README.md", "PR-.md", "PR-abc-x.md", "notes.txt", "PR-12-x.markdown"]) {
      expect(prNumberOfArchiveFileName(n)).toBeNull();
    }
  });
});

describe("walkArchiveDocs — the flat-read defect this replaces", () => {
  test("FINDS RECORDS NESTED IN BUCKETS — a flat readdir finds ZERO", () => {
    // This is the whole reason the walker is shared. Four consumers did `readdirSync(dir)`
    // and filtered for `.md`; against a bucketed tree that yields the empty set, and each
    // one reports "no archives" as a clean pass — a check that cannot fail.
    const root = mkdtempSync(join(tmpdir(), "walk-"));
    try {
      mkdirSync(join(root, "2026", "08", "17"), { recursive: true });
      mkdirSync(join(root, "2026", "09", "11"), { recursive: true });
      writeFileSync(join(root, "2026", "08", "17", "PR-1-a.md"), "x");
      writeFileSync(join(root, "2026", "09", "11", "PR-2-b.md"), "x");
      const found = walkArchiveDocs(root);
      expect(found).toEqual(["2026/08/17/PR-1-a.md", "2026/09/11/PR-2-b.md"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("still finds a FLAT record — correct before, during and after the migration", () => {
    const root = mkdtempSync(join(tmpdir(), "walk-"));
    try {
      writeFileSync(join(root, "PR-3-c.md"), "x");
      mkdirSync(join(root, "2026", "08", "17"), { recursive: true });
      writeFileSync(join(root, "2026", "08", "17", "PR-1-a.md"), "x");
      expect(walkArchiveDocs(root).sort()).toEqual(["2026/08/17/PR-1-a.md", "PR-3-c.md"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("skips README.md at the root and non-markdown files", () => {
    const root = mkdtempSync(join(tmpdir(), "walk-"));
    try {
      writeFileSync(join(root, "README.md"), "x");
      writeFileSync(join(root, "notes.txt"), "x");
      writeFileSync(join(root, "PR-4-d.md"), "x");
      expect(walkArchiveDocs(root)).toEqual(["PR-4-d.md"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("an absent directory yields an empty list rather than throwing", () => {
    expect(walkArchiveDocs(join(tmpdir(), "definitely-not-here-8f3a2c"))).toEqual([]);
  });
});
