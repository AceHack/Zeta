/**
 * student-t-ng-bridge.test.ts — the doc's §4.4 measurements, as falsifiers.
 *
 * Every number asserted here was first printed in
 * `docs/research/2026-08-23-student-t-is-not-dropped-...-and-the-ng4-api-bridge.md`
 * §4.3–4.4 (the 4-observation fixture). The tests re-derive them through the
 * live `updateStudentT` rather than hardcoding the trajectory, so a change to
 * the filter that silently invalidates the doc turns this suite red.
 */
import { describe, expect, test } from "bun:test";
import { createStudentTState, updateStudentT } from "../planning/student-t-bnn";
import { ngFuse, ngKl, ngStudentT, ngToNp } from "./toy-bnn-rgba-codec";
import { ngToStudentTState, studentTStateToNg } from "./student-t-ng-bridge";

/** The doc's fixture: (4.0, 0.0, 1.25, 0.1) absorbing [0.5, 0.7, 3.0, 0.6]. */
function docFixtureState() {
  let st = createStudentTState(4.0, 0.0, 1.25, 0.1);
  for (const y of [0.5, 0.7, 3.0, 0.6]) {
    st = updateStudentT(st, y).state;
  }
  return st;
}

describe("the mismatch — the two ν's are different objects", () => {
  test("state.nu is invariant under update; the NG4 marginal ν = 2α is counted", () => {
    const st = docFixtureState();
    // Likelihood tail: fixed configuration, untouched by four observations.
    expect(st.nu).toBe(4.0);
    expect(st.obsVariance).toBe(0.1);
    expect(st.obsCount).toBe(4);
    // Posterior marginal ν under the harness convention (λ₀=1, α₀=1):
    // α = 1 + 4/2 = 3 → ν = 6. NOT the state's 4. Same letter, different object.
    const ng = studentTStateToNg(st);
    expect(ng.lambda).toBe(5);
    expect(ng.alpha).toBe(3);
    expect(ngStudentT(ng).nu).toBe(6);
    expect(ngStudentT(ng).nu).not.toBe(st.nu);
  });

  test("the doc's printed fixture values reproduce (the doc stays checkable)", () => {
    const st = docFixtureState();
    expect(st.posterior.mu).toBeCloseTo(0.67181345, 7);
    expect(st.posterior.sigma2).toBeCloseTo(0.041907657, 8);
    const ng = studentTStateToNg(st);
    expect(ng.beta).toBeCloseTo(0.62861486, 7);
  });
});

describe("the adapter — honest and lossy, losses named", () => {
  test("posterior.mu round-trips EXACTLY (the only field the predictor reads)", () => {
    const st = docFixtureState();
    const back = ngToStudentTState(studentTStateToNg(st), st.nu, st.obsVariance, st.obsCount);
    expect(back.posterior.mu).toBe(st.posterior.mu);
  });

  test("posterior.sigma2 round-trips to within one ulp", () => {
    const st = docFixtureState();
    const back = ngToStudentTState(studentTStateToNg(st), st.nu, st.obsVariance, st.obsCount);
    expect(Math.abs(back.posterior.sigma2 - st.posterior.sigma2)).toBeLessThan(1e-15);
  });

  test("the EP site message does not survive — reset to the uniform site, never faked", () => {
    const st = docFixtureState();
    const back = ngToStudentTState(studentTStateToNg(st), st.nu, st.obsVariance, st.obsCount);
    expect(back.factorSigma2).toBe(Number.POSITIVE_INFINITY);
    expect(back.factorMu).toBe(st.posterior.mu);
  });

  test("nu / obsVariance / obsCount travel out of band, by construction", () => {
    const st = docFixtureState();
    const back = ngToStudentTState(studentTStateToNg(st), st.nu, st.obsVariance, st.obsCount);
    expect(back.nu).toBe(st.nu);
    expect(back.obsVariance).toBe(st.obsVariance);
    expect(back.obsCount).toBe(st.obsCount);
  });

  test("λ₀/α₀ are a chosen convention: the JOINT moves, the marginal is pinned where designed", () => {
    const st = docFixtureState();
    const a = studentTStateToNg(st, 1, 1);
    const b = studentTStateToNg(st, 2, 1);
    // Different convention → different joint (this is the non-invertibility).
    expect(a.lambda).not.toBe(b.lambda);
    expect(a.beta).not.toBe(b.beta);
    // But the marginal SCALE is convention-INVARIANT by construction:
    // beta = sigma2·α·λ  ⇒  scale² = beta/(α·λ) = sigma2, for any λ₀.
    // The adapter deliberately pins the posterior variance; λ₀ moves only the joint.
    expect(ngStudentT(a).scale).toBe(ngStudentT(b).scale);
    // The marginal ν moves with α₀ (it is counted from evidence + α₀), not with λ₀.
    const c = studentTStateToNg(st, 1, 2);
    expect(ngStudentT(c).nu).not.toBe(ngStudentT(a).nu);
  });

  test("restore refuses corrupt likelihood hyperparameters", () => {
    const ng = studentTStateToNg(docFixtureState());
    expect(() => ngToStudentTState(ng, Number.NaN, 0.1, 4)).toThrow(RangeError);
    expect(() => ngToStudentTState(ng, 4, 0, 4)).toThrow(RangeError);
  });
});

describe("why the carrier is worth it — fusion in natural coordinates", () => {
  test("ngFuse is order-independent to numerical noise (vector addition, not projection)", () => {
    const s1 = docFixtureState();
    let s2 = createStudentTState(4.0, 0.5, 0.8, 0.1);
    let s3 = createStudentTState(4.0, -0.3, 2.0, 0.1);
    for (const y of [0.1, 0.2]) s2 = updateStudentT(s2, y).state;
    for (const y of [-0.4]) s3 = updateStudentT(s3, y).state;
    const [a, b, c] = [s1, s2, s3].map((s) => ngToNp(studentTStateToNg(s)));
    const left = ngFuse(ngFuse(a!, b!), c!);
    const right = ngFuse(a!, ngFuse(b!, c!));
    // The t-projection path measured ν=7 vs ν=6 depending on order (doc §1.1).
    // In natural coordinates the disagreement is at floating-point noise level.
    expect(ngKl(left, right)).toBeLessThan(1e-12);
  });
});
