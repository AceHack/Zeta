/**
 * Bayesian linear classifier — diagonal Gaussian weight posterior, probit
 * likelihood, updated by Gaussian moment matching. One-vs-rest for multi-class.
 *
 * WHAT IT IS, NAMED HONESTLY. This is **assumed density filtering** (ADF), not
 * full expectation propagation. ADF is EP's single forward pass: each example
 * is absorbed once and the posterior is projected back to the Gaussian family
 * by matching moments. Full EP additionally stores a per-example site and
 * refines it against the cavity distribution, which this does not do. Calling
 * it "EP" would be an unchecked anchor — the citation would be real and the
 * claim it supports would not be.
 *
 * Anchors (Beacon):
 *   - Thomas Minka, "A family of algorithms for approximate Bayesian
 *     inference", MIT PhD thesis (2001) — ADF as the one-pass special case of
 *     EP, and the Gaussian moment-matching projection used below.
 *   - Herbrich, Graepel & Campbell, "Bayes Point Machines", JMLR 1:245-279
 *     (2001) — the Gaussian-posterior-over-a-linear-classifier model itself.
 *   - Herbrich, Minka & Graepel, "TrueSkill(TM): A Bayesian Skill Rating
 *     System", NeurIPS 2006 — the v/w correction functions in the exact form
 *     used here. `src/Core/TravelerRankLedger.fs` already anchors TrueSkill in
 *     this repo, so this is the same inference family the factory runs.
 *
 * RELATION TO src/Bayesian — THIS IS THE SAME UPDATE, NOT A SIMILAR ONE.
 *
 * `ToyBosonFermionBnn.absorb` (F#) routes its update through the projected
 * moments returned by `Ep.probitProject`:
 *
 *     z     = m / sqrt(1+v)                       (probitProject; beta = 1)
 *     lam   = phi(z)/Phi(z)
 *     mHat  = m + v*lam/sqrt(1+v)
 *     vHat  = v - v^2 * lam*(z+lam)/(1+v)
 *     alpha = (mHat - m)/v   =  lam/sqrt(1+v)
 *     beta  = (v - vHat)/v^2 =  lam*(z+lam)/(1+v)  =  w(z)/(1+v)
 *
 * then `mean[i] += var[i]*s*x[i]*alpha` and `var[i] -= var[i]^2*x[i]^2*beta`.
 *
 * This file computes `dm = sign*v(t)/s` and `dv = w(t)/s2` where
 * `s2 = beta^2 + sum(var*x^2)`. At `beta = 1` these are algebraically the very
 * same two quantities — `dm == alpha`, `dv == beta` — so the loops agree term
 * for term. It is a re-derivation of the identical update in the pipeline's
 * language, done because `src/Bayesian` has NO callable entry point outside
 * `dotnet test`: no executable in the repo holds a ProjectReference to
 * `Bayesian.fsproj`, so a statistics lane could only reach it by invoking the
 * test host, which is the wrong dependency for a scheduled job.
 *
 * The agreement is CHECKED, not asserted — `bnn.test.ts` reproduces the F#
 * fold exactly (`orderPolicy: 'as-given'`, `minVariance: 1e-8`, prior N(0,1))
 * against decimal-in-JSON vectors. Text vectors, per no-binary-in-the-proof-
 * lineage.
 *
 * Register: `toy`. It is a linear model wearing a Bayesian posterior; the
 * posterior variance is used for the abstention/uncertainty ranking, and
 * whether that ranking is worth anything is exactly what the study measures.
 */

import { mulberry32 } from './rng.ts';

/** Standard normal PDF. */
export function phi(z: number): number {
  return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
}

/**
 * Standard normal CDF via the complementary error function.
 *
 * Uses the Numerical-Recipes `erfc` rational approximation (|eps| < 1.2e-7),
 * which matters at the tails: a naive series loses all precision for z < -6
 * and would silently return 0, making `v()` below divide by zero on exactly
 * the confident-and-wrong examples that carry the most information.
 */
export function Phi(z: number): number {
  return 0.5 * erfc(-z / Math.SQRT2);
}

