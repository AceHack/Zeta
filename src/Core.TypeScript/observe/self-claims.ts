/**
 * src/Core.TypeScript/observe/self-claims.ts — probabilistic liveness via self-claims.
 *
 * An agent can voluntarily record a self-claim: "I will deliver X by tick T."
 * Claims are observable in the event log. When the deadline arrives, the claim
 * is either MET (the item was committed) or MISSED (deadline passed, not delivered).
 * The track record of met/missed claims builds a RELIABILITY score that:
 *
 *   1. Other agents use to schedule their own work (if A depends on B's output,
 *      A checks B's reliability before committing to a timeline)
 *   2. The scheduling system uses to extend or shrink the agent's window τ
 *      (consistently meeting claims EARNS more window — less scheduling pressure)
 *   3. The fleet KPI overlay uses as the DORA-like measure (the measure-first
 *      principle: measure before restricting)
 *
 * MEASURED 2026-08-17 — the three consumers above are INTENT, not wiring. `computeReliability`
 * and `schedulingWindowForDependency` have ZERO non-test callers; `adjustPressureByReliability`
 * in `ferry-throttler/optimal-cadence.ts` takes a bare `windowMultiplier: number` and nothing
 * computes one for it. The one real consumer of this module is `planning/calibration-bridge.ts`,
 * which uses the LEDGER (`recordClaim` / `markClaimMet` / `resolveAtTick`) and not the score —
 * it folds outcomes into `CalibrationLedger` and `TravelerRankLedger` instead. Read the list
 * above as a design intent with (1) and (2) unbuilt and (3) unbuilt.
 *
 * Note for anyone tempted to wire (1): `computeReliability` reads only the claiming agent's own
 * claims, and `markClaimMet` records no labeler — so its number is not CONFERRED, which is the
 * standing requirement for anything another party depends on. The composition read-path
 * (`planning/composition-read.ts`) therefore reads the conferred competence event source, not
 * this score.
 *
 * RE-MEASURED 2026-08-18, and the finding is sharper than "unbuilt" on two of the three:
 *
 *   - (1) is **refused, not merely unbuilt.** `planning/composition-read.ts` §2 states it has no
 *     parameter through which B can supply a number about B, and it has none. Wiring this score into
 *     a composition read would delete that invariant, so the gap there is a landed decision and the
 *     honest resolution is to leave it open rather than to close it.
 *   - (2) would be **vacuum-to-vacuum.** `ferry-throttler/optimal-cadence.ts` itself has zero
 *     non-test callers, so feeding `windowMultiplier` into `adjustPressureByReliability` would
 *     connect one unread number to another and *look* like the gap had closed.
 *   - (3) still has no surface.
 *
 * So this score deliberately still has no production consumer, and saying so is the correct state of
 * the record. What DID get a real consumer is the widened surface: `practice-claims.ts` (standing
 * claims about one's own practice) is read by `self-claim-standing.ts` over this repo's actual commit
 * history, where the observation changes the subject's own repair menu. If a delivery-claim ledger
 * ever exists in production, that is the shape to give this score too — self-scoped and advisory,
 * never a gate and never a number another party depends on.
 *
 * Self-claims are:
 *   - VOLUNTARY (NCI: never auto-generated, never forced)
 *   - OBSERVABLE (in the event log, visible to all peers via fold)
 *   - TRACK-RECORD-BUILDING (meeting claims grows reliability)
 *   - EXTENSIBLE (high reliability earns more autonomy: larger τ, less pressure)
 *
 * This IS the probabilistic liveness mechanism: P(commit | history) → 1 as
 * track_record_length → ∞ for agents that consistently deliver.
 *
 * SCOPE — this file is the DELIVERY-COMMITMENT instance of the self-claim principle, not the principle.
 * Its claims carry a deadline and resolve met/missed. The general case — contradiction between a
 * subject's own IDENTITY claims ("I am X" / "I do not do Y" / "my purpose is Z"), where the operation is
 * "these two self-descriptions cannot both be true" rather than "was it delivered on time" — lives in
 * src/Core.TypeScript/observe/identity-claims.ts. That module shares the VOLUNTARY / OBSERVABLE
 * properties above and adds the ones a reliability ratio cannot carry: the charity gradient in the type,
 * supersession so growth never reads as drift, and no threshold.
 *
 * The THIRD instance is `src/Core.TypeScript/observe/practice-claims.ts`: a **standing** claim about
 * one's own practice ("every commit I author carries the signature block"), contradicted by the
 * subject's own RECORD rather than by a deadline or by a second claim. It reuses this file's voluntary /
 * observable properties and `identity-claims.ts`'s charity gradient unchanged.
 *
 * Composes with:
 *   - src/Core.TypeScript/observe/observe.ts (NextAction union — self_claim is a new kind)
 *   - src/Core.TypeScript/observe/execute.ts (EventSink — claims are events)
 *   - src/Core.TypeScript/observe/event-sink-folder.ts (durable log)
 *   - src/Core.TypeScript/ferry-throttler/ (reliability → scheduling window τ)
 *   - memory/soraya/ferry-2026-07-03-probabilistic-liveness-self-claims.md (design context)
 */

