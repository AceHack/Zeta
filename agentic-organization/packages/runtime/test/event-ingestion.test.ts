import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AgenticAggregateType,
  AgenticEventType,
  ReactionPlanStatus,
  SupervisorChainLevel,
  SupervisorSignalStatus,
  SupervisorSignalToolType,
  createAgenticEventEnvelope,
} from "../../domain/src/index.ts";
import {
  EventIngestionOutcomeStatus,
  type EventIngestionStore,
  InboundEventConsumerName,
  type RecordEventProcessingOutcomeInput,
  createInMemoryEventIngestionStore,
} from "../../state/src/index.ts";
import {
  ReactionPlanActionType,
  ReactionPlanReason,
  RequiredHat,
  createEventIngestionProcessor,
  evaluateV0AutomationRules,
} from "../src/index.ts";

describe("event ingestion processor", () => {
  test("persists the originating traceparent on planned reaction plans", async () => {
    const store = createInMemoryEventIngestionStore();
    const processor = createEventIngestionProcessor({
      store,
      evaluateRules: evaluateV0AutomationRules,
      consumerName: InboundEventConsumerName.V0AutomationPlanner,
      calculatePayloadHash: (envelope) => `hash-${envelope.eventId}`,
      now: () => "2026-05-25T22:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
    });

    const result = await processor.ingest({
      envelope: createSupervisorSignalEnvelope(),
      traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    });

    equal(result.reactionPlans[0]?.traceparent, "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");
    equal(store.snapshot.reactionPlans[0]?.traceparent, "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");
  });

  test("records an inbox receipt and persists reaction plans for a new event", async () => {
    const store = createInMemoryEventIngestionStore();
    const processor = createEventIngestionProcessor({
      store,
      evaluateRules: evaluateV0AutomationRules,
      consumerName: InboundEventConsumerName.V0AutomationPlanner,
      calculatePayloadHash: (envelope) => `hash-${envelope.eventId}`,
      now: () => "2026-05-25T22:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
    });

    const result = await processor.ingest({
      envelope: createSupervisorSignalEnvelope(),
    });

    equal(result.status, EventIngestionOutcomeStatus.Processed);
    equal(result.reactionPlans.length, 1);
    deepEqual(store.snapshot.inboxReceipts, [
      {
        eventId: "evt-supervisor-signal-001",
        consumerName: InboundEventConsumerName.V0AutomationPlanner,
        firstSeenAt: "2026-05-25T22:00:00.000Z",
        processedAt: "2026-05-25T22:00:00.000Z",
        payloadHash: "hash-evt-supervisor-signal-001",
        result: EventIngestionOutcomeStatus.Processed,
      },
    ]);
    deepEqual(store.snapshot.reactionPlans, [
      {
        reactionPlanId: "reaction-plan-001",
        consumerName: InboundEventConsumerName.V0AutomationPlanner,
        createdAt: "2026-05-25T22:00:00.000Z",
        status: ReactionPlanStatus.Planned,
        action: {
          actionType: ReactionPlanActionType.CreateSupervisorTriage,
          triggerEventId: "evt-supervisor-signal-001",
          organizationId: "org-lfg",
          projectId: "project-agentic-org",
          teamId: "team-runtime",
          workItemId: "work-outbox-001",
          supervisorSignalId: "supervisor-signal-001",
          targetLevel: SupervisorChainLevel.Manager,
          requiredHat: RequiredHat.EngineeringManager,
          reason: ReactionPlanReason.SupervisorSignalNeedsTriage,
        },
      },
    ]);
  });

  test("dedupes replayed events before rule evaluation side effects", async () => {
    const store = createInMemoryEventIngestionStore();
    let evaluationCount = 0;
    const processor = createEventIngestionProcessor({
      store,
      evaluateRules: (envelope) => {
        evaluationCount += 1;
        return evaluateV0AutomationRules(envelope);
      },
      consumerName: InboundEventConsumerName.V0AutomationPlanner,
      calculatePayloadHash: (eventEnvelope) => `hash-${eventEnvelope.eventId}`,
      now: () => "2026-05-25T22:00:00.000Z",
      createId: (prefix) => `${prefix}-${evaluationCount}`,
    });

    const envelope = createSupervisorSignalEnvelope();
    const firstResult = await processor.ingest({
      envelope,
    });
    const replayResult = await processor.ingest({
      envelope,
    });

    equal(firstResult.status, EventIngestionOutcomeStatus.Processed);
    equal(replayResult.status, EventIngestionOutcomeStatus.Duplicate);
    equal(evaluationCount, 1);
    equal(store.snapshot.inboxReceipts.length, 1);
    equal(store.snapshot.reactionPlans.length, 1);
  });

  test("rejects same event ID with a different payload hash", async () => {
    const store = createInMemoryEventIngestionStore();
    let evaluationCount = 0;
    const processor = createEventIngestionProcessor({
      store,
      evaluateRules: (envelope) => {
        evaluationCount += 1;
        return evaluateV0AutomationRules(envelope);
      },
      consumerName: InboundEventConsumerName.V0AutomationPlanner,
      calculatePayloadHash: (eventEnvelope) => `hash-${eventEnvelope.payload.title}`,
      now: () => "2026-05-25T22:00:00.000Z",
      createId: (prefix) => `${prefix}-${evaluationCount}`,
    });

    const firstResult = await processor.ingest({
      envelope: createSupervisorSignalEnvelope(),
    });
    const conflictResult = await processor.ingest({
      envelope: createSupervisorSignalEnvelope("Different payload"),
    });

    equal(firstResult.status, EventIngestionOutcomeStatus.Processed);
    equal(conflictResult.status, EventIngestionOutcomeStatus.PayloadConflict);
    equal(evaluationCount, 1);
    equal(store.snapshot.inboxReceipts.length, 1);
    equal(store.snapshot.reactionPlans.length, 1);
  });

  test("retries an unprocessed inbox receipt instead of treating it as duplicate", async () => {
    let evaluationCount = 0;
    let recordedOutcome: RecordEventProcessingOutcomeInput | undefined;
    const store: EventIngestionStore = {
      findInboxReceipt: async () => ({
        eventId: "evt-supervisor-signal-001",
        consumerName: InboundEventConsumerName.V0AutomationPlanner,
        firstSeenAt: "2026-05-25T21:59:00.000Z",
        payloadHash: "hash-evt-supervisor-signal-001",
      }),
      recordEventProcessingOutcome: async (input) => {
        recordedOutcome = input;

        return {
          status: input.result,
          reactionPlans: input.reactionPlans,
        };
      },
    };
    const processor = createEventIngestionProcessor({
      store,
      evaluateRules: (envelope) => {
        evaluationCount += 1;
        return evaluateV0AutomationRules(envelope);
      },
      consumerName: InboundEventConsumerName.V0AutomationPlanner,
      calculatePayloadHash: (eventEnvelope) => `hash-${eventEnvelope.eventId}`,
      now: () => "2026-05-25T22:00:00.000Z",
      createId: (prefix) => `${prefix}-${evaluationCount}`,
    });

    const result = await processor.ingest({
      envelope: createSupervisorSignalEnvelope(),
    });

    equal(result.status, EventIngestionOutcomeStatus.Processed);
    equal(evaluationCount, 1);
    equal(recordedOutcome?.result, EventIngestionOutcomeStatus.Processed);
    equal(recordedOutcome?.receipt.firstSeenAt, "2026-05-25T21:59:00.000Z");
    equal(recordedOutcome?.reactionPlans.length, 1);
  });
});

function createSupervisorSignalEnvelope(title = "Blocked on scoped NATS publisher") {
  return createAgenticEventEnvelope({
    eventId: "evt-supervisor-signal-001",
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
    payload: {
      sourceLevel: SupervisorChainLevel.TeamMember,
      targetLevel: SupervisorChainLevel.Manager,
      targetHatAssignmentId: "hat-assignment-em-001",
      toolType: SupervisorSignalToolType.ReportBlocker,
      status: SupervisorSignalStatus.Sent,
      title,
    },
  });
}
