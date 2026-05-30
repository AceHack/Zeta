/**
 * Run one full org cycle against the in-cluster CockroachDB and print the result.
 * Proves the hat + department organization end-to-end in kind: executive/director
 * prioritization → RMO supply voting → hat assignment+binding → the 7-gate
 * pipeline → binding lifecycle (warmup→active→expire→succession), all persisted
 * to agentic_org_org_events + agentic_org_hat_bindings.
 *
 *   kubectl -n agentic-org port-forward svc/cockroach 26257:26257 &
 *   COCKROACH_DATABASE_URL=postgresql://root@localhost:26257/defaultdb?sslmode=disable \
 *     node --experimental-strip-types deploy/run-org-cycle.ts
 */

import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { env } from "node:process";

import {
  buildHatDefinitions,
  runOrgCycle,
} from "../packages/application/src/index.ts";
import {
  createCockroachOrgSystemMigration,
  createCockroachOrgEventStore,
  createCockroachHatBindingStore,
  createCockroachSqlExecutor,
  splitSqlStatements,
} from "../packages/state-cockroach/src/index.ts";
import type { CockroachSqlClient } from "../packages/state-cockroach/src/cockroach-sql-executor.ts";

const connectionString = env.COCKROACH_DATABASE_URL ?? "postgresql://root@localhost:26257/defaultdb?sslmode=disable";

async function main(): Promise<void> {
  const pool = new Pool({ connectionString });
  const client: CockroachSqlClient = {
    query: async (sql, parameters) => {
      const result = await pool.query(sql, parameters as unknown[]);
      return { rows: result.rows };
    },
    // the org stores use autocommit single statements; a self-passing wrapper is sufficient
    transaction: async (operation) => operation(client),
  };
  const executor = createCockroachSqlExecutor({ client });

  // apply the org-system migration (idempotent CREATE TABLE IF NOT EXISTS)
  for (const statement of splitSqlStatements(createCockroachOrgSystemMigration().sql)) {
    await pool.query(statement);
  }

  const orgEventStore = createCockroachOrgEventStore({ executor });
  const hatBindingStore = createCockroachHatBindingStore({ executor });

  const workItemId = `work-${randomUUID()}`;
  const report = await runOrgCycle({
    organizationId: "org-lfg",
    workItemId,
    baseTimeMs: Date.now(),
    createId: (prefix) => `${prefix}-${randomUUID()}`,
    appendEvent: (e) => orgEventStore.append(e),
    upsertBinding: (b) => hatBindingStore.upsert(b),
    hats: buildHatDefinitions(),
  });

  console.log(JSON.stringify({ orgCycle: report }, null, 2));
  await pool.end();
}

await main();
