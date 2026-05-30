/**
 * Observe the org: read the persisted OrgEvent trace + hat bindings from the
 * in-cluster CockroachDB and render the org snapshot — the "what is happening
 * right now" view, including activity at every hierarchy level.
 *
 *   kubectl -n agentic-org port-forward svc/cockroach 26257:26257 &
 *   COCKROACH_DATABASE_URL=postgresql://root@localhost:26257/defaultdb?sslmode=disable \
 *     node --experimental-strip-types deploy/observe-org.ts
 */

import { Pool } from "pg";
import { env } from "node:process";

import { buildHatDefinitions } from "../packages/application/src/index.ts";
import { createCockroachSqlExecutor, createCockroachOrgEventStore, createCockroachHatBindingStore } from "../packages/state-cockroach/src/index.ts";
import type { CockroachSqlClient } from "../packages/state-cockroach/src/cockroach-sql-executor.ts";
import { buildOrgSnapshot, renderOrgSnapshot } from "../packages/observability/src/index.ts";

const connectionString = env.COCKROACH_DATABASE_URL ?? "postgresql://root@localhost:26257/defaultdb?sslmode=disable";

async function main(): Promise<void> {
  const pool = new Pool({ connectionString });
  const client: CockroachSqlClient = {
    query: async (sql, parameters) => ({ rows: (await pool.query(sql, parameters as unknown[])).rows }),
    transaction: async (operation) => operation(client),
  };
  const executor = createCockroachSqlExecutor({ client });
  const events = await createCockroachOrgEventStore({ executor }).listByOrganization("org-lfg", 500);
  const bindings = await createCockroachHatBindingStore({ executor }).listAll("org-lfg");

  const snapshot = buildOrgSnapshot({
    hats: buildHatDefinitions(),
    bindings,
    events,
    nowMs: Date.now(),
    nowIso: new Date().toISOString(),
  });

  console.log(renderOrgSnapshot(snapshot));
  console.log("\nLATEST DECISIONS (most recent first):");
  for (const e of snapshot.recentEvents.slice(0, 12)) {
    console.log(`  [${e.kind}] ${e.decision}`);
  }
  await pool.end();
}

await main();
