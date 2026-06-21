/**
 * RMO (Resource Management Office) — decides how many of each hat must be staffed
 * at any time, driven by the prioritized task workload (ANTI_STALL_PRIORITY_
 * RUNTIME.md §Hat supply and budget review).
 *
 * The DEMAND (required count per hat) is computed deterministically from the
 * non-paused, prioritized work. Supervisors (Directors, Cost Controller, CFO,
 * Hat Approval Steward) then VOTE on whether to act and the target count — the
 * agents drive the staffing outcome; the tally is deterministic.
 */

import { OrgEventKind, type OrgEvent } from "../../domain/src/org-event.ts";
import { chooseWithinLegal, type OrgChooser } from "./org-decision.ts";
import { PriorityClass } from "./prioritization.ts";

/** A prioritized work item's staffing demand. */
export type WorkloadItem = {
  workItemId: string;
  priorityClass: PriorityClass;
  requiredHats: readonly string[];
};

export type RmoHatCandidateReputation = {
  agentId: string;
  hatId: string;
  agentHatReputation: number;
  recentOutcomeScore: number;
  scheduleReliability: number;
  reviewQuality: number;
  qaPassRate: number;
  completionRate: number;
  contextFit: number;
  currentLoad: number;
  freshness: number;
  explorationBonus: number;
  consecutiveAssignmentCount: number;
  recentSameHatAssignments: number;
  posterior?: {
    quality: {
      sampleCount: number;
      mean: number;
      lowerConfidenceBound: number;
      uncertainty: number;
      evidenceRefs: readonly string[];
    };
    latency?: {
      sampleCount: number;
      mean: number;
      lowerConfidenceBound: number;
      uncertainty: number;
      evidenceRefs: readonly string[];
    } | undefined;
    cost?: {
      sampleCount: number;
      mean: number;
      lowerConfidenceBound: number;
      uncertainty: number;
      evidenceRefs: readonly string[];
    } | undefined;
    evidenceRefs: readonly string[];
  } | undefined;
};

export type RmoHatCandidateScoreComponents = {
  agentHatReputation: number;
  recentOutcomeScore: number;
  scheduleReliability: number;
  reviewQuality: number;
  qaPassRate: number;
  completionRate: number;
  contextFit: number;
  freshness: number;
  explorationBonus: number;
  currentLoadPenalty: number;
  consecutiveAssignmentPenalty: number;
  recentSameHatPenalty: number;
};

export type RankedRmoHatCandidate = {
  agentId: string;
  hatId: string;
  rank: number;
  score: number;
  components: RmoHatCandidateScoreComponents;
  reasonCodes: readonly string[];
  posterior?: RmoHatCandidateReputation["posterior"] | undefined;
};

export type RankRmoHatCandidatesInput = {
  hatId: string;
  candidates: readonly RmoHatCandidateReputation[];
};

export type RmoHatAssignmentDecision =
  | {
      outcome: "assigned";
      selected: RankedRmoHatCandidate;
      rankedCandidates: readonly RankedRmoHatCandidate[];
      event: OrgEvent;
    }
  | {
      outcome: "no_legal_candidate";
      reason: string;
    };

export type DecideRmoHatAssignmentContext = {
  createEventId: () => string;
  nowIso: () => string;
  organizationId: string;
  supervisorChain: readonly string[];
  correlationId: string;
  causationId: string;
  traceId: string;
};

