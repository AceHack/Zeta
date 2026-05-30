import { deepEqual } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CockroachMigrationStatement,
  createCockroachCoreStateMigrations,
  createCockroachCoreStateMigration,
  createCockroachMigrationRunner,
  splitSqlStatements,
  type CockroachAnySqlStatement,
  type CockroachGenericSqlExecutor,
} from "../src/index.ts";

describe("cockroach migration runner", () => {
  test("applies each statement of a migration separately (CockroachDB DDL+DML txn rule)", async () => {
    const executor = createRecordingSqlExecutor();
    const migration = createCockroachCoreStateMigration();
    const runner = createCockroachMigrationRunner({
      executor,
      migrations: [migration],
    });

    await runner.applyMigrations();

    // each statement of the migration is executed on its own — never the whole
    // multi-statement SQL as one query (which Cockroach runs as one implicit txn)
    deepEqual(
      executor.statements,
      splitSqlStatements(migration.sql).map((sql) => ({
        name: CockroachMigrationStatement.ApplyMigration,
        sql,
        parameters: [],
      })),
    );
  });

  test("applies ordered core migrations as a flat, ordered statement stream", async () => {
    const executor = createRecordingSqlExecutor();
    const migrations = createCockroachCoreStateMigrations();
    const runner = createCockroachMigrationRunner({
      executor,
      migrations,
    });

    await runner.applyMigrations();

    // the executed statements equal every migration's statements, in order
    deepEqual(
      executor.statements.map((statement) => statement.sql),
      migrations.flatMap((migration) => splitSqlStatements(migration.sql)),
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
