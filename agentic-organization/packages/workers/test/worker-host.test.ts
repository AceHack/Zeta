import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AgenticAggregateType,
  AgenticEventType,
  SupervisorChainLevel,
  createOutboxPublishFailureEvidence,
  createAgenticEventEnvelope,
  type AgenticEventEnvelope,
  type OutboxEvent,
} from "../../domain/src/index.ts";
import {
  OutboxPublishOutcomeStatus,
  createOutboxPublisher,
  resolveAgenticMessagingDomain,
  type EventPublication,
  type OutboxPublishBatchResult,
  type OutboxPublisher,
} from "../../messaging/src/index.ts";
import {
  ReactionPlanExecutionStatus,
  createEventIngestionProcessor,
  evaluateV0AutomationRules,
  type ExecuteReactionPlansResult,
  type ReactionPlanExecutor,
} from "../../runtime/src/index.ts";
import {
  EventIngestionOutcomeStatus,
  InboundEventConsumerName,
  createInMemoryEventIngestionStore,
  type ReactionPlanRecord,
} from "../../state/src/index.ts";
import { WorkerCycleStatus, WorkerLane, createOrganizationWorkerHost, type InboundEventSource } from "../src/index.ts";

const UnknownWorkerFailureEvidenceKey = "unexpectedDiagnostic";

