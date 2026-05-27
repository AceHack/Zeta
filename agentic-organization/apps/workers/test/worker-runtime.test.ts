import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import { OutboxPublishOutcomeStatus } from "../../../packages/messaging/src/index.ts";
import { createOutboxPublishFailureEvidence } from "../../../packages/domain/src/index.ts";
import type { NatsJetStreamConsumeBatchResult } from "../../../packages/messaging-nats/src/index.ts";
import { WorkerCycleStatus, type WorkerCycleResult } from "../../../packages/workers/src/index.ts";
import {
  WorkerRuntimeFailureStage,
  WorkerRuntimeConfigError,
  WorkerRuntimeConfigErrorCode,
  WorkerRuntimeStatus,
  WorkerRuntimeTelemetryEventName,
  createWorkerRuntime,
  type WorkerRuntimeTelemetrySink,
} from "../src/index.ts";

describe("worker runtime composition host", () => {
  test("runs worker and NATS consumer loops with configured telemetry", async () => {
    const organizationWorkerHost = createRecordingOrganizationWorkerHost(createWorkedWorkerCycle());
    const natsEventConsumer = createRecordingNatsEventConsumer(createProcessedNatsBatch());
    const telemetrySink = createRecordingTelemetrySink();
    const runtime = createWorkerRuntime({
      config: createRuntimeConfig(),
      organizationWorkerHost,
      natsEventConsumer,
      telemetrySink,
    });

    const result = await runtime.runOnce();

    equal(result.status, WorkerRuntimeStatus.Healthy);
    equal(organizationWorkerHost.runCount, 1);
    deepEqual(natsEventConsumer.batchSizes, [50]);
    deepEqual(telemetrySink.records, [
      {
        eventName: WorkerRuntimeTelemetryEventName.WorkerCycleCompleted,
        attributes: {
          "agentic.worker.cycle.status": WorkerCycleStatus.Worked,
          "agentic.worker.outbox.status": OutboxPublishOutcomeStatus.Published,
          "agentic.worker.inbound.pulled_count": 0,
          "agentic.worker.inbound.processed_count": 0,
          "agentic.worker.inbound.duplicate_count": 0,
          "agentic.worker.inbound.payload_conflict_count": 0,
          "agentic.worker.inbound.failed_count": 0,
          "agentic.worker.inbound.reaction_plan_count": 0,
          "agentic.worker.failure_count": 0,
        },
      },
      {
        eventName: WorkerRuntimeTelemetryEventName.NatsConsumerBatchProcessed,
        attributes: {
          "messaging.system": "nats",
          "messaging.nats.stream": "agentic-org-events",
          "messaging.nats.consumer": "agentic-org-v0-automation-planner",
          "agentic.nats.consumer.received_count": 2,
          "agentic.nats.consumer.processed_count": 2,
          "agentic.nats.consumer.duplicate_count": 0,
          "agentic.nats.consumer.payload_conflict_count": 0,
          "agentic.nats.consumer.invalid_count": 0,
          "agentic.nats.consumer.failed_count": 0,
          "agentic.nats.consumer.acknowledged_count": 2,
          "agentic.nats.consumer.negative_acknowledged_count": 0,
          "agentic.nats.consumer.terminated_count": 0,
          "agentic.nats.consumer.dead_lettered_count": 0,
        },
      },
    ]);
  });

  test("keeps the NATS loop running when the worker loop throws", async () => {
    const natsEventConsumer = createRecordingNatsEventConsumer(createProcessedNatsBatch());
    const runtime = createWorkerRuntime({
      config: createRuntimeConfig(),
      organizationWorkerHost: createFailingOrganizationWorkerHost("outbox loop failed"),
      natsEventConsumer,
      telemetrySink: createRecordingTelemetrySink(),
    });

    const result = await runtime.runOnce();

    equal(result.status, WorkerRuntimeStatus.Degraded);
    deepEqual(natsEventConsumer.batchSizes, [50]);
    deepEqual(result.failures, [
      {
        stage: WorkerRuntimeFailureStage.OrganizationWorker,
        message: "outbox loop failed",
      },
    ]);
  });

  test("projects first worker-cycle failure evidence into telemetry attributes", async () => {
    const telemetrySink = createRecordingTelemetrySink();
    const runtime = createWorkerRuntime({
      config: createRuntimeConfig(),
      organizationWorkerHost: createRecordingOrganizationWorkerHost({
        ...createWorkedWorkerCycle(),
        status: WorkerCycleStatus.Degraded,
        failures: [
          {
            lane: "outbox",
            message: "outbox claim stale",
            evidence: createOutboxPublishFailureEvidence({
              claimId: "outbox-claim-stale",
              commandId: "cmd-001",
              currentClaimId: "outbox-claim-001",
              eventId: "evt-001",
              outboxEventId: "outbox-001",
              publishedAt: "2026-05-25T20:59:00.000Z",
              traceId: "trace-001",
            }),
          },
        ],
      }),
      natsEventConsumer: createRecordingNatsEventConsumer(createProcessedNatsBatch()),
      telemetrySink,
    });

    const result = await runtime.runOnce();

    equal(result.status, WorkerRuntimeStatus.Degraded);
    deepEqual(telemetrySink.records[0]?.attributes, {
      "agentic.worker.cycle.status": WorkerCycleStatus.Degraded,
      "agentic.worker.outbox.status": OutboxPublishOutcomeStatus.Published,
      "agentic.worker.inbound.pulled_count": 0,
      "agentic.worker.inbound.processed_count": 0,
      "agentic.worker.inbound.duplicate_count": 0,
      "agentic.worker.inbound.payload_conflict_count": 0,
      "agentic.worker.inbound.failed_count": 0,
      "agentic.worker.inbound.reaction_plan_count": 0,
      "agentic.worker.failure_count": 1,
      "agentic.worker.failure.first_lane": "outbox",
      "agentic.worker.failure.first_message": "outbox claim stale",
      "agentic.worker.failure.first_stage": WorkerRuntimeFailureStage.OrganizationWorker,
      "agentic.worker.failure.first_claim_id": "outbox-claim-stale",
      "agentic.worker.failure.first_command_id": "cmd-001",
      "agentic.worker.failure.first_current_claim_id": "outbox-claim-001",
      "agentic.worker.failure.first_event_id": "evt-001",
      "agentic.worker.failure.first_outbox_event_id": "outbox-001",
      "agentic.worker.failure.first_published_at": "2026-05-25T20:59:00.000Z",
      "agentic.worker.failure.first_trace_id": "trace-001",
    });
  });

  test("marks the runtime degraded when NATS consumer reports dead letters", async () => {
    const runtime = createWorkerRuntime({
      config: createRuntimeConfig(),
      organizationWorkerHost: createRecordingOrganizationWorkerHost(createWorkedWorkerCycle()),
      natsEventConsumer: createRecordingNatsEventConsumer({
        ...createProcessedNatsBatch(),
        deadLetteredCount: 1,
        terminatedCount: 1,
      }),
      telemetrySink: createRecordingTelemetrySink(),
    });

    const result = await runtime.runOnce();

    equal(result.status, WorkerRuntimeStatus.Degraded);
  });

  test("keeps successful loop results visible when telemetry fails", async () => {
    const runtime = createWorkerRuntime({
      config: createRuntimeConfig(),
      organizationWorkerHost: createRecordingOrganizationWorkerHost(createWorkedWorkerCycle()),
      natsEventConsumer: createRecordingNatsEventConsumer(createProcessedNatsBatch()),
      telemetrySink: createFailingTelemetrySink("telemetry sink unavailable"),
    });

    const result = await runtime.runOnce();

    equal(result.status, WorkerRuntimeStatus.Degraded);
    equal(result.workerCycle?.status, WorkerCycleStatus.Worked);
    equal(result.natsConsumerBatch?.processedCount, 2);
    deepEqual(result.failures, [
      {
        stage: WorkerRuntimeFailureStage.Telemetry,
        message: "telemetry sink unavailable",
      },
      {
        stage: WorkerRuntimeFailureStage.Telemetry,
        message: "telemetry sink unavailable",
      },
    ]);
  });

  test("marks the runtime degraded when NATS consumer reports non-happy counters", async () => {
    const runtime = createWorkerRuntime({
      config: createRuntimeConfig(),
      organizationWorkerHost: createRecordingOrganizationWorkerHost(createWorkedWorkerCycle()),
      natsEventConsumer: createRecordingNatsEventConsumer({
        ...createProcessedNatsBatch(),
        invalidCount: 1,
      }),
      telemetrySink: createRecordingTelemetrySink(),
    });

    const result = await runtime.runOnce();

    equal(result.status, WorkerRuntimeStatus.Degraded);
  });

  test("rejects invalid process config before loops can start", () => {
    try {
      createWorkerRuntime({
        config: {
          ...createRuntimeConfig(),
          natsInboundBatchSize: 0,
        },
        organizationWorkerHost: createRecordingOrganizationWorkerHost(createWorkedWorkerCycle()),
        natsEventConsumer: createRecordingNatsEventConsumer(createProcessedNatsBatch()),
        telemetrySink: createRecordingTelemetrySink(),
      });
      throw new Error("expected worker runtime config validation to fail");
    } catch (error) {
      equal(error instanceof WorkerRuntimeConfigError, true);
      equal((error as WorkerRuntimeConfigError).code, WorkerRuntimeConfigErrorCode.InvalidNatsInboundBatchSize);
    }
  });
});

