import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { DocScopeKind, DocType, QualityGateOutcome, StageOutcome } from "../../domain/src/index.ts";
import {
  ContextPackDocConsultOutcomeAggregationScope,
  ContextPackDocConsultOutcomeClass,
  ContextPackFreshness,
  RunLifecyclePhase,
  RunScope,
  type ContextPackDocConsultOutcomeStamp,
  type ContextPackDocConsultRecord,
} from "../../application/src/index.ts";
import {
  CockroachDocConsultLedgerStoreStatement,
  createCockroachDocConsultLedgerStore,
} from "../src/cockroach-doc-consult-ledger-store.ts";
import { CockroachTableName } from "../src/cockroach-schema.ts";
import type { CockroachAnySqlStatement, CockroachGenericSqlExecutor } from "../src/cockroach-sql-executor.ts";

test("Cockroach doc consult ledger store upserts context-pack consult facts", async () => {
  const executor = fakeExecutor();
  const store = createCockroachDocConsultLedgerStore({ executor });

  await store.recordMany([consultRecord()]);

  equal(executor.statements.length, 1);
  const statement = executor.statements[0]!;
  equal(statement.name, CockroachDocConsultLedgerStoreStatement.UpsertMany);
  ok(statement.sql.includes(`INSERT INTO ${CockroachTableName.DocConsultLedger}`));
  ok(statement.sql.includes("context_pack_id"));
  ok(statement.sql.includes("ON CONFLICT (doc_consult_id) DO UPDATE SET"));
  ok(statement.sql.includes(`outcome = COALESCE(excluded.outcome, ${CockroachTableName.DocConsultLedger}.outcome)`));
  deepEqual(statement.parameters, [
    "context_pack_doc_consult:3af12633",
    "org-lfg",
    "doc-billing-brd",
    RunLifecyclePhase.Blocked,
    "work-123",
    "2026-06-02T12:00:00.000Z",
    null,
    "ctx-director-blocker",
    "42",
    RunScope.WorkItem,
    "engineering_director",
    "99",
    "agent-addison",
    "project-billing",
    "team-platform",
    JSON.stringify(["business-doc", "synthesis-briefing"]),
    JSON.stringify(["doc:doc-billing-brd", "synthesis:blocked"]),
    true,
    ContextPackFreshness.Stale,
    JSON.stringify(["required_consult", "management_blocker", "ranked_context"]),
    DocType.Brd,
    DocScopeKind.Project,
    "project-billing",
    "docs/projects/billing/brd.md#rules",
    "hash-billing-brd",
    "source-git",
    7,
    "trace-context",
    "corr-context",
    "cause-context",
  ]);
});

test("Cockroach doc consult ledger store aggregates known consult outcomes by doc unit", async () => {
  const executor = fakeExecutor([
    outcomeRow("doc-helpful", QualityGateOutcome.Approved, "2"),
    outcomeRow("doc-helpful", QualityGateOutcome.Waived, 1),
    outcomeRow("doc-helpful", StageOutcome.RequestChanges, "1"),
    outcomeRow("doc-risky", QualityGateOutcome.Rejected, "3"),
    outcomeRow("doc-risky", StageOutcome.Approve, "1"),
    outcomeRow("doc-unknown", "not_reviewed", "9"),
  ]);
  const store = createCockroachDocConsultLedgerStore({ executor });

  const counts = await store.loadOutcomeCounts({
    organizationId: "org-lfg",
    hatId: "engineering_director",
    stageId: RunLifecyclePhase.Blocked,
    workItemId: "work-123",
    projectId: "project-billing",
    teamId: "team-platform",
  });

  equal(executor.statements.length, 1);
  const statement = executor.statements[0]!;
  equal(statement.name, CockroachDocConsultLedgerStoreStatement.LoadOutcomeCounts);
  ok(statement.sql.includes(`FROM ${CockroachTableName.DocConsultOutcomes}`));
  ok(statement.sql.includes("GROUP BY doc_unit_id, outcome"));
  ok(statement.sql.includes("hat_id = $2"));
  ok(statement.sql.includes("stage_id = $3"));
  ok(statement.sql.includes("project_id = $4"));
  ok(statement.sql.includes("team_id = $5"));
  ok(!statement.sql.includes("work_item_id ="));
  deepEqual(statement.parameters, [
    "org-lfg",
    "engineering_director",
    RunLifecyclePhase.Blocked,
    "project-billing",
    "team-platform",
  ]);
  deepEqual(counts.get("doc-helpful"), {
    [ContextPackDocConsultOutcomeClass.Success]: 3,
    [ContextPackDocConsultOutcomeClass.Failure]: 1,
  });
  deepEqual(counts.get("doc-risky"), {
    [ContextPackDocConsultOutcomeClass.Success]: 1,
    [ContextPackDocConsultOutcomeClass.Failure]: 3,
  });
  equal(counts.has("doc-unknown"), false);
});

test("Cockroach doc consult ledger store can aggregate exact work-item outcomes when requested", async () => {
  const executor = fakeExecutor([outcomeRow("doc-helpful", QualityGateOutcome.Approved, "1")]);
  const store = createCockroachDocConsultLedgerStore({ executor });

  await store.loadOutcomeCounts({
    organizationId: "org-lfg",
    projectId: "project-billing",
    workItemId: "work-123",
    aggregationScope: ContextPackDocConsultOutcomeAggregationScope.ExactWorkItem,
  });

  const statement = executor.statements[0]!;
  ok(statement.sql.includes("work_item_id = $3"));
  deepEqual(statement.parameters, ["org-lfg", "project-billing", "work-123"]);
});

