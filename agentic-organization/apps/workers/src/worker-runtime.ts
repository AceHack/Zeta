import {
  buildNatsConsumerBatchAttributes,
  buildWorkerCycleAttributes,
  type NatsConsumerBatchAttributes,
  type WorkerCycleFailureAttributeInput,
  type WorkerCycleAttributes,
} from "../../../packages/observability/src/index.ts";
import { OutboxPublishOutcomeStatus } from "../../../packages/messaging/src/index.ts";
import type {
  NatsJetStreamConsumeBatchResult,
  NatsJetStreamEventConsumer,
} from "../../../packages/messaging-nats/src/index.ts";
import {
  WorkerCycleStatus,
  type OrganizationWorkerHost,
  type WorkerCycleResult,
} from "../../../packages/workers/src/index.ts";

export const WorkerRuntimeStatus = {
  Degraded: "degraded",
  Healthy: "healthy",
} as const;

export type WorkerRuntimeStatus = (typeof WorkerRuntimeStatus)[keyof typeof WorkerRuntimeStatus];

export const WorkerRuntimeFailureStage = {
  KeepAlive: "keep_alive",
  NatsConsumer: "nats_consumer",
  OrganizationWorker: "organization_worker",
  Telemetry: "telemetry",
} as const;

export type WorkerRuntimeFailureStage = (typeof WorkerRuntimeFailureStage)[keyof typeof WorkerRuntimeFailureStage];

export const WorkerRuntimeConfigErrorCode = {
  InvalidWorkerInboundBatchSize: "invalid_worker_inbound_batch_size",
  InvalidWorkerOutboxBatchSize: "invalid_worker_outbox_batch_size",
  InvalidWorkerReactionPlanBatchSize: "invalid_worker_reaction_plan_batch_size",
  InvalidWorkerReactionPlanLeaseMs: "invalid_worker_reaction_plan_lease_ms",
  InvalidWorkerKeepAliveOrgHeartbeatDeadlineMs: "invalid_worker_keep_alive_org_heartbeat_deadline_ms",
  InvalidNatsServers: "invalid_nats_servers",
  MissingCockroachDatabaseUrl: "missing_cockroach_database_url",
  InvalidNatsInboundBatchSize: "invalid_nats_inbound_batch_size",
  MissingEnvironment: "missing_environment",
  MissingNatsDurableName: "missing_nats_durable_name",
  MissingNatsServers: "missing_nats_servers",
  MissingNatsStreamName: "missing_nats_stream_name",
  MissingOrganizationId: "missing_organization_id",
  /** exactly one of LLM_BASE_URL / LLM_MODEL was provided — a misconfiguration */
  PartialLlmConfig: "partial_llm_config",
  InvalidAgentLoopMode: "invalid_agent_loop_mode",
} as const;

export type WorkerRuntimeConfigErrorCode =
  (typeof WorkerRuntimeConfigErrorCode)[keyof typeof WorkerRuntimeConfigErrorCode];

export class WorkerRuntimeConfigError extends Error {
  readonly code: WorkerRuntimeConfigErrorCode;

  constructor(code: WorkerRuntimeConfigErrorCode) {
    super(`invalid worker runtime config: ${code}`);
    this.code = code;
  }
}

export const WorkerRuntimeTelemetryEventName = {
  NatsConsumerBatchProcessed: "agentic.worker.nats_consumer.batch_processed",
  WorkerCycleCompleted: "agentic.worker.cycle.completed",
} as const;

export type WorkerRuntimeTelemetryEventName =
  (typeof WorkerRuntimeTelemetryEventName)[keyof typeof WorkerRuntimeTelemetryEventName];

export type WorkerRuntimeTelemetryAttributes = WorkerCycleAttributes | NatsConsumerBatchAttributes;

export type WorkerRuntimeTelemetryRecord = {
  eventName: WorkerRuntimeTelemetryEventName;
  attributes: WorkerRuntimeTelemetryAttributes;
};

export type WorkerRuntimeTelemetrySink = {
  record: (record: WorkerRuntimeTelemetryRecord) => Promise<void>;
};

export type WorkerRuntimeConfig = {
  environment: string;
  natsInboundBatchSize: number;
  organizationId: string;
  natsStreamName: string;
  natsDurableName: string;
};

export type WorkerRuntimeFailure = {
  stage: WorkerRuntimeFailureStage;
  message: string;
};

/**
 * Minimal structural port for the deterministic keep-alive lane. Defined here
 * (not imported from the keepalive package) so the low-level worker runtime
 * stays ignorant of the high-level control-plane package — dependency inversion.
 * The concrete `KeepAliveLane` from packages/keepalive satisfies it structurally.
 */
export type WorkerKeepAliveLaneResult = {
  status: string;
  appliedCount: number;
  failures: readonly { message: string }[];
};

export type WorkerKeepAliveLane = {
  runOnce: () => Promise<WorkerKeepAliveLaneResult>;
};

/** the status a keep-alive lane reports when it ran cleanly and the org is alive */
const WorkerKeepAliveTickedStatus = "ticked";

