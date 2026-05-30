import { deepEqual, equal, rejects } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CockroachWorkerTransactionError,
  CockroachWorkerTransactionErrorCode,
  CockroachWorkerTransactionErrorClassification,
  CockroachWorkerTransactionStatement,
  createCockroachWorkerShutdownPort,
  createCockroachWorkerSqlClient,
  type CockroachWorkerPoolClient,
} from "../src/adapters/cockroach-worker-client.ts";
import {
  WorkerDependencyName,
  WorkerProcessShutdownStatus,
  WorkerRuntimeStatus,
  createWorkerProcess,
} from "../src/index.ts";

const TestSqlStatement = {
  SelectProbeValue: "select $1::string as value",
  InsertRuntimeProbe: "insert into agentic_org_runtime_probe(value) values ($1)",
} as const;

type TestSqlStatement = (typeof TestSqlStatement)[keyof typeof TestSqlStatement];

describe("Cockroach worker SQL client", () => {
  test("executes direct queries through a pooled client and releases it", async () => {
    const pool = createRecordingPool();
    const client = createCockroachWorkerSqlClient({
      pool,
    });

    const result = await client.query(TestSqlStatement.SelectProbeValue, ["agentic-org"]);

    deepEqual(result.rows, [{ value: "agentic-org" }]);
    deepEqual(pool.clients[0]?.statements, [
      {
        sql: TestSqlStatement.SelectProbeValue,
        parameters: ["agentic-org"],
      },
    ]);
    equal(pool.clients[0]?.releaseCount, 1);
  });

  test("commits transactions and releases the transaction client", async () => {
    const pool = createRecordingPool();
    const client = createCockroachWorkerSqlClient({
      pool,
    });

    const result = await client.transaction(async (transactionClient) => {
      await transactionClient.query(TestSqlStatement.InsertRuntimeProbe, ["ok"]);
      return "committed";
    });

    equal(result, "committed");
    deepEqual(
      pool.clients[0]?.statements.map((statement) => statement.sql),
      [
        CockroachWorkerTransactionStatement.Begin,
        TestSqlStatement.InsertRuntimeProbe,
        CockroachWorkerTransactionStatement.Commit,
      ],
    );
    equal(pool.clients[0]?.releaseCount, 1);
  });

  test("rolls back transactions on operation failure and releases the transaction client", async () => {
    const pool = createRecordingPool();
    const client = createCockroachWorkerSqlClient({
      pool,
    });

    await rejects(
      async () =>
        await client.transaction(async (transactionClient) => {
          await transactionClient.query(TestSqlStatement.InsertRuntimeProbe, ["nope"]);
          throw new Error("operation failed");
        }),
      (error: unknown) => error instanceof Error && error.message === "operation failed",
    );

    deepEqual(
      pool.clients[0]?.statements.map((statement) => statement.sql),
      [
        CockroachWorkerTransactionStatement.Begin,
        TestSqlStatement.InsertRuntimeProbe,
        CockroachWorkerTransactionStatement.Rollback,
      ],
    );
    equal(pool.clients[0]?.releaseCount, 1);
  });

  test("rolls back and releases when commit fails", async () => {
    const pool = createRecordingPool({
      failOnSql: CockroachWorkerTransactionStatement.Commit,
    });
    const client = createCockroachWorkerSqlClient({
      pool,
    });

    await rejects(
      async () =>
        await client.transaction(async (transactionClient) => {
          await transactionClient.query(TestSqlStatement.InsertRuntimeProbe, ["ok"]);
        }),
      (error: unknown) =>
        error instanceof Error && error.message === `query failed for ${CockroachWorkerTransactionStatement.Commit}`,
    );

    deepEqual(
      pool.clients[0]?.statements.map((statement) => statement.sql),
      [
        CockroachWorkerTransactionStatement.Begin,
        TestSqlStatement.InsertRuntimeProbe,
        CockroachWorkerTransactionStatement.Commit,
        CockroachWorkerTransactionStatement.Rollback,
      ],
    );
    equal(pool.clients[0]?.releaseCount, 1);
  });

  test("retries retryable transaction failures with a fresh pooled client", async () => {
    const pool = createRecordingPool({
      failOnceOnSql: TestSqlStatement.InsertRuntimeProbe,
    });
    const retryDelays: number[] = [];
    const client = createCockroachWorkerSqlClient({
      pool,
      maxTransactionAttempts: 2,
      classifyTransactionError: () => CockroachWorkerTransactionErrorClassification.Retryable,
      waitBeforeRetry: async ({ attempt }) => {
        retryDelays.push(attempt);
      },
    });

    const result = await client.transaction(async (transactionClient) => {
      await transactionClient.query(TestSqlStatement.InsertRuntimeProbe, ["eventually"]);
      return "committed-after-retry";
    });

    equal(result, "committed-after-retry");
    equal(pool.clients.length, 2);
    deepEqual(
      pool.clients[0]?.statements.map((statement) => statement.sql),
      [
        CockroachWorkerTransactionStatement.Begin,
        TestSqlStatement.InsertRuntimeProbe,
        CockroachWorkerTransactionStatement.Rollback,
      ],
    );
    deepEqual(
      pool.clients[1]?.statements.map((statement) => statement.sql),
      [
        CockroachWorkerTransactionStatement.Begin,
        TestSqlStatement.InsertRuntimeProbe,
        CockroachWorkerTransactionStatement.Commit,
      ],
    );
    deepEqual(retryDelays, [1]);
    equal(pool.clients[0]?.releaseCount, 1);
    equal(pool.clients[1]?.releaseCount, 1);
  });

  test("uses default SQLSTATE classifier for Cockroach retryable transaction failures", async () => {
    const pool = createRecordingPool({
      failOnceOnSql: TestSqlStatement.InsertRuntimeProbe,
      failOnceErrorCode: CockroachSqlState.SerializationFailure,
    });
    const client = createCockroachWorkerSqlClient({
      pool,
      maxTransactionAttempts: 2,
    });

    const result = await client.transaction(async (transactionClient) => {
      await transactionClient.query(TestSqlStatement.InsertRuntimeProbe, ["default-retry"]);
      return "committed-after-default-retry";
    });

    equal(result, "committed-after-default-retry");
    equal(pool.clients.length, 2);
  });

  test("does not retry ambiguous commit failures", async () => {
    const pool = createRecordingPool({
      failOnSql: CockroachWorkerTransactionStatement.Commit,
    });
    const client = createCockroachWorkerSqlClient({
      pool,
      maxTransactionAttempts: 2,
      classifyTransactionError: () => CockroachWorkerTransactionErrorClassification.AmbiguousCommit,
    });

    await rejects(
      async () =>
        await client.transaction(async (transactionClient) => {
          await transactionClient.query(TestSqlStatement.InsertRuntimeProbe, ["maybe"]);
        }),
      (error: unknown) =>
        error instanceof CockroachWorkerTransactionError &&
        error.code === CockroachWorkerTransactionErrorCode.AmbiguousCommit,
    );

    equal(pool.clients.length, 1);
    equal(pool.clients[0]?.releaseCount, 1);
  });

  test("uses default SQLSTATE classifier for Cockroach ambiguous commit failures", async () => {
    const pool = createRecordingPool({
      failOnSql: CockroachWorkerTransactionStatement.Commit,
      failErrorCode: CockroachSqlState.TransactionResolutionUnknown,
    });
    const client = createCockroachWorkerSqlClient({
      pool,
      maxTransactionAttempts: 2,
    });

    await rejects(
      async () =>
        await client.transaction(async (transactionClient) => {
          await transactionClient.query(TestSqlStatement.InsertRuntimeProbe, ["ambiguous"]);
        }),
      (error: unknown) =>
        error instanceof CockroachWorkerTransactionError &&
        error.code === CockroachWorkerTransactionErrorCode.AmbiguousCommit,
    );

    equal(pool.clients.length, 1);
  });

  test("preserves ambiguous commit when rollback cleanup also fails", async () => {
    const pool = createRecordingPool({
      failOnSql: CockroachWorkerTransactionStatement.Commit,
      failErrorCode: CockroachSqlState.TransactionResolutionUnknown,
      failRollback: true,
    });
    const client = createCockroachWorkerSqlClient({
      pool,
    });

    await rejects(
      async () =>
        await client.transaction(async (transactionClient) => {
          await transactionClient.query(TestSqlStatement.InsertRuntimeProbe, ["ambiguous-rollback"]);
        }),
      (error: unknown) =>
        error instanceof CockroachWorkerTransactionError &&
        error.code === CockroachWorkerTransactionErrorCode.AmbiguousCommit &&
        error.cause instanceof Error &&
        "code" in error.cause &&
        error.cause.code === CockroachSqlState.TransactionResolutionUnknown &&
        error.rollbackCause instanceof Error &&
        error.rollbackCause.message === `query failed for ${CockroachWorkerTransactionStatement.Rollback}`,
    );

    equal(pool.clients[0]?.releaseCount, 1);
  });

  test("preserves the original transaction error when rollback also fails", async () => {
    const pool = createRecordingPool({
      failOnSql: TestSqlStatement.InsertRuntimeProbe,
      failRollback: true,
    });
    const client = createCockroachWorkerSqlClient({
      pool,
    });

    await rejects(
      async () =>
        await client.transaction(async (transactionClient) => {
          await transactionClient.query(TestSqlStatement.InsertRuntimeProbe, ["rollback-fails"]);
        }),
      (error: unknown) =>
        error instanceof CockroachWorkerTransactionError &&
        error.code === CockroachWorkerTransactionErrorCode.RollbackFailed &&
        error.cause instanceof Error &&
        error.cause.message === `query failed for ${TestSqlStatement.InsertRuntimeProbe}` &&
        error.rollbackCause instanceof Error &&
        error.rollbackCause.message === `query failed for ${CockroachWorkerTransactionStatement.Rollback}`,
    );

    equal(pool.clients[0]?.releaseCount, 1);
  });

  test("exposes Cockroach pool shutdown through the generic worker process shutdown port", async () => {
    const pool = createRecordingShutdownPool();
    const shutdownPort = createCockroachWorkerShutdownPort({
      pool,
    });

    const result = await createWorkerProcess({
      bootstrappers: [],
      readinessProbes: [],
      runtime: createNoopRuntime(),
      shutdownPorts: [shutdownPort],
    }).shutdown();

    deepEqual(result, {
      status: WorkerProcessShutdownStatus.Completed,
      closedPortNames: [WorkerDependencyName.Cockroach],
      failures: [],
    });
    equal(pool.endCallCount, 1);
  });
});

