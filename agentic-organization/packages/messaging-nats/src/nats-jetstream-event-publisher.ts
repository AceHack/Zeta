import type { EventPublisher } from "../../messaging/src/index.ts";
import {
  buildAgenticSpanAttributes,
  NoopTelemetry,
  TelemetryMetricKind,
  TelemetrySpanStatusCode,
  type TelemetryPort,
} from "../../observability/src/index.ts";

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
  telemetry?: TelemetryPort;
};

export function createNatsJetStreamEventPublisher(input: CreateNatsJetStreamEventPublisherInput): EventPublisher {
  const telemetry = input.telemetry ?? new NoopTelemetry();

  return {
    publish: async (publication) => {
      const attributes = buildAgenticSpanAttributes(publication.outboxEvent.envelope, {
        natsSubject: publication.subject,
      });
      const span = telemetry.startSpan("org.nats.publish", { attributes });
      const headers = {
        [NatsHeaderName.EventId]: publication.outboxEvent.envelope.eventId,
        [NatsHeaderName.EventType]: publication.outboxEvent.envelope.eventType,
        [NatsHeaderName.CorrelationId]: publication.outboxEvent.envelope.trace.correlationId,
        [NatsHeaderName.CausationId]: publication.outboxEvent.envelope.trace.causationId,
        [NatsHeaderName.TraceId]: publication.outboxEvent.envelope.trace.traceId,
        [NatsHeaderName.IdempotencyKey]: publication.outboxEvent.envelope.trace.idempotencyKey,
        [NatsHeaderName.OutboxEventId]: publication.outboxEvent.outboxEventId,
      };
      telemetry.inject(headers);

      try {
        await input.client.publish({
          subject: publication.subject,
          payload: JSON.stringify(publication.outboxEvent.envelope),
          messageId: publication.outboxEvent.envelope.eventId,
          headers,
        });
        span.setStatus({ code: TelemetrySpanStatusCode.Ok });
        telemetry.recordMetric({
          kind: TelemetryMetricKind.Counter,
          name: "org_nats_published_total",
          value: 1,
          attributes: {
            "messaging.destination.name": publication.subject,
            "result.status": "published",
          },
        });
      } catch (error) {
        span.setStatus({ code: TelemetrySpanStatusCode.Error, message: extractErrorMessage(error) });
        telemetry.recordMetric({
          kind: TelemetryMetricKind.Counter,
          name: "org_nats_published_total",
          value: 1,
          attributes: {
            "messaging.destination.name": publication.subject,
            "result.status": "failed",
          },
        });
        throw error;
      } finally {
        span.end();
      }
    },
  };
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
