/**
 * Falsifiers for the derived-index drift check's AGE measurement.
 *
 * THE BUG THESE PIN. `pr-manifest-integrity.yml` failed on ANY drift on its 6-hourly
 * schedule and annotated it "has been behind ... for longer than the roughly one-hour repair
 * bound, so the serialised repair writer has stopped landing." It never measured how long the
 * drift had existed — it sampled an instant and reported a duration. Measured against the
 * repair writer's own commit history on 2026-08-22, all four consecutive scheduled failures
 * happened within 40 minutes of a SUCCESSFUL repair:
 *
 *     scheduled run      last repair landed        verdict it printed
 *     08-21T18:34        0.4 min earlier           "repair writer has stopped landing"
 *     08-22T00:34       38.2 min earlier           same
 *     08-22T06:34        5.0 min earlier           same
 *     08-22T12:34       11.6 min earlier           same
 *
 * Every one of those was a false positive. The tests below fail if the tool ever goes back to
 * treating the existence of drift as evidence of its age.
 *
 * AND THE OPPOSITE FAILURE, which matters more: a bound must not become a mute button. The
 * "still red at any age" group pins the classes no repair cadence can explain, so widening the
 * bound cannot silence them.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

import { classifyDrift, driftAge, runDerive, main } from "./derive-pr-manifest.ts";
import {
  MANIFEST_RELATIVE,
  SHARD_ROOT_RELATIVE,
  deriveManifest,
  serializeShard,
  shardPathFor,
  type ManifestEntry,
} from "./pr-manifest-shards.ts";

const NOW = Date.parse("2026-08-22T12:34:00Z");
const minsAgo = (m: number): string => new Date(NOW - m * 60000).toISOString();

function entry(pr: number, fetchedAt: string): ManifestEntry {
  return {
    pr_number: pr,
    archive_path: `docs/history/pr-reviews/PR-${String(pr)}-x.md`,
    source_ids: [],
    fetched_at: fetchedAt,
    schema_version: "v1",
    commit_sha: "a".repeat(40),
    title: `PR ${String(pr)}`,
    state: "MERGED",
    merged_at: fetchedAt,
    head_ref: `shadow/pr-${String(pr)}`,
  };
}

/** A repo root holding `shards` for every entry and a manifest derived from `inIndex`. */
function fixture(shards: readonly ManifestEntry[], inIndex: readonly ManifestEntry[]): string {
  const root = mkdtempSync(join(tmpdir(), "derive-pr-manifest-"));
  const shardRoot = join(root, SHARD_ROOT_RELATIVE);
  for (const e of shards) {
    const p = shardPathFor(e.pr_number, shardRoot);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, serializeShard(e), "utf8");
  }
  const mp = join(root, MANIFEST_RELATIVE);
  mkdirSync(dirname(mp), { recursive: true });
  writeFileSync(mp, deriveManifest(inIndex), "utf8");
  return root;
}

