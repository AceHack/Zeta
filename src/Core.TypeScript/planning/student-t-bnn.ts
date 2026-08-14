/**
 * student-t-bnn.ts — Student-t likelihood EP update for non-Gaussian BNN.
 *
 * The Gaussian likelihood in MultilayerBnn assumes observation noise is
 * Gaussian. For heavy-tailed noise (outliers, non-Gaussian DLA amplitude
 * measurements), the Student-t likelihood is more robust.
 *
 * ## The Student-t EP update (2025-2026 literature)
 *
 * The Student-t distribution with ν degrees of freedom:
 *   p(y|μ,σ²) ∝ (1 + (y-μ)²/(ν·σ²))^{-(ν+1)/2}
 *
 * For EP, we approximate the Student-t factor with a Gaussian:
 *   q(μ) ∝ N(μ; m_f, v_f)
 *
 * The EP update (Minka 2001, extended to Student-t by Hernández-Lobato 2010):
 *   1. Compute cavity: m_cav = (m_post·v_f - m_f·v_post) / (v_f - v_post)
 *                      v_cav = v_f·v_post / (v_f - v_post)
 *   2. Compute z = (y - m_cav) / sqrt(v_cav + σ²_obs)
 *   3. Compute robustness weight: w = (ν + 1) / (ν + z²)  [Student-t weight]
 *   4. Update factor: m_f_new = m_cav + w·v_cav·z / sqrt(v_cav + σ²_obs)
 *                    v_f_new = v_cav - w·v_cav²·(1 - w·z²) / (v_cav + σ²_obs)
 *   5. Update posterior: 1/v_post_new = 1/v_cav + 1/v_f_new
 *                        m_post_new = v_post_new·(m_cav/v_cav + m_f_new/v_f_new)
 *
 * The key difference from Gaussian EP: the robustness weight w < 1 for
 * outliers (large |z|), which downweights the observation. For ν → ∞,
 * w → 1 and we recover the Gaussian EP update.
 *
 * ## Connection to MultilayerBnn
 *
 * StudentTBnn is a drop-in replacement for the Gaussian likelihood in
 * MultilayerBnn. The `update` function has the same signature as the
 * Gaussian update but uses the Student-t EP update instead.
 *
 * ## Honest scope boundary
 *
 * The EP update for Student-t is exact for a single factor. For multilayer
 * networks, the cavity computation requires the full EP schedule (one pass
 * per layer). This module implements the single-factor update; the multilayer
 * schedule is in MultilayerBnn.fs.
 *
 * References:
 * - Minka (2001) "A family of algorithms for approximate Bayesian inference"
 * - Hernández-Lobato & Ghahramani (2015) "Expectation propagation for neural networks"
 * - "Approximate Message Passing for Bayesian Neural Networks" (2025)
 * - "Rethinking Likelihood distributions: Student's t" (2026)
 */

// ── Types ──────────────────────────────────────────────────────────────────────

/** Gaussian belief: mean and variance. */
export interface GaussianBelief {
  readonly mu: number;
  readonly sigma2: number;
}

/** Student-t BNN state: posterior + factor message + hyperparameters. */
export interface StudentTState {
  /** Posterior belief over the parameter. */
  readonly posterior: GaussianBelief;
  /** EP factor message (Gaussian approximation to the Student-t likelihood). */
  readonly factorMu: number;
  readonly factorSigma2: number;
  /** Degrees of freedom ν (ν=1: Cauchy, ν→∞: Gaussian). */
  readonly nu: number;
  /** Observation noise variance σ²_obs. */
  readonly obsVariance: number;
  /** Number of observations absorbed. */
  readonly obsCount: number;
}

/** Result of a Student-t EP update. */
export interface StudentTUpdateResult {
  readonly state: StudentTState;
  /** The robustness weight w ∈ (0,1]. w < 1 means the observation was downweighted as an outlier. */
  readonly robustnessWeight: number;
  /** The standardised residual z = (y - m_cav) / sqrt(v_cav + σ²_obs). */
  readonly standardisedResidual: number;
  /** Whether the observation was treated as an outlier (|z| > 2). */
  readonly isOutlier: boolean;
}

// ── Constructor ────────────────────────────────────────────────────────────────

