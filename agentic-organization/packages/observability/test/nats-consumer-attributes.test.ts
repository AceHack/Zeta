import { deepEqual } from "node:assert/strict";
import { describe, test } from "node:test";

import { buildNatsConsumerBatchAttributes } from "../src/index.ts";

describe("NATS consumer batch observability attributes", () => {
  test("projects inbound consumer counts into LGTM-friendly attributes", () => {
    deepEqual(
      buildNatsConsumerBatchAttributes({
        durableName: "agentic-org-v0-automation-planner",
        streamName: "agentic-org-events",
        receivedCount: 6,
        processedCount: 2,
        duplicateCount: 1,
        payloadConflictCount: 1,
        invalidCount: 1,
        failedCount: 1,
        acknowledgedCount: 3,
        negativeAcknowledgedCount: 1,
        terminatedCount: 2,
        deadLetteredCount: 2,
      }),
      {
        "messaging.system": "nats",
        "messaging.nats.stream": "agentic-org-events",
        "messaging.nats.consumer": "agentic-org-v0-automation-planner",
        "agentic.nats.consumer.received_count": 6,
        "agentic.nats.consumer.processed_count": 2,
        "agentic.nats.consumer.duplicate_count": 1,
        "agentic.nats.consumer.payload_conflict_count": 1,
        "agentic.nats.consumer.invalid_count": 1,
        "agentic.nats.consumer.failed_count": 1,
        "agentic.nats.consumer.acknowledged_count": 3,
        "agentic.nats.consumer.negative_acknowledged_count": 1,
        "agentic.nats.consumer.terminated_count": 2,
        "agentic.nats.consumer.dead_lettered_count": 2,
      },
    );
  });
});
