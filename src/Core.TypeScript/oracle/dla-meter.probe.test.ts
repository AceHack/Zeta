/**
 * dla-meter.probe.test.ts — CommitPairCorrelator probe unit tests
 *
 * Tests the probe functions exported from dla-meter.ts:
 *   dfBucket, splitmix64, seededShuffle, pairingMI, runCommitPairProbe, loadPriorReadings
 *
 * Anti-self-certifying: these tests can fail if the probe logic is broken.
 * The soundnessNote is always present — it is the epistemic disclaimer that
 * travels with every OracleReading.
 */
import { describe, it, expect } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  dfBucket,
  splitmix64,
  seededShuffle,
  pairingMI,
  runCommitPairProbe,
  loadPriorReadings,
} from "./dla-meter";

// ── DMP-1: dfBucket quantizes correctly ──────────────────────────────────────
describe("DMP-1: dfBucket", () => {
  it("1.0 → 10", () => expect(dfBucket(1.0)).toBe(10));
  it("1.3 → 13", () => expect(dfBucket(1.3)).toBe(13));
  it("1.322 → 13 (DLA fractal dim)", () => expect(dfBucket(1.322)).toBe(13));
  it("1.399 → 13 (still same bucket)", () => expect(dfBucket(1.399)).toBe(13));
  it("1.4 → 14 (next bucket)", () => expect(dfBucket(1.4)).toBe(14));
  it("2.0 → 20", () => expect(dfBucket(2.0)).toBe(20));
  // Anti-self-certifying: wrong quantization would break the MI calculation
  it("1.35 and 1.32 are in the same bucket", () =>
    expect(dfBucket(1.35)).toBe(dfBucket(1.32)));
  it("1.4 and 1.3 are in different buckets", () =>
    expect(dfBucket(1.4)).not.toBe(dfBucket(1.3)));
});

// ── DMP-2: splitmix64 is deterministic and produces distinct outputs ──────────
describe("DMP-2: splitmix64 determinism", () => {
  it("same seed → same output", () => {
    const [out1] = splitmix64(42n);
    const [out2] = splitmix64(42n);
    expect(out1).toBe(out2);
  });
  it("different seeds → different outputs", () => {
    const [out1] = splitmix64(1n);
    const [out2] = splitmix64(2n);
    expect(out1).not.toBe(out2);
  });
  it("state advances on each call", () => {
    const [, s1] = splitmix64(0n);
    const [, s2] = splitmix64(s1);
    expect(s1).not.toBe(s2);
  });
  it("output is a 64-bit non-negative integer", () => {
    const [out] = splitmix64(999n);
    expect(out).toBeGreaterThanOrEqual(0n);
    expect(out).toBeLessThanOrEqual(0xFFFFFFFFFFFFFFFFn);
  });
});

// ── DMP-3: seededShuffle is deterministic and permutes ────────────────────────
describe("DMP-3: seededShuffle", () => {
  it("same seed → same permutation", () => {
    const a = [1, 2, 3, 4, 5];
    const b = [1, 2, 3, 4, 5];
    seededShuffle(a, 42n);
    seededShuffle(b, 42n);
    expect(a).toEqual(b);
  });
  it("different seeds → different permutations (with high probability)", () => {
    const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const b = [...a];
    seededShuffle(a, 1n);
    seededShuffle(b, 2n);
    expect(a).not.toEqual(b);
  });
  it("shuffle preserves all elements (is a permutation)", () => {
    const arr = [10, 20, 30, 40, 50];
    const original = [...arr];
    seededShuffle(arr, 7n);
    expect(arr.sort((a, b) => a - b)).toEqual(original.sort((a, b) => a - b));
  });
  it("empty array is a no-op", () => {
    const arr: number[] = [];
    seededShuffle(arr, 1n);
    expect(arr).toEqual([]);
  });
});

