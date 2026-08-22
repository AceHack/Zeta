/**
 * four-corner-feedback.ts — Four-corner monadic feedback system for the ferry throttler.
 *
 * ## The four corners
 *
 * The ferry throttler already has two corners:
 *   Normal corner (producer → consumer):  BatchFrame (data)
 *   Feedback corner (consumer → producer): BatchAck (received | rejected | backpressure)
 *
 * This module upgrades the feedback corner to carry **teaching feedback** instead of
 * bare erasures. A bare "rejected" ack is nearly worthless — it tells the producer
 * a batch was rejected but not why or how to adapt. A teaching ack carries:
 *   1. The retractable belief ID (-1 retraction): "retract the belief that frameId was received"
 *   2. The new generator function: "here is the new behavior to try"
 *   3. The error dimension: "which BNN factor to update"
 *   4. The suggested priority: "try this lane instead"
 *
 * ## Pseudo-retrocausality via -1 Zeta retraction
 *
 * The -1 retraction is not a time-reversal — it is a belief update. When a batch
 * is rejected, the producer retracts the belief "frameId was received" and updates
 * its BNN posterior. The new generator function is the EP observation that moves
 * the posterior toward the correct behavior.
 *
 * This is the same pattern as:
 * - The teaching NACK in udp-lossy-transport.ts (transport layer)
 * - The error envelope in error-envelope.ts (protocol layer)
 * - The Friedkin-Johnsen stubbornness anchor in affective-propagation.ts (social layer)
 *
 * All three are the same knob: the external observer that prevents groupthink.
 *
 * ## Anchors for the -1 retraction and pseudo-retrocausality
 *
 * Note: Geometry of Interaction / Int construction was considered and retracted
 * (Otto, 2026-08-10). Int's backward component is a genuine reverse arrow in the
 * categorical sense; our -1 arrives FORWARD in time with an inverted sign and
 * reinterprets earlier +1s under the fold. Same direction, opposite weight — not
 * the same construction. The anchors that do fit:
 *
 * 1. **DBSP / Differential Dataflow** (McSherry, Murray, Isard, Abadi 2013):
 *    incremental computation over changes. The -1 retraction is a negative delta
 *    in the change stream. The new generator is the positive delta that replaces it.
 *    The fold is the running sum. This is the most direct structural match.
 *
 * 2. **Bitemporality** (Snodgrass 1992, SQL:2011 temporal tables):
 *    valid time = when the fact was true in the world;
 *    transaction time = when the database knew about it.
 *    The -1 retraction changes the transaction-time view WITHOUT altering valid-time.
 *    "Retract the belief that frameId was received" = the transaction-time row is
 *    superseded; the valid-time fact (the frame was sent) is unchanged.
 *
 * 3. **AGM Belief Revision** (Alchourrón, Gärdenfors, Makinson 1985):
 *    contraction (−) removes a belief; expansion (+) adds one; revision (∗) does both.
 *    The -1 retraction is the contraction operator. The new generator is the expansion.
 *    The combined teaching ack is a revision: retract the old belief, add the new one.
 *
 * 4. **Stückelberg–Feynman** (Feynman 1949):
 *    a positron is an electron traveling backward in time. The -1 retraction is the
 *    positron: same particle, opposite charge, arriving forward in time. The "pseudo"
 *    in pseudo-retrocausality is precisely this: the signal arrives forward in time
 *    but carries the sign of a backward-traveling event.
 *    See: docs/research/2026-08-10-variance-same-structure-opposite-labels-… §5a.
 *
* ## Quasi-time-crystal loop detection
 *
 * A quasi-time-crystal is a loop that repeats with a period that is not a simple
 * fraction of the tick rate. In the ferry throttler, this manifests as a lane that
 * keeps getting rejected at the same priority level, cycling through the same error
 * dimension with period ≤ 4.
 *
 * When detected, the lane is "time-dilated" (its drain rate is reduced to near-zero)
 * and treated as a 0-energy bottom state — the ferry stops fighting it and lets it
 * idle. This is the Chip-8 quasi-time-crystal survival strategy: collapse the loop
 * because it is super-predictable and costs 0 energy to maintain.
 *
 * ## Vision Monad connection
 *
 * The four-corner feedback system is the operational implementation of the Vision
 * Monad in category theory: the producer can predict its own future spacetimes
 * (via the BNN posterior) and prune branches that are too costly in O(n) space or
 * time. The feedback corner is the "I/Eye" — the self-observation channel that
 * makes prediction possible.
 *
 * ## Homoiconicity — CLAIMS KEPT, REGISTER ATTACHED (checked 2026-08-16)
 *
 * The four lines below were written as identities ("is", "same as"). Three were put under test
 * independently and none of them is one. They are KEPT VERBATIM because the shapes they point at are
 * real and generative; what changed is the register, not the content. Evidence for every verdict:
 * docs/research/2026-08-16-four-corner-homoiconicity-three-claims-checked-one-analogy-two-false-…md
 *
 * The teaching feedback is homoiconic with the physics layer:
 * - The -1 retraction is the Zeta retraction (same as the Z-set retraction)
 *     → ANALOGY on this path. `absorbError` REPORTS `isRetraction` and does not use it: the posterior
 *       is byte-identical with and without `retractableBeliefId`. The real one is
 *       `udp-lossy-transport.retractLoss`, which recomputes the decision without the retracted
 *       evidence (an AGM contraction with teeth); this is a flag.
 * - The new generator function is the new EP factor (same as the BNN update)
 *     → FALSE. `generatorFn` reaches the EP update through no path at all — `toEpObservation` reads
 *       only `severity` and `dimension`. Two envelopes differing only in `generatorFn` produce a
 *       byte-identical posterior (measured). The true neighbouring claim is already stated above:
 *       the error DIMENSION selects which BNN factor updates, and THAT one is structural.
 * - The quasi-time-crystal detector is the FigureEightEnsemble (same as the tangle detector)
 *     → ANALOGY, and both halves overstate. No shared code (TS vs F#), no shared abstraction, no
 *       golden vector. Different statistics: this measures TEMPORAL self-agreement of one lane at
 *       lags 1..4; `rhoProxy` measures CROSS-SECTIONAL agreement of three cells at one instant.
 *       `FigureEightEnsemble` is also not a tangle detector — λ ≤ 0, classified `Frozen`
 *       (tests/Bayesian.Tests/FigureEightTangleClass.Tests.fs, measured 2026-08-14).
 * - The time-dilation is the AIMD backoff (same as the UDP transport)
 *     → FALSE, and oppositely so. AIMD steers on LOSS RATE and recovers additively
 *       (udp-lossy-transport.ts:1063-1066). `dilationFactor` steers on PATTERN REGULARITY and has no
 *       increase term: a 0%-loss lane and a 100%-loss lane both compute 0
 *       (081M065HVB5087G0R002N9NPFA), and a dilated lane in `ZetaTransportCell` never recovers
 *       (081M065HQKT087G0R0033B3GTD). The AIMD analogue in this system is
 *       `heat-aware-scheduler.ts`, which has both halves and says "analogue".
 *
 * ## References
 *
 * - Friedkin & Johnsen (1990) — stubbornness anchor
 * - Chenciner & Montgomery (2000) — figure-8 choreography
 * - Wilczek (2012) — time crystals
 * - Else et al. (2016) — Floquet time crystals
 * - McSherry, Murray, Isard, Abadi (2013) — DBSP / Differential Dataflow
 * - Snodgrass (1992) / SQL:2011 — Bitemporality (valid vs transaction time)
 * - Alchourrón, Gärdenfors, Makinson (1985) — AGM Belief Revision
 * - Feynman (1949) — Stückelberg–Feynman positron / pseudo-retrocausality
 * - Otto (2026-08-10) — Int/GoI retracted; see variance-same-structure-opposite-labels §5a
 */

