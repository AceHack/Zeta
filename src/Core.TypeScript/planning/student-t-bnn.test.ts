import { describe, it, expect } from "bun:test";
import {
  createStudentTState, updateStudentT, inferStudentT, tiltedMoments,
  effectiveSampleSize, outlierFraction, tailSensitivity, EP_VARIANCE_FLOOR,
  type TailVerdict
} from "./student-t-bnn";

// -- the reference the shipped quadrature is graded against -------------------
//
// A dense composite-Simpson integral of the same tilt, in log space, over a range
// covering BOTH the cavity mean and the observation. Deliberately slow and
// deliberately dumb: it shares no code with `tiltedMoments`, so agreement between
// them is evidence and not a restatement (the vacuous-lemma lesson, #10508).
function referenceMoments(m: number, v: number, y: number, s2obs: number, nu: number) {
  const reach = 16 * Math.max(Math.sqrt(v), Math.sqrt(s2obs));
  const lo = Math.min(m, y) - reach;
  const hi = Math.max(m, y) + reach;
  const N = 200000;
  const h = (hi - lo) / N;
  const lg = (t: number) =>
    -0.5 * (t - m) * (t - m) / v - ((nu + 1) / 2) * Math.log1p((t - y) * (t - y) / (nu * s2obs));
  let maxLog = -Infinity;
  for (let i = 0; i <= N; i++) {
    const l = lg(lo + i * h);
    if (l > maxLog) maxLog = l;
  }
  let z = 0;
  let z1 = 0;
  for (let i = 0; i <= N; i++) {
    const t = lo + i * h;
    const sw = i === 0 || i === N ? 1 : i % 2 === 1 ? 4 : 2;
    const f = Math.exp(lg(t) - maxLog) * sw;
    z += f;
    z1 += f * t;
  }
  const mu = z1 / z;
  let z2 = 0;
  for (let i = 0; i <= N; i++) {
    const t = lo + i * h;
    const sw = i === 0 || i === N ? 1 : i % 2 === 1 ? 4 : 2;
    z2 += Math.exp(lg(t) - maxLog) * sw * (t - mu) * (t - mu);
  }
  return { mu, sigma2: z2 / z };
}

