import type { OutboxEvent } from "../../domain/src/index.ts";

export type ClaimUnpublishedOutboxEventsInput = {
  batchSize: number;
  claimId: string;
};

export type MarkOutboxEventPublishedInput = {
  claimId: string;
  outboxEventId: string;
  publishedAt: string;
};

export type ClaimedOutboxEvent = OutboxEvent & {
  claimId: string;
};

export type OutboxEventSource = {
  claimUnpublishedOutboxEvents: (input: ClaimUnpublishedOutboxEventsInput) => Promise<readonly ClaimedOutboxEvent[]>;
  markOutboxEventPublished: (input: MarkOutboxEventPublishedInput) => Promise<void>;
};