const RmoOfficeHatId = "rmo_office";

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function rounded(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function scoreCandidate(candidate: RmoHatCandidateReputation): Omit<RankedRmoHatCandidate, "rank"> {
  const components: RmoHatCandidateScoreComponents = {
    agentHatReputation: clamp01(candidate.agentHatReputation) * 4,
    recentOutcomeScore: clamp01(candidate.recentOutcomeScore) * 2,
    scheduleReliability: clamp01(candidate.scheduleReliability) * 1.25,
    reviewQuality: clamp01(candidate.reviewQuality),
    qaPassRate: clamp01(candidate.qaPassRate),
    completionRate: clamp01(candidate.completionRate),
    contextFit: clamp01(candidate.contextFit),
    freshness: clamp01(candidate.freshness) * 0.5,
    explorationBonus: clamp01(candidate.explorationBonus) * 0.5,
    currentLoadPenalty: clamp01(candidate.currentLoad) * 2,
    consecutiveAssignmentPenalty: Math.max(0, candidate.consecutiveAssignmentCount) * 0.75,
    recentSameHatPenalty: Math.max(0, candidate.recentSameHatAssignments) * 0.4,
  };
  const score =
    components.agentHatReputation +
    components.recentOutcomeScore +
    components.scheduleReliability +
    components.reviewQuality +
    components.qaPassRate +
    components.completionRate +
    components.contextFit +
    components.freshness +
    components.explorationBonus -
    components.currentLoadPenalty -
    components.consecutiveAssignmentPenalty -
    components.recentSameHatPenalty;
  return {
    agentId: candidate.agentId,
    hatId: candidate.hatId,
    score: rounded(score),
    components,
    reasonCodes: reasonCodesFor(candidate),
    ...(candidate.posterior !== undefined ? { posterior: candidate.posterior } : {}),
  };
}

function reasonCodesFor(candidate: RmoHatCandidateReputation): readonly string[] {
  const reasons: string[] = [];
  if (candidate.agentHatReputation >= 0.8) reasons.push("strong_agent_hat_reputation");
  if (candidate.recentOutcomeScore >= 0.8) reasons.push("strong_recent_outcomes");
  if (candidate.scheduleReliability >= 0.8) reasons.push("strong_schedule_reliability");
  if (candidate.reviewQuality >= 0.8) reasons.push("strong_review_quality");
  if (candidate.qaPassRate >= 0.8) reasons.push("strong_qa_pass_rate");
  if (candidate.completionRate >= 0.8) reasons.push("strong_completion_rate");
  if (candidate.contextFit >= 0.8) reasons.push("strong_context_fit");
  if (candidate.explorationBonus >= 0.5 || candidate.freshness >= 0.8) reasons.push("exploration_candidate");
  if (candidate.currentLoad >= 0.7) reasons.push("load_penalty");
  if (candidate.consecutiveAssignmentCount > 0 || candidate.recentSameHatAssignments > 0) reasons.push("lock_in_penalty");
  if (candidate.posterior !== undefined && candidate.posterior.evidenceRefs.length > 0) reasons.push("posterior_reputation_evidence");
  if (reasons.length === 0) reasons.push("baseline_reputation_evidence");
  return reasons;
}

export function rankRmoHatCandidates(input: RankRmoHatCandidatesInput): readonly RankedRmoHatCandidate[] {
  return input.candidates
    .filter((candidate) => candidate.hatId === input.hatId)
    .map(scoreCandidate)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.agentId < b.agentId ? -1 : a.agentId > b.agentId ? 1 : 0;
    })
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
}

export function decideRmoHatAssignment(
  input: {
    hatId: string;
    hatName: string;
    rankedCandidates: readonly RankedRmoHatCandidate[];
    chooser: OrgChooser<RankedRmoHatCandidate>;
  },
  ctx: DecideRmoHatAssignmentContext,
): RmoHatAssignmentDecision {
  const legal = input.rankedCandidates.filter((candidate) => candidate.hatId === input.hatId);
  const choice = chooseWithinLegal(legal, `RMO assignment for ${input.hatName}`, input.chooser);
  if (choice.outcome === "no_legal_option") {
    return { outcome: "no_legal_candidate", reason: choice.reason };
  }
  const selected = choice.option;
  const alternatives = legal
    .filter((candidate) => candidate.agentId !== selected.agentId)
    .map((candidate) => `#${candidate.rank} ${candidate.agentId} score=${candidate.score}`)
    .join("; ");
  return {
    outcome: "assigned",
    selected,
    rankedCandidates: legal,
    event: {
      id: ctx.createEventId(),
      kind: OrgEventKind.HatAssignment,
      occurredAt: ctx.nowIso(),
      organizationId: ctx.organizationId,
      actorHatId: RmoOfficeHatId,
      actorAgentId: selected.agentId,
      subjectId: input.hatId,
      toState: "assigned",
      decision: `RMO office selected ${selected.agentId} for ${input.hatName} rank #${selected.rank} score=${selected.score} (${choice.reason}); reasons: ${selected.reasonCodes.join(", ")}; alternatives: ${alternatives.length === 0 ? "none" : alternatives}`,
      supervisorChain: ctx.supervisorChain,
      evidenceRefs: selected.posterior?.evidenceRefs ?? [],
      correlationId: ctx.correlationId,
      causationId: ctx.causationId,
      traceId: ctx.traceId,
    },
  };
}

