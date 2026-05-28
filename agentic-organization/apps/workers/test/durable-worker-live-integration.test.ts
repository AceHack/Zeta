import { deepEqual, equal, ok } from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { env } from "node:process";
import { describe, test } from "node:test";

import {
  AckPolicy,
  DeliverPolicy,
  DiscardPolicy,
  ReplayPolicy,
  RetentionPolicy,
  StorageType,
  jetstreamManager,
} from "@nats-io/jetstream";
import { connect, type NatsConnection } from "@nats-io/transport-node";

import {
  AgenticEventType,
  CommandType,
  ReactionPlanStatus,
  SupervisorChainLevel,
  SupervisorSignalToolType,
  type AgenticEventEnvelope,
} from "../../../packages/domain/src/index.ts";
import {
  createCommandHandlerRegistry,
  createCommandPipeline,
  createSendSupervisorSignalHandler,
  CommandResultStatus,
  type CommandResult,
  type PipelineCommand,
} from "../../../packages/application/src/index.ts";
import {
  AgenticMessagingDomain,
  AgenticSubjectPrefix,
  buildAgenticEventSubject,
} from "../../../packages/messaging/src/index.ts";
import { OutboxPublishOutcomeStatus } from "../../../packages/messaging/src/index.ts";
import {
  PolicyDecisionStatus,
  createPolicyDecisionObservationPort,
  type CommandAuthorizationPort,
} from "../../../packages/policy/src/index.ts";
import { EventIngestionOutcomeStatus, InboundEventConsumerName } from "../../../packages/state/src/index.ts";
import {
  CockroachTableName,
  createCockroachDurableStateAdapters,
} from "../../../packages/state-cockroach/src/index.ts";
import { WorkerCycleStatus } from "../../../packages/workers/src/index.ts";
import {
  WorkerDependencyName,
  WorkerDependencyReadinessStatus,
  WorkerProcessShutdownStatus,
  WorkerProcessLoopStatus,
  WorkerReadinessStatus,
  WorkerRuntimeStatus,
  composeDurableWorkerRuntimePorts,
  createCockroachMigrationBootstrapper,
  createCockroachReadinessProbe,
  createCockroachSqlExecutor,
  createCockroachWorkerShutdownPort,
  createCockroachWorkerSqlClient,
  createNatsJsTransportConnectionFactory,
  createPgCockroachWorkerPool,
  createWorkerProcess,
  createWorkerProcessLoop,
  createWorkerRuntime,
  connectNatsWorkerAdapters,
  type CockroachAnySqlStatement,
  type WorkerProcessLoopRecord,
  type WorkerRuntimeTelemetryRecord,
} from "../src/index.ts";

const DurableLiveIntegrationEnvName = {
  CockroachDatabaseUrl: "AGENTIC_ORG_COCKROACH_INTEGRATION_DATABASE_URL",
  NatsServers: "AGENTIC_ORG_NATS_INTEGRATION_SERVERS",
} as const;

const DurableLiveIntegrationStaticName = {
  DeadLetterSegment: "dead_letter",
  Environment: "integration",
  PolicyDecisionId: "policy-decision-durable-live-allow",
  PolicyVersion: "policy-durable-live-v1",
  RequestMessage: "The live worker proof needs a supervisor triage reaction after the event round trip.",
  RequestTitle: "Durable worker live proof",
  Sha256: "sha256",
} as const;

const DurableLiveIntegrationResourcePrefix = {
  Durable: "agentic-org-durable-live-worker",
  Organization: "org-durable-live",
  Stream: "AGENTIC_ORG_DURABLE_LIVE_EVENTS",
} as const;

const DurableLiveIntegrationBatch = {
  NatsInbound: 1,
  WorkerInbound: 1,
  WorkerOutbox: 1,
} as const;

const DurableLiveIntegrationFetch = {
  ExpiresMs: 2_000,
} as const;

