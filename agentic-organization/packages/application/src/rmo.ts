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
import { PriorityClass } from "./prioritization.ts";

/** A prioritized work item's staffing demand. */
export type WorkloadItem = {
  workItemId: string;
  priorityClass: PriorityClass;
  requiredHats: readonly string[];
};

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
