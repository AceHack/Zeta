import { equal } from "node:assert/strict";
import { test } from "node:test";

import { createCockroachWorkIntakeSource } from "../src/cockroach-work-intake-source.ts";
import type { CockroachGenericSqlExecutor } from "../src/cockroach-sql-executor.ts";

/** A fake executor that returns whatever rows the test queues for the claim query. */
function fakeExecutor(rows: readonly Record<string, unknown>[]): {
  executor: CockroachGenericSqlExecutor;
  calls: { sql: string; parameters: readonly unknown[] }[];
} {
  const calls: { sql: string; parameters: readonly unknown[] }[] = [];
  const executor = {
    execute: async <Row>(statement: { sql: string; parameters: readonly unknown[] }) => {
      calls.push({ sql: statement.sql, parameters: statement.parameters });
      return { rows: rows as readonly Row[] };
    },
    executeTransaction: async <R>(op: (e: CockroachGenericSqlExecutor) => Promise<R>) => op(executor),
  } as CockroachGenericSqlExecutor;
  return { executor, calls };
}

test("claims the proposed initiative and returns the work tuple with a derived branch", async () => {
  const { executor, calls } = fakeExecutor([{ initiative_id: "init-7", project_id: "proj-3" }]);
  const intake = createCockroachWorkIntakeSource({ executor, organizationId: "org-lfg", nowIso: () => "2026-05-30T00:00:00Z" });

  const claimed = await intake();

  equal(claimed?.projectId, "proj-3");
  equal(claimed?.initiativeId, "init-7");
  equal(claimed?.initiativeBranch, "feat/init-7");
  // the claim flips proposed → active in one statement (dequeue-once)
  equal(calls.length, 1);
  equal(calls[0]!.parameters[2], "active");
  equal(calls[0]!.parameters[3], "proposed");
});

test("returns null (the lane idles) when nothing is proposed", async () => {
  const { executor } = fakeExecutor([]);
  const intake = createCockroachWorkIntakeSource({ executor, organizationId: "org-lfg", nowIso: () => "2026-05-30T00:00:00Z" });

  const claimed = await intake();

  equal(claimed, null);
});
