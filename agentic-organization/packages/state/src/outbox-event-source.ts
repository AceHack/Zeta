import type { OutboxEvent } from "../../domain/src/index.ts";

export type ClaimUnpublishedOutboxEventsInput = {
  batchSize: number;
};

export type MarkOutboxEventPublishedInput = {
  outboxEventId: string;
  publishedAt: string;
};

export type OutboxEventSource = {
  claimUnpublishedOutboxEvents: (input: ClaimUnpublishedOutboxEventsInput) => Promise<readonly OutboxEvent[]>;
  markOutboxEventPublished: (input: MarkOutboxEventPublishedInput) => Promise<void>;
};
