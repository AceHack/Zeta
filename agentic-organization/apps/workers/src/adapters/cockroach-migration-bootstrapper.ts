import {
  createCockroachCoreStateMigrations,
  createCockroachMigrationRunner,
  type CockroachGenericSqlExecutor,
  type CockroachSchemaMigration,
} from "../../../../packages/state-cockroach/src/index.ts";
import type { WorkerProcessBootstrapper } from "../worker-process.ts";

export const WorkerProcessBootstrapperName = {
  CockroachMigrations: "cockroach_migrations",
} as const;

export type WorkerProcessBootstrapperName =
  (typeof WorkerProcessBootstrapperName)[keyof typeof WorkerProcessBootstrapperName];

export type CreateCockroachMigrationBootstrapperInput = {
  executor: CockroachGenericSqlExecutor;
  migrations?: readonly CockroachSchemaMigration[] | undefined;
};

export function createCockroachMigrationBootstrapper(
  input: CreateCockroachMigrationBootstrapperInput,
): WorkerProcessBootstrapper {
  const runner = createCockroachMigrationRunner({
    executor: input.executor,
    migrations: input.migrations ?? createCockroachCoreStateMigrations(),
  });

  return {
    name: WorkerProcessBootstrapperName.CockroachMigrations,
    bootstrap: async () => {
      await runner.applyMigrations();
    },
  };
}
