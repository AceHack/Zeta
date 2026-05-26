import { deepEqual } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AgenticAggregateType,
  AgenticEventType,
  SupervisorChainLevel,
  SupervisorSignalStatus,
  SupervisorSignalToolType,
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
});
