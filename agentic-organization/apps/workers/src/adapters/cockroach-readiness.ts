import type { CockroachSqlClient } from "../../../../packages/state-cockroach/src/index.ts";
import {
  WorkerDependencyName,
  WorkerDependencyReadinessStatus,
  type WorkerDependencyReadinessProbe,
} from "../worker-readiness.ts";

export const CockroachReadinessSql = {
  SelectOne: "SELECT 1",
} as const;

export type CockroachReadinessSql = (typeof CockroachReadinessSql)[keyof typeof CockroachReadinessSql];

export type CreateCockroachReadinessProbeInput = {
  client: CockroachSqlClient;
};

export function createCockroachReadinessProbe(
  input: CreateCockroachReadinessProbeInput,
): WorkerDependencyReadinessProbe {
  return {
    name: WorkerDependencyName.Cockroach,
    check: async () => {
      await input.client.query(CockroachReadinessSql.SelectOne, []);

      return {
        name: WorkerDependencyName.Cockroach,
        status: WorkerDependencyReadinessStatus.Ready,
      };
    },
  };
}
