import { deepEqual, equal, ok } from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { env } from "node:process";
import { describe, test } from "node:test";

import {
  CockroachMigrationStatement,
  WorkerDependencyName,
  WorkerDependencyReadinessStatus,
  WorkerProcessShutdownStatus,
  WorkerReadinessStatus,
  WorkerRuntimeStatus,
  createCockroachMigrationBootstrapper,
  createCockroachReadinessProbe,
  createCockroachSqlExecutor,
  createCockroachWorkerShutdownPort,
  createCockroachWorkerSqlClient,
  createPgCockroachWorkerPool,
  createWorkerProcess,
  type CockroachAnySqlStatement,
} from "../src/index.ts";

const CockroachIntegrationEnvName = {
  DatabaseUrl: "AGENTIC_ORG_COCKROACH_INTEGRATION_DATABASE_URL",
} as const;

const CockroachIntegrationTableNamePrefix = {
  Probe: "agentic_org_integration_probe",
} as const;

const CockroachIntegrationProbeValue = {
  Committed: "committed",
  RolledBack: "rolled_back",
} as const;

const CockroachIntegrationProbeId = {
  Commit: "commit-probe",
  Rollback: "rollback-probe",
} as const;

const CockroachIntegrationStatementName = {
  CreateProbeTable: "integration_create_probe_table",
  DeleteProbe: "integration_delete_probe",
  DeleteProbeBeforeRollback: "integration_delete_probe_before_rollback",
  DropProbeTable: "integration_drop_probe_table",
  InsertProbe: "integration_insert_probe",
  InsertProbeBeforeRollback: "integration_insert_probe_before_rollback",
  SelectProbe: "integration_select_probe",
  SelectRolledBackProbe: "integration_select_rolled_back_probe",
} as const;

const CockroachIntegrationRuntimeErrorMessage = {
  RollbackProbe: "rollback probe",
} as const;

type CockroachIntegrationRun = {
  sql: CockroachIntegrationSql;
  tableName: string;
};

type CockroachIntegrationSql = {
  CreateProbeTable: string;
  DeleteProbe: string;
  DropProbeTable: string;
  InsertProbe: string;
  SelectProbe: string;
};

describe("Cockroach worker live integration", () => {
  test(
    "applies migrations, reports readiness, commits transactions, rolls back failures, and shuts down",
    {
      skip:
        env[CockroachIntegrationEnvName.DatabaseUrl] === undefined
          ? `${CockroachIntegrationEnvName.DatabaseUrl} is not set`
          : false,
    },
    async () => {
      const databaseUrl = readIntegrationDatabaseUrl();
      const run = createCockroachIntegrationRun();
      const pool = await createPgCockroachWorkerPool({
        databaseUrl,
      });
      const sqlClient = createCockroachWorkerSqlClient({
        pool,
        maxTransactionAttempts: 2,
      });
      const executor = createCockroachSqlExecutor({
        client: sqlClient,
      });
      const executedStatements: string[] = [];
      const recordingExecutor = createRecordingExecutor(executor, executedStatements);
      const process = createWorkerProcess({
        bootstrappers: [
          createCockroachMigrationBootstrapper({
            executor: recordingExecutor,
          }),
        ],
        readinessProbes: [
          createCockroachReadinessProbe({
            client: sqlClient,
          }),
        ],
        runtime: {
          runOnce: async () => ({
            failures: [],
            natsConsumerBatch: undefined,
            status: WorkerRuntimeStatus.Healthy,
            workerCycle: undefined,
          }),
        },
        shutdownPorts: [
          createCockroachWorkerShutdownPort({
            pool,
          }),
        ],
      });

      try {
        const runResult = await process.runOnce();

        equal(runResult.status, WorkerRuntimeStatus.Healthy);
        equal(runResult.readiness?.status, WorkerReadinessStatus.Ready);
        deepEqual(runResult.failures, []);
        ok(executedStatements.includes(CockroachMigrationStatement.ApplyMigration));

        await executor.execute({
          name: CockroachIntegrationStatementName.CreateProbeTable,
          sql: run.sql.CreateProbeTable,
          parameters: [],
        });
        await executor.executeTransaction(async (transaction) => {
          await transaction.execute({
            name: CockroachIntegrationStatementName.DeleteProbe,
            sql: run.sql.DeleteProbe,
            parameters: [CockroachIntegrationProbeId.Commit],
          });
          await transaction.execute({
            name: CockroachIntegrationStatementName.InsertProbe,
            sql: run.sql.InsertProbe,
            parameters: [CockroachIntegrationProbeId.Commit, CockroachIntegrationProbeValue.Committed],
          });
        });

        const committedProbe = await executor.execute<{ value: string }>({
          name: CockroachIntegrationStatementName.SelectProbe,
          sql: run.sql.SelectProbe,
          parameters: [CockroachIntegrationProbeId.Commit],
        });

        deepEqual(committedProbe.rows, [{ value: CockroachIntegrationProbeValue.Committed }]);

        await assertRollbackKeepsProbeAbsent(executor, run);

        const readiness = await createCockroachReadinessProbe({
          client: sqlClient,
        }).check();

        deepEqual(readiness, {
          name: WorkerDependencyName.Cockroach,
          status: WorkerDependencyReadinessStatus.Ready,
        });
      } finally {
        await dropProbeTable(executor, run);

        const shutdownResult = await process.shutdown();

        deepEqual(shutdownResult, {
          status: WorkerProcessShutdownStatus.Completed,
          closedPortNames: [WorkerDependencyName.Cockroach],
          failures: [],
        });
      }
    },
  );
});

