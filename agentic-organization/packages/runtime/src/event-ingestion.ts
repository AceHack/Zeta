import type { AgenticEventEnvelope } from "../../domain/src/index.ts";
import { ReactionPlanStatus } from "../../domain/src/index.ts";
import {
  EventIngestionOutcomeStatus,
  type EventIngestionStore,
  type InboundEventConsumerName,
  type InboxReceiptLookup,
  type InboxReceiptRecord,
  type ReactionPlanRecord,
} from "../../state/src/index.ts";
import type { ReactionPlanAction } from "./reaction-plan.ts";

export type EventRuleEvaluator = (envelope: AgenticEventEnvelope) => readonly ReactionPlanAction[];

export type EventPayloadHashCalculator = (envelope: AgenticEventEnvelope) => string;

export type CreateEventIngestionProcessorInput = {
  store: EventIngestionStore;
  evaluateRules: EventRuleEvaluator;
  consumerName: InboundEventConsumerName;
  calculatePayloadHash: EventPayloadHashCalculator;
  now: () => string;
  createId: (prefix: string) => string;
};

export type IngestEventInput = {
  envelope: AgenticEventEnvelope;
  traceparent?: string;
};

export type EventIngestionResult = {
  status: EventIngestionOutcomeStatus;
  reactionPlans: readonly ReactionPlanRecord[];
};

export type EventIngestionProcessor = {
  ingest: (input: IngestEventInput) => Promise<EventIngestionResult>;
};

export function createEventIngestionProcessor(input: CreateEventIngestionProcessorInput): EventIngestionProcessor {
  return {
    ingest: async ({ envelope, traceparent }) => {
      const lookup: InboxReceiptLookup = {
        eventId: envelope.eventId,
        consumerName: input.consumerName,
      };
      const existingReceipt = await input.store.findInboxReceipt(lookup);
      const payloadHash = input.calculatePayloadHash(envelope);

      if (existingReceipt !== undefined) {
        if (existingReceipt.payloadHash !== payloadHash) {
          return {
            status: EventIngestionOutcomeStatus.PayloadConflict,
            reactionPlans: [],
          };
        }

        if (isCompletedReceipt(existingReceipt)) {
          return {
            status: EventIngestionOutcomeStatus.Duplicate,
            reactionPlans: [],
          };
        }
      }

      const observedAt = input.now();
      const receipt: InboxReceiptRecord = {
        ...lookup,
        firstSeenAt: existingReceipt?.firstSeenAt ?? observedAt,
        payloadHash,
      };

      const reactionPlans = input.evaluateRules(envelope).map((action) => ({
        reactionPlanId: input.createId("reaction-plan"),
        consumerName: input.consumerName,
        createdAt: observedAt,
        status: ReactionPlanStatus.Planned,
        ...createOptionalTraceparent(traceparent),
        action,
      }));

      const persistenceResult = await input.store.recordEventProcessingOutcome({
        receipt,
        reactionPlans,
        processedAt: observedAt,
        result: EventIngestionOutcomeStatus.Processed,
      });

      return {
        status: persistenceResult.status,
        reactionPlans: persistenceResult.reactionPlans,
      };
    },
  };
}

function createOptionalTraceparent(traceparent: string | undefined): { traceparent?: string } {
  return traceparent === undefined ? {} : { traceparent };
}

function isCompletedReceipt(receipt: InboxReceiptRecord): boolean {
  return receipt.processedAt !== undefined && receipt.result !== undefined;
}
