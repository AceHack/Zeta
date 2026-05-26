import type { CockroachGenericSqlExecutor } from "./cockroach-sql-executor.ts";
import type { CockroachSchemaMigration } from "./cockroach-schema.ts";

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
        await input.executor.execute({
          name: CockroachMigrationStatement.ApplyMigration,
          sql: migration.sql,
          parameters: [],
        });
      }
    },
  };
}
