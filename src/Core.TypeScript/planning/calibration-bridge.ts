/**
 * calibration-bridge.ts — Bridge between self-claims.ts reliability tracking
 * and the CalibrationLedger coverage-at-τ scoring system.
 *
 * Design:
 *   self-claims.ts tracks met/missed claims as a simple ratio (existing system,
 *   unchanged). CalibrationLedger tracks the same events using coverage-at-τ
 *   scoring (Gneiting & Raftery 2007 eq. 43) with a Beta-Bernoulli posterior.
 *
 *   This bridge keeps the two systems independent but synchronized:
 *   - Callers that don't have a CalibrationLedger get the old self-claims
 *     behaviour unchanged (opt-in, no breaking change).
 *   - Callers that do have a CalibrationLedger get both systems updated
 *     atomically in a single call.
 *
 * Storage discipline (Otto §3.1):
 *   The CalibrationLedger is stored SEPARATELY from FlatSocietyBase.peers.
 *   unboltTaskHierarchy does a wholesale restore from base.peers, so any
 *   data stored there is erased on every unbolt. The ledger must be passed
 *   through unboltTaskHierarchy and stored by the caller — never in peers.
 *
 * Wiring:
 *   Replace direct calls to markClaimMet / markClaimMissed with calls to
 *   bridgeMarkMet / bridgeMarkMissed. Pass the CalibrationLedger if you
 *   have one; omit it if you don't.
 *
 *   For bulk tick-resolution, replace calls to resolveAtTick with
 *   resolveAtTickBridge. It calls resolveAtTick internally and co-settles
 *   all newly-resolved CalibrationLedger predictions in one pass.
 *
 * Composes with:
 *   - src/Core.TypeScript/observe/self-claims.ts (ClaimsLedger, markClaimMet, markClaimMissed, resolveAtTick)
 *   - src/Core.TypeScript/planning/calibration-ledger.ts (CalibrationLedger, settlePrediction, recordPrediction)
 *   - src/Core.TypeScript/planning/ephemeral-task-hierarchy.ts (unboltTaskHierarchy, UnboltResult)
 */

import {
  type ClaimsLedger,
  markClaimMet,
  markClaimMissed,
  recordClaim,
  resolveAtTick,
  type SelfClaim,
} from "../observe/self-claims.js";
import {
  type CalibrationLedger,
  recordPrediction,
  settlePrediction,
} from "./calibration-ledger.js";
import {
  type TravelerRankLedger,
  recordOutcome as rankRecordOutcome,
} from "./traveler-rank-ledger.js";

// ═══ Bridge Result ═══════════════════════════════════════════════════════════

/**
 * Result of a bridge operation — both ledgers updated atomically.
 * If no CalibrationLedger was provided, calibrationLedger is undefined.
 */
export interface BridgeResult {
  readonly claimsLedger: ClaimsLedger;
  readonly calibrationLedger: CalibrationLedger | undefined;
  /** Optional EP ranking ledger, updated alongside CalibrationLedger if provided. */
  readonly rankLedger: TravelerRankLedger | undefined;
}

// ═══ Bridge: Record a new claim ══════════════════════════════════════════════

/**
 * Record a new self-claim in both ledgers.
 *
 * In self-claims.ts: records the claim as pending.
 * In CalibrationLedger: records a prediction with the claim deadline as
 * predictedDeadline and the claim's createdAt tick as predictedAt.
 *
 * The predictionId is the claim's itemId — this is the join key used
 * by bridgeMarkMet / bridgeMarkMissed to settle the prediction.
 *
 * @param claimsLedger  The existing ClaimsLedger.
 * @param claim         The self-claim to record.
 * @param calibrationLedger  Optional CalibrationLedger to co-update.
 * @param zid           The agent's zeta-id (required if calibrationLedger is provided).
 * @param hatId         The hat/task id (required if calibrationLedger is provided).
 * @param claimedAtMs   The wall-clock ms when the claim was made (defaults to Date.now()).
 */
