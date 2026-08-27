/**
 * dla-meter.e2e.test.ts — End-to-end test for the CommitPairCorrelator probe
 *
 * Unlike the unit tests (dla-meter.probe.test.ts), this test exercises the
 * full pipeline:
 *   1. Write real oracle reading JSON files to a temp directory
 *   2. Call loadPriorReadings to scan the directory
 *   3. Call runCommitPairProbe on the loaded readings
 *   4. Verify the probe produces correct results
 *
 * This closes the gap between unit tests and production behavior:
 * the unit tests mock the data; this test uses the actual file I/O path.
 *
 * Anti-self-certifying: these tests can fail if:
 *   - loadPriorReadings misreads the directory structure
 *   - runCommitPairProbe produces wrong results on real data
 *   - The JSON schema of OracleReading changes incompatibly
 */
import { describe, it, expect, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  loadPriorReadings,
  runCommitPairProbe,
} from "./dla-meter";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEST_AGENT = "e2e-test-agent";

/** Write a fake OracleReading JSON file to the temp directory. */
function writeReading(
  repoRoot: string,
  agent: string,
  oracleIndex: number,
  fractalDim: number,
  seed: string = "aabbccdd",
  date: { yyyy: string; mm: string; dd: string } = { yyyy: "2026", mm: "08", dd: "08" },
): string {
  const dir = join(repoRoot, "docs", "oracle-readings", agent, date.yyyy, date.mm, date.dd);
  mkdirSync(dir, { recursive: true });
  const filename = `oracle-${oracleIndex}-${seed}-${Math.random().toString(36).slice(2)}.json`;
  const reading = {
    oracleIndex,
    oracleName: `Oracle ${oracleIndex} — ${agent}`,
    seed,
    fractalDim,
    clusterSize: 800,
    totalCells: 10000,
    elapsedSeconds: 0.5,
    timestamp: new Date().toISOString(),
    transport: "git",
    latencySeconds: 120,
    effectiveCorrelation: 0.008,
    condorcetBonus: 0.992,
    agentId: agent,
    heartbeatId: "0000000000000000",
    commitPairProbe: null,
  };
  const filepath = join(dir, filename);
  writeFileSync(filepath, JSON.stringify(reading, null, 2) + "\n");
  return filepath;
}

