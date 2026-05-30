import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AgenticAggregateType,
  AgenticEventType,
  SupervisorChainLevel,
  createAgenticEventEnvelope,
} from "../../../packages/domain/src/index.ts";
import type { EventPublication } from "../../../packages/messaging/src/index.ts";
import type {
  NatsDeadLetterMessage,
  NatsJetStreamInboundMessage,
} from "../../../packages/messaging-nats/src/index.ts";
import {
  ReactionPlanExecutionStatus,
  type ReactionPlanActionExecutionResult,
  type ReactionPlanActionExecutorPort,
} from "../../../packages/runtime/src/index.ts";
import type { CockroachOrganizationSqlExecutor } from "../../../packages/state-cockroach/src/index.ts";
import { WorkerCycleStatus } from "../../../packages/workers/src/index.ts";
import { composeDurableWorkerRuntimePorts, type WorkerRuntimeTelemetrySink } from "../src/index.ts";

describe("durable worker runtime composition", () => {
  test("wires Cockroach outbox and event ingestion adapters into the worker host", async () => {
    const cockroachExecutor = createRecordingCockroachExecutor();
    const eventPublisher = createRecordingEventPublisher();
    const telemetrySink = createNoopTelemetrySink();
    const ports = composeDurableWorkerRuntimePorts({
      config: {
        cockroachDatabaseUrl: "postgresql://agentic-org@cockroachdb-public:26257/agentic_org",
        environment: "dev",
        organizationId: "org-lfg",
        natsStreamName: "agentic-org-events",
        natsServers: ["nats://nats.nats.svc.cluster.local:4222"],
        natsDurableName: "agentic-org-v0-automation-planner",
        natsInboundBatchSize: 25,
        workerInboundBatchSize: 10,
        workerOutboxBatchSize: 5,
        workerReactionPlanBatchSize: 3,
        workerReactionPlanLeaseMs: 300_000,
        workerKeepAliveOrgHeartbeatDeadlineMs: 30_000,
      },
      durableAdapters: {
        cockroachExecutor,
        eventPublisher,
        inboundEventSource: {
          pullNextBatch: async () => [createSupervisorSignalEnvelope()],
        },
        natsPullConsumer: createRecordingNatsPullConsumer([]),
        natsDeadLetterPublisher: createRecordingNatsDeadLetterPublisher(),
        reactionPlanActionExecutor: createNoopReactionPlanActionExecutor(),
        telemetrySink,
      },
      runtimeUtilities: {
        calculatePayloadHash: () => "sha256:event-payload-001",
        createId: (prefix) => `${prefix}-001`,
        now: () => "2026-05-26T00:00:00.000Z",
      },
    });

    const workerCycle = await ports.organizationWorkerHost.runOnce();

    equal(workerCycle.status, WorkerCycleStatus.Worked);
    equal(workerCycle.outbox?.publishedOutboxEventIds.length, 1);
    equal(workerCycle.inbound.processedCount, 1);
    equal(workerCycle.inbound.reactionPlanCount, 1);
    deepEqual(
      eventPublisher.publications.map((publication) => publication.subject),
      ["agentic-org.dev.org-lfg.supervisor_signal.sent"],
    );
  });

  test("builds the NATS consumer from pull and dead-letter ports", async () => {
    const natsPullConsumer = createRecordingNatsPullConsumer([createNatsMessage(createSupervisorSignalEnvelope())]);
    const natsDeadLetterPublisher = createRecordingNatsDeadLetterPublisher();
    const ports = composeDurableWorkerRuntimePorts({
      config: {
        cockroachDatabaseUrl: "postgresql://agentic-org@cockroachdb-public:26257/agentic_org",
        environment: "dev",
        organizationId: "org-lfg",
        natsServers: ["nats://nats.nats.svc.cluster.local:4222"],
        natsStreamName: "agentic-org-events",
        natsDurableName: "agentic-org-v0-automation-planner",
        natsInboundBatchSize: 25,
        workerInboundBatchSize: 10,
        workerOutboxBatchSize: 5,
        workerReactionPlanBatchSize: 3,
        workerReactionPlanLeaseMs: 300_000,
        workerKeepAliveOrgHeartbeatDeadlineMs: 30_000,
      },
      durableAdapters: {
        cockroachExecutor: createRecordingCockroachExecutor(),
        eventPublisher: createRecordingEventPublisher(),
        inboundEventSource: {
          pullNextBatch: async () => [],
        },
        natsPullConsumer,
        natsDeadLetterPublisher,
        reactionPlanActionExecutor: createNoopReactionPlanActionExecutor(),
        telemetrySink: createNoopTelemetrySink(),
      },
      runtimeUtilities: {
        calculatePayloadHash: () => "sha256:event-payload-001",
        createId: (prefix) => `${prefix}-001`,
        now: () => "2026-05-26T00:00:00.000Z",
      },
    });

    const batch = await ports.natsEventConsumer.processNextBatch({ batchSize: 25 });

    deepEqual(natsPullConsumer.batchSizes, [25]);
    equal(batch.processedCount, 1);
    equal(batch.acknowledgedCount, 1);
    deepEqual(natsDeadLetterPublisher.messages, []);
  });

  test("wires invalid NATS messages to the composed dead-letter publisher", async () => {
    const natsDeadLetterPublisher = createRecordingNatsDeadLetterPublisher();
    const ports = composeDurableWorkerRuntimePorts({
      config: {
        cockroachDatabaseUrl: "postgresql://agentic-org@cockroachdb-public:26257/agentic_org",
        environment: "dev",
        organizationId: "org-lfg",
        natsServers: ["nats://nats.nats.svc.cluster.local:4222"],
        natsStreamName: "agentic-org-events",
        natsDurableName: "agentic-org-v0-automation-planner",
        natsInboundBatchSize: 25,
        workerInboundBatchSize: 10,
        workerOutboxBatchSize: 5,
        workerReactionPlanBatchSize: 3,
        workerReactionPlanLeaseMs: 300_000,
        workerKeepAliveOrgHeartbeatDeadlineMs: 30_000,
      },
      durableAdapters: {
        cockroachExecutor: createRecordingCockroachExecutor(),
        eventPublisher: createRecordingEventPublisher(),
        inboundEventSource: {
          pullNextBatch: async () => [],
        },
        natsPullConsumer: createRecordingNatsPullConsumer([createInvalidNatsMessage()]),
        natsDeadLetterPublisher,
        reactionPlanActionExecutor: createNoopReactionPlanActionExecutor(),
        telemetrySink: createNoopTelemetrySink(),
      },
      runtimeUtilities: {
        calculatePayloadHash: () => "sha256:event-payload-001",
        createId: (prefix) => `${prefix}-001`,
        now: () => "2026-05-26T00:00:00.000Z",
      },
    });

    const batch = await ports.natsEventConsumer.processNextBatch({ batchSize: 25 });

    equal(batch.invalidCount, 1);
    equal(batch.deadLetteredCount, 1);
    deepEqual(natsDeadLetterPublisher.messages, [
      {
        sourceSubject: "agentic-org.dev.org-lfg.invalid",
        payload: "{",
        headers: {},
        reason: "invalid_envelope",
      },
    ]);
  });
});