describe("drift age is MEASURED, not inferred from the schedule", () => {
  test("fresh drift inside the bound is green — the 08-22T12:34 false positive", () => {
    // Index holds PR 1; a shard for PR 2 landed 11.6 minutes ago and is not yet reconciled.
    const a = entry(1, minsAgo(600));
    const b = entry(2, minsAgo(11.6));
    const root = fixture([a, b], [a]);
    try {
      const r = runDerive({ root, write: false, minAgeMinutes: 180, nowMs: NOW });
      expect(r.code).toBe(0);
      expect(r.lines.join("\n")).toContain("within the 180-minute repair bound");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("drift older than the bound is RED — a genuinely stalled repair writer", () => {
    const a = entry(1, minsAgo(600));
    const b = entry(2, minsAgo(400));
    const root = fixture([a, b], [a]);
    try {
      const r = runDerive({ root, write: false, minAgeMinutes: 180, nowMs: NOW });
      expect(r.code).toBe(1);
      expect(r.lines.join("\n")).toContain("stopped landing");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the bound is not vacuous: the SAME tree flips on the bound alone", () => {
    const a = entry(1, minsAgo(600));
    const b = entry(2, minsAgo(90));
    const root = fixture([a, b], [a]);
    try {
      expect(runDerive({ root, write: false, minAgeMinutes: 180, nowMs: NOW }).code).toBe(0);
      expect(runDerive({ root, write: false, minAgeMinutes: 30, nowMs: NOW }).code).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("age is the OLDEST unreconciled shard, not the newest", () => {
    // A brand-new shard must not mask an ancient one the writer never picked up.
    const a = entry(1, minsAgo(600));
    const old = entry(2, minsAgo(400));
    const fresh = entry(3, minsAgo(1));
    const root = fixture([a, old, fresh], [a]);
    try {
      const r = runDerive({ root, write: false, minAgeMinutes: 180, nowMs: NOW });
      expect(r.code).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("no bound supplied keeps the historical any-drift-fails contract", () => {
    const a = entry(1, minsAgo(600));
    const b = entry(2, minsAgo(1));
    const root = fixture([a, b], [a]);
    try {
      expect(runDerive({ root, write: false }).code).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("in-sync is green with or without a bound", () => {
    const a = entry(1, minsAgo(600));
    const root = fixture([a], [a]);
    try {
      expect(runDerive({ root, write: false }).code).toBe(0);
      expect(runDerive({ root, write: false, minAgeMinutes: 180, nowMs: NOW }).code).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("still red at ANY age — the bound is not a mute button", () => {
  test("an ORPHANED index entry (shard vanished) fails however fresh everything is", () => {
    const a = entry(1, minsAgo(1));
    // Index carries PR 2; no shard backs it. That is substrate loss, not index lag.
    const root = fixture([a], [a, entry(2, minsAgo(1))]);
    try {
      const r = runDerive({ root, write: false, minAgeMinutes: 100000, nowMs: NOW });
      expect(r.code).toBe(1);
      expect(r.lines.join("\n")).toContain("no shard behind them");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("an unreadable fetched_at is never reported as a pass", () => {
    const a = entry(1, minsAgo(600));
    const bad = entry(2, "not-a-timestamp");
    const root = fixture([a, bad], [a]);
    try {
      const r = runDerive({ root, write: false, minAgeMinutes: 100000, nowMs: NOW });
      expect(r.code).toBe(1);
      expect(r.lines.join("\n")).toContain("cannot be measured");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("shard-store integrity still exits 2 regardless of the bound", () => {
    const a = entry(1, minsAgo(1));
    const root = fixture([a], [a]);
    try {
      writeFileSync(join(root, SHARD_ROOT_RELATIVE, "000", "garbage.json"), "{not json", "utf8");
      const r = runDerive({ root, write: false, minAgeMinutes: 100000, nowMs: NOW });
      expect(r.code).toBe(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("classifyDrift / driftAge", () => {
  test("separates unreconciled from orphaned", () => {
    const a = entry(1, minsAgo(10));
    const b = entry(2, minsAgo(5));
    const c = classifyDrift(deriveManifest([a, entry(9, minsAgo(5))]), [a, b]);
    expect(c.unreconciled.map((e) => e.pr_number)).toEqual([2]);
    expect(c.orphanedPrNumbers).toEqual([9]);
  });

  test("a CHANGED field counts as unreconciled, not just a missing line", () => {
    const stale = entry(1, minsAgo(10));
    const fresh = { ...stale, state: "CLOSED" as const };
    const c = classifyDrift(deriveManifest([stale]), [fresh]);
    expect(c.unreconciled.map((e) => e.pr_number)).toEqual([1]);
    expect(c.orphanedPrNumbers).toEqual([]);
  });

  test("driftAge reports null when nothing is unreconciled", () => {
    expect(driftAge({ unreconciled: [], orphanedPrNumbers: [], unparseableLines: [] }, NOW).oldestMinutes).toBeNull();
  });
});

describe("--min-age-minutes argument handling", () => {
  test("a malformed bound is REFUSED, never silently ignored", () => {
    // Silently defaulting would restore any-drift-fails with no way for the caller to tell.
    expect(main(["--min-age-minutes"])).toBe(3);
    expect(main(["--min-age-minutes", "abc"])).toBe(3);
    expect(main(["--min-age-minutes", "-5"])).toBe(3);
    expect(main(["--min-age-minutes", "--root"])).toBe(3);
  });
});
