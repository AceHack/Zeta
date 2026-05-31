/**
 * Phase 2.7 KIND proof: policy/config ChangeSets require verified, bound
 * simulation evidence before release.
 *
 *   kubectl -n agentic-org port-forward svc/cockroach 26259:26257 &
 *   COCKROACH_DATABASE_URL=postgresql://root@localhost:26259/defaultdb?sslmode=disable \
 *     node --experimental-strip-types deploy/run-policy-simulation-gate.ts
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
import { createReleaseQueueCadenceLane } from "../apps/workers/src/org-cadence-lanes.ts";
import {
  createContentAddressedEvidenceArtifact,
} from "../packages/application/src/index.ts";
import {
  createCockroachChangeSetStore,
  createCockroachCoreStateMigrations,
  createCockroachOrgEventStore,
  createCockroachSqlExecutor,
  splitSqlStatements,
} from "../packages/state-cockroach/src/index.ts";
import type { CockroachSqlClient } from "../packages/state-cockroach/src/cockroach-sql-executor.ts";

const connectionString = env.COCKROACH_DATABASE_URL ?? "postgresql://root@localhost:26257/defaultdb?sslmode=disable";
const organizationId = `org-policy-sim-${randomUUID().slice(0, 8)}`;
const proofRunId = randomUUID().slice(0, 8);
const nowMs = Date.now();
const nowIso = new Date(nowMs).toISOString();
const createId = (prefix: string) => `${prefix}-${randomUUID()}`;
const simulated = `cs-policy-simulated-${proofRunId}`;
const unbound = `cs-policy-unbound-${proofRunId}`;
const simulationEvidence = createContentAddressedEvidenceArtifact("simulation-report", {
  changeSetId: simulated,
  decision: "accepted",
  metrics: { delivery: "better", quality: "non_regression", cost: "acceptable", safety: "non_regression" },
});

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
    for (const cs of [policyChangeSet(simulated), policyChangeSet(unbound)]) {
      await changeSets.upsert(cs);
    }

    const lane = createReleaseQueueCadenceLane({
      organizationId,
      now: () => nowMs,
      createId,
      reader: changeSets,
      writer: changeSets,
      appendEvent: (event) => orgEvents.append(event),
      maxBatchSize: 2,
      evaluateBatch: () => ({
        green: true,
        evidenceRefs: [simulationEvidence.ref],
        evidenceArtifacts: [simulationEvidence],
      }),
    });

    const laneResult = await lane.runOnce();
    const persisted = await Promise.all([changeSets.get(simulated), changeSets.get(unbound)]);
    const events = await orgEvents.listByOrganization(organizationId, 100);
    const simulatedApplied = persisted[0]?.phase === ChangeSetPhase.Applied;
    const unboundHeld = persisted[1]?.phase === ChangeSetPhase.Approved;
    const appliedEvent = events.find((event) => event.kind === OrgEventKind.ChangeSetApplied && event.subjectId === simulated);
    const unboundFinding = events.find((event) => event.kind === OrgEventKind.ReviewFindingRaised && event.subjectId === unbound);
    const unboundLeakedSimulationEvidence = events.some((event) =>
      event.subjectId === unbound && event.evidenceRefs.includes(simulationEvidence.ref),
    );
    const ok =
      laneResult.failures.length === 0 &&
      laneResult.status === "release-queue:1applied/0changes_requested/1requeued" &&
      simulatedApplied &&
      unboundHeld &&
      appliedEvent !== undefined &&
      appliedEvent.evidenceRefs.includes(simulationEvidence.ref) &&
      unboundFinding !== undefined &&
      !unboundLeakedSimulationEvidence;

    console.log(JSON.stringify({
      track: "Phase 2.7 policy simulation gate",
      organizationId,
      laneResult,
      persisted: persisted.map((cs) => cs === null ? null : { changeSetId: cs.changeSetId, phase: cs.phase }),
      events: {
        appliedEvent: appliedEvent?.id,
        unboundFinding: unboundFinding?.id,
        unboundLeakedSimulationEvidence,
      },
      PROOF: ok ? "PASS" : "FAIL",
    }, null, 2));
    process.exitCode = ok ? 0 : 1;
  } finally {
    await pool.end();
  }
}

function policyChangeSet(changeSetId: string): ChangeSet {
  return {
    changeSetId,
    organizationId,
    workItemId: `work-${changeSetId}`,
    proposerHatId: "rmo",
    title: `Policy simulation proof ${changeSetId}`,
    targetRef: `org-policy/${changeSetId}`,
    phase: ChangeSetPhase.Approved,
    pipelineId: "internal-only",
    currentStageIndex: 0,
    artifacts: [{
      kind: ChangeArtifactKind.ConfigChange,
      key: `rmo.assignment.${changeSetId}`,
      before: "0.10",
      after: "0.20",
    }],
    projections: [],
    revision: 1,
    openedAt: nowIso,
    updatedAt: nowIso,
  };
}

await main();
