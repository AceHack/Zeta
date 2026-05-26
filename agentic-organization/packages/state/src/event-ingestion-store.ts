import type { ReactionPlanAction, ReactionPlanStatus } from "../../domain/src/index.ts";

export const InboundEventConsumerName = {
  V0AutomationPlanner: "v0_automation_planner",
} as const;

export type InboundEventConsumerName = (typeof InboundEventConsumerName)[keyof typeof InboundEventConsumerName];

export const EventIngestionOutcomeStatus = {
  Duplicate: "duplicate",
  PayloadConflict: "payload_conflict",
  Processed: "processed",
} as const;

export type EventIngestionOutcomeStatus =
  (typeof EventIngestionOutcomeStatus)[keyof typeof EventIngestionOutcomeStatus];

export type InboxReceiptLookup = {
  eventId: string;
  consumerName: InboundEventConsumerName;
};

export type InboxReceiptRecord = InboxReceiptLookup & {
  firstSeenAt: string;
  payloadHash: string;
  processedAt?: string;
  result?: EventIngestionOutcomeStatus;
};

export type ReactionPlanRecord = {
  reactionPlanId: string;
  consumerName: InboundEventConsumerName;
  createdAt: string;
  status: ReactionPlanStatus;
  action: ReactionPlanAction;
};

export type RecordEventProcessingOutcomeInput = {
  receipt: InboxReceiptRecord;
  reactionPlans: readonly ReactionPlanRecord[];
  processedAt: string;
  result: EventIngestionOutcomeStatus;
};

export type RecordEventProcessingOutcomeResult = {
  status: EventIngestionOutcomeStatus;
  reactionPlans: readonly ReactionPlanRecord[];
};

export type EventIngestionStore = {
  findInboxReceipt: (lookup: InboxReceiptLookup) => Promise<InboxReceiptRecord | undefined>;
  recordEventProcessingOutcome: (
    input: RecordEventProcessingOutcomeInput,
  ) => Promise<RecordEventProcessingOutcomeResult>;
};

export type InMemoryEventIngestionStoreSnapshot = {
  readonly inboxReceipts: readonly InboxReceiptRecord[];
  readonly reactionPlans: readonly ReactionPlanRecord[];
};

export type InMemoryEventIngestionStore = EventIngestionStore & {
  readonly snapshot: InMemoryEventIngestionStoreSnapshot;
};

export function createInMemoryEventIngestionStore(): InMemoryEventIngestionStore {
  const inboxReceipts = new Map<string, InboxReceiptRecord>();
  const reactionPlans: ReactionPlanRecord[] = [];

  return {
    get snapshot() {
      return {
        inboxReceipts: [...inboxReceipts.values()],
        reactionPlans,
      };
    },
    findInboxReceipt: async (lookup) => inboxReceipts.get(createInboxReceiptKey(lookup)),
    recordEventProcessingOutcome: async (input) => {
      inboxReceipts.set(createInboxReceiptKey(input.receipt), {
        ...input.receipt,
        processedAt: input.processedAt,
        result: input.result,
      });
      reactionPlans.push(...input.reactionPlans);

      return {
        status: input.result,
        reactionPlans: input.reactionPlans,
      };
    },
  };
}

function createInboxReceiptKey(input: InboxReceiptLookup): string {
  return `${input.consumerName}:${input.eventId}`;
}
