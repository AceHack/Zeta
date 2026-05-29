import { WorkerRuntimeConfigError, WorkerRuntimeConfigErrorCode, type WorkerRuntimeConfig } from "./worker-runtime.ts";

const decimalIntegerPattern = /^[0-9]+$/;

export const WorkerProcessEnvName = {
  AgenticOrgEnv: "AGENTIC_ORG_ENV",
  AgenticOrgId: "AGENTIC_ORG_ID",
  CockroachDatabaseUrl: "COCKROACH_DATABASE_URL",
  NatsDurable: "NATS_DURABLE",
  NatsInboundBatchSize: "NATS_INBOUND_BATCH_SIZE",
  NatsServers: "NATS_SERVERS",
  NatsStream: "NATS_STREAM",
  WorkerInboundBatchSize: "WORKER_INBOUND_BATCH_SIZE",
  WorkerOutboxBatchSize: "WORKER_OUTBOX_BATCH_SIZE",
  WorkerReactionPlanBatchSize: "WORKER_REACTION_PLAN_BATCH_SIZE",
  WorkerReactionPlanLeaseMs: "WORKER_REACTION_PLAN_LEASE_MS",
} as const;

export type WorkerProcessEnvName = (typeof WorkerProcessEnvName)[keyof typeof WorkerProcessEnvName];

export type WorkerProcessEnvironment = Partial<Record<WorkerProcessEnvName, string | undefined>>;

export type WorkerDurableRuntimeConfig = {
  cockroachDatabaseUrl: string;
  natsServers: readonly string[];
  workerInboundBatchSize: number;
  workerOutboxBatchSize: number;
  workerReactionPlanBatchSize: number;
  workerReactionPlanLeaseMs: number;
};

export type WorkerProcessConfig = WorkerRuntimeConfig & WorkerDurableRuntimeConfig;

export function parseWorkerRuntimeConfigFromEnv(env: WorkerProcessEnvironment): WorkerProcessConfig {
  return {
    cockroachDatabaseUrl: readRequiredEnvValue(
      env,
      WorkerProcessEnvName.CockroachDatabaseUrl,
      WorkerRuntimeConfigErrorCode.MissingCockroachDatabaseUrl,
    ),
    natsServers: parseNatsServers(env[WorkerProcessEnvName.NatsServers]),
    environment: readRequiredEnvValue(
      env,
      WorkerProcessEnvName.AgenticOrgEnv,
      WorkerRuntimeConfigErrorCode.MissingEnvironment,
    ),
    organizationId: readRequiredEnvValue(
      env,
      WorkerProcessEnvName.AgenticOrgId,
      WorkerRuntimeConfigErrorCode.MissingOrganizationId,
    ),
    natsStreamName: readRequiredEnvValue(
      env,
      WorkerProcessEnvName.NatsStream,
      WorkerRuntimeConfigErrorCode.MissingNatsStreamName,
    ),
    natsDurableName: readRequiredEnvValue(
      env,
      WorkerProcessEnvName.NatsDurable,
      WorkerRuntimeConfigErrorCode.MissingNatsDurableName,
    ),
    natsInboundBatchSize: parseNatsInboundBatchSize(env[WorkerProcessEnvName.NatsInboundBatchSize]),
    workerInboundBatchSize: parseWorkerInboundBatchSize(env[WorkerProcessEnvName.WorkerInboundBatchSize]),
    workerOutboxBatchSize: parseWorkerOutboxBatchSize(env[WorkerProcessEnvName.WorkerOutboxBatchSize]),
    workerReactionPlanBatchSize: parseWorkerReactionPlanBatchSize(
      env[WorkerProcessEnvName.WorkerReactionPlanBatchSize],
    ),
    workerReactionPlanLeaseMs: parseWorkerReactionPlanLeaseMs(env[WorkerProcessEnvName.WorkerReactionPlanLeaseMs]),
  };
}

function readRequiredEnvValue(
  env: WorkerProcessEnvironment,
  name: WorkerProcessEnvName,
  errorCode: WorkerRuntimeConfigErrorCode,
): string {
  const value = env[name];

  if (value === undefined || value.trim().length === 0) {
    throw new WorkerRuntimeConfigError(errorCode);
  }

  return value.trim();
}

function parseNatsInboundBatchSize(value: string | undefined): number {
  return parsePositiveDecimalInteger(value, WorkerRuntimeConfigErrorCode.InvalidNatsInboundBatchSize);
}

function parseNatsServers(value: string | undefined): readonly string[] {
  const trimmedValue = value?.trim();

  if (trimmedValue === undefined || trimmedValue.length === 0) {
    throw new WorkerRuntimeConfigError(WorkerRuntimeConfigErrorCode.MissingNatsServers);
  }

  const servers = trimmedValue.split(",").map((server) => server.trim());

  if (servers.length === 0 || servers.some((server) => server.length === 0)) {
    throw new WorkerRuntimeConfigError(WorkerRuntimeConfigErrorCode.InvalidNatsServers);
  }

  return servers;
}

function parseWorkerInboundBatchSize(value: string | undefined): number {
  return parsePositiveDecimalInteger(value, WorkerRuntimeConfigErrorCode.InvalidWorkerInboundBatchSize);
}

function parseWorkerOutboxBatchSize(value: string | undefined): number {
  return parsePositiveDecimalInteger(value, WorkerRuntimeConfigErrorCode.InvalidWorkerOutboxBatchSize);
}

function parseWorkerReactionPlanBatchSize(value: string | undefined): number {
  return parsePositiveDecimalInteger(value, WorkerRuntimeConfigErrorCode.InvalidWorkerReactionPlanBatchSize);
}

function parseWorkerReactionPlanLeaseMs(value: string | undefined): number {
  return parsePositiveDecimalInteger(value, WorkerRuntimeConfigErrorCode.InvalidWorkerReactionPlanLeaseMs);
}

function parsePositiveDecimalInteger(value: string | undefined, errorCode: WorkerRuntimeConfigErrorCode): number {
  const trimmedValue = value?.trim();

  if (trimmedValue === undefined || trimmedValue.length === 0 || !decimalIntegerPattern.test(trimmedValue)) {
    throw new WorkerRuntimeConfigError(errorCode);
  }

  const parsedValue = Number(trimmedValue);

  if (!Number.isSafeInteger(parsedValue) || parsedValue < 1) {
    throw new WorkerRuntimeConfigError(errorCode);
  }

  return parsedValue;
}
