import { deepEqual, equal, rejects } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  PgCockroachWorkerPoolError,
  PgCockroachWorkerPoolErrorCode,
  createPgCockroachWorkerPool,
  type PgCockroachDriverModule,
} from "../src/index.ts";

const TestCockroachDatabaseUrl = {
  Local: "postgresql://root@localhost:26257/agentic_org",
} as const;

const TestSqlStatement = {
  SelectValue: "SELECT $1::STRING AS value",
} as const;

describe("pg-compatible Cockroach worker pool adapter", () => {
  test("loads the pg-compatible driver and adapts query rows through the generic worker pool contract", async () => {
    const driver = createRecordingPgDriver();
    const pool = await createPgCockroachWorkerPool({
      databaseUrl: TestCockroachDatabaseUrl.Local,
      loadDriver: async () => driver,
    });

    const client = await pool.connect();
    const result = await client.query<{ value: string }>(TestSqlStatement.SelectValue, ["agentic-org"]);
    client.release();
    await pool.end();

    deepEqual(result.rows, [{ value: "agentic-org" }]);
    deepEqual(driver.constructedPools, [{ connectionString: TestCockroachDatabaseUrl.Local }]);
    deepEqual(driver.pool.clients[0]?.queries, [
      {
        sql: TestSqlStatement.SelectValue,
        parameters: ["agentic-org"],
      },
    ]);
    equal(driver.pool.clients[0]?.releaseCount, 1);
    equal(driver.pool.endCallCount, 1);
  });

  test("rejects an invalid pg-compatible driver module before creating a pool", async () => {
    await rejects(
      async () =>
        await createPgCockroachWorkerPool({
          databaseUrl: TestCockroachDatabaseUrl.Local,
          loadDriver: async () => ({}),
        }),
      (error: unknown) =>
        error instanceof PgCockroachWorkerPoolError &&
        error.code === PgCockroachWorkerPoolErrorCode.InvalidDriverModule,
    );
  });
});

function createRecordingPgDriver(): PgCockroachDriverModule & {
  constructedPools: { connectionString: string }[];
  pool: RecordingPgPool;
} {
  const constructedPools: { connectionString: string }[] = [];
  const pool = createRecordingPgPool();

  return {
    constructedPools,
    pool,
    Pool: class RecordingPoolConstructor implements RecordingPgPool {
      readonly clients = pool.clients;

      get endCallCount(): number {
        return pool.endCallCount;
      }

      constructor(input: { connectionString: string }) {
        constructedPools.push(input);
      }

      async connect(): Promise<RecordingPgPoolClient> {
        return await pool.connect();
      }

      async end(): Promise<void> {
        await pool.end();
      }
    },
  };
}

type RecordingPgPool = {
  clients: RecordingPgPoolClient[];
  endCallCount: number;
  connect: () => Promise<RecordingPgPoolClient>;
  end: () => Promise<void>;
};

type RecordingPgPoolClient = {
  queries: { sql: string; parameters: readonly unknown[] }[];
  releaseCount: number;
  query: <Row = Record<string, unknown>>(
    sql: string,
    parameters?: readonly unknown[],
  ) => Promise<{ rows: Row[] }>;
  release: () => void;
};

function createRecordingPgPool(): RecordingPgPool {
  const pool: RecordingPgPool = {
    clients: [],
    endCallCount: 0,
    connect: async () => {
      const client = createRecordingPgPoolClient();
      pool.clients.push(client);
      return client;
    },
    end: async () => {
      pool.endCallCount += 1;
    },
  };

  return pool;
}

function createRecordingPgPoolClient(): RecordingPgPoolClient {
  return {
    queries: [],
    releaseCount: 0,
    async query<Row = Record<string, unknown>>(sql: string, parameters: readonly unknown[] = []) {
      this.queries.push({
        sql,
        parameters,
      });

      return {
        rows: resolveRows<Row>(sql, parameters),
      };
    },
    release() {
      this.releaseCount += 1;
    },
  };
}

function resolveRows<Row>(sql: string, parameters: readonly unknown[]): Row[] {
  if (sql === TestSqlStatement.SelectValue) {
    return [{ value: parameters[0] }] as Row[];
  }

  return [];
}
