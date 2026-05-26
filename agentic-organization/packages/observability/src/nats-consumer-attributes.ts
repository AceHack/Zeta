import { MessagingSystemName } from "./span-attributes.ts";

export const NatsConsumerAttributeKey = {
  MessagingSystem: "messaging.system",
  StreamName: "messaging.nats.stream",
  ConsumerName: "messaging.nats.consumer",
  ReceivedCount: "agentic.nats.consumer.received_count",
  ProcessedCount: "agentic.nats.consumer.processed_count",
  DuplicateCount: "agentic.nats.consumer.duplicate_count",
  PayloadConflictCount: "agentic.nats.consumer.payload_conflict_count",
  InvalidCount: "agentic.nats.consumer.invalid_count",
  FailedCount: "agentic.nats.consumer.failed_count",
  AcknowledgedCount: "agentic.nats.consumer.acknowledged_count",
  NegativeAcknowledgedCount: "agentic.nats.consumer.negative_acknowledged_count",
  TerminatedCount: "agentic.nats.consumer.terminated_count",
  DeadLetteredCount: "agentic.nats.consumer.dead_lettered_count",
} as const;

export type NatsConsumerAttributeKey = (typeof NatsConsumerAttributeKey)[keyof typeof NatsConsumerAttributeKey];

export type NatsConsumerBatchCounts = {
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

export type BuildNatsConsumerBatchAttributesInput = NatsConsumerBatchCounts & {
  streamName: string;
  durableName: string;
};

export type NatsConsumerBatchAttributes = Record<NatsConsumerAttributeKey, string | number>;

export function buildNatsConsumerBatchAttributes(
  input: BuildNatsConsumerBatchAttributesInput,
): NatsConsumerBatchAttributes {
  return {
    [NatsConsumerAttributeKey.MessagingSystem]: MessagingSystemName.Nats,
    [NatsConsumerAttributeKey.StreamName]: input.streamName,
    [NatsConsumerAttributeKey.ConsumerName]: input.durableName,
    [NatsConsumerAttributeKey.ReceivedCount]: input.receivedCount,
    [NatsConsumerAttributeKey.ProcessedCount]: input.processedCount,
    [NatsConsumerAttributeKey.DuplicateCount]: input.duplicateCount,
    [NatsConsumerAttributeKey.PayloadConflictCount]: input.payloadConflictCount,
    [NatsConsumerAttributeKey.InvalidCount]: input.invalidCount,
    [NatsConsumerAttributeKey.FailedCount]: input.failedCount,
    [NatsConsumerAttributeKey.AcknowledgedCount]: input.acknowledgedCount,
    [NatsConsumerAttributeKey.NegativeAcknowledgedCount]: input.negativeAcknowledgedCount,
    [NatsConsumerAttributeKey.TerminatedCount]: input.terminatedCount,
    [NatsConsumerAttributeKey.DeadLetteredCount]: input.deadLetteredCount,
  };
}
