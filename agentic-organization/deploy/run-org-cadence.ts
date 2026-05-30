/**
 * Prove TRACK A (Activate) in kind: the SAME cadence composition the always-on
 * worker drives (composeOrgCadenceLoops) advances real Cockroach state — the Work
 * OS living loop, the memory maintenance cycle, and change-control review — bounded
 * to a few ticks per lane. This is exactly what the deployed worker now runs on its
 * own cadences (A0 wired it into apps/workers/src/main.ts); here we run it bounded so
 * the effect is observable without waiting on the worker's intervals.
 *
 *   kubectl -n agentic-org port-forward svc/cockroach 26257:26257 &
 *   COCKROACH_DATABASE_URL=postgresql://root@localhost:26257/defaultdb?sslmode=disable \
 *     node --experimental-strip-types deploy/run-org-cadence.ts
 */

import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { env } from "node:process";

import { ChangeSetPhase, MemoryPhase, MemoryTier, type ChangeSet, type MemoryRecord, type MemoryState } from "../packages/domain/src/index.ts";
import { buildInternalOnlyPipeline } from "../packages/application/src/index.ts";
import {
  createCockroachOrgSystemMigration,
  createCockroachMemorySystemMigration,
  createCockroachChangeControlMigration,
  createCockroachSqlExecutor,
  createCockroachMemoryStateStore,
  createCockroachChangeSetStore,
  createCockroachOrgEventStore,
  splitSqlStatements,
} from "../packages/state-cockroach/src/index.ts";
import { composeOrgCadenceLoops } from "../apps/workers/src/org-cadence-composition.ts";
import type { CockroachSqlClient } from "../packages/state-cockroach/src/cockroach-sql-executor.ts";

const connectionString = env.COCKROACH_DATABASE_URL ?? "postgresql://root@localhost:26257/defaultdb?sslmode=disable";
const ORG = "org-lfg";
const NOW = Date.now();
const id = (p: string) => `${p}-${randomUUID()}`;

async function main(): Promise<void> {
  const pool = new Pool({ connectionString });
  const client: CockroachSqlClient = { query: async (sql, p) => ({ rows: (await pool.query(sql, p as unknown[])).rows }), transaction: async (op) => op(client) };
  const executor = createCockroachSqlExecutor({ client });
  for (const s of splitSqlStatements(createCockroachOrgSystemMigration().sql)) await pool.query(s);
  for (const s of splitSqlStatements(createCockroachMemorySystemMigration().sql)) await pool.query(s);
  for (const s of splitSqlStatements(createCockroachChangeControlMigration().sql)) await pool.query(s);

  // seed: an aged+useless memory (the maintenance lane should archive it) + an in_review ChangeSet
  const memId = id("mem-cadence");
  const at = new Date(NOW).toISOString();
  const memRecord: MemoryRecord = { memoryId: memId, organizationId: ORG, tier: MemoryTier.Work, scope: "work-cadence", key: "old-note", value: "", protected: false, writtenBy: "system", writtenAt: at };
  const memState: MemoryState = { memoryId: memId, organizationId: ORG, phase: MemoryPhase.Active, confidence: 0.2, weight: 0.1, freshnessAt: new Date(NOW - 120 * 86_400_000).toISOString(), reinforcementCount: 1, outcome: { successCount: 0, failureCount: 5, inconclusiveCount: 0, workItemsObserved: [] }, utility: { injectedCount: 12, citedCount: 0 }, crossScope: { distinctScopes: [], firstObservedAt: at, lastObservedAt: at } };
  await createCockroachMemoryStateStore({ executor }).upsert(memRecord, memState);

  const csId = id("cs-cadence");
  const cs: ChangeSet = { changeSetId: csId, organizationId: ORG, workItemId: id("work"), proposerHatId: "code_author", title: "Cadence-driven change", targetRef: "feat/cadence", phase: ChangeSetPhase.InReview, pipelineId: buildInternalOnlyPipeline(ORG).pipelineId, currentStageIndex: 0, artifacts: [{ kind: "code_diff", path: "a.ts", diff: "+x", language: "ts" }], projections: [], revision: 2, openedAt: at, updatedAt: at };
  await createCockroachChangeSetStore({ executor }).upsert(cs);

  // run the SAME composition the worker drives, bounded to a few ticks per lane
  const laneTicks: { lane: string; tick: number; status: string }[] = [];
  const cadence = composeOrgCadenceLoops({
    executor, organizationId: ORG, now: () => NOW, createId: id,
    intervals: { workOsMs: 0, memoryMaintenanceMs: 0, changeControlMs: 0, docMaintenanceMs: 0 },
    sleep: async () => {},
    // synthetic pending work so the Work OS lane exercises in this bounded proof
    intake: async () => ({ projectId: id("proj"), initiativeId: id("init"), initiativeBranch: "feat/cadence-auto" }),
    maxTicksPerLane: 3,
    observer: { record: (r) => laneTicks.push({ lane: r.lane, tick: r.tick, status: r.status }) },
  });
  await cadence.done;

  const memAfter = await createCockroachMemoryStateStore({ executor }).get(memId);
  const csAfter = await createCockroachChangeSetStore({ executor }).get(csId);
  const events = await createCockroachOrgEventStore({ executor }).listByOrganization(ORG, 200);
  const recent = events.filter((e) => e.kind.startsWith("work_item") || e.kind.startsWith("memory_") || e.kind.startsWith("change_set") || e.kind.startsWith("review_") || e.kind.startsWith("stage_"));

  console.log(JSON.stringify({
    orgCadence: {
      laneTicks,
      seededMemory: { memoryId: memId, phaseAfter: memAfter?.state.phase, weightAfter: memAfter?.state.weight, surfaces: memAfter?.state.phase !== MemoryPhase.Archived },
      seededChangeSet: { changeSetId: csId, phaseAfter: csAfter?.phase, revisionAfter: csAfter?.revision },
      orgEventsObservedFromLanes: recent.length,
    },
  }, null, 2));
  await pool.end();
}

await main();
