import { equal } from "node:assert/strict";
import { test } from "node:test";
import { SupervisorTriageActionType, WorkItemType } from "../../domain/src/index.ts";
import {
  TriageActionFeedbackReason,
  TriageActionResolution,
  resolveTriageAction,
} from "../src/triage-action-resolver.ts";

test("open_work_item resolves to OpensWorkItem with its inputs", () => {
  const r = resolveTriageAction({
    actionType: SupervisorTriageActionType.OpenWorkItem,
    followUpWorkItemType: WorkItemType.Task,
    followUpTitle: "do the thing",
    followUpDescription: "details",
  });
  equal(r.outcome, "ok");
  if (r.outcome !== "ok" || r.resolution !== TriageActionResolution.OpensWorkItem) return;
  equal(r.followUpTitle, "do the thing");
});

test("answer_directly resolves to AnswersInPlace", () => {
  const r = resolveTriageAction({ actionType: SupervisorTriageActionType.AnswerDirectly, answer: "yes, proceed" });
  equal(r.outcome, "ok");
  if (r.outcome !== "ok" || r.resolution !== TriageActionResolution.AnswersInPlace) return;
  equal(r.answer, "yes, proceed");
});

test("answer_directly with a blank answer yields feedback", () => {
  const r = resolveTriageAction({ actionType: SupervisorTriageActionType.AnswerDirectly, answer: "   " });
  equal(r.outcome, "feedback");
  if (r.outcome !== "feedback") return;
  equal(r.feedback.reason, TriageActionFeedbackReason.AnswerRequired);
});

test("escalate resolves to EscalatesSignal with target + reason", () => {
  const r = resolveTriageAction({
    actionType: SupervisorTriageActionType.EscalateToNextSupervisor,
    targetSupervisorHatAssignmentId: "hat-9",
    escalationReason: "beyond my authority",
  });
  equal(r.outcome, "ok");
  if (r.outcome !== "ok" || r.resolution !== TriageActionResolution.EscalatesSignal) return;
  equal(r.targetSupervisorHatAssignmentId, "hat-9");
});

test("escalate without a target yields feedback", () => {
  const r = resolveTriageAction({
    actionType: SupervisorTriageActionType.EscalateToNextSupervisor,
    targetSupervisorHatAssignmentId: "",
    escalationReason: "x",
  });
  equal(r.outcome, "feedback");
  if (r.outcome !== "feedback") return;
  equal(r.feedback.reason, TriageActionFeedbackReason.EscalationTargetRequired);
});

test("escalate without a reason yields feedback", () => {
  const r = resolveTriageAction({
    actionType: SupervisorTriageActionType.EscalateToNextSupervisor,
    targetSupervisorHatAssignmentId: "hat-9",
    escalationReason: "  ",
  });
  equal(r.outcome, "feedback");
  if (r.outcome !== "feedback") return;
  equal(r.feedback.reason, TriageActionFeedbackReason.EscalationReasonRequired);
});

test("the three deferred actions resolve to Deferred (visible gap, not rejection)", () => {
  for (const actionType of [
    SupervisorTriageActionType.RequestSecurityReview,
    SupervisorTriageActionType.ScheduleDiscussion,
    SupervisorTriageActionType.RouteToInternalPlatform,
  ] as const) {
    const r = resolveTriageAction({ actionType });
    equal(r.outcome, "ok");
    if (r.outcome !== "ok" || r.resolution !== TriageActionResolution.Deferred) return;
    equal(r.actionType, actionType);
  }
});