describe("organization worker host", () => {
  test("runs one bounded outbox and inbound ingestion cycle", async () => {
    const inboundEnvelope = createInboundEnvelope();
    const outboxPublisher = createRecordingOutboxPublisher({
      status: OutboxPublishOutcomeStatus.Published,
      attemptedCount: 1,
      publishedOutboxEventIds: ["outbox-001"],
    });
    const inboundEventSource = createRecordingInboundEventSource([inboundEnvelope]);
    const eventIngestionProcessor = createRecordingEventIngestionProcessor();
    const workerHost = createOrganizationWorkerHost({
      outboxPublisher,
      inboundEventSource,
      eventIngestionProcessor,
      reactionPlanExecutor: createReactionPlanExecutor(),
      outboxBatchSize: 25,
      inboundBatchSize: 10,
    });

    const result = await workerHost.runOnce();

    deepEqual(outboxPublisher.batchSizes, [25]);
    deepEqual(inboundEventSource.batchSizes, [10]);
    deepEqual(eventIngestionProcessor.ingestedEventIds, ["evt-inbound-001"]);
    deepEqual(result, {
      status: WorkerCycleStatus.Worked,
      outbox: {
        status: OutboxPublishOutcomeStatus.Published,
        attemptedCount: 1,
        publishedOutboxEventIds: ["outbox-001"],
      },
      inbound: {
        pulledCount: 1,
        processedCount: 1,
        duplicateCount: 0,
        payloadConflictCount: 0,
        failedCount: 0,
        reactionPlanCount: 0,
      },
      reactionPlans: createReactionPlanExecutionResult(),
      failures: [],
    });
  });

  test("composes outbox publishing and inbound ingestion without live NATS", async () => {
    const publishedEvents: EventPublication[] = [];
    const eventIngestionStore = createInMemoryEventIngestionStore();
    const outboxEvent = createOutboxEvent(createInboundEnvelope("evt-composed-001", createSupervisorSignalPayload()));
    const workerHost = createOrganizationWorkerHost({
      outboxPublisher: createOutboxPublisher({
        outboxSource: createSingleEventOutboxSource(outboxEvent),
        eventPublisher: {
          publish: async (publication) => {
            publishedEvents.push(publication);
          },
        },
        environment: "test",
        resolveDomain: resolveAgenticMessagingDomain,
        createId: () => "outbox-claim-001",
        now: () => "2026-05-25T20:05:00.000Z",
      }),
      inboundEventSource: {
        pullNextBatch: async () => publishedEvents.map((publication) => publication.outboxEvent.envelope),
      },
      eventIngestionProcessor: createEventIngestionProcessor({
        store: eventIngestionStore,
        evaluateRules: evaluateV0AutomationRules,
        consumerName: InboundEventConsumerName.V0AutomationPlanner,
        calculatePayloadHash: (envelope) => JSON.stringify(envelope.payload),
        now: () => "2026-05-25T20:06:00.000Z",
        createId: (prefix) => `${prefix}-001`,
      }),
      reactionPlanExecutor: createReactionPlanExecutor({
        status: ReactionPlanExecutionStatus.Succeeded,
        claimedCount: 1,
        succeededCount: 1,
        failedCount: 0,
        claimLostCount: 0,
      }),
      outboxBatchSize: 25,
      inboundBatchSize: 10,
    });

    const result = await workerHost.runOnce();

    equal(result.status, WorkerCycleStatus.Worked);
    equal(publishedEvents.length, 1);
    equal(result.outbox?.status, OutboxPublishOutcomeStatus.Published);
    equal(result.inbound.processedCount, 1);
    equal(result.inbound.reactionPlanCount, 1);
    equal(result.reactionPlans.succeededCount, 1);
    equal(eventIngestionStore.snapshot.inboxReceipts.length, 1);
    equal(eventIngestionStore.snapshot.reactionPlans.length, 1);
  });

  test("runs reaction-plan execution as a first-class worker lane", async () => {
    const reactionPlanExecutor = createReactionPlanExecutor({
      status: ReactionPlanExecutionStatus.Succeeded,
      claimedCount: 2,
      succeededCount: 2,
      failedCount: 0,
      claimLostCount: 0,
    });
    const workerHost = createOrganizationWorkerHost({
      outboxPublisher: createRecordingOutboxPublisher({
        status: OutboxPublishOutcomeStatus.Empty,
        attemptedCount: 0,
        publishedOutboxEventIds: [],
      }),
      inboundEventSource: createRecordingInboundEventSource([]),
      eventIngestionProcessor: createRecordingEventIngestionProcessor(),
      reactionPlanExecutor,
      outboxBatchSize: 25,
      inboundBatchSize: 10,
    });

    const result = await workerHost.runOnce();

    equal(result.status, WorkerCycleStatus.Worked);
    equal(reactionPlanExecutor.runCount, 1);
    deepEqual(result.reactionPlans, {
      status: ReactionPlanExecutionStatus.Succeeded,
      claimedCount: 2,
      succeededCount: 2,
      failedCount: 0,
      claimLostCount: 0,
    });
  });

  test("reports idle when no outbox or inbound work is available", async () => {
    const workerHost = createOrganizationWorkerHost({
      outboxPublisher: createRecordingOutboxPublisher({
        status: OutboxPublishOutcomeStatus.Empty,
        attemptedCount: 0,
        publishedOutboxEventIds: [],
      }),
      inboundEventSource: createRecordingInboundEventSource([]),
      eventIngestionProcessor: createRecordingEventIngestionProcessor(),
      reactionPlanExecutor: createReactionPlanExecutor(),
      outboxBatchSize: 25,
      inboundBatchSize: 10,
    });

    const result = await workerHost.runOnce();

    equal(result.status, WorkerCycleStatus.Idle);
    equal(result.inbound.pulledCount, 0);
    equal(result.outbox?.status, OutboxPublishOutcomeStatus.Empty);
  });

  test("summarizes duplicate and payload-conflict inbound outcomes without hiding them", async () => {
    const eventIngestionProcessor = createRecordingEventIngestionProcessor([
      EventIngestionOutcomeStatus.Duplicate,
      EventIngestionOutcomeStatus.PayloadConflict,
    ]);
    const workerHost = createOrganizationWorkerHost({
      outboxPublisher: createRecordingOutboxPublisher({
        status: OutboxPublishOutcomeStatus.Empty,
        attemptedCount: 0,
        publishedOutboxEventIds: [],
      }),
      inboundEventSource: createRecordingInboundEventSource([
        createInboundEnvelope("evt-duplicate-001"),
        createInboundEnvelope("evt-conflict-001"),
      ]),
      eventIngestionProcessor,
      reactionPlanExecutor: createReactionPlanExecutor(),
      outboxBatchSize: 25,
      inboundBatchSize: 10,
    });

    const result = await workerHost.runOnce();

    deepEqual(eventIngestionProcessor.ingestedEventIds, ["evt-duplicate-001", "evt-conflict-001"]);
    deepEqual(result.inbound, {
      pulledCount: 2,
      processedCount: 0,
      duplicateCount: 1,
      payloadConflictCount: 1,
      failedCount: 0,
      reactionPlanCount: 0,
    });
    equal(result.status, WorkerCycleStatus.Worked);
  });

  test("continues inbound ingestion when the outbox lane fails", async () => {
    const inboundEnvelope = createInboundEnvelope("evt-after-outbox-failure-001");
    const eventIngestionProcessor = createRecordingEventIngestionProcessor();
    const workerHost = createOrganizationWorkerHost({
      outboxPublisher: createFailingOutboxPublisher("outbox unavailable"),
      inboundEventSource: createRecordingInboundEventSource([inboundEnvelope]),
      eventIngestionProcessor,
      reactionPlanExecutor: createReactionPlanExecutor(),
      outboxBatchSize: 25,
      inboundBatchSize: 10,
    });

    const result = await workerHost.runOnce();

    equal(result.status, WorkerCycleStatus.Degraded);
    deepEqual(eventIngestionProcessor.ingestedEventIds, ["evt-after-outbox-failure-001"]);
    deepEqual(result.inbound, {
      pulledCount: 1,
      processedCount: 1,
      duplicateCount: 0,
      payloadConflictCount: 0,
      failedCount: 0,
      reactionPlanCount: 0,
    });
    deepEqual(result.failures, [
      {
        lane: WorkerLane.Outbox,
        message: "outbox unavailable",
      },
    ]);
  });

  test("continues the inbound batch when one event fails ingestion", async () => {
    const eventIngestionProcessor = createRecordingEventIngestionProcessor(
      [EventIngestionOutcomeStatus.Processed],
      "ingestion failed",
    );
    const workerHost = createOrganizationWorkerHost({
      outboxPublisher: createRecordingOutboxPublisher({
        status: OutboxPublishOutcomeStatus.Empty,
        attemptedCount: 0,
        publishedOutboxEventIds: [],
      }),
      inboundEventSource: createRecordingInboundEventSource([
        createInboundEnvelope("evt-ingest-ok-001"),
        createInboundEnvelope("evt-ingest-fails-001"),
        createInboundEnvelope("evt-ingest-ok-002"),
      ]),
      eventIngestionProcessor,
      reactionPlanExecutor: createReactionPlanExecutor(),
      outboxBatchSize: 25,
      inboundBatchSize: 10,
    });

    const result = await workerHost.runOnce();

    equal(result.status, WorkerCycleStatus.Degraded);
    deepEqual(eventIngestionProcessor.ingestedEventIds, [
      "evt-ingest-ok-001",
      "evt-ingest-fails-001",
      "evt-ingest-ok-002",
    ]);
    deepEqual(result.inbound, {
      pulledCount: 3,
      processedCount: 2,
      duplicateCount: 0,
      payloadConflictCount: 0,
      failedCount: 1,
      reactionPlanCount: 0,
    });
    deepEqual(result.failures, [
      {
        lane: WorkerLane.Inbound,
        message: "ingestion failed",
      },
    ]);
  });

  test("preserves structured outbox failure evidence for runtime telemetry and diagnosis", async () => {
    const workerHost = createOrganizationWorkerHost({
      outboxPublisher: createFailingOutboxPublisher("outbox claim stale", {
        ...createOutboxPublishFailureEvidence({
          claimId: "outbox-claim-stale",
          commandId: "cmd-001",
          currentClaimId: "outbox-claim-001",
          eventId: "evt-001",
          outboxEventId: "outbox-001",
          publishedAt: "2026-05-25T20:59:00.000Z",
          traceId: "trace-001",
        }),
      }),
      inboundEventSource: createRecordingInboundEventSource([]),
      eventIngestionProcessor: createRecordingEventIngestionProcessor(),
      reactionPlanExecutor: createReactionPlanExecutor(),
      outboxBatchSize: 25,
      inboundBatchSize: 10,
    });

    const result = await workerHost.runOnce();

    equal(result.status, WorkerCycleStatus.Degraded);
    deepEqual(result.failures, [
      {
        lane: WorkerLane.Outbox,
        message: "outbox claim stale",
        evidence: {
          claimId: "outbox-claim-stale",
          commandId: "cmd-001",
          currentClaimId: "outbox-claim-001",
          eventId: "evt-001",
          outboxEventId: "outbox-001",
          publishedAt: "2026-05-25T20:59:00.000Z",
          traceId: "trace-001",
        },
      },
    ]);
  });

  test("drops structured failure evidence keys outside the domain contract", async () => {
    const workerHost = createOrganizationWorkerHost({
      outboxPublisher: createFailingOutboxPublisher("outbox failed with unknown evidence", {
        ...createOutboxPublishFailureEvidence({
          claimId: "outbox-claim-unknown",
          outboxEventId: "outbox-unknown-001",
        }),
        [UnknownWorkerFailureEvidenceKey]: "must not enter telemetry",
      }),
      inboundEventSource: createRecordingInboundEventSource([]),
      eventIngestionProcessor: createRecordingEventIngestionProcessor(),
      reactionPlanExecutor: createReactionPlanExecutor(),
      outboxBatchSize: 25,
      inboundBatchSize: 10,
    });

    const result = await workerHost.runOnce();

    deepEqual(result.failures, [
      {
        lane: WorkerLane.Outbox,
        message: "outbox failed with unknown evidence",
        evidence: {
          claimId: "outbox-claim-unknown",
          commandId: null,
          currentClaimId: null,
          eventId: null,
          outboxEventId: "outbox-unknown-001",
          publishedAt: null,
          traceId: null,
        },
      },
    ]);
  });

  test("omits structured failure evidence when no domain evidence keys are present", async () => {
    const workerHost = createOrganizationWorkerHost({
      outboxPublisher: createFailingOutboxPublisher("outbox failed with only unknown evidence", {
        [UnknownWorkerFailureEvidenceKey]: "must not enter telemetry",
      }),
      inboundEventSource: createRecordingInboundEventSource([]),
      eventIngestionProcessor: createRecordingEventIngestionProcessor(),
      reactionPlanExecutor: createReactionPlanExecutor(),
      outboxBatchSize: 25,
      inboundBatchSize: 10,
    });

    const result = await workerHost.runOnce();

    deepEqual(result.failures, [
      {
        lane: WorkerLane.Outbox,
        message: "outbox failed with only unknown evidence",
      },
    ]);
  });
});

