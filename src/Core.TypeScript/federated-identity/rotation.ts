/**
 * rotation.ts — unattended rotation, designed as the NORMAL case.
 *
 * Aaron's objective is reliable agent operation with no human in the loop, so
 * renewal is not an error path that occasionally runs — it is the steady state,
 * and the interesting questions are all at the edges:
 *
 *   - When does an agent renew? (Not "when expired" — that is already too late.)
 *   - What does an agent DO when renewal fails mid-task?
 *   - Does it lose work?
 *
 * ── THE THREE-BAND MODEL ─────────────────────────────────────────────────────
 *
 *   |------------------ credential lifetime ------------------|
 *   | HEALTHY          | RENEWING        | DRAINING  | EXPIRED
 *   ^issued            ^renewAt          ^checkpoint ^expires
 *
 *   HEALTHY   — work freely.
 *   RENEWING  — attempt renewal, keep working. The credential is still valid, so
 *               a failed attempt here costs nothing but a retry.
 *   DRAINING  — renewal has not succeeded and expiry is close. Start NO new work,
 *               finish or checkpoint what is in flight. This band is the answer
 *               to "does it lose work": the work-preservation window is reserved
 *               BEFORE expiry, not discovered at it.
 *   EXPIRED   — fail closed. No new credential-bearing action.
 *
 * The reserve exists because the alternative is an agent that is killed
 * mid-transaction by an expiry it could see coming. §5 memory preservation says
 * an identity transition must never silently destroy memory; an expiry that
 * discards in-flight work is that destruction with a clock as the excuse.
 *
 * ── WHY THIS IS SAFE TO DO UNATTENDED, AND WHERE IT STOPS ────────────────────
 * Renewing a LEAF under a root the node already holds cannot widen trust. Rotating
 * the ROOT can, so it is gated — see `ceremony-gate.ts`. The whole point of
 * short-lived leaves is that the frequent operation is the harmless one.
 *
 * ── TIME ─────────────────────────────────────────────────────────────────────
 * Every function takes agreed `Phase`. A node's wall clock decides only *when it
 * wakes up to ask*; it never decides *whether a credential is valid*. Those are
 * the two orders that must not cross.
 *
 * REGISTER: `unmetered`. The planner is pure and fully tested including its
 * boundaries. It has never run against a real SPIRE agent, and the band widths
 * are policy dials chosen by argument, not measured against a workload.
 */

import { type Phase } from "./ports.ts";
import { type SvidClaim } from "./local-issuer.ts";

export interface RotationPolicy {
  /** Requested lifetime for a fresh SVID, in phases. */
  readonly lifetimePhases: number;
  /**
   * Fraction of lifetime elapsed before renewal starts. SPIRE's own default is
   * one half, and the reasoning is the reason to copy it rather than the
   * authority: at 0.5 the agent gets a full half-life of retries before the
   * credential is in any danger, so a transient failure is invisible.
   */
  readonly renewAtFraction: number;
  /**
   * Phases reserved at the END of the lifetime for draining and checkpointing.
   * MUST be > 0, or "does it lose work" has the answer "yes".
   */
  readonly checkpointReservePhases: number;
}

export type RotationBand = "healthy" | "renewing" | "draining" | "expired";

export interface RotationPlan {
  readonly band: RotationBand;
  /** What the agent should do about work, not about credentials. */
  readonly workDisposition: "proceed" | "proceed-and-renew" | "drain-and-checkpoint" | "fail-closed";
  readonly renewNow: boolean;
  /** Phase at which the agent should look again. */
  readonly nextCheckPhase: Phase;
  readonly reason: string;
}

export type RotationPolicyError =
  | { readonly kind: "lifetime-not-positive"; readonly lifetimePhases: number }
  | { readonly kind: "fraction-out-of-range"; readonly renewAtFraction: number }
  | { readonly kind: "reserve-not-positive"; readonly checkpointReservePhases: number }
  | {
      readonly kind: "reserve-swallows-renew-window";
      readonly renewAtPhaseOffset: number;
      readonly checkpointOffset: number;
    };

/**
 * Refuse a policy whose bands are degenerate.
 *
 * The last case is the subtle one and the reason this validator exists: if the
 * checkpoint reserve starts at or before the renewal point, the RENEWING band is
 * empty and the agent goes straight from healthy to draining. It would still
 * "work", it would just never get the free retries — a silent loss of the
 * property the design exists for, invisible in any test that only checks that
 * renewal eventually happens.
 */
export function validateRotationPolicy(
  policy: RotationPolicy,
): { readonly ok: true } | { readonly ok: false; readonly error: RotationPolicyError } {
  if (!Number.isSafeInteger(policy.lifetimePhases) || policy.lifetimePhases <= 0) {
    return { ok: false, error: { kind: "lifetime-not-positive", lifetimePhases: policy.lifetimePhases } };
  }
  if (!(policy.renewAtFraction > 0 && policy.renewAtFraction < 1)) {
    return { ok: false, error: { kind: "fraction-out-of-range", renewAtFraction: policy.renewAtFraction } };
  }
  if (!Number.isSafeInteger(policy.checkpointReservePhases) || policy.checkpointReservePhases <= 0) {
    return {
      ok: false,
      error: { kind: "reserve-not-positive", checkpointReservePhases: policy.checkpointReservePhases },
    };
  }
  const renewAtOffset = Math.floor(policy.lifetimePhases * policy.renewAtFraction);
  const checkpointOffset = policy.lifetimePhases - policy.checkpointReservePhases;
  if (checkpointOffset <= renewAtOffset) {
    return {
      ok: false,
      error: { kind: "reserve-swallows-renew-window", renewAtPhaseOffset: renewAtOffset, checkpointOffset },
    };
  }
  return { ok: true };
}