/** Priority weight: expedite/high reserve extra headroom; paused contributes nothing. */
function demandWeight(priorityClass: PriorityClass): number {
  switch (priorityClass) {
    case PriorityClass.Expedite: return 2;
    case PriorityClass.High: return 2;
    case PriorityClass.Normal: return 1;
    case PriorityClass.Defer: return 1;
    case PriorityClass.Paused: return 0;
  }
}

/** Required count per hat = ceil-weighted demand across the non-paused workload. */
export function computeRequiredHatSupply(workload: readonly WorkloadItem[]): ReadonlyMap<string, number> {
  const demand = new Map<string, number>();
  for (const item of workload) {
    const w = demandWeight(item.priorityClass);
    if (w === 0) continue;
    for (const hatId of item.requiredHats) {
      demand.set(hatId, (demand.get(hatId) ?? 0) + w);
    }
  }
  // weighted demand → required wearer count (each wearer covers ~2 weighted units)
  const required = new Map<string, number>();
  for (const [hatId, weighted] of demand) {
    required.set(hatId, Math.max(1, Math.ceil(weighted / 2)));
  }
  return required;
}

export const HatSupplyAction = {
  Expand: "expand",
  Release: "release",
  Reserve: "reserve",
  Preempt: "preempt",
  Hold: "hold",
} as const;

export type HatSupplyAction = (typeof HatSupplyAction)[keyof typeof HatSupplyAction];

/** Deterministic recommendation: compare demand vs current staffing. */
export function recommendSupplyAction(requiredCount: number, currentCount: number): HatSupplyAction {
  if (requiredCount > currentCount) return HatSupplyAction.Expand;
  if (requiredCount < currentCount) return HatSupplyAction.Release;
  return HatSupplyAction.Hold;
}

export type HatSupplyVote = {
  voterHatId: string;
  approve: boolean;
  proposedTarget: number;
};

export type HatSupplyDecision = {
  hatId: string;
  action: HatSupplyAction;
  targetCount: number;
  currentCount: number;
  requiredCount: number;
  approvals: number;
  voters: number;
  quorumMet: boolean;
};

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2) : (sorted[mid] ?? 0);
}

export type DecideHatSupplyContext = {
  createEventId: () => string;
  nowIso: () => string;
  organizationId: string;
  supervisorChain: readonly string[];
  correlationId: string;
  causationId: string;
  traceId: string;
};

/**
 * Tally supervisor votes into a supply decision. Quorum = strict majority of
 * voters. If quorum approves, the action proceeds with the agreed target (median
 * of approvers' proposals); otherwise it holds at the current count.
 */
