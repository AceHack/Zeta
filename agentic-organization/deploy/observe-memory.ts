/**
 * Observe the DYNAMIC MEMORY SYSTEM: read the persisted memory_state rows + the
 * memory org_event trace from the in-cluster CockroachDB and render what the daily
 * cycle did — which memories were reinforced (good KPI), demoted (bad KPI, by a
 * memory_reviewer), promoted (work→hat, by a knowledge_router), and archived at
 * zero (never surfaces again) — exactly the same proof bar we held for the org.
 *
 *   kubectl -n agentic-org port-forward svc/cockroach 26257:26257 &
 *   COCKROACH_DATABASE_URL=postgresql://root@localhost:26257/defaultdb?sslmode=disable \
 *     node --experimental-strip-types deploy/observe-memory.ts
 */

import { Pool } from "pg";
import { env } from "node:process";

import { createCockroachSqlExecutor, createCockroachOrgEventStore, createCockroachMemoryStateStore } from "../packages/state-cockroach/src/index.ts";
import type { CockroachSqlClient } from "../packages/state-cockroach/src/cockroach-sql-executor.ts";

const connectionString = env.COCKROACH_DATABASE_URL ?? "postgresql://root@localhost:26257/defaultdb?sslmode=disable";

const MEMORY_KINDS = new Set([
  "memory_retained", "memory_injected", "memory_cited", "memory_outcome_observed",
  "memory_phase_transition", "memory_reinforced", "memory_archived", "memory_promoted",
  "memory_demoted", "memory_conflict_flagged", "memory_maintenance_cycle",
]);

async function main(): Promise<void> {
  const pool = new Pool({ connectionString });
  const client: CockroachSqlClient = {
    query: async (sql, parameters) => ({ rows: (await pool.query(sql, parameters as unknown[])).rows }),
    transaction: async (operation) => operation(client),
  };
  const executor = createCockroachSqlExecutor({ client });

  const stateStore = createCockroachMemoryStateStore({ executor });
  const memories = await stateStore.listAll("org-lfg");

  console.log(`DYNAMIC MEMORY SYSTEM — persisted state @ ${new Date().toISOString()}`);
  console.log(`memories in org-lfg: ${memories.length}\n`);
  console.log("MEMORY STATE (phase · weight · confidence · KPI · cited/injected):");
  for (const m of memories) {
    const o = m.state.outcome;
    const u = m.state.utility;
    const surfaces = m.state.phase === "archived" ? "NEVER surfaces" : "surfaces";
    console.log(
      `  [${m.tier}/${m.scope}] ${m.key}`.padEnd(56) +
        ` ${m.state.phase.padEnd(10)} w=${m.state.weight.toFixed(2)} conf=${m.state.confidence.toFixed(2)} ` +
        `kpi=${o.successCount}/${o.successCount + o.failureCount} cite=${u.citedCount}/${u.injectedCount} → ${surfaces}`,
    );
  }

  const events = await createCockroachOrgEventStore({ executor }).listByOrganization("org-lfg", 2000);
  const mem = events.filter((e) => MEMORY_KINDS.has(e.kind));
  const byKind: Record<string, number> = {};
  for (const e of mem) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;

  console.log(`\nMEMORY ORG-EVENTS: ${mem.length}`);
  for (const [kind, n] of Object.entries(byKind).sort()) console.log(`  ${kind.padEnd(26)} ${n}`);

  const show = (kind: string, label: string): void => {
    const hits = mem.filter((e) => e.kind === kind);
    if (hits.length === 0) return;
    console.log(`\n${label}:`);
    for (const e of hits.slice(0, 8)) console.log(`  • ${e.decision}`);
  };
  show("memory_reinforced", "REINFORCED (good KPI — auto)");
  show("memory_demoted", "DEMOTED (bad KPI — memory_reviewer decided)");
  show("memory_promoted", "PROMOTED (cross-scope — knowledge_router decided)");
  show("memory_archived", "ARCHIVED AT ZERO (never surfaces again)");
  show("memory_maintenance_cycle", "CYCLE SUMMARY");

  await pool.end();
}

await main();