test("Cockroach doc consult ledger store fails closed for malformed exact work-item aggregation", async () => {
  const executor = fakeExecutor([outcomeRow("doc-helpful", QualityGateOutcome.Approved, "1")]);
  const store = createCockroachDocConsultLedgerStore({ executor });

  const counts = await store.loadOutcomeCounts({
    organizationId: "org-lfg",
    projectId: "project-billing",
    aggregationScope: ContextPackDocConsultOutcomeAggregationScope.ExactWorkItem,
  } as unknown as Parameters<typeof store.loadOutcomeCounts>[0]);

  equal(counts.size, 0);
  equal(executor.statements.length, 0);
});

test("Cockroach doc consult ledger store appends scoped quality outcomes without overwriting history", async () => {
  const executor = fakeExecutor([], [
    { doc_consult_id: "context_pack_doc_consult:one" },
    { doc_consult_id: "context_pack_doc_consult:two" },
  ]);
  const store = createCockroachDocConsultLedgerStore({ executor });

  const result = await store.stampOutcome(outcomeStamp());

  equal(result.stampedCount, 2);
  equal(executor.statements.length, 1);
  const statement = executor.statements[0]!;
  equal(statement.name, CockroachDocConsultLedgerStoreStatement.StampOutcome);
  ok(statement.sql.includes(`INSERT INTO ${CockroachTableName.DocConsultOutcomes}`));
  ok(statement.sql.includes(`FROM ${CockroachTableName.DocConsultLedger}`));
  ok(statement.sql.includes("ON CONFLICT (doc_consult_id, outcome_ref) DO UPDATE SET"));
  ok(statement.sql.includes("consulted_at <= $4"));
  ok(statement.sql.includes("agent_id = $5"));
  ok(statement.sql.includes("hat_assignment_id = $6"));
  ok(statement.sql.includes("project_id = $7"));
  ok(statement.sql.includes("work_item_id = $8"));
  ok(statement.sql.includes("team_id = $9"));
  ok(!statement.sql.includes("UPDATE agentic_org_doc_consult_ledger"));
  ok(statement.sql.includes("RETURNING doc_consult_id"));
  deepEqual(statement.parameters, [
    QualityGateOutcome.ChangesRequested,
    "quality_gate:quality-gate-123",
    "org-lfg",
    "2026-06-02T13:00:00.000Z",
    "agent-qa",
    "hat-qa",
    "project-billing",
    "work-123",
    "team-platform",
  ]);
});

function fakeExecutor(
  loadOutcomeRows: readonly Record<string, unknown>[] = [],
  stampOutcomeRows: readonly Record<string, unknown>[] = [],
): CockroachGenericSqlExecutor & { statements: CockroachAnySqlStatement[] } {
  const statements: CockroachAnySqlStatement[] = [];
  const execute = async <Row = Record<string, unknown>>(statement: CockroachAnySqlStatement) => {
    statements.push(statement);
    if (statement.name === CockroachDocConsultLedgerStoreStatement.LoadOutcomeCounts) {
      return { rows: loadOutcomeRows as Row[] };
    }
    if (statement.name === CockroachDocConsultLedgerStoreStatement.StampOutcome) {
      return { rows: stampOutcomeRows as Row[] };
    }
    return { rows: [] as Row[] };
  };
  return {
    statements,
    execute,
    executeTransaction: async (operation) => await operation({ execute }),
  };
}

function outcomeRow(docUnitId: string, outcome: string, count: string | number): Record<string, unknown> {
  return {
    doc_unit_id: docUnitId,
    outcome,
    count,
  };
}

function outcomeStamp(): ContextPackDocConsultOutcomeStamp {
  return {
    organizationId: "org-lfg",
    agentId: "agent-qa",
    hatAssignmentId: "hat-qa",
    projectId: "project-billing",
    teamId: "team-platform",
    workItemId: "work-123",
    outcome: QualityGateOutcome.ChangesRequested,
    outcomeRef: "quality_gate:quality-gate-123",
    outcomeRecordedAt: "2026-06-02T13:00:00.000Z",
  };
}

function consultRecord(): ContextPackDocConsultRecord {
  return {
    docConsultId: "context_pack_doc_consult:3af12633",
    organizationId: "org-lfg",
    docUnitId: "doc-billing-brd",
    stageId: RunLifecyclePhase.Blocked,
    workItemId: "work-123",
    consultedAt: "2026-06-02T12:00:00.000Z",
    contextPackId: "ctx-director-blocker",
    runId: "42",
    scope: RunScope.WorkItem,
    hatId: "engineering_director",
    hatAssignmentId: "99",
    agentId: "agent-addison",
    projectId: "project-billing",
    teamId: "team-platform",
    contextItemIds: ["business-doc", "synthesis-briefing"],
    sourceRefs: ["doc:doc-billing-brd", "synthesis:blocked"],
    required: true,
    freshness: ContextPackFreshness.Stale,
    reasons: ["required_consult", "management_blocker", "ranked_context"],
    docType: DocType.Brd,
    docScopeKind: DocScopeKind.Project,
    docScopeId: "project-billing",
    contentRef: "docs/projects/billing/brd.md#rules",
    contentHash: "hash-billing-brd",
    sourceId: "source-git",
    docVersion: 7,
    trace: {
      traceId: "trace-context",
      correlationId: "corr-context",
      causationId: "cause-context",
    },
  };
}
