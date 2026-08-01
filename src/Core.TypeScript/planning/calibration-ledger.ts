/**
 * calibration-ledger.ts — Per-hat calibration ledger
 *
 * Design contract (PR #9901, Otto 2026-08-01):
 *
 *   1. SEPARATE FROM PEER RECORD — this ledger is never stored inside
 *      FlatSocietyBase.peers, so unboltTaskHierarchy's wholesale restore
 *      from base.peers cannot erase it.
 *
 *   2. APPEND-ONLY — outcomes are recorded, never mutated or deleted.
 *      The posterior is always recomputed from the full history.
 *
 *   3. TWO NAMED BOUNDS — exploreBound (μ + kσ) and trustBound (μ − kσ)
 *      are separately named functions. The sign inversion is the kind of
 *      thing a PoC gets away with and production doesn't. A single bound()
 *      function is intentionally absent.
 *
 *   4. CALIBRATION ≠ COMPETENCE — this measures self-knowledge: whether
 *      an agent's model of its own performance matches reality. An agent
 *      can be poorly calibrated and excellent, or well-calibrated and
 *      mediocre. Weighting a claim is not the same as valuing the claimant.
 *
 * What Soraya should prove or refute (§7 of spec):
 *   - Is Beta-Bernoulli over settled hit/miss adequate, or does calibration
 *     require an explicit calibration-curve posterior?
 *   - Does μ − kσ have the maximin property formally, or only by analogy?
 *     This document asserts a resemblance, not a theorem.
 *   - Cold-start prior: what prior avoids "trusted by default" AND
 *     "permanently unprovable"?
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single prediction outcome, settled by reality.
 *
 * Self-report is safe here because the prediction is decoupled from the
 * entitlement: you may self-claim a DATE you are trying to hit, never a
 * STATUS. A date claim changes nothing — the arithmetic threshold still
 * decides — yet is falsifiable with a settlement time.
 */
export interface PredictionOutcome {
  /** Unique prediction ID (e.g. task ID or work-item ID). */
  readonly predictionId: string;
  /** The hat under which the prediction was made. */
  readonly hatId: string;
  /** When the prediction was made. */
  readonly predictedAt: number; // Unix ms
  /** The date the agent predicted it would hit. */
  readonly predictedDeadline: number; // Unix ms
  /** When the outcome was actually settled. null = not yet settled. */
  readonly settledAt: number | null; // Unix ms
  /**
   * Whether the prediction was a hit (settled on or before predictedDeadline).
   * null = not yet settled.
   *
   * Scoring is symmetric: early misses cost the same as late ones.
   * If predicting late is always safer, everyone sandbags and the record
   * measures caution rather than calibration.
   */
  readonly hit: boolean | null;
}

/**
 * Per-(zid, hatId) calibration record — the full append-only history of
 * prediction outcomes for one agent wearing one hat.
 */
export interface CalibrationRecord {
  readonly zid: string;
  readonly hatId: string;
  /** Append-only. Outcomes are never mutated or deleted. */
  readonly outcomes: readonly PredictionOutcome[];
}

/**
 * The ledger — a map from `${zid}::${hatId}` to CalibrationRecord.
 *
 * Intentionally a plain object rather than a class so it can be passed
 * alongside FlatSocietyBase without being embedded in it.
 */
export interface CalibrationLedger {
  readonly records: ReadonlyMap<string, CalibrationRecord>;
}

/**
 * The posterior over an agent's calibration score for a given hat.
 *
 * Shape: Gaussian approximation from Beta-Bernoulli update.
 * Keep: factor graph over Gaussians, explicit σ — 3 settled predictions
 * must not rank like 300.
 * Replace (per spec §4): TrueSkill's likelihood is ordinal comparison
 * (zero-sum). Calibration is measured against reality — two agents can
 * both be perfectly calibrated with no loser.
 *
 * NOTE (Soraya §7.1): Is Beta-Bernoulli over settled hit/miss adequate,
 * or does calibration require an explicit calibration-curve posterior?
 * These differ: an agent can be accurate and miscalibrated, or calibrated
 * and uninformative. This implementation uses Beta-Bernoulli as a starting
 * point; the likelihood is replaceable without changing the bound API.
 */