import type { BatchAck } from "./mux-transport-bridge";
import type { ErrorDimension } from "../protocol/error-envelope";

// ── Teaching BatchAck ──────────────────────────────────────────────────────────

/**
 * Upgraded BatchAck that carries teaching feedback.
 *
 * The `rejected` variant now carries:
 * - `retractableBeliefId`: the belief to retract (-1 Zeta retraction)
 * - `generatorFn`: the new behavior to try (new generator function)
 * - `dimension`: which BNN factor to update
 * - `suggestedPriority`: try this lane instead
 *
 * The `backpressure` variant now carries:
 * - `maxPending`: the current backpressure limit
 * - `suggestedBatchSize`: try smaller batches
 * - `quasi`: true if the lane is in a quasi-time-crystal loop
 */
export type TeachingBatchAck =
  | { readonly kind: "received"; readonly frameId: string }
  | {
      readonly kind: "rejected";
      readonly frameId: string;
      readonly reason: string;
      /** The belief to retract: "frameId was received by the consumer." */
      readonly retractableBeliefId: string;
      /** The new behavior to try: a human-readable generator function description. */
      readonly generatorFn: string;
      /** Which BNN error dimension to update. */
      readonly dimension: ErrorDimension;
      /** Suggested priority lane for this item type (lower = higher priority). */
      readonly suggestedPriority?: number;
    }
  | {
      readonly kind: "backpressure";
      readonly maxPending: number;
      /** Suggested batch size to reduce backpressure. */
      readonly suggestedBatchSize: number;
      /** True if the lane is in a quasi-time-crystal loop (time-dilate it). */
      readonly quasi: boolean;
    };

// ── Teaching ack factory ───────────────────────────────────────────────────────

