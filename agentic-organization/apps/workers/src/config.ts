import { WorkerRuntimeConfigError, WorkerRuntimeConfigErrorCode, type WorkerRuntimeConfig } from "./worker-runtime.ts";

const decimalIntegerPattern = /^[0-9]+$/;

export const WorkerProcessEnvName = {
  AgenticOrgEnv: "AGENTIC_ORG_ENV",
  AgenticOrgId: "AGENTIC_ORG_ID",
  NatsDurable: "NATS_DURABLE",
  NatsInboundBatchSize: "NATS_INBOUND_BATCH_SIZE",
  NatsStream: "NATS_STREAM",
} as const;

export type WorkerProcessEnvName = (typeof WorkerProcessEnvName)[keyof typeof WorkerProcessEnvName];

export type WorkerProcessEnvironment = Partial<Record<WorkerProcessEnvName, string | undefined>>;

export function parseWorkerRuntimeConfigFromEnv(env: WorkerProcessEnvironment): WorkerRuntimeConfig {
  return {
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
  const trimmedValue = value?.trim();

  if (trimmedValue === undefined || trimmedValue.length === 0 || !decimalIntegerPattern.test(trimmedValue)) {
    throw new WorkerRuntimeConfigError(WorkerRuntimeConfigErrorCode.InvalidNatsInboundBatchSize);
  }

  const parsedValue = Number(trimmedValue);

  if (!Number.isSafeInteger(parsedValue) || parsedValue < 1) {
    throw new WorkerRuntimeConfigError(WorkerRuntimeConfigErrorCode.InvalidNatsInboundBatchSize);
  }

  return parsedValue;
}