const DurableLiveIntegrationIdPrefix = {
  Agent: "agent-durable-live",
  Causation: "cause-durable-live",
  Command: "cmd-durable-live",
  Correlation: "corr-durable-live",
  HatAssignment: "hat-assignment-durable-live",
  Idempotency: "idem-durable-live",
  ManagerHatAssignment: "hat-assignment-manager-durable-live",
  Project: "project-durable-live",
  RequestHash: "hash-durable-live",
  Team: "team-durable-live",
  Trace: "trace-durable-live",
  WorkItem: "work-durable-live",
} as const;

const DurableLiveIntegrationStatementName = {
  CleanupAuditEvents: "durable_live_cleanup_audit_events",
  CleanupIdempotencyRecords: "durable_live_cleanup_idempotency_records",
  CleanupInboxReceipts: "durable_live_cleanup_inbox_receipts",
  CleanupOutboxEvents: "durable_live_cleanup_outbox_events",
  CleanupPolicyObservations: "durable_live_cleanup_policy_observations",
  CleanupReactionPlans: "durable_live_cleanup_reaction_plans",
  CleanupSupervisorSignals: "durable_live_cleanup_supervisor_signals",
  SelectInboxReceipt: "durable_live_select_inbox_receipt",
  SelectOutboxEvent: "durable_live_select_outbox_event",
  SelectReactionPlan: "durable_live_select_reaction_plan",
} as const;

const DurableLiveIntegrationTime = {
  OccurredAt: "2026-05-28T00:00:00.000Z",
} as const;

