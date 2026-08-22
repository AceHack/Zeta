import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  SHARD_ID_RE,
  buildRollup,
  canonicalJson,
  loadAllShards,
  shardPathFor,
  shardZetaId,
  writeShard,
  type MetricsFrame,
} from "./tick-shards";
import { unpack } from "../zeta-id/zeta-id";
import { fromHex, toHex } from "../zeta-id/encoding";
import { Category, Chromosome, IdVersion } from "../zeta-id/types";

const FRAME: MetricsFrame = {
  t: "2026-07-08T20:17:26.288Z",
  total_events: 42,
  last_action: "explore",
  last_mode: "work",
  last_agent: "otto",
  entropy_state: 3,
  entropy_heat: 9,
  ticks_24h: 12,
  agents_active: 2,
  claims_pending: 1,
};

function withTempRoot<T>(fn: (root: string) => T): T {
  const root = mkdtempSync(join(tmpdir(), "tick-shards-"));
  try {
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("tick-shards — the shard filename is a real ZetaId", () => {
  test("filename is a canonical 32-hex ZetaId under a YYYY/MM/DD directory", () => {
    const path = shardPathFor(FRAME, "root");
    expect(path).toBe(`root/2026/07/08/${toHex(shardZetaId(FRAME))}.json`);
    const stem = path
      .split("/")
      .pop()!
      .replace(/\.json$/, "");
    expect(SHARD_ID_RE.test(stem)).toBe(true);
    // The whole point of using the universal pointer system: it parses back out.
    expect(toHex(fromHex(stem))).toBe(stem);
  });

  test("the id's bit fields carry the frame's own observation time and the Observation category", () => {
    const obs = unpack(shardZetaId(FRAME));
    expect(obs.version).toBe(IdVersion.V1);
    expect(obs.category).toBe(Category.Observation);
    expect(obs.chromosome).toBe(Chromosome.MetaCoherence);
    // Not a mint clock — the frame's `t`, exactly. A backfilled historical frame therefore
    // never carries an id implying a mint time that did not happen.
    expect(new Date(obs.timestamp).toISOString()).toBe(FRAME.t);
  });

  test("the mint is deterministic — no clock, no randomness (DST §7 / §13 noninterference)", () => {
    const a = shardZetaId(FRAME);
    for (let i = 0; i < 5; i++) expect(shardZetaId({ ...FRAME })).toBe(a);
  });

  test("the id's low 32 bits are the content digest — different frame, different id", () => {
    expect(shardZetaId({ ...FRAME, total_events: 43 })).not.toBe(shardZetaId(FRAME));
    // Same content at the same instant collides deliberately (that IS the upsert key);
    // differing content at the same instant does not.
    expect(shardPathFor({ ...FRAME, claims_pending: 7 }, "r")).not.toBe(shardPathFor(FRAME, "r"));
  });

  test("rejects an unparseable timestamp rather than minting a nonsense id", () => {
    expect(() => shardZetaId({ ...FRAME, t: "not-a-date" })).toThrow(/unparseable timestamp/);
  });
});

describe("tick-shards — store behaviour", () => {
  test("writing the same frame twice is an upsert, not a duplicate (discipline #6)", () => {
    withTempRoot((root) => {
      const p1 = writeShard(FRAME, root);
      const p2 = writeShard(FRAME, root);
      expect(p2).toBe(p1);
      expect(loadAllShards(root)).toHaveLength(1);
      expect(readFileSync(p1, "utf-8")).toBe(canonicalJson(FRAME));
    });
  });

  test("frames round-trip through the store value-identically and fold in `t` order", () => {
    withTempRoot((root) => {
      const later: MetricsFrame = { ...FRAME, t: "2026-07-09T01:00:00.000Z", total_events: 43 };
      writeShard(later, root);
      writeShard(FRAME, root);
      const loaded = loadAllShards(root);
      expect(loaded.map((f) => f.t)).toEqual([FRAME.t, later.t]);
      expect(loaded.map(canonicalJson)).toEqual([FRAME, later].map(canonicalJson));
    });
  });

  test("the rollup is a pure function of the shard set — filenames never enter it", () => {
    withTempRoot((root) => {
      writeShard(FRAME, root);
      const frames = loadAllShards(root);
      const rollup = buildRollup(frames, frames.length);
      expect(rollup.frames).toEqual(frames);
      expect(rollup.provenance.shard_count).toBe(1);
      expect(rollup.provenance.derived_from).toBe("data/tick-shards/**/*.json");
    });
  });
});
