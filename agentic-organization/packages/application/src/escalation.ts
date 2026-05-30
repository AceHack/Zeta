/**
 * Churn detection + the escalation ladder (WORK_OS_OVERHAUL §C4). The living part
 * of the Work OS: when a work item bounces back and forth (e.g. QA fails → rework
 * → QA fails) past a threshold, determinism detects the churn and computes the
 * BOUNDED legal set of escalations; a manager/director hat chooses within it
 * (the ANTI_STALL blocker table). The chosen escalation changes the INPUT — more
 * agents (RMO supply-expand), a new architectural approach, a re-scope, a pause,
 * or an explicit accept-risk — so the item cannot re-enter the same failing loop
 * by spinning. Churn is broken structurally, not endured.
 *
 * Every escalation is one org_event; the chooser is clamped to the legal set.
 */

import { HatLevel, OrgEventKind, WorkItemState, type HatDefinition, type OrgEvent } from "../../domain/src/index.ts";
import { chooseWithinLegal, type OrgChooser } from "./org-decision.ts";

export const EscalationTrigger = {
  RepeatedQaBounceBack: "repeated_qa_bounce_back",
  SlaBreach: "sla_breach",
  StaleBlocker: "stale_blocker",
  ReviewQueueSaturated: "review_queue_saturated",
} as const;
export type EscalationTrigger = (typeof EscalationTrigger)[keyof typeof EscalationTrigger];

export const EscalationAction = {
  AddAgents: "add_agents",
  BringInArchitect: "bring_in_architect",
  ReScope: "re_scope",
  Pause: "pause",
  AcceptRisk: "accept_risk",
  ReassignReviewer: "reassign_reviewer",
  AssignOwner: "assign_owner",
  AlternateWork: "alternate_work",
} as const;
export type EscalationAction = (typeof EscalationAction)[keyof typeof EscalationAction];

const LEGAL_BY_TRIGGER: Readonly<Record<EscalationTrigger, readonly EscalationAction[]>> = {
  [EscalationTrigger.RepeatedQaBounceBack]: [EscalationAction.AddAgents, EscalationAction.BringInArchitect, EscalationAction.ReScope, EscalationAction.Pause, EscalationAction.AcceptRisk],
  [EscalationTrigger.SlaBreach]: [EscalationAction.AddAgents, EscalationAction.ReScope, EscalationAction.Pause],
  [EscalationTrigger.StaleBlocker]: [EscalationAction.AssignOwner, EscalationAction.AlternateWork, EscalationAction.ReScope],
  [EscalationTrigger.ReviewQueueSaturated]: [EscalationAction.ReassignReviewer, EscalationAction.AddAgents],
};

/** Escalation is a MANAGEMENT action — only Manager/Director/exec hats may decide. */
function hasEscalationAuthority(level: HatLevel): boolean {
  return level === HatLevel.Manager || level === HatLevel.Director || level === HatLevel.CSuite || level === HatLevel.ExecutiveBoard;
}

/** The bounded legal escalations for a trigger, clamped by decider authority. */
export function legalEscalationActions(trigger: EscalationTrigger, deciderLevel: HatLevel): readonly EscalationAction[] {
  if (!hasEscalationAuthority(deciderLevel)) return [];
  return LEGAL_BY_TRIGGER[trigger];
}

/** Count QA bounce-backs (review → in_progress rework) for a work item from the trace. */
export function bounceBackCount(workItemId: string, events: readonly OrgEvent[]): number {
  return events.filter(
    (e) => e.kind === OrgEventKind.WorkItemTransition && e.subjectId === workItemId && e.fromState === WorkItemState.Review && e.toState === WorkItemState.InProgress,
  ).length;
}

export const DEFAULT_CHURN_THRESHOLD = 3;

/** Has this work item crossed the churn threshold (and therefore needs escalation)? */
export function detectChurn(workItemId: string, events: readonly OrgEvent[], threshold = DEFAULT_CHURN_THRESHOLD): boolean {
  return bounceBackCount(workItemId, events) >= threshold;
}