describe("durable worker live integration", () => {
  test(
    "persists a command in Cockroach, publishes its outbox through NATS, consumes it, and records durable automation state",
    {
      skip: shouldSkipDurableLiveIntegration(),
    },
    async () => {
      const databaseUrl = readIntegrationDatabaseUrl();
      const natsServers = readIntegrationNatsServers();
      const run = createDurableLiveIntegrationRun();
      const telemetrySink = createRecordingTelemetrySink();
      let executor: ReturnType<typeof createCockroachSqlExecutor> | undefined;
      let natsAdapters: Awaited<ReturnType<typeof connectNatsWorkerAdapters>> | undefined;
      let pool: Awaited<ReturnType<typeof createPgCockroachWorkerPool>> | undefined;

      try {
        await recreateNatsIntegrationSubstrate(natsServers, run);

        pool = await createPgCockroachWorkerPool({
          databaseUrl,
        });
        const sqlClient = createCockroachWorkerSqlClient({
          pool,
          maxTransactionAttempts: 2,
        });
        executor = createCockroachSqlExecutor({
          client: sqlClient,
        });

        await createCockroachMigrationBootstrapper({
          executor,
        }).bootstrap();

        const stateAdapters = createCockroachDurableStateAdapters<CommandResult>({
          executor,
        });
        const commandResult = await createCommandPipeline({
          stateStoreFactory: stateAdapters.commandStateStoreFactory,
          commandAuthorizationPort: createAllowingCommandAuthorizationPort(),
          policyDecisionObservationPort: createPolicyDecisionObservationPort({
            store: stateAdapters.policyDecisionObservationStore,
          }),
          handlerRegistry: createCommandHandlerRegistry([createSendSupervisorSignalHandler()]),
          now: () => DurableLiveIntegrationTime.OccurredAt,
          createId: (prefix) => `${prefix}-${run.runId}`,
        }).execute(createSupervisorSignalCommand(run));

        equal(commandResult.status, CommandResultStatus.Accepted);

        natsAdapters = await connectNatsWorkerAdapters({
          config: {
            durableName: run.durableName,
            environment: DurableLiveIntegrationStaticName.Environment,
            organizationId: run.organizationId,
            servers: natsServers,
            streamName: run.streamName,
          },
          deadLetterMessageIdFactory: {
            createId: (message) => createDeadLetterMessageId(message.payload),
          },
          transportFactory: createNatsJsTransportConnectionFactory({
            fetchExpiresMs: DurableLiveIntegrationFetch.ExpiresMs,
          }),
        });
        const runtimePorts = composeDurableWorkerRuntimePorts({
          config: {
            cockroachDatabaseUrl: databaseUrl,
            environment: DurableLiveIntegrationStaticName.Environment,
            organizationId: run.organizationId,
            natsServers,
            natsStreamName: run.streamName,
            natsDurableName: run.durableName,
            natsInboundBatchSize: DurableLiveIntegrationBatch.NatsInbound,
            workerInboundBatchSize: DurableLiveIntegrationBatch.WorkerInbound,
            workerOutboxBatchSize: DurableLiveIntegrationBatch.WorkerOutbox,
          },
          durableAdapters: {
            cockroachExecutor: executor,
            eventPublisher: natsAdapters.eventPublisher,
            inboundEventSource: {
              pullNextBatch: async () => [],
            },
            natsDeadLetterPublisher: natsAdapters.deadLetterPublisher,
            natsPullConsumer: natsAdapters.pullConsumer,
            telemetrySink,
          },
          runtimeUtilities: {
            calculatePayloadHash,
            createId: (prefix) => `${prefix}-${run.runId}`,
            now: () => DurableLiveIntegrationTime.OccurredAt,
          },
        });
        const process = createWorkerProcess({
          bootstrappers: [
            createCockroachMigrationBootstrapper({
              executor,
            }),
          ],
          readinessProbes: [
            createCockroachReadinessProbe({
              client: sqlClient,
            }),
            natsAdapters.readinessProbe,
          ],
          runtime: createWorkerRuntime({
            config: {
              environment: DurableLiveIntegrationStaticName.Environment,
              organizationId: run.organizationId,
              natsStreamName: run.streamName,
              natsDurableName: run.durableName,
              natsInboundBatchSize: DurableLiveIntegrationBatch.NatsInbound,
            },
            organizationWorkerHost: runtimePorts.organizationWorkerHost,
            natsEventConsumer: runtimePorts.natsEventConsumer,
            telemetrySink,
          }),
          shutdownPorts: [],
        });

        const loopObserver = createRecordingLoopObserver();
        const loopResult = await createWorkerProcessLoop({
          process,
          delay: {
            waitAfterIteration: async () => undefined,
          },
          observer: loopObserver,
          stopSignal: createManualStopSignal(),
          maxCycles: 2,
        }).run();

        const processResult = loopResult.iterations[0]?.processResult;

        equal(loopResult.iterations.length, 2);
        equal(loopResult.status, WorkerProcessLoopStatus.Completed);
        equal(loopResult.shutdown.status, WorkerProcessShutdownStatus.Completed);
        ok(processResult);
        equal(processResult.status, WorkerRuntimeStatus.Healthy);
        equal(processResult.readiness?.status, WorkerReadinessStatus.Ready);
        deepEqual(
          processResult.readiness?.checks.map((check) => ({
            name: check.name,
            status: check.status,
          })),
          [
            {
              name: WorkerDependencyName.Cockroach,
              status: WorkerDependencyReadinessStatus.Ready,
            },
            {
              name: WorkerDependencyName.Nats,
              status: WorkerDependencyReadinessStatus.Ready,
            },
          ],
        );
        equal(processResult.runtimeResult?.status, WorkerRuntimeStatus.Healthy);
        equal(processResult.runtimeResult?.workerCycle?.status, WorkerCycleStatus.Worked);
        equal(processResult.runtimeResult?.workerCycle?.outbox?.status, OutboxPublishOutcomeStatus.Published);
        equal(processResult.runtimeResult?.natsConsumerBatch?.processedCount, 1);
        equal(processResult.runtimeResult?.natsConsumerBatch?.acknowledgedCount, 1);

        const outboxRow = await findOutboxRow(executor, run);
        const inboxRow = await findInboxRow(executor, run);
        const reactionPlanRow = await findReactionPlanRow(executor, run);

        deepEqual(outboxRow, {
          event_id: run.eventId,
          event_type: AgenticEventType.SupervisorSignalSent,
          published: true,
        });
        deepEqual(inboxRow, {
          consumer_name: InboundEventConsumerName.V0AutomationPlanner,
          result: EventIngestionOutcomeStatus.Processed,
        });
        ok(reactionPlanRow?.reaction_plan_id.startsWith(`reaction-plan-${run.runId}`));
        equal(reactionPlanRow?.trigger_event_id, run.eventId);
        equal(reactionPlanRow?.status, ReactionPlanStatus.Planned);
        equal(telemetrySink.records.length, 4);
        equal(loopObserver.records.length, 3);
      } finally {
        try {
          if (executor !== undefined) {
            await cleanupCockroachRowsBestEffort(executor, run);
          }
        } finally {
          try {
            if (natsAdapters !== undefined) {
              await natsAdapters.shutdown.shutdown();
            }

            if (pool !== undefined) {
              await createCockroachWorkerShutdownPort({
                pool,
              }).shutdown();
            }
          } finally {
            await cleanupNatsIntegrationSubstrate(natsServers, run);
          }
        }
      }
    },
  );
});

