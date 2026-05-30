import type { CockroachGenericSqlExecutor } from "./cockroach-sql-executor.ts";
import type { CockroachSchemaMigration } from "./cockroach-schema.ts";
import { splitSqlStatements } from "./sql-statement-splitter.ts";

export const CockroachMigrationStatement = {
  ApplyMigration: "apply_migration",
} as const;

export type CockroachMigrationStatement =
  (typeof CockroachMigrationStatement)[keyof typeof CockroachMigrationStatement];

export type CockroachMigrationRunner = {
  applyMigrations: () => Promise<void>;
};

export type CreateCockroachMigrationRunnerInput = {
  executor: CockroachGenericSqlExecutor;
  migrations: readonly CockroachSchemaMigration[];
};

export function createCockroachMigrationRunner(input: CreateCockroachMigrationRunnerInput): CockroachMigrationRunner {
  return {
    applyMigrations: async () => {
      for (const migration of input.migrations) {
        // Execute each statement separately (its own implicit transaction).
        // CockroachDB runs a multi-statement string as one implicit txn and
        // forbids referencing a column added by an earlier DDL statement in the
        // same txn (e.g. ADD COLUMN version; UPDATE ... SET version -> SQLSTATE
        // 42703). Per-statement execution makes the ADD COLUMN commit first.
        for (const statement of splitSqlStatements(migration.sql)) {
          await input.executor.execute({
            name: CockroachMigrationStatement.ApplyMigration,
            sql: statement,
            parameters: [],
          });
        }
      }
    },
  };
}
