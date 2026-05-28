import { deepEqual } from "node:assert/strict";
import { describe, test } from "node:test";

import type { CockroachSqlClient } from "../../../packages/state-cockroach/src/index.ts";
import { CockroachReadinessSql } from "../src/adapters/cockroach-readiness.ts";
import {
  WorkerDependencyName,
  WorkerDependencyReadinessStatus,
  WorkerReadinessStatus,
  checkWorkerProcessReadiness,
  createCockroachReadinessProbe,
} from "../src/index.ts";

const CockroachReadinessTestErrorMessage = {
  Unavailable: "cockroach unavailable",
} as const;

describe("Cockroach worker readiness probe", () => {
  test("reports ready when the generic SQL client can execute the readiness query", async () => {
    const client = createRecordingSqlClient();
    const probe = createCockroachReadinessProbe({
      client,
    });

    const result = await probe.check();

    deepEqual(result, {
      name: WorkerDependencyName.Cockroach,
      status: WorkerDependencyReadinessStatus.Ready,
    });
    deepEqual(client.queries, [{ sql: CockroachReadinessSql.SelectOne, parameters: [] }]);
  });

  test("reports degraded process readiness when the generic SQL client cannot execute the readiness query", async () => {
    const probe = createCockroachReadinessProbe({
      client: createFailingSqlClient(),
    });

    const readiness = await checkWorkerProcessReadiness({
      probes: [probe],
    });

    deepEqual(readiness, {
      status: WorkerReadinessStatus.Degraded,
      checks: [
        {
          name: WorkerDependencyName.Cockroach,
          status: WorkerDependencyReadinessStatus.NotReady,
          message: CockroachReadinessTestErrorMessage.Unavailable,
        },
      ],
    });
  });
});

function createRecordingSqlClient(): CockroachSqlClient & {
  queries: { sql: string; parameters: readonly unknown[] }[];
} {
  const queries: { sql: string; parameters: readonly unknown[] }[] = [];

  return {
    queries,
    query: async <Row = Record<string, unknown>>(sql: string, parameters?: readonly unknown[]) => {
      queries.push({
        sql,
        parameters: parameters ?? [],
      });

      return {
        rows: [] as Row[],
      };
    },
    transaction: async (operation) => await operation(createRecordingSqlClient()),
  };
}

function createFailingSqlClient(): CockroachSqlClient {
  return {
    query: async () => {
      throw new Error(CockroachReadinessTestErrorMessage.Unavailable);
    },
    transaction: async (operation) => await operation(createFailingSqlClient()),
  };
}
