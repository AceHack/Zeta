import { describe, expect, it } from "bun:test";
import {
  dfFromKappa,
  kappaFromDf,
  runZ4Discharge,
  sleHarmonicDensity,
} from "./z4-sle-harmonic-discharge.ts";

describe("Conjecture Z-4: SLE_kappa Harmonic Measure", () => {
  it("computes kappa from D_f and vice versa", () => {
    // For theoretical D_f = 1.7125: kappa = 8 * (1.7125 - 1) = 5.7
    expect(kappaFromDf(1.7125)).toBeCloseTo(5.7, 4);
    expect(dfFromKappa(5.7)).toBeCloseTo(1.7125, 4);
  });

  it("evaluates SLE_kappa harmonic density P(theta)", () => {
    // At theta = PI/2, sin(PI/2) = 1, so P(PI/2) = 1^exponent = 1
    const p1 = sleHarmonicDensity(Math.PI / 2, 5.7);
    expect(p1).toBeCloseTo(1.0, 4);
  });

  it("executes Z-4 discharge simulation and generates certificate", () => {
    const result = runZ4Discharge(32, 60, 202);
    expect(result.Df).toBeGreaterThan(1.0);
    expect(result.estimatedKappa).toBeGreaterThan(0);
    expect(result.certificatePath).toContain("z4-discharge-certificate.json");
  });
});
