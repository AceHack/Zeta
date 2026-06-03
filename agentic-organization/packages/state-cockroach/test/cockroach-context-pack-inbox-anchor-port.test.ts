import { deepEqual, equal, ok } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  asZetaIdDecimal,
  buildHatDefinitions,
  ContextPackInboxAnchorPriority,
  ContextPackInboxAnchorStatus,
  ContextPackInboxWorkflowBatchKind,
  ContextPackItemKind,
  ContextPackSourcePointerKind,
  createDeterministicContextPackBuilder,
  createInMemoryContextPackDocumentPort,
  RunLifecyclePhase,
  RunScope,
  type ContextPackBuildRequest,
} from "../../application/src/index.ts";
import { HatLevel } from "../../domain/src/index.ts";
import {
  CockroachContextPackInboxAnchorStatement,
  createCockroachContextPackInboxAnchorPort,
  createCockroachContextPackInboxWorkflowViewReader,
  type CockroachContextPackInboxAnchorSqlExecutor,
  type CockroachContextPackInboxAnchorSqlStatement,
} from "../src/index.ts";

const observedAt = "2026-06-03T12:00:00.000Z";
const InboxAnchorPortTestTime = {
  FutureSnooze: "2026-06-03T13:00:00.000Z",
  PastSnooze: "2026-06-03T11:00:00.000Z",
} as const;
const engineeringDirector = buildHatDefinitions().find((hat) => hat.id === "engineering_director")!;

describe("cockroach context pack inbox anchor port", () => {
  test("loads scoped per-hat inbox anchors behind the generic context-pack port", async () => {
    const executor = createRecordingExecutor();
    const builder = createDeterministicContextPackBuilder({
      documents: createInMemoryContextPackDocumentPort({ corpus: [], entities: [] }),
      inboxAnchors: createCockroachContextPackInboxAnchorPort({ executor }),
    });

    const result = await builder.build(request());

    deepEqual(executor.statements.map((statement) => statement.name), [
      CockroachContextPackInboxAnchorStatement.ListInboxAnchorsForHat,
    ]);
    deepEqual(executor.statements[0]?.parameters, [
      "org-lfg",
      "project-billing",
      "team-platform",
      "agent-director",
      "99",
      ContextPackInboxAnchorStatus.Dismissed,
      observedAt,
    ]);
    ok(executor.statements[0]?.sql.includes("team_id IS NULL OR team_id = $3"));
    ok(executor.statements[0]?.sql.includes("target_agent_id IS NULL OR target_agent_id = $4"));

    const inboxItem = result.pack.items.find((item) => item.id === "inbox:inbox-billing-blocker");
    equal(inboxItem?.kind, ContextPackItemKind.InboxAnchor);
    ok(inboxItem?.sourcePointers?.some((pointer) =>
      pointer.kind === ContextPackSourcePointerKind.InboxAnchor &&
      pointer.inboxAnchorId === "inbox-billing-blocker" &&
      pointer.targetHatAssignmentId === "99" &&
      pointer.targetAgentId === "agent-director"
    ));
    ok(inboxItem?.sourcePointers?.some((pointer) =>
      pointer.kind === ContextPackSourcePointerKind.WorkItem && pointer.workItemId === "work-billing-blocked"
    ));
    ok(!result.pack.items.some((item) => item.id === "inbox:inbox-other-hat"));
    ok(result.pack.omittedItemsWithReason.some((item) => item.nodeId === "inbox:inbox-other-hat"));
  });

  test("loads active-hat inbox anchors without active work provenance", async () => {
    const executor = createRecordingExecutor({ workItemId: null });
    const builder = createDeterministicContextPackBuilder({
      documents: createInMemoryContextPackDocumentPort({ corpus: [], entities: [] }),
      inboxAnchors: createCockroachContextPackInboxAnchorPort({ executor }),
    });

    const result = await builder.build(request({ workItemId: undefined }));

    const inboxItem = result.pack.items.find((item) => item.id === "inbox:inbox-billing-blocker");
    equal(inboxItem?.kind, ContextPackItemKind.InboxAnchor);
    ok(!inboxItem?.sourcePointers?.some((pointer) => pointer.kind === ContextPackSourcePointerKind.WorkItem));
    ok(!inboxItem?.citationRefs?.includes("work:undefined"));
  });

  test("does not load snoozed inbox anchors before their wake time", async () => {
    const executor = createRecordingExecutor({
      status: ContextPackInboxAnchorStatus.Snoozed,
      snoozedUntil: InboxAnchorPortTestTime.FutureSnooze,
    });
    const builder = createDeterministicContextPackBuilder({
      documents: createInMemoryContextPackDocumentPort({ corpus: [], entities: [] }),
      inboxAnchors: createCockroachContextPackInboxAnchorPort({ executor }),
    });

    const result = await builder.build(request());

    deepEqual(executor.statements[0]?.parameters, [
      "org-lfg",
      "project-billing",
      "team-platform",
      "agent-director",
      "99",
      ContextPackInboxAnchorStatus.Dismissed,
      observedAt,
    ]);
    ok(!result.pack.items.some((item) => item.id === "inbox:inbox-billing-blocker"));
  });

  test("loads snoozed inbox anchors once their wake time is due", async () => {
    const executor = createRecordingExecutor({
      status: ContextPackInboxAnchorStatus.Snoozed,
      snoozedUntil: InboxAnchorPortTestTime.PastSnooze,
    });
    const builder = createDeterministicContextPackBuilder({
      documents: createInMemoryContextPackDocumentPort({ corpus: [], entities: [] }),
      inboxAnchors: createCockroachContextPackInboxAnchorPort({ executor }),
    });

    const result = await builder.build(request());

    const inboxItem = result.pack.items.find((item) => item.id === "inbox:inbox-billing-blocker");
    equal(inboxItem?.kind, ContextPackItemKind.InboxAnchor);
  });

  test("drops malformed inbox rows before they can become context", async () => {
    const executor = createRecordingExecutor({ priority: "panic", status: "floating" });
    const builder = createDeterministicContextPackBuilder({
      documents: createInMemoryContextPackDocumentPort({ corpus: [], entities: [] }),
      inboxAnchors: createCockroachContextPackInboxAnchorPort({ executor }),
    });

    const result = await builder.build(request());

    ok(!result.pack.items.some((item) => item.id === "inbox:inbox-billing-blocker"));
  });

  test("loads durable per-hat workflow anchors including read and future snoozed rows", async () => {
    const executor = createRecordingExecutor({ includeWorkflowRows: true });

    const view = await createCockroachContextPackInboxWorkflowViewReader({ executor }).load({
      organizationId: "org-lfg",
      projectId: "project-billing",
      teamId: "team-platform",
      targetHatAssignmentId: "99",
      targetAgentId: "agent-director",
      observedAt,
    });

    deepEqual(executor.statements.map((statement) => statement.name), [
      CockroachContextPackInboxAnchorStatement.ListInboxWorkflowAnchorsForHat,
    ]);
    deepEqual(executor.statements[0]?.parameters, [
      "org-lfg",
      "project-billing",
      "team-platform",
      "99",
      "agent-director",
      ContextPackInboxAnchorStatus.Dismissed,
    ]);
    ok(executor.statements[0]?.sql.includes("status <> $6"));
    ok(!executor.statements[0]?.sql.includes("snoozed_until <= $7"));
    deepEqual(view.summary, {
      totalVisibleCount: 3,
      urgentUnreadCount: 1,
      normalUnreadCount: 0,
      readCount: 1,
      snoozedDueCount: 0,
      snoozedFutureCount: 1,
    });
    deepEqual(view.batches.map((batch) => batch.kind), [
      ContextPackInboxWorkflowBatchKind.UrgentUnread,
      ContextPackInboxWorkflowBatchKind.SnoozedFuture,
      ContextPackInboxWorkflowBatchKind.Read,
    ]);
    ok(view.batches.some((batch) =>
      batch.kind === ContextPackInboxWorkflowBatchKind.SnoozedFuture &&
      batch.items.some((item) => item.inboxAnchorId === "inbox-snoozed-future")
    ));
    ok(!view.batches.some((batch) =>
      batch.items.some((item) => item.inboxAnchorId === "inbox-dismissed")
    ));
  });
});

