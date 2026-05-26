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
        [WorkerProcessEnvName.NatsStream]: " agentic-org-events ",
        [WorkerProcessEnvName.NatsDurable]: " agentic-org-v0-automation-planner ",
        [WorkerProcessEnvName.NatsInboundBatchSize]: "25",
      }),
      {
        environment: "dev",
        organizationId: "org-lfg",
        natsStreamName: "agentic-org-events",
        natsDurableName: "agentic-org-v0-automation-planner",
        natsInboundBatchSize: 25,
      },
    );
  });

  test("rejects missing required env values with typed errors", () => {
    try {
      parseWorkerRuntimeConfigFromEnv({
        [WorkerProcessEnvName.AgenticOrgId]: "org-lfg",
        [WorkerProcessEnvName.NatsStream]: "agentic-org-events",
        [WorkerProcessEnvName.NatsDurable]: "agentic-org-v0-automation-planner",
        [WorkerProcessEnvName.NatsInboundBatchSize]: "25",
      });
      throw new Error("expected config parsing to fail");
    } catch (error) {
      equal(error instanceof WorkerRuntimeConfigError, true);
      equal((error as WorkerRuntimeConfigError).code, WorkerRuntimeConfigErrorCode.MissingEnvironment);
    }
  });

  test("rejects invalid numeric env values with typed errors", () => {
    try {
      parseWorkerRuntimeConfigFromEnv({
        [WorkerProcessEnvName.AgenticOrgEnv]: "dev",
        [WorkerProcessEnvName.AgenticOrgId]: "org-lfg",
        [WorkerProcessEnvName.NatsStream]: "agentic-org-events",
        [WorkerProcessEnvName.NatsDurable]: "agentic-org-v0-automation-planner",
        [WorkerProcessEnvName.NatsInboundBatchSize]: "not-a-number",
      });
      throw new Error("expected config parsing to fail");
    } catch (error) {
      equal(error instanceof WorkerRuntimeConfigError, true);
      equal((error as WorkerRuntimeConfigError).code, WorkerRuntimeConfigErrorCode.InvalidNatsInboundBatchSize);
    }
  });

  test("rejects non-decimal or unsafe batch sizes with typed errors", () => {
    for (const batchSize of ["1.5", "1e3", "9007199254740992"]) {
      try {
        parseWorkerRuntimeConfigFromEnv({
          [WorkerProcessEnvName.AgenticOrgEnv]: "dev",
          [WorkerProcessEnvName.AgenticOrgId]: "org-lfg",
          [WorkerProcessEnvName.NatsStream]: "agentic-org-events",
          [WorkerProcessEnvName.NatsDurable]: "agentic-org-v0-automation-planner",
          [WorkerProcessEnvName.NatsInboundBatchSize]: batchSize,
        });
        throw new Error("expected config parsing to fail");
      } catch (error) {
        equal(error instanceof WorkerRuntimeConfigError, true);
        equal((error as WorkerRuntimeConfigError).code, WorkerRuntimeConfigErrorCode.InvalidNatsInboundBatchSize);
      }
    }
  });
});