export function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 2 / (2 + z);
  const ty = 4 * t - 2;
  const cof = [
    -1.3026537197817094, 6.4196979235649026e-1, 1.9476473204185836e-2,
    -9.561514786808631e-3, -9.46595344482036e-4, 3.66839497852761e-4,
    4.2523324806907e-5, -2.0278578112534e-5, -1.624290004647e-6,
    1.303655835580e-6, 1.5626441722e-8, -8.5238095915e-8,
    6.529054439e-9, 5.059343495e-9, -9.91364156e-10,
    -2.27365122e-10, 9.6467911e-11, 2.394038e-12,
    -6.886027e-12, 8.94487e-13, 3.13092e-13,
    -1.12708e-13, 3.81e-16, 7.106e-15,
  ];
  let d = 0;
  let dd = 0;
  for (let j = cof.length - 1; j > 0; j--) {
    const tmp = d;
    d = ty * d - dd + cof[j]!;
    dd = tmp;
  }
  const ans = t * Math.exp(-z * z + 0.5 * (cof[0]! + ty * d) - dd);
  return x >= 0 ? ans : 2 - ans;
}

/**
 * TrueSkill's v(t) = phi(t)/Phi(t) — the mean correction from a truncated
 * Gaussian. Guarded in the far-left tail where phi and Phi both underflow: the
 * limit of v(t) as t -> -inf is -t, and returning that keeps the update finite
 * and correctly signed instead of producing NaN.
 */
export function vFunc(t: number): number {
  const denom = Phi(t);
  if (denom < 1e-300) return -t;
  return phi(t) / denom;
}

/** TrueSkill's w(t) = v(t) * (v(t) + t), the variance correction. In (0, 1). */
export function wFunc(t: number): number {
  const v = vFunc(t);
  const w = v * (v + t);
  // Clamp for numerical safety: the exact quantity is provably in (0,1), so a
  // value outside that is float error, and letting it through would drive the
  // posterior variance negative.
  return w <= 0 ? 0 : w >= 1 ? 1 : w;
}

export interface BnnOptions {
  /** Prior variance on every weight. Larger = flatter prior = faster fitting. */
  readonly priorVariance: number;
  /** Observation noise beta; the probit slope. */
  readonly beta: number;
  /** ADF passes. 1 is the principled setting — see the warning below. */
  readonly passes: number;
  /** Multiplies each update; < 1 damps, which stabilises multi-pass runs. */
  readonly damping: number;
  readonly seed: number;
  /**
   * Visitation order. `'shuffled'` (default) removes the corpus's sort order;
   * `'as-given'` folds examples in the order supplied, which is what the F#
   * `train` does and is therefore required to reproduce its golden vectors.
   */
  readonly orderPolicy?: 'shuffled' | 'as-given';
  /** Variance floor. 1e-8 matches `ToyBosonFermionBnn.minVariance` exactly. */
  readonly minVariance?: number;
}

export const DEFAULT_BNN: BnnOptions = {
  priorVariance: 1.0,
  beta: 1.0,
  passes: 1,
  damping: 1.0,
  seed: 20260827,
  orderPolicy: 'shuffled',
  minVariance: 1e-8,
};

/** A single one-vs-rest binary model: a diagonal Gaussian over the weights. */
export interface BinaryBnn {
  readonly mean: Float64Array;
  readonly variance: Float64Array;
}

/**
 * Fit one binary ADF classifier.
 *
 * `y[i]` is +1 or -1. Examples are visited in a seeded shuffled order because
 * ADF is order-dependent by construction (it is a filter): a corpus sorted by
 * PR number is also sorted by time and by area, and absorbing it in that order
 * would make the posterior a function of the sort, not of the data.
 *
 * MULTI-PASS WARNING: `passes > 1` re-absorbs every example, which
 * double-counts evidence and shrinks the posterior variance below what the
 * data supports. It is offered because it often improves the point estimate,
 * and it is named here so nobody reads the resulting variances as calibrated.
 */