function request(overrides: Partial<ContextPackBuildRequest["snapshot"]> = {}): ContextPackBuildRequest {
  return {
    snapshot: {
      runId: asZetaIdDecimal("42"),
      scope: RunScope.Project,
      phase: RunLifecyclePhase.Blocked,
      trace: { correlationId: "corr-1", causationId: "cause-1", traceId: "trace-1" },
      hasGateApproval: false,
      hasEvidence: false,
      hatAssignmentId: asZetaIdDecimal("99"),
      hat: engineeringDirector,
      agentId: "agent-director",
      organizationId: "org-lfg",
      projectId: "project-billing",
      teamId: "team-platform",
      workItemId: "work-billing-blocked",
      ...overrides,
    },
    readout: {
      runId: asZetaIdDecimal("42"),
      scope: RunScope.Project,
      phase: RunLifecyclePhase.Blocked,
      trace: { correlationId: "corr-1", causationId: "cause-1", traceId: "trace-1" },
      observedAt,
      options: [],
      vetoedOptions: [],
      deterministicRulesApplied: [],
    },
    metrics: { scope: RunScope.Project, blocks: [] },
    promptFlows: { tasks: [], vetoedTasks: [] },
    hierarchy: {
      level: HatLevel.Director,
      projects: [],
      initiatives: [],
      metrics: [],
      policyViolations: [],
      priorityScope: "department_initiatives",
      priorityItems: [],
      scopedMetrics: [],
      actions: [],
      vetoedActions: [],
    },
    observedAt,
  };
}

