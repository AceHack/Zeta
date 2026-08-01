import { describe, expect, it } from "bun:test";
import {
  THEORETICAL_DLA_DF,
  calculateVariationalFreeEnergy,
  findFepMinimumAttractor,
  runZ6Discharge,
} from "./z6-fep-attractor-discharge.ts";

describe("Conjecture Z-6: FEP Minimum Complexity Attractor", () => {
  it("calculates variational free energy F(D_f)", () => {
    const f = calculateVariationalFreeEnergy(1.71);
    expect(Number.isNaN(f)).toBeFalse();
  });

  it("finds minimum free energy attractor near D_f = 1.71", () => {
    const { optimalDf } = findFepMinimumAttractor();
    expect(optimalDf).toBeCloseTo(THEORETICAL_DLA_DF, 1);
  });

  it("executes Z-6 discharge simulation and generates certificate", () => {
    const result = runZ6Discharge();
    expect(result.success).toBeTrue();
    expect(result.optimalDf).toBeGreaterThan(1.5);
    expect(result.optimalDf).toBeLessThan(1.9);
    expect(result.certificatePath).toContain("z6-discharge-certificate.json");
  });
});