export function bridgeRecordClaim(
  claimsLedger: ClaimsLedger,
  claim: SelfClaim,
  calibrationLedger?: CalibrationLedger,
  zid?: string,
  hatId?: string,
  claimedAtMs: number = Date.now(),
): BridgeResult {
  const newClaimsLedger = recordClaim(claimsLedger, claim);

  if (!calibrationLedger || !zid || !hatId) {
    return { claimsLedger: newClaimsLedger, calibrationLedger, rankLedger: undefined };
  }

  // Map claim deadline (tick) to a wall-clock ms estimate.
  // The claim deadline is in ticks; we store it as a ms timestamp.
  // Callers that have a real tick→ms mapping should pass claimedAtMs and
  // compute deadlineMs themselves — this default treats the deadline as ms
  // directly, which is correct when ticks are Unix ms (the common case).
  const deadlineMs = claim.deadline;

  const newCalibrationLedger = recordPrediction(
    calibrationLedger,
    zid,
    hatId,
    /* predictionId = */ claim.itemId,
    /* predictedDeadline = */ deadlineMs,
    /* predictedAt = */ claimedAtMs,
  );

  return { claimsLedger: newClaimsLedger, calibrationLedger: newCalibrationLedger, rankLedger: undefined };
}

// ═══ Bridge: Mark a claim met ════════════════════════════════════════════════

/**
 * Mark a claim as met in both ledgers.
 *
 * In self-claims.ts: marks the claim as met (status = "met").
 * In CalibrationLedger: settles the prediction with settledAt = completedAtMs.
 *
 * @param claimsLedger  The existing ClaimsLedger.
 * @param itemId        The claim's itemId.
 * @param agentId       The claiming agent's id.
 * @param completedAt   The tick at which the item was completed.
 * @param calibrationLedger  Optional CalibrationLedger to co-update.
 * @param zid           The agent's zeta-id (required if calibrationLedger is provided).
 * @param hatId         The hat/task id (required if calibrationLedger is provided).
 * @param completedAtMs The wall-clock ms when the item was completed (defaults to Date.now()).
 */
export function bridgeMarkMet(
  claimsLedger: ClaimsLedger,
  itemId: string,
  agentId: string,
  completedAt: number,
  calibrationLedger?: CalibrationLedger,
  zid?: string,
  hatId?: string,
  completedAtMs: number = Date.now(),
): BridgeResult {
  const newClaimsLedger = markClaimMet(claimsLedger, itemId, agentId, completedAt);

  if (!calibrationLedger || !zid || !hatId) {
    return { claimsLedger: newClaimsLedger, calibrationLedger, rankLedger: undefined };
  }

  const newCalibrationLedger = settlePrediction(
    calibrationLedger,
    zid,
    hatId,
    /* predictionId = */ itemId,
    /* settledAt = */ completedAtMs,
  );

  return { claimsLedger: newClaimsLedger, calibrationLedger: newCalibrationLedger, rankLedger: undefined };
}

// ═══ Bridge: Mark a claim missed ═════════════════════════════════════════════

/**
 * Mark a claim as missed in both ledgers.
 *
 * In self-claims.ts: marks the claim as missed (status = "missed").
 * In CalibrationLedger: settles the prediction with settledAt = missedAtMs.
 * A missed claim is settled at the deadline — the agent did not deliver,
 * so the actual completion time is treated as "never within the interval."
 *
 * @param claimsLedger  The existing ClaimsLedger.
 * @param itemId        The claim's itemId.
 * @param agentId       The claiming agent's id.
 * @param reason        Optional reason for the miss.
 * @param calibrationLedger  Optional CalibrationLedger to co-update.
 * @param zid           The agent's zeta-id (required if calibrationLedger is provided).
 * @param hatId         The hat/task id (required if calibrationLedger is provided).
 * @param missedAtMs    The wall-clock ms when the miss was recorded (defaults to Date.now()).
 */
export function bridgeMarkMissed(
  claimsLedger: ClaimsLedger,
  itemId: string,
  agentId: string,
  reason?: string,
  calibrationLedger?: CalibrationLedger,
  zid?: string,
  hatId?: string,
  missedAtMs: number = Date.now(),
): BridgeResult {
  const newClaimsLedger = markClaimMissed(claimsLedger, itemId, agentId, reason);

  if (!calibrationLedger || !zid || !hatId) {
    return { claimsLedger: newClaimsLedger, calibrationLedger, rankLedger: undefined };
  }

  // Settle the prediction at missedAtMs — which is after the deadline,
  // so the interval score will include the late-miss penalty.
  const newCalibrationLedger = settlePrediction(
    calibrationLedger,
    zid,
    hatId,
    /* predictionId = */ itemId,
    /* settledAt = */ missedAtMs,
  );

  return { claimsLedger: newClaimsLedger, calibrationLedger: newCalibrationLedger, rankLedger: undefined };
}

// ═══ Bridge: Bulk-resolve at tick ════════════════════════════════════════════

