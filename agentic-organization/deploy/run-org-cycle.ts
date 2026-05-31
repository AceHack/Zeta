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
import { ok } from "node:assert/strict";

import {
  buildHatDefinitions,
  runOrgCycle,
  type OrgCycleRmoCandidateSource,
} from "../packages/application/src/index.ts";
import {
  createCockroachCoreStateMigrations,
  createCockroachOrgEventStore,
  createCockroachHatBindingStore,
  createCockroachSqlExecutor,
  splitSqlStatements,
} from "../packages/state-cockroach/src/index.ts";
import type { CockroachSqlClient } from "../packages/state-cockroach/src/cockroach-sql-executor.ts";

const connectionString = env.COCKROACH_DATABASE_URL ?? "postgresql://root@localhost:26257/defaultdb?sslmode=disable";

const kindProofCandidateSource: OrgCycleRmoCandidateSource = {
  sourceName: "kind-proof-production-candidates",
  candidatesForHat: ({ hatId }) => {
    const eligibleCandidates = [0, 1].map((index) => ({
      agentId: `agent-kind-proof-${hatId}-${index}`,
      reputationByHat: { [hatId]: 10 - index },
    }));
    return {
      eligibleCandidates,
      rmoCandidates: eligibleCandidates.map((candidate, index) => {
        const reputation = (candidate.reputationByHat[hatId] ?? 0) / 10;
        return {
          agentId: candidate.agentId,
          hatId,
          agentHatReputation: reputation,
          recentOutcomeScore: Math.max(0.4, reputation - index * 0.05),
          scheduleReliability: index === 0 ? 0.85 : 0.75,
          reviewQuality: 0.75,
          qaPassRate: 0.75,
          completionRate: 0.8,
          contextFit: 0.8,
          currentLoad: 0,
          freshness: index === 0 ? 0.45 : 0.8,
          explorationBonus: index === 0 ? 0 : 0.25,
          consecutiveAssignmentCount: 0,
          recentSameHatAssignments: 0,
        };
      }),
    };
  },
};

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

  // Apply the ordered core set so reused DBs have additive org_event columns.
  for (const migration of createCockroachCoreStateMigrations()) {
    for (const statement of splitSqlStatements(migration.sql)) {
      await pool.query(statement);
    }
  }

  const orgEventStore = createCockroachOrgEventStore({ executor });
  const hatBindingStore = createCockroachHatBindingStore({ executor });

  const proofRunId = randomUUID();
  const organizationId = `org-kind-proof-${proofRunId}`;
  const workItemId = `work-${proofRunId}`;
  const report = await runOrgCycle({
    organizationId,
    workItemId,
    baseTimeMs: Date.now(),
    createId: (prefix) => `${prefix}-${randomUUID()}`,
    appendEvent: (e) => orgEventStore.append(e),
    upsertBinding: (b) => hatBindingStore.upsert(b),
    hats: buildHatDefinitions(),
    rmoCandidateSource: kindProofCandidateSource,
  });
  const events = await orgEventStore.listByOrganization(organizationId, 500);
  const sourceEvidenceRef = `rmo-candidate-source:${kindProofCandidateSource.sourceName}`;
  const rmoSourceEvidenceEvents = events.filter((event) => event.evidenceRefs.includes(sourceEvidenceRef));
  ok(rmoSourceEvidenceEvents.length > 0, "expected RMO assignment evidence to name the proof candidate source");

  const bindings = await hatBindingStore.listAll(organizationId);
  ok(bindings.length > 0, "expected the org cycle to persist hat bindings");
  ok(
    bindings.every((binding) => binding.wearerAgentId.startsWith("agent-kind-proof-")),
    "expected persisted hat bindings to use proof-source agent identities",
  );

  console.log(JSON.stringify({
    orgCycle: report,
    PROOF: "PASS",
    organizationId,
    rmoCandidateSource: kindProofCandidateSource.sourceName,
    rmoSourceEvidenceEvents: rmoSourceEvidenceEvents.length,
    proofSourceBindings: bindings.length,
  }, null, 2));
  await pool.end();
}

await main();
