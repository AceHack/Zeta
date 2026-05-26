import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  WorkerProcessEnvName,
  WorkerRuntimeConfigError,
  WorkerRuntimeConfigErrorCode,
  parseWorkerRuntimeConfigFromEnv,
} from "../src/index.ts";

describe("worker runtime config parsing", () => {
  test("parses typed runtime config from process env", () => {
    deepEqual(
      parseWorkerRuntimeConfigFromEnv({
        [WorkerProcessEnvName.AgenticOrgEnv]: " dev ",
        [WorkerProcessEnvName.AgenticOrgId]: " org-lfg ",
        [WorkerProcessEnvName.CockroachDatabaseUrl]: " postgresql://agentic-org@cockroachdb-public:26257/agentic_org ",
        [WorkerProcessEnvName.NatsStream]: " agentic-org-events ",
        [WorkerProcessEnvName.NatsDurable]: " agentic-org-v0-automation-planner ",
        [WorkerProcessEnvName.NatsInboundBatchSize]: "25",
        [WorkerProcessEnvName.WorkerInboundBatchSize]: "15",
        [WorkerProcessEnvName.WorkerOutboxBatchSize]: "10",
      }),
      {
        cockroachDatabaseUrl: "postgresql://agentic-org@cockroachdb-public:26257/agentic_org",
        environment: "dev",
        organizationId: "org-lfg",
        natsStreamName: "agentic-org-events",
        natsDurableName: "agentic-org-v0-automation-planner",
        natsInboundBatchSize: 25,
        workerInboundBatchSize: 15,
        workerOutboxBatchSize: 10,
      },
    );
  });

  test("rejects missing required env values with typed errors", () => {
    assertConfigError(
      {
        [WorkerProcessEnvName.AgenticOrgId]: "org-lfg",
        [WorkerProcessEnvName.CockroachDatabaseUrl]: "postgresql://agentic-org@cockroachdb-public:26257/agentic_org",
        [WorkerProcessEnvName.NatsStream]: "agentic-org-events",
        [WorkerProcessEnvName.NatsDurable]: "agentic-org-v0-automation-planner",
        [WorkerProcessEnvName.NatsInboundBatchSize]: "25",
        [WorkerProcessEnvName.WorkerInboundBatchSize]: "15",
        [WorkerProcessEnvName.WorkerOutboxBatchSize]: "10",
      },
      WorkerRuntimeConfigErrorCode.MissingEnvironment,
    );
    assertConfigError(
      {
        [WorkerProcessEnvName.AgenticOrgEnv]: "dev",
        [WorkerProcessEnvName.AgenticOrgId]: "org-lfg",
        [WorkerProcessEnvName.NatsStream]: "agentic-org-events",
        [WorkerProcessEnvName.NatsDurable]: "agentic-org-v0-automation-planner",
        [WorkerProcessEnvName.NatsInboundBatchSize]: "25",
        [WorkerProcessEnvName.WorkerInboundBatchSize]: "15",
        [WorkerProcessEnvName.WorkerOutboxBatchSize]: "10",
      },
      WorkerRuntimeConfigErrorCode.MissingCockroachDatabaseUrl,
    );
  });

  test("rejects invalid numeric env values with typed errors", () => {
    try {
      parseWorkerRuntimeConfigFromEnv({
        [WorkerProcessEnvName.AgenticOrgEnv]: "dev",
        [WorkerProcessEnvName.AgenticOrgId]: "org-lfg",
        [WorkerProcessEnvName.CockroachDatabaseUrl]: "postgresql://agentic-org@cockroachdb-public:26257/agentic_org",
        [WorkerProcessEnvName.NatsStream]: "agentic-org-events",
        [WorkerProcessEnvName.NatsDurable]: "agentic-org-v0-automation-planner",
        [WorkerProcessEnvName.NatsInboundBatchSize]: "not-a-number",
        [WorkerProcessEnvName.WorkerInboundBatchSize]: "15",
        [WorkerProcessEnvName.WorkerOutboxBatchSize]: "10",
      });
      throw new Error("expected config parsing to fail");
    } catch (error) {
      equal(error instanceof WorkerRuntimeConfigError, true);
      equal((error as WorkerRuntimeConfigError).code, WorkerRuntimeConfigErrorCode.InvalidNatsInboundBatchSize);
    }
  });

  test("rejects non-decimal or unsafe batch sizes with typed errors", () => {
    for (const batchSize of ["1.5", "1e3", "9007199254740992"]) {
      assertConfigError(
        {
          [WorkerProcessEnvName.AgenticOrgEnv]: "dev",
          [WorkerProcessEnvName.AgenticOrgId]: "org-lfg",
          [WorkerProcessEnvName.CockroachDatabaseUrl]: "postgresql://agentic-org@cockroachdb-public:26257/agentic_org",
          [WorkerProcessEnvName.NatsStream]: "agentic-org-events",
          [WorkerProcessEnvName.NatsDurable]: "agentic-org-v0-automation-planner",
          [WorkerProcessEnvName.NatsInboundBatchSize]: batchSize,
          [WorkerProcessEnvName.WorkerInboundBatchSize]: "15",
          [WorkerProcessEnvName.WorkerOutboxBatchSize]: "10",
        },
        WorkerRuntimeConfigErrorCode.InvalidNatsInboundBatchSize,
      );
      assertConfigError(
        {
          [WorkerProcessEnvName.AgenticOrgEnv]: "dev",
          [WorkerProcessEnvName.AgenticOrgId]: "org-lfg",
          [WorkerProcessEnvName.CockroachDatabaseUrl]: "postgresql://agentic-org@cockroachdb-public:26257/agentic_org",
          [WorkerProcessEnvName.NatsStream]: "agentic-org-events",
          [WorkerProcessEnvName.NatsDurable]: "agentic-org-v0-automation-planner",
          [WorkerProcessEnvName.NatsInboundBatchSize]: "25",
          [WorkerProcessEnvName.WorkerInboundBatchSize]: batchSize,
          [WorkerProcessEnvName.WorkerOutboxBatchSize]: "10",
        },
        WorkerRuntimeConfigErrorCode.InvalidWorkerInboundBatchSize,
      );
      assertConfigError(
        {
          [WorkerProcessEnvName.AgenticOrgEnv]: "dev",
          [WorkerProcessEnvName.AgenticOrgId]: "org-lfg",
          [WorkerProcessEnvName.CockroachDatabaseUrl]: "postgresql://agentic-org@cockroachdb-public:26257/agentic_org",
          [WorkerProcessEnvName.NatsStream]: "agentic-org-events",
          [WorkerProcessEnvName.NatsDurable]: "agentic-org-v0-automation-planner",
          [WorkerProcessEnvName.NatsInboundBatchSize]: "25",
          [WorkerProcessEnvName.WorkerInboundBatchSize]: "15",
          [WorkerProcessEnvName.WorkerOutboxBatchSize]: batchSize,
        },
        WorkerRuntimeConfigErrorCode.InvalidWorkerOutboxBatchSize,
      );
    }
  });
});

function assertConfigError(
  env: Parameters<typeof parseWorkerRuntimeConfigFromEnv>[0],
  code: WorkerRuntimeConfigErrorCode,
): void {
  try {
    parseWorkerRuntimeConfigFromEnv(env);
    throw new Error("expected config parsing to fail");
  } catch (error) {
    equal(error instanceof WorkerRuntimeConfigError, true);
    equal((error as WorkerRuntimeConfigError).code, code);
  }
}
