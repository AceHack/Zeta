import { deepEqual, equal, throws } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AgenticAggregateType,
  AgenticEventType,
  createAgenticEventEnvelope,
  type CommandTrace,
} from "./event-envelope.ts";

const commandTrace: CommandTrace = {
  commandId: "cmd-capability-001",
  correlationId: "corr-capability-001",
  causationId: "cause-intake-001",
  traceId: "trace-capability-001",
  idempotencyKey: "idem-capability-001",
};

describe("canonical agentic event envelope", () => {
  test("requires the command trace chain", () => {
    throws(
      () =>
        createAgenticEventEnvelope({
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
            ...commandTrace,
            commandId: "",
          },
          payload: {
            title: "Request NATS publishing capability",
          },
        }),
      /commandId/,
    );
  });

  test("requires a work item anchor", () => {
    throws(
      () =>
        createAgenticEventEnvelope({
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
          },
          aggregate: {
            aggregateId: "work-capability-001",
            aggregateType: AgenticAggregateType.WorkItem,
            aggregateVersion: 1,
          },
          trace: commandTrace,
          payload: {
            title: "Request NATS publishing capability",
          },
        } as Parameters<typeof createAgenticEventEnvelope>[0]),
      /scope.workItemId/,
    );
  });

  test("builds a typed replay-safe event envelope", () => {
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
      trace: commandTrace,
      payload: {
        title: "Request NATS publishing capability",
      },
    });

    equal(envelope.schemaVersion, "agentic.org.event.v1");
    equal(envelope.eventType, AgenticEventType.WorkItemChanged);
    equal(envelope.aggregate.aggregateVersion, 1);
    deepEqual(envelope.replay, {
      isReplay: false,
    });
  });
});
