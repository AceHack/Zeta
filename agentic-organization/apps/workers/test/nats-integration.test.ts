import { deepEqual } from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { env } from "node:process";
import { describe, test } from "node:test";

import {
  AckPolicy,
  DeliverPolicy,
  DiscardPolicy,
  ReplayPolicy,
  RetentionPolicy,
  StorageType,
  jetstream,
  jetstreamManager,
} from "@nats-io/jetstream";
import { connect, type NatsConnection } from "@nats-io/transport-node";

import {
  AgenticAggregateType,
  AgenticEventType,
  createAgenticEventEnvelope,
  type AgenticEventEnvelope,
} from "../../../packages/domain/src/index.ts";
import {
  AgenticSubjectPrefix,
  AgenticMessagingDomain,
  buildAgenticEventSubject,
} from "../../../packages/messaging/src/index.ts";
import {
  createNatsJetStreamEventConsumer,
} from "../../../packages/messaging-nats/src/index.ts";
import {
  EventIngestionOutcomeStatus,
} from "../../../packages/state/src/index.ts";
import {
  WorkerDependencyName,
  WorkerDependencyReadinessStatus,
  connectNatsWorkerAdapters,
  createNatsJsTransportConnectionFactory,
  type NatsWorkerAdapters,
} from "../src/index.ts";

const NatsIntegrationEnvName = {
  Servers: "AGENTIC_ORG_NATS_INTEGRATION_SERVERS",
} as const;

const NatsIntegrationStaticName = {
  DeadLetterSubjectSegment: "dead_letter",
  Environment: "integration",
  DeadLetterId: "integration-dead-letter",
} as const;

const NatsIntegrationResourcePrefix = {
  Durable: "agentic-org-integration-worker",
  Organization: "org-nats-integration",
  Stream: "AGENTIC_ORG_INTEGRATION_EVENTS",
} as const;

const NatsIntegrationFetch = {
  BatchSize: 1,
  ExpiresMs: 2_000,
} as const;

const NatsIntegrationId = {
  Agent: "agent-nats-integration",
  Aggregate: "supervisor-signal-nats-integration",
  Causation: "cause-nats-integration",
  Command: "command-nats-integration",
  Correlation: "correlation-nats-integration",
  Event: "event-nats-integration",
  HatAssignment: "hat-assignment-nats-integration",
  IdempotencyKey: "idempotency-nats-integration",
  Initiative: "initiative-nats-integration",
  OutboxEvent: "outbox-nats-integration",
  Project: "project-nats-integration",
  Team: "team-nats-integration",
  Trace: "trace-nats-integration",
  WorkItem: "work-item-nats-integration",
} as const;

const NatsIntegrationTime = {
  OccurredAt: "2026-05-27T00:00:00.000Z",
} as const;

const NatsIntegrationPayload = {
  InvalidEnvelope: "not a canonical event envelope",
  Subject: "NATS live integration proof",
} as const;

describe("NATS worker live integration", () => {
  test(
    "publishes a canonical event, consumes it through the generic ingestion port, acknowledges it, and shuts down",
    {
      skip:
        env[NatsIntegrationEnvName.Servers] === undefined
          ? `${NatsIntegrationEnvName.Servers} is not set`
          : false,
    },
    async () => {
      const servers = readIntegrationNatsServers();
      const run = createNatsIntegrationRun();
      await recreateNatsIntegrationSubstrate(servers, run);

      let adapters: NatsWorkerAdapters | undefined;

      try {
        adapters = await connectNatsWorkerAdapters({
          config: {
            durableName: run.durableName,
            environment: NatsIntegrationStaticName.Environment,
            organizationId: run.organizationId,
            servers,
            streamName: run.streamName,
          },
          deadLetterMessageIdFactory: {
            createId: () => NatsIntegrationStaticName.DeadLetterId,
          },
          transportFactory: createNatsJsTransportConnectionFactory({
            fetchExpiresMs: NatsIntegrationFetch.ExpiresMs,
          }),
        });

        const readiness = await adapters.readinessProbe.check();

        deepEqual(readiness, {
          name: WorkerDependencyName.Nats,
          status: WorkerDependencyReadinessStatus.Ready,
        });

        const envelope = createIntegrationEnvelope(run);

        await adapters.eventPublisher.publish({
          subject: run.subject,
          outboxEvent: {
            outboxEventId: run.outboxEventId,
            envelope,
          },
        });

        const ingestedEnvelopes: AgenticEventEnvelope[] = [];
        const consumer = createNatsJetStreamEventConsumer({
          pullConsumer: adapters.pullConsumer,
          deadLetterPublisher: adapters.deadLetterPublisher,
          eventIngestionProcessor: {
            ingest: async (input) => {
              ingestedEnvelopes.push(input.envelope);

              return {
                status: EventIngestionOutcomeStatus.Processed,
                reactionPlans: [],
              };
            },
          },
        });

        const result = await consumer.processNextBatch({
          batchSize: NatsIntegrationFetch.BatchSize,
        });

        deepEqual(result, {
          receivedCount: 1,
          processedCount: 1,
          duplicateCount: 0,
          payloadConflictCount: 0,
          invalidCount: 0,
          failedCount: 0,
          acknowledgedCount: 1,
          negativeAcknowledgedCount: 0,
          terminatedCount: 0,
          deadLetteredCount: 0,
        });
        deepEqual(ingestedEnvelopes, [envelope]);

        await publishInvalidNatsIntegrationMessage(servers, run);

        const deadLetterResult = await consumer.processNextBatch({
          batchSize: NatsIntegrationFetch.BatchSize,
        });

        deepEqual(deadLetterResult, {
          receivedCount: 1,
          processedCount: 0,
          duplicateCount: 0,
          payloadConflictCount: 0,
          invalidCount: 1,
          failedCount: 0,
          acknowledgedCount: 0,
          negativeAcknowledgedCount: 0,
          terminatedCount: 1,
          deadLetteredCount: 1,
        });
      } finally {
        if (adapters !== undefined) {
          await adapters.shutdown.shutdown();
        }

        await cleanupNatsIntegrationSubstrate(servers, run);
      }
    },
  );
});

