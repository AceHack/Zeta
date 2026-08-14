import { describe, it, expect } from "bun:test";
import {
  createStudentTState, updateStudentT, inferStudentT,
  effectiveSampleSize, outlierFraction, tailSensitivity, EP_VARIANCE_FLOOR
} from "./student-t-bnn";

describe("Student-t BNN", () => {
  it("STB-1: fresh state has correct prior", () => {
    const s = createStudentTState(4.0, 0.5, 0.25, 0.1);
    expect(s.posterior.mu).toBeCloseTo(0.5, 6);
    expect(s.posterior.sigma2).toBeCloseTo(0.25, 6);
    expect(s.nu).toBe(4.0);
    expect(s.obsCount).toBe(0);
  });

  it("STB-2: posterior mean moves toward observation", () => {
    const s = createStudentTState(4.0, 0.0, 1.0, 0.1);
    const { state } = updateStudentT(s, 1.0);
    expect(state.posterior.mu).toBeGreaterThan(0.0);
    expect(state.obsCount).toBe(1);
  });

  it("STB-3: posterior variance decreases after observation", () => {
    const s = createStudentTState(4.0, 0.0, 1.0, 0.1);
    const { state } = updateStudentT(s, 0.5);
    expect(state.posterior.sigma2).toBeLessThan(1.0);
  });

  it("STB-4: outlier is downweighted (robustness weight < 1)", () => {
    const s = createStudentTState(4.0, 0.0, 1.0, 0.1);
    const { robustnessWeight, isOutlier } = updateStudentT(s, 10.0); // extreme outlier
    expect(robustnessWeight).toBeLessThan(1.0);
    expect(isOutlier).toBe(true);
  });

  it("STB-5: inlier has robustness weight close to 1", () => {
    const s = createStudentTState(4.0, 0.0, 1.0, 0.1);
    const { robustnessWeight, isOutlier } = updateStudentT(s, 0.1); // near-prior
    expect(robustnessWeight).toBeGreaterThan(0.8);
    expect(isOutlier).toBe(false);
  });

  it("STB-6: NaN observation is ignored", () => {
    const s = createStudentTState(4.0, 0.5, 0.25, 0.1);
    const { state } = updateStudentT(s, NaN);
    expect(state.posterior.mu).toBeCloseTo(0.5, 6);
    expect(state.obsCount).toBe(0);
  });

  it("STB-7: inferStudentT folds a stream", () => {
    const s = createStudentTState(4.0, 0.0, 1.0, 0.1);
    const obs = [0.5, 0.6, 0.4, 0.55, 0.45];
    const { state, results } = inferStudentT(obs, s);
    expect(state.obsCount).toBe(5);
    expect(results).toHaveLength(5);
    expect(state.posterior.mu).toBeGreaterThan(0.0); // moved toward observations
  });

  it("STB-8: effectiveSampleSize <= obsCount with outliers", () => {
    const s = createStudentTState(4.0, 0.0, 1.0, 0.1);
    const obs = [0.5, 0.5, 100.0, 0.5, 0.5]; // one outlier
    const { results } = inferStudentT(obs, s);
    const ess = effectiveSampleSize(results);
    expect(ess).toBeLessThan(5); // outlier downweighted
    expect(ess).toBeGreaterThan(3); // 4 inliers contribute
  });

  it("STB-9: outlierFraction correct", () => {
    const s = createStudentTState(4.0, 0.0, 1.0, 0.1);
    const obs = [0.5, 0.5, 100.0, 0.5, 0.5]; // 1/5 outliers
    const { results } = inferStudentT(obs, s);
    const frac = outlierFraction(results);
    expect(frac).toBeGreaterThan(0.0);
    expect(frac).toBeLessThan(1.0);
  });

  it("STB-10: large nu approaches Gaussian (robustness weight near 1 for moderate z)", () => {
    const sGaussian = createStudentTState(1000.0, 0.0, 1.0, 0.1); // ν→∞
    const { robustnessWeight: wG } = updateStudentT(sGaussian, 1.0);
    const sStudentT = createStudentTState(1.0, 0.0, 1.0, 0.1); // ν=1 (Cauchy)
    const { robustnessWeight: wC } = updateStudentT(sStudentT, 1.0);
    expect(wC).toBeGreaterThanOrEqual(wG); // For |z|<1, smaller nu gives larger weight (correct Student-t behavior)
  });

  // -- B3(a): the tail index stops being a silent default ----------------------
  // `nu` used to be the third parameter, defaulting to 4.0 with the comment "robust but
  // not too heavy-tailed". It is now first and required, because it is not a cosmetic
  // knob: on the sibling society fold (src/Bayesian/HeavyTailFold.fs) it decides WHICH
  // member the answer believes -- measured flip at nu = 23.389306.

  it("STB-11: nu is required and validated -- a tail assumption cannot be made by silence", () => {
    // @ts-expect-error nu is required; omitting it must not compile
    expect(() => createStudentTState()).toThrow(RangeError);
    expect(() => createStudentTState(0)).toThrow(RangeError);
    expect(() => createStudentTState(-1)).toThrow(RangeError);
    expect(() => createStudentTState(Number.NaN)).toThrow(RangeError);
    expect(() => createStudentTState(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    // a guess is still legal -- it just has to be said out loud
    expect(createStudentTState(4.0).nu).toBe(4.0);
  });

  it("STB-12: a point tail index is not a checkable assumption", () => {
    expect(() => tailSensitivity(4.0, 4.0, [1, 2, 3])).toThrow(RangeError);
    expect(() => tailSensitivity(9.0, 4.0, [1, 2, 3])).toThrow(RangeError);
  });

  it("STB-13: the check DECLINES when the EP variance is on its clamp", () => {
    // At small nu the factor-variance update goes negative and the 1e-10 floor catches
    // it, so the posterior reports a precision of 1e10 that nothing measured. Grading a
    // conclusion against that artifact would be worse than not grading it at all.
    const obs = [0.4, 0.5, 0.45, 0.55, 0.5, 0.48];
    const r = tailSensitivity(1.5, 5000.0, obs);
    expect(r.verdict).toBe("not-gradable");
    expect(r.tightestSigma * r.tightestSigma).toBeLessThan(EP_VARIANCE_FLOOR * 10);
    // and away from the clamp the check does grade
    expect(tailSensitivity(4.0, 5000.0, obs).verdict).toBe("tail-independent");
  });

  it("STB-14: one EP factor cannot make its own conclusion tail-dependent", () => {
    // Not a weakness of the check -- a property of the model. With a SINGLE Gaussian
    // factor against a Gaussian prior, the posterior mean cannot move between two tail
    // indices by more than the posterior standard deviation, so "tail-dependent" is
    // structurally unreachable here. Tail dependence needs a CONFLICT between two
    // accumulated pieces of evidence, and this module folds only one factor (its header
    // says so; note that inferStudentT over a stream still ends up reflecting only the
    // last observation, which is B2 territory and deliberately not touched here).
    //
    // This is the falsifier for that claim: if the accumulation is ever fixed, some cell
    // below WILL come back tail-dependent, and this test should fail loudly rather than
    // let the fix land with its tail assumption unexamined.
    for (const priorSigma2 of [0.01, 0.1, 1.0, 10.0]) {
      for (const obsVariance of [0.001, 0.01, 0.1, 1.0]) {
        for (const y of [0.5, 1.5, 3.0, 8.0, 25.0]) {
          const r = tailSensitivity(3.0, 5000.0, [y], 0.0, priorSigma2, obsVariance);
          expect(r.verdict).not.toBe("tail-dependent");
        }
      }
    }
  });
});
