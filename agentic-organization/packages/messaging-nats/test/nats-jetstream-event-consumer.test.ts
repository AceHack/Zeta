import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AgenticAggregateType,
  AgenticEventType,
  createAgenticEventEnvelope,
  type AgenticEventEnvelope,
} from "../../domain/src/index.ts";
import type { EventIngestionProcessor } from "../../runtime/src/index.ts";
import { EventIngestionOutcomeStatus } from "../../state/src/index.ts";
import {
  RecordingTelemetry,
  TelemetryMetricKind,
  TelemetrySpanStatusCode,
  W3CTraceHeaderName,
} from "../../observability/src/index.ts";
import {
  NatsDeadLetterReason,
  NatsInboundMessageAckAction,
  createNatsJetStreamEventConsumer,
  type NatsJetStreamInboundMessage,
  type NatsJetStreamPullConsumer,
} from "../src/index.ts";

describe("NATS JetStream event consumer", () => {
  test("decodes canonical event envelopes and acknowledges processed messages", async () => {
    const envelope = createEnvelope();
    const message = createRecordingInboundMessage({
      payload: JSON.stringify(envelope),
    });
    const pullConsumer = createRecordingPullConsumer([message]);
    const eventIngestionProcessor = createRecordingEventIngestionProcessor(EventIngestionOutcomeStatus.Processed);
    const deadLetterPublisher = createRecordingDeadLetterPublisher();
    const consumer = createNatsJetStreamEventConsumer({
      pullConsumer,
      eventIngestionProcessor,
      deadLetterPublisher,
    });

    const result = await consumer.processNextBatch({
      batchSize: 10,
    });

    deepEqual(pullConsumer.batchSizes, [10]);
    deepEqual(eventIngestionProcessor.eventIds, ["evt-nats-001"]);
    deepEqual(eventIngestionProcessor.traceFields, [
      {
        eventId: "evt-nats-001",
        traceId: "trace-nats-001",
        correlationId: "corr-nats-001",
        idempotencyKey: "idem-nats-001",
      },
    ]);
    deepEqual(message.ackActions, [NatsInboundMessageAckAction.Acknowledge]);
    equal(deadLetterPublisher.messages.length, 0);
    deepEqual(result, {
      receivedCount: 1,
      processedCount: 1,
      duplicateCount: 0,
      payloadConflictCount: 0,
      invalidCount: 0,
      failedCount: 0,
      acknowledgedCount: 1,
      negativeAcknowledgedCount: 0,
      terminatedCount: 0,
      deadLetteredCount: 0,
    });
  });

  test("terminates and dead-letters invalid payloads without calling runtime ingestion", async () => {
    const message = createRecordingInboundMessage({
      payload: "{not-json",
    });
    const eventIngestionProcessor = createRecordingEventIngestionProcessor(EventIngestionOutcomeStatus.Processed);
    const deadLetterPublisher = createRecordingDeadLetterPublisher();
    const consumer = createNatsJetStreamEventConsumer({
      pullConsumer: createRecordingPullConsumer([message]),
      eventIngestionProcessor,
      deadLetterPublisher,
    });

    const result = await consumer.processNextBatch({
      batchSize: 10,
    });

    deepEqual(eventIngestionProcessor.eventIds, []);
    deepEqual(message.ackActions, [NatsInboundMessageAckAction.Terminate]);
    equal(result.invalidCount, 1);
    equal(result.deadLetteredCount, 1);
    deepEqual(deadLetterPublisher.messages, [
      {
        sourceSubject: "agentic-org.local.org-lfg.supervisor_signal.supervisor_signal.sent",
        payload: "{not-json",
        headers: {
          "Nats-Msg-Event-Id": "evt-nats-001",
        },
        reason: NatsDeadLetterReason.InvalidEnvelope,
      },
    ]);
  });

  test("terminates and dead-letters payload conflicts", async () => {
    const envelope = createEnvelope();
    const message = createRecordingInboundMessage({
      payload: JSON.stringify(envelope),
    });
    const deadLetterPublisher = createRecordingDeadLetterPublisher();
    const consumer = createNatsJetStreamEventConsumer({
      pullConsumer: createRecordingPullConsumer([message]),
      eventIngestionProcessor: createRecordingEventIngestionProcessor(EventIngestionOutcomeStatus.PayloadConflict),
      deadLetterPublisher,
    });

    const result = await consumer.processNextBatch({
      batchSize: 10,
    });

    deepEqual(message.ackActions, [NatsInboundMessageAckAction.Terminate]);
    equal(result.payloadConflictCount, 1);
    equal(result.deadLetteredCount, 1);
    deepEqual(deadLetterPublisher.messages, [
      {
        sourceSubject: "agentic-org.local.org-lfg.supervisor_signal.supervisor_signal.sent",
        payload: JSON.stringify(envelope),
        headers: {
          "Nats-Msg-Event-Id": "evt-nats-001",
        },
        reason: NatsDeadLetterReason.PayloadConflict,
      },
    ]);
  });

  test("negative-acknowledges invalid payloads when dead-letter publishing fails", async () => {
    const invalidMessage = createRecordingInboundMessage({
      payload: "{not-json",
    });
    const validMessage = createRecordingInboundMessage({
      payload: JSON.stringify(createEnvelope()),
    });
    const eventIngestionProcessor = createRecordingEventIngestionProcessor(EventIngestionOutcomeStatus.Processed);
    const consumer = createNatsJetStreamEventConsumer({
      pullConsumer: createRecordingPullConsumer([invalidMessage, validMessage]),
      eventIngestionProcessor,
      deadLetterPublisher: createFailingDeadLetterPublisher("dlq unavailable"),
    });

    const result = await consumer.processNextBatch({
      batchSize: 10,
    });

    deepEqual(invalidMessage.ackActions, [NatsInboundMessageAckAction.NegativeAcknowledge]);
    deepEqual(validMessage.ackActions, [NatsInboundMessageAckAction.Acknowledge]);
    deepEqual(eventIngestionProcessor.eventIds, ["evt-nats-001"]);
    equal(result.receivedCount, 2);
    equal(result.invalidCount, 1);
    equal(result.processedCount, 1);
    equal(result.failedCount, 1);
    equal(result.deadLetteredCount, 0);
    equal(result.terminatedCount, 0);
    equal(result.negativeAcknowledgedCount, 1);
    equal(result.acknowledgedCount, 1);
  });

  test("acknowledges payload conflicts when termination fails after dead-letter publication", async () => {
    const envelope = createEnvelope();
    const message = createRecordingInboundMessage({
      payload: JSON.stringify(envelope),
      failTerminate: true,
    });
    const deadLetterPublisher = createRecordingDeadLetterPublisher();
    const consumer = createNatsJetStreamEventConsumer({
      pullConsumer: createRecordingPullConsumer([message]),
      eventIngestionProcessor: createRecordingEventIngestionProcessor(EventIngestionOutcomeStatus.PayloadConflict),
      deadLetterPublisher,
    });

    const result = await consumer.processNextBatch({
      batchSize: 10,
    });

    deepEqual(message.ackActions, [NatsInboundMessageAckAction.Terminate, NatsInboundMessageAckAction.Acknowledge]);
    equal(result.payloadConflictCount, 1);
    equal(result.failedCount, 1);
    equal(result.deadLetteredCount, 1);
    equal(result.terminatedCount, 0);
    equal(result.negativeAcknowledgedCount, 0);
    equal(result.acknowledgedCount, 1);
    equal(deadLetterPublisher.messages.length, 1);
  });

  test("negative-acknowledges transient ingestion failures", async () => {
    const message = createRecordingInboundMessage({
      payload: JSON.stringify(createEnvelope()),
    });
    const consumer = createNatsJetStreamEventConsumer({
      pullConsumer: createRecordingPullConsumer([message]),
      eventIngestionProcessor: createFailingEventIngestionProcessor("store unavailable"),
      deadLetterPublisher: createRecordingDeadLetterPublisher(),
    });

    const result = await consumer.processNextBatch({
      batchSize: 10,
    });

    deepEqual(message.ackActions, [NatsInboundMessageAckAction.NegativeAcknowledge]);
    equal(result.failedCount, 1);
    equal(result.negativeAcknowledgedCount, 1);
  });

  test("extracts W3C trace context and records consume telemetry for processed messages", async () => {
    const telemetry = new RecordingTelemetry();
    const message = createRecordingInboundMessage({
      payload: JSON.stringify(createEnvelope()),
      headers: {
        [W3CTraceHeaderName.TraceParent]: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      },
    });
    const consumer = createNatsJetStreamEventConsumer({
      pullConsumer: createRecordingPullConsumer([message]),
      eventIngestionProcessor: createRecordingEventIngestionProcessor(EventIngestionOutcomeStatus.Processed),
      deadLetterPublisher: createRecordingDeadLetterPublisher(),
      telemetry,
    });

    await consumer.processNextBatch({
      batchSize: 10,
    });

    deepEqual(
      telemetry.spans.map((span) => ({
        name: span.name,
        status: span.status,
        ended: span.ended,
        subject: span.attributes["messaging.destination.name"],
        eventId: span.attributes["agentic.event.id"],
        resultStatus: span.attributes["result.status"],
      })),
      [
        {
          name: "org.nats.consume",
          status: { code: TelemetrySpanStatusCode.Ok },
          ended: true,
          subject: "agentic-org.local.org-lfg.supervisor_signal.supervisor_signal.sent",
          eventId: "evt-nats-001",
          resultStatus: EventIngestionOutcomeStatus.Processed,
        },
      ],
    );
    deepEqual(telemetry.metrics, [
      {
        kind: TelemetryMetricKind.Counter,
        name: "org_nats_consumed_total",
        value: 1,
        attributes: {
          "messaging.destination.name": "agentic-org.local.org-lfg.supervisor_signal.supervisor_signal.sent",
          "result.status": EventIngestionOutcomeStatus.Processed,
        },
      },
    ]);
  });

  test("passes the inbound W3C traceparent to runtime ingestion for durable reaction-plan continuity", async () => {
    const traceparent = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
    const eventIngestionProcessor = createRecordingEventIngestionProcessor(EventIngestionOutcomeStatus.Processed);
    const consumer = createNatsJetStreamEventConsumer({
      pullConsumer: createRecordingPullConsumer([
        createRecordingInboundMessage({
          payload: JSON.stringify(createEnvelope()),
          headers: {
            [W3CTraceHeaderName.TraceParent]: traceparent,
          },
        }),
      ]),
      eventIngestionProcessor,
      deadLetterPublisher: createRecordingDeadLetterPublisher(),
    });

    await consumer.processNextBatch({
      batchSize: 10,
    });

    deepEqual(eventIngestionProcessor.traceparents, [traceparent]);
  });
});

