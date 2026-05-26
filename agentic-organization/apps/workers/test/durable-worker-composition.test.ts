import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AgenticAggregateType,
  AgenticEventType,
  SupervisorChainLevel,
  createAgenticEventEnvelope,
} from "../../../packages/domain/src/index.ts";
import type { EventPublication } from "../../../packages/messaging/src/index.ts";
import type { NatsJetStreamConsumeBatchResult } from "../../../packages/messaging-nats/src/index.ts";
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
        natsDurableName: "agentic-org-v0-automation-planner",
        natsInboundBatchSize: 25,
        workerInboundBatchSize: 10,
        workerOutboxBatchSize: 5,
      },
      durableAdapters: {
        cockroachExecutor,
        eventPublisher,
        inboundEventSource: {
          pullNextBatch: async () => [createSupervisorSignalEnvelope()],
        },
        natsEventConsumer: {
          processNextBatch: async () => createEmptyNatsBatch(),
        },
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
    deepEqual(cockroachExecutor.statementNames, [
      "claim_unpublished_outbox_events",
      "mark_outbox_event_published",
      "find_inbox_receipt",
      "claim_pending_inbox_receipt",
      "insert_reaction_plan",
      "mark_inbox_receipt_processed",
    ]);
    deepEqual(
      eventPublisher.publications.map((publication) => publication.subject),
      ["agentic-org.dev.org-lfg.supervisor_signal.sent"],
    );
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

function createEmptyNatsBatch(): NatsJetStreamConsumeBatchResult {
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
