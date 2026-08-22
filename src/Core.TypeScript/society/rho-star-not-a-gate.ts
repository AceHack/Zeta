#!/usr/bin/env bun
/**
 * rho-star-not-a-gate.ts — **the falsifier for any future `rho*` claim** (obligation L3 of
 * `docs/research/2026-08-14-does-society-beats-best-individual-lift-to-world-beats-best-society-the-dominance-lift-theorem.md`,
 * assigned to shadow and undischarged until this file).
 *
 * `rho*(N) = (N-3)/(3(N-1))` is a §A frozen-core result and this module does not dispute it. It
 * disputes a use: reaching for `rho*` as the **gate** on a measured correlation. Three independent
 * reasons, each machine-checked in the sibling test rather than asserted here.
 *
 * ## 1. `rho` is not a sufficient statistic for the verdict
 *
 * The Dominance Lift work searched two-point exchangeable mixing laws and found reversals — majority
 * vote scoring WORSE than a single voter — at correlations *below* `rho*(m)`. By de Finetti (1931)
 * every exchangeable binary sequence is a mixture of iid Bernoulli(theta), and the exact criterion
 *
 *     P(majority correct) - P(one voter correct) = E_theta[ maj_m(theta) - theta ]
 *
 * depends on **where the mixing law sits relative to theta = 1/2**, which a scalar correlation cannot
 * express. Two worlds with identical `m` and identical `rho` land on opposite sides. So `rho*` is
 * "neither an upper nor a lower bound" — it crosses the true reversal locus instead of bounding it,
 * and is unsafe for `c <~ 0.68`.
 *
 * **Reproduction note, owned.** The published table rounds its mixing law to three decimals, and at
 * those rounded values the `m = 9` row computes to `rho = 0.2501` — marginally OUTSIDE the safe
 * region it is cited as being inside. Recomputed here at the precision that actually reproduces the
 * claim: `theta_hi = 0.998` gives `rho = 0.2493 < rho*(9) = 0.25` with the same reversal. The
 * finding stands; the tabulated row did not reproduce at its published precision, and the `m = 51`
 * row reproduces unchanged. Both are pinned below so the correction cannot rot back.
 *
 * ## 2. `rho*` belongs to MAJORITY vote; the meter beside it measures a UNION
 *
 * `rho*` exists only under conjunctive/adjudication aggregation. Under the union/OR rule that
 * `SocietyUsefulWork.expectedGain` ships,
 *
 *     E[U_society] - E[U_i] = (1 - rho)(1 - c)(1 - (1 - c)^(n-1)) * sum(v)
 *
 * is **strictly positive for every rho < 1**: correlation attenuates the gain and never reverses it.
 * There is no threshold to compare against. `effective-agent-count.ts`'s `rhoFromUnionCoverage`
 * inverts exactly that union model, so it is a statistic from the regime where `rho*` does not exist.
 *
 * ## 3. Even if it did apply, no N reaches the measured value
 *
 * `rho*` is increasing in N with supremum 1/3. The fleet's measured coverage correlation is ~0.60.
 * So "add another agent" cannot close the gap at any N, finite or infinite — worth stating because
 * growing N is the intuitive fix and it is arithmetically unavailable.
 *
 * **Register: `metered`** (`toy-is-free-metered-must-be-earned`) — every claim above is a computation
 * the sibling test re-runs against `golden-vectors-rho-star-not-a-gate.json`; the vectors are decimal
 * strings in JSON, never a binary blob (`no-binary-in-proof-lineage`).
 *
 * Anchors (Beacon): de Finetti, B. (1931) — exchangeability and the representation theorem.
 * Condorcet (1785) — the jury theorem. Dunnett, C.W. & Sobel, M. (1955) — the correlated-binomial
 * effective-N approximation `rho*` is derived under. Kish, L. (1965) — the design effect.
 */

/** `rho*(N) = (N-3)/(3(N-1))`, the Dunnett-Sobel majority-vote bound. Zero at N <= 3 by construction. */
export function rhoStarAlgebraic(n: number): number {
  return n <= 3 ? 0 : (n - 3) / (3 * (n - 1));
}

/** The supremum of `rho*` over all N. */
export const RHO_STAR_SUPREMUM = 1 / 3;

/** Binomial coefficient, multiplicative form (exact for the small m used here). */
export function binom(n: number, k: number): number {
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return r;
}

/** `maj_m(theta)` — probability a majority of m iid Bernoulli(theta) votes is correct. m must be odd. */
export function majorityProbability(m: number, theta: number): number {
  let s = 0;
  for (let k = Math.floor(m / 2) + 1; k <= m; k++) {
    s += binom(m, k) * Math.pow(theta, k) * Math.pow(1 - theta, m - k);
  }
  return s;
}

/** A two-point exchangeable mixing law: theta = hi with probability p, else lo. */
export interface TwoPointMixture {
  readonly m: number;
  readonly lo: number;
  readonly hi: number;
  readonly p: number;
}

export interface MixtureVerdict {
  /** Pairwise correlation induced by the mixture: Var(theta) / (E[theta](1-E[theta])). */
  readonly rho: number;
  /** P(a single voter is correct) = E[theta]. */
  readonly single: number;
  /** P(the m-voter majority is correct) = E[maj_m(theta)]. */
  readonly majority: number;
  /** majority - single. NEGATIVE means the ensemble lost to its own member. */
  readonly lift: number;
  /** Is this mixture inside the region `rho*` declares safe? */
  readonly insideRhoStar: boolean;
}

/**
 * Evaluate a two-point exchangeable mixture exactly. No simulation, no approximation: the mixture is
 * finite so both expectations are two-term sums.
 */
export function evaluateMixture(mix: TwoPointMixture): MixtureVerdict {
  const { m, lo, hi, p } = mix;
  const mean = (1 - p) * lo + p * hi;
  const second = (1 - p) * lo * lo + p * hi * hi;
  const rho = (second - mean * mean) / (mean * (1 - mean));
  const majority = (1 - p) * majorityProbability(m, lo) + p * majorityProbability(m, hi);
  return { rho, single: mean, majority, lift: majority - mean, insideRhoStar: rho < rhoStarAlgebraic(m) };
}

/**
 * The union/OR-aggregation gain, as shipped by `SocietyUsefulWork.expectedGain` (per unit value):
 * `(1 - rho)(1 - c)(1 - (1 - c)^(n-1))`. Strictly positive for rho < 1, exactly zero at rho = 1.
 */
export function unionGainPerValue(n: number, c: number, rho: number): number {
  return (1 - rho) * (1 - c) * (1 - Math.pow(1 - c, n - 1));
}