type RecordingOutboxPublisher = OutboxPublisher & {
  batchSizes: number[];
};

type RecordingReactionPlanExecutor = ReactionPlanExecutor & {
  readonly runCount: number;
};

function createReactionPlanExecutor(
  result: ExecuteReactionPlansResult = createReactionPlanExecutionResult(),
): RecordingReactionPlanExecutor {
  let runCount = 0;

  return {
    get runCount() {
      return runCount;
    },
    executeNextBatch: async () => {
      runCount += 1;
      return result;
    },
  };
}

function createReactionPlanExecutionResult(): ExecuteReactionPlansResult {
  return {
    status: ReactionPlanExecutionStatus.Idle,
    claimedCount: 0,
    succeededCount: 0,
    failedCount: 0,
    claimLostCount: 0,
  };
}

function createRecordingOutboxPublisher(result: OutboxPublishBatchResult): RecordingOutboxPublisher {
  const batchSizes: number[] = [];

  return {
    batchSizes,
    publishNextBatch: async (input) => {
      batchSizes.push(input.batchSize);
      return result;
    },
  };
}

function createFailingOutboxPublisher(
  message: string,
  evidence?: unknown,
): OutboxPublisher {
  return {
    publishNextBatch: async () => {
      const error = new Error(message) as Error & {
        evidence?: unknown;
      };
      if (evidence !== undefined) {
        error.evidence = evidence;
      }
      throw error;
    },
  };
}

