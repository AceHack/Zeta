/**
 * Prioritization — directors and TPMs decide work priority (ANTI_STALL_PRIORITY_
 * RUNTIME.md). The platform computes a PriorityRecommendation from the priority
 * inputs; an authority hat decides the final PriorityClass via the org-decision
 * kernel, where the LEGAL classes are bounded by the decider's level (a TPM
 * cannot expedite or pause; a Director can; an executive can do anything).
 */

import { HatLevel, type HatDefinition } from "../../domain/src/hat-definition.ts";
import { OrgEventKind, type OrgEvent } from "../../domain/src/org-event.ts";
import { chooseWithinLegal, type OrgChooser } from "./org-decision.ts";

export const PriorityClass = {
  Expedite: "expedite",
  High: "high",
  Normal: "normal",
  Defer: "defer",
  Paused: "paused",
} as const;

export type PriorityClass = (typeof PriorityClass)[keyof typeof PriorityClass];

export const PriorityDecidedBy = {
  Tpm: "tpm",
  EngineeringManager: "engineering_manager",
  DepartmentDirector: "department_director",
  ReviewHat: "review_hat",
  AgentVote: "agent_vote",
  Executive: "executive",
  IncidentCommander: "incident_commander",
  ApprovedPolicy: "approved_policy",
} as const;

export type PriorityDecidedBy = (typeof PriorityDecidedBy)[keyof typeof PriorityDecidedBy];

/** The load-bearing priority inputs (subset of the doc's ~20; all 0..1 normalized except ages). */
export type PriorityInputs = {
  executivePriority: number;
  customerImpact: number;
  severity: number;
  releaseRisk: number;
  blockedDownstreamCount: number;
  dependencyFanOut: number;
  queueAgeMs: number;
  hatScarcity: number;
  budgetBurn: number;
  estimatedEffort: number;
};

export type PriorityRecommendation = {
  workItemId: string;
  score: number;
  priorityClass: PriorityClass;
  reasonCodes: readonly string[];
  requiredHats: readonly string[];
};

const PRIORITY_ORDER: readonly PriorityClass[] = [
  PriorityClass.Expedite,
  PriorityClass.High,
  PriorityClass.Normal,
  PriorityClass.Defer,
  PriorityClass.Paused,
];

/** Deterministic scoring → a recommended class + the reason codes that drove it. */
export function computePriorityRecommendation(
  workItemId: string,
  inputs: PriorityInputs,
  requiredHats: readonly string[],
): PriorityRecommendation {
  const reasonCodes: string[] = [];
  let score = 0;
  const add = (weight: number, value: number, code: string): void => {
    if (value > 0) {
      score += weight * value;
      reasonCodes.push(code);
    }
  };
  add(4, inputs.executivePriority, "executive_priority");
  add(3, inputs.customerImpact, "customer_impact");
  add(3, inputs.severity, "severity");
  add(2, inputs.releaseRisk, "release_risk");
  add(2, Math.min(1, inputs.blockedDownstreamCount / 5), "blocked_downstream");
  add(1, Math.min(1, inputs.dependencyFanOut / 5), "dependency_fanout");
  add(1, Math.min(1, inputs.queueAgeMs / 3_600_000), "queue_age");
  add(1, inputs.hatScarcity, "hat_scarcity");
  // budget burn + high effort push DOWN
  score -= 2 * inputs.budgetBurn;
  if (inputs.budgetBurn > 0.5) reasonCodes.push("budget_pressure");

  const priorityClass =
    score >= 9 ? PriorityClass.Expedite :
    score >= 5 ? PriorityClass.High :
    score >= 2 ? PriorityClass.Normal :
    score >= 0 ? PriorityClass.Defer :
    PriorityClass.Paused;

  return { workItemId, score: Math.round(score * 100) / 100, priorityClass, reasonCodes, requiredHats };
}