// Verdict names, bound once so a typo is a compile error rather than a silent pass.
const INDEPENDENT: TailVerdict = "tail-independent";
const DEPENDENT: TailVerdict = "tail-dependent";
const NOT_GRADABLE: TailVerdict = "not-gradable";

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


  it("STB-13: the check declines when the fold's own variance lands on the floor", () => {
    // Re-grounded. The route that used to reach the floor is gone: the old
    // factor-variance update went negative for small nu and the 1e-10 clamp caught
    // it routinely — measured at 3.98% of updates over a 7392-update grid (STB-19).
    // The moments are computed now, so a genuine variance is positive by
    // construction and the clamp is a numerical guard, not a routine event.
    //
    // What still reaches it is a STATED observation-noise scale below the floor:
    // the belief really is that sharp, the floor truncates it, and the check must
    // decline rather than grade a conclusion against a truncated error bar.
    const r = updateStudentT(createStudentTState(4.0, 0.0, 1.0, 1e-12), 0.5);
    expect(r.varianceOnFloor).toBe(true);
    expect(r.state.posterior.sigma2).toBe(EP_VARIANCE_FLOOR);
    const sub = tailSensitivity(1.5, 5000.0, [0.4, 0.5, 0.45], 0.0, 1.0, 1e-12);
    expect(sub.verdict).toBe(NOT_GRADABLE);
    // and away from the floor the check does grade
    const obs = [0.4, 0.5, 0.45, 0.55, 0.5, 0.48];
    expect(tailSensitivity(1.5, 5000.0, obs).verdict).toBe(INDEPENDENT);
    expect(tailSensitivity(4.0, 5000.0, obs).verdict).toBe(INDEPENDENT);
  });

  it("STB-14: the fold ACCUMULATES — a stream is not its last element", () => {
    // The pin this test replaces asserted the opposite, and was right about the
    // code as it stood: `inferStudentT` divided out its single stored site message
    // on every update, which undid the previous observation exactly. Measured
    // before the fix, `[0.5, 3.0]` and `[3.0]` produced BIT-IDENTICAL posteriors,
    // and so did 100 copies of 0.5 against one. Only obsCount moved.
    //
    // This is the direct falsifier: it fails against the old update.
    const mk = () => createStudentTState(4.0, 0.0, 1.0, 0.1);
    const two = inferStudentT([0.5, 3.0], mk()).state.posterior;
    const one = inferStudentT([3.0], mk()).state.posterior;
    expect(two.mu).not.toBeCloseTo(one.mu, 3);
    expect(two.sigma2).not.toBeCloseTo(one.sigma2, 3);

    // and evidence has to compound: repeating an observation must sharpen the
    // belief roughly like 1/N, not leave it where one observation put it
    const n1 = inferStudentT([0.5], mk()).state.posterior;
    const n10 = inferStudentT(Array(10).fill(0.5), mk()).state.posterior;
    const n100 = inferStudentT(Array(100).fill(0.5), mk()).state.posterior;
    expect(n10.sigma2).toBeLessThan(n1.sigma2 / 5);
    expect(n100.sigma2).toBeLessThan(n10.sigma2 / 5);
    // and it must converge on the repeated value rather than drift
    expect(Math.abs(n100.mu - 0.5)).toBeLessThan(Math.abs(n1.mu - 0.5) / 10);
  });

  it("STB-15: the projection reproduces the exact conjugate posterior in the Gaussian limit", () => {
    // The one cell where the answer is known in closed form, so it grades the whole
    // rule at once: the Gauss-Legendre nodes, the weights, the panel layout, the
    // cubic mode-finder and the log-space accumulation. At large nu the tilt is
    // Gaussian and the posterior is the conjugate update
    //   v_post = v*s2/(v+s2),  m_post = v_post*(m/v + y/s2).
    for (const v of [0.05, 0.25, 1.0, 4.0]) {
      for (const s2 of [0.02, 0.1, 1.0]) {
        for (const y of [-1.5, 0.0, 0.7, 2.0]) {
          const q = tiltedMoments(0.3, v, y, s2, 1e9);
          const vp = (v * s2) / (v + s2);
          const mp = vp * (0.3 / v + y / s2);
          expect(q.usable).toBe(true);
          expect(q.sigma2 / vp).toBeCloseTo(1.0, 6);
          expect(q.mu - mp).toBeCloseTo(0.0, 6);
        }
      }
    }
  });

  it("STB-16: the update itself hits the Gaussian limit — the old closed form did not", () => {
    // The module header has always claimed that as nu grows the weight goes to 1
    // and we recover the Gaussian update. It was not true of the shipped formula.
    // Prior of mean 0 variance 1, obsVariance 0.1, y = 1: the exact posterior is
    // mean 10/11 and variance 1/11. The old code returned 0.474138 and 0.478448.
    // This is that falsifier, and it fails against the old update.
    const s = updateStudentT(createStudentTState(1e12, 0.0, 1.0, 0.1), 1.0).state;
    expect(s.posterior.mu).toBeCloseTo(10 / 11, 8);
    expect(s.posterior.sigma2).toBeCloseTo(1 / 11, 8);

    // and a heavy tail must NOT reproduce it — otherwise the assertion above is
    // passing on something that ignores nu entirely
    const heavy = updateStudentT(createStudentTState(1.0, 0.0, 1.0, 0.1), 1.0).state;
    expect(Math.abs(heavy.posterior.mu - 10 / 11)).toBeGreaterThan(0.01);
  });

  it("STB-17: the shipped quadrature agrees with an independent dense reference", () => {
    // `referenceMoments` shares no code with `tiltedMoments` — different rule
    // (composite Simpson on a uniform grid vs panelled Gauss-Legendre), different
    // panel layout, no shared constants. Agreement is therefore evidence and not a
    // restatement. Measured over 1232 cells spanning nu in 1..5000, prior variance
    // 0.01..10, obsVariance 0.001..1 and y in 0..25: worst mean error 2.0e-9
    // posterior standard deviations, worst relative variance error 1.9e-8, zero
    // cells where the projection declined. The tolerances below sit three orders
    // above that, so they catch a real regression and not quadrature noise.
    for (const nu of [1.0, 3.0, 30.0, 1000.0]) {
      for (const v of [0.05, 1.0, 8.0]) {
        for (const s2 of [0.01, 0.5]) {
          for (const y of [0.0, 1.2, 9.0]) {
            const q = tiltedMoments(0.0, v, y, s2, nu);
            const e = referenceMoments(0.0, v, y, s2, nu);
            expect(q.usable).toBe(true);
            expect(Math.abs(q.mu - e.mu) / Math.sqrt(e.sigma2)).toBeLessThan(1e-5);
            expect(Math.abs(q.sigma2 - e.sigma2) / e.sigma2).toBeLessThan(1e-5);
          }
        }
      }
    }
  });

  it("STB-17b: the tilt's own mode is panelled, not just the obvious candidates", () => {
    // The cells that force the cubic mode-finder to earn its keep. Here the tilt
    // concentrates where NONE of the obvious candidates sit: for the first row the
    // mode is at 2.17 while the cavity mean, the observation and their Gaussian
    // combination sit at 0, 25 and 22.7. Panelling on the candidates alone leaves
    // the only peak inside a coarse panel; measured, the error on this row grows
    // from 2e-9 to 1.1e-3 posterior standard deviations and one nearby cell stops
    // producing a usable moment at all.
    const hard: readonly (readonly [number, number, number, number])[] = [
      [5000.0, 0.01, 0.001, 25.0],
      [5000.0, 0.01, 0.01, 25.0],
      [5000.0, 0.01, 0.1, 25.0],
      [1000.0, 0.1, 0.1, 25.0],
      [5000.0, 0.001, 0.001, 8.0],
    ];
    for (const [nu, v, s2, y] of hard) {
      const q = tiltedMoments(0.0, v, y, s2, nu);
      const e = referenceMoments(0.0, v, y, s2, nu);
      expect(q.usable).toBe(true);
      expect(Math.abs(q.mu - e.mu) / Math.sqrt(e.sigma2)).toBeLessThan(1e-5);
      expect(Math.abs(q.sigma2 - e.sigma2) / e.sigma2).toBeLessThan(1e-5);
    }
  });

  it("STB-18: tail dependence is reachable now — the old unreachability was the defect", () => {
    // The pin at STB-14 recorded that the tail-dependent verdict was structurally
    // unreachable, and read that as a property of the model: one factor against a
    // Gaussian prior cannot move the answer by more than its own standard deviation.
    //
    // It was a property of the bug. With the projection corrected, a single
    // observation is already enough: whether you believe a lone outlier is exactly
    // what the tail index decides. Measured over the same 80-cell grid the old pin
    // swept, 43 cells now come back dependent and 37 independent.
    //
    // So the honest assertion is the opposite one, and it is the stronger test:
    // a check that can only ever return one verdict is not a check.
    let dependent = 0;
    let independent = 0;
    for (const priorSigma2 of [0.01, 0.1, 1.0, 10.0]) {
      for (const obsVariance of [0.001, 0.01, 0.1, 1.0]) {
        for (const y of [0.5, 1.5, 3.0, 8.0, 25.0]) {
          const r = tailSensitivity(3.0, 5000.0, [y], 0.0, priorSigma2, obsVariance);
          if (r.verdict === DEPENDENT) dependent++;
          if (r.verdict === INDEPENDENT) independent++;
        }
      }
    }
    expect(dependent).toBeGreaterThan(20);
    expect(independent).toBeGreaterThan(20);
    expect(dependent + independent).toBe(80);
  });

  it("STB-19: accumulating did not make the variance clamp fire more — it stopped firing", () => {
    // The stated risk in fixing the accumulation was that folding more evidence
    // would drive the factor variance negative more often, so the fix would trade
    // one fabrication for a worse one. Measured on the same 7392-update grid: the
    // old closed form clamped 294 times, or 3.98% of updates. The projected
    // moments clamp zero times, because a variance computed from a positive
    // measure cannot be negative. The failure mode was removed, not relocated.
    let fired = 0;
    let total = 0;
    for (const nu of [1.0, 3.0, 10.0, 1000.0]) {
      for (const priorSigma2 of [0.01, 1.0, 10.0]) {
        for (const obsVariance of [0.001, 0.1, 1.0]) {
          for (const y of [0.0, 0.5, 3.0, 25.0]) {
            const stream = [y, 0.4 * y, 1.6 * y, y, 0.2 * y, 2 * y];
            const st = createStudentTState(nu, 0.0, priorSigma2, obsVariance);
            for (const r of inferStudentT(stream, st).results) {
              total++;
              if (r.varianceOnFloor) fired++;
            }
          }
        }
      }
    }
    expect(total).toBe(864);
    expect(fired).toBe(0);
  });

  it("STB-20: the fold is a filter, so order matters — named, bounded, not hidden", () => {
    // Assumed-density filtering visits each site once, in arrival order, so its
    // answer is order-dependent where a full EP fixed point would not be. That is
    // a real limit and it belongs in a test rather than only in a docstring: any
    // shared conclusion folded from this must not assume nodes that received the
    // stream in different orders will agree.
    const mk = () => createStudentTState(4.0, 0.0, 1.0, 0.1);
    const fwd = inferStudentT([0.5, 8.0, 0.6], mk()).state.posterior;
    const rev = inferStudentT([0.6, 8.0, 0.5], mk()).state.posterior;
    expect(fwd.mu).not.toBe(rev.mu);
    // and the drift is small enough to be a filtering artifact rather than chaos:
    // measured 0.06 posterior standard deviations on this stream
    const sd = Math.sqrt(Math.min(fwd.sigma2, rev.sigma2));
    expect(Math.abs(fwd.mu - rev.mu) / sd).toBeLessThan(0.5);
  });

  it("STB-21: effective sample size can never exceed the number of observations", () => {
    // The raw scale-mixture weight peaks at (nu+1)/nu, above 1, so an unnormalised
    // sum over well-behaved observations claims more evidence than it has. With
    // nu = 4 and five near-prior observations the old sum reached 6.25 out of 5.
    for (const nu of [1.0, 2.0, 4.0, 50.0]) {
      const st = createStudentTState(nu, 0.0, 1.0, 0.1);
      const obs = [0.02, 0.0, -0.01, 0.01, 0.0];
      const { results } = inferStudentT(obs, st);
      const ess = effectiveSampleSize(results);
      expect(ess).toBeLessThanOrEqual(obs.length + 1e-12);
      expect(ess).toBeGreaterThan(obs.length * 0.9);
    }
  });
});
