import { WorkerRuntimeConfigError, WorkerRuntimeConfigErrorCode, type WorkerRuntimeConfig } from "./worker-runtime.ts";

const decimalIntegerPattern = /^[0-9]+$/;

/**
 * Default deadline (ms) past which the deterministic keep-alive engine treats
 * the org as flatlining and raises a self-heal alert. Optional env override;
 * defaulted so existing deployments do not need a new variable.
 */
export const WorkerKeepAliveConfigDefault = {
  OrgHeartbeatDeadlineMs: 30_000,
  /** cadence of the independent keep-alive loop (decoupled from the work cycle) */
  LoopIntervalMs: 5_000,
} as const;

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
  WorkerKeepAliveOrgHeartbeatDeadlineMs: "WORKER_KEEP_ALIVE_ORG_HEARTBEAT_DEADLINE_MS",
  /** when set, the agent's composer makes real model calls to this in-cluster endpoint */
  LlmBaseUrl: "LLM_BASE_URL",
  LlmModel: "LLM_MODEL",
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
  workerKeepAliveOrgHeartbeatDeadlineMs: number;
  /** in-cluster model endpoint for the agent's decision backend (optional) */
  llmBaseUrl?: string;
  /** model name to ask the endpoint for (optional; required when llmBaseUrl is set) */
  llmModel?: string;
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
    workerKeepAliveOrgHeartbeatDeadlineMs: parseWorkerKeepAliveOrgHeartbeatDeadlineMs(
      env[WorkerProcessEnvName.WorkerKeepAliveOrgHeartbeatDeadlineMs],
    ),
    // optional model backend — only set when both URL and model are provided
    ...parseLlmConfig(env),
  };
}

function parseLlmConfig(env: WorkerProcessEnvironment): { llmBaseUrl?: string; llmModel?: string } {
  const baseUrl = nonEmpty(env[WorkerProcessEnvName.LlmBaseUrl]);
  const model = nonEmpty(env[WorkerProcessEnvName.LlmModel]);
  if (baseUrl === undefined && model === undefined) {
    // neither set → the deterministic composer is used (a valid, intended mode)
    return {};
  }
  if (baseUrl === undefined || model === undefined) {
    // exactly one set → a misconfiguration; fail loudly rather than silently
    // dropping the model backend, which would be hard to diagnose in-cluster.
    throw new WorkerRuntimeConfigError(WorkerRuntimeConfigErrorCode.PartialLlmConfig);
  }
  return { llmBaseUrl: baseUrl, llmModel: model };
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed !== undefined && trimmed.length > 0 ? trimmed : undefined;
}

function parseWorkerKeepAliveOrgHeartbeatDeadlineMs(value: string | undefined): number {
  return parseOptionalPositiveDecimalInteger(
    value,
    WorkerKeepAliveConfigDefault.OrgHeartbeatDeadlineMs,
    WorkerRuntimeConfigErrorCode.InvalidWorkerKeepAliveOrgHeartbeatDeadlineMs,
  );
}

function parseOptionalPositiveDecimalInteger(
  value: string | undefined,
  defaultValue: number,
  errorCode: WorkerRuntimeConfigErrorCode,
): number {
  const trimmedValue = value?.trim();

  if (trimmedValue === undefined || trimmedValue.length === 0) {
    return defaultValue;
  }

  return parsePositiveDecimalInteger(trimmedValue, errorCode);
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