// Track temp dirs for cleanup
const tempDirs: string[] = [];
function makeTempDir(): string {
  // `mkdtempSync` CREATES the directory atomically at 0700. The previous shape computed a name and
  // left creation to a later `mkdirSync`, which is a window: between the two the path can be
  // created by someone else, and `Math.random()` is not a security primitive (CodeQL
  // `js/insecure-temporary-file`).
  const dir = mkdtempSync(join(tmpdir(), "zeta-e2e-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

// ── E2E-1: No prior readings → probe returns null ─────────────────────────────
describe("E2E-1: no prior readings", () => {
  it("empty oracle-readings directory → loadPriorReadings returns []", () => {
    const root = makeTempDir();
    mkdirSync(join(root, "docs", "oracle-readings", TEST_AGENT), { recursive: true });
    const readings = loadPriorReadings(root, TEST_AGENT);
    expect(readings).toEqual([]);
  });

  it("non-existent agent directory → loadPriorReadings returns []", () => {
    const root = makeTempDir();
    const readings = loadPriorReadings(root, "no-such-agent");
    expect(readings).toEqual([]);
  });
});

// ── E2E-2: Single oracle index → meteredPairs = 0 ────────────────────────────
describe("E2E-2: single oracle index", () => {
  it("10 readings from oracle 0 only → meteredPairs = 0 (no spacelike pairs)", () => {
    const root = makeTempDir();
    for (let i = 0; i < 10; i++) {
      writeReading(root, TEST_AGENT, 0, 1.322 + i * 0.001, `seed${i.toString().padStart(4, "0")}`);
    }
    const readings = loadPriorReadings(root, TEST_AGENT);
    expect(readings.length).toBe(10);
    const probe = runCommitPairProbe(readings, 42);
    expect(probe.meteredPairs).toBe(0);
    expect(probe.excessFraction).toBeNull();
    expect(probe.isExcess).toBe(false);
  });
});

// ── E2E-3: Two oracle indices, same D_f → no excess ───────────────────────────
describe("E2E-3: two oracles, same D_f bucket", () => {
  it("oracle 0 and oracle 1 both produce D_f ≈ 1.322 → isExcess = false", () => {
    const root = makeTempDir();
    // Both oracles always produce D_f in the same bucket (1.3xx → bucket 13)
    for (let i = 0; i < 15; i++) {
      writeReading(root, TEST_AGENT, 0, 1.320 + (i % 3) * 0.001, `s0${i}`);
      writeReading(root, TEST_AGENT, 1, 1.321 + (i % 3) * 0.001, `s1${i}`);
    }
    const readings = loadPriorReadings(root, TEST_AGENT);
    expect(readings.length).toBe(30);
    const probe = runCommitPairProbe(readings, 42);
    expect(probe.meteredPairs).toBe(1); // one (0,1) pair
    // Both oracles always land in bucket 13 → permutation null also always bucket 13
    // → real MI = null MI → not excess
    expect(probe.isExcess).toBe(false);
  });
});

// ── E2E-4: Multiple oracle indices → meteredPairs = C(n,2) ───────────────────
describe("E2E-4: multiple oracle indices", () => {
  it("3 oracle indices → meteredPairs = 3 (C(3,2))", () => {
    const root = makeTempDir();
    for (let oracle = 0; oracle < 3; oracle++) {
      for (let i = 0; i < 10; i++) {
        writeReading(root, TEST_AGENT, oracle, 1.3 + oracle * 0.05 + i * 0.001, `s${oracle}${i}`);
      }
    }
    const readings = loadPriorReadings(root, TEST_AGENT);
    expect(readings.length).toBe(30);
    const probe = runCommitPairProbe(readings, 42);
    expect(probe.meteredPairs).toBe(3); // (0,1), (0,2), (1,2)
  });

  it("5 oracle indices → meteredPairs = 10 (C(5,2))", () => {
    const root = makeTempDir();
    for (let oracle = 0; oracle < 5; oracle++) {
      for (let i = 0; i < 5; i++) {
        writeReading(root, TEST_AGENT, oracle, 1.3 + oracle * 0.02 + i * 0.001, `s${oracle}${i}`);
      }
    }
    const readings = loadPriorReadings(root, TEST_AGENT);
    expect(readings.length).toBe(25);
    const probe = runCommitPairProbe(readings, 42);
    expect(probe.meteredPairs).toBe(10);
  });
});

// ── E2E-5: Readings across multiple dates → all loaded ────────────────────────
describe("E2E-5: readings across multiple dates", () => {
  it("readings from different dates are all loaded", () => {
    const root = makeTempDir();
    const dates = [
      { yyyy: "2026", mm: "08", dd: "01" },
      { yyyy: "2026", mm: "08", dd: "05" },
      { yyyy: "2026", mm: "08", dd: "08" },
    ];
    for (const date of dates) {
      writeReading(root, TEST_AGENT, 0, 1.322, "seed0", date);
      writeReading(root, TEST_AGENT, 1, 1.318, "seed1", date);
    }
    const readings = loadPriorReadings(root, TEST_AGENT);
    expect(readings.length).toBe(6); // 3 dates × 2 oracles
    const probe = runCommitPairProbe(readings, 42);
    expect(probe.meteredPairs).toBe(1); // one (0,1) pair
  });
});

// ── E2E-6: Malformed files are skipped, valid files are loaded ────────────────
describe("E2E-6: malformed files skipped", () => {
  it("mix of valid and malformed JSON → only valid files loaded", () => {
    const root = makeTempDir();
    const dir = join(root, "docs", "oracle-readings", TEST_AGENT, "2026", "08", "08");
    mkdirSync(dir, { recursive: true });

    // Valid reading
    writeFileSync(join(dir, "good.json"), JSON.stringify({ oracleIndex: 0, fractalDim: 1.322 }));
    // Malformed JSON
    writeFileSync(join(dir, "bad.json"), "NOT VALID JSON {{{");
    // Missing required fields
    writeFileSync(join(dir, "incomplete.json"), JSON.stringify({ oracleIndex: 1 }));
    // Non-JSON file
    writeFileSync(join(dir, "readme.txt"), "ignore me");

    const readings = loadPriorReadings(root, TEST_AGENT);
    expect(readings.length).toBe(1);
    expect(readings[0]).toEqual({ oracleIndex: 0, fractalDim: 1.322 });
  });
});

// ── E2E-7: soundnessNote is present in every probe result ─────────────────────
describe("E2E-7: soundnessNote always present", () => {
  it("probe result always carries the CHSH ill-posed disclaimer", () => {
    const root = makeTempDir();
    for (let oracle = 0; oracle < 2; oracle++) {
      for (let i = 0; i < 5; i++) {
        writeReading(root, TEST_AGENT, oracle, 1.322, `s${oracle}${i}`);
      }
    }
    const readings = loadPriorReadings(root, TEST_AGENT);
    const probe = runCommitPairProbe(readings, 42);
    expect(probe.soundnessNote).toContain("CHSH");
    expect(probe.soundnessNote).toContain("ill-posed");
    expect(probe.soundnessNote).toContain("CommitPairCorrelator");
    expect(probe.soundnessNote.length).toBeGreaterThan(100);
  });
});

// ── E2E-8: Determinism — same files + same seed → same probe result ───────────
describe("E2E-8: probe determinism", () => {
  it("same oracle readings + same seed → identical probe results", () => {
    const root = makeTempDir();
    for (let oracle = 0; oracle < 3; oracle++) {
      for (let i = 0; i < 8; i++) {
        writeReading(root, TEST_AGENT, oracle, 1.3 + oracle * 0.03 + i * 0.002, `s${oracle}${i}`);
      }
    }
    const readings = loadPriorReadings(root, TEST_AGENT);
    const probe1 = runCommitPairProbe(readings, 99999);
    const probe2 = runCommitPairProbe(readings, 99999);
    expect(probe1.meteredPairs).toBe(probe2.meteredPairs);
    expect(probe1.excessFraction).toBe(probe2.excessFraction);
    expect(probe1.isExcess).toBe(probe2.isExcess);
  });
});