export function decideHatSupply(
  input: {
    hatId: string;
    hatName: string;
    requiredCount: number;
    currentCount: number;
    votes: readonly HatSupplyVote[];
  },
  ctx: DecideHatSupplyContext,
): { decision: HatSupplyDecision; event: OrgEvent } {
  const approvals = input.votes.filter((v) => v.approve).length;
  const quorum = Math.floor(input.votes.length / 2) + 1;
  const quorumMet = input.votes.length > 0 && approvals >= quorum;

  const recommended = recommendSupplyAction(input.requiredCount, input.currentCount);
  const approverTargets = input.votes.filter((v) => v.approve).map((v) => v.proposedTarget);

  const action = quorumMet ? recommended : HatSupplyAction.Hold;
  const targetCount = quorumMet && approverTargets.length > 0 ? median(approverTargets) : input.currentCount;

  const decision: HatSupplyDecision = {
    hatId: input.hatId,
    action,
    targetCount,
    currentCount: input.currentCount,
    requiredCount: input.requiredCount,
    approvals,
    voters: input.votes.length,
    quorumMet,
  };
  const event: OrgEvent = {
    id: ctx.createEventId(),
    kind: OrgEventKind.HatSupplyDecision,
    occurredAt: ctx.nowIso(),
    organizationId: ctx.organizationId,
    subjectId: input.hatId,
    toState: action,
    decision: `RMO: ${input.hatName} demand=${input.requiredCount} current=${input.currentCount} → ${action} to ${targetCount} (${approvals}/${input.votes.length} approved, quorum ${quorumMet ? "met" : "not met"})`,
    supervisorChain: ctx.supervisorChain,
    evidenceRefs: [],
    correlationId: ctx.correlationId,
    causationId: ctx.causationId,
    traceId: ctx.traceId,
  };
  return { decision, event };
}

// ─── Per-task room planning ─────────────────────────────────────────────────
// RMO determines, for a TASK, how many ephemeral rooms and how many hats per
// room. (Rooms created during MEETINGS are automation, not a task — RMO does not
// plan those; it plans rooms for tasks only.) A room is a deterministic-
// simulation container hosting the seated hats; see
// ../../docs/ROOMS_AS_DETERMINISTIC_SIMULATIONS.md and ./room.ts.

/** One planned room: the seated hat ids (a hat may be seated more than once). */
export type PlannedRoom = {
  roomId: string;
  hatIds: readonly string[];
  hatCount: number;
};

export type TaskRoomPlan = {
  workItemId: string;
  roomCount: number;
  hatsPerRoomCap: number;
  totalHatSeats: number;
  rooms: readonly PlannedRoom[];
};

export type PlanTaskRoomsInput = {
  workItemId: string;
  /** Required wearer count per hat, e.g. from `computeRequiredHatSupply`. */
  requiredHatSupply: ReadonlyMap<string, number>;
  /** Capacity knob: at most this many hat seats share a room. */
  maxHatsPerRoom: number;
};

export type PlanTaskRoomsContext = {
  /** Deterministic room-id source (injected; e.g. an `IdGenerator`-backed seq). */
  createRoomId: (seq: number) => string;
};

/**
 * Pack the task's required hat *seats* into ephemeral rooms of at most
 * `maxHatsPerRoom` seats. Deterministic: hats are seated in sorted hatId order,
 * then packed by capacity; room ids come from the injected source in sequence.
 * Same inputs -> same plan (DST).
 */
export function planTaskRooms(input: PlanTaskRoomsInput, ctx: PlanTaskRoomsContext): TaskRoomPlan {
  const cap = Math.max(1, Math.floor(input.maxHatsPerRoom));
  const seats: string[] = [];
  const sortedHatIds = [...input.requiredHatSupply.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const hatId of sortedHatIds) {
    const count = Math.max(0, Math.floor(input.requiredHatSupply.get(hatId) ?? 0));
    for (let i = 0; i < count; i++) seats.push(hatId);
  }
  const rooms: PlannedRoom[] = [];
  for (let offset = 0; offset < seats.length; offset += cap) {
    const slice = seats.slice(offset, offset + cap);
    rooms.push({ roomId: ctx.createRoomId(rooms.length), hatIds: slice, hatCount: slice.length });
  }
  return {
    workItemId: input.workItemId,
    roomCount: rooms.length,
    hatsPerRoomCap: cap,
    totalHatSeats: seats.length,
    rooms,
  };
}
