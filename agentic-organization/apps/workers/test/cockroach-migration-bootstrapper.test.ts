import { deepEqual, equal, rejects } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CockroachCoreStateMigrationName,
  CockroachMigrationStatement,
  createCockroachCoreStateMigrations,
  type CockroachAnySqlStatement,
  type CockroachGenericSqlExecutor,
} from "../../../packages/state-cockroach/src/index.ts";
import { WorkerProcessBootstrapperName, createCockroachMigrationBootstrapper } from "../src/index.ts";

const TestCockroachMigrationSql = {
  AddExampleColumn: "ALTER TABLE IF EXISTS agentic_org_test_example ADD COLUMN IF NOT EXISTS value STRING",
  CreateExampleTable: "CREATE TABLE IF NOT EXISTS agentic_org_test_example (id STRING PRIMARY KEY)",
} as const;

const TestCockroachMigrationErrorMessage = {
  Failed: "migration executor failed",
} as const;

describe("Cockroach migration bootstrapper", () => {
  test("applies ordered core migrations through the generic SQL executor", async () => {
    const executor = createRecordingSqlExecutor();
    const bootstrapper = createCockroachMigrationBootstrapper({
      executor,
    });

    equal(bootstrapper.name, WorkerProcessBootstrapperName.CockroachMigrations);

    await bootstrapper.bootstrap();

    deepEqual(
      executor.statements.map((statement) => statement.name),
      createCockroachCoreStateMigrations().map(() => CockroachMigrationStatement.ApplyMigration),
    );
    deepEqual(
      executor.statements.map((statement) => statement.sql),
      createCockroachCoreStateMigrations().map((migration) => migration.sql),
    );
  });

  test("applies caller-provided migrations instead of default core migrations", async () => {
    const executor = createRecordingSqlExecutor();
    const bootstrapper = createCockroachMigrationBootstrapper({
      executor,
      migrations: [
        {
          name: CockroachCoreStateMigrationName.CoreStateV1,
          sql: TestCockroachMigrationSql.CreateExampleTable,
        },
        {
          name: CockroachCoreStateMigrationName.OutboxClaimFenceV2,
          sql: TestCockroachMigrationSql.AddExampleColumn,
        },
      ],
    });

    await bootstrapper.bootstrap();

    deepEqual(executor.statements, [
      {
        name: CockroachMigrationStatement.ApplyMigration,
        sql: TestCockroachMigrationSql.CreateExampleTable,
        parameters: [],
      },
      {
        name: CockroachMigrationStatement.ApplyMigration,
        sql: TestCockroachMigrationSql.AddExampleColumn,
        parameters: [],
      },
    ]);
  });

  test("surfaces migration executor failures to the worker bootstrap lifecycle", async () => {
    const bootstrapper = createCockroachMigrationBootstrapper({
      executor: createFailingSqlExecutor(),
      migrations: [
        {
          name: CockroachCoreStateMigrationName.CoreStateV1,
          sql: TestCockroachMigrationSql.CreateExampleTable,
        },
      ],
    });

    await rejects(
      async () => await bootstrapper.bootstrap(),
      (error: unknown) => error instanceof Error && error.message === TestCockroachMigrationErrorMessage.Failed,
    );
  });
});

function createRecordingSqlExecutor(): CockroachGenericSqlExecutor & {
  statements: { name: string; sql: string; parameters: readonly unknown[] }[];
} {
  const statements: { name: string; sql: string; parameters: readonly unknown[] }[] = [];

  return {
    statements,
    execute: async <Row = Record<string, unknown>>(statement: CockroachAnySqlStatement) => {
      statements.push(statement);

      return {
        rows: [] as Row[],
      };
    },
    executeTransaction: async (operation) =>
      await operation({
        execute: async <Row = Record<string, unknown>>(statement: CockroachAnySqlStatement) => {
          statements.push(statement);

          return {
            rows: [] as Row[],
          };
        },
      }),
  };
}

function createFailingSqlExecutor(): CockroachGenericSqlExecutor {
  return {
    execute: async () => {
      throw new Error(TestCockroachMigrationErrorMessage.Failed);
    },
    executeTransaction: async () => {
      throw new Error(TestCockroachMigrationErrorMessage.Failed);
    },
  };
}