type RecordingInboundEventSource = InboundEventSource & {
  batchSizes: number[];
};

function createRecordingInboundEventSource(envelopes: readonly AgenticEventEnvelope[]): RecordingInboundEventSource {
  const batchSizes: number[] = [];

  return {
    batchSizes,
    pullNextBatch: async (input) => {
      batchSizes.push(input.batchSize);
      return envelopes;
    },
  };
}

type RecordingEventIngestionProcessor = {
  ingestedEventIds: string[];
  ingest: (input: { envelope: AgenticEventEnvelope }) => Promise<{
    status: EventIngestionOutcomeStatus;
    reactionPlans: readonly ReactionPlanRecord[];
  }>;
};

function createRecordingEventIngestionProcessor(
  statuses: readonly EventIngestionOutcomeStatus[] = [EventIngestionOutcomeStatus.Processed],
  failureMessage?: string,
): RecordingEventIngestionProcessor {
  const ingestedEventIds: string[] = [];
  let currentIndex = 0;

  return {
    ingestedEventIds,
    ingest: async (input) => {
      ingestedEventIds.push(input.envelope.eventId);
      if (failureMessage !== undefined && currentIndex === 1) {
        currentIndex += 1;
        throw new Error(failureMessage);
      }

      const status = statuses[currentIndex] ?? EventIngestionOutcomeStatus.Processed;
      currentIndex += 1;

      return {
        status,
        reactionPlans: [],
      };
    },
  };
}

