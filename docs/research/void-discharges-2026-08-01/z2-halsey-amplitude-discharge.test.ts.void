import { describe, expect, it } from "bun:test";
import {
  calculateHalseyAmplitude,
  calculateThirdMoment,
  runZ2Discharge,
} from "./z2-halsey-amplitude-discharge.ts";

describe("Conjecture Z-2: Halsey 2026 Amplitude Formula", () => {
  it("calculates theoretical Halsey amplitude A_3(D_f) correctly", () => {
    // For D_f = 1.71 (theoretical 2D DLA): A_3(1.71) = (2 - 1.71) / (1.71 * (3 - 1.71)) = 0.29 / 2.2059 ≈ 0.13146
    const amp = calculateHalseyAmplitude(1.71);
    expect(amp).toBeCloseTo(0.13146, 3);
  });

  it("calculates 3rd moment sum(p_i^3) for probability distribution", () => {
    const probs = [0.5, 0.3, 0.2];
    // sum(p_i^3) = 0.5^3 + 0.3^3 + 0.2^3 = 0.125 + 0.027 + 0.008 = 0.160
    const m3 = calculateThirdMoment(probs);
    expect(m3).toBeCloseTo(0.16, 4);
  });

  it("executes Z-2 discharge simulation and generates certificate", () => {
    const result = runZ2Discharge(32, 50, 123);
    expect(result.meanDf).toBeGreaterThan(1.0);
    expect(result.meanDf).toBeLessThanOrEqual(2.0);
    expect(result.measuredAmplitude).toBeGreaterThan(0);
    expect(result.halseyAmplitude).toBeGreaterThan(0);
    expect(result.certificatePath).toContain("z2-discharge-certificate.json");
  });
});
