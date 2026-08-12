/**
 * rs-block-reader.test.ts — query RS blocks by agent + phase.
 */

import { describe, test, expect, afterAll } from "bun:test";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { loadBlockIndex, queryPhase, latestBlocks, phaseCoverage, summarize } from "./rs-block-reader";
import { encode, K, N } from "./rs-phase-codec";

const TMP = join(import.meta.dir, ".test-rs-reader-tmp");

function setup(records: object[]): string {
  mkdirSync(TMP, { recursive: true });
  const path = join(TMP, "blocks.jsonl");
  writeFileSync(path, records.map((r) => JSON.stringify(r)).join("\n") + "\n");
  return path;
}

function cleanup(): void {
  try { rmSync(TMP, { recursive: true }); } catch { /* ok */ }
}

function makeBlock(agent: string, seq: number, startPhase: number): object {
  const info = Array.from({ length: K }, (_, i) => (startPhase + i) % 17);
  const coded = encode(info);
  return {
    agent,
    seq,
    startPhase,
    endPhase: startPhase + K - 1,
    coded,
    emittedAt: "2026-08-11T12:00:00Z",
  };
}

describe("rs-block-reader", () => {
  afterAll(cleanup);

  test("loadBlockIndex: empty file", () => {
    const path = setup([]);
    const idx = loadBlockIndex(path);
    expect(idx.count).toBe(0);
  });

  test("loadBlockIndex: indexes by agent", () => {
    const path = setup([makeBlock("alexa", 0, 0), makeBlock("otto", 0, 0), makeBlock("alexa", 1, 12)]);
    const idx = loadBlockIndex(path);
    expect(idx.count).toBe(3);
    expect(idx.byAgent.get("alexa")!.length).toBe(2);
    expect(idx.byAgent.get("otto")!.length).toBe(1);
  });

  test("queryPhase: finds phase in a block", () => {
    const path = setup([makeBlock("alexa", 0, 10)]);
    const idx = loadBlockIndex(path);
    const result = queryPhase(idx, { agent: "alexa", phase: 15 });
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.positionInBlock).toBe(5); // 15 - 10
      expect(result.infoValue).toBeGreaterThanOrEqual(0);
      expect(result.infoValue).toBeLessThanOrEqual(16);
    }
  });

  test("queryPhase: not found for wrong agent", () => {
    const path = setup([makeBlock("alexa", 0, 0)]);
    const idx = loadBlockIndex(path);
    const result = queryPhase(idx, { agent: "otto", phase: 5 });
    expect(result.found).toBe(false);
  });

  test("queryPhase: not found for uncovered phase", () => {
    const path = setup([makeBlock("alexa", 0, 0)]);
    const idx = loadBlockIndex(path);
    const result = queryPhase(idx, { agent: "alexa", phase: 50 });
    expect(result.found).toBe(false);
  });

  test("latestBlocks: returns the highest-seq block per agent", () => {
    const path = setup([makeBlock("alexa", 0, 0), makeBlock("alexa", 1, 12), makeBlock("otto", 0, 0)]);
    const idx = loadBlockIndex(path);
    const latest = latestBlocks(idx);
    expect(latest.get("alexa")!.seq).toBe(1);
    expect(latest.get("otto")!.seq).toBe(0);
  });

  test("phaseCoverage: reports min/max/gaps", () => {
    // Two blocks with a gap: [0-11] and [24-35] (gap at 12-23)
    const path = setup([makeBlock("alexa", 0, 0), makeBlock("alexa", 1, 24)]);
    const idx = loadBlockIndex(path);
    const cov = phaseCoverage(idx, "alexa");
    expect(cov).not.toBeNull();
    expect(cov!.min).toBe(0);
    expect(cov!.max).toBe(35);
    expect(cov!.gaps).toBe(1);
  });

  test("phaseCoverage: no gaps when contiguous", () => {
    const path = setup([makeBlock("alexa", 0, 0), makeBlock("alexa", 1, 12)]);
    const idx = loadBlockIndex(path);
    const cov = phaseCoverage(idx, "alexa");
    expect(cov!.gaps).toBe(0);
  });

  test("summarize: formats nicely", () => {
    const path = setup([makeBlock("alexa", 0, 0), makeBlock("otto", 0, 5)]);
    const idx = loadBlockIndex(path);
    const s = summarize(idx);
    expect(s).toContain("2 blocks");
    expect(s).toContain("alexa");
    expect(s).toContain("otto");
  });

  test("loadBlockIndex: missing file returns empty", () => {
    const idx = loadBlockIndex("/nonexistent/path.jsonl");
    expect(idx.count).toBe(0);
  });
});