// ═══ Self-Claim Types ══════════════════════════════════════════════════════════

/** A self-claim: an agent's voluntary commitment to deliver by a deadline. */
export interface SelfClaim {
  /** The claiming agent's id. */
  readonly agentId: string;
  /** What is being claimed (backlog item id, or a free-form deliverable id). */
  readonly itemId: string;
  /** Human-readable description of what's being claimed. */
  readonly title: string;
  /** The tick by which the agent claims they'll deliver (absolute tick number). */
  readonly deadline: number;
  /** When the claim was made (absolute tick number). */
  readonly claimedAt: number;
}

/** The outcome of a self-claim once the deadline passes. */
export type ClaimOutcome =
  | { readonly status: "met"; readonly completedAt: number }
  | { readonly status: "missed"; readonly reason?: string }
  | { readonly status: "pending" }; // deadline hasn't passed yet

/** A resolved claim: the original claim + its outcome. */
export interface ResolvedClaim {
  readonly claim: SelfClaim;
  readonly outcome: ClaimOutcome;
}

// ═══ Reliability Score ═════════════════════════════════════════════════════════

/** An agent's reliability: the probabilistic liveness signal. */
export interface ReliabilityScore {
  /** The agent's id. */
  readonly agentId: string;
  /** Total claims made. */
  readonly totalClaims: number;
  /** Claims met (delivered by deadline). */
  readonly metClaims: number;
  /** Claims missed (deadline passed, not delivered). */
  readonly missedClaims: number;
  /** Claims still pending (deadline hasn't passed). */
  readonly pendingClaims: number;
  /** Reliability ratio: met / (met + missed). Range [0, 1]. Undefined if no resolved claims. */
  readonly reliability: number | undefined;
  /** The earned scheduling window multiplier: higher reliability → more τ. */
  readonly windowMultiplier: number;
}

/**
 * The earned window multiplier. Extracted from `computeReliability` unchanged (2026-08-18) so the
 * three branches read as the three cases they are: no track record is NEUTRAL (never a penalty for
 * being new), above half earns window, at-or-below half shrinks it to a floor of 0.5 — the floor is
 * why the score can never fully punish anyone.
 */
function multiplierFor(reliability: number | undefined): number {
  if (reliability === undefined) return 1.0; // no track record = neutral
  if (reliability > 0.5) return 1.0 + (reliability - 0.5); // max 1.5 at reliability=1.0
  return Math.max(0.5, reliability); // floor at 0.5 (never fully punished)
}

/**
 * Compute reliability from a set of resolved claims.
 *
 * reliability = met / (met + missed)
 * windowMultiplier = 1 + (reliability - 0.5) for reliability > 0.5 (earns more window)
 *                    max(0.5, reliability) for reliability ≤ 0.5 (shrinks window, floor at 0.5)
 *
 * A new agent (no claims) has windowMultiplier = 1.0 (neutral — no track record = no bonus, no penalty).
 */
