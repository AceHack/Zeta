import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyHadamardCoin,
  simulateQuantumDla,
  runPreRegisteredQuantumExperiment,
  writePreRegisteredQuantumExperiment,
} from "./quantum-walk-dla.ts";

describe("Oracle 11: Quantum Walk DLA Simulator", () => {
  it("applies unitary 4-state Hadamard coin transformation", () => {
    const [u, d, l, r] = applyHadamardCoin(1, 0, 0, 0);
    // H_4 * [1, 0, 0, 0]^T = [0.5, 0.5, 0.5, 0.5]
    expect(u).toBeCloseTo(0.5, 4);
    expect(d).toBeCloseTo(0.5, 4);
    expect(l).toBeCloseTo(0.5, 4);
    expect(r).toBeCloseTo(0.5, 4);
  });

  it("simulates single-seed Quantum DLA vs Classical DLA without error", () => {
    const res = simulateQuantumDla(32, 50, 101);
    expect(res.quantumDf).toBeGreaterThan(1.0);
    expect(res.classicalDf).toBeGreaterThan(1.0);
    expect(typeof res.deltaDf).toBe("number");
  });

  it("runs 10-seed pre-registered experiment and emits raw result JSON", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "zeta-quantum-walk-dla-"));
    try {
      const exp = runPreRegisteredQuantumExperiment(10, "2026-08-02T00:00:00.000Z");
      const written = writePreRegisteredQuantumExperiment(exp, outputDir);
      expect(written.ok).toBe(true);
      if (!written.ok) return;

      expect(exp.seedCount).toBe(10);
      expect(exp.seedResults.length).toBe(10);
      expect(["H1_CONFIRMED", "H0_ACCEPTED_ZENODECAY"]).toContain(exp.outcome);
      expect(JSON.parse(readFileSync(written.path, "utf8"))).toEqual(exp);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("reports artifact write failures as data", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "zeta-quantum-walk-dla-failure-"));
    const blockedPath = join(outputDir, "not-a-directory");
    try {
      writeFileSync(blockedPath, "occupied", "utf8");
      const exp = runPreRegisteredQuantumExperiment(1, "2026-08-02T00:00:00.000Z");
      expect(writePreRegisteredQuantumExperiment(exp, blockedPath)).toMatchObject({
        ok: false,
        detail: expect.stringContaining("artifact write failed"),
      });
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