type RecordingPoolOptions = {
  failOnSql?: TestSqlStatement | CockroachWorkerTransactionStatement;
  failErrorCode?: CockroachSqlState;
  failOnceOnSql?: TestSqlStatement | CockroachWorkerTransactionStatement;
  failOnceErrorCode?: CockroachSqlState;
  failRollback?: boolean;
};

const CockroachSqlState = {
  SerializationFailure: "40001",
  TransactionResolutionUnknown: "40003",
} as const;

type CockroachSqlState = (typeof CockroachSqlState)[keyof typeof CockroachSqlState];

function createRecordingPool(options: RecordingPoolOptions = {}): {
  clients: RecordingCockroachWorkerPoolClient[];
  connect: () => Promise<CockroachWorkerPoolClient>;
} {
  const clients: RecordingCockroachWorkerPoolClient[] = [];
  const failedOnceStatements = new Set<string>();

  return {
    clients,
    connect: async () => {
      const client = createRecordingPoolClient(options, failedOnceStatements);
      clients.push(client);
      return client;
    },
  };
}

type RecordingCockroachWorkerPoolClient = CockroachWorkerPoolClient & {
  statements: {
    sql: string;
    parameters: readonly unknown[];
  }[];
  releaseCount: number;
};

function createRecordingPoolClient(
  options: RecordingPoolOptions,
  failedOnceStatements: Set<string>,
): RecordingCockroachWorkerPoolClient {
  const statements: {
    sql: string;
    parameters: readonly unknown[];
  }[] = [];

  return {
    statements,
    releaseCount: 0,
    query: async <Row = Record<string, unknown>>(sql: string, parameters: readonly unknown[] = []) => {
      statements.push({
        sql,
        parameters,
      });

      if (options.failRollback && sql === CockroachWorkerTransactionStatement.Rollback) {
        throw new Error(`query failed for ${sql}`);
      }

      if (options.failOnSql === sql) {
        throw createQueryError(sql, options.failErrorCode);
      }

      if (options.failOnceOnSql === sql && !failedOnceStatements.has(sql)) {
        failedOnceStatements.add(sql);
        throw createQueryError(sql, options.failOnceErrorCode);
      }

      return {
        rows: resolveRows<Row>(sql, parameters),
      };
    },
    release() {
      this.releaseCount += 1;
    },
  };
}

function createQueryError(sql: string, code: CockroachSqlState | undefined): Error & { code?: CockroachSqlState } {
  const error: Error & { code?: CockroachSqlState } = new Error(`query failed for ${sql}`);

  if (code !== undefined) {
    error.code = code;
  }

  return error;
}

function resolveRows<Row>(sql: string, parameters: readonly unknown[]): Row[] {
  if (sql === TestSqlStatement.SelectProbeValue) {
    return [{ value: parameters[0] }] as Row[];
  }

  return [];
}

function createRecordingShutdownPool(): {
  endCallCount: number;
  end: () => Promise<void>;
} {
  return {
    endCallCount: 0,
    end: async function end() {
      this.endCallCount += 1;
    },
  };
}

function createNoopRuntime() {
  return {
    runOnce: async () => ({
      status: WorkerRuntimeStatus.Healthy,
      keepAlive: undefined,
      workerCycle: undefined,
      natsConsumerBatch: undefined,
      failures: [],
    }),
  };
}