/**
 * Bulk-settle all pending claims and CalibrationLedger predictions in one pass.
 *
 * Mirrors `resolveAtTick` in self-claims.ts but co-updates the CalibrationLedger
 * atomically:
 *   - For each claim resolved as MET: settles the CalibrationLedger prediction
 *     at `currentTickMs` (the actual completion time — a hit if within the interval).
 *   - For each claim resolved as MISSED: settles the CalibrationLedger prediction
 *     at `currentTickMs` (after the deadline — a late-miss with interval penalty).
 *   - Claims that remain pending are not touched in the CalibrationLedger.
 *
 * The `zid` and `hatId` parameters are required to locate the CalibrationLedger
 * record. If either is absent, the CalibrationLedger is not updated (backward-compat).
 *
 * Anti-self-certifying: if this function is disabled (CalibrationLedger not passed),
 * the CalibrationLedger posterior does NOT update. A test that passes with the
 * CalibrationLedger absent is testing the wrong thing — the anti-self-certifying
 * test in calibration-bridge.test.ts verifies that the posterior shifts after
 * a bulk-miss via this function.
 *
 * @param claimsLedger     The existing ClaimsLedger.
 * @param currentTick      The current tick (used by resolveAtTick for deadline comparison).
 * @param completedItems   Items that have been completed at this tick.
 * @param calibrationLedger  Optional CalibrationLedger to co-update.
 * @param zid              The agent's zeta-id (required if calibrationLedger is provided).
 * @param hatId            The hat/task id (required if calibrationLedger is provided).
 * @param currentTickMs    The wall-clock ms for this tick (defaults to Date.now()).
 *                         Used as the settledAt timestamp for CalibrationLedger.
 */
export function resolveAtTickBridge(
  claimsLedger: ClaimsLedger,
  currentTick: number,
  completedItems: ReadonlySet<string>,
  calibrationLedger?: CalibrationLedger,
  zid?: string,
  hatId?: string,
  currentTickMs: number = Date.now(),
  /** Optional EP ranking ledger to co-update alongside CalibrationLedger. */
  rankLedger?: TravelerRankLedger,
  /** Hat domain for EP ranking (defaults to hatId if not provided). */
  rankDomain?: string,
): BridgeResult {
  // Identify which pending claims will be resolved before calling resolveAtTick.
  // We need to know which ones become MET vs MISSED to settle the CalibrationLedger.
  const pendingBefore = claimsLedger.resolved.filter((r) => r.outcome.status === "pending");

  // Run the self-claims resolution.
  const newClaimsLedger = resolveAtTick(claimsLedger, currentTick, completedItems);

  if (!calibrationLedger || !zid || !hatId) {
    return { claimsLedger: newClaimsLedger, calibrationLedger, rankLedger };
  }

  // Settle the CalibrationLedger for each claim that was just resolved.
  let newCalibrationLedger = calibrationLedger;
  for (const pending of pendingBefore) {
    const resolved = newClaimsLedger.resolved.find(
      (r) => r.claim.itemId === pending.claim.itemId && r.claim.agentId === pending.claim.agentId,
    );
    if (!resolved || resolved.outcome.status === "pending") {
      continue; // still pending — not resolved this tick
    }
    // Settle the prediction at currentTickMs regardless of met/missed.
    // For a MET claim: currentTickMs is the actual completion time.
    //   If it falls within [predictedAt, predictedDeadline] → hit.
    // For a MISSED claim: currentTickMs is after the deadline.
    //   The interval score will include the late-miss penalty.
    newCalibrationLedger = settlePrediction(
      newCalibrationLedger,
      zid,
      hatId,
      /* predictionId = */ pending.claim.itemId,
      /* settledAt = */ currentTickMs,
    );
  }

  // Co-update the EP ranking ledger if provided.
  // Each settled claim is a hit (MET) or miss (MISSED) observation for the (zid, domain) pair.
  let newRankLedger = rankLedger;
  if (rankLedger !== undefined && zid !== undefined) {
    const domain = rankDomain ?? hatId;
    for (const pending of pendingBefore) {
      const resolved = newClaimsLedger.resolved.find(
        (r) => r.claim.itemId === pending.claim.itemId && r.claim.agentId === pending.claim.agentId,
      );
      if (!resolved || resolved.outcome.status === "pending") {
        continue;
      }
      const hit = resolved.outcome.status === "met";
      newRankLedger = rankRecordOutcome(zid, domain!, hit, newRankLedger);
    }
  }
  return { claimsLedger: newClaimsLedger, calibrationLedger: newCalibrationLedger, rankLedger: newRankLedger };
}
