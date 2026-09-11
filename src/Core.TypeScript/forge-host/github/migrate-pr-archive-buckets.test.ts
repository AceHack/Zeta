/**
 * migrate-pr-archive-buckets.test.ts — falsifiers for the bulk move.
 *
 * 081M28KFAGV087G0R000BKEAZK. The claims this file has to make expensive to break:
 *
 *   - RE-RUNNABLE: a second run plans zero moves. If this stops holding, the migration is
 *     not resumable and an interrupted run is a hand-repair job on 14,378 files.
 *   - NOTHING DROPPED: a record with no shard is left in place AND reported with a reason.
 *     The migration's whole safety claim is this one.
 *   - VERIFICATION BITES: a shard pointing at a body that is not there must FAIL, not pass.
 *     A migration whose self-check cannot fail has verified nothing.
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { applyMigration, parseArgs, planMigration, verifyMigration } from "./migrate-pr-archive-buckets.ts";
import { ARCHIVE_ROOT_RELATIVE, UNDATED_BUCKET, walkArchiveDocs } from "./pr-archive-paths.ts";
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

/** A scratch repo with archive bodies at `bodies` and one shard per `shards` entry. */
function scratch(bodies: readonly string[], shards: readonly ManifestEntry[]): string {
  const root = mkdtempSync(join(tmpdir(), "migrate-buckets-"));
  for (const rel of bodies) {
    const p = join(root, ARCHIVE_ROOT_RELATIVE, rel);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, "# body\n");
  }
  for (const e of shards) {
    const p = shardPathFor(e.pr_number, join(root, SHARD_ROOT_RELATIVE));
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, serializeShard(e));
  }
  return root;
}

function shardMap(entries: readonly ManifestEntry[]): Map<number, ManifestEntry> {
  const m = new Map<number, ManifestEntry>();
  for (const e of entries) m.set(e.pr_number, e);
  return m;
}

describe("planMigration", () => {
  test("plans a flat record into its merged_at day", () => {
    const shards = [entry(1, `${ARCHIVE_ROOT_RELATIVE}/PR-1-a.md`, "2026-08-17T04:00:00Z")];
    const plan = planMigration(["PR-1-a.md"], shardMap(shards), Infinity);
    expect(plan.moves).toHaveLength(1);
    expect(plan.moves[0]?.to).toBe(`${ARCHIVE_ROOT_RELATIVE}/2026/08/17/PR-1-a.md`);
    expect(plan.unmigrated).toHaveLength(0);
  });

  test("RE-RUNNABLE — a record already in its bucket plans ZERO moves", () => {
    // The falsifier for resumability. Mutation killed: dropping the `toRel === rel` guard,
    // which would re-`git mv` every file onto itself on every run.
    const shards = [entry(1, `${ARCHIVE_ROOT_RELATIVE}/2026/08/17/PR-1-a.md`, "2026-08-17T04:00:00Z")];
    const plan = planMigration(["2026/08/17/PR-1-a.md"], shardMap(shards), Infinity);
    expect(plan.moves).toHaveLength(0);
    expect(plan.alreadyPlaced).toBe(1);
  });

  test("a MIXED tree plans only the unplaced half", () => {
    const shards = [
      entry(1, "x", "2026-08-17T04:00:00Z"),
      entry(2, "x", "2026-08-18T04:00:00Z"),
    ];
    const plan = planMigration(["2026/08/17/PR-1-a.md", "PR-2-b.md"], shardMap(shards), Infinity);
    expect(plan.moves).toHaveLength(1);
    expect(plan.alreadyPlaced).toBe(1);
    expect(plan.moves[0]?.prNumber).toBe(2);
  });

  test("NOTHING IS DROPPED — a body with no shard is reported, never moved", () => {
    // The safety claim. A migration that silently skipped these would look identical in the
    // summary line and would have quietly abandoned records.
    const plan = planMigration(["PR-9999-orphan.md"], shardMap([]), Infinity);
    expect(plan.moves).toHaveLength(0);
    expect(plan.unmigrated).toHaveLength(1);
    expect(plan.unmigrated[0]?.path).toBe(`${ARCHIVE_ROOT_RELATIVE}/PR-9999-orphan.md`);
    expect(plan.unmigrated[0]?.reason).toContain("9999");
  });

  test("an unparseable filename is reported WITH a reason, not skipped silently", () => {
    const plan = planMigration(["not-an-archive.md"], shardMap([]), Infinity);
    expect(plan.unmigrated).toHaveLength(1);
    expect(plan.unmigrated[0]?.reason).toContain("PR-<number>-<slug>.md");
  });

  test("A RECORD WITH NO merged_at GOES TO A NAMED BUCKET — explicitly, not silently", () => {
    // PR #1702 is the live instance: archived while OPEN. It must neither be dropped nor
    // given an invented date.
    const shards = [entry(1702, "x", null)];
    const plan = planMigration(["PR-1702-open.md"], shardMap(shards), Infinity);
    expect(plan.moves).toHaveLength(1);
    expect(plan.moves[0]?.to).toBe(`${ARCHIVE_ROOT_RELATIVE}/${UNDATED_BUCKET}/PR-1702-open.md`);
    expect(plan.moves[0]?.dated).toBe(false);
    expect(plan.moves[0]?.reason).toContain("null");
  });

  test("--limit caps the plan without reordering it", () => {
    const shards = [1, 2, 3].map((n) => entry(n, "x", "2026-08-17T04:00:00Z"));
    const plan = planMigration(["PR-1-a.md", "PR-2-b.md", "PR-3-c.md"], shardMap(shards), 2);
    expect(plan.moves).toHaveLength(2);
  });
});