// ── DMP-4: pairingMI is 0 for independent pairs ───────────────────────────────
describe("DMP-4: pairingMI", () => {
  it("empty pairs → 0", () => expect(pairingMI([])).toBe(0));
  it("perfectly correlated pairs → MI > 0", () => {
    // Pairs where A varies and B = A — perfectly correlated (MI = H(A) > 0)
    // Constant pairs (all same value) have MI = 0 because H(A) = 0
    const pairs: [number, number][] = [
      [13, 13], [14, 14], [15, 15], [13, 13], [14, 14], [15, 15],
      [13, 13], [14, 14], [15, 15], [13, 13], [14, 14], [15, 15],
    ];
    expect(pairingMI(pairs)).toBeGreaterThan(0);
  });
  it("uniform independent pairs → MI ≈ 0", () => {
    // Pairs where A and B are independent uniform over {10, 11, 12, 13}
    const pairs: [number, number][] = [];
    for (let a = 10; a <= 13; a++) {
      for (let b = 10; b <= 13; b++) {
        for (let k = 0; k < 4; k++) pairs.push([a, b]);
      }
    }
    // MI should be very close to 0 for uniform independent
    expect(Math.abs(pairingMI(pairs))).toBeLessThan(1e-10);
  });
  it("MI is non-negative", () => {
    const pairs: [number, number][] = [[13, 13], [14, 14], [13, 14], [14, 13]];
    expect(pairingMI(pairs)).toBeGreaterThanOrEqual(0);
  });
});

// ── DMP-5: runCommitPairProbe — null on insufficient data ─────────────────────
describe("DMP-5: runCommitPairProbe — insufficient data", () => {
  it("empty readings → meteredPairs=0, excessFraction=null, isExcess=false", () => {
    const result = runCommitPairProbe([], 42);
    expect(result.meteredPairs).toBe(0);
    expect(result.excessFraction).toBeNull();
    expect(result.isExcess).toBe(false);
    expect(result.soundnessNote).toBeTruthy();
  });
  it("single oracle index only → meteredPairs=0 (no spacelike pairs)", () => {
    const readings = Array.from({ length: 10 }, (_, i) => ({
      oracleIndex: 0,
      fractalDim: 1.322 + i * 0.001,
    }));
    const result = runCommitPairProbe(readings, 42);
    expect(result.meteredPairs).toBe(0);
    expect(result.excessFraction).toBeNull();
  });
  it("two oracle indices but only 1 reading each → meteredPairs=0 (need ≥2 pairs)", () => {
    const readings = [
      { oracleIndex: 0, fractalDim: 1.322 },
      { oracleIndex: 1, fractalDim: 1.318 },
    ];
    const result = runCommitPairProbe(readings, 42);
    expect(result.meteredPairs).toBe(0);
  });
});

// ── DMP-6: runCommitPairProbe — no excess for independent readings ─────────────
describe("DMP-6: runCommitPairProbe — no excess for independent readings", () => {
  it("two oracles with identical D_f (no excess correlation expected)", () => {
    // Both oracles always produce D_f ≈ 1.322 — same bucket, so MI > 0
    // but this is the REAL signal (they agree because DLA is invariant, not because correlated)
    // The permutation null will also have MI > 0 (same bucket always)
    // → excessFraction should be 0 (real MI ≤ null threshold)
    const readings: Array<{ oracleIndex: number; fractalDim: number }> = [];
    for (let i = 0; i < 20; i++) {
      readings.push({ oracleIndex: 0, fractalDim: 1.322 });
      readings.push({ oracleIndex: 1, fractalDim: 1.322 });
    }
    const result = runCommitPairProbe(readings, 42);
    expect(result.meteredPairs).toBeGreaterThan(0);
    // When both oracles always produce the same bucket, the permutation null
    // also always produces the same bucket → real MI = null MI → not excess
    expect(result.isExcess).toBe(false);
  });
});

