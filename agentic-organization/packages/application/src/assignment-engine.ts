/**
 * Assignment engine — staffs a hat by ranking eligible agents by reputation and
 * choosing within the RMO supply target (CLUSTER_NATIVE_HAT_SYSTEM.md reputation
 * model + ANTI_STALL hat-supply). Determinism computes the eligible+supply-
 * permitted set; the agent chooser picks the wearer; supply exhaustion routes
 * back to RMO instead of over-staffing.
 *
 * Eligibility filters (deterministic, auditable): not already an active/warmup
 * wearer of this hat, not in cooldown for it, not wearing a conflicting hat, and
 * under the per-agent active-hat cap. Ranking is reputation on the agent-hat
 * pairing (never only an agent score).
 */

import { HatBindingPhase } from "../../domain/src/hat-binding.ts";
import { OrgEventKind, type OrgEvent } from "../../domain/src/org-event.ts";
import type { HatDefinition } from "../../domain/src/hat-definition.ts";
import { chooseWithinLegal, type OrgChooser } from "./org-decision.ts";
import { ReputationOutcomeClass, type ReputationPosteriorSummary, type ReputationReadModel } from "./reputation.ts";

export type AgentCandidate = {
  agentId: string;
  /** reputation on the agent-hat pairing (default 0 for unknown pairings) */
  reputationByHat: Readonly<Record<string, number>>;
  posteriorReputationByHat?: Readonly<Record<string, { quality: ReputationPosteriorSummary }>> | undefined;
};

export type ReputationRankableAgentCandidate = {
  agentId: string;
  reputationByHat?: Readonly<Record<string, number>> | undefined;
  posteriorReputationByHat?: Readonly<Record<string, { quality: ReputationPosteriorSummary }>> | undefined;
};

/** A snapshot of an active/recent binding the engine must respect. */
export type ActiveBindingSummary = {
  hatId: string;
  wearerAgentId: string;
  phase: HatBindingPhase;
  cooldownUntil?: string;
};

const NON_TERMINAL: ReadonlySet<HatBindingPhase> = new Set([
  HatBindingPhase.Pending,
  HatBindingPhase.Warmup,
  HatBindingPhase.Active,
  HatBindingPhase.Probation,
]);

function activeHatCount(agentId: string, bindings: readonly ActiveBindingSummary[]): number {
  return bindings.filter((b) => b.wearerAgentId === agentId && NON_TERMINAL.has(b.phase)).length;
}

function inCooldownForHat(agentId: string, hatId: string, bindings: readonly ActiveBindingSummary[], nowMs: number): boolean {
  return bindings.some(
    (b) => b.wearerAgentId === agentId && b.hatId === hatId && b.cooldownUntil !== undefined && nowMs < Date.parse(b.cooldownUntil),
  );
}

function wearsConflictingHat(agentId: string, hat: HatDefinition, bindings: readonly ActiveBindingSummary[]): boolean {
  const conflicts = new Set(hat.conflictsWithHatIds);
  return bindings.some((b) => b.wearerAgentId === agentId && NON_TERMINAL.has(b.phase) && conflicts.has(b.hatId));
}

export type RankEligibleInput = {
  hat: HatDefinition;
  candidates: readonly AgentCandidate[];
  activeBindings: readonly ActiveBindingSummary[];
  nowMs: number;
  /** max hats one agent may actively wear at once (default 3) */
  agentMaxActiveHats?: number;
};

export type RankEligibleWithReputationInput = Omit<RankEligibleInput, "candidates"> & {
  candidates: readonly ReputationRankableAgentCandidate[];
  reputation: {
    readModel: ReputationReadModel;
    organizationId: string;
    workType: string;
  };
};

/** Filter to eligible candidates and rank them by agent-hat reputation (desc, stable). */
export function rankEligibleCandidates(input: RankEligibleInput): readonly AgentCandidate[] {
  const cap = input.agentMaxActiveHats ?? 3;
  const eligible = input.candidates.filter((c) => {
    const alreadyWearing = input.activeBindings.some(
      (b) => b.wearerAgentId === c.agentId && b.hatId === input.hat.id && NON_TERMINAL.has(b.phase),
    );
    if (alreadyWearing) return false;
    if (inCooldownForHat(c.agentId, input.hat.id, input.activeBindings, input.nowMs)) return false;
    if (wearsConflictingHat(c.agentId, input.hat, input.activeBindings)) return false;
    if (activeHatCount(c.agentId, input.activeBindings) >= cap) return false;
    return true;
  });
  return [...eligible].sort((a, b) => {
    const ra = a.reputationByHat[input.hat.id] ?? 0;
    const rb = b.reputationByHat[input.hat.id] ?? 0;
    if (rb !== ra) return rb - ra;
    return a.agentId < b.agentId ? -1 : a.agentId > b.agentId ? 1 : 0;
  });
}

