/**
 * M1 KIND proof: append a small legal org_event trace to live Cockroach, read it
 * through the real org-event store, and replay it through the conformance checker.
 *
 *   kubectl -n agentic-org port-forward svc/cockroach 26259:26257 &
 *   COCKROACH_DATABASE_URL=postgresql://root@localhost:26259/defaultdb?sslmode=disable \
 *     node --experimental-strip-types deploy/run-conformance.ts
 */

import { randomUUID } from "node:crypto";
import { env } from "node:process";
import { Pool } from "pg";

import {
  ChangeSetPhase,
  DocLifecycleState,
  GraphConfidence,
  MemoryPhase,
  OrgEventKind,
  WorkItemState,
  type OrgEvent,
} from "../packages/domain/src/index.ts";
import { replayLedger } from "../packages/application/src/index.ts";
import {
  createCockroachOrgEventStore,
  createCockroachOrgSystemMigration,
  createCockroachSqlExecutor,
  splitSqlStatements,
} from "../packages/state-cockroach/src/index.ts";
import type { CockroachSqlClient } from "../packages/state-cockroach/src/cockroach-sql-executor.ts";

const connectionString = env.COCKROACH_DATABASE_URL ?? "postgresql://root@localhost:26257/defaultdb?sslmode=disable";
const organizationId = `org-conformance-${randomUUID().slice(0, 8)}`;
const liveOrganizationId = env.AGENTIC_ORG_CONFORMANCE_LIVE_ORG_ID ?? "org-lfg";
const now = new Date().toISOString();

function orgEvent(kind: OrgEventKind, fromState: string | undefined, toState: string | undefined, subjectId: string): OrgEvent {
  const id = `evt-${randomUUID()}`;
  return {
    id,
    kind,
    occurredAt: now,
    organizationId,
    subjectId,
    decision: `proof ${kind}`,
    supervisorChain: ["executive_board", "runtime_governance"],
    evidenceRefs: [`proof:${id}`],
    correlationId: organizationId,
    causationId: id,
    traceId: organizationId,
    ...(fromState !== undefined ? { fromState } : {}),
    ...(toState !== undefined ? { toState } : {}),
  };
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString });
  try {
    const client: CockroachSqlClient = {
      query: async (sql, parameters) => ({ rows: (await pool.query(sql, parameters as unknown[])).rows }),
      transaction: async (operation) => operation(client),
    };
    const executor = createCockroachSqlExecutor({ client });
    for (const statement of splitSqlStatements(createCockroachOrgSystemMigration().sql)) {
      await pool.query(statement);
    }

    const store = createCockroachOrgEventStore({ executor });
    const events: readonly OrgEvent[] = [
      orgEvent(OrgEventKind.WorkItemTransition, WorkItemState.Created, WorkItemState.Intake, "work-proof"),
      orgEvent(OrgEventKind.MemoryPhaseTransition, MemoryPhase.Active, MemoryPhase.Stale, "memory-proof"),
      orgEvent(OrgEventKind.ChangeSetApplied, ChangeSetPhase.Approved, ChangeSetPhase.Applied, "change-proof"),
      orgEvent(OrgEventKind.DocLifecycleTransition, DocLifecycleState.Draft, DocLifecycleState.InReview, "doc-proof"),
      orgEvent(OrgEventKind.GraphConfidencePromoted, GraphConfidence.Verified, GraphConfidence.Canonical, "graph-proof"),
      orgEvent(OrgEventKind.IntakeReceived, undefined, undefined, "intake-proof"),
    ];

    for (const event of events) {
      await store.append(event);
    }

    const persisted = await store.listByOrganization(organizationId, 100);
    const report = replayLedger(persisted);
    const livePersisted = await store.listByOrganization(liveOrganizationId, 1_000);
    const liveReport = replayLedger(livePersisted);
    const ok = report.checked === 5 && report.nonconformant === 0 && report.skipped === 1 && liveReport.nonconformant === 0;

    console.log(JSON.stringify({
      track: "M1 conformance checker",
      organizationId,
      liveOrganizationId,
      insertedEvents: events.length,
      persistedEvents: persisted.length,
      report,
      liveReport: {
        persistedEvents: livePersisted.length,
        checked: liveReport.checked,
        conformant: liveReport.conformant,
        nonconformant: liveReport.nonconformant,
        skipped: liveReport.skipped,
        violations: liveReport.violations,
      },
      PROOF: ok ? "PASS" : "FAIL",
    }, null, 2));
    process.exitCode = ok ? 0 : 1;
  } finally {
    await pool.end();
  }
}

await main();
