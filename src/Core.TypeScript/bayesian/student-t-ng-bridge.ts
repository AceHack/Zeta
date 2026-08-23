/**
 * student-t-ng-bridge.ts — the StudentTState ⟷ NormalGamma adapter, landed.
 *
 * Prescribed (with its losses measured) in
 * `docs/research/2026-08-23-student-t-is-not-dropped-it-is-the-marginal-storing-it-as-mu-sigma-nu-is-the-degrade-and-the-ng4-api-bridge.md`
 * §4.4 — this file is that section as code, so the doc's guarantees are
 * enforced by tests instead of read.
 *
 * The load-bearing facts, from that doc (all measured there, re-measured in
 * the test file beside this one):
 *
 * 1. **The two ν's are different objects.** `StudentTState.nu` is the tail
 *    index of the observation-noise LIKELIHOOD (fixed configuration, never
 *    updated); `ngStudentT(p).nu = 2α` is the degrees of freedom of the
 *    POSTERIOR MARGINAL on the weight. They are not convertible. The 4-arg ↔
 *    4-param arity match is a COINCIDENCE (numerology-vs-number-theory: two
 *    of the four do not map, and NG4's λ has no Student-t source).
 * 2. **The adapter is honest and lossy, and the losses are named:**
 *    `posterior.mu` survives exactly (the only field the key predictor
 *    consumes); `posterior.sigma2` to one ulp; the EP site message
 *    (`factorMu`/`factorSigma2`) has no NG4 slot and is reset to the uniform
 *    site rather than faked; `nu`, `obsVariance`, `obsCount` must travel out
 *    of band — the texel is not self-describing.
 * 3. **λ₀/α₀ are a chosen convention, not a derived fact** (the harness's
 *    `lambda0 = 1, alpha0 = 1`). The same StudentTState under a different
 *    convention is a different NormalGamma; callers pass them explicitly.
 *
 * Why the carrier matters at all (doc §1–§3): in natural coordinates the
 * conjugate update is vector addition (`ngFuse`) — associative, exactly
 * representable, GPU-blend-friendly — whereas a stored `(μ,σ,ν)` triple is
 * not closed under fusion and its ν is fitted rather than counted.
 */

import type { StudentTState } from "../planning/student-t-bnn";
import { ngStudentT, type NormalGamma } from "./toy-bnn-rgba-codec";

/**
 * StudentTState → NormalGamma, under the round-trip harness convention
 * (`toy-bnn-rgba-roundtrip.ts` `layer()`): `lambda = lambda0 + n`,
 * `alpha = alpha0 + n/2`.
 *
 * DOES NOT CARRY: `state.nu`, `state.obsVariance`, `factorMu`,
 * `factorSigma2`. The first two are likelihood configuration with no NG4
 * home; the last two are the EP site diagnostic, which has no slot and must
 * not be manufactured. Carry them beside the texel (see the doc §4.4).
 */
export const studentTStateToNg = (
  st: StudentTState,
  lambda0 = 1,
  alpha0 = 1,
): NormalGamma => {
  const lambda = lambda0 + st.obsCount;
  const alpha = alpha0 + st.obsCount / 2;
  const m = st.posterior.mu;
  const beta = st.posterior.sigma2 * alpha * lambda; // scale^2 = beta/(alpha*lambda)
  return { m, lambda, alpha, beta };
};

/**
 * NormalGamma → StudentTState. The likelihood hyperparameters (`nu`,
 * `obsVariance`) and the evidence count must be supplied by the caller —
 * NG4 does not contain them. `factorMu`/`factorSigma2` are reset to the
 * honest uniform site (`+Infinity` variance): the EP diagnostic does not
 * survive the trip, and this is reported by construction rather than hidden
 * behind a plausible-looking fake.
 */
export const ngToStudentTState = (
  p: NormalGamma,
  nu: number,
  obsVariance: number,
  obsCount: number,
): StudentTState => {
  if (!Number.isFinite(nu) || nu <= 0) {
    throw new RangeError(`nu must be finite and > 0; got ${String(nu)}`);
  }
  if (!Number.isFinite(obsVariance) || obsVariance <= 0) {
    throw new RangeError(`obsVariance must be finite and > 0; got ${String(obsVariance)}`);
  }
  return {
    posterior: { mu: p.m, sigma2: ngStudentT(p).scale ** 2 },
    factorMu: p.m,
    factorSigma2: Number.POSITIVE_INFINITY,
    nu,
    obsVariance,
    obsCount,
  };
};