/** The structural change an escalation makes — this is what breaks the loop. */
export type EscalationOutcomeChange =
  | { kind: "expand_supply"; ownerHatIds: readonly string[]; addCount: number } // bring on more agents (RMO)
  | { kind: "new_approach"; architectHatId: string; reopenGate: string } // architect changes the approach
  | { kind: "rescope" }
  | { kind: "pause" }
  | { kind: "accept_risk" }
  | { kind: "reassign_reviewer" }
  | { kind: "assign_owner" }
  | { kind: "alternate_work" };

function changeFor(action: EscalationAction, ownerHatIds: readonly string[]): EscalationOutcomeChange {
  switch (action) {
    case EscalationAction.AddAgents:
      return { kind: "expand_supply", ownerHatIds, addCount: 1 };
    case EscalationAction.BringInArchitect:
      return { kind: "new_approach", architectHatId: "architect", reopenGate: "architecture_approval" };
    case EscalationAction.ReScope:
      return { kind: "rescope" };
    case EscalationAction.Pause:
      return { kind: "pause" };
    case EscalationAction.AcceptRisk:
      return { kind: "accept_risk" };
    case EscalationAction.ReassignReviewer:
      return { kind: "reassign_reviewer" };
    case EscalationAction.AssignOwner:
      return { kind: "assign_owner" };
    case EscalationAction.AlternateWork:
      return { kind: "alternate_work" };
    default: {
      const unhandled: never = action;
      return unhandled;
    }
  }
}

export type EscalationDecisionInput = {
  trigger: EscalationTrigger;
  workItemId: string;
  ownerHatIds: readonly string[]; // the hats whose supply AddAgents would expand
  deciderHat: HatDefinition;
  chooser: OrgChooser<EscalationAction>;
};

export type EscalationDecisionContext = {
  organizationId: string;
  createEventId: () => string;
  nowIso: () => string;
  supervisorChain: readonly string[];
  correlationId: string;
  causationId: string;
  traceId: string;
};

export type EscalationDecisionResult =
  | { outcome: "no_authority" | "no_legal_option"; reason: string }
  | { outcome: "escalated"; action: EscalationAction; change: EscalationOutcomeChange; event: OrgEvent };

/** A management hat decides an escalation within the legal set; the choice is clamped. */
export function decideEscalation(input: EscalationDecisionInput, ctx: EscalationDecisionContext): EscalationDecisionResult {
  if (!hasEscalationAuthority(input.deciderHat.level)) {
    return { outcome: "no_authority", reason: `${input.deciderHat.id} (${input.deciderHat.level}) cannot escalate` };
  }
  const legal = legalEscalationActions(input.trigger, input.deciderHat.level);
  const choice = chooseWithinLegal(legal, `escalate ${input.workItemId} on ${input.trigger}`, input.chooser);
  if (choice.outcome === "no_legal_option") {
    return { outcome: "no_legal_option", reason: choice.reason };
  }
  const action = choice.option;
  const change = changeFor(action, input.ownerHatIds);
  const event: OrgEvent = {
    id: ctx.createEventId(),
    kind: OrgEventKind.EscalationDecision,
    occurredAt: ctx.nowIso(),
    organizationId: ctx.organizationId,
    actorHatId: input.deciderHat.id,
    departmentId: input.deciderHat.departmentId,
    subjectId: input.workItemId,
    fromState: input.trigger,
    toState: action,
    decision: `${input.deciderHat.name} escalated ${input.workItemId} (${input.trigger}) → ${action}: ${choice.reason}`,
    supervisorChain: ctx.supervisorChain,
    evidenceRefs: [],
    correlationId: ctx.correlationId,
    causationId: ctx.causationId,
    traceId: ctx.traceId,
  };
  return { outcome: "escalated", action, change, event };
}