async function dropProbeTable(
  executor: ReturnType<typeof createCockroachSqlExecutor>,
  run: CockroachIntegrationRun,
): Promise<void> {
  try {
    await executor.execute({
      name: CockroachIntegrationStatementName.DropProbeTable,
      sql: run.sql.DropProbeTable,
      parameters: [],
    });
  } catch {
    // Cleanup is best-effort because a failed integration setup may not have created the per-run table.
  }
}

async function assertRollbackKeepsProbeAbsent(
  executor: ReturnType<typeof createCockroachSqlExecutor>,
  run: CockroachIntegrationRun,
): Promise<void> {
  await executor.execute({
    name: CockroachIntegrationStatementName.DeleteProbeBeforeRollback,
    sql: run.sql.DeleteProbe,
    parameters: [CockroachIntegrationProbeId.Rollback],
  });

  await executor.executeTransaction(async (transaction) => {
    await transaction.execute({
      name: CockroachIntegrationStatementName.InsertProbeBeforeRollback,
      sql: run.sql.InsertProbe,
      parameters: [CockroachIntegrationProbeId.Rollback, CockroachIntegrationProbeValue.RolledBack],
    });
    throw new Error(CockroachIntegrationRuntimeErrorMessage.RollbackProbe);
  }).catch((error: unknown) => {
    if (!(error instanceof Error) || error.message !== CockroachIntegrationRuntimeErrorMessage.RollbackProbe) {
      throw error;
    }
  });

  const rolledBackProbe = await executor.execute<{ value: string }>({
    name: CockroachIntegrationStatementName.SelectRolledBackProbe,
    sql: run.sql.SelectProbe,
    parameters: [CockroachIntegrationProbeId.Rollback],
  });

  deepEqual(rolledBackProbe.rows, []);
}

function createCockroachIntegrationRun(): CockroachIntegrationRun {
  const tableName = `${CockroachIntegrationTableNamePrefix.Probe}_${randomUUID().replaceAll("-", "_")}`;

  return {
    sql: createCockroachIntegrationSql(tableName),
    tableName,
  };
}

function createCockroachIntegrationSql(tableName: string): CockroachIntegrationSql {
  assertSafeCockroachIdentifier(tableName);

  return {
    CreateProbeTable: `CREATE TABLE IF NOT EXISTS ${tableName} (id STRING PRIMARY KEY, value STRING NOT NULL)`,
    DeleteProbe: `DELETE FROM ${tableName} WHERE id = $1`,
    DropProbeTable: `DROP TABLE IF EXISTS ${tableName}`,
    InsertProbe: `INSERT INTO ${tableName} (id, value) VALUES ($1, $2)`,
    SelectProbe: `SELECT value FROM ${tableName} WHERE id = $1`,
  };
}

function assertSafeCockroachIdentifier(identifier: string): void {
  if (!/^[a-z][a-z0-9_]*$/.test(identifier)) {
    throw new Error(`unsafe Cockroach integration identifier: ${identifier}`);
  }
}

function createRecordingExecutor(
  executor: ReturnType<typeof createCockroachSqlExecutor>,
  executedStatements: string[],
): ReturnType<typeof createCockroachSqlExecutor> {
  return {
    execute: async (statement) => {
      executedStatements.push(statement.name);
      return await executor.execute(statement);
    },
    executeTransaction: async (operation) =>
      await executor.executeTransaction(
        async (transaction) =>
          await operation({
            execute: async (statement: CockroachAnySqlStatement) => {
              executedStatements.push(statement.name);
              return await transaction.execute(statement);
            },
          }),
      ),
  };
}

function readIntegrationDatabaseUrl(): string {
  const databaseUrl = env[CockroachIntegrationEnvName.DatabaseUrl];

  if (databaseUrl === undefined || databaseUrl.trim().length === 0) {
    throw new Error(`${CockroachIntegrationEnvName.DatabaseUrl} is required for Cockroach integration tests`);
  }

  return databaseUrl.trim();
}