export type WorkerRuntimeRunResult = {
  status: WorkerRuntimeStatus;
  keepAlive: WorkerKeepAliveLaneResult | undefined;
  workerCycle: WorkerCycleResult | undefined;
  natsConsumerBatch: NatsJetStreamConsumeBatchResult | undefined;
  failures: readonly WorkerRuntimeFailure[];
};

export type WorkerRuntime = {
  runOnce: () => Promise<WorkerRuntimeRunResult>;
};

export type CreateWorkerRuntimeInput = {
  config: WorkerRuntimeConfig;
  organizationWorkerHost: OrganizationWorkerHost;
  natsEventConsumer: NatsJetStreamEventConsumer;
  telemetrySink: WorkerRuntimeTelemetrySink;
  /**
   * Optional deterministic keep-alive lane. When provided it ticks FIRST every
   * cycle (liveness is the most safety-critical lane — the org heartbeat must
   * fire even if work-processing later degrades). Omitted in tests/contexts
   * that only exercise the work + ingestion lanes.
   */
  keepAliveLane?: WorkerKeepAliveLane;
};

export function createWorkerRuntime(input: CreateWorkerRuntimeInput): WorkerRuntime {
  validateWorkerRuntimeConfig(input.config);

  return {
    runOnce: async () => {
      const failures: WorkerRuntimeFailure[] = [];
      // Keep-alive ticks first: the org heartbeat is the most safety-critical
      // lane and must fire even if work-processing later degrades.
      const keepAlive = await runKeepAliveLane({
        keepAliveLane: input.keepAliveLane,
        failures,
      });
      const workerCycle = await runOrganizationWorker({
        organizationWorkerHost: input.organizationWorkerHost,
        telemetrySink: input.telemetrySink,
        failures,
      });
      const natsConsumerBatch = await runNatsConsumer({
        config: input.config,
        natsEventConsumer: input.natsEventConsumer,
        telemetrySink: input.telemetrySink,
        failures,
      });

      return {
        status: resolveWorkerRuntimeStatus({
          keepAlive,
          workerCycle,
          natsConsumerBatch,
          failures,
        }),
        keepAlive,
        workerCycle,
        natsConsumerBatch,
        failures,
      };
    },
  };
}

type RunKeepAliveLaneInput = {
  keepAliveLane: WorkerKeepAliveLane | undefined;
  failures: WorkerRuntimeFailure[];
};

async function runKeepAliveLane(input: RunKeepAliveLaneInput): Promise<WorkerKeepAliveLaneResult | undefined> {
  if (input.keepAliveLane === undefined) {
    return undefined;
  }

  try {
    const result = await input.keepAliveLane.runOnce();
    for (const failure of result.failures) {
      input.failures.push({
        stage: WorkerRuntimeFailureStage.KeepAlive,
        message: failure.message,
      });
    }
    return result;
  } catch (error) {
    // the keep-alive lane should never throw, but if it does the loop survives —
    // driving the org to stay alive must not be killed by one bad tick
    input.failures.push({
      stage: WorkerRuntimeFailureStage.KeepAlive,
      message: extractErrorMessage(error),
    });
    return undefined;
  }
}

function validateWorkerRuntimeConfig(config: WorkerRuntimeConfig): void {
  assertNonEmptyConfigValue(config.environment, WorkerRuntimeConfigErrorCode.MissingEnvironment);
  assertNonEmptyConfigValue(config.organizationId, WorkerRuntimeConfigErrorCode.MissingOrganizationId);
  assertNonEmptyConfigValue(config.natsStreamName, WorkerRuntimeConfigErrorCode.MissingNatsStreamName);
  assertNonEmptyConfigValue(config.natsDurableName, WorkerRuntimeConfigErrorCode.MissingNatsDurableName);

  if (!Number.isInteger(config.natsInboundBatchSize) || config.natsInboundBatchSize < 1) {
    throw new WorkerRuntimeConfigError(WorkerRuntimeConfigErrorCode.InvalidNatsInboundBatchSize);
  }
}

function assertNonEmptyConfigValue(value: string, code: WorkerRuntimeConfigErrorCode): void {
  if (value.trim().length === 0) {
    throw new WorkerRuntimeConfigError(code);
  }
}

type RunOrganizationWorkerInput = {
  organizationWorkerHost: OrganizationWorkerHost;
  telemetrySink: WorkerRuntimeTelemetrySink;
  failures: WorkerRuntimeFailure[];
};