type DurableLiveIntegrationRun = {
  auditEventId: string;
  commandId: string;
  durableName: string;
  eventId: string;
  idempotencyKey: string;
  organizationId: string;
  outboxEventId: string;
  requestHash: string;
  runId: string;
  streamName: string;
  subject: string;
  supervisorSignalId: string;
};

type OutboxRow = {
  event_id: string;
  event_type: AgenticEventType;
  published: boolean;
};

type InboxRow = {
  consumer_name: InboundEventConsumerName;
  result: EventIngestionOutcomeStatus;
};

type ReactionPlanRow = {
  reaction_plan_id: string;
  status: string;
  trigger_event_id: string;
};

function shouldSkipDurableLiveIntegration(): string | false {
  if (env[DurableLiveIntegrationEnvName.CockroachDatabaseUrl] === undefined) {
    return `${DurableLiveIntegrationEnvName.CockroachDatabaseUrl} is not set`;
  }

  if (env[DurableLiveIntegrationEnvName.NatsServers] === undefined) {
    return `${DurableLiveIntegrationEnvName.NatsServers} is not set`;
  }

  return false;
}

function createSupervisorSignalCommand(run: DurableLiveIntegrationRun): PipelineCommand {
  return {
    commandId: run.commandId,
    type: CommandType.SendSupervisorSignal,
    idempotencyKey: run.idempotencyKey,
    requestHash: run.requestHash,
    correlationId: `${DurableLiveIntegrationIdPrefix.Correlation}-${run.runId}`,
    causationId: `${DurableLiveIntegrationIdPrefix.Causation}-${run.runId}`,
    traceId: `${DurableLiveIntegrationIdPrefix.Trace}-${run.runId}`,
    organizationId: run.organizationId,
    projectId: `${DurableLiveIntegrationIdPrefix.Project}-${run.runId}`,
    teamId: `${DurableLiveIntegrationIdPrefix.Team}-${run.runId}`,
    sourceLevel: SupervisorChainLevel.TeamMember,
    targetLevel: SupervisorChainLevel.Manager,
    targetHatAssignmentId: `${DurableLiveIntegrationIdPrefix.ManagerHatAssignment}-${run.runId}`,
    actor: {
      agentId: `${DurableLiveIntegrationIdPrefix.Agent}-${run.runId}`,
      hatAssignmentId: `${DurableLiveIntegrationIdPrefix.HatAssignment}-${run.runId}`,
    },
    toolType: SupervisorSignalToolType.ReportBlocker,
    title: DurableLiveIntegrationStaticName.RequestTitle,
    message: DurableLiveIntegrationStaticName.RequestMessage,
    relatedWorkItemId: `${DurableLiveIntegrationIdPrefix.WorkItem}-${run.runId}`,
  };
}

function createAllowingCommandAuthorizationPort(): CommandAuthorizationPort {
  return {
    authorizeCommand: async () => ({
      status: PolicyDecisionStatus.Allowed,
      decisionId: DurableLiveIntegrationStaticName.PolicyDecisionId,
      policyVersion: DurableLiveIntegrationStaticName.PolicyVersion,
    }),
  };
}