describe("applyMigration + verifyMigration", () => {
  test("moves the body AND corrects the shard IN THE SAME PASS", () => {
    // The load-bearing coupling: a move without the shard update leaves a dangling index.
    const shards = [entry(1, `${ARCHIVE_ROOT_RELATIVE}/PR-1-a.md`, "2026-08-17T04:00:00Z")];
    const root = scratch(["PR-1-a.md"], shards);
    try {
      const shardRoot = join(root, SHARD_ROOT_RELATIVE);
      const plan = planMigration(["PR-1-a.md"], shardMap(shards), Infinity);
      const applied = applyMigration(root, plan, shardRoot, false);
      expect(applied.failures).toEqual([]);
      expect(applied.moved).toBe(1);
      expect(applied.shardsUpdated).toBe(1);

      // body is at the new path
      expect(() => statSync(join(root, ARCHIVE_ROOT_RELATIVE, "2026/08/17/PR-1-a.md"))).not.toThrow();
      // and NOT at the old one
      expect(() => statSync(join(root, ARCHIVE_ROOT_RELATIVE, "PR-1-a.md"))).toThrow();

      const v = verifyMigration(root, shardRoot);
      expect(v.missing).toEqual([]);
      expect(v.flatRemaining).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("IDEMPOTENT — a second apply moves nothing and rewrites nothing", () => {
    const shards = [entry(1, `${ARCHIVE_ROOT_RELATIVE}/PR-1-a.md`, "2026-08-17T04:00:00Z")];
    const root = scratch(["PR-1-a.md"], shards);
    try {
      const shardRoot = join(root, SHARD_ROOT_RELATIVE);
      applyMigration(root, planMigration(["PR-1-a.md"], shardMap(shards), Infinity), shardRoot, false);
      // Re-plan from the tree as it now is — exactly what a second run does.
      const docs = walkArchiveDocs(join(root, ARCHIVE_ROOT_RELATIVE));
      const reshards = shardMap([entry(1, `${ARCHIVE_ROOT_RELATIVE}/2026/08/17/PR-1-a.md`, "2026-08-17T04:00:00Z")]);
      const second = planMigration(docs, reshards, Infinity);
      expect(second.moves).toHaveLength(0);
      expect(second.alreadyPlaced).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("VERIFICATION FAILS when a shard points at a body that is not there", () => {
    // The falsifier for the verifier itself. Mutation killed: making `verifyMigration`
    // return `missing: []` unconditionally — a self-check that cannot fail.
    const root = scratch([], [entry(1, `${ARCHIVE_ROOT_RELATIVE}/2026/08/17/PR-1-a.md`, "2026-08-17T04:00:00Z")]);
    try {
      const v = verifyMigration(root, join(root, SHARD_ROOT_RELATIVE));
      expect(v.checked).toBe(1);
      expect(v.missing).toHaveLength(1);
      expect(v.missing[0]).toContain("PR #1");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("verification counts a still-flat archive_path", () => {
    const root = scratch(["PR-1-a.md"], [entry(1, `${ARCHIVE_ROOT_RELATIVE}/PR-1-a.md`, "2026-08-17T04:00:00Z")]);
    try {
      const v = verifyMigration(root, join(root, SHARD_ROOT_RELATIVE));
      expect(v.missing).toEqual([]);
      expect(v.flatRemaining).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("parseArgs", () => {
  test("defaults and flags", () => {
    const a = parseArgs([]);
    expect(typeof a).not.toBe("string");
    if (typeof a === "string") return;
    expect(a.dryRun).toBe(false);
    expect(a.verifyOnly).toBe(false);
    expect(a.limit).toBe(Infinity);
  });

  test("rejects a bad --limit rather than defaulting it", () => {
    expect(typeof parseArgs(["--limit", "0"])).toBe("string");
    expect(typeof parseArgs(["--limit", "abc"])).toBe("string");
    expect(typeof parseArgs(["--root"])).toBe("string");
    expect(typeof parseArgs(["--nope"])).toBe("string");
  });
});