async function runOrganizationWorker(input: RunOrganizationWorkerInput): Promise<WorkerCycleResult | undefined> {
  try {
    const workerCycle = await input.organizationWorkerHost.runOnce();
    await recordTelemetry({
      telemetrySink: input.telemetrySink,
      failures: input.failures,
      record: {
        eventName: WorkerRuntimeTelemetryEventName.WorkerCycleCompleted,
        attributes: buildWorkerCycleAttributes({
          status: workerCycle.status,
          outboxStatus: workerCycle.outbox?.status ?? OutboxPublishOutcomeStatus.Empty,
          inboundPulledCount: workerCycle.inbound.pulledCount,
          inboundProcessedCount: workerCycle.inbound.processedCount,
          inboundDuplicateCount: workerCycle.inbound.duplicateCount,
          inboundPayloadConflictCount: workerCycle.inbound.payloadConflictCount,
          inboundFailedCount: workerCycle.inbound.failedCount,
          inboundReactionPlanCount: workerCycle.inbound.reactionPlanCount,
          reactionPlanStatus: workerCycle.reactionPlans.status,
          reactionPlanClaimedCount: workerCycle.reactionPlans.claimedCount,
          reactionPlanSucceededCount: workerCycle.reactionPlans.succeededCount,
          reactionPlanFailedCount: workerCycle.reactionPlans.failedCount,
          reactionPlanClaimLostCount: workerCycle.reactionPlans.claimLostCount,
          failureCount: workerCycle.failures.length,
          firstFailure: buildFirstWorkerCycleFailureTelemetryInput(workerCycle),
        }),
      },
    });
    return workerCycle;
  } catch (error) {
    input.failures.push({
      stage: WorkerRuntimeFailureStage.OrganizationWorker,
      message: extractErrorMessage(error),
    });
    return undefined;
  }
}

function buildFirstWorkerCycleFailureTelemetryInput(
  workerCycle: WorkerCycleResult,
): WorkerCycleFailureAttributeInput | undefined {
  const firstFailure = workerCycle.failures[0];

  if (firstFailure === undefined) {
    return undefined;
  }

  return {
    ...firstFailure,
    stage: WorkerRuntimeFailureStage.OrganizationWorker,
  };
}

type RunNatsConsumerInput = {
  config: WorkerRuntimeConfig;
  natsEventConsumer: NatsJetStreamEventConsumer;
  telemetrySink: WorkerRuntimeTelemetrySink;
  failures: WorkerRuntimeFailure[];
};

async function runNatsConsumer(input: RunNatsConsumerInput): Promise<NatsJetStreamConsumeBatchResult | undefined> {
  try {
    const natsConsumerBatch = await input.natsEventConsumer.processNextBatch({
      batchSize: input.config.natsInboundBatchSize,
    });
    await recordTelemetry({
      telemetrySink: input.telemetrySink,
      failures: input.failures,
      record: {
        eventName: WorkerRuntimeTelemetryEventName.NatsConsumerBatchProcessed,
        attributes: buildNatsConsumerBatchAttributes({
          streamName: input.config.natsStreamName,
          durableName: input.config.natsDurableName,
          ...natsConsumerBatch,
        }),
      },
    });
    return natsConsumerBatch;
  } catch (error) {
    input.failures.push({
      stage: WorkerRuntimeFailureStage.NatsConsumer,
      message: extractErrorMessage(error),
    });
    return undefined;
  }
}

type RecordTelemetryInput = {
  telemetrySink: WorkerRuntimeTelemetrySink;
  failures: WorkerRuntimeFailure[];
  record: WorkerRuntimeTelemetryRecord;
};

async function recordTelemetry(input: RecordTelemetryInput): Promise<void> {
  try {
    await input.telemetrySink.record(input.record);
  } catch (error) {
    input.failures.push({
      stage: WorkerRuntimeFailureStage.Telemetry,
      message: extractErrorMessage(error),
    });
  }
}

type ResolveWorkerRuntimeStatusInput = {
  keepAlive: WorkerKeepAliveLaneResult | undefined;
  workerCycle: WorkerCycleResult | undefined;
  natsConsumerBatch: NatsJetStreamConsumeBatchResult | undefined;
  failures: readonly WorkerRuntimeFailure[];
};

function resolveWorkerRuntimeStatus(input: ResolveWorkerRuntimeStatusInput): WorkerRuntimeStatus {
  if (
    input.failures.length > 0 ||
    isKeepAliveLaneDegraded(input.keepAlive) ||
    input.workerCycle?.status === WorkerCycleStatus.Degraded ||
    isNatsConsumerBatchDegraded(input.natsConsumerBatch)
  ) {
    return WorkerRuntimeStatus.Degraded;
  }

  return WorkerRuntimeStatus.Healthy;
}

function isKeepAliveLaneDegraded(keepAlive: WorkerKeepAliveLaneResult | undefined): boolean {
  if (keepAlive === undefined) {
    return false;
  }

  // A keep-alive tick can be degraded with zero apply failures (e.g. the org is
  // flatlining) — so we check the lane's own status, not just failure count.
  return keepAlive.status !== WorkerKeepAliveTickedStatus;
}

function isNatsConsumerBatchDegraded(batch: NatsJetStreamConsumeBatchResult | undefined): boolean {
  if (batch === undefined) {
    return true;
  }

  return (
    batch.failedCount !== 0 ||
    batch.deadLetteredCount !== 0 ||
    batch.invalidCount !== 0 ||
    batch.payloadConflictCount !== 0 ||
    batch.negativeAcknowledgedCount !== 0 ||
    batch.terminatedCount !== 0
  );
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
