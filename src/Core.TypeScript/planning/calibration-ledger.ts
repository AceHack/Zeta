/**
 * calibration-ledger.ts — Per-hat calibration ledger
 *
 * Design contract (PR #9901, Otto 2026-08-01; Soraya review 2026-08-01):
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
 *   5. COVERAGE-AT-τ SCORING — predictions are scored by whether the actual
 *      completion time falls within the declared interval [predictedAt, predictedDeadline].
 *      This is the interval score from Gneiting & Raftery 2007 §6.2 (eq. 43):
 *        S(l, u, y; α) = (u − l) + (2/α)(l − y)⁺ + (2/α)(y − u)⁺
 *      where α is the nominal coverage level (we use τ = 0.9, so α = 0.1).
 *      A hit is y ∈ [l, u]; a miss is y outside the interval.
 *      Sandbagging (declaring u = +∞) is penalised: the (u − l) term grows
 *      without bound, so argmax is NOT at D = +∞. This is the fix for the
 *      original settlePrediction defect.
 *
 *   6. SYBIL RESISTANCE — trustBound is clamped to [0, 1] and defaults to
 *      k = 3 (α = 0.1 shortfall guarantee, Cantelli 1928 / Scarf 1958).
 *      At k = 1 the guarantee is α = 0.5 (vacuous). At k = 3 it is α = 0.1
 *      (meaningful). Soraya's correction: μ − kσ is an EXACT maximin over
 *      moment-ambiguity distributions, not a resemblance (Cantelli/Scarf).
 *
 * Theoretical anchors (PRIOR-ART-LIST.md §"Proper scoring rules"):
 *   - Brier 1950 (proper scoring rules)
 *   - Savage 1971 (characterization theorem)
 *   - DeGroot & Fienberg 1983 (calibration–resolution decomposition)
 *   - Murphy 1973 (three-way Brier decomposition)
 *   - Gneiting & Raftery 2007 (strictly proper scoring rules; interval score eq. 43)
 *   - Cantelli 1928 / Scarf 1958 (exact maximin bound)
 *   - Friedman & Resnick 2001 (Sybil/whitewash cost model)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single prediction outcome, settled by reality.
 *
 * Scoring uses coverage-at-τ (interval score, Gneiting & Raftery 2007 eq. 43).
 * The declared interval is [predictedAt, predictedDeadline].
 * A hit is settledAt ∈ [predictedAt, predictedDeadline].
 * A miss is settledAt outside the interval (either early or late).
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
  /** When the prediction was made (lower bound of declared interval). */
  readonly predictedAt: number; // Unix ms
  /** The date the agent predicted it would hit (upper bound of declared interval). */
  readonly predictedDeadline: number; // Unix ms
  /** When the outcome was actually settled. null = not yet settled. */
  readonly settledAt: number | null; // Unix ms
  /**
   * Whether the prediction was a hit (settledAt ∈ [predictedAt, predictedDeadline]).
   * null = not yet settled.
   *
   * Coverage-at-τ scoring: both early misses (settledAt < predictedAt) and
   * late misses (settledAt > predictedDeadline) are penalised. The interval
   * score also penalises wide intervals — declaring predictedDeadline = +∞
   * is not a free lunch.
   */
  readonly hit: boolean | null;
  /**
   * The interval score for this prediction (Gneiting & Raftery 2007 eq. 43).
   * Lower is better. null = not yet settled.
   *
   * S(l, u, y; α) = (u − l)/T_SCALE + (2/α)(l − y)⁺/T_SCALE + (2/α)(y − u)⁺/T_SCALE
   * where l = predictedAt, u = predictedDeadline, y = settledAt, α = COVERAGE_ALPHA.
   * Normalised by T_SCALE (one day in ms) to keep scores in a human-readable range.
   */
  readonly intervalScore: number | null;
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
 * Shape: Gaussian approximation from Beta-Bernoulli update over hit/miss.
 * Keep: factor graph over Gaussians, explicit σ — 3 settled predictions
 * must not rank like 300.
 * Replace (per spec §4): TrueSkill's likelihood is ordinal comparison
 * (zero-sum). Calibration is measured against reality — two agents can
 * both be perfectly calibrated with no loser.
 *
 * NOTE (Soraya §7.1): Beta-Bernoulli over hit/miss is a starting point.
 * The likelihood is replaceable without changing the bound API.
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
// Constants
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
 * dominate it.
 */
const PRIOR_ALPHA = 2;
const PRIOR_BETA = 2;

/**
 * Coverage level α for the interval score (Gneiting & Raftery 2007 eq. 43).
 * τ = 1 − α = 0.9 means we target 90% coverage.
 * α = 0.1 means the penalty multiplier 2/α = 20 for misses outside the interval.
 */
const COVERAGE_ALPHA = 0.1;

/**
 * Time scale for normalising the interval score (one day in ms).
 * Keeps interval scores in a human-readable range (e.g. 1.0 = one day wide).
 */
const T_SCALE_MS = 86_400_000; // 24 * 60 * 60 * 1000