function createEnvelope(): AgenticEventEnvelope {
  return createAgenticEventEnvelope({
    eventId: "evt-nats-001",
    eventType: AgenticEventType.SupervisorSignalSent,
    occurredAt: "2026-05-25T20:00:00.000Z",
    actor: {
      agentId: "agent-developer-001",
      hatAssignmentId: "hat-assignment-dev-001",
    },
    scope: {
      organizationId: "org-lfg",
      projectId: "project-agentic-org",
      workItemId: "work-nats-001",
    },
    aggregate: {
      aggregateId: "supervisor-signal-001",
      aggregateType: AgenticAggregateType.SupervisorSignal,
      aggregateVersion: 1,
    },
    trace: {
      commandId: "cmd-nats-001",
      correlationId: "corr-nats-001",
      causationId: "cause-nats-001",
      traceId: "trace-nats-001",
      idempotencyKey: "idem-nats-001",
    },
    payload: {
      title: "Blocked on NATS inbound adapter",
    },
  });
}

function createRecordingInboundMessage(input: {
  payload: string;
  headers?: Record<string, string>;
  failTerminate?: boolean;
}): NatsJetStreamInboundMessage & {
  ackActions: NatsInboundMessageAckAction[];
} {
  const ackActions: NatsInboundMessageAckAction[] = [];

  return {
    subject: "agentic-org.local.org-lfg.supervisor_signal.supervisor_signal.sent",
    payload: input.payload,
    headers: {
      "Nats-Msg-Event-Id": "evt-nats-001",
      ...(input.headers ?? {}),
    },
    ackActions,
    acknowledge: async () => {
      ackActions.push(NatsInboundMessageAckAction.Acknowledge);
    },
    negativeAcknowledge: async () => {
      ackActions.push(NatsInboundMessageAckAction.NegativeAcknowledge);
    },
    terminate: async () => {
      ackActions.push(NatsInboundMessageAckAction.Terminate);

      if (input.failTerminate === true) {
        throw new Error("terminate unavailable");
      }
    },
  };
}