async function findOutboxRow(
  executor: ReturnType<typeof createCockroachSqlExecutor>,
  run: DurableLiveIntegrationRun,
): Promise<OutboxRow | undefined> {
  const result = await executor.execute<OutboxRow>({
    name: DurableLiveIntegrationStatementName.SelectOutboxEvent,
    sql: `
      SELECT event_id, event_type, published_at IS NOT NULL AS published
      FROM ${CockroachTableName.OutboxEvents}
      WHERE outbox_event_id = $1
    `,
    parameters: [run.outboxEventId],
  });

  return result.rows[0];
}

async function findInboxRow(
  executor: ReturnType<typeof createCockroachSqlExecutor>,
  run: DurableLiveIntegrationRun,
): Promise<InboxRow | undefined> {
  const result = await executor.execute<InboxRow>({
    name: DurableLiveIntegrationStatementName.SelectInboxReceipt,
    sql: `
      SELECT consumer_name, result
      FROM ${CockroachTableName.InboxReceipts}
      WHERE event_id = $1
        AND consumer_name = $2
    `,
    parameters: [run.eventId, InboundEventConsumerName.V0AutomationPlanner],
  });

  return result.rows[0];
}

async function findReactionPlanRow(
  executor: ReturnType<typeof createCockroachSqlExecutor>,
  run: DurableLiveIntegrationRun,
): Promise<ReactionPlanRow | undefined> {
  const result = await executor.execute<ReactionPlanRow>({
    name: DurableLiveIntegrationStatementName.SelectReactionPlan,
    sql: `
      SELECT reaction_plan_id, status, trigger_event_id
      FROM ${CockroachTableName.ReactionPlans}
      WHERE trigger_event_id = $1
    `,
    parameters: [run.eventId],
  });

  return result.rows[0];
}

async function cleanupCockroachRowsBestEffort(
  executor: ReturnType<typeof createCockroachSqlExecutor>,
  run: DurableLiveIntegrationRun,
): Promise<void> {
  try {
    await executor.execute(createCleanupStatement(DurableLiveIntegrationStatementName.CleanupReactionPlans, [
      `DELETE FROM ${CockroachTableName.ReactionPlans} WHERE trigger_event_id = $1`,
      [run.eventId],
    ]));
    await executor.execute(createCleanupStatement(DurableLiveIntegrationStatementName.CleanupInboxReceipts, [
      `DELETE FROM ${CockroachTableName.InboxReceipts} WHERE event_id = $1`,
      [run.eventId],
    ]));
    await executor.execute(createCleanupStatement(DurableLiveIntegrationStatementName.CleanupOutboxEvents, [
      `DELETE FROM ${CockroachTableName.OutboxEvents} WHERE outbox_event_id = $1 OR event_id = $2`,
      [run.outboxEventId, run.eventId],
    ]));
    await executor.execute(createCleanupStatement(DurableLiveIntegrationStatementName.CleanupAuditEvents, [
      `DELETE FROM ${CockroachTableName.AuditEvents} WHERE audit_event_id = $1 OR aggregate_id = $2`,
      [run.auditEventId, run.supervisorSignalId],
    ]));
    await executor.execute(createCleanupStatement(DurableLiveIntegrationStatementName.CleanupSupervisorSignals, [
      `DELETE FROM ${CockroachTableName.SupervisorSignals} WHERE supervisor_signal_id = $1`,
      [run.supervisorSignalId],
    ]));
    await executor.execute(createCleanupStatement(DurableLiveIntegrationStatementName.CleanupPolicyObservations, [
      `DELETE FROM ${CockroachTableName.PolicyObservations} WHERE command_id = $1 OR idempotency_key = $2`,
      [run.commandId, run.idempotencyKey],
    ]));
    await executor.execute(createCleanupStatement(DurableLiveIntegrationStatementName.CleanupIdempotencyRecords, [
      `DELETE FROM ${CockroachTableName.IdempotencyRecords} WHERE idempotency_key = $1`,
      [run.idempotencyKey],
    ]));
  } catch {
    // The live proof may fail before migrations or rows exist; preserve the primary failure.
  }
}

function createCleanupStatement(
  name: (typeof DurableLiveIntegrationStatementName)[keyof typeof DurableLiveIntegrationStatementName],
  [sql, parameters]: readonly [string, readonly unknown[]],
): CockroachAnySqlStatement {
  return {
    name,
    sql,
    parameters,
  };
}

