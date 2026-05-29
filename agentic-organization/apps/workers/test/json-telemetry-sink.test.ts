import { deepEqual } from "node:assert/strict";
import { describe, test } from "node:test";

import { WorkerRuntimeTelemetryEventName } from "../src/index.ts";
import { OutboxPublishOutcomeStatus } from "../../../packages/messaging/src/index.ts";
import { ReactionPlanExecutionStatus } from "../../../packages/runtime/src/index.ts";
import { WorkerCycleStatus } from "../../../packages/workers/src/index.ts";
import { createJsonWorkerTelemetrySink } from "../src/adapters/json-worker-telemetry-sink.ts";

describe("JSON worker telemetry sink", () => {
  test("writes structured runtime telemetry with stable event and attribute fields", async () => {
    const writer = createRecordingJsonLineWriter();
    const sink = createJsonWorkerTelemetrySink({
      writer,
      now: () => "2026-05-27T00:00:00.000Z",
    });

    await sink.record({
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
        "agentic.worker.reaction_plan.status": ReactionPlanExecutionStatus.Idle,
        "agentic.worker.reaction_plan.claimed_count": 0,
        "agentic.worker.reaction_plan.succeeded_count": 0,
        "agentic.worker.reaction_plan.failed_count": 0,
        "agentic.worker.reaction_plan.claim_lost_count": 0,
        "agentic.worker.failure_count": 0,
      },
    });

    deepEqual(writer.records, [
      {
        timestamp: "2026-05-27T00:00:00.000Z",
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
          "agentic.worker.reaction_plan.status": ReactionPlanExecutionStatus.Idle,
          "agentic.worker.reaction_plan.claimed_count": 0,
          "agentic.worker.reaction_plan.succeeded_count": 0,
          "agentic.worker.reaction_plan.failed_count": 0,
          "agentic.worker.reaction_plan.claim_lost_count": 0,
          "agentic.worker.failure_count": 0,
        },
      },
    ]);
  });
});

function createRecordingJsonLineWriter(): {
  records: unknown[];
  write: (record: unknown) => Promise<void>;
} {
  const records: unknown[] = [];

  return {
    records,
    write: async (record) => {
      records.push(record);
    },
  };
}