/** Phase at which renewal should begin for a given claim. */
export function renewAtPhase(claim: SvidClaim, policy: RotationPolicy): Phase {
  const lifetime = claim.expiresAtPhase - claim.issuedAtPhase;
  return claim.issuedAtPhase + Math.floor(lifetime * policy.renewAtFraction);
}

/** Phase at which the agent must stop taking new work and checkpoint. */
export function checkpointDeadlinePhase(claim: SvidClaim, policy: RotationPolicy): Phase {
  return claim.expiresAtPhase - policy.checkpointReservePhases;
}

/**
 * The planner. Pure; no clock, no I/O, no retry state.
 *
 * `renewalAttemptsFailed` is supplied by the caller rather than tracked here, so
 * the function stays total and replayable: same inputs, same plan, every run.
 */
export function planRotation(params: {
  readonly claim: SvidClaim;
  readonly policy: RotationPolicy;
  readonly currentPhase: Phase;
  readonly renewalAttemptsFailed: number;
}): RotationPlan {
  const { claim, policy, currentPhase, renewalAttemptsFailed } = params;
  const renewAt = renewAtPhase(claim, policy);
  const checkpointAt = checkpointDeadlinePhase(claim, policy);

  if (currentPhase >= claim.expiresAtPhase) {
    return {
      band: "expired",
      workDisposition: "fail-closed",
      renewNow: false,
      nextCheckPhase: currentPhase,
      reason: `credential expired at phase ${String(claim.expiresAtPhase)}; no credential-bearing action may proceed. Work should already have been checkpointed at phase ${String(checkpointAt)}`,
    };
  }
  if (currentPhase >= checkpointAt) {
    return {
      band: "draining",
      workDisposition: "drain-and-checkpoint",
      renewNow: true,
      nextCheckPhase: currentPhase + 1,
      reason:
        `phase ${String(currentPhase)} is inside the ${String(policy.checkpointReservePhases)}-phase checkpoint reserve before expiry at ${String(claim.expiresAtPhase)} ` +
        `(${String(renewalAttemptsFailed)} renewal attempts failed). Take no new work; finish or checkpoint what is in flight so expiry does not destroy it`,
    };
  }
  if (currentPhase >= renewAt) {
    return {
      band: "renewing",
      workDisposition: "proceed-and-renew",
      renewNow: true,
      nextCheckPhase: currentPhase + 1,
      reason: `phase ${String(currentPhase)} passed the renewal point ${String(renewAt)}; the credential is still valid until ${String(claim.expiresAtPhase)}, so a failed attempt costs a retry and nothing else`,
    };
  }
  return {
    band: "healthy",
    workDisposition: "proceed",
    renewNow: false,
    nextCheckPhase: renewAt,
    reason: `credential healthy until the renewal point at phase ${String(renewAt)}`,
  };
}

/**
 * Bundle refresh has the same shape and a different consequence, so it gets its
 * own planner rather than reusing the one above.
 *
 * The consequence that differs: a leaf that fails to renew stops ONE workload. A
 * peer bundle that goes stale stops the node accepting an entire peer domain —
 * and with no global CRL, that staleness IS this node's only revocation
 * mechanism. So the refresh point must sit well inside the staleness ceiling,
 * and letting a bundle lapse must be a normal, safe outcome rather than an
 * outage. It fails CLOSED: a stale peer is simply not accepted.
 */
export function planBundleRefresh(params: {
  readonly bundleIssuedAtPhase: Phase;
  readonly maxBundleAgePhases: number;
  readonly refreshAtFraction: number;
  readonly currentPhase: Phase;
}): { readonly refreshNow: boolean; readonly stale: boolean; readonly nextCheckPhase: Phase; readonly reason: string } {
  const { bundleIssuedAtPhase, maxBundleAgePhases, refreshAtFraction, currentPhase } = params;
  const age = currentPhase - bundleIssuedAtPhase;
  const refreshAtAge = Math.floor(maxBundleAgePhases * refreshAtFraction);
  if (age > maxBundleAgePhases) {
    return {
      refreshNow: true,
      stale: true,
      nextCheckPhase: currentPhase + 1,
      reason: `peer bundle is ${String(age)} phases old, past the ${String(maxBundleAgePhases)} ceiling — the peer is no longer accepted. This is the revocation mechanism working, not a fault`,
    };
  }
  if (age >= refreshAtAge) {
    return {
      refreshNow: true,
      stale: false,
      nextCheckPhase: currentPhase + 1,
      reason: `peer bundle is ${String(age)} phases old; refresh point is ${String(refreshAtAge)}, ceiling is ${String(maxBundleAgePhases)}`,
    };
  }
  return {
    refreshNow: false,
    stale: false,
    nextCheckPhase: bundleIssuedAtPhase + refreshAtAge,
    reason: `peer bundle fresh (${String(age)}/${String(maxBundleAgePhases)} phases)`,
  };
}
