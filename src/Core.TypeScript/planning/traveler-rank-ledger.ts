/**
 * traveler-rank-ledger.ts — ADF (Assumed Density Filtering) skill ranking over travelers × hat-domains.
 *
 * TypeScript port of `TravelerRankLedger.fs`. The long-term anti-whitewash path alongside the fast
 * `CalibrationLedger` (Beta(2,2) + k-clamp).
 *
 * **Model:**
 *   s_{t,d} ~ N(μ_0, σ_0²)                       ← skill prior per (traveler, domain)
 *   o_i ~ Bernoulli(Φ(s_{t,d} / β))               ← probit likelihood
 *   trustBand(t,d) = Φ(μ_post / √(σ²_post + β²)) ← posterior win probability
 *
 * **Key properties:**
 *   - Domain isolation: each (traveler, domain) pair is independent — no cross-domain bleed.
 *   - Streaming O(1) ADF updates. Each calibration outcome triggers one update.
 *   - Fresh identity: trustBand = 0.5 (honest prior), not 0.0 (pessimistic clamp).
 *   - Whitewash window closed: "1 hit, 2 misses" → trustBand ≈ 0.39, not 0.0.
 *
 * **References:**
 *   Herbrich, Minka, Graepel (2006). TrueSkill™. NIPS 2006.
 *   Minka (2001). EP for Approximate Bayesian Inference. UAI 2001.
 */

// ── Hyperparameters ────────────────────────────────────────────────────────────────────────────────
/** Skill prior mean. 0.0 → neutral: no evidence either way. */
export const MU_0 = 0.0;
/** Skill prior standard deviation. 1.0 → unit scale. */
export const SIGMA_0 = 1.0;
/** Performance noise. 1.0 → trustBand(fresh) = Φ(0) = 0.5 (honest floor). */
export const BETA = 1.0;
/** Numerical floor for σ². */
const EP_EPS = 1e-10;

