/**
 * berry-keating-spectral-check.test.ts — Tests for the Berry-Keating spectral check.
 */
import { describe, it, expect } from "bun:test";
import {
  B2,
  B2_OVER_2_FACTORIAL,
  ZETA_MINUS_1,
  verifyEulerMaclaurin,
  computeBerryKeatingEigenvalues,
  checkTickSamplingSpectrum,
} from "./berry-keating-spectral-check";

describe("Berry-Keating: Bernoulli numbers", () => {
  it("BK-1: B₂ = 1/6", () => {
    expect(B2).toBeCloseTo(1 / 6, 10);
  });

  it("BK-2: B₂/2! = +1/12 (positive)", () => {
    expect(B2_OVER_2_FACTORIAL).toBeCloseTo(1 / 12, 10);
    expect(B2_OVER_2_FACTORIAL).toBeGreaterThan(0);
  });

  it("BK-3: ζ(-1) = -1/12 (negative)", () => {
    expect(ZETA_MINUS_1).toBeCloseTo(-1 / 12, 10);
    expect(ZETA_MINUS_1).toBeLessThan(0);
  });

  it("BK-4: B₂/2! and ζ(-1) have opposite signs (the sign-chain correction)", () => {
    expect(B2_OVER_2_FACTORIAL).toBeGreaterThan(0);
    expect(ZETA_MINUS_1).toBeLessThan(0);
    expect(B2_OVER_2_FACTORIAL + ZETA_MINUS_1).toBeCloseTo(0, 10); // they cancel
  });
});

describe("Berry-Keating: Euler-Maclaurin correction", () => {
  it("BK-5: Euler-Maclaurin correction for exp(-ν) matches B₂/2! prediction", () => {
    const delta = 0.01;
    const em = verifyEulerMaclaurin(delta, 100000);
    // Relative error should be < 1% for small Δ
    expect(em.relativeError).toBeLessThan(0.01);
  });

  it("BK-6: b2Term = +Δ²/12 (positive, from -Δ²/12 * I'(0) = -Δ²/12 * (-1))", () => {
    const delta = 0.1;
    const em = verifyEulerMaclaurin(delta);
    expect(em.b2Term).toBeCloseTo((delta * delta) / 12, 6);
    expect(em.b2Term).toBeGreaterThan(0);
  });

  it("BK-7: correction converges to 0 as Δ → 0", () => {
    const em1 = verifyEulerMaclaurin(0.1, 1000);
    const em2 = verifyEulerMaclaurin(0.01, 10000);
    // Smaller Δ → smaller correction
    expect(Math.abs(em2.correction)).toBeLessThan(Math.abs(em1.correction));
  });

  it("BK-8: discrete sum converges to continuous integral as Δ → 0", () => {
    const em = verifyEulerMaclaurin(0.001, 1000000);
    expect(em.discreteSum).toBeCloseTo(em.continuousIntegral, 2);
  });
});

describe("Berry-Keating: eigenvalue approximation", () => {
  it("BK-9: first eigenvalue is near 14.135 (first Riemann zero)", () => {
    const bk = computeBerryKeatingEigenvalues(10);
    // The asymptotic formula is not exact for small n, but should be in range
    expect(bk.eigenvalues[0]).toBeGreaterThan(10);
    expect(bk.eigenvalues[0]).toBeLessThan(30);
  });

  it("BK-10: eigenvalues are strictly increasing", () => {
    const bk = computeBerryKeatingEigenvalues(20);
    for (let i = 0; i < bk.eigenvalues.length - 1; i++) {
      const current = bk.eigenvalues[i];
      const next = bk.eigenvalues[i + 1];
      expect(current).toBeNumber();
      expect(next).toBeNumber();
      if (current !== undefined && next !== undefined) expect(next).toBeGreaterThan(current);
    }
  });

  it("BK-11: b2Connection = +1/12 (the Euler-Maclaurin coefficient)", () => {
    const bk = computeBerryKeatingEigenvalues(10);
    expect(bk.b2Connection).toBeCloseTo(1 / 12, 10);
  });
});

describe("Berry-Keating: tick-sampling spectral check", () => {
  it("BK-12: B₂/2! and ζ(-1) have opposite signs", () => {
    const result = checkTickSamplingSpectrum(0.1);
    expect(result.signDifference).toBe(true);
    expect(result.b2Coefficient).toBeGreaterThan(0);
    expect(result.zetaMinus1).toBeLessThan(0);
  });

  it("BK-13: connection note is present and honest", () => {
    const result = checkTickSamplingSpectrum(0.1);
    expect(result.connectionNote).toContain("§B interpretation");
    expect(result.connectionNote).toContain("opposite signs");
    expect(result.connectionNote).toContain("not a sign equation");
  });

  it("BK-14: Euler-Maclaurin relative error < 1% for Δ=0.01", () => {
    const result = checkTickSamplingSpectrum(0.01);
    expect(result.eulerMaclaurin.relativeError).toBeLessThan(0.01);
  });
});
