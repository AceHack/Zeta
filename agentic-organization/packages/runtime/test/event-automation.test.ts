import { deepEqual } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AgenticAggregateType,
  AgenticEventType,
  SupervisorChainLevel,
  SupervisorSignalStatus,
  SupervisorSignalToolType,
  WorkItemState,
  createAgenticEventEnvelope,
} from "../../domain/src/index.ts";
import {
  ReactionPlanActionType,
  ReactionPlanReason,
  RequiredHat,
  evaluateV0AutomationRules,
} from "../src/reaction-plan.ts";

describe("v0 event automation rules", () => {
  test("plans target-supervisor triage when a hat sends an upward signal", () => {
    const envelope = createAgenticEventEnvelope({
      eventId: "evt-supervisor-signal-001",
      eventType: AgenticEventType.SupervisorSignalSent,
      occurredAt: "2026-05-25T20:00:00.000Z",
      actor: {
        agentId: "agent-developer-001",
        hatAssignmentId: "hat-assignment-dev-001",
      },
      scope: {
        organizationId: "org-lfg",
        projectId: "project-agentic-org",
        teamId: "team-runtime",
        workItemId: "work-outbox-001",
      },
      aggregate: {
        aggregateId: "supervisor-signal-001",
        aggregateType: AgenticAggregateType.SupervisorSignal,
        aggregateVersion: 1,
      },
      trace: {
        commandId: "cmd-supervisor-signal-001",
        correlationId: "corr-supervisor-signal-001",
        causationId: "cause-team-work-001",
        traceId: "trace-supervisor-signal-001",
        idempotencyKey: "idem-supervisor-signal-001",
      },
      payload: {
        sourceLevel: SupervisorChainLevel.TeamMember,
        targetLevel: SupervisorChainLevel.Manager,
        targetHatAssignmentId: "hat-assignment-em-001",
        toolType: SupervisorSignalToolType.ReportBlocker,
        status: SupervisorSignalStatus.Sent,
        title: "Blocked on scoped NATS publisher",
      },
    });

    deepEqual(evaluateV0AutomationRules(envelope), [
      {
        actionType: ReactionPlanActionType.CreateSupervisorTriage,
        triggerEventId: "evt-supervisor-signal-001",
        organizationId: "org-lfg",
        projectId: "project-agentic-org",
        teamId: "team-runtime",
        workItemId: "work-outbox-001",
        supervisorSignalId: "supervisor-signal-001",
        targetLevel: SupervisorChainLevel.Manager,
        requiredHat: RequiredHat.EngineeringManager,
        reason: ReactionPlanReason.SupervisorSignalNeedsTriage,
      },
    ]);
  });

  test("plans implementation assignment when a work item enters ready state", () => {
    const envelope = createAgenticEventEnvelope({
      eventId: "evt-work-item-ready-001",
      eventType: AgenticEventType.WorkItemStateChanged,
      occurredAt: "2026-05-29T13:00:00.000Z",
      actor: {
        agentId: "agent-em-001",
        hatAssignmentId: "hat-assignment-em-001",
      },
      scope: {
        organizationId: "org-lfg",
        projectId: "project-agentic-org",
        teamId: "team-runtime",
        workItemId: "work-ready-001",
      },
      aggregate: {
        aggregateId: "work-ready-001",
        aggregateType: AgenticAggregateType.WorkItem,
        aggregateVersion: 3,
      },
      trace: {
        commandId: "cmd-transition-work-ready-001",
        correlationId: "corr-transition-work-ready-001",
        causationId: "cause-grooming-001",
        traceId: "trace-transition-work-ready-001",
        idempotencyKey: "idem-transition-work-ready-001",
      },
      payload: {
        fromState: WorkItemState.Triage,
        toState: WorkItemState.Ready,
      },
    });

    deepEqual(evaluateV0AutomationRules(envelope), [
      {
        actionType: ReactionPlanActionType.RequestImplementationAssignment,
        triggerEventId: "evt-work-item-ready-001",
        organizationId: "org-lfg",
        projectId: "project-agentic-org",
        teamId: "team-runtime",
        workItemId: "work-ready-001",
        requiredHat: RequiredHat.EngineeringManager,
        reason: ReactionPlanReason.WorkItemEnteredReadyState,
      },
    ]);
  });

  test("plans a review gate when a work item enters review state", () => {
    const envelope = createAgenticEventEnvelope({
      eventId: "evt-work-item-review-001",
      eventType: AgenticEventType.WorkItemStateChanged,
      occurredAt: "2026-05-29T14:00:00.000Z",
      actor: {
        agentId: "agent-implementer-001",
        hatAssignmentId: "hat-assignment-implementer-001",
      },
      scope: {
        organizationId: "org-lfg",
        projectId: "project-agentic-org",
        teamId: "team-runtime",
        workItemId: "work-review-001",
      },
      aggregate: {
        aggregateId: "work-review-001",
        aggregateType: AgenticAggregateType.WorkItem,
        aggregateVersion: 5,
      },
      trace: {
        commandId: "cmd-transition-work-review-001",
        correlationId: "corr-transition-work-review-001",
        causationId: "cause-implementation-001",
        traceId: "trace-transition-work-review-001",
        idempotencyKey: "idem-transition-work-review-001",
      },
      payload: {
        fromState: WorkItemState.InProgress,
        toState: WorkItemState.Review,
      },
    });

    deepEqual(evaluateV0AutomationRules(envelope), [
      {
        actionType: ReactionPlanActionType.RequestReviewGate,
        triggerEventId: "evt-work-item-review-001",
        organizationId: "org-lfg",
        projectId: "project-agentic-org",
        teamId: "team-runtime",
        workItemId: "work-review-001",
        requiredHat: RequiredHat.Reviewer,
        reason: ReactionPlanReason.WorkItemEnteredReviewState,
      },
    ]);
  });

  test("does not plan a review gate for ready work item updates that are not state transitions", () => {
    const envelope = createAgenticEventEnvelope({
      eventId: "evt-work-item-ready-update-001",
      eventType: AgenticEventType.WorkItemChanged,
      occurredAt: "2026-05-29T13:05:00.000Z",
      actor: {
        agentId: "agent-tpm-001",
        hatAssignmentId: "hat-assignment-tpm-001",
      },
      scope: {
        organizationId: "org-lfg",
        projectId: "project-agentic-org",
        workItemId: "work-ready-update-001",
      },
      aggregate: {
        aggregateId: "work-ready-update-001",
        aggregateType: AgenticAggregateType.WorkItem,
        aggregateVersion: 4,
      },
      trace: {
        commandId: "cmd-update-work-ready-001",
        correlationId: "corr-update-work-ready-001",
        causationId: "cause-update-work-ready-001",
        traceId: "trace-update-work-ready-001",
        idempotencyKey: "idem-update-work-ready-001",
      },
      payload: {
        state: WorkItemState.Ready,
      },
    });

    deepEqual(evaluateV0AutomationRules(envelope), []);
  });

  test("does not plan a review gate for non-ready work item state transitions", () => {
    const envelope = createAgenticEventEnvelope({
      eventId: "evt-work-item-in-progress-001",
      eventType: AgenticEventType.WorkItemStateChanged,
      occurredAt: "2026-05-29T13:10:00.000Z",
      actor: {
        agentId: "agent-em-001",
        hatAssignmentId: "hat-assignment-em-001",
      },
      scope: {
        organizationId: "org-lfg",
        projectId: "project-agentic-org",
        workItemId: "work-in-progress-001",
      },
      aggregate: {
        aggregateId: "work-in-progress-001",
        aggregateType: AgenticAggregateType.WorkItem,
        aggregateVersion: 4,
      },
      trace: {
        commandId: "cmd-transition-work-in-progress-001",
        correlationId: "corr-transition-work-in-progress-001",
        causationId: "cause-assignment-001",
        traceId: "trace-transition-work-in-progress-001",
        idempotencyKey: "idem-transition-work-in-progress-001",
      },
      payload: {
        fromState: WorkItemState.Ready,
        toState: WorkItemState.InProgress,
      },
    });

    deepEqual(evaluateV0AutomationRules(envelope), []);
  });

  test("does not plan supervisor triage from malformed supervisor signal payloads", () => {
    const envelope = createAgenticEventEnvelope({
      eventId: "evt-supervisor-signal-malformed-001",
      eventType: AgenticEventType.SupervisorSignalSent,
      occurredAt: "2026-05-25T20:00:00.000Z",
      actor: {
        agentId: "agent-developer-001",
        hatAssignmentId: "hat-assignment-dev-001",
      },
      scope: {
        organizationId: "org-lfg",
        projectId: "project-agentic-org",
        teamId: "team-runtime",
        workItemId: "work-outbox-001",
      },
      aggregate: {
        aggregateId: "supervisor-signal-001",
        aggregateType: AgenticAggregateType.SupervisorSignal,
        aggregateVersion: 1,
      },
      trace: {
        commandId: "cmd-supervisor-signal-001",
        correlationId: "corr-supervisor-signal-001",
        causationId: "cause-team-work-001",
        traceId: "trace-supervisor-signal-001",
        idempotencyKey: "idem-supervisor-signal-001",
      },
      payload: {
        targetHatAssignmentId: "hat-assignment-em-001",
        targetLevel: "floating_manager",
      },
    });

    deepEqual(evaluateV0AutomationRules(envelope), []);
  });

  test("does not plan supervisor triage for non-supervisor target levels", () => {
    const envelope = createAgenticEventEnvelope({
      eventId: "evt-supervisor-signal-peer-target-001",
      eventType: AgenticEventType.SupervisorSignalSent,
      occurredAt: "2026-05-25T20:00:00.000Z",
      actor: {
        agentId: "agent-developer-001",
        hatAssignmentId: "hat-assignment-dev-001",
      },
      scope: {
        organizationId: "org-lfg",
        projectId: "project-agentic-org",
        teamId: "team-runtime",
        workItemId: "work-outbox-001",
      },
      aggregate: {
        aggregateId: "supervisor-signal-001",
        aggregateType: AgenticAggregateType.SupervisorSignal,
        aggregateVersion: 1,
      },
      trace: {
        commandId: "cmd-supervisor-signal-001",
        correlationId: "corr-supervisor-signal-001",
        causationId: "cause-team-work-001",
        traceId: "trace-supervisor-signal-001",
        idempotencyKey: "idem-supervisor-signal-001",
      },
      payload: {
        targetHatAssignmentId: "hat-assignment-peer-001",
        targetLevel: SupervisorChainLevel.TeamMember,
      },
    });

    deepEqual(evaluateV0AutomationRules(envelope), []);
  });
});
