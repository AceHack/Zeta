import { deepEqual } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AgenticAggregateType,
  AgenticEventType,
  WorkItemState,
  createAgenticEventEnvelope,
} from "../../domain/src/index.ts";
import { MessagingSystemName, buildAgenticSpanAttributes } from "./span-attributes.ts";

describe("agentic observability span attributes", () => {
  test("projects event context into LGTM-friendly OpenTelemetry attributes", () => {
    const envelope = createAgenticEventEnvelope({
      eventId: "evt-capability-001",
      eventType: AgenticEventType.WorkItemChanged,
      occurredAt: "2026-05-25T20:00:00.000Z",
      actor: {
        agentId: "agent-addison",
        hatAssignmentId: "hat-assignment-em-001",
      },
      scope: {
        organizationId: "org-lfg",
        projectId: "project-agentic-org",
        workItemId: "work-capability-001",
      },
      aggregate: {
        aggregateId: "work-capability-001",
        aggregateType: AgenticAggregateType.WorkItem,
        aggregateVersion: 1,
      },
      trace: {
        commandId: "cmd-capability-001",
        correlationId: "corr-capability-001",
        causationId: "cause-intake-001",
        traceId: "trace-capability-001",
        idempotencyKey: "idem-capability-001",
      },
      payload: {
        state: WorkItemState.New,
      },
    });

    deepEqual(
      buildAgenticSpanAttributes(envelope, {
        natsSubject: "agentic-org.dev.org-lfg.work.work_item.changed",
      }),
      {
        "agentic.event.id": "evt-capability-001",
        "agentic.event.type": AgenticEventType.WorkItemChanged,
        "agentic.command.id": "cmd-capability-001",
        "agentic.correlation.id": "corr-capability-001",
        "agentic.causation.id": "cause-intake-001",
        "agentic.trace.id": "trace-capability-001",
        "agentic.idempotency.key": "idem-capability-001",
        "agentic.agent.id": "agent-addison",
        "agentic.hat.assignment.id": "hat-assignment-em-001",
        "agentic.organization.id": "org-lfg",
        "agentic.project.id": "project-agentic-org",
        "agentic.work_item.id": "work-capability-001",
        "agentic.aggregate.id": "work-capability-001",
        "agentic.aggregate.type": AgenticAggregateType.WorkItem,
        "agentic.aggregate.version": 1,
        "messaging.system": MessagingSystemName.Nats,
        "messaging.destination.name": "agentic-org.dev.org-lfg.work.work_item.changed",
      },
    );
  });
});