/** Which priority classes an authority at this level may set (the LEGAL set). */
export function legalPriorityClassesFor(level: HatLevel): readonly PriorityClass[] {
  switch (level) {
    case HatLevel.ExecutiveBoard:
    case HatLevel.CSuite:
      return PRIORITY_ORDER; // all
    case HatLevel.Director:
      return [PriorityClass.Expedite, PriorityClass.High, PriorityClass.Normal, PriorityClass.Defer, PriorityClass.Paused];
    case HatLevel.Manager:
      return [PriorityClass.High, PriorityClass.Normal, PriorityClass.Defer]; // TPM/Eng Manager: no expedite/pause
    case HatLevel.Lead:
    case HatLevel.IndividualContributor:
      return []; // cannot decide priority
    default: {
      const unhandled: never = level;
      return unhandled;
    }
  }
}

export type PriorityDecision = {
  workItemId: string;
  priorityClass: PriorityClass;
  reasonCodes: readonly string[];
  requiredHats: readonly string[];
  decidedByHatId: string;
  decidedBy: PriorityDecidedBy;
};

export type PriorityDecisionResult =
  | { outcome: "decided"; decision: PriorityDecision; event: OrgEvent }
  | { outcome: "not_authorized"; reason: string };

function decidedByFor(deciderHat: HatDefinition): PriorityDecidedBy {
  if (deciderHat.level === HatLevel.ExecutiveBoard || deciderHat.level === HatLevel.CSuite) return PriorityDecidedBy.Executive;
  if (deciderHat.level === HatLevel.Director) return PriorityDecidedBy.DepartmentDirector;
  if (deciderHat.id === "engineering_manager") return PriorityDecidedBy.EngineeringManager;
  if (deciderHat.id === "incident_commander") return PriorityDecidedBy.IncidentCommander;
  return PriorityDecidedBy.Tpm;
}

export type DecidePriorityContext = {
  createEventId: () => string;
  nowIso: () => string;
  organizationId: string;
  supervisorChain: readonly string[];
  correlationId: string;
  causationId: string;
  traceId: string;
};

/**
 * An authority hat decides the work item's priority. The legal classes are
 * bounded by the decider's level; the chooser picks within them (it cannot
 * escalate beyond its authority). The recommendation is offered first in the
 * legal list so the deterministic default honors it when legal.
 */
export function decidePriority(
  input: {
    recommendation: PriorityRecommendation;
    deciderHat: HatDefinition;
    chooser: OrgChooser<PriorityClass>;
  },
  ctx: DecidePriorityContext,
): PriorityDecisionResult {
  const legalAll = legalPriorityClassesFor(input.deciderHat.level);
  if (legalAll.length === 0) {
    return { outcome: "not_authorized", reason: `${input.deciderHat.name} (level ${input.deciderHat.level}) cannot decide priority` };
  }
  // offer the recommended class first when it is legal, else legal order
  const legal = legalAll.includes(input.recommendation.priorityClass)
    ? [input.recommendation.priorityClass, ...legalAll.filter((c) => c !== input.recommendation.priorityClass)]
    : legalAll;

  const choice = chooseWithinLegal(legal, `priority for ${input.recommendation.workItemId}`, input.chooser);
  if (choice.outcome === "no_legal_option") {
    return { outcome: "not_authorized", reason: choice.reason };
  }
  const decidedBy = decidedByFor(input.deciderHat);
  const decision: PriorityDecision = {
    workItemId: input.recommendation.workItemId,
    priorityClass: choice.option,
    reasonCodes: input.recommendation.reasonCodes,
    requiredHats: input.recommendation.requiredHats,
    decidedByHatId: input.deciderHat.id,
    decidedBy,
  };
  const event: OrgEvent = {
    id: ctx.createEventId(),
    kind: OrgEventKind.PriorityDecision,
    occurredAt: ctx.nowIso(),
    organizationId: ctx.organizationId,
    actorHatId: input.deciderHat.id,
    departmentId: input.deciderHat.departmentId,
    subjectId: decision.workItemId,
    toState: decision.priorityClass,
    decision: `${input.deciderHat.name} set ${decision.workItemId} to ${decision.priorityClass} (${choice.reason}); reasons: ${decision.reasonCodes.join(", ")}`,
    supervisorChain: ctx.supervisorChain,
    evidenceRefs: [],
    correlationId: ctx.correlationId,
    causationId: ctx.causationId,
    traceId: ctx.traceId,
  };
  return { outcome: "decided", decision, event };
}