function createRecordingPullConsumer(messages: readonly NatsJetStreamInboundMessage[]): NatsJetStreamPullConsumer & {
  batchSizes: number[];
} {
  const batchSizes: number[] = [];

  return {
    batchSizes,
    fetchNextBatch: async (input) => {
      batchSizes.push(input.batchSize);
      return messages;
    },
  };
}

function createRecordingEventIngestionProcessor(status: EventIngestionOutcomeStatus): EventIngestionProcessor & {
  eventIds: string[];
  traceparents: Array<string | undefined>;
  traceFields: {
    eventId: string;
    traceId: string;
    correlationId: string;
    idempotencyKey: string;
  }[];
} {
  const eventIds: string[] = [];
  const traceparents: Array<string | undefined> = [];
  const traceFields: {
    eventId: string;
    traceId: string;
    correlationId: string;
    idempotencyKey: string;
  }[] = [];

  return {
    eventIds,
    traceparents,
    traceFields,
    ingest: async (input) => {
      eventIds.push(input.envelope.eventId);
      traceparents.push(input.traceparent);
      traceFields.push({
        eventId: input.envelope.eventId,
        traceId: input.envelope.trace.traceId,
        correlationId: input.envelope.trace.correlationId,
        idempotencyKey: input.envelope.trace.idempotencyKey,
      });

      return {
        status,
        reactionPlans: [],
      };
    },
  };
}

function createFailingEventIngestionProcessor(message: string): EventIngestionProcessor {
  return {
    ingest: async () => {
      throw new Error(message);
    },
  };
}

function createRecordingDeadLetterPublisher(): {
  messages: {
    sourceSubject: string;
    payload: string;
    headers: Record<string, string>;
    reason: NatsDeadLetterReason;
  }[];
  publish: (input: {
    sourceSubject: string;
    payload: string;
    headers: Record<string, string>;
    reason: NatsDeadLetterReason;
  }) => Promise<void>;
} {
  const messages: {
    sourceSubject: string;
    payload: string;
    headers: Record<string, string>;
    reason: NatsDeadLetterReason;
  }[] = [];

  return {
    messages,
    publish: async (input) => {
      messages.push(input);
    },
  };
}

function createFailingDeadLetterPublisher(message: string): {
  publish: () => Promise<void>;
} {
  return {
    publish: async () => {
      throw new Error(message);
    },
  };
}