export function computeReliability(agentId: string, claims: readonly ResolvedClaim[]): ReliabilityScore {
  const agentClaims = claims.filter((c) => c.claim.agentId === agentId);
  const met = agentClaims.filter((c) => c.outcome.status === "met").length;
  const missed = agentClaims.filter((c) => c.outcome.status === "missed").length;
  const pending = agentClaims.filter((c) => c.outcome.status === "pending").length;
  const resolved = met + missed;

  const reliability = resolved > 0 ? met / resolved : undefined;
  const windowMultiplier = multiplierFor(reliability);

  return {
    agentId,
    totalClaims: agentClaims.length,
    metClaims: met,
    missedClaims: missed,
    pendingClaims: pending,
    reliability,
    windowMultiplier,
  };
}

// ═══ Claims Ledger (fold over event log) ════════════════════════════════════════

/** The claims ledger: accumulated from the event log via fold. */
export interface ClaimsLedger {
  /** All claims ever made (append-only, event-sourced). */
  readonly claims: readonly SelfClaim[];
  /** Resolved outcomes (updated as deadlines pass and items complete). */
  readonly resolved: readonly ResolvedClaim[];
}

/** Initial empty ledger. */
export const EMPTY_LEDGER: ClaimsLedger = { claims: [], resolved: [] };

/** Record a new self-claim in the ledger. */
export function recordClaim(ledger: ClaimsLedger, claim: SelfClaim): ClaimsLedger {
  return {
    ...ledger,
    claims: [...ledger.claims, claim],
    resolved: [
      ...ledger.resolved,
      { claim, outcome: { status: "pending" } },
    ],
  };
}

/** Mark a claim as met (the item was delivered by deadline). */
export function markClaimMet(ledger: ClaimsLedger, itemId: string, agentId: string, completedAt: number): ClaimsLedger {
  return {
    ...ledger,
    resolved: ledger.resolved.map((r) =>
      r.claim.itemId === itemId && r.claim.agentId === agentId && r.outcome.status === "pending"
        ? { ...r, outcome: { status: "met", completedAt } }
        : r,
    ),
  };
}

/** Mark a claim as missed (deadline passed, not delivered). */
export function markClaimMissed(ledger: ClaimsLedger, itemId: string, agentId: string, reason?: string): ClaimsLedger {
  return {
    ...ledger,
    resolved: ledger.resolved.map((r) =>
      r.claim.itemId === itemId && r.claim.agentId === agentId && r.outcome.status === "pending"
        ? { ...r, outcome: { status: "missed" as const, ...(reason ? { reason } : {}) } }
        : r,
    ),
  };
}

/**
 * Resolve all claims whose deadlines have passed at the given tick.
 * Claims that are still pending past their deadline are marked MISSED.
 * Claims for items that were completed (checkedItems) are marked MET.
 */
export function resolveAtTick(
  ledger: ClaimsLedger,
  currentTick: number,
  completedItems: ReadonlySet<string>,
): ClaimsLedger {
  return {
    ...ledger,
    resolved: ledger.resolved.map((r) => {
      if (r.outcome.status !== "pending") return r; // already resolved

      // Check if the item was completed
      if (completedItems.has(r.claim.itemId)) {
        return { ...r, outcome: { status: "met", completedAt: currentTick } };
      }

      // Check if deadline has passed
      if (currentTick >= r.claim.deadline) {
        return { ...r, outcome: { status: "missed" as const, reason: "deadline passed" } };
      }

      return r; // still pending
    }),
  };
}

// ═══ Inter-Agent Dependency ═════════════════════════════════════════════════════

/**
 * Query another agent's reliability for scheduling decisions.
 *
 * Use case: Agent A depends on Agent B's output. Before scheduling work that
 * needs B's deliverable, A checks B's reliability:
 *   - High reliability (>0.8): A can batch aggressively (large τ, trusts B's timeline)
 *   - Medium reliability (0.5-0.8): A batches conservatively (smaller τ, hedges)
 *   - Low reliability (<0.5): A commits defensively (minimal τ, doesn't depend on B's timeline)
 *
 * This is the anti-Nagle trust signal: Nagle assumes the network is reliable and
 * batches aggressively. Anti-Nagle (our ferry) adapts batching to measured
 * reliability — the self-claim history IS that measurement.
 */
export function schedulingWindowForDependency(
  dependencyReliability: ReliabilityScore,
  baseWindow: number,
): number {
  return Math.round(baseWindow * dependencyReliability.windowMultiplier);
}