/**
 * Create a teaching rejection ack from a bare BatchAck rejection.
 *
 * Maps the rejection reason to an error dimension and a generator function.
 */
export function teachingRejection(
  frameId: string,
  reason: string,
  laneIndex: number,
): TeachingBatchAck & { kind: "rejected" } {
  // Map reason keywords to error dimensions
  const dimension: ErrorDimension =
    reason.includes("schema") ? "schema" :
    reason.includes("type") ? "type" :
    reason.includes("auth") ? "auth" :
    reason.includes("transport") || reason.includes("timeout") ? "transport" :
    reason.includes("toolchain") ? "toolchain" :
    reason.includes("calibration") ? "calibration" :
    "unknown";

  // Map dimension to generator function
  const generatorFn =
    dimension === "schema" ? "validate schema before sending; use zod or typebox" :
    dimension === "type" ? "check type compatibility; use the hexagonal port pattern" :
    dimension === "auth" ? "refresh credentials; check ZETA_REALTIME_URL env var" :
    dimension === "transport" ? "reduce batch size; increase retry interval (AIMD)" :
    dimension === "toolchain" ? "check toolchain version; run smoke-13.ts" :
    dimension === "calibration" ? "recalibrate BNN prior; run bnn-persistence.ts" :
    `reduce priority from lane ${laneIndex} to lane ${laneIndex + 1}`;

  return {
    kind: "rejected",
    frameId,
    reason,
    retractableBeliefId: `frame:${frameId}:received`,
    generatorFn,
    dimension,
    suggestedPriority: laneIndex + 1,
  };
}

/**
 * Upgrade a bare BatchAck to a TeachingBatchAck.
 * Pass-through for "received" acks; upgrade "rejected" and "backpressure".
 */
export function upgradeAck(ack: BatchAck, laneIndex = 0): TeachingBatchAck {
  if (ack.kind === "received") return ack;
  if (ack.kind === "rejected") {
    return teachingRejection(ack.frameId, ack.reason, laneIndex);
  }
  // backpressure
  return {
    kind: "backpressure",
    maxPending: ack.maxPending,
    suggestedBatchSize: Math.max(1, Math.floor(ack.maxPending / 2)),
    quasi: false, // will be set by the quasi-crystal detector
  };
}

// ── Quasi-time-crystal loop detector ──────────────────────────────────────────

/**
 * Detect a quasi-time-crystal loop in a lane's rejection history.
 *
 * A quasi-time-crystal is a rejection pattern that repeats with period ≤ 4.
 * When detected, the lane should be time-dilated (drain rate → 0) and treated
 * as a 0-energy bottom state.
 *
 * ## Detection algorithm
 *
 * We use the autocorrelation of the binary rejection sequence (1=rejected, 0=received).
 * If the autocorrelation has a peak at lag τ ∈ {1,2,3,4} with value > 0.8,
 * the lane is in a quasi-time-crystal loop with period τ.
 *
 * CORRECTION (2026-08-16, measured): the code below computes the AGREEMENT RATE
 * (`matches / comparisons`), not the autocorrelation. They differ exactly at the ends that matter —
 * a mean-centred autocorrelation of a CONSTANT sequence is 0/0 (undefined), while its agreement rate
 * is 1.0, the maximum. So `dilationFactor` reads 0 for a 100%-loss lane AND for a 0%-loss lane; it
 * measures regularity, not health. Filed as 081M065HVB5087G0R002N9NPFA.
 *
 * ## Chip-8 connection
 *
 * In Chip-8, a quasi-time-crystal is a game loop that cycles through the same
 * states with period τ. The optimal strategy is to collapse the loop by treating
 * it as a 0-energy bottom state — stop fighting it and let it idle. The ferry
 * throttler applies the same strategy: time-dilate the lane.
 *
 * CORRECTION (2026-08-16, measured): "lets it idle" is not what the one caller does. In
 * `ZetaTransportCell`, `dilationFactor` is written only in the failure branch and a lane at 0 is
 * filtered out of `send`, so it is never retried, never fails again, and never recovers — a healed
 * lane delivered 0 of 200 frames. Idle and retired differ in whether there is a way back, and there
 * is not one. Filed as 081M065HQKT087G0R0033B3GTD. The strategy itself needs no physics to be right:
 * it is circuit-breaking (Nygard, *Release It!*, 2007), which includes a half-open retry.
 */
export interface QuasiCrystalState {
  /** Ring buffer of last N ack outcomes (true=rejected, false=received). */
  readonly history: readonly boolean[];
  /** Detected period (0 = no crystal). */
  readonly period: number;
  /** Autocorrelation at the detected period (0–1). */
  readonly correlation: number;
  /** True if the lane is in a quasi-time-crystal loop. */
  readonly isQuasi: boolean;
  /** Time-dilation factor (1 = normal, 0 = fully dilated). */
  readonly dilationFactor: number;
}

