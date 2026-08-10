/**
 * error-bnn-bridge.ts — Wire error envelopes as EP observations into the StudentTBnn.
 *
 * ## R4: Errors as EP observations (Otto's fourth round)
 *
 * Each error envelope is one observation absorbed by EP:
 * - `dimension` names the factor to update (not the whole model).
 * - `severity` maps to the observation z-score (the magnitude of the surprise).
 * - The StudentTBnn robustness weight w = (ν+1)/(ν+z²) downweights hostile
 *   or badly-calibrated teachers automatically — no special case needed.
 *
 * ## The retraction path (cheap) vs erasure path (expensive)
 *
 * - Teaching error (retractableBeliefId set): emit a −1 retraction.
 *   The BNN posterior updates; the old belief is retracted, not overwritten.
 *   No Landauer floor is paid for the correction itself.
 * - Bare error (no retractableBeliefId): the receiver must discard and redo.
 *   The BNN posterior smears probability across the whole model.
 *   The Landauer floor IS paid (kT ln 2 per bit erased).
 *
 * ## Preserve uncertainty
 *
 * An error updates a posterior; it must never collapse one.
 * The StudentTBnn keeps (mu, sigma²) — a distribution, not a point estimate.
 * A peer driven to certainty has destroyed the information the next update needs.
 *
 * ## Trust-weighting
 *
 * Error-derived updates are trust-weighted per receiver:
 * - A peer that teaches badly degrades its own trustBound.
 * - The robustness weight w handles hostile teachers automatically.
 * - The idempotency guard (EnvelopeIdempotencyGuard) prevents double-updates.
 *
 * ## References
 *
 * - Minka (2001) EP — "training and inference are the same message pass"
 * - Shannon (1948) — information as reduction in uncertainty
 * - Landauer (1961) — kT ln 2 floor for erasure
 * - Bennett (1973) — retraction vs erasure
 */

import { updateStudentT, createStudentTState, type StudentTState, type StudentTUpdateResult } from "./student-t-bnn";
import {
  ERROR_DIMENSIONS,
  toEpObservation,
  EnvelopeIdempotencyGuard,
  type ErrorEnvelope,
  type ErrorDimension,
} from "../protocol/error-envelope";

export const ALL_DIMENSIONS: readonly ErrorDimension[] = ERROR_DIMENSIONS;

// ── Per-dimension BNN state ────────────────────────────────────────────────────

/**
 * A per-dimension BNN: one StudentTState per error dimension.
 *
 * Named dimensions (from ErrorDimension) update the right factor instead of
 * smearing probability across the whole model. A bare "unknown" dimension
 * updates a catch-all factor.
 *
 * This is the key insight from the ferry doc:
 * "an error that names its dimension updates the right factor rather than
 * smearing probability over the whole model. A bare failure is an uninformative
 * likelihood — it barely moves the posterior."
 */
export interface DimensionalBnn {
  readonly states: ReadonlyMap<ErrorDimension, StudentTState>;
  readonly robustnessWeights: ReadonlyMap<ErrorDimension, number>;
  readonly guard: EnvelopeIdempotencyGuard;
}

/**
 * Create a fresh DimensionalBnn with one StudentTState per error dimension.
 * All states start at the prior (mu=0, sigma²=1, nu=3).
 */
export function createDimensionalBnn(nu = 3, obsVariance = 1.0): DimensionalBnn {
  const states = new Map<ErrorDimension, StudentTState>();
  const robustnessWeights = new Map<ErrorDimension, number>();
  for (const dim of ALL_DIMENSIONS) {
    states.set(dim, createStudentTState(0, 1, nu, obsVariance));
    robustnessWeights.set(dim, 1);
  }
  return { states, robustnessWeights, guard: new EnvelopeIdempotencyGuard() };
}

/**
 * Absorb one error envelope as an EP observation into the DimensionalBnn.
 *
 * Returns the update result (or null if the envelope is a duplicate).
 * The update is trust-weighted: the robustness weight w downweights
 * hostile/badly-calibrated teachers automatically.
 *
 * @param bnn - The DimensionalBnn to update.
 * @param envelope - The error envelope to absorb.
 * @returns { result, dimension, isRetraction } or null if duplicate.
 */
export function absorbError(
  bnn: DimensionalBnn,
  envelope: ErrorEnvelope,
): {
  readonly result: StudentTUpdateResult;
  readonly dimension: ErrorDimension;
  readonly isRetraction: boolean;
} | null {
  // Idempotency: drop duplicates (same error delivered twice = one update)
  if (!bnn.guard.absorb(envelope)) return null;

  const obs = toEpObservation(envelope);
  const state = bnn.states.get(obs.dimension);
  if (!state) return null; // should never happen (all dimensions pre-created)

  // The EP update: x is the z-score of the error severity.
  // The StudentTBnn robustness weight w = (ν+1)/(ν+z²) downweights outliers.
  const result = updateStudentT(state, obs.x);

  // Update the state in-place (the Map is mutable even though the interface is readonly)
  (bnn.states as Map<ErrorDimension, StudentTState>).set(obs.dimension, result.state);
  (bnn.robustnessWeights as Map<ErrorDimension, number>).set(obs.dimension, result.robustnessWeight);

  return { result, dimension: obs.dimension, isRetraction: obs.isRetraction };
}

/**
 * Get the current posterior for a given error dimension.
 * Returns the prior if the dimension has never been observed.
 */
export function dimensionPosterior(
  bnn: DimensionalBnn,
  dimension: ErrorDimension,
): { readonly mu: number; readonly sigma2: number; readonly robustnessWeight: number } {
  const state = bnn.states.get(dimension);
  if (!state) return { mu: 0, sigma2: 1, robustnessWeight: 1 };
  return {
    mu: state.posterior.mu,
    sigma2: state.posterior.sigma2,
    robustnessWeight: bnn.robustnessWeights.get(dimension) ?? 1,
  };
}

/**
 * The "error richness" metric: how much information did this error carry?
 *
 * A named dimension (not "unknown") is rich: it updates the right factor.
 * An "unknown" dimension is bare: it smears probability across the model.
 *
 * Returns a value in [0, 1]: 1 = maximally informative, 0 = bare failure.
 */
export function errorRichness(envelope: ErrorEnvelope): number {
  if (envelope.mirror.dimension === "unknown") return 0;
  // Rich error: named dimension + retractable belief = maximum information
  if (envelope.mirror.retractableBeliefId) return 1;
  // Named dimension but no retraction: medium richness
  return 0.7;
}