function createSupervisorSignalEnvelope() {
  return createAgenticEventEnvelope({
    eventId: "evt-supervisor-signal-001",
    eventType: AgenticEventType.SupervisorSignalSent,
    occurredAt: "2026-05-26T00:00:00.000Z",
    actor: {
      agentId: "agent-001",
      hatAssignmentId: "hat-assignment-001",
    },
    scope: {
      organizationId: "org-lfg",
      projectId: "project-agentic-org",
      teamId: "team-runtime",
      workItemId: "work-item-001",
    },
    aggregate: {
      aggregateId: "supervisor-signal-001",
      aggregateType: AgenticAggregateType.SupervisorSignal,
      aggregateVersion: 1,
    },
    trace: {
      commandId: "cmd-001",
      correlationId: "corr-001",
      causationId: "cause-001",
      traceId: "trace-001",
      idempotencyKey: "idem-001",
    },
    payload: {
      targetHatAssignmentId: "hat-assignment-manager-001",
      targetLevel: SupervisorChainLevel.Manager,
    },
  });
}

function createRecordingCockroachExecutor(): CockroachOrganizationSqlExecutor & {
  statementNames: string[];
} {
  const statementNames: string[] = [];

  return {
    statementNames,
    execute: async <Row = Record<string, unknown>>(statement: { name: string }) => {
      statementNames.push(statement.name);

      if (statement.name === "claim_unpublished_outbox_events") {
        return {
          rows: [
            {
              outbox_event_id: "outbox-001",
              envelope_json: createSupervisorSignalEnvelope(),
            },
          ] as Row[],
        };
      }

      if (statement.name === "mark_outbox_event_published") {
        return {
          rows: [{ outbox_event_id: "outbox-001" }] as Row[],
        };
      }

      return {
        rows: [] as Row[],
      };
    },
    executeTransaction: async <Result>(
      operation: (executor: {
        execute: <Row = Record<string, unknown>>(statement: { name: string }) => Promise<{ rows: Row[] }>;
      }) => Promise<Result>,
    ) =>
      await operation({
        execute: async <Row = Record<string, unknown>>(statement: { name: string }) => {
          statementNames.push(statement.name);

          if (statement.name === "claim_pending_inbox_receipt") {
            return {
              rows: [{ claim_status: "processed" }] as Row[],
            };
          }

          if (statement.name === "mark_inbox_receipt_processed") {
            return {
              rows: [{ event_id: "evt-supervisor-signal-001" }] as Row[],
            };
          }

          return {
            rows: [] as Row[],
          };
        },
      }),
  };
}

