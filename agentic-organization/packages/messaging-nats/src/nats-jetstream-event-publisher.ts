import type { EventPublisher } from "../../messaging/src/index.ts";

export const NatsHeaderName = {
  EventId: "Nats-Msg-Event-Id",
  EventType: "Nats-Msg-Event-Type",
  CorrelationId: "Nats-Msg-Correlation-Id",
  CausationId: "Nats-Msg-Causation-Id",
  TraceId: "Nats-Msg-Trace-Id",
  IdempotencyKey: "Nats-Msg-Idempotency-Key",
  OutboxEventId: "Nats-Msg-Outbox-Event-Id",
} as const;

export type NatsHeaderName = (typeof NatsHeaderName)[keyof typeof NatsHeaderName];

export type NatsJetStreamMessage = {
  subject: string;
  payload: string;
  messageId: string;
  headers: Record<string, string>;
};

export type NatsJetStreamClient = {
  publish: (message: NatsJetStreamMessage) => Promise<void>;
};

export type CreateNatsJetStreamEventPublisherInput = {
  client: NatsJetStreamClient;
};

export function createNatsJetStreamEventPublisher(input: CreateNatsJetStreamEventPublisherInput): EventPublisher {
  return {
    publish: async (publication) => {
      await input.client.publish({
        subject: publication.subject,
        payload: JSON.stringify(publication.outboxEvent.envelope),
        messageId: publication.outboxEvent.envelope.eventId,
        headers: {
          [NatsHeaderName.EventId]: publication.outboxEvent.envelope.eventId,
          [NatsHeaderName.EventType]: publication.outboxEvent.envelope.eventType,
          [NatsHeaderName.CorrelationId]: publication.outboxEvent.envelope.trace.correlationId,
          [NatsHeaderName.CausationId]: publication.outboxEvent.envelope.trace.causationId,
          [NatsHeaderName.TraceId]: publication.outboxEvent.envelope.trace.traceId,
          [NatsHeaderName.IdempotencyKey]: publication.outboxEvent.envelope.trace.idempotencyKey,
          [NatsHeaderName.OutboxEventId]: publication.outboxEvent.outboxEventId,
        },
      });
    },
  };
}
