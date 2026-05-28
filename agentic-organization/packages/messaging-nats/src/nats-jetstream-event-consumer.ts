import {
  AgenticAggregateType,
  AgenticEventType,
  EventSchemaVersion,
  createAgenticEventEnvelope,
  type AgenticEventEnvelope,
} from "../../domain/src/index.ts";
import type { EventIngestionProcessor } from "../../runtime/src/index.ts";
import { EventIngestionOutcomeStatus } from "../../state/src/index.ts";

export const NatsInboundMessageAckAction = {
  Acknowledge: "acknowledge",
  NegativeAcknowledge: "negative_acknowledge",
  Terminate: "terminate",
} as const;

export type NatsInboundMessageAckAction =
  (typeof NatsInboundMessageAckAction)[keyof typeof NatsInboundMessageAckAction];

export const NatsDeadLetterReason = {
  InvalidEnvelope: "invalid_envelope",
  PayloadConflict: "payload_conflict",
} as const;

export type NatsDeadLetterReason = (typeof NatsDeadLetterReason)[keyof typeof NatsDeadLetterReason];

export type FetchNatsJetStreamBatchInput = {
  batchSize: number;
};

export type NatsJetStreamInboundMessage = {
  subject: string;
  payload: string;
  headers: Record<string, string>;
  acknowledge: () => Promise<void>;
  negativeAcknowledge: () => Promise<void>;
  terminate: () => Promise<void>;
};

export type NatsJetStreamPullConsumer = {
  fetchNextBatch: (input: FetchNatsJetStreamBatchInput) => Promise<readonly NatsJetStreamInboundMessage[]>;
};

export type NatsDeadLetterMessage = {
  sourceSubject: string;
  payload: string;
  headers: Record<string, string>;
  reason: NatsDeadLetterReason;
};

export type NatsDeadLetterPublisher = {
  publish: (message: NatsDeadLetterMessage) => Promise<void>;
};

export type ProcessNatsJetStreamBatchInput = {
  batchSize: number;
};

export type NatsJetStreamConsumeBatchResult = {
  receivedCount: number;
  processedCount: number;
  duplicateCount: number;
  payloadConflictCount: number;
  invalidCount: number;
  failedCount: number;
  acknowledgedCount: number;
  negativeAcknowledgedCount: number;
  terminatedCount: number;
  deadLetteredCount: number;
};

export type NatsJetStreamEventConsumer = {
  processNextBatch: (input: ProcessNatsJetStreamBatchInput) => Promise<NatsJetStreamConsumeBatchResult>;
};

export type CreateNatsJetStreamEventConsumerInput = {
  pullConsumer: NatsJetStreamPullConsumer;
  eventIngestionProcessor: EventIngestionProcessor;
  deadLetterPublisher: NatsDeadLetterPublisher;
};

export function createNatsJetStreamEventConsumer(
  input: CreateNatsJetStreamEventConsumerInput,
): NatsJetStreamEventConsumer {
  return {
    processNextBatch: async ({ batchSize }) => {
      const messages = await input.pullConsumer.fetchNextBatch({
        batchSize,
      });
      const result = createEmptyConsumeBatchResult(messages.length);

      for (const message of messages) {
        await processMessage({
          message,
          eventIngestionProcessor: input.eventIngestionProcessor,
          deadLetterPublisher: input.deadLetterPublisher,
          result,
        });
      }

      return result;
    },
  };
}

type ProcessMessageInput = {
  message: NatsJetStreamInboundMessage;
  eventIngestionProcessor: EventIngestionProcessor;
  deadLetterPublisher: NatsDeadLetterPublisher;
  result: NatsJetStreamConsumeBatchResult;
};

async function processMessage(input: ProcessMessageInput): Promise<void> {
  const envelope = decodeCanonicalEventEnvelope(input.message.payload);

  if (envelope === undefined) {
    input.result.invalidCount += 1;
    await terminateWithDeadLetter({
      message: input.message,
      deadLetterPublisher: input.deadLetterPublisher,
      result: input.result,
      reason: NatsDeadLetterReason.InvalidEnvelope,
    });
    return;
  }

  try {
    const ingestionResult = await input.eventIngestionProcessor.ingest({
      envelope,
    });

    if (ingestionResult.status === EventIngestionOutcomeStatus.PayloadConflict) {
      input.result.payloadConflictCount += 1;
      await terminateWithDeadLetter({
        message: input.message,
        deadLetterPublisher: input.deadLetterPublisher,
        result: input.result,
        reason: NatsDeadLetterReason.PayloadConflict,
      });
      return;
    }

    if (ingestionResult.status === EventIngestionOutcomeStatus.Duplicate) {
      input.result.duplicateCount += 1;
    }

    if (ingestionResult.status === EventIngestionOutcomeStatus.Processed) {
      input.result.processedCount += 1;
    }

    await input.message.acknowledge();
    input.result.acknowledgedCount += 1;
  } catch {
    input.result.failedCount += 1;
    await negativeAcknowledgeFailedMessage({
      message: input.message,
      result: input.result,
    });
  }
}

type TerminateWithDeadLetterInput = {
  message: NatsJetStreamInboundMessage;
  deadLetterPublisher: NatsDeadLetterPublisher;
  result: NatsJetStreamConsumeBatchResult;
  reason: NatsDeadLetterReason;
};