function createRecordingEventPublisher(): {
  publications: EventPublication[];
  publish: (publication: EventPublication) => Promise<void>;
} {
  const publications: EventPublication[] = [];

  return {
    publications,
    publish: async (publication) => {
      publications.push(publication);
    },
  };
}

function createNoopTelemetrySink(): WorkerRuntimeTelemetrySink {
  return {
    record: async () => undefined,
  };
}

function createNoopReactionPlanActionExecutor(): ReactionPlanActionExecutorPort {
  return {
    executeReactionPlanAction: async (): Promise<ReactionPlanActionExecutionResult> => ({
      status: ReactionPlanExecutionStatus.Succeeded,
      result: {
        message: "noop test reaction action",
        createdWorkItemIds: [],
        createdDiscussionAnchorIds: [],
      },
    }),
  };
}

function createRecordingNatsPullConsumer(messages: readonly NatsJetStreamInboundMessage[]): {
  batchSizes: number[];
  fetchNextBatch: (input: { batchSize: number }) => Promise<readonly NatsJetStreamInboundMessage[]>;
} {
  const batchSizes: number[] = [];

  return {
    batchSizes,
    fetchNextBatch: async (input) => {
      batchSizes.push(input.batchSize);
      return messages;
    },
  };
}

function createRecordingNatsDeadLetterPublisher(): {
  messages: NatsDeadLetterMessage[];
  publish: (message: NatsDeadLetterMessage) => Promise<void>;
} {
  const messages: NatsDeadLetterMessage[] = [];

  return {
    messages,
    publish: async (message) => {
      messages.push(message);
    },
  };
}

function createNatsMessage(envelope: ReturnType<typeof createSupervisorSignalEnvelope>): NatsJetStreamInboundMessage & {
  acknowledgedCount: number;
} {
  return {
    acknowledgedCount: 0,
    subject: "agentic-org.dev.org-lfg.supervisor_signal.sent",
    payload: JSON.stringify(envelope),
    headers: {},
    acknowledge: async function acknowledge() {
      this.acknowledgedCount += 1;
    },
    negativeAcknowledge: async () => undefined,
    terminate: async () => undefined,
  };
}

function createInvalidNatsMessage(): NatsJetStreamInboundMessage {
  return {
    subject: "agentic-org.dev.org-lfg.invalid",
    payload: "{",
    headers: {},
    acknowledge: async () => undefined,
    negativeAcknowledge: async () => undefined,
    terminate: async () => undefined,
  };
}