/**
 * Create a new Student-t BNN state with a Gaussian prior.
 *
 * ## Why `nu` comes first and has no default
 *
 * It used to be the third parameter with a default of `4.0`, documented as "robust
 * but not too heavy-tailed". That is a **silent vote**. `nu` is not a cosmetic knob:
 * it decides which observation the posterior believes when observations conflict.
 * Measured on the sibling society fold (`src/Bayesian/HeavyTailFold.fs`), five
 * members agreeing at 10 against one overconfident member at 0 resolve to the
 * quorum's answer for `nu` below 23.389306 and to the overconfident member's answer
 * above it. The constant chose the winner, and nobody measured the constant.
 *
 * So it is required, it is the first argument, and it is validated. A guess is still
 * legal — pass one — but it can no longer be made by saying nothing. The defensible
 * form of the assumption is an INTERVAL whose verdict does not move across it, plus
 * a coverage check; `tailSensitivity` below is this module's version of that test,
 * and `HeavyTailFold` is the full treatment.
 *
 * @param nu Degrees of freedom. REQUIRED. `nu=1` is Cauchy, `nu` to infinity is
 *   Gaussian. Must be finite and positive. Note that the modelled noise has no
 *   fourth moment for `nu <= 4`, so the old default sat exactly on the pole of the
 *   kurtosis `6/(nu-4)` — any method-of-moments estimate of `nu` is undefined there.
 * @param priorMu Prior mean (default 0)
 * @param priorSigma2 Prior variance (default 1)
 * @param obsVariance Observation noise variance (default 0.1)
 */
export function createStudentTState(
  nu: number,
  priorMu = 0.0,
  priorSigma2 = 1.0,
  obsVariance = 0.1
): StudentTState {
  if (!Number.isFinite(nu) || nu <= 0) {
    throw new RangeError(
      `nu must be finite and > 0 (a tail assumption, stated explicitly); got ${String(nu)}`
    );
  }
  return {
    posterior: { mu: priorMu, sigma2: priorSigma2 },
    factorMu: 0.0,
    factorSigma2: 1e10, // uninformative factor message
    nu,
    obsVariance,
    obsCount: 0,
  };
}

// ── EP update ─────────────────────────────────────────────────────────────────

/**
 * Student-t EP update: absorb one observation y into the state.
 * Returns the updated state and diagnostics.
 */
export function updateStudentT(state: StudentTState, y: number): StudentTUpdateResult {
  const { posterior, factorMu, factorSigma2, nu, obsVariance } = state;

  // Guard: skip NaN/Inf observations
  if (!isFinite(y)) {
    return {
      state,
      robustnessWeight: 1.0,
      standardisedResidual: 0.0,
      isOutlier: false,
    };
  }

  // 1. Compute cavity (remove factor message from posterior)
  const vPost = posterior.sigma2;
  const mPost = posterior.mu;
  const vF = factorSigma2;
  const mF = factorMu;

  // Cavity precision = posterior precision - factor precision
  const precPost = 1 / vPost;
  const precF = 1 / vF;
  const precCav = precPost - precF;

  // If cavity precision is non-positive, use prior as cavity
  const vCav = precCav > 1e-10 ? 1 / precCav : posterior.sigma2 * 10;
  const mCav = precCav > 1e-10 ? (mPost * precPost - mF * precF) / precCav : mPost;

  // 2. Standardised residual
  const totalVar = vCav + obsVariance;
  const z = (y - mCav) / Math.sqrt(totalVar);

  // 3. Student-t robustness weight: w = (ν+1) / (ν + z²)
  // For ν→∞: w→1 (Gaussian). For |z|→∞: w→0 (outlier downweighted).
  const w = (nu + 1) / (nu + z * z);

  // 4. Update factor message
  const newFactorSigma2 = Math.max(1e-10, vCav - w * vCav * vCav * (1 - w * z * z) / totalVar);
  const newFactorMu = mCav + w * vCav * z / Math.sqrt(totalVar);

  // 5. Update posterior
  const newPrecPost = 1 / vCav + 1 / newFactorSigma2;
  const newVPost = 1 / newPrecPost;
  const newMPost = newVPost * (mCav / vCav + newFactorMu / newFactorSigma2);

  const newState: StudentTState = {
    posterior: { mu: newMPost, sigma2: Math.max(1e-10, newVPost) },
    factorMu: newFactorMu,
    factorSigma2: newFactorSigma2,
    nu,
    obsVariance,
    obsCount: state.obsCount + 1,
  };

  return {
    state: newState,
    robustnessWeight: w,
    standardisedResidual: z,
    isOutlier: Math.abs(z) > 2.0,
  };
}

/**
 * Fold a stream of observations into the Student-t BNN.
 * Returns the final state and the list of update results.
 */