type NatsIntegrationRun = {
  durableName: string;
  eventId: string;
  organizationId: string;
  outboxEventId: string;
  streamName: string;
  subject: string;
};

async function recreateNatsIntegrationSubstrate(
  servers: readonly string[],
  run: NatsIntegrationRun,
): Promise<void> {
  await cleanupNatsIntegrationSubstrate(servers, run);

  const connection = await connect({
    servers: [...servers],
  });

  try {
    const manager = await jetstreamManager(connection);

    await manager.streams.add({
      name: run.streamName,
      subjects: [run.subject, createDeadLetterSubjectPattern(run)],
      retention: RetentionPolicy.Limits,
      discard: DiscardPolicy.Old,
      storage: StorageType.Memory,
      max_msgs: 32,
    });
    await manager.consumers.add(run.streamName, {
      durable_name: run.durableName,
      ack_policy: AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.All,
      replay_policy: ReplayPolicy.Instant,
      filter_subject: run.subject,
      max_deliver: 1,
    });
  } finally {
    await closeNatsConnection(connection);
  }
}

async function publishInvalidNatsIntegrationMessage(
  servers: readonly string[],
  run: NatsIntegrationRun,
): Promise<void> {
  const connection = await connect({
    servers: [...servers],
  });

  try {
    const client = jetstream(connection);

    await client.publish(run.subject, NatsIntegrationPayload.InvalidEnvelope);
  } finally {
    await closeNatsConnection(connection);
  }
}

async function cleanupNatsIntegrationSubstrate(servers: readonly string[], run: NatsIntegrationRun): Promise<void> {
  const connection = await connect({
    servers: [...servers],
  });

  try {
    const manager = await jetstreamManager(connection);

    await ignoreNatsNotFound(async () => {
      await manager.consumers.delete(run.streamName, run.durableName);
    });
    await ignoreNatsNotFound(async () => {
      await manager.streams.delete(run.streamName);
    });
  } finally {
    await closeNatsConnection(connection);
  }
}

function createIntegrationEnvelope(run: NatsIntegrationRun): AgenticEventEnvelope {
  return createAgenticEventEnvelope({
    eventId: run.eventId,
    eventType: AgenticEventType.SupervisorSignalSent,
    occurredAt: NatsIntegrationTime.OccurredAt,
    actor: {
      agentId: NatsIntegrationId.Agent,
      hatAssignmentId: NatsIntegrationId.HatAssignment,
    },
    scope: {
      organizationId: run.organizationId,
      projectId: NatsIntegrationId.Project,
      initiativeId: NatsIntegrationId.Initiative,
      teamId: NatsIntegrationId.Team,
      workItemId: NatsIntegrationId.WorkItem,
    },
    aggregate: {
      aggregateId: NatsIntegrationId.Aggregate,
      aggregateType: AgenticAggregateType.SupervisorSignal,
      aggregateVersion: 1,
    },
    trace: {
      commandId: NatsIntegrationId.Command,
      correlationId: NatsIntegrationId.Correlation,
      causationId: NatsIntegrationId.Causation,
      traceId: NatsIntegrationId.Trace,
      idempotencyKey: NatsIntegrationId.IdempotencyKey,
    },
    payload: {
      subject: NatsIntegrationPayload.Subject,
    },
  });
}

function readIntegrationNatsServers(): readonly string[] {
  const serverList = env[NatsIntegrationEnvName.Servers];

  if (serverList === undefined || serverList.trim().length === 0) {
    throw new Error(`${NatsIntegrationEnvName.Servers} is required for NATS integration tests`);
  }

  const servers = serverList
    .split(",")
    .map((server) => server.trim())
    .filter((server) => server.length > 0);

  if (servers.length === 0) {
    throw new Error(`${NatsIntegrationEnvName.Servers} must contain at least one server`);
  }

  return servers;
}

function createNatsIntegrationRun(): NatsIntegrationRun {
  const runId = randomUUID();
  const streamSafeRunId = runId.replaceAll("-", "_").toUpperCase();
  const organizationId = `${NatsIntegrationResourcePrefix.Organization}-${runId}`;

  return {
    durableName: `${NatsIntegrationResourcePrefix.Durable}-${runId}`,
    eventId: `${NatsIntegrationId.Event}-${runId}`,
    organizationId,
    outboxEventId: `${NatsIntegrationId.OutboxEvent}-${runId}`,
    streamName: `${NatsIntegrationResourcePrefix.Stream}_${streamSafeRunId}`,
    subject: buildAgenticEventSubject({
      environment: NatsIntegrationStaticName.Environment,
      organizationId,
      domain: AgenticMessagingDomain.SupervisorSignal,
      eventType: AgenticEventType.SupervisorSignalSent,
    }),
  };
}

function createDeadLetterSubjectPattern(run: NatsIntegrationRun): string {
  return `${AgenticSubjectPrefix.Root}.${NatsIntegrationStaticName.Environment}.${run.organizationId}.${NatsIntegrationStaticName.DeadLetterSubjectSegment}.>`;
}

async function ignoreNatsNotFound(operation: () => Promise<void>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if (!isNatsNotFoundError(error)) {
      throw error;
    }
  }
}

function isNatsNotFoundError(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes("not found");
}

async function closeNatsConnection(connection: NatsConnection): Promise<void> {
  await connection.close();
}
