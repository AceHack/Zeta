/**
 * Prove A1 in kind: the deployed worker's REAL intake. We seed a `proposed`
 * initiative into Cockroach, then run the SAME composition the worker drives
 * (composeOrgCadenceLoops) WITHOUT overriding `intake` — so the default Cockroach
 * intake source claims it. We assert the Work OS lane ran a full living-loop cycle
 * (status is `work-os:<finalState>`, not idle) and the initiative flipped
 * proposed → active (dequeue-once: the next tick idles).
 *
 *   kubectl -n agentic-org port-forward svc/cockroach 26257:26257 &
 *   COCKROACH_DATABASE_URL=postgresql://root@localhost:26257/defaultdb?sslmode=disable \
 *     node --experimental-strip-types deploy/run-work-intake.ts
 */

import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { env } from "node:process";

import { InitiativeStatus } from "../packages/domain/src/index.ts";
import {
  createCockroachCoreStateMigrations,
  createCockroachSqlExecutor,
  splitSqlStatements,
} from "../packages/state-cockroach/src/index.ts";
import { composeOrgCadenceLoops } from "../apps/workers/src/org-cadence-composition.ts";
import type { CockroachSqlClient } from "../packages/state-cockroach/src/cockroach-sql-executor.ts";

const connectionString = env.COCKROACH_DATABASE_URL ?? "postgresql://root@localhost:26257/defaultdb?sslmode=disable";
const ORG = "org-lfg";
const NOW = Date.now();
const at = new Date(NOW).toISOString();
const id = (p: string) => `${p}-${randomUUID()}`;

async function main(): Promise<void> {
  const pool = new Pool({ connectionString });
  const client: CockroachSqlClient = { query: async (sql, p) => ({ rows: (await pool.query(sql, p as unknown[])).rows }), transaction: async (op) => op(client) };
  const executor = createCockroachSqlExecutor({ client });
  for (const migration of createCockroachCoreStateMigrations()) {
    for (const s of splitSqlStatements(migration.sql)) await pool.query(s);
  }

  // seed ONE proposed initiative (and its project) — the worker's intake should claim it
  const projId = id("proj");
  const initId = id("init");
  await pool.query(
    `INSERT INTO agentic_org_projects (project_id, organization_id, name, status, created_at, created_by_agent_id, created_by_hat_assignment_id, correlation_id, causation_id, trace_id)
     VALUES ($1,$2,$3,'active',$4,'system','system','c','c','t') ON CONFLICT DO NOTHING`,
    [projId, ORG, "Intake proof project", at],
  ).catch(() => {}); // projects table may differ; the initiative is what intake reads
  await pool.query(
    `INSERT INTO agentic_org_initiatives (initiative_id, organization_id, project_id, title, status, created_at, updated_at, version, created_by_agent_id, created_by_hat_assignment_id, correlation_id, causation_id, trace_id)
     VALUES ($1,$2,$3,$4,$5,$6,$6,1,'system','system','c','c','t')`,
    [initId, ORG, projId, "Auto-driven initiative", InitiativeStatus.Proposed, at],
  );

  // run the worker's composition with the DEFAULT (real Cockroach) intake — bounded
  const laneTicks: { lane: string; tick: number; status: string }[] = [];
  const cadence = composeOrgCadenceLoops({
    executor, organizationId: ORG, now: () => NOW, createId: id,
    intervals: { workOsMs: 0, memoryMaintenanceMs: 0, changeControlMs: 0, docMaintenanceMs: 0 },
    sleep: async () => {},
    maxTicksPerLane: 2, // tick 1 claims + drives, tick 2 idles (dequeue-once)
    observer: { record: (r) => laneTicks.push({ lane: r.lane, tick: r.tick, status: r.status }) },
  });
  await cadence.done;

  const after = await pool.query<{ status: string }>(`SELECT status FROM agentic_org_initiatives WHERE initiative_id = $1`, [initId]);
  const workOsTicks = laneTicks.filter((t) => t.lane === "work-os");

  console.log(JSON.stringify({
    a1WorkIntake: {
      seededInitiative: { initiativeId: initId, statusAfter: after.rows[0]?.status, claimed: after.rows[0]?.status === InitiativeStatus.Active },
      workOsTicks,
      drovenCycleOnClaim: workOsTicks[0]?.status.startsWith("work-os:") === true && workOsTicks[0]?.status !== "work-os:idle",
      idledAfterDequeueOnce: workOsTicks[1]?.status === "work-os:idle",
    },
  }, null, 2));
  await pool.end();
}

await main();
