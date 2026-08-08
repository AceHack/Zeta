import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import {
  kappaFromDf,
  dfFromKappa,
  sleHarmonicDensity,
  runZ4Discharge,
} from "./z4-sle-harmonic-discharge.ts";

describe("Conjecture Z-4: SLE_kappa Harmonic Measure Discharge & Falsifiers", () => {
  it("calculates exact bidirectional conversion between D_f and kappa", () => {
    // D_f = 1 + kappa / 8  <=> kappa = 8 * (D_f - 1)
    const Df = 1.71;
    const kappa = kappaFromDf(Df); // 5.68
    expect(kappa).toBeCloseTo(5.68, 4);
    expect(dfFromKappa(kappa)).toBeCloseTo(Df, 4);
  });

  it("computes non-zero SLE_kappa harmonic density P(theta) on unit circle", () => {
    const theta = Math.PI / 2;
    const density = sleHarmonicDensity(theta, 5.68);
    expect(density).toBeGreaterThan(0);
  });

  it("DISCHARGES Z-4 when empirical DLA fractal dimension D_f is approx 1.71", () => {
    const tmpDir = "/tmp/z4-test-cert";
    const result = runZ4Discharge(undefined, 0.5, tmpDir);

    expect(result.success).toBeTrue();
    expect(result.Df).toBeCloseTo(1.71, 2);
    expect(result.estimatedKappa).toBeCloseTo(5.68, 2);
    expect(result.kappaError).toBeLessThanOrEqual(0.5);

    // Verify certificate file exists
    expect(fs.existsSync(result.certificatePath)).toBeTrue();
    const cert = JSON.parse(fs.readFileSync(result.certificatePath, "utf8"));
    expect(cert.status).toBe("DISCHARGED");
  });

  it("NON-VACUOUS FALSIFIER 1: fails when fractal dimension D_f drops to 1.1 (1D linear scaling)", () => {
    const linearPoints = [
      { r: 10, count: 10 },
      { r: 20, count: 20 },
      { r: 40, count: 40 },
      { r: 80, count: 80 },
    ];

    const tmpDir = "/tmp/z4-test-cert";
    const result = runZ4Discharge(linearPoints, 0.5, tmpDir);

    // MUST FAIL — falsifier gate is load-bearing!
    expect(result.success).toBeFalse();
    expect(result.Df).toBeCloseTo(1.0, 2);
    expect(result.estimatedKappa).toBeCloseTo(0.0, 2);

    const cert = JSON.parse(fs.readFileSync(result.certificatePath, "utf8"));
    expect(cert.status).toBe("FALSIFIED");
  });

  it("NON-VACUOUS FALSIFIER 2: fails when fractal dimension D_f rises to 2.0 (dense space-filling scaling)", () => {
    const densePoints = [
      { r: 10, count: 100 },
      { r: 20, count: 400 },
      { r: 40, count: 1600 },
      { r: 80, count: 6400 },
    ];

    const tmpDir = "/tmp/z4-test-cert";
    const result = runZ4Discharge(densePoints, 0.5, tmpDir);

    // MUST FAIL — D_f = 2.0 exceeds theoretical bounds!
    expect(result.success).toBeFalse();
    expect(result.Df).toBeCloseTo(2.0, 2);
  });
});
