import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  ContextPackCurationStageKind,
  ContextPackStatus,
  RunLifecyclePhase,
  RunScope,
  asZetaIdDecimal,
  type ContextPackSnapshotRecord,
  type ContextReadout,
} from "../../application/src/index.ts";
import {
  CockroachContextPackSnapshotStoreStatement,
  createCockroachContextPackSnapshotStore,
} from "../src/cockroach-context-pack-snapshot-store.ts";
import type { CockroachAnySqlStatement, CockroachGenericSqlExecutor } from "../src/cockroach-sql-executor.ts";

test("Cockroach context-pack snapshot store round-trips replayable observe context", async () => {
  const executor = fakeExecutor();
  const store = createCockroachContextPackSnapshotStore({ executor });
  const snapshot = snapshotRecord({
    contextPackId: "ctx-director-blocker",
    status: ContextPackStatus.Conflicted,
    recordedAt: "2026-05-31T12:00:00.000Z",
  });

  await store.record(snapshot);

  const got = await store.get({ contextPackId: "ctx-director-blocker" });
  ok(got !== null);
  equal(got.recordedAt, "2026-05-31T12:00:00.000Z");
  equal(got.phase, RunLifecyclePhase.Blocked);
  equal(got.trace.traceId, "trace-ctx-director-blocker");
  equal(got.context.status, ContextPackStatus.Conflicted);
  deepEqual(got.context.pack, snapshot.context.pack);
});

test("Cockroach context-pack snapshot store returns latest matching scope", async () => {
  const executor = fakeExecutor();
  const store = createCockroachContextPackSnapshotStore({ executor });

  await store.record(snapshotRecord({
    contextPackId: "ctx-old",
    recordedAt: "2026-05-31T10:00:00.000Z",
    projectId: "project-billing",
    workItemId: "work-123",
  }));
  await store.record(snapshotRecord({
    contextPackId: "ctx-new",
    recordedAt: "2026-05-31T11:00:00.000Z",
    projectId: "project-billing",
    workItemId: "work-123",
  }));
  await store.record(snapshotRecord({
    contextPackId: "ctx-other-work",
    recordedAt: "2026-05-31T12:00:00.000Z",
    projectId: "project-billing",
    workItemId: "work-999",
  }));

  const got = await store.latestForScope({
    organizationId: "org-lfg",
    hatAssignmentId: "99",
    projectId: "project-billing",
    workItemId: "work-123",
  });

  equal(got?.context.pack.id, "ctx-new");
  equal(lastStatement(executor).name, CockroachContextPackSnapshotStoreStatement.LatestForScope);
  deepEqual(lastStatement(executor).parameters, ["org-lfg", "99", "project-billing", "work-123"]);
});

test("Cockroach context-pack snapshot store upserts by context pack id", async () => {
  const store = createCockroachContextPackSnapshotStore({ executor: fakeExecutor() });

  await store.record(snapshotRecord({
    contextPackId: "ctx-upsert",
    status: ContextPackStatus.Current,
    recordedAt: "2026-05-31T10:00:00.000Z",
  }));
  await store.record(snapshotRecord({
    contextPackId: "ctx-upsert",
    status: ContextPackStatus.Incomplete,
    recordedAt: "2026-05-31T11:00:00.000Z",
  }));

  const got = await store.get({ contextPackId: "ctx-upsert" });

  equal(got?.context.status, ContextPackStatus.Incomplete);
  equal(got?.recordedAt, "2026-05-31T11:00:00.000Z");
});

function fakeExecutor(): CockroachGenericSqlExecutor & { statements: CockroachAnySqlStatement[] } {
  const rows = new Map<string, Record<string, unknown>>();
  const statements: CockroachAnySqlStatement[] = [];
  const execute = async <Row = Record<string, unknown>>(statement: CockroachAnySqlStatement) => {
    statements.push(statement);
    if (statement.name === CockroachContextPackSnapshotStoreStatement.Upsert) {
      const row = rowFromParameters(statement.parameters);
      rows.set(row["context_pack_id"] as string, row);
      return { rows: [] as Row[] };
    }
    if (statement.name === CockroachContextPackSnapshotStoreStatement.Get) {
      const row = rows.get(statement.parameters[0] as string);
      return { rows: (row === undefined ? [] : [row]) as Row[] };
    }
    if (statement.name === CockroachContextPackSnapshotStoreStatement.LatestForScope) {
      return { rows: latestRowsFor(statement, [...rows.values()]) as Row[] };
    }
    return { rows: [] as Row[] };
  };
  return {
    statements,
    execute,
    executeTransaction: async (operation) => await operation({ execute }),
  };
}