async function recreateNatsIntegrationSubstrate(
  servers: readonly string[],
  run: DurableLiveIntegrationRun,
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

async function cleanupNatsIntegrationSubstrate(
  servers: readonly string[],
  run: DurableLiveIntegrationRun,
): Promise<void> {
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

function createDurableLiveIntegrationRun(): DurableLiveIntegrationRun {
  const runId = randomUUID();
  const organizationId = `${DurableLiveIntegrationResourcePrefix.Organization}-${runId}`;

  return {
    auditEventId: `audit-${runId}`,
    commandId: `${DurableLiveIntegrationIdPrefix.Command}-${runId}`,
    durableName: `${DurableLiveIntegrationResourcePrefix.Durable}-${runId}`,
    eventId: `evt-${runId}`,
    idempotencyKey: `${DurableLiveIntegrationIdPrefix.Idempotency}-${runId}`,
    organizationId,
    outboxEventId: `outbox-${runId}`,
    requestHash: `${DurableLiveIntegrationIdPrefix.RequestHash}-${runId}`,
    runId,
    streamName: `${DurableLiveIntegrationResourcePrefix.Stream}_${runId.replaceAll("-", "_").toUpperCase()}`,
    subject: buildAgenticEventSubject({
      environment: DurableLiveIntegrationStaticName.Environment,
      organizationId,
      domain: AgenticMessagingDomain.SupervisorSignal,
      eventType: AgenticEventType.SupervisorSignalSent,
    }),
    supervisorSignalId: `supervisor-signal-${runId}`,
  };
}

function calculatePayloadHash(envelope: AgenticEventEnvelope): string {
  return createHash(DurableLiveIntegrationStaticName.Sha256).update(JSON.stringify(envelope)).digest("hex");
}

function createDeadLetterMessageId(payload: string): string {
  return createHash(DurableLiveIntegrationStaticName.Sha256).update(payload).digest("hex");
}

function createDeadLetterSubjectPattern(run: DurableLiveIntegrationRun): string {
  return `${AgenticSubjectPrefix.Root}.${DurableLiveIntegrationStaticName.Environment}.${run.organizationId}.${DurableLiveIntegrationStaticName.DeadLetterSegment}.>`;
}

function readIntegrationDatabaseUrl(): string {
  const databaseUrl = env[DurableLiveIntegrationEnvName.CockroachDatabaseUrl];

  if (databaseUrl === undefined || databaseUrl.trim().length === 0) {
    throw new Error(`${DurableLiveIntegrationEnvName.CockroachDatabaseUrl} is required`);
  }

  return databaseUrl.trim();
}

function readIntegrationNatsServers(): readonly string[] {
  const serverList = env[DurableLiveIntegrationEnvName.NatsServers];

  if (serverList === undefined || serverList.trim().length === 0) {
    throw new Error(`${DurableLiveIntegrationEnvName.NatsServers} is required`);
  }

  const servers = serverList
    .split(",")
    .map((server) => server.trim())
    .filter((server) => server.length > 0);

  if (servers.length === 0) {
    throw new Error(`${DurableLiveIntegrationEnvName.NatsServers} must contain at least one server`);
  }

  return servers;
}

function createRecordingTelemetrySink(): {
  records: WorkerRuntimeTelemetryRecord[];
  record: (record: WorkerRuntimeTelemetryRecord) => Promise<void>;
} {
  const records: WorkerRuntimeTelemetryRecord[] = [];

  return {
    records,
    record: async (record) => {
      records.push(record);
    },
  };
}

function createRecordingLoopObserver(): {
  records: WorkerProcessLoopRecord[];
  record: (record: WorkerProcessLoopRecord) => Promise<void>;
} {
  const records: WorkerProcessLoopRecord[] = [];

  return {
    records,
    record: async (record) => {
      records.push(record);
    },
  };
}

function createManualStopSignal(): {
  isStopRequested: () => boolean;
} {
  return {
    isStopRequested: () => false,
  };
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
