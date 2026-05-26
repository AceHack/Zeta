import { deepEqual } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CockroachMigrationStatement,
  createCockroachCoreStateMigration,
  createCockroachMigrationRunner,
  type CockroachAnySqlStatement,
  type CockroachGenericSqlExecutor,
} from "../src/index.ts";

describe("cockroach migration runner", () => {
  test("applies the core state migration through the generic SQL executor", async () => {
    const executor = createRecordingSqlExecutor();
    const migration = createCockroachCoreStateMigration();
    const runner = createCockroachMigrationRunner({
      executor,
      migrations: [migration],
    });

    await runner.applyMigrations();

    deepEqual(executor.statements, [
      {
        name: CockroachMigrationStatement.ApplyMigration,
        sql: migration.sql,
        parameters: [],
      },
    ]);
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