function createRuntimeConfig(): {
  environment: string;
  natsInboundBatchSize: number;
  organizationId: string;
  natsStreamName: string;
  natsDurableName: string;
} {
  return {
    environment: "test",
    natsInboundBatchSize: 50,
    organizationId: "org-lfg",
    natsStreamName: "agentic-org-events",
    natsDurableName: "agentic-org-v0-automation-planner",
  };
}

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
    receivedCount: 2,
    processedCount: 2,
    duplicateCount: 0,
    payloadConflictCount: 0,
    invalidCount: 0,
    failedCount: 0,
    acknowledgedCount: 2,
    negativeAcknowledgedCount: 0,
    terminatedCount: 0,
    deadLetteredCount: 0,
  };
}

function createRecordingOrganizationWorkerHost(result: WorkerCycleResult): {
  runCount: number;
  runOnce: () => Promise<WorkerCycleResult>;
} {
  return {
    runCount: 0,
    runOnce: async function runOnce() {
      this.runCount += 1;
      return result;
    },
  };
}

function createFailingOrganizationWorkerHost(message: string): {
  runOnce: () => Promise<WorkerCycleResult>;
} {
  return {
    runOnce: async () => {
      throw new Error(message);
    },
  };
}

function createRecordingNatsEventConsumer(result: NatsJetStreamConsumeBatchResult): {
  batchSizes: number[];
  processNextBatch: (input: { batchSize: number }) => Promise<NatsJetStreamConsumeBatchResult>;
} {
  const batchSizes: number[] = [];

  return {
    batchSizes,
    processNextBatch: async (input) => {
      batchSizes.push(input.batchSize);
      return result;
    },
  };
}

function createRecordingTelemetrySink(): WorkerRuntimeTelemetrySink & {
  records: {
    eventName: WorkerRuntimeTelemetryEventName;
    attributes: Record<string, string | number | boolean>;
  }[];
} {
  const records: {
    eventName: WorkerRuntimeTelemetryEventName;
    attributes: Record<string, string | number | boolean>;
  }[] = [];

  return {
    records,
    record: async (record) => {
      records.push(record);
    },
  };
}

function createFailingTelemetrySink(message: string): WorkerRuntimeTelemetrySink {
  return {
    record: async () => {
      throw new Error(message);
    },
  };
}