async function terminateWithDeadLetter(input: TerminateWithDeadLetterInput): Promise<void> {
  let deadLetterPublished = false;

  try {
    await input.deadLetterPublisher.publish({
      sourceSubject: input.message.subject,
      payload: input.message.payload,
      headers: input.message.headers,
      reason: input.reason,
    });
    deadLetterPublished = true;
    input.result.deadLetteredCount += 1;
    await input.message.terminate();
    input.result.terminatedCount += 1;
  } catch {
    input.result.failedCount += 1;

    if (deadLetterPublished) {
      await acknowledgeDeadLetteredMessage({
        message: input.message,
        result: input.result,
      });
      return;
    }

    await negativeAcknowledgeFailedMessage({
      message: input.message,
      result: input.result,
    });
  }
}

type AcknowledgeDeadLetteredMessageInput = {
  message: NatsJetStreamInboundMessage;
  result: NatsJetStreamConsumeBatchResult;
};

async function acknowledgeDeadLetteredMessage(input: AcknowledgeDeadLetteredMessageInput): Promise<void> {
  try {
    await input.message.acknowledge();
    input.result.acknowledgedCount += 1;
  } catch {
    input.result.failedCount += 1;
  }
}

type NegativeAcknowledgeFailedMessageInput = {
  message: NatsJetStreamInboundMessage;
  result: NatsJetStreamConsumeBatchResult;
};

async function negativeAcknowledgeFailedMessage(input: NegativeAcknowledgeFailedMessageInput): Promise<void> {
  try {
    await input.message.negativeAcknowledge();
    input.result.negativeAcknowledgedCount += 1;
  } catch {
    input.result.failedCount += 1;
  }
}

function decodeCanonicalEventEnvelope(payload: string): AgenticEventEnvelope | undefined {
  const parsed = parseJsonRecord(payload);

  if (parsed === undefined || !isCanonicalEventEnvelopeRecord(parsed)) {
    return undefined;
  }

  try {
    return createAgenticEventEnvelope({
      eventId: parsed.eventId,
      eventType: parsed.eventType,
      schemaVersion: parsed.schemaVersion,
      occurredAt: parsed.occurredAt,
      actor: parsed.actor,
      scope: parsed.scope,
      aggregate: parsed.aggregate,
      trace: parsed.trace,
      replay: parsed.replay,
      payload: parsed.payload,
    });
  } catch {
    return undefined;
  }
}

function parseJsonRecord(payload: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(payload);

    if (isRecord(parsed)) {
      return parsed;
    }

    return undefined;
  } catch {
    return undefined;
  }
}

function isCanonicalEventEnvelopeRecord(value: Record<string, unknown>): value is AgenticEventEnvelope {
  return (
    typeof value.eventId === "string" &&
    isAgenticEventType(value.eventType) &&
    value.schemaVersion === EventSchemaVersion.AgenticOrgEventV1 &&
    typeof value.occurredAt === "string" &&
    isActor(value.actor) &&
    isScope(value.scope) &&
    isAggregate(value.aggregate) &&
    isTrace(value.trace) &&
    isReplay(value.replay)
  );
}

function isActor(value: unknown): value is AgenticEventEnvelope["actor"] {
  return isRecord(value) && typeof value.agentId === "string" && typeof value.hatAssignmentId === "string";
}

function isScope(value: unknown): value is AgenticEventEnvelope["scope"] {
  return (
    isRecord(value) &&
    typeof value.organizationId === "string" &&
    typeof value.projectId === "string" &&
    typeof value.workItemId === "string" &&
    isOptionalString(value.initiativeId) &&
    isOptionalString(value.teamId)
  );
}

function isAggregate(value: unknown): value is AgenticEventEnvelope["aggregate"] {
  return (
    isRecord(value) &&
    typeof value.aggregateId === "string" &&
    isAgenticAggregateType(value.aggregateType) &&
    typeof value.aggregateVersion === "number"
  );
}

function isTrace(value: unknown): value is AgenticEventEnvelope["trace"] {
  return (
    isRecord(value) &&
    typeof value.commandId === "string" &&
    typeof value.correlationId === "string" &&
    typeof value.causationId === "string" &&
    typeof value.traceId === "string" &&
    typeof value.idempotencyKey === "string"
  );
}

function isReplay(value: unknown): value is AgenticEventEnvelope["replay"] {
  return isRecord(value) && typeof value.isReplay === "boolean";
}

function isAgenticEventType(value: unknown): value is AgenticEventType {
  return Object.values(AgenticEventType).includes(value as AgenticEventType);
}

function isAgenticAggregateType(value: unknown): value is AgenticAggregateType {
  return Object.values(AgenticAggregateType).includes(value as AgenticAggregateType);
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createEmptyConsumeBatchResult(receivedCount: number): NatsJetStreamConsumeBatchResult {
  return {
    receivedCount,
    processedCount: 0,
    duplicateCount: 0,
    payloadConflictCount: 0,
    invalidCount: 0,
    failedCount: 0,
    acknowledgedCount: 0,
    negativeAcknowledgedCount: 0,
    terminatedCount: 0,
    deadLetteredCount: 0,
  };
}
