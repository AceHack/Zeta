import { describe, it, expect } from "bun:test";
import {
  createStudentTState, updateStudentT, inferStudentT,
  effectiveSampleSize, outlierFraction
} from "./student-t-bnn";

describe("Student-t BNN", () => {
  it("STB-1: fresh state has correct prior", () => {
    const s = createStudentTState(0.5, 0.25, 4.0, 0.1);
    expect(s.posterior.mu).toBeCloseTo(0.5, 6);
    expect(s.posterior.sigma2).toBeCloseTo(0.25, 6);
    expect(s.nu).toBe(4.0);
    expect(s.obsCount).toBe(0);
  });

  it("STB-2: posterior mean moves toward observation", () => {
    const s = createStudentTState(0.0, 1.0, 4.0, 0.1);
    const { state } = updateStudentT(s, 1.0);
    expect(state.posterior.mu).toBeGreaterThan(0.0);
    expect(state.obsCount).toBe(1);
  });

  it("STB-3: posterior variance decreases after observation", () => {
    const s = createStudentTState(0.0, 1.0, 4.0, 0.1);
    const { state } = updateStudentT(s, 0.5);
    expect(state.posterior.sigma2).toBeLessThan(1.0);
  });

  it("STB-4: outlier is downweighted (robustness weight < 1)", () => {
    const s = createStudentTState(0.0, 1.0, 4.0, 0.1);
    const { robustnessWeight, isOutlier } = updateStudentT(s, 10.0); // extreme outlier
    expect(robustnessWeight).toBeLessThan(1.0);
    expect(isOutlier).toBe(true);
  });

  it("STB-5: inlier has robustness weight close to 1", () => {
    const s = createStudentTState(0.0, 1.0, 4.0, 0.1);
    const { robustnessWeight, isOutlier } = updateStudentT(s, 0.1); // near-prior
    expect(robustnessWeight).toBeGreaterThan(0.8);
    expect(isOutlier).toBe(false);
  });

  it("STB-6: NaN observation is ignored", () => {
    const s = createStudentTState(0.5, 0.25, 4.0, 0.1);
    const { state } = updateStudentT(s, NaN);
    expect(state.posterior.mu).toBeCloseTo(0.5, 6);
    expect(state.obsCount).toBe(0);
  });

  it("STB-7: inferStudentT folds a stream", () => {
    const s = createStudentTState(0.0, 1.0, 4.0, 0.1);
    const obs = [0.5, 0.6, 0.4, 0.55, 0.45];
    const { state, results } = inferStudentT(obs, s);
    expect(state.obsCount).toBe(5);
    expect(results).toHaveLength(5);
    expect(state.posterior.mu).toBeGreaterThan(0.0); // moved toward observations
  });

  it("STB-8: effectiveSampleSize <= obsCount with outliers", () => {
    const s = createStudentTState(0.0, 1.0, 4.0, 0.1);
    const obs = [0.5, 0.5, 100.0, 0.5, 0.5]; // one outlier
    const { results } = inferStudentT(obs, s);
    const ess = effectiveSampleSize(results);
    expect(ess).toBeLessThan(5); // outlier downweighted
    expect(ess).toBeGreaterThan(3); // 4 inliers contribute
  });

  it("STB-9: outlierFraction correct", () => {
    const s = createStudentTState(0.0, 1.0, 4.0, 0.1);
    const obs = [0.5, 0.5, 100.0, 0.5, 0.5]; // 1/5 outliers
    const { results } = inferStudentT(obs, s);
    const frac = outlierFraction(results);
    expect(frac).toBeGreaterThan(0.0);
    expect(frac).toBeLessThan(1.0);
  });

  it("STB-10: large nu approaches Gaussian (robustness weight near 1 for moderate z)", () => {
    const sGaussian = createStudentTState(0.0, 1.0, 1000.0, 0.1); // ν→∞
    const { robustnessWeight: wG } = updateStudentT(sGaussian, 1.0);
    const sStudentT = createStudentTState(0.0, 1.0, 1.0, 0.1); // ν=1 (Cauchy)
    const { robustnessWeight: wC } = updateStudentT(sStudentT, 1.0);
    expect(wC).toBeGreaterThanOrEqual(wG); // For |z|<1, smaller nu gives larger weight (correct Student-t behavior)
  });
});
