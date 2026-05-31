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
} from "../src/nats-jetstream-event-publisher.ts";
import {
  RecordingTelemetry,
  TelemetryMetricKind,
  TelemetrySpanStatusCode,
  W3CTraceHeaderName,
} from "../../observability/src/index.ts";

describe("NATS JetStream event publisher", () => {
  test("publishes canonical JSON with idempotent headers and message ID", async () => {
    const client = createRecordingNatsClient();
    const publisher = createNatsJetStreamEventPublisher({
      client,
    });
    const outboxEvent = createOutboxEvent();

    await publisher.publish({
      subject: "agentic-org.local.org-lfg.supervisor_signal.supervisor_signal.sent",
      outboxEvent,
    });

    equal(client.messages.length, 1);
    deepEqual(client.messages[0], {
      subject: "agentic-org.local.org-lfg.supervisor_signal.supervisor_signal.sent",
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

  test("injects W3C trace context and records publish telemetry when a telemetry port is provided", async () => {
    const client = createRecordingNatsClient();
    const telemetry = new RecordingTelemetry({
      traceContext: {
        traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
        spanId: "00f067aa0ba902b7",
        traceFlags: "01",
      },
    });
    const publisher = createNatsJetStreamEventPublisher({
      client,
      telemetry,
    });

    await publisher.publish({
      subject: "agentic-org.local.org-lfg.supervisor_signal.supervisor_signal.sent",
      outboxEvent: createOutboxEvent(),
    });

    equal(
      client.messages[0]?.headers[W3CTraceHeaderName.TraceParent],
      "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    );
    deepEqual(
      telemetry.spans.map((span) => ({
        name: span.name,
        status: span.status,
        ended: span.ended,
        subject: span.attributes["messaging.destination.name"],
        eventId: span.attributes["agentic.event.id"],
      })),
      [
        {
          name: "org.nats.publish",
          status: { code: TelemetrySpanStatusCode.Ok },
          ended: true,
          subject: "agentic-org.local.org-lfg.supervisor_signal.supervisor_signal.sent",
          eventId: "evt-001",
        },
      ],
    );
    deepEqual(telemetry.metrics, [
      {
        kind: TelemetryMetricKind.Counter,
        name: "org_nats_published_total",
        value: 1,
        attributes: {
          "messaging.destination.name": "agentic-org.local.org-lfg.supervisor_signal.supervisor_signal.sent",
          "result.status": "published",
        },
      },
    ]);
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