export function trainBinaryBnn(
  X: readonly Float64Array[],
  y: readonly number[],
  opts: BnnOptions = DEFAULT_BNN,
): BinaryBnn {
  const dim = X[0]!.length;
  const mean = new Float64Array(dim);
  const variance = new Float64Array(dim).fill(opts.priorVariance);
  const order = Array.from({ length: X.length }, (_, i) => i);
  if ((opts.orderPolicy ?? 'shuffled') === 'shuffled') {
    const rng = mulberry32(opts.seed);
    for (let i = order.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
  }

  const beta2 = opts.beta * opts.beta;
  const floor = opts.minVariance ?? 1e-8;
  for (let p = 0; p < opts.passes; p++) {
    for (const i of order) {
      const x = X[i]!;
      const sign = y[i]! >= 0 ? 1 : -1;
      let mu = 0;
      let s2 = beta2;
      for (let f = 0; f < dim; f++) {
        mu += mean[f]! * x[f]!;
        s2 += variance[f]! * x[f]! * x[f]!;
      }
      const s = Math.sqrt(s2);
      if (!(s > 0) || !Number.isFinite(mu)) continue;
      const t = (sign * mu) / s;
      const v = vFunc(t);
      const w = wFunc(t);
      const dm = (opts.damping * sign * v) / s;
      const dv = (opts.damping * w) / s2;
      for (let f = 0; f < dim; f++) {
        const xf = x[f]!;
        if (xf === 0) continue;
        const vf = variance[f]!;
        mean[f]! += vf * xf * dm;
        // Variance strictly decreases: w in (0,1) makes the factor in (0,1).
        variance[f] = vf - vf * vf * xf * xf * dv;
        if (variance[f]! < floor) variance[f] = floor;
      }
    }
  }
  return { mean, variance };
}

export interface MultiBnn {
  readonly models: readonly BinaryBnn[];
  readonly nClasses: number;
  readonly options: BnnOptions;
}

/** One-vs-rest: one binary posterior per class, fitted independently. */
export function trainBnn(
  X: readonly Float64Array[],
  y: readonly number[],
  nClasses: number,
  opts: BnnOptions = DEFAULT_BNN,
): MultiBnn {
  const models: BinaryBnn[] = [];
  for (let c = 0; c < nClasses; c++) {
    const yc = y.map((v) => (v === c ? 1 : -1));
    // Distinct per-class seed: identical seeds would give every class the same
    // visitation order, correlating the one-vs-rest models through their
    // order-dependence rather than through the data.
    models.push(trainBinaryBnn(X, yc, { ...opts, seed: opts.seed + c * 2654435761 }));
  }
  return { models, nClasses, options: opts };
}

/**
 * Predictive probability per class: Phi(mu / sqrt(s2)), the probit likelihood
 * integrated over the Gaussian weight posterior (this integral is exact for
 * the probit link, which is why probit rather than logit is used).
 *
 * One-vs-rest scores are NOT a distribution — they do not sum to 1 — so they
 * are normalised for reporting only. The normalisation is cosmetic and the
 * argmax is unaffected by it.
 */
export function bnnPredictProba(m: MultiBnn, x: Float64Array): Float64Array {
  const out = new Float64Array(m.nClasses);
  const beta2 = m.options.beta * m.options.beta;
  for (let c = 0; c < m.nClasses; c++) {
    const { mean, variance } = m.models[c]!;
    let mu = 0;
    let s2 = beta2;
    for (let f = 0; f < x.length; f++) {
      mu += mean[f]! * x[f]!;
      s2 += variance[f]! * x[f]! * x[f]!;
    }
    out[c] = Phi(mu / Math.sqrt(s2));
  }
  let sum = 0;
  for (let c = 0; c < m.nClasses; c++) sum += out[c]!;
  if (sum > 0) for (let c = 0; c < m.nClasses; c++) out[c]! /= sum;
  return out;
}

export function bnnPredict(m: MultiBnn, X: readonly Float64Array[]): number[] {
  return X.map((x) => {
    const p = bnnPredictProba(m, x);
    let bi = 0;
    for (let i = 1; i < p.length; i++) if (p[i]! > p[bi]!) bi = i;
    return bi;
  });
}
