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
  VisibilityHealth,
  WeakPointIndicatorType,
  WorkflowObservationKind,
  buildWorkflowVisibilityRecord,
} from "./workflow-visibility.ts";

describe("workflow visibility records", () => {
  test("builds a plug-in visibility record for agent self-monitoring", () => {
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

    deepEqual(
      buildWorkflowVisibilityRecord(envelope, {
        observationKind: WorkflowObservationKind.SupervisorSignal,
        health: VisibilityHealth.Degraded,
        stage: "supervisor_triage",
        links: {
          traceUrl: "https://grafana.example/explore?trace=trace-supervisor-signal-001",
          logsUrl: "https://grafana.example/explore?logs=work-outbox-001",
          metricsUrl: "https://grafana.example/d/agentic-org",
        },
        weakPointIndicators: [
          {
            indicatorType: WeakPointIndicatorType.BlockedWork,
            summary: "Work is waiting on supervisor triage",
            suggestedAction: "Engineering manager should triage the signal",
          },
        ],
      }),
      {
        observationKind: WorkflowObservationKind.SupervisorSignal,
        health: VisibilityHealth.Degraded,
        stage: "supervisor_triage",
        occurredAt: "2026-05-25T20:00:00.000Z",
        eventId: "evt-supervisor-signal-001",
        eventType: AgenticEventType.SupervisorSignalSent,
        commandId: "cmd-supervisor-signal-001",
        correlationId: "corr-supervisor-signal-001",
        causationId: "cause-team-work-001",
        traceId: "trace-supervisor-signal-001",
        idempotencyKey: "idem-supervisor-signal-001",
        organizationId: "org-lfg",
        projectId: "project-agentic-org",
        teamId: "team-runtime",
        workItemId: "work-outbox-001",
        agentId: "agent-developer-001",
        hatAssignmentId: "hat-assignment-dev-001",
        aggregateId: "supervisor-signal-001",
        aggregateType: AgenticAggregateType.SupervisorSignal,
        aggregateVersion: 1,
        links: {
          traceUrl: "https://grafana.example/explore?trace=trace-supervisor-signal-001",
          logsUrl: "https://grafana.example/explore?logs=work-outbox-001",
          metricsUrl: "https://grafana.example/d/agentic-org",
        },
        weakPointIndicators: [
          {
            indicatorType: WeakPointIndicatorType.BlockedWork,
            summary: "Work is waiting on supervisor triage",
            suggestedAction: "Engineering manager should triage the signal",
          },
        ],
      },
    );
  });
});