export function rankEligibleCandidatesWithReputation(input: RankEligibleWithReputationInput): readonly AgentCandidate[] {
  return rankEligibleCandidates({
    ...input,
    candidates: input.candidates.map((candidate) => {
      const quality = input.reputation.readModel.summaryFor({
        organizationId: input.reputation.organizationId,
        agentId: candidate.agentId,
        hatId: input.hat.id,
        workType: input.reputation.workType,
        outcomeClass: ReputationOutcomeClass.Quality,
      });
      return {
        agentId: candidate.agentId,
        reputationByHat: {
          ...(candidate.reputationByHat ?? {}),
          [input.hat.id]: quality.mean,
        },
        posteriorReputationByHat: {
          ...(candidate.posteriorReputationByHat ?? {}),
          [input.hat.id]: { quality },
        },
      };
    }),
  });
}

export type AssignmentResult =
  | { outcome: "assigned"; agentId: string; reason: string; event: OrgEvent }
  | { outcome: "supply_exhausted"; reason: string; event: OrgEvent }
  | { outcome: "no_eligible_candidate"; reason: string };

export type AssignHatContext = {
  createEventId: () => string;
  nowIso: () => string;
  organizationId: string;
  supervisorChain: readonly string[];
  correlationId: string;
  causationId: string;
  traceId: string;
};

function assignmentEvent(ctx: AssignHatContext, hat: HatDefinition, toState: string, decision: string, agentId?: string): OrgEvent {
  return {
    id: ctx.createEventId(),
    kind: OrgEventKind.HatAssignment,
    occurredAt: ctx.nowIso(),
    organizationId: ctx.organizationId,
    actorHatId: hat.id,
    ...(agentId !== undefined ? { actorAgentId: agentId } : {}),
    departmentId: hat.departmentId,
    subjectId: hat.id,
    toState,
    decision,
    supervisorChain: ctx.supervisorChain,
    evidenceRefs: [],
    correlationId: ctx.correlationId,
    causationId: ctx.causationId,
    traceId: ctx.traceId,
  };
}

/**
 * Staff one hat. If the active wearer count already meets the RMO supply target,
 * the engine refuses to over-staff and emits a supply-exhausted event (routes to
 * RMO). Otherwise the chooser picks among eligible candidates; the caller then
 * creates the binding (beginBinding).
 */
export function assignHat(
  input: {
    hat: HatDefinition;
    eligibleRanked: readonly AgentCandidate[];
    activeWearerCount: number;
    supplyTarget: number;
    chooser: OrgChooser<AgentCandidate>;
  },
  ctx: AssignHatContext,
): AssignmentResult {
  if (input.activeWearerCount >= input.supplyTarget) {
    return {
      outcome: "supply_exhausted",
      reason: `${input.hat.name} at supply cap (${input.activeWearerCount}/${input.supplyTarget})`,
      event: assignmentEvent(ctx, input.hat, "supply_exhausted", `${input.hat.name} supply exhausted at ${input.activeWearerCount}/${input.supplyTarget} — routing to RMO`),
    };
  }
  if (input.eligibleRanked.length === 0) {
    return { outcome: "no_eligible_candidate", reason: `no eligible candidate for ${input.hat.name}` };
  }
  const choice = chooseWithinLegal(input.eligibleRanked, `assign ${input.hat.name}`, input.chooser);
  if (choice.outcome === "no_legal_option") {
    return { outcome: "no_eligible_candidate", reason: choice.reason };
  }
  const agentId = choice.option.agentId;
  return {
    outcome: "assigned",
    agentId,
    reason: choice.reason,
    event: assignmentEvent(ctx, input.hat, "assigned", `${input.hat.name} assigned to ${agentId} (${choice.reason}); wearer ${input.activeWearerCount + 1}/${input.supplyTarget}`, agentId),
  };
}