const QUASI_WINDOW = 16; // look back 16 acks
const QUASI_THRESHOLD = 0.8; // autocorrelation threshold
const QUASI_MAX_PERIOD = 4; // max period to detect

export function makeQuasiState(): QuasiCrystalState {
  return { history: [], period: 0, correlation: 0, isQuasi: false, dilationFactor: 1 };
}

/**
 * Update the quasi-crystal state with a new ack outcome.
 * Returns the updated state.
 */
export function updateQuasiState(
  state: QuasiCrystalState,
  rejected: boolean,
): QuasiCrystalState {
  // Append to ring buffer (keep last QUASI_WINDOW entries)
  const history = [...state.history, rejected].slice(-QUASI_WINDOW);
  if (history.length < QUASI_MAX_PERIOD * 2) {
    return { ...state, history, period: 0, correlation: 0, isQuasi: false, dilationFactor: 1 };
  }

  // Compute autocorrelation at each lag τ ∈ {1..QUASI_MAX_PERIOD}
  let bestPeriod = 0;
  let bestCorr = 0;
  const n = history.length;
  for (let tau = 1; tau <= QUASI_MAX_PERIOD; tau++) {
    let match = 0;
    let total = 0;
    for (let i = tau; i < n; i++) {
      if (history[i] === history[i - tau]) match++;
      total++;
    }
    const corr = total > 0 ? match / total : 0;
    if (corr > bestCorr) { bestCorr = corr; bestPeriod = tau; }
  }

  const isQuasi = bestCorr >= QUASI_THRESHOLD;
  // Time-dilation: if quasi, reduce drain rate proportionally to correlation
  // dilationFactor = 1 - (corr - threshold) / (1 - threshold)
  // At corr=threshold: dilation=1 (normal). At corr=1: dilation=0 (fully dilated).
  const dilationFactor = isQuasi
    ? Math.max(0, 1 - (bestCorr - QUASI_THRESHOLD) / (1 - QUASI_THRESHOLD))
    : 1;

  return { history, period: bestPeriod, correlation: bestCorr, isQuasi, dilationFactor };
}

/**
 * Apply time-dilation to a backpressure ack: if the lane is quasi-crystalline,
 * set `quasi=true` so the ferry throttler can reduce its drain rate.
 */
export function applyTimeDilation(
  ack: TeachingBatchAck & { kind: "backpressure" },
  quasiState: QuasiCrystalState,
): TeachingBatchAck & { kind: "backpressure" } {
  return { ...ack, quasi: quasiState.isQuasi };
}

// ── Per-lane feedback tracker ──────────────────────────────────────────────────

/**
 * Track teaching feedback per lane.
 *
 * Maintains:
 * - Quasi-crystal state (rejection pattern detector)
 * - BNN dimension update history (which dimensions are most error-prone)
 * - Retractable belief log (for the -1 retraction pattern)
 */
export interface LaneFeedbackTracker {
  readonly laneIndex: number;
  readonly quasiState: QuasiCrystalState;
  readonly dimensionCounts: ReadonlyMap<ErrorDimension, number>;
  readonly retractableBeliefs: readonly string[];
}

export function makeLaneFeedbackTracker(laneIndex: number): LaneFeedbackTracker {
  return {
    laneIndex,
    quasiState: makeQuasiState(),
    dimensionCounts: new Map(),
    retractableBeliefs: [],
  };
}

export function updateLaneFeedback(
  tracker: LaneFeedbackTracker,
  ack: TeachingBatchAck,
): LaneFeedbackTracker {
  const rejected = ack.kind === "rejected";
  const newQuasi = updateQuasiState(tracker.quasiState, rejected);

  // Update dimension counts
  const newCounts = new Map(tracker.dimensionCounts);
  if (ack.kind === "rejected") {
    const prev = newCounts.get(ack.dimension) ?? 0;
    newCounts.set(ack.dimension, prev + 1);
  }

  // Update retractable beliefs
  const newBeliefs = ack.kind === "rejected"
    ? [...tracker.retractableBeliefs, ack.retractableBeliefId].slice(-8)
    : tracker.retractableBeliefs;

  return {
    laneIndex: tracker.laneIndex,
    quasiState: newQuasi,
    dimensionCounts: newCounts,
    retractableBeliefs: newBeliefs,
  };
}

/**
 * Get the most error-prone dimension for a lane (the one with the most rejections).
 * Returns "unknown" if no rejections have been recorded.
 */
export function dominantDimension(tracker: LaneFeedbackTracker): ErrorDimension {
  let maxCount = 0;
  let dominant: ErrorDimension = "unknown";
  for (const [dim, count] of tracker.dimensionCounts) {
    if (count > maxCount) { maxCount = count; dominant = dim; }
  }
  return dominant;
}