// ── Normal distribution helpers ────────────────────────────────────────────────────────────────────
/** Standard normal PDF φ(x). */
function phi(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/**
 * Standard normal CDF Φ(x) via Abramowitz & Stegun 7.1.26 polynomial approximation.
 * Max error < 1.5e-7 over all x. Odd function: Φ(-x) = 1 - Φ(x).
 *
 * The argument is scaled BEFORE erf: Φ(x) = ½(1 + erf(x/√2)), never ½(1 + erf(x)/√2).
 * An earlier draft of this port scaled the erf *result* and was superseded by a second
 * function rather than corrected in place, which left the wrong version dead in the file
 * under the more inviting name. Mirrors `bigPhi` in src/Core/TravelerRankLedger.fs —
 * keep the two in step.
 */
function bigPhi(x: number): number {
  // A&S 7.1.26: erf(z) ≈ 1 - poly(t)*exp(-z²), t = 1/(1+p*|z|)
  function erfApprox(z: number): number {
    const p = 0.3275911;
    const a1 = 0.254829592,
      a2 = -0.284496736,
      a3 = 1.421413741,
      a4 = -1.453152027,
      a5 = 1.061405429;
    const t = 1.0 / (1.0 + p * Math.abs(z));
    const poly = (a1 + (a2 + (a3 + (a4 + a5 * t) * t) * t) * t) * t;
    const e = 1.0 - poly * Math.exp(-z * z);
    return z >= 0 ? e : -e;
  }
  return 0.5 * (1.0 + erfApprox(x / Math.sqrt(2)));
}

/** Mill's ratio v(t) = φ(t) / Φ(t) — the ADF correction factor. */
function millsV(t: number): number {
  const denom = bigPhi(t);
  return phi(t) / Math.max(denom, EP_EPS);
}

/** EP precision factor w(t) = v(t) · (v(t) + t). */
function millsW(t: number): number {
  const v = millsV(t);
  return v * (v + t);
}

// ── Skill belief ───────────────────────────────────────────────────────────────────────────────────
/** The ADF posterior approximation for one (travelerId, hatDomain) pair. */
export interface SkillBelief {
  readonly mu: number;
  readonly sigma2: number;
  readonly obsCount: number;
}

/** Fresh skill belief — the prior N(μ_0, σ_0²) with no observations. */
export const freshBelief: SkillBelief = {
  mu: MU_0,
  sigma2: SIGMA_0 * SIGMA_0,
  obsCount: 0,
};

/**
 * The trust band for a skill belief: Φ(μ / √(σ² + β²)).
 * - Fresh: 0.5 (honest prior, no evidence either way).
 * - After consistent hits: approaches 1.0.
 * - After consistent misses: approaches 0.0.
 */
export function trustBand(b: SkillBelief): number {
  return bigPhi(b.mu / Math.sqrt(b.sigma2 + BETA * BETA));
}

// ── ADF update ─────────────────────────────────────────────────────────────────────────────────────
/**
 * Update a SkillBelief with one new observation.
 *
 * Implements the ADF probit update — the correct streaming variant of TrueSkill for i.i.d.
 * observations. Applies the EP probit correction directly to the current posterior.
 *
 * Update equations (Herbrich et al. 2006, Eq. 4–5, ADF variant):
 *   t = sign · μ / √(σ² + β²)
 *   μ_new = μ + σ² · sign · v(t) / √(σ² + β²)
 *   σ²_new = σ² · (1 − w(t) · σ² / (σ² + β²))
 */
export function updateBelief(hit: boolean, b: SkillBelief): SkillBelief {
  const sign = hit ? 1.0 : -1.0;
  const denom = Math.sqrt(b.sigma2 + BETA * BETA);
  const t = (sign * b.mu) / denom;
  const v = millsV(t);
  const w = millsW(t);
  const muNew = b.mu + (b.sigma2 * sign * v) / denom;
  const sigma2New = Math.max(EP_EPS, b.sigma2 * (1.0 - (w * b.sigma2) / (b.sigma2 + BETA * BETA)));
  return { mu: muNew, sigma2: sigma2New, obsCount: b.obsCount + 1 };
}

// ── Ledger ─────────────────────────────────────────────────────────────────────────────────────────
/** A domain-partitioned ledger of skill beliefs. Key = `${travelerId}:${hatDomain}`. */
export type TravelerRankLedger = ReadonlyMap<string, SkillBelief>;

/** Empty ledger. */
export const emptyLedger: TravelerRankLedger = new Map();

function ledgerKey(travelerId: string, hatDomain: string): string {
  return `${travelerId}:${hatDomain}`;
}

/** Look up the current skill belief for (travelerId, hatDomain). Returns freshBelief if unknown. */
export function beliefOf(travelerId: string, hatDomain: string, ledger: TravelerRankLedger): SkillBelief {
  return ledger.get(ledgerKey(travelerId, hatDomain)) ?? freshBelief;
}

/** Record one calibration outcome and return the updated ledger (immutable). */
export function recordOutcome(
  travelerId: string,
  hatDomain: string,
  hit: boolean,
  ledger: TravelerRankLedger,
): TravelerRankLedger {
  const key = ledgerKey(travelerId, hatDomain);
  const current = ledger.get(key) ?? freshBelief;
  const updated = updateBelief(hit, current);
  const next = new Map(ledger);
  next.set(key, updated);
  return next;
}

/** The trust band for (travelerId, hatDomain) in the ledger. Returns 0.5 for unknown travelers. */
export function trustBandOf(travelerId: string, hatDomain: string, ledger: TravelerRankLedger): number {
  return trustBand(beliefOf(travelerId, hatDomain, ledger));
}

/** Number of observations recorded for (travelerId, hatDomain). */
export function obsCountOf(travelerId: string, hatDomain: string, ledger: TravelerRankLedger): number {
  return beliefOf(travelerId, hatDomain, ledger).obsCount;
}

// ── Anti-whitewash gates ───────────────────────────────────────────────────────────────────────────
/** Returns true if the traveler's trustBand in the domain is above the threshold. */
export function isAboveThreshold(
  travelerId: string,
  hatDomain: string,
  threshold: number,
  ledger: TravelerRankLedger,
): boolean {
  return trustBandOf(travelerId, hatDomain, ledger) > threshold;
}

/**
 * The anti-whitewash gate: returns true if the traveler has a positive skill posterior
 * (more hits than misses, weighted by evidence strength). Replaces the k=3 clamp
 * for high-stakes decisions.
 */
export function isPositiveSkill(travelerId: string, hatDomain: string, ledger: TravelerRankLedger): boolean {
  return beliefOf(travelerId, hatDomain, ledger).mu > 0.0;
}
