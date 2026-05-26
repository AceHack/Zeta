import { equal } from "node:assert/strict";
import { describe, test } from "node:test";

import { OutboxPublishOutcomeStatus } from "../../../packages/messaging/src/index.ts";
import type { NatsJetStreamConsumeBatchResult } from "../../../packages/messaging-nats/src/index.ts";
import { WorkerCycleStatus, type WorkerCycleResult } from "../../../packages/workers/src/index.ts";
import { WorkerRuntimeStatus, composeWorkerRuntime, type WorkerRuntimeTelemetrySink } from "../src/index.ts";

describe("worker runtime composition", () => {
  test("creates a runnable worker runtime from parsed config and ports", async () => {
    const runtime = composeWorkerRuntime({
      config: {
        environment: "dev",
        organizationId: "org-lfg",
        natsStreamName: "agentic-org-events",
        natsDurableName: "agentic-org-v0-automation-planner",
        natsInboundBatchSize: 25,
      },
      ports: {
        organizationWorkerHost: {
          runOnce: async () => createWorkedWorkerCycle(),
        },
        natsEventConsumer: {
          processNextBatch: async () => createProcessedNatsBatch(),
        },
        telemetrySink: createNoopTelemetrySink(),
      },
    });

    const result = await runtime.runOnce();

    equal(result.status, WorkerRuntimeStatus.Healthy);
  });
});

function createWorkedWorkerCycle(): WorkerCycleResult {
  return {
    status: WorkerCycleStatus.Worked,
    outbox: {
      status: OutboxPublishOutcomeStatus.Published,
      attemptedCount: 1,
      publishedOutboxEventIds: ["outbox-001"],
    },
    inbound: {
      pulledCount: 0,
      processedCount: 0,
      duplicateCount: 0,
      payloadConflictCount: 0,
      failedCount: 0,
      reactionPlanCount: 0,
    },
    failures: [],
  };
}

function createProcessedNatsBatch(): NatsJetStreamConsumeBatchResult {
  return {
    receivedCount: 0,
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

function createNoopTelemetrySink(): WorkerRuntimeTelemetrySink {
  return {
    record: async () => undefined,
  };
}
