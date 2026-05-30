/**
 * Observe ORG-NATIVE CHANGE CONTROL: read the persisted change_sets + the per-stage
 * review ledger + the org_event trace and render what the review fabric did — the
 * internal stages a change passed through, the revision bounce, the projection, and
 * the external approval flowing back in — so it is crystal-clear that the org ran its
 * own process and the PR was a leaf.
 *
 *   kubectl -n agentic-org port-forward svc/cockroach 26257:26257 &
 *   COCKROACH_DATABASE_URL=postgresql://root@localhost:26257/defaultdb?sslmode=disable \
 *     node --experimental-strip-types deploy/observe-change-control.ts
 */

import { Pool } from "pg";
import { env } from "node:process";

import { createCockroachSqlExecutor, createCockroachOrgEventStore, createCockroachChangeSetStore, createCockroachReviewStageStatusStore } from "../packages/state-cockroach/src/index.ts";
import { ChangeSetPhase, type ChangeSet } from "../packages/domain/src/index.ts";
import type { CockroachSqlClient } from "../packages/state-cockroach/src/cockroach-sql-executor.ts";

const connectionString = env.COCKROACH_DATABASE_URL ?? "postgresql://root@localhost:26257/defaultdb?sslmode=disable";

const CC_KINDS = new Set([
  "change_set_opened", "review_stage_advanced", "review_finding_raised", "changes_requested",
  "stage_approved", "change_set_approved", "change_set_applied", "change_set_rejected",
  "projection_created", "projection_synced", "human_signoff_requested",
]);

async function main(): Promise<void> {
  const pool = new Pool({ connectionString });
  const client: CockroachSqlClient = { query: async (sql, p) => ({ rows: (await pool.query(sql, p as unknown[])).rows }), transaction: async (op) => op(client) };
  const executor = createCockroachSqlExecutor({ client });

  const csStore = createCockroachChangeSetStore({ executor });
  const stageStore = createCockroachReviewStageStatusStore({ executor });

  const applied = await csStore.listByOrgPhase("org-lfg", ChangeSetPhase.Applied);
  console.log(`ORG-NATIVE CHANGE CONTROL — persisted change sets @ ${new Date().toISOString()}`);
  console.log(`applied change sets: ${applied.length}\n`);

  for (const cs of applied.slice(0, 4)) {
    const external = cs.projections.length === 0 ? "INTERNAL-ONLY (zero projections)" : cs.projections.map((p) => `${p.system}#${p.externalId}`).join(", ");
    console.log(`■ ${cs.title}  [${cs.workItemId}]  phase=${cs.phase} rev=${cs.revision}  external: ${external}`);
    const stages = await stageStore.listByChangeSet(cs.changeSetId);
    for (const s of stages) console.log(`    stage ${s.stageId.padEnd(22)} rev${s.revision}  ${(s.outcome ?? "-").padEnd(16)} by ${s.decidedBy ?? "-"}`);
    console.log();
  }

  const events = await createCockroachOrgEventStore({ executor }).listByOrganization("org-lfg", 3000);
  const cc = events.filter((e) => CC_KINDS.has(e.kind));
  const byKind: Record<string, number> = {};
  for (const e of cc) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
  console.log(`CHANGE-CONTROL ORG-EVENTS: ${cc.length}`);
  for (const [k, n] of Object.entries(byKind).sort()) console.log(`  ${k.padEnd(24)} ${n}`);

  const show = (kind: string, label: string): void => {
    const hits = cc.filter((e) => e.kind === kind);
    if (hits.length === 0) return;
    console.log(`\n${label}:`);
    for (const e of hits.slice(0, 4)) console.log(`  • ${e.decision}`);
  };
  show("changes_requested", "REVISION BOUNCE (QA failed → back to proposer)");
  show("projection_created", "PROJECTION (the PR materialized — a leaf, not the engine)");
  show("projection_synced", "EXTERNAL APPROVAL FLOWED BACK INTO THE GATE");
  show("change_set_applied", "APPLIED (artifacts materialized; PR merged via port)");

  await pool.end();
}

await main();
