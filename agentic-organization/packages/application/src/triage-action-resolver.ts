/**
 * Supervisor-triage action resolution (North Star priority #4).
 *
 * The domain declares six SupervisorTriageActionType values, but the
 * triage_supervisor_signal handler historically implemented only OpenWorkItem
 * and rejected the rest as UnsupportedActionType. This module makes the action
 * set EXPLICIT and open-for-extension: each action is a discriminated variant
 * with its own required inputs, and resolveTriageAction classifies a requested
 * action into one of three outcomes so the handler never buries action logic in
 * an if-chain (repo rule: IMPLICIT-NOT-EXPLICIT is class error).
 *
 * This slice adds the two no-new-migration actions on top of OpenWorkItem:
 *   - AnswerDirectly: the supervisor answers in-line; no follow-up work item.
 *   - EscalateToNextSupervisor: route the signal up the supervisor chain.
 * RequestSecurityReview, ScheduleDiscussion, and RouteToInternalPlatform remain
 * declared-but-deferred (they need security/schedule/platform substrate); they
 * resolve to a typed "deferred" outcome rather than a generic rejection, so the
 * gap is visible rather than hidden.
 */

import {
  SupervisorTriageActionType,
  type WorkItemType,
} from "../../domain/src/index.ts";

/** A requested triage action + its action-specific inputs, as an explicit DU. */
export type TriageActionRequest =
  | {
      actionType: typeof SupervisorTriageActionType.OpenWorkItem;
      followUpWorkItemType: WorkItemType;
      followUpTitle: string;
      followUpDescription: string;
    }
  | {
      actionType: typeof SupervisorTriageActionType.AnswerDirectly;
      answer: string;
    }
  | {
      actionType: typeof SupervisorTriageActionType.EscalateToNextSupervisor;
      targetSupervisorHatAssignmentId: string;
      escalationReason: string;
    }
  | {
      actionType:
        | typeof SupervisorTriageActionType.RequestSecurityReview
        | typeof SupervisorTriageActionType.ScheduleDiscussion
        | typeof SupervisorTriageActionType.RouteToInternalPlatform;
    };

/** How an action resolves: do effectful work, answer in place, or deferred. */
export const TriageActionResolution = {
  /** Creates a follow-up work item (OpenWorkItem). */
  OpensWorkItem: "opens_work_item",
  /** Resolves the signal in place with an answer (AnswerDirectly). */
  AnswersInPlace: "answers_in_place",
  /** Routes the signal up the chain (EscalateToNextSupervisor). */
  EscalatesSignal: "escalates_signal",
  /** Declared but not yet implemented in this V0 slice. */
  Deferred: "deferred",
} as const;
export type TriageActionResolution =
  (typeof TriageActionResolution)[keyof typeof TriageActionResolution];

export const TriageActionFeedbackReason = {
  AnswerRequired: "answer_required",
  EscalationTargetRequired: "escalation_target_required",
  EscalationReasonRequired: "escalation_reason_required",
} as const;
export type TriageActionFeedbackReason =
  (typeof TriageActionFeedbackReason)[keyof typeof TriageActionFeedbackReason];

export type ResolvedTriageAction =
  | {
      outcome: "ok";
      resolution: typeof TriageActionResolution.OpensWorkItem;
      followUpWorkItemType: WorkItemType;
      followUpTitle: string;
      followUpDescription: string;
    }
  | { outcome: "ok"; resolution: typeof TriageActionResolution.AnswersInPlace; answer: string }
  | {
      outcome: "ok";
      resolution: typeof TriageActionResolution.EscalatesSignal;
      targetSupervisorHatAssignmentId: string;
      escalationReason: string;
    }
  | {
      outcome: "ok";
      resolution: typeof TriageActionResolution.Deferred;
      actionType: TriageActionRequest["actionType"];
    }
  | { outcome: "feedback"; feedback: { reason: TriageActionFeedbackReason; message: string } };

const DEFERRED_ACTIONS: ReadonlySet<string> = new Set([
  SupervisorTriageActionType.RequestSecurityReview,
  SupervisorTriageActionType.ScheduleDiscussion,
  SupervisorTriageActionType.RouteToInternalPlatform,
]);

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

/**
 * Classify a triage-action request into a typed resolution. Pure; the handler
 * turns the resolution into command effects. Validation of action-specific
 * inputs surfaces as explicit feedback variants, never thrown.
 */
export function resolveTriageAction(request: TriageActionRequest): ResolvedTriageAction {
  switch (request.actionType) {
    case SupervisorTriageActionType.OpenWorkItem:
      return {
        outcome: "ok",
        resolution: TriageActionResolution.OpensWorkItem,
        followUpWorkItemType: request.followUpWorkItemType,
        followUpTitle: request.followUpTitle,
        followUpDescription: request.followUpDescription,
      };

    case SupervisorTriageActionType.AnswerDirectly:
      if (isBlank(request.answer)) {
        return { outcome: "feedback", feedback: { reason: TriageActionFeedbackReason.AnswerRequired, message: "answer_directly requires a non-empty answer" } };
      }
      return { outcome: "ok", resolution: TriageActionResolution.AnswersInPlace, answer: request.answer };

    case SupervisorTriageActionType.EscalateToNextSupervisor:
      if (isBlank(request.targetSupervisorHatAssignmentId)) {
        return { outcome: "feedback", feedback: { reason: TriageActionFeedbackReason.EscalationTargetRequired, message: "escalate_to_next_supervisor requires a target supervisor hat assignment id" } };
      }
      if (isBlank(request.escalationReason)) {
        return { outcome: "feedback", feedback: { reason: TriageActionFeedbackReason.EscalationReasonRequired, message: "escalate_to_next_supervisor requires an escalation reason" } };
      }
      return {
        outcome: "ok",
        resolution: TriageActionResolution.EscalatesSignal,
        targetSupervisorHatAssignmentId: request.targetSupervisorHatAssignmentId,
        escalationReason: request.escalationReason,
      };

    default:
      // The union narrows this branch to exactly the deferred actions
      // (RequestSecurityReview | ScheduleDiscussion | RouteToInternalPlatform);
      // DEFERRED_ACTIONS is the runtime witness that the branch only ever sees
      // a declared-but-deferred action — a defensive assert, not control flow.
      assertDeferredAction(request.actionType);
      return { outcome: "ok", resolution: TriageActionResolution.Deferred, actionType: request.actionType };
  }
}

function assertDeferredAction(actionType: TriageActionRequest["actionType"]): void {
  if (!DEFERRED_ACTIONS.has(actionType)) {
    throw new Error(`resolveTriageAction: unexpected non-deferred action in default branch: ${actionType}`);
  }
}
