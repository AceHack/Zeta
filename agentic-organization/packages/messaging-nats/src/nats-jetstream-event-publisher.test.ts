import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AgenticAggregateType,
  AgenticEventType,
  createAgenticEventEnvelope,
  type OutboxEvent,
} from "../../domain/src/index.ts";
import {
  createNatsJetStreamEventPublisher,
  NatsHeaderName,
  type NatsJetStreamClient,
} from "./nats-jetstream-event-publisher.ts";

describe("NATS JetStream event publisher", () => {
  test("publishes canonical JSON with idempotent headers and message ID", async () => {
    const client = createRecordingNatsClient();
    const publisher = createNatsJetStreamEventPublisher({
      client,
    });
    const outboxEvent = createOutboxEvent();

    await publisher.publish({
      subject: "agentic-org.local.org-lfg.work.supervisor_signal.sent",
      outboxEvent,
    });

    equal(client.messages.length, 1);
    deepEqual(client.messages[0], {
      subject: "agentic-org.local.org-lfg.work.supervisor_signal.sent",
      payload: JSON.stringify(outboxEvent.envelope),
      messageId: "evt-001",
      headers: {
        [NatsHeaderName.EventId]: "evt-001",
        [NatsHeaderName.EventType]: AgenticEventType.SupervisorSignalSent,
        [NatsHeaderName.CorrelationId]: "corr-001",
        [NatsHeaderName.CausationId]: "cause-001",
        [NatsHeaderName.TraceId]: "trace-001",
        [NatsHeaderName.IdempotencyKey]: "idem-001",
        [NatsHeaderName.OutboxEventId]: "outbox-001",
      },
    });
  });
});

function createRecordingNatsClient(): NatsJetStreamClient & {
  messages: {
    subject: string;
    payload: string;
    messageId: string;
    headers: Record<string, string>;
  }[];
} {
  const messages: {
    subject: string;
    payload: string;
    messageId: string;
    headers: Record<string, string>;
  }[] = [];

  return {
    messages,
    publish: async (message) => {
      messages.push(message);
    },
  };
}

function createOutboxEvent(): OutboxEvent {
  return {
    outboxEventId: "outbox-001",
    envelope: createAgenticEventEnvelope({
      eventId: "evt-001",
      eventType: AgenticEventType.SupervisorSignalSent,
      occurredAt: "2026-05-25T20:00:00.000Z",
      actor: {
        agentId: "agent-developer-001",
        hatAssignmentId: "hat-assignment-dev-001",
      },
      scope: {
        organizationId: "org-lfg",
        projectId: "project-agentic-org",
        workItemId: "work-outbox-001",
      },
      aggregate: {
        aggregateId: "supervisor-signal-001",
        aggregateType: AgenticAggregateType.SupervisorSignal,
        aggregateVersion: 1,
      },
      trace: {
        commandId: "cmd-001",
        correlationId: "corr-001",
        causationId: "cause-001",
        traceId: "trace-001",
        idempotencyKey: "idem-001",
      },
      payload: {
        title: "Blocked on scoped NATS publisher",
      },
    }),
  };
}
