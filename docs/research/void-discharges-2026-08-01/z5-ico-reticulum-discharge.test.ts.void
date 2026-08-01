import { describe, expect, it } from "bun:test";
import {
  TSIRELSON_BELL_BOUND,
  calculateIcoBound,
  classifyCausalRegime,
  runZ5Discharge,
} from "./z5-ico-reticulum-discharge.ts";

describe("Conjecture Z-5: Reticulum Transport ICO Regime", () => {
  it("calculates ICO bound for transport latency", () => {
    // L = 5s => rho_ICO = 1 / (1 + 5) = 1/6 ≈ 0.166667
    expect(calculateIcoBound(5.0)).toBeCloseTo(1 / 6, 5);
  });

  it("classifies causal regimes correctly", () => {
    expect(classifyCausalRegime(0.25)).toBe("definite-causal");
    expect(classifyCausalRegime(0.1667)).toBe("indefinite-causal-order");
    expect(classifyCausalRegime(0.05)).toBe("classical-uncorrelated");
  });

  it("verifies Reticulum correlation is strictly below Tsirelson bound", () => {
    const ico = calculateIcoBound(5.0);
    expect(ico).toBeLessThan(TSIRELSON_BELL_BOUND);
  });

  it("executes Z-5 discharge simulation and generates certificate", () => {
    const result = runZ5Discharge(5.0);
    expect(result.success).toBeTrue();
    expect(result.isBelowTsirelson).toBeTrue();
    expect(result.isInIcoRegime).toBeTrue();
    expect(result.certificatePath).toContain("z5-discharge-certificate.json");
  });
});