export function inferStudentT(
  observations: number[],
  state: StudentTState
): { state: StudentTState; results: StudentTUpdateResult[] } {
  let current = state;
  const results: StudentTUpdateResult[] = [];
  for (const y of observations) {
    const result = updateStudentT(current, y);
    current = result.state;
    results.push(result);
  }
  return { state: current, results };
}

/**
 * The effective sample size: sum of robustness weights.
 * For Gaussian noise (no outliers): ESS = obsCount.
 * For heavy-tailed noise: ESS < obsCount (outliers are downweighted).
 */
export function effectiveSampleSize(results: StudentTUpdateResult[]): number {
  return results.reduce((s, r) => s + r.robustnessWeight, 0);
}

/**
 * The outlier fraction: fraction of observations with |z| > 2.
 */
export function outlierFraction(results: StudentTUpdateResult[]): number {
  if (results.length === 0) return 0;
  return results.filter(r => r.isOutlier).length / results.length;
}

// -- The falsifier the tail assumption has to carry ---------------------------

/**
 * The floor `updateStudentT` clamps its variances to. A posterior sitting on it is
 * a DEGENERATE EP fit, not a precise one: the factor-variance update
 * `vCav - w*vCav^2*(1 - w*z^2)/totalVar` can go negative for small `nu`, the clamp
 * catches it, and the result then reports a precision of 1e10 that nothing measured.
 * Any check that reads the posterior variance as an error bar has to notice this
 * first, or it grades a conclusion against an artifact.
 */
export const EP_VARIANCE_FLOOR = 1e-10;

/** What a tail-sensitivity check found. Three states, and the third is the honest one. */
export type TailVerdict =
  /** The declared interval moves the answer by less than the answer's own error bar. */
  | "tail-independent"
  /** The answer belongs to the assumption. No single nu inside the interval may be published. */
  | "tail-dependent"
  /**
   * At least one endpoint produced a posterior variance on the EP clamp, so there is
   * no trustworthy error bar to grade against. NOT a pass and NOT a failure: the
   * check declines, which is the only claim it is entitled to make.
   */
  | "not-gradable";

export interface TailSensitivity {
  /** Posterior mean when the stream is folded at the heaviest admissible tail. */
  readonly muAtHeavyTail: number;
  /** Posterior mean when the stream is folded at the lightest admissible tail. */
  readonly muAtLightTail: number;
  /** The tightest posterior standard deviation either fold would publish. */
  readonly tightestSigma: number;
  readonly verdict: TailVerdict;
}

/**
 * Fold the same observation stream at both endpoints of a declared nu-interval and
 * compare how far the posterior mean moves against the posterior's own standard
 * deviation.
 *
 * This is the cheap, local form of the scheme-independence gate in
 * `src/Bayesian/HeavyTailFold.fs`. The comparison is between a *systematic* (how much
 * the assumption moves the answer) and a *statistical* (how precisely the answer is
 * known), both in the units of the parameter, so it introduces no new free constant to
 * replace the one the required-`nu` change removed. A POINT interval is refused for the
 * same reason `HeavyTailFold` refuses one: a verdict that depends on a single unmeasured
 * number cannot be falsified.
 */
export function tailSensitivity(
  nuLo: number,
  nuHi: number,
  observations: readonly number[],
  priorMu = 0.0,
  priorSigma2 = 1.0,
  obsVariance = 0.1
): TailSensitivity {
  if (!(nuHi > nuLo)) {
    throw new RangeError(
      `nuHi must be strictly greater than nuLo - a POINT tail index is not a checkable assumption; got [${String(nuLo)}, ${String(nuHi)}]`
    );
  }
  const heavy = inferStudentT(
    [...observations],
    createStudentTState(nuLo, priorMu, priorSigma2, obsVariance)
  ).state;
  const light = inferStudentT(
    [...observations],
    createStudentTState(nuHi, priorMu, priorSigma2, obsVariance)
  ).state;
  const s2Heavy = heavy.posterior.sigma2;
  const s2Light = light.posterior.sigma2;
  const tightestSigma = Math.sqrt(Math.min(s2Heavy, s2Light));
  const clamped =
    s2Heavy <= EP_VARIANCE_FLOOR * 10 || s2Light <= EP_VARIANCE_FLOOR * 10;
  const moved = Math.abs(heavy.posterior.mu - light.posterior.mu);
  return {
    muAtHeavyTail: heavy.posterior.mu,
    muAtLightTail: light.posterior.mu,
    tightestSigma,
    verdict: clamped
      ? "not-gradable"
      : moved > tightestSigma
        ? "tail-dependent"
        : "tail-independent",
  };
}
