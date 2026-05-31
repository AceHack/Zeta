/**
 * G1 KIND proof: seed approved ChangeSets into live Cockroach, run the release
 * queue lane with a deterministic batch evaluator, and require durable apply /
 * changes-requested outcomes plus org_event evidence.
 *
 *   kubectl -n agentic-org port-forward svc/cockroach 26259:26257 &
 *   COCKROACH_DATABASE_URL=postgresql://root@localhost:26259/defaultdb?sslmode=disable \
 *     node --experimental-strip-types deploy/run-release-queue.ts
 */

import { randomUUID } from "node:crypto";
import { env } from "node:process";
import { Pool } from "pg";

import {
  ChangeArtifactKind,
  ChangeSetPhase,
  OrgEventKind,
  type ChangeSet,
} from "../packages/domain/src/index.ts";
import {
  createCockroachChangeSetStore,
  createCockroachCoreStateMigrations,
  createCockroachOrgEventStore,
  createCockroachSqlExecutor,
  splitSqlStatements,
} from "../packages/state-cockroach/src/index.ts";
import { createReleaseQueueCadenceLane } from "../apps/workers/src/org-cadence-lanes.ts";
import type { CockroachSqlClient } from "../packages/state-cockroach/src/cockroach-sql-executor.ts";

const connectionString = env.COCKROACH_DATABASE_URL ?? "postgresql://root@localhost:26257/defaultdb?sslmode=disable";
const organizationId = `org-release-${randomUUID().slice(0, 8)}`;
const proofRunId = randomUUID().slice(0, 8);
const nowMs = Date.now();
const nowIso = new Date(nowMs).toISOString();
const createId = (prefix: string) => `${prefix}-${randomUUID()}`;
const greenA = `cs-release-green-a-${proofRunId}`;
const red = `cs-release-red-${proofRunId}`;
const greenB = `cs-release-green-b-${proofRunId}`;

async function main(): Promise<void> {
  const pool = new Pool({ connectionString });
  try {
    const client: CockroachSqlClient = {
      query: async (sql, parameters) => ({ rows: (await pool.query(sql, parameters as unknown[])).rows }),
      transaction: async (operation) => operation(client),
    };
    const executor = createCockroachSqlExecutor({ client });

    for (const migration of createCockroachCoreStateMigrations()) {
      for (const statement of splitSqlStatements(migration.sql)) {
        await pool.query(statement);
      }
    }

    const changeSets = createCockroachChangeSetStore({ executor });
    const orgEvents = createCockroachOrgEventStore({ executor });
    for (const cs of [changeSet(greenA), changeSet(red), changeSet(greenB)]) {
      await changeSets.upsert(cs);
    }

    const lane = createReleaseQueueCadenceLane({
      organizationId,
      now: () => nowMs,
      createId,
      reader: changeSets,
      writer: changeSets,
      appendEvent: (event) => orgEvents.append(event),
      maxBatchSize: 3,
      evaluateBatch: (batch) => ({
        green: !batch.some((cs) => cs.changeSetId === red),
        evidenceRefs: [`release-proof:${batch.map((cs) => cs.changeSetId).join("+")}`],
      }),
    });

    const laneResult = await lane.runOnce();
    const persisted = await Promise.all([changeSets.get(greenA), changeSets.get(red), changeSets.get(greenB)]);
    const events = await orgEvents.listByOrganization(organizationId, 100);
    const appliedCount = persisted.filter((cs) => cs?.phase === ChangeSetPhase.Applied).length;
    const changesRequestedCount = persisted.filter((cs) => cs?.phase === ChangeSetPhase.ChangesRequested).length;
    const appliedEventCount = events.filter((event) => event.kind === OrgEventKind.ChangeSetApplied).length;
    const changesRequestedEventCount = events.filter((event) => event.kind === OrgEventKind.ChangesRequested).length;
    const ok =
      laneResult.failures.length === 0 &&
      laneResult.status === "release-queue:2applied/1changes_requested/0requeued" &&
      appliedCount === 2 &&
      changesRequestedCount === 1 &&
      appliedEventCount === 2 &&
      changesRequestedEventCount === 1;

    console.log(JSON.stringify({
      track: "G1 release queue",
      organizationId,
      laneResult,
      persisted: persisted.map((cs) => cs === null ? null : { changeSetId: cs.changeSetId, phase: cs.phase }),
      events: { appliedEventCount, changesRequestedEventCount },
      PROOF: ok ? "PASS" : "FAIL",
    }, null, 2));
    process.exitCode = ok ? 0 : 1;
  } finally {
    await pool.end();
  }
}

function changeSet(changeSetId: string): ChangeSet {
  return {
    changeSetId,
    organizationId,
    workItemId: `work-${changeSetId}`,
    proposerHatId: "implementation_engineer",
    title: `Release queue proof ${changeSetId}`,
    targetRef: `refs/heads/${changeSetId}`,
    phase: ChangeSetPhase.Approved,
    pipelineId: "internal-only",
    currentStageIndex: 0,
    artifacts: [{
      kind: ChangeArtifactKind.CodeDiff,
      path: `src/${changeSetId}.ts`,
      diff: "+proof",
      language: "typescript",
    }],
    projections: [],
    revision: 2,
    openedAt: nowIso,
    updatedAt: nowIso,
  };
}

await main();
