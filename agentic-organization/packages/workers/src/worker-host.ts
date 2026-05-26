import type { AgenticEventEnvelope } from "../../domain/src/index.ts";
import {
  OutboxPublishOutcomeStatus,
  type OutboxPublishBatchResult,
  type OutboxPublisher,
} from "../../messaging/src/index.ts";
import type { EventIngestionProcessor } from "../../runtime/src/index.ts";
import { EventIngestionOutcomeStatus } from "../../state/src/index.ts";

export const WorkerCycleStatus = {
  Degraded: "degraded",
  Idle: "idle",
  Worked: "worked",
} as const;

export type WorkerCycleStatus = (typeof WorkerCycleStatus)[keyof typeof WorkerCycleStatus];

export const WorkerLane = {
  Inbound: "inbound",
  Outbox: "outbox",
} as const;

export type WorkerLane = (typeof WorkerLane)[keyof typeof WorkerLane];

export type PullInboundEventsInput = {
  batchSize: number;
};

export type InboundEventSource = {
  pullNextBatch: (input: PullInboundEventsInput) => Promise<readonly AgenticEventEnvelope[]>;
};

export type WorkerInboundCycleSummary = {
  pulledCount: number;
  processedCount: number;
  duplicateCount: number;
  payloadConflictCount: number;
  failedCount: number;
  reactionPlanCount: number;
};

export type WorkerPortFailure = {
  lane: WorkerLane;
  message: string;
};

export type WorkerCycleResult = {
  status: WorkerCycleStatus;
  outbox: OutboxPublishBatchResult | undefined;
  inbound: WorkerInboundCycleSummary;
  failures: readonly WorkerPortFailure[];
};

export type OrganizationWorkerHost = {
  runOnce: () => Promise<WorkerCycleResult>;
};

export type CreateOrganizationWorkerHostInput = {
  outboxPublisher: OutboxPublisher;
  inboundEventSource: InboundEventSource;
  eventIngestionProcessor: EventIngestionProcessor;
  outboxBatchSize: number;
  inboundBatchSize: number;
};

export function createOrganizationWorkerHost(input: CreateOrganizationWorkerHostInput): OrganizationWorkerHost {
  return {
    runOnce: async () => {
      const failures: WorkerPortFailure[] = [];
      const outbox = await publishOutboxBatch({
        outboxPublisher: input.outboxPublisher,
        batchSize: input.outboxBatchSize,
        failures,
      });
      const inbound = await processInboundBatch({
        inboundEventSource: input.inboundEventSource,
        batchSize: input.inboundBatchSize,
        eventIngestionProcessor: input.eventIngestionProcessor,
        failures,
      });

      return {
        status: resolveWorkerCycleStatus({
          outbox,
          inbound,
          failures,
        }),
        outbox,
        inbound,
        failures,
      };
    },
  };
}

type PublishOutboxBatchInput = {
  outboxPublisher: OutboxPublisher;
  batchSize: number;
  failures: WorkerPortFailure[];
};

async function publishOutboxBatch(input: PublishOutboxBatchInput): Promise<OutboxPublishBatchResult | undefined> {
  try {
    return await input.outboxPublisher.publishNextBatch({
      batchSize: input.batchSize,
    });
  } catch (error) {
    input.failures.push({
      lane: WorkerLane.Outbox,
      message: extractErrorMessage(error),
    });
    return undefined;
  }
}

type ProcessInboundBatchInput = {
  inboundEventSource: InboundEventSource;
  batchSize: number;
  eventIngestionProcessor: EventIngestionProcessor;
  failures: WorkerPortFailure[];
};

async function processInboundBatch(input: ProcessInboundBatchInput): Promise<WorkerInboundCycleSummary> {
  try {
    const envelopes = await input.inboundEventSource.pullNextBatch({
      batchSize: input.batchSize,
    });

    return await ingestInboundBatch({
      envelopes,
      eventIngestionProcessor: input.eventIngestionProcessor,
      failures: input.failures,
    });
  } catch (error) {
    input.failures.push({
      lane: WorkerLane.Inbound,
      message: extractErrorMessage(error),
    });
    return createEmptyInboundCycleSummary(0);
  }
}

type IngestInboundBatchInput = {
  envelopes: readonly AgenticEventEnvelope[];
  eventIngestionProcessor: EventIngestionProcessor;
  failures: WorkerPortFailure[];
};

async function ingestInboundBatch(input: IngestInboundBatchInput): Promise<WorkerInboundCycleSummary> {
  const summary = createEmptyInboundCycleSummary(input.envelopes.length);

  for (const envelope of input.envelopes) {
    try {
      const result = await input.eventIngestionProcessor.ingest({
        envelope,
      });

      if (result.status === EventIngestionOutcomeStatus.Processed) {
        summary.processedCount += 1;
      }

      if (result.status === EventIngestionOutcomeStatus.Duplicate) {
        summary.duplicateCount += 1;
      }

      if (result.status === EventIngestionOutcomeStatus.PayloadConflict) {
        summary.payloadConflictCount += 1;
      }

      summary.reactionPlanCount += result.reactionPlans.length;
    } catch (error) {
      summary.failedCount += 1;
      input.failures.push({
        lane: WorkerLane.Inbound,
        message: extractErrorMessage(error),
      });
    }
  }

  return summary;
}

function createEmptyInboundCycleSummary(pulledCount: number): WorkerInboundCycleSummary {
  return {
    pulledCount,
    processedCount: 0,
    duplicateCount: 0,
    payloadConflictCount: 0,
    failedCount: 0,
    reactionPlanCount: 0,
  };
}

type ResolveWorkerCycleStatusInput = {
  outbox: OutboxPublishBatchResult | undefined;
  inbound: WorkerInboundCycleSummary;
  failures: readonly WorkerPortFailure[];
};

function resolveWorkerCycleStatus(input: ResolveWorkerCycleStatusInput): WorkerCycleStatus {
  if (input.failures.length > 0) {
    return WorkerCycleStatus.Degraded;
  }

  if (input.outbox?.status === OutboxPublishOutcomeStatus.Published || input.inbound.pulledCount > 0) {
    return WorkerCycleStatus.Worked;
  }

  return WorkerCycleStatus.Idle;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
