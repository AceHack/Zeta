import { describe, expect, it } from "bun:test";
import {
  applyHadamardCoin,
  simulateQuantumDla,
  runPreRegisteredQuantumExperiment,
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
    const exp = runPreRegisteredQuantumExperiment(10);
    expect(exp.seedCount).toBe(10);
    expect(exp.seedResults.length).toBe(10);
    expect(["H1_CONFIRMED", "H0_ACCEPTED_ZENODECAY"]).toContain(exp.outcome);
  });
});
