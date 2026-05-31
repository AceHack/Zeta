/**
 * Phase 2.8 KIND proof: capture Cockroach query-index projections and verify a
 * restore/replay checksum. With RESTORED_COCKROACH_DATABASE_URL set, this
 * compares primary and restored databases. Without it, the proof exercises the
 * same snapshot source twice against the KIND database as a live checksum smoke.
 *
 *   kubectl -n agentic-org port-forward svc/cockroach 26261:26257 &
 *   COCKROACH_DATABASE_URL=postgresql://root@localhost:26261/defaultdb?sslmode=disable \
 *     node --experimental-strip-types deploy/run-restore-drill.ts
 */

import { randomUUID } from "node:crypto";
import { env } from "node:process";
import { Pool } from "pg";

import {
  ControlPlaneFlagKind,
  ControlPlaneRateLimitKind,
  ControlPlaneScopeKind,
  verifyRestoreDrill,
} from "../packages/application/src/index.ts";
import { OrgEventKind } from "../packages/domain/src/index.ts";
import {
  createCockroachControlPlaneStateStore,
  createCockroachCoreStateMigrations,
  createCockroachOrgEventStore,
  createCockroachRestoreDrillSnapshotSource,
  createCockroachSqlExecutor,
  splitSqlStatements,
} from "../packages/state-cockroach/src/index.ts";
import type {
  CockroachGenericSqlExecutor,
  CockroachSqlClient,
} from "../packages/state-cockroach/src/cockroach-sql-executor.ts";

const connectionString = env.COCKROACH_DATABASE_URL ?? "postgresql://root@localhost:26257/defaultdb?sslmode=disable";
const restoredConnectionString = env.RESTORED_COCKROACH_DATABASE_URL;
const proofRunId = randomUUID().slice(0, 8);
const organizationId = `org-restore-drill-${proofRunId}`;
const nowIso = new Date().toISOString();

async function main(): Promise<void> {
  const primary = await openExecutor(connectionString);
  const restored = restoredConnectionString === undefined
    ? primary
    : await openExecutor(restoredConnectionString);

  try {
    await applyMigrations(primary.pool);
    if (restored !== primary) {
      await applyMigrations(restored.pool);
    }

    await seedProofRows(primary.executor);
    if (restored !== primary) {
      await seedProofRows(restored.executor);
    }

    const before = await createCockroachRestoreDrillSnapshotSource({
      executor: primary.executor,
      organizationId,
      capturedAt: () => nowIso,
    }).captureSnapshot();
    const after = await createCockroachRestoreDrillSnapshotSource({
      executor: restored.executor,
      organizationId,
      capturedAt: () => nowIso,
    }).captureSnapshot();
    const verification = verifyRestoreDrill(before, after);
    const ok = verification.status === "passed" &&
      verification.before.rowCount === 3 &&
      verification.before.projectionCount === 3;

    console.log(JSON.stringify({
      track: "Phase 2.8 restore drill checksum",
      mode: restored === primary ? "single-db-smoke" : "primary-vs-restored",
      organizationId,
      verification,
      PROOF: ok ? "PASS" : "FAIL",
    }, null, 2));
    process.exitCode = ok ? 0 : 1;
  } finally {
    await primary.pool.end();
    if (restored !== primary) {
      await restored.pool.end();
    }
  }
}

async function openExecutor(databaseUrl: string): Promise<{
  pool: Pool;
  executor: CockroachGenericSqlExecutor;
}> {
  const pool = new Pool({ connectionString: databaseUrl });
  const client: CockroachSqlClient = {
    query: async (sql, parameters) => ({ rows: (await pool.query(sql, parameters as unknown[])).rows }),
    transaction: async (operation) => operation(client),
  };
  return { pool, executor: createCockroachSqlExecutor({ client }) };
}

async function applyMigrations(pool: Pool): Promise<void> {
  for (const migration of createCockroachCoreStateMigrations()) {
    for (const statement of splitSqlStatements(migration.sql)) {
      await pool.query(statement);
    }
  }
}

async function seedProofRows(executor: CockroachGenericSqlExecutor): Promise<void> {
  const controlPlane = createCockroachControlPlaneStateStore({ executor });
  await controlPlane.upsertFlag({
    controlPlaneFlagId: `flag-restore-${proofRunId}`,
    organizationId,
    scope: { kind: ControlPlaneScopeKind.Provider, providerId: "github" },
    flag: ControlPlaneFlagKind.ProviderFreeze,
    reason: "restore drill proof flag",
    setByHatId: "incident_commander",
    setAt: nowIso,
  });
  await controlPlane.upsertRateLimit({
    rateLimitId: `rate-limit-restore-${proofRunId}`,
    organizationId,
    scope: { kind: ControlPlaneScopeKind.Tenant, tenantId: organizationId },
    kind: ControlPlaneRateLimitKind.ExternalProviderCalls,
    window: {
      startedAt: new Date(Date.parse(nowIso) - 60_000).toISOString(),
      endsAt: new Date(Date.parse(nowIso) + 60_000).toISOString(),
    },
    limit: 1,
    used: 1,
  });
  await createCockroachOrgEventStore({ executor }).append({
    id: `org-event-restore-${proofRunId}`,
    kind: OrgEventKind.ObserveActTick,
    occurredAt: nowIso,
    organizationId,
    actorHatId: "restore_operator",
    actorAgentId: "agent-restore-proof",
    subjectId: "work-restore-drill",
    decision: "restore drill proof event",
    supervisorChain: ["executive_board", "incident_commander"],
    evidenceRefs: [`restore-drill:${proofRunId}`],
    correlationId: `corr-${proofRunId}`,
    causationId: `cause-${proofRunId}`,
    traceId: `trace-${proofRunId}`,
  });
}

await main();
