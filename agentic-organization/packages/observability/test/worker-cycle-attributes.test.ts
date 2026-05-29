import { deepEqual } from "node:assert/strict";
import { describe, test } from "node:test";

import { WorkerFailureEvidenceKey } from "../../domain/src/index.ts";
import { WorkerCycleAttributeKey, buildWorkerCycleAttributes, type WorkerCycleAttributes } from "../src/index.ts";

describe("worker cycle observability attributes", () => {
  test("projects first-failure evidence with a consistent first-failure attribute namespace", () => {
    const attributes: WorkerCycleAttributes = buildWorkerCycleAttributes({
      status: "degraded",
      outboxStatus: "published",
      inboundPulledCount: 0,
      inboundProcessedCount: 0,
      inboundDuplicateCount: 0,
      inboundPayloadConflictCount: 0,
      inboundFailedCount: 0,
      inboundReactionPlanCount: 0,
      reactionPlanStatus: "succeeded",
      reactionPlanClaimedCount: 2,
      reactionPlanSucceededCount: 2,
      reactionPlanFailedCount: 0,
      reactionPlanClaimLostCount: 0,
      failureCount: 1,
      firstFailure: {
        lane: "outbox",
        message: "outbox claim stale",
        stage: "organization-worker",
        evidence: {
          [WorkerFailureEvidenceKey.ClaimId]: "outbox-claim-stale",
          [WorkerFailureEvidenceKey.CommandId]: "cmd-001",
          [WorkerFailureEvidenceKey.CurrentClaimId]: "outbox-claim-001",
          [WorkerFailureEvidenceKey.EventId]: "evt-001",
          [WorkerFailureEvidenceKey.OutboxEventId]: "outbox-001",
          [WorkerFailureEvidenceKey.PublishedAt]: "2026-05-25T20:59:00.000Z",
          [WorkerFailureEvidenceKey.TraceId]: "trace-001",
        },
      },
    });

    deepEqual(attributes, {
      [WorkerCycleAttributeKey.Status]: "degraded",
      [WorkerCycleAttributeKey.OutboxStatus]: "published",
      [WorkerCycleAttributeKey.InboundPulledCount]: 0,
      [WorkerCycleAttributeKey.InboundProcessedCount]: 0,
      [WorkerCycleAttributeKey.InboundDuplicateCount]: 0,
      [WorkerCycleAttributeKey.InboundPayloadConflictCount]: 0,
      [WorkerCycleAttributeKey.InboundFailedCount]: 0,
      [WorkerCycleAttributeKey.InboundReactionPlanCount]: 0,
      [WorkerCycleAttributeKey.ReactionPlanStatus]: "succeeded",
      [WorkerCycleAttributeKey.ReactionPlanClaimedCount]: 2,
      [WorkerCycleAttributeKey.ReactionPlanSucceededCount]: 2,
      [WorkerCycleAttributeKey.ReactionPlanFailedCount]: 0,
      [WorkerCycleAttributeKey.ReactionPlanClaimLostCount]: 0,
      [WorkerCycleAttributeKey.FailureCount]: 1,
      "agentic.worker.failure.first_lane": "outbox",
      "agentic.worker.failure.first_message": "outbox claim stale",
      "agentic.worker.failure.first_stage": "organization-worker",
      "agentic.worker.failure.first_claim_id": "outbox-claim-stale",
      "agentic.worker.failure.first_command_id": "cmd-001",
      "agentic.worker.failure.first_current_claim_id": "outbox-claim-001",
      "agentic.worker.failure.first_event_id": "evt-001",
      "agentic.worker.failure.first_outbox_event_id": "outbox-001",
      "agentic.worker.failure.first_published_at": "2026-05-25T20:59:00.000Z",
      "agentic.worker.failure.first_trace_id": "trace-001",
    });
  });

  test("preserves non-null primitive evidence values in first-failure attributes", () => {
    const attributes = buildWorkerCycleAttributes({
      status: "degraded",
      outboxStatus: "published",
      inboundPulledCount: 0,
      inboundProcessedCount: 0,
      inboundDuplicateCount: 0,
      inboundPayloadConflictCount: 0,
      inboundFailedCount: 0,
      inboundReactionPlanCount: 0,
      reactionPlanStatus: "idle",
      reactionPlanClaimedCount: 0,
      reactionPlanSucceededCount: 0,
      reactionPlanFailedCount: 0,
      reactionPlanClaimLostCount: 0,
      failureCount: 1,
      firstFailure: {
        lane: "outbox",
        message: "outbox claim stale",
        evidence: {
          [WorkerFailureEvidenceKey.ClaimId]: "outbox-claim-stale",
          [WorkerFailureEvidenceKey.CommandId]: 42,
          [WorkerFailureEvidenceKey.CurrentClaimId]: true,
          [WorkerFailureEvidenceKey.EventId]: null,
        },
      },
    });

    deepEqual(attributes[WorkerCycleAttributeKey.FirstFailureClaimId], "outbox-claim-stale");
    deepEqual(attributes[WorkerCycleAttributeKey.FirstFailureCommandId], 42);
    deepEqual(attributes[WorkerCycleAttributeKey.FirstFailureCurrentClaimId], true);
    deepEqual(WorkerCycleAttributeKey.FirstFailureEventId in attributes, false);
  });
});