export interface CalibrationPosterior {
  readonly zid: string;
  readonly hatId: string;
  /** Posterior mean over calibration score ∈ [0, 1]. */
  readonly mu: number;
  /** Posterior standard deviation — explicit, never collapsed to point estimate. */
  readonly sigma: number;
  /** Number of settled outcomes used to compute this posterior. */
  readonly settledCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cold-start prior
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Beta(α₀, β₀) prior — the cold-start prior for a new hat-wearer.
 *
 * Design constraint (spec §7.5): must avoid both "trusted by default"
 * (α₀ >> β₀) and "permanently unprovable" (α₀ = β₀ = 0 → no update).
 *
 * Beta(2, 2) is a weak, symmetric, unimodal prior centered at 0.5 with
 * σ ≈ 0.22. It is informative enough to avoid division-by-zero in the
 * Gaussian approximation, but weak enough that 3–5 settled outcomes
 * dominate it. This is an initial choice; Soraya should verify it avoids
 * the sybil incentive (fresh identity must not have maximal trustBound).
 */
const PRIOR_ALPHA = 2;
const PRIOR_BETA = 2;

// ─────────────────────────────────────────────────────────────────────────────
// Ledger operations
// ─────────────────────────────────────────────────────────────────────────────

/** Stable key for a (zid, hatId) pair. */
function recordKey(zid: string, hatId: string): string {
  return `${zid}::${hatId}`;
}

/** Create an empty ledger. */
export function createCalibrationLedger(): CalibrationLedger {
  return { records: new Map() };
}

/**
 * Record a new prediction (not yet settled).
 * Returns a new ledger — the original is never mutated.
 */
export function recordPrediction(
  ledger: CalibrationLedger,
  zid: string,
  hatId: string,
  predictionId: string,
  predictedDeadline: number,
  predictedAt: number = Date.now(),
): CalibrationLedger {
  const key = recordKey(zid, hatId);
  const existing = ledger.records.get(key) ?? { zid, hatId, outcomes: [] };
  const outcome: PredictionOutcome = {
    predictionId,
    hatId,
    predictedAt,
    predictedDeadline,
    settledAt: null,
    hit: null,
  };
  const updated: CalibrationRecord = {
    ...existing,
    outcomes: [...existing.outcomes, outcome],
  };
  const newRecords = new Map(ledger.records);
  newRecords.set(key, updated);
  return { records: newRecords };
}

/**
 * Settle a prediction — record the actual completion time and compute hit/miss.
 *
 * Scoring is symmetric: early misses cost the same as late ones (spec §6).
 * hit = settledAt <= predictedDeadline.
 *
 * Returns a new ledger — the original is never mutated.
 */
export function settlePrediction(
  ledger: CalibrationLedger,
  zid: string,
  hatId: string,
  predictionId: string,
  settledAt: number = Date.now(),
): CalibrationLedger {
  const key = recordKey(zid, hatId);
  const record = ledger.records.get(key);
  if (!record) return ledger; // no record for this (zid, hatId) — no-op

  const updatedOutcomes = record.outcomes.map((o) => {
    if (o.predictionId !== predictionId || o.settledAt !== null) return o;
    return {
      ...o,
      settledAt,
      hit: settledAt <= o.predictedDeadline,
    };
  });

  const updated: CalibrationRecord = { ...record, outcomes: updatedOutcomes };
  const newRecords = new Map(ledger.records);
  newRecords.set(key, updated);
  return { records: newRecords };
}

// ─────────────────────────────────────────────────────────────────────────────
// Posterior update
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the calibration posterior for (zid, hatId) from all settled outcomes.
 *
 * Likelihood: Beta-Bernoulli over hit/miss (spec §4, §7.1).
 * Prior: Beta(PRIOR_ALPHA, PRIOR_BETA) — see cold-start note above.
 *
 * The posterior Beta(α, β) is approximated as a Gaussian with:
 *   μ = α / (α + β)
 *   σ = sqrt(α·β / ((α+β)²·(α+β+1)))
 *
 * Explicit σ is preserved — 3 settled predictions must not rank like 300.
 *
 * NOTE: This function MUST be called with a ledger that has been updated
 * via settlePrediction. A calibration system whose test passes with this
 * function stubbed out is the exact defect this ledger is meant to price.
 * See calibration-ledger.test.ts for the anti-self-certifying test.
 */
export function updatePosterior(
  ledger: CalibrationLedger,
  zid: string,
  hatId: string,
): CalibrationPosterior {
  const key = recordKey(zid, hatId);
  const record = ledger.records.get(key);
  const settled = record?.outcomes.filter((o) => o.hit !== null) ?? [];

  const hits = settled.filter((o) => o.hit === true).length;
  const misses = settled.filter((o) => o.hit === false).length;

  const alpha = PRIOR_ALPHA + hits;
  const beta = PRIOR_BETA + misses;
  const total = alpha + beta;

  const mu = alpha / total;
  const sigma = Math.sqrt((alpha * beta) / (total * total * (total + 1)));

  return { zid, hatId, mu, sigma, settledCount: settled.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// Named bounds — NEVER merge these into a single bound() function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * exploreBound — μ + k·σ (optimistic).
 *
 * Use when deciding WHICH OPTION TO EXPLORE. Uncertainty is an opportunity:
 * unexplored branches deserve budget.
 *
 * This is the UCB (Upper Confidence Bound) instinct from bandit algorithms.
 * It is correct for exploration and MUST NOT be used for trust decisions.
 *
 * @param posterior - The calibration posterior for (zid, hatId).
 * @param k - Confidence multiplier. Default 1.0 (one standard deviation).
 */
export function exploreBound(posterior: CalibrationPosterior, k = 1.0): number {
  return posterior.mu + k * posterior.sigma;
}

/**
 * trustBound — μ − k·σ (conservative).
 *
 * Use when deciding WHOSE CLAIM TO TRUST. Uncertainty is a liability:
 * unproven ≠ proven-average.
 *
 * This is the maximin instinct: rank by the floor you can defend, not the
 * mean. The flat-society design already uses this for empowermentFloor;
 * this is the same principle applied to calibration.
 *
 * NOTE (Soraya §7.3): Does μ − kσ have the maximin property FORMALLY, or
 * only by analogy? The flat-society floor is a genuine min over peers; this
 * is a quantile of a posterior. This document asserts a resemblance, not a
 * theorem. Name the relationship honestly.
 *
 * SIGN TRAP (spec §5): Using exploreBound for trust decisions would
 * systematically trust unproven agents MORE because they are uncertain —
 * and a fresh identity has maximal σ, so that is precisely a sybil
 * incentive. The two functions are separately named to make this inversion
 * impossible at a call site.
 *
 * @param posterior - The calibration posterior for (zid, hatId).
 * @param k - Confidence multiplier. Default 1.0 (one standard deviation).
 */
export function trustBound(posterior: CalibrationPosterior, k = 1.0): number {
  return posterior.mu - k * posterior.sigma;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ledger query helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the calibration record for (zid, hatId), or undefined if none exists.
 */
export function getRecord(
  ledger: CalibrationLedger,
  zid: string,
  hatId: string,
): CalibrationRecord | undefined {
  return ledger.records.get(recordKey(zid, hatId));
}

/**
 * Get all calibration records for a given zid across all hats.
 */
export function getRecordsForAgent(
  ledger: CalibrationLedger,
  zid: string,
): readonly CalibrationRecord[] {
  return Array.from(ledger.records.values()).filter((r) => r.zid === zid);
}

/**
 * Get all calibration records for a given hat across all agents.
 */
export function getRecordsForHat(
  ledger: CalibrationLedger,
  hatId: string,
): readonly CalibrationRecord[] {
  return Array.from(ledger.records.values()).filter((r) => r.hatId === hatId);
}