// ── DMP-7: runCommitPairProbe — determinism ────────────────────────────────────
describe("DMP-7: runCommitPairProbe — determinism", () => {
  it("same readings + same seed → same result", () => {
    const readings: Array<{ oracleIndex: number; fractalDim: number }> = [
      { oracleIndex: 0, fractalDim: 1.322 },
      { oracleIndex: 0, fractalDim: 1.318 },
      { oracleIndex: 0, fractalDim: 1.325 },
      { oracleIndex: 1, fractalDim: 1.320 },
      { oracleIndex: 1, fractalDim: 1.315 },
      { oracleIndex: 1, fractalDim: 1.328 },
    ];
    const r1 = runCommitPairProbe(readings, 12345);
    const r2 = runCommitPairProbe(readings, 12345);
    expect(r1.meteredPairs).toBe(r2.meteredPairs);
    expect(r1.excessFraction).toBe(r2.excessFraction);
    expect(r1.isExcess).toBe(r2.isExcess);
  });
  it("different seeds → may produce different results (null distribution varies)", () => {
    // This test documents that the seed matters — it doesn't assert a specific outcome
    const readings: Array<{ oracleIndex: number; fractalDim: number }> = [];
    for (let i = 0; i < 10; i++) {
      readings.push({ oracleIndex: 0, fractalDim: 1.3 + (i % 3) * 0.1 });
      readings.push({ oracleIndex: 1, fractalDim: 1.4 - (i % 3) * 0.1 });
    }
    const r1 = runCommitPairProbe(readings, 1);
    const r2 = runCommitPairProbe(readings, 2);
    // Both are valid results — we just check they are deterministic for their own seed
    const r1b = runCommitPairProbe(readings, 1);
    const r2b = runCommitPairProbe(readings, 2);
    expect(r1.isExcess).toBe(r1b.isExcess);
    expect(r2.isExcess).toBe(r2b.isExcess);
  });
});

// ── DMP-8: runCommitPairProbe — soundnessNote is always present ────────────────
describe("DMP-8: soundnessNote always present", () => {
  it("empty readings → soundnessNote is non-empty", () => {
    const result = runCommitPairProbe([], 42);
    expect(result.soundnessNote.length).toBeGreaterThan(50);
    expect(result.soundnessNote).toContain("CHSH");
    expect(result.soundnessNote).toContain("ill-posed");
  });
  it("non-empty readings → soundnessNote is non-empty", () => {
    const readings = [
      { oracleIndex: 0, fractalDim: 1.322 },
      { oracleIndex: 0, fractalDim: 1.318 },
      { oracleIndex: 1, fractalDim: 1.320 },
      { oracleIndex: 1, fractalDim: 1.315 },
    ];
    const result = runCommitPairProbe(readings, 42);
    expect(result.soundnessNote.length).toBeGreaterThan(50);
    expect(result.soundnessNote).toContain("CommitPairCorrelator");
  });
});

// ── DMP-9: loadPriorReadings — empty dir → empty array ────────────────────────
describe("DMP-9: loadPriorReadings", () => {
  it("non-existent directory → empty array", () => {
    const result = loadPriorReadings("/tmp/nonexistent-zeta-test-dir-xyz", "alexa");
    expect(result).toEqual([]);
  });

  it("directory with valid JSON files → reads oracleIndex and fractalDim", () => {
    const tmpRoot = join(tmpdir(), `zeta-dla-test-${Date.now()}`);
    const agentDir = join(tmpRoot, "docs", "oracle-readings", "test-agent", "2026", "08", "08");
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(join(agentDir, "oracle-0-aabbccdd.json"), JSON.stringify({
      oracleIndex: 0,
      fractalDim: 1.322,
      seed: "aabbccdd",
    }));
    writeFileSync(join(agentDir, "oracle-1-11223344.json"), JSON.stringify({
      oracleIndex: 1,
      fractalDim: 1.318,
      seed: "11223344",
    }));
    const result = loadPriorReadings(tmpRoot, "test-agent");
    expect(result).toHaveLength(2);
    const sorted = result.sort((a, b) => a.oracleIndex - b.oracleIndex);
    expect(sorted[0]).toEqual({ oracleIndex: 0, fractalDim: 1.322 });
    expect(sorted[1]).toEqual({ oracleIndex: 1, fractalDim: 1.318 });
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("malformed JSON files are skipped gracefully", () => {
    const tmpRoot = join(tmpdir(), `zeta-dla-test-${Date.now()}`);
    const agentDir = join(tmpRoot, "docs", "oracle-readings", "test-agent", "2026", "08", "08");
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(join(agentDir, "good.json"), JSON.stringify({ oracleIndex: 0, fractalDim: 1.3 }));
    writeFileSync(join(agentDir, "bad.json"), "NOT VALID JSON {{{");
    writeFileSync(join(agentDir, "missing-fields.json"), JSON.stringify({ foo: "bar" }));
    const result = loadPriorReadings(tmpRoot, "test-agent");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ oracleIndex: 0, fractalDim: 1.3 });
    rmSync(tmpRoot, { recursive: true, force: true });
  });
});