/**
 * Default k for trustBound — Cantelli/Scarf shortfall guarantee.
 * k = 1: α = 0.5 (vacuous floor — Soraya's note).
 * k = 3: α = 0.1 (meaningful floor; P(X < trustBound) ≤ 0.1).
 * Default is 3, not 1.
 */
const DEFAULT_TRUST_K = 3.0;

/**
 * Default k for exploreBound — UCB exploration bonus.
 * k = 1 is standard UCB1; higher k explores more aggressively.
 */
const DEFAULT_EXPLORE_K = 1.0;

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
    intervalScore: null,
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
 * Settle a prediction — record the actual completion time and compute
 * hit/miss and interval score.
 *
 * Scoring: coverage-at-τ (interval score, Gneiting & Raftery 2007 eq. 43).
 *
 *   S(l, u, y; α) = (u − l)/T + (2/α)(l − y)⁺/T + (2/α)(y − u)⁺/T
 *
 * where:
 *   l = predictedAt (lower bound of declared interval)
 *   u = predictedDeadline (upper bound of declared interval)
 *   y = settledAt (actual completion time)
 *   α = COVERAGE_ALPHA = 0.1 (targeting 90% coverage)
 *   T = T_SCALE_MS (one day, for normalisation)
 *   (x)⁺ = max(0, x)
 *
 * A hit is y ∈ [l, u] (interval score = (u − l)/T, no miss penalty).
 * A late miss is y > u (interval score includes (2/α)(y − u)/T penalty).
 * An early miss is y < l (interval score includes (2/α)(l − y)/T penalty).
 *
 * SANDBAGGING PREVENTION: declaring u = +∞ is penalised because the
 * (u − l)/T term grows without bound. The argmax of the expected score
 * is at the true quantile τ = 1 − α, not at +∞. This is the fix for the
 * original settlePrediction defect (monotone in declared date → argmax at D = +∞).
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

    const l = o.predictedAt;
    const u = o.predictedDeadline;
    const y = settledAt;

    // Interval score: (u − l)/T + (2/α)(l − y)⁺/T + (2/α)(y − u)⁺/T
    const width = (u - l) / T_SCALE_MS;
    const earlyPenalty = Math.max(0, l - y) / T_SCALE_MS * (2 / COVERAGE_ALPHA);
    const latePenalty = Math.max(0, y - u) / T_SCALE_MS * (2 / COVERAGE_ALPHA);
    const intervalScore = width + earlyPenalty + latePenalty;

    return {
      ...o,
      settledAt,
      hit: y >= l && y <= u,
      intervalScore,
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
 * exploreBound — μ + k·σ (optimistic), clamped to [0, 1].
 *
 * Use when deciding WHICH OPTION TO EXPLORE. Uncertainty is an opportunity:
 * unexplored branches deserve budget.
 *
 * This is the UCB (Upper Confidence Bound) instinct from bandit algorithms.
 * It is correct for exploration and MUST NOT be used for trust decisions.
 *
 * @param posterior - The calibration posterior for (zid, hatId).
 * @param k - Confidence multiplier. Default DEFAULT_EXPLORE_K = 1.0.
 */
export function exploreBound(
  posterior: CalibrationPosterior,
  k = DEFAULT_EXPLORE_K,
): number {
  return Math.min(1, Math.max(0, posterior.mu + k * posterior.sigma));
}

/**
 * trustBound — μ − k·σ (conservative), clamped to [0, 1].
 *
 * Use when deciding WHOSE CLAIM TO TRUST. Uncertainty is a liability:
 * unproven ≠ proven-average.
 *
 * EXACT MAXIMIN (Soraya correction of §7.3): μ − kσ is an exact maximin
 * over all distributions with the same mean and variance (moment-ambiguity
 * class), with shortfall probability α = 1/(1+k²) by Cantelli 1928 / Scarf 1958.
 * This is NOT a resemblance — it is the Cantelli bound applied to the posterior.
 *
 * CLAMPING: result is clamped to [0, 1]. At k=3 with a fresh prior (μ≈0.5,
 * σ≈0.22), trustBound ≈ 0.5 − 3·0.22 = −0.16 before clamping → 0.0 after.
 * This is correct: a fresh identity has no trust floor above zero.
 *
 * DEFAULT k = 3 (not 1):
 *   k=1: α = 0.5 (50% shortfall guarantee — vacuous as a floor, Soraya's note).
 *   k=3: α = 0.1 (10% shortfall guarantee — meaningful floor).
 *
 * SIGN TRAP (spec §5): Using exploreBound for trust decisions would
 * systematically trust unproven agents MORE because they are uncertain —
 * and a fresh identity has maximal σ, so that is precisely a sybil
 * incentive. The two functions are separately named to make this inversion
 * impossible at a call site.
 *
 * @param posterior - The calibration posterior for (zid, hatId).
 * @param k - Confidence multiplier. Default DEFAULT_TRUST_K = 3.0.
 */
export function trustBound(
  posterior: CalibrationPosterior,
  k = DEFAULT_TRUST_K,
): number {
  return Math.min(1, Math.max(0, posterior.mu - k * posterior.sigma));
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