function lastStatement(executor: { statements: CockroachAnySqlStatement[] }): CockroachAnySqlStatement {
  const statement = executor.statements.at(-1);
  if (statement === undefined) throw new Error("expected SQL statement");
  return statement;
}

function latestRowsFor(
  statement: CockroachAnySqlStatement,
  rows: readonly Record<string, unknown>[],
): readonly Record<string, unknown>[] {
  const filters = parseScopeFilters(statement);
  return rows
    .filter((row) =>
      filters.every((filter) => row[filter.column] === filter.value)
    )
    .sort((left, right) => String(right["recorded_at"]).localeCompare(String(left["recorded_at"])))
    .slice(0, 1);
}

function parseScopeFilters(statement: CockroachAnySqlStatement): readonly { column: string; value: unknown }[] {
  const columns = [
    "organization_id",
    "hat_assignment_id",
    "agent_id",
    "project_id",
    "team_id",
    "work_item_id",
  ];
  return columns.flatMap((column) => {
    const match = new RegExp(`${column} = \\$(\\d+)`).exec(statement.sql);
    if (match === null) return [];
    const parameterIndex = Number(match[1]) - 1;
    return [{ column, value: statement.parameters[parameterIndex] }];
  });
}

function rowFromParameters(parameters: readonly unknown[]): Record<string, unknown> {
  return {
    context_pack_id: parameters[0],
    organization_id: parameters[1],
    run_id: parameters[2],
    scope: parameters[3],
    hat_assignment_id: parameters[4],
    hat_id: parameters[5],
    agent_id: parameters[6],
    project_id: parameters[7],
    team_id: parameters[8],
    work_item_id: parameters[9],
    status: parameters[10],
    generated_at: parameters[11],
    freshness_deadline: parameters[12],
    recorded_at: parameters[13],
    source_graph_version: parameters[14],
    policy_version: parameters[15],
    trace_id: parameters[16],
    correlation_id: parameters[17],
    causation_id: parameters[18],
    context_json: parameters[19],
    phase: parameters[20],
  };
}

function snapshotRecord(overrides: {
  contextPackId: string;
  status?: ContextPackStatus | undefined;
  recordedAt?: string | undefined;
  projectId?: string | undefined;
  workItemId?: string | undefined;
}): ContextPackSnapshotRecord {
  return {
    context: contextReadout(overrides),
    recordedAt: overrides.recordedAt ?? "2026-05-31T12:00:00.000Z",
    trace: {
      traceId: `trace-${overrides.contextPackId}`,
      correlationId: `corr-${overrides.contextPackId}`,
      causationId: `cause-${overrides.contextPackId}`,
    },
    phase: RunLifecyclePhase.Blocked,
  };
}

function contextReadout(input: {
  contextPackId: string;
  status?: ContextPackStatus | undefined;
  projectId?: string | undefined;
  workItemId?: string | undefined;
}): ContextReadout {
  return {
    status: input.status ?? ContextPackStatus.Current,
    pack: {
      id: input.contextPackId,
      runId: asZetaIdDecimal("42"),
      organizationId: "org-lfg",
      scope: RunScope.WorkItem,
      hatAssignmentId: asZetaIdDecimal("99"),
      hatId: "engineering_director",
      agentId: "agent-addison",
      projectId: input.projectId ?? "project-billing",
      teamId: "team-platform",
      workItemId: input.workItemId ?? "work-123",
      generatedAt: "2026-05-31T12:00:00.000Z",
      freshnessDeadline: "2026-05-31T12:05:00.000Z",
      sourceGraphVersion: "graph:v1",
      policyVersion: "policy:v1",
      tokenBudget: 4096,
      curationTrace: [{
        stage: ContextPackCurationStageKind.DeterministicScope,
        summary: "Scoped by hat, org, project, team, and work item.",
        evidenceRefs: ["work:work-123"],
      }, {
        stage: ContextPackCurationStageKind.GapReview,
        summary: "No gaps in fixture.",
        evidenceRefs: ["context:test"],
      }],
      items: [],
      omittedItemsWithReason: [],
      contradictions: [],
      staleInputs: [],
      lifecycleBlockers: [],
    },
    requiredItems: [],
    optionalItems: [],
    omittedItemsWithReason: [],
    contradictions: [],
    staleInputs: [],
    lifecycleBlockers: [],
    uncertainty: {
      signalCount: 0,
      highSeverityCount: 0,
      mediumSeverityCount: 0,
      lowSeverityCount: 0,
      groups: [],
    },
    drillTargetGroups: [],
    summary: {
      requiredItemCount: 0,
      optionalItemCount: 0,
      omissionCount: 0,
      contradictionCount: 0,
      staleInputCount: 0,
      lifecycleBlockerCount: 0,
      uncertaintySignalCount: 0,
    },
  };
}