// ── DMP-9: POSITIVE CONTROL — isExcess CAN be true ────────────────────────────
// (Lumen 2026-08-25.) Before this block, every assertion about `isExcess` in this
// file and in dla-meter.e2e.test.ts asserted FALSE, or asserted that two runs
// agreed. The detector's positive branch was never exercised.
//
// Mechanically confirmed by mutation on 2026-08-25: replacing
//     isExcess: excessPairs > 0,   ->   isExcess: false,
// in dla-meter.ts left the suites at "41 pass, 0 fail". A detector hardcoded to
// never detect passed its entire test suite — the vacuity class exactly as
// `.claude/rules/toy-is-free-metered-must-be-earned.md` names it.
//
// ROOT CAUSE, and it is the same defect as the typed-in constant: every fixture
// above pins `fractalDim: 1.322`. With zero variance in the input, the mutual
// information is identically 0 for BOTH the real pairing and the permutation null,
// so `isExcess` is structurally false and the assertions are trivially satisfied.
// A number that never varies cannot exercise a correlator.
//
// Analysis: docs/research/2026-08-25-does-the-dla-meter-measure-a-fractal-dimension-four-estimators-one-typed-in-constant-lumen.md
describe("DMP-9: runCommitPairProbe — positive control (the falsifier)", () => {
  it("two PERFECTLY correlated oracle streams with real variance → isExcess = true", () => {
    // Two distinct buckets (13 and 14), locked in phase across both oracles.
    // Real MI is maximal; the permutation null breaks the phase lock, so the
    // real MI exceeds the 95th-percentile null threshold.
    const readings: Array<{ oracleIndex: number; fractalDim: number }> = [];
    for (let i = 0; i < 12; i++) {
      const df = i % 2 === 0 ? 1.32 : 1.45; // dfBucket -> 13, 14
      readings.push({ oracleIndex: 0, fractalDim: df });
      readings.push({ oracleIndex: 1, fractalDim: df });
    }
    const result = runCommitPairProbe(readings, 42);
    expect(result.meteredPairs).toBeGreaterThan(0);
    // THE assertion that kills the `isExcess: false` mutant.
    expect(result.isExcess).toBe(true);
    expect(result.excessFraction).toBe(1);
  });

  it("the SAME variance with the streams decorrelated → isExcess = false (negative control)", () => {
    // Same two buckets, same counts, same everything — only the phase relationship
    // is destroyed. Pairing this against the test above is what makes either one
    // informative: together they show the probe tracks CORRELATION, not variance.
    const readings: Array<{ oracleIndex: number; fractalDim: number }> = [];
    const a = [1.32, 1.45, 1.32, 1.45, 1.32, 1.45, 1.32, 1.45, 1.32, 1.45, 1.32, 1.45];
    const b = [1.32, 1.32, 1.45, 1.32, 1.45, 1.45, 1.32, 1.45, 1.45, 1.32, 1.32, 1.45];
    for (let i = 0; i < a.length; i++) {
      readings.push({ oracleIndex: 0, fractalDim: a[i]! });
      readings.push({ oracleIndex: 1, fractalDim: b[i]! });
    }
    const result = runCommitPairProbe(readings, 42);
    expect(result.meteredPairs).toBeGreaterThan(0);
    expect(result.isExcess).toBe(false);
  });
});
