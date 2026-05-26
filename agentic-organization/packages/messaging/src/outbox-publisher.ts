import { AgenticEventType, type OutboxEvent } from "../../domain/src/index.ts";
import type { ClaimUnpublishedOutboxEventsInput, OutboxEventSource } from "../../state/src/index.ts";
import { buildAgenticEventSubject } from "./subject-builder.ts";

export const AgenticMessagingDomain = {
  SupervisorSignal: "supervisor_signal",
  WorkItem: "work_item",
} as const;

export type AgenticMessagingDomain = (typeof AgenticMessagingDomain)[keyof typeof AgenticMessagingDomain];

export const OutboxPublishOutcomeStatus = {
  Empty: "empty",
  Published: "published",
} as const;

export type OutboxPublishOutcomeStatus = (typeof OutboxPublishOutcomeStatus)[keyof typeof OutboxPublishOutcomeStatus];

export type EventPublication = {
  subject: string;
  outboxEvent: OutboxEvent;
};

export type EventPublisher = {
  publish: (publication: EventPublication) => Promise<void>;
};

export type ResolveAgenticMessagingDomain = (eventType: AgenticEventType) => AgenticMessagingDomain;

export type OutboxPublisher = {
  publishNextBatch: (input: ClaimUnpublishedOutboxEventsInput) => Promise<OutboxPublishBatchResult>;
};

export type OutboxPublishBatchResult = {
  status: OutboxPublishOutcomeStatus;
  attemptedCount: number;
  publishedOutboxEventIds: string[];
};

export type CreateOutboxPublisherInput = {
  outboxSource: OutboxEventSource;
  eventPublisher: EventPublisher;
  environment: string;
  resolveDomain: ResolveAgenticMessagingDomain;
  now: () => string;
};

export function createOutboxPublisher(input: CreateOutboxPublisherInput): OutboxPublisher {
  return {
    publishNextBatch: async (publishInput) => {
      const outboxEvents = await input.outboxSource.claimUnpublishedOutboxEvents(publishInput);

      if (outboxEvents.length === 0) {
        return {
          status: OutboxPublishOutcomeStatus.Empty,
          attemptedCount: 0,
          publishedOutboxEventIds: [],
        };
      }

      const publishedOutboxEventIds: string[] = [];

      for (const outboxEvent of outboxEvents) {
        const subject = buildAgenticEventSubject({
          environment: input.environment,
          organizationId: outboxEvent.envelope.scope.organizationId,
          domain: input.resolveDomain(outboxEvent.envelope.eventType),
          eventType: outboxEvent.envelope.eventType,
        });

        await input.eventPublisher.publish({
          subject,
          outboxEvent,
        });
        await input.outboxSource.markOutboxEventPublished({
          outboxEventId: outboxEvent.outboxEventId,
          publishedAt: input.now(),
        });
        publishedOutboxEventIds.push(outboxEvent.outboxEventId);
      }

      return {
        status: OutboxPublishOutcomeStatus.Published,
        attemptedCount: outboxEvents.length,
        publishedOutboxEventIds,
      };
    },
  };
}

export function resolveAgenticMessagingDomain(eventType: AgenticEventType): AgenticMessagingDomain {
  if (eventType === AgenticEventType.SupervisorSignalSent) {
    return AgenticMessagingDomain.SupervisorSignal;
  }

  if (eventType === AgenticEventType.WorkItemChanged || eventType === AgenticEventType.WorkItemStateChanged) {
    return AgenticMessagingDomain.WorkItem;
  }

  throw new Error(`unsupported event type for messaging domain: ${eventType}`);
}
