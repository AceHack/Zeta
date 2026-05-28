import { deepEqual, equal, ok } from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { env } from "node:process";
import { describe, test } from "node:test";

import {
  CockroachMigrationStatement,
  CockroachTableName,
  WorkerDependencyName,
  WorkerDependencyReadinessStatus,
  WorkerProcessShutdownStatus,
  WorkerReadinessStatus,
  WorkerRuntimeStatus,
  createCockroachMigrationBootstrapper,
  createCockroachReadinessProbe,
  createCockroachWorkAnchorKernelMigration,
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
  ApplyWorkAnchorMigration: "integration_apply_work_anchor_migration",
  CreateLegacyWorkItemsTable: "integration_create_legacy_work_items_table",
  DropLegacyWorkItemsTable: "integration_drop_legacy_work_items_table",
  InsertDuplicateSequence: "integration_insert_duplicate_sequence",
  InsertInvalidSequence: "integration_insert_invalid_sequence",
  InsertLegacyWorkItem: "integration_insert_legacy_work_item",
  InsertWorkItemStateHistory: "integration_insert_work_item_state_history",
  InsertWorkItemWithoutTrace: "integration_insert_work_item_without_trace",
  SelectLegacyWorkItem: "integration_select_legacy_work_item",
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

type WorkAnchorMigrationRun = {
  sql: {
    CreateLegacyWorkItemsTable: string;
    DropLegacyWorkItemsTable: string;
    InsertDuplicateSequence: string;
    InsertInvalidSequence: string;
    InsertLegacyWorkItem: string;
    InsertWorkItemStateHistory: string;
    InsertWorkItemWithoutTrace: string;
    SelectLegacyWorkItem: string;
    WorkAnchorMigration: string;
  };
  workItemsTableName: string;
  workItemStateHistoryTableName: string;
};

type LegacyWorkItemRow = {
  causation_id: string;
  correlation_id: string;
  trace_id: string;
  updated_at: Date;
  version: string;
  work_item_type: string;
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

  test(
    "upgrades a legacy work-items table through the work-anchor kernel migration",
    {
      skip:
        env[CockroachIntegrationEnvName.DatabaseUrl] === undefined
          ? `${CockroachIntegrationEnvName.DatabaseUrl} is not set`
          : false,
    },
    async () => {
      const databaseUrl = readIntegrationDatabaseUrl();
      const run = createWorkAnchorMigrationRun();
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

      try {
        await executor.execute({
          name: CockroachIntegrationStatementName.CreateLegacyWorkItemsTable,
          sql: run.sql.CreateLegacyWorkItemsTable,
          parameters: [],
        });
        await executor.execute({
          name: CockroachIntegrationStatementName.InsertLegacyWorkItem,
          sql: run.sql.InsertLegacyWorkItem,
          parameters: [],
        });
        await executor.execute({
          name: CockroachIntegrationStatementName.ApplyWorkAnchorMigration,
          sql: run.sql.WorkAnchorMigration,
          parameters: [],
        });

        const rows = await executor.execute<LegacyWorkItemRow>({
          name: CockroachIntegrationStatementName.SelectLegacyWorkItem,
          sql: run.sql.SelectLegacyWorkItem,
          parameters: [],
        });

        equal(rows.rows.length, 1);
        equal(rows.rows[0]?.work_item_type, "task");
        equal(rows.rows[0]?.version, "1");
        equal(rows.rows[0]?.correlation_id, "migration-backfill");
        equal(rows.rows[0]?.causation_id, "migration-backfill");
        equal(rows.rows[0]?.trace_id, "migration-backfill");
        equal(rows.rows[0]?.updated_at.toISOString(), "2026-05-01T12:00:00.000Z");

        await assertInsertFails(executor, {
          name: CockroachIntegrationStatementName.InsertWorkItemWithoutTrace,
          sql: run.sql.InsertWorkItemWithoutTrace,
          parameters: [],
        });

        await executor.execute({
          name: CockroachIntegrationStatementName.InsertWorkItemStateHistory,
          sql: run.sql.InsertWorkItemStateHistory,
          parameters: [],
        });

        await assertInsertFails(executor, {
          name: CockroachIntegrationStatementName.InsertDuplicateSequence,
          sql: run.sql.InsertDuplicateSequence,
          parameters: [],
        });
        await assertInsertFails(executor, {
          name: CockroachIntegrationStatementName.InsertInvalidSequence,
          sql: run.sql.InsertInvalidSequence,
          parameters: [],
        });
      } finally {
        await executor.execute({
          name: CockroachIntegrationStatementName.DropLegacyWorkItemsTable,
          sql: run.sql.DropLegacyWorkItemsTable,
          parameters: [],
        }).catch(() => undefined);
        await createCockroachWorkerShutdownPort({
          pool,
        }).shutdown();
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

function createWorkAnchorMigrationRun(): WorkAnchorMigrationRun {
  const suffix = randomUUID().replaceAll("-", "_");
  const workItemsTableName = `${CockroachTableName.WorkItems}_${suffix}`;
  const workItemStateHistoryTableName = `${CockroachTableName.WorkItemStateHistory}_${suffix}`;
  assertSafeCockroachIdentifier(workItemsTableName);
  assertSafeCockroachIdentifier(workItemStateHistoryTableName);

  return {
    sql: createWorkAnchorMigrationSql(workItemsTableName, workItemStateHistoryTableName),
    workItemsTableName,
    workItemStateHistoryTableName,
  };
}

function createWorkAnchorMigrationSql(
  workItemsTableName: string,
  workItemStateHistoryTableName: string,
): WorkAnchorMigrationRun["sql"] {
  const workAnchorMigration = createCockroachWorkAnchorKernelMigration().sql
    .replaceAll(CockroachTableName.WorkItems, workItemsTableName)
    .replaceAll(CockroachTableName.WorkItemStateHistory, workItemStateHistoryTableName);

  return {
    CreateLegacyWorkItemsTable: `
CREATE TABLE IF NOT EXISTS ${workItemsTableName} (
  work_item_id STRING PRIMARY KEY,
  organization_id STRING NOT NULL,
  project_id STRING NOT NULL,
  title STRING NOT NULL,
  description STRING NOT NULL,
  state STRING NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  created_by_agent_id STRING NOT NULL,
  created_by_hat_assignment_id STRING NOT NULL
);`.trim(),
    DropLegacyWorkItemsTable: `
DROP TABLE IF EXISTS ${workItemStateHistoryTableName};
DROP TABLE IF EXISTS ${workItemsTableName};`.trim(),
    InsertLegacyWorkItem: `
INSERT INTO ${workItemsTableName} (
  work_item_id,
  organization_id,
  project_id,
  title,
  description,
  state,
  created_at,
  created_by_agent_id,
  created_by_hat_assignment_id
) VALUES (
  'legacy-work-item',
  'org-live-migration',
  'project-live-migration',
  'Legacy work item',
  'Legacy row before V3 migration',
  'created',
  '2026-05-01T12:00:00.000Z',
  'agent-live-migration',
  'hat-live-migration'
);`.trim(),
    InsertWorkItemWithoutTrace: `
INSERT INTO ${workItemsTableName} (
  work_item_id,
  organization_id,
  project_id,
  title,
  description,
  state,
  created_at,
  created_by_agent_id,
  created_by_hat_assignment_id,
  work_item_type,
  updated_at,
  version
) VALUES (
  'missing-trace-work-item',
  'org-live-migration',
  'project-live-migration',
  'Missing trace item',
  'Should fail because trace columns have no durable defaults',
  'created',
  '2026-05-01T12:00:00.000Z',
  'agent-live-migration',
  'hat-live-migration',
  'task',
  '2026-05-01T12:00:00.000Z',
  1
);`.trim(),
    InsertWorkItemStateHistory: `
INSERT INTO ${workItemStateHistoryTableName} (
  work_state_transition_id,
  organization_id,
  project_id,
  work_item_id,
  sequence,
  from_state,
  to_state,
  evidence_artifact_ids,
  transitioned_at,
  transitioned_by_agent_id,
  transitioned_by_hat_assignment_id,
  correlation_id,
  causation_id,
  trace_id
) VALUES (
  'transition-1',
  'org-live-migration',
  'project-live-migration',
  'legacy-work-item',
  1,
  'created',
  'intake',
  '[]':::JSONB,
  '2026-05-01T12:10:00.000Z',
  'agent-live-migration',
  'hat-live-migration',
  'correlation-live-migration',
  'causation-live-migration',
  'trace-live-migration'
);`.trim(),
    InsertDuplicateSequence: `
INSERT INTO ${workItemStateHistoryTableName} (
  work_state_transition_id,
  organization_id,
  project_id,
  work_item_id,
  sequence,
  from_state,
  to_state,
  evidence_artifact_ids,
  transitioned_at,
  transitioned_by_agent_id,
  transitioned_by_hat_assignment_id,
  correlation_id,
  causation_id,
  trace_id
) VALUES (
  'transition-duplicate',
  'org-live-migration',
  'project-live-migration',
  'legacy-work-item',
  1,
  'intake',
  'triage',
  '[]':::JSONB,
  '2026-05-01T12:20:00.000Z',
  'agent-live-migration',
  'hat-live-migration',
  'correlation-live-migration',
  'causation-live-migration',
  'trace-live-migration'
);`.trim(),
    InsertInvalidSequence: `
INSERT INTO ${workItemStateHistoryTableName} (
  work_state_transition_id,
  organization_id,
  project_id,
  work_item_id,
  sequence,
  from_state,
  to_state,
  evidence_artifact_ids,
  transitioned_at,
  transitioned_by_agent_id,
  transitioned_by_hat_assignment_id,
  correlation_id,
  causation_id,
  trace_id
) VALUES (
  'transition-invalid',
  'org-live-migration',
  'project-live-migration',
  'other-work-item',
  0,
  'created',
  'intake',
  '[]':::JSONB,
  '2026-05-01T12:30:00.000Z',
  'agent-live-migration',
  'hat-live-migration',
  'correlation-live-migration',
  'causation-live-migration',
  'trace-live-migration'
);`.trim(),
    SelectLegacyWorkItem: `
SELECT work_item_type, updated_at, version, correlation_id, causation_id, trace_id
FROM ${workItemsTableName}
WHERE work_item_id = 'legacy-work-item';`.trim(),
    WorkAnchorMigration: workAnchorMigration,
  };
}

async function assertInsertFails(
  executor: ReturnType<typeof createCockroachSqlExecutor>,
  statement: CockroachAnySqlStatement,
): Promise<void> {
  let didFail = false;
  try {
    await executor.execute(statement);
  } catch {
    didFail = true;
  }
  ok(didFail);
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
