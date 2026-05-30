/**
 * Observe the LIVING WORK OS: read the persisted org_event trace from the
 * in-cluster CockroachDB and render the whole loop — intake → develop → QA
 * regression → churn → escalation (more agents + architect) → released — so it is
 * crystal-clear what happened, end to end.
 *
 *   kubectl -n agentic-org port-forward svc/cockroach 26257:26257 &
 *   COCKROACH_DATABASE_URL=postgresql://root@localhost:26257/defaultdb?sslmode=disable \
 *     node --experimental-strip-types deploy/observe-work-os.ts
 */

import { Pool } from "pg";
import { env } from "node:process";

import { createCockroachSqlExecutor, createCockroachOrgEventStore } from "../packages/state-cockroach/src/index.ts";
import type { CockroachSqlClient } from "../packages/state-cockroach/src/cockroach-sql-executor.ts";

const connectionString = env.COCKROACH_DATABASE_URL ?? "postgresql://root@localhost:26257/defaultdb?sslmode=disable";

const WORK_KINDS = new Set([
  "intake_received", "work_item_transition", "work_batch_transition", "test_run_recorded",
  "regression_detected", "defect_opened", "churn_detected", "escalation_decision",
  "hat_supply_decision", "quality_gate_evaluation", "hat_assignment",
]);

async function main(): Promise<void> {
  const pool = new Pool({ connectionString });
  const client: CockroachSqlClient = {
    query: async (sql, parameters) => ({ rows: (await pool.query(sql, parameters as unknown[])).rows }),
    transaction: async (operation) => operation(client),
  };
  const executor = createCockroachSqlExecutor({ client });
  const events = await createCockroachOrgEventStore({ executor }).listByOrganization("org-lfg", 1000);
  const work = events.filter((e) => WORK_KINDS.has(e.kind));

  const byKind: Record<string, number> = {};
  for (const e of work) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;

  console.log(`LIVING WORK OS — persisted trace @ ${new Date().toISOString()}`);
  console.log(`work events=${work.length}`);
  console.log("EVENTS BY KIND:");
  for (const [kind, n] of Object.entries(byKind).sort()) console.log(`  ${kind.padEnd(24)} ${n}`);

  const show = (kind: string, label: string): void => {
    const hits = work.filter((e) => e.kind === kind);
    if (hits.length === 0) return;
    console.log(`\n${label}:`);
    for (const e of hits.slice(0, 6)) console.log(`  • ${e.decision}`);
  };

  show("intake_received", "WORK FLOWED IN (external)");
  show("regression_detected", "QA CAUGHT REGRESSIONS");
  show("defect_opened", "DEFECTS OPENED FROM FAILED TESTS");
  show("churn_detected", "CHURN DETECTED");
  show("escalation_decision", "ESCALATIONS (manager decided)");
  show("hat_supply_decision", "RMO BROUGHT ON MORE AGENTS");
  show("hat_assignment", "ARCHITECT RE-APPROACH");

  // the living loop's spine: every work_item_transition in order
  const transitions = work.filter((e) => e.kind === "work_item_transition");
  console.log(`\nWORK ITEM JOURNEY (${transitions.length} transitions):`);
  for (const e of transitions) console.log(`  ${String(e.fromState).padEnd(12)} → ${String(e.toState).padEnd(12)}  ${e.decision}`);

  const released = transitions.some((e) => e.toState === "done");
  console.log(`\nRELEASED (reached done): ${released ? "YES" : "no"}`);
  await pool.end();
}

await main();