function createSingleEventOutboxSource(outboxEvent: OutboxEvent): {
  claimUnpublishedOutboxEvents: (input: { claimId: string }) => Promise<readonly (OutboxEvent & { claimId: string })[]>;
  markOutboxEventPublished: () => Promise<void>;
} {
  let claimed = false;

  return {
    claimUnpublishedOutboxEvents: async (input) => {
      if (claimed) {
        return [];
      }

      claimed = true;
      return [
        {
          ...outboxEvent,
          claimId: input.claimId,
        },
      ];
    },
    markOutboxEventPublished: async () => {
      outboxEvent.publishedAt = "2026-05-25T20:05:00.000Z";
    },
  };
}

function createOutboxEvent(envelope: AgenticEventEnvelope): OutboxEvent {
  return {
    outboxEventId: "outbox-composed-001",
    envelope,
  };
}

function createSupervisorSignalPayload(): Record<string, unknown> {
  return {
    targetHatAssignmentId: "hat-assignment-manager-001",
    targetLevel: SupervisorChainLevel.Manager,
    title: "Blocked on scoped NATS publisher",
  };
}

function createInboundEnvelope(
  eventId = "evt-inbound-001",
  payload: Record<string, unknown> = {
    title: "Blocked on scoped NATS publisher",
  },
): AgenticEventEnvelope {
  return createAgenticEventEnvelope({
    eventId,
    eventType: AgenticEventType.SupervisorSignalSent,
    occurredAt: "2026-05-25T20:00:00.000Z",
    actor: {
      agentId: "agent-developer-001",
      hatAssignmentId: "hat-assignment-dev-001",
    },
    scope: {
      organizationId: "org-lfg",
      projectId: "project-agentic-org",
      teamId: "team-runtime",
      workItemId: "work-outbox-001",
    },
    aggregate: {
      aggregateId: "supervisor-signal-001",
      aggregateType: AgenticAggregateType.SupervisorSignal,
      aggregateVersion: 1,
    },
    trace: {
      commandId: "cmd-supervisor-signal-001",
      correlationId: "corr-supervisor-signal-001",
      causationId: "cause-team-work-001",
      traceId: "trace-supervisor-signal-001",
      idempotencyKey: "idem-supervisor-signal-001",
    },
    payload,
  });
}