function createRecordingExecutor(input: {
  workItemId?: string | null | undefined;
  priority?: unknown;
  status?: unknown;
  snoozedUntil?: string | null | undefined;
  includeWorkflowRows?: boolean | undefined;
} = {}): CockroachContextPackInboxAnchorSqlExecutor & {
  statements: CockroachContextPackInboxAnchorSqlStatement[];
} {
  const statements: CockroachContextPackInboxAnchorSqlStatement[] = [];
  return {
    statements,
    execute: async <Row = Record<string, unknown>>(statement: CockroachContextPackInboxAnchorSqlStatement) => {
      statements.push(statement);
      return { rows: rowsForStatement(input) as readonly unknown[] as readonly Row[] };
    },
  };
}

function rowsForStatement(input: {
  workItemId?: string | null | undefined;
  priority?: unknown;
  status?: unknown;
  snoozedUntil?: string | null | undefined;
  includeWorkflowRows?: boolean | undefined;
}): readonly Record<string, unknown>[] {
  return [
    {
      inbox_anchor_id: "inbox-billing-blocker",
      organization_id: "org-lfg",
      project_id: "project-billing",
      team_id: "team-platform",
      work_item_id: input.workItemId === undefined ? "work-billing-blocked" : input.workItemId,
      target_hat_assignment_id: "99",
      target_agent_id: "agent-director",
      title: "Billing blocker inbox",
      summary: "Director wakeup was triggered by a blocker inbox item.",
      priority: input.priority ?? ContextPackInboxAnchorPriority.Urgent,
      status: input.status ?? ContextPackInboxAnchorStatus.Unread,
      delivered_at: new Date("2026-06-03T11:45:00.000Z"),
      snoozed_until: input.snoozedUntil === undefined ? null : input.snoozedUntil,
      source_ref: "supervisor_signal:signal-billing-blocker",
      trace_id: "trace-inbox-billing-blocker",
    },
    {
      inbox_anchor_id: "inbox-other-hat",
      organization_id: "org-lfg",
      project_id: "project-billing",
      team_id: "team-platform",
      work_item_id: "work-billing-blocked",
      target_hat_assignment_id: "101",
      target_agent_id: "agent-director",
      title: "Other hat inbox",
      summary: "This row belongs to another hat assignment.",
      priority: ContextPackInboxAnchorPriority.Urgent,
      status: ContextPackInboxAnchorStatus.Unread,
      delivered_at: new Date("2026-06-03T11:50:00.000Z"),
      snoozed_until: null,
      source_ref: null,
      trace_id: null,
    },
    ...workflowRowsForStatement(input),
  ];
}

function workflowRowsForStatement(input: {
  includeWorkflowRows?: boolean | undefined;
}): readonly Record<string, unknown>[] {
  if (input.includeWorkflowRows !== true) return [];
  return [
    {
      inbox_anchor_id: "inbox-snoozed-future",
      organization_id: "org-lfg",
      project_id: "project-billing",
      team_id: "team-platform",
      work_item_id: "work-billing-blocked",
      target_hat_assignment_id: "99",
      target_agent_id: null,
      title: "Future snooze",
      summary: "This wakeup is deferred and still visible in workflow.",
      priority: ContextPackInboxAnchorPriority.Normal,
      status: ContextPackInboxAnchorStatus.Snoozed,
      delivered_at: new Date("2026-06-03T10:45:00.000Z"),
      snoozed_until: InboxAnchorPortTestTime.FutureSnooze,
      source_ref: "supervisor_signal:signal-snoozed",
      trace_id: "trace-inbox-snoozed",
    },
    {
      inbox_anchor_id: "inbox-read",
      organization_id: "org-lfg",
      project_id: "project-billing",
      team_id: "team-platform",
      work_item_id: "work-billing-blocked",
      target_hat_assignment_id: "99",
      target_agent_id: "agent-director",
      title: "Read inbox",
      summary: "This wakeup remains visible in read workflow history.",
      priority: ContextPackInboxAnchorPriority.Normal,
      status: ContextPackInboxAnchorStatus.Read,
      delivered_at: new Date("2026-06-03T10:30:00.000Z"),
      snoozed_until: null,
      source_ref: null,
      trace_id: null,
    },
    {
      inbox_anchor_id: "inbox-dismissed",
      organization_id: "org-lfg",
      project_id: "project-billing",
      team_id: "team-platform",
      work_item_id: "work-billing-blocked",
      target_hat_assignment_id: "99",
      target_agent_id: "agent-director",
      title: "Dismissed inbox",
      summary: "Dismissed workflow anchors are hidden.",
      priority: ContextPackInboxAnchorPriority.Urgent,
      status: ContextPackInboxAnchorStatus.Dismissed,
      delivered_at: new Date("2026-06-03T10:15:00.000Z"),
      snoozed_until: null,
      source_ref: null,
      trace_id: null,
    },
  ];
}
