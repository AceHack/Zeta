/**
 * Run one full LIVING WORK-OS cycle against the in-cluster CockroachDB and print
 * the result. Proves the work + observe overhaul end-to-end in kind: an external
 * customer defect flows in → triaged → developed → QA catches a regression → the
 * fix bounces back → churn is detected → escalation pulls in more agents (RMO
 * supply-expand) and an architect to change approach → re-test green → released,
 * all persisted to agentic_org_org_events.
 *
 *   kubectl -n agentic-org port-forward svc/cockroach 26257:26257 &
 *   COCKROACH_DATABASE_URL=postgresql://root@localhost:26257/defaultdb?sslmode=disable \
 *     node --experimental-strip-types deploy/run-work-os-cycle.ts
 */

import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { env } from "node:process";

import { buildHatDefinitions, runWorkOsCycle } from "../packages/application/src/index.ts";
import {
  createCockroachCoreStateMigrations,
  createCockroachOrgEventStore,
  createCockroachSqlExecutor,
  splitSqlStatements,
} from "../packages/state-cockroach/src/index.ts";
import type { CockroachSqlClient } from "../packages/state-cockroach/src/cockroach-sql-executor.ts";

const connectionString = env.COCKROACH_DATABASE_URL ?? "postgresql://root@localhost:26257/defaultdb?sslmode=disable";

async function main(): Promise<void> {
  const pool = new Pool({ connectionString });
  const client: CockroachSqlClient = {
    query: async (sql, parameters) => ({ rows: (await pool.query(sql, parameters as unknown[])).rows }),
    transaction: async (operation) => operation(client),
  };
  const executor = createCockroachSqlExecutor({ client });

  // the org_events table is the durable trace for the living loop; apply the
  // ordered core set so additive org_event columns are present on reused DBs.
  for (const migration of createCockroachCoreStateMigrations()) {
    for (const statement of splitSqlStatements(migration.sql)) {
      await pool.query(statement);
    }
  }
  const orgEventStore = createCockroachOrgEventStore({ executor });

  const report = await runWorkOsCycle({
    organizationId: "org-lfg",
    projectId: "proj-checkout",
    initiativeId: `init-${randomUUID()}`,
    initiativeBranch: "feat/coupon",
    hats: buildHatDefinitions(),
    baseTimeMs: Date.now(),
    createId: (prefix) => `${prefix}-${randomUUID()}`,
    appendEvent: (e) => orgEventStore.append(e),
  });

  console.log(JSON.stringify({ workOsCycle: report }, null, 2));
  await pool.end();
}

await main();
