import { deepEqual, equal, ok } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  asZetaIdDecimal,
  buildHatDefinitions,
  ContextPackItemKind,
  ContextPackSourcePointerKind,
  createDeterministicContextPackBuilder,
  createInMemoryContextPackDocumentPort,
  RunLifecyclePhase,
  RunScope,
  type ContextPackBuildRequest,
} from "../../application/src/index.ts";
import {
  BusinessRuleEvaluationStatus,
  DiscussionAnchorType,
  DiscussionExpectedOutput,
  HatLevel,
  QualityGateKind,
  QualityGateOutcome,
  ScheduleBlockState,
  ScheduleBlockType,
  SupervisorChainLevel,
  SupervisorSignalStatus,
  SupervisorSignalToolType,
} from "../../domain/src/index.ts";
import {
  CockroachContextPackLifecycleAnchorStatement,
  createCockroachContextPackLifecycleAnchorPort,
  type CockroachContextPackLifecycleAnchorSqlExecutor,
  type CockroachContextPackLifecycleAnchorSqlStatement,
} from "../src/index.ts";

const observedAt = "2026-06-01T12:00:00.000Z";
const engineeringDirector = buildHatDefinitions().find((hat) => hat.id === "engineering_director")!;

describe("cockroach context pack lifecycle anchor port", () => {
  test("loads scoped lifecycle anchors behind the generic context-pack port", async () => {
    const executor = createRecordingExecutor();
    const builder = createDeterministicContextPackBuilder({
      documents: createInMemoryContextPackDocumentPort({ corpus: [], entities: [] }),
      lifecycleAnchors: createCockroachContextPackLifecycleAnchorPort({ executor }),
    });

    const result = await builder.build(request());

    deepEqual(executor.statements.map((statement) => statement.name), [
      CockroachContextPackLifecycleAnchorStatement.ListDiscussionAnchorsForWorkItem,
      CockroachContextPackLifecycleAnchorStatement.ListDecisionRecordsForWorkItem,
      CockroachContextPackLifecycleAnchorStatement.ListQualityGateEvaluationsForWorkItem,
      CockroachContextPackLifecycleAnchorStatement.ListWorkScheduleBlocksForWorkItem,
      CockroachContextPackLifecycleAnchorStatement.ListSupervisorSignalsForWorkItem,
    ]);
    deepEqual(executor.statements[0]?.parameters, ["org-lfg", "project-billing", "work-billing-blocked", "team-platform"]);
    deepEqual(executor.statements[3]?.parameters, [
      "org-lfg",
      "project-billing",
      "work-billing-blocked",
      "team-platform",
      "agent-director",
      "99",
      ScheduleBlockState.Active,
      ScheduleBlockState.Scheduled,
    ]);
    deepEqual(executor.statements[4]?.parameters, [
      "org-lfg",
      "project-billing",
      "work-billing-blocked",
      "team-platform",
      "99",
    ]);

    ok(result.pack.items.some((item) => item.id === "discussion:discussion-billing-blocker"));
    ok(result.pack.items.some((item) => item.id === "decision:decision-billing-owner"));
    ok(result.pack.items.some((item) => item.id === "quality_gate:quality-gate-billing-runtime"));
    ok(result.pack.items.some((item) => item.id === "schedule_block:schedule-billing-review"));
    const signal = result.pack.items.find((item) => item.id === "supervisor_signal:signal-billing-blocker");
    equal(signal?.kind, ContextPackItemKind.SupervisorSignal);
    ok(signal?.sourcePointers?.some((pointer) =>
      pointer.kind === ContextPackSourcePointerKind.SupervisorSignal &&
      pointer.supervisorSignalId === "signal-billing-blocker"
    ));
  });

  test("includes broader work-item anchors when the active request has a team scope", async () => {
    const executor = createRecordingExecutor();
    const port = createCockroachContextPackLifecycleAnchorPort({ executor });

    await port.load({
      query: "blocked billing context",
      observedAt,
      request: request(),
    });

    for (const statement of executor.statements) {
      ok(
        statement.sql.includes("team_id IS NULL OR team_id = $4"),
        `${statement.name} should include team-specific and broader work-item anchors`,
      );
    }
  });

  test("does not admit supervisor signals targeted to another hat assignment", async () => {
    const executor = createRecordingExecutor({ includeUnrelatedSupervisorSignal: true });
    const builder = createDeterministicContextPackBuilder({
      documents: createInMemoryContextPackDocumentPort({ corpus: [], entities: [] }),
      lifecycleAnchors: createCockroachContextPackLifecycleAnchorPort({ executor }),
    });

    const result = await builder.build(request());

    ok(result.pack.items.some((item) => item.id === "supervisor_signal:signal-billing-blocker"));
    ok(!result.pack.items.some((item) => item.id === "supervisor_signal:signal-other-hat"));
  });

  test("does not query lifecycle anchors when required active work scope is absent", async () => {
    const executor = createRecordingExecutor();
    const port = createCockroachContextPackLifecycleAnchorPort({ executor });

    const result = await port.load({
      query: "blocked billing context",
      observedAt,
      request: request({ workItemId: undefined }),
    });

    deepEqual(executor.statements, []);
    deepEqual(result.items, []);
    deepEqual(result.graphRootSeeds, []);
  });

  test("drops malformed lifecycle rows before they can become context", async () => {
    const executor = createRecordingExecutor({
      discussionExpectedOutputs: DiscussionExpectedOutput.Decision,
      qualityGateKind: "rubber_stamp",
      scheduleBlockState: "floating",
      supervisorSignalToolType: "mind_reading",
    });
    const builder = createDeterministicContextPackBuilder({
      documents: createInMemoryContextPackDocumentPort({ corpus: [], entities: [] }),
      lifecycleAnchors: createCockroachContextPackLifecycleAnchorPort({ executor }),
    });

    const result = await builder.build(request());

    ok(!result.pack.items.some((item) => item.id === "discussion:discussion-billing-blocker"));
    ok(!result.pack.items.some((item) => item.id === "quality_gate:quality-gate-billing-runtime"));
    ok(!result.pack.items.some((item) => item.id === "schedule_block:schedule-billing-review"));
    ok(!result.pack.items.some((item) => item.id === "supervisor_signal:signal-billing-blocker"));
    ok(result.pack.items.some((item) => item.id === "decision:decision-billing-owner"));
  });

  test("accepts JSONB arrays returned as serialized strings by the database driver", async () => {
    const executor = createRecordingExecutor({ jsonArraysAsStrings: true });
    const builder = createDeterministicContextPackBuilder({
      documents: createInMemoryContextPackDocumentPort({ corpus: [], entities: [] }),
      lifecycleAnchors: createCockroachContextPackLifecycleAnchorPort({ executor }),
    });

    const result = await builder.build(request());

    ok(result.pack.items.some((item) => item.id === "discussion:discussion-billing-blocker"));
    ok(result.pack.items.some((item) => item.id === "decision:decision-billing-owner"));
    ok(result.pack.items.some((item) => item.id === "quality_gate:quality-gate-billing-runtime"));
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

function createRecordingExecutor(
  input: {
    discussionExpectedOutputs?: unknown;
    qualityGateKind?: unknown;
    scheduleBlockState?: unknown;
    supervisorSignalToolType?: unknown;
    jsonArraysAsStrings?: boolean;
    includeUnrelatedSupervisorSignal?: boolean;
  } = {},
): CockroachContextPackLifecycleAnchorSqlExecutor & {
  statements: CockroachContextPackLifecycleAnchorSqlStatement[];
} {
  const statements: CockroachContextPackLifecycleAnchorSqlStatement[] = [];

  return {
    statements,
    execute: async <Row = Record<string, unknown>>(statement: CockroachContextPackLifecycleAnchorSqlStatement) => {
      statements.push(statement);
      return { rows: rowsForStatement(statement, input) as readonly unknown[] as readonly Row[] };
    },
  };
}

function rowsForStatement(
  statement: CockroachContextPackLifecycleAnchorSqlStatement,
  input: {
    discussionExpectedOutputs?: unknown;
    qualityGateKind?: unknown;
    scheduleBlockState?: unknown;
    supervisorSignalToolType?: unknown;
    jsonArraysAsStrings?: boolean;
    includeUnrelatedSupervisorSignal?: boolean;
  },
): readonly Record<string, unknown>[] {
  switch (statement.name) {
    case CockroachContextPackLifecycleAnchorStatement.ListDiscussionAnchorsForWorkItem:
      return [{
        discussion_anchor_id: "discussion-billing-blocker",
        organization_id: "org-lfg",
        project_id: "project-billing",
        team_id: "team-platform",
        work_item_id: "work-billing-blocked",
        discussion_anchor_type: DiscussionAnchorType.WorkItem,
        title: "Billing blocker discussion",
        purpose: "Decide how to recover failed invoice processing.",
        expected_outputs: input.discussionExpectedOutputs ?? jsonArray([DiscussionExpectedOutput.Decision], input),
        created_by_agent_id: "agent-manager",
        created_by_hat_assignment_id: "98",
        created_at: new Date("2026-06-01T10:00:00.000Z"),
        updated_at: new Date("2026-06-01T10:00:00.000Z"),
        version: "1",
        correlation_id: "corr-discussion",
        causation_id: "cause-discussion",
        trace_id: "trace-discussion",
      }];
    case CockroachContextPackLifecycleAnchorStatement.ListDecisionRecordsForWorkItem:
      return [{
        decision_record_id: "decision-billing-owner",
        organization_id: "org-lfg",
        project_id: "project-billing",
        team_id: "team-platform",
        work_item_id: "work-billing-blocked",
        discussion_anchor_id: "discussion-billing-blocker",
        title: "Billing recovery owner",
        decision: "Runtime owns the recovery fix.",
        rationale: "The reproduced failure is in the runtime pipeline.",
        alternatives_considered: jsonArray(["business retry", "manual support queue"], input),
        follow_up_work_item_ids: jsonArray(["work-runtime-follow-up"], input),
        decided_by_agent_id: "agent-director",
        decided_by_hat_assignment_id: "99",
        decided_at: new Date("2026-06-01T10:30:00.000Z"),
        updated_at: new Date("2026-06-01T10:30:00.000Z"),
        version: "1",
        correlation_id: "corr-decision",
        causation_id: "cause-decision",
        trace_id: "trace-decision",
      }];
    case CockroachContextPackLifecycleAnchorStatement.ListQualityGateEvaluationsForWorkItem:
      return [{
        quality_gate_evaluation_id: "quality-gate-billing-runtime",
        organization_id: "org-lfg",
        project_id: "project-billing",
        team_id: "team-platform",
        work_item_id: "work-billing-blocked",
        discussion_anchor_id: "discussion-billing-blocker",
        gate_kind: input.qualityGateKind ?? QualityGateKind.RuntimeValidation,
        outcome: QualityGateOutcome.ChangesRequested,
        summary: "Runtime validation still reproduces the failure.",
        evaluated_artifact_ids: jsonArray(["trace:billing-repro"], input),
        business_rule_results: jsonArray([{
          ruleId: "BRD-BILLING-001",
          status: BusinessRuleEvaluationStatus.NotSatisfied,
          evidenceArtifactIds: ["trace:billing-repro"],
          notes: "Invoice recovery is still broken.",
        }], input),
        evaluated_by_agent_id: "agent-qa",
        evaluated_by_hat_assignment_id: "97",
        evaluated_at: new Date("2026-06-01T11:00:00.000Z"),
        updated_at: new Date("2026-06-01T11:00:00.000Z"),
        version: "1",
        correlation_id: "corr-gate",
        causation_id: "cause-gate",
        trace_id: "trace-gate",
      }];
    case CockroachContextPackLifecycleAnchorStatement.ListWorkScheduleBlocksForWorkItem:
      return [{
        work_schedule_block_id: "schedule-billing-review",
        organization_id: "org-lfg",
        project_id: "project-billing",
        team_id: "team-platform",
        work_item_id: "work-billing-blocked",
        discussion_anchor_id: "discussion-billing-blocker",
        assigned_agent_id: "agent-director",
        assigned_hat_assignment_id: "99",
        block_type: ScheduleBlockType.Meeting,
        state: input.scheduleBlockState ?? ScheduleBlockState.Active,
        title: "Billing blocker review",
        purpose: "Review current blocker context.",
        starts_at: new Date("2026-06-01T11:30:00.000Z"),
        ends_at: new Date("2026-06-01T12:30:00.000Z"),
        scheduled_by_agent_id: "agent-manager",
        scheduled_by_hat_assignment_id: "98",
        scheduled_at: new Date("2026-06-01T09:00:00.000Z"),
        updated_at: new Date("2026-06-01T09:00:00.000Z"),
        version: "1",
        correlation_id: "corr-schedule",
        causation_id: "cause-schedule",
        trace_id: "trace-schedule",
      }];
    case CockroachContextPackLifecycleAnchorStatement.ListSupervisorSignalsForWorkItem: {
      const rows = [{
        supervisor_signal_id: "signal-billing-blocker",
        organization_id: "org-lfg",
        project_id: "project-billing",
        team_id: "team-platform",
        source_level: SupervisorChainLevel.TeamMember,
        target_level: SupervisorChainLevel.Manager,
        target_hat_assignment_id: "99",
        sender_agent_id: "agent-dev",
        sender_hat_assignment_id: "96",
        tool_type: input.supervisorSignalToolType ?? SupervisorSignalToolType.ReportBlocker,
        status: SupervisorSignalStatus.Sent,
        title: "Billing recovery blocked",
        message: "The runtime failure is still reproducible.",
        related_work_item_id: "work-billing-blocked",
        created_at: new Date("2026-06-01T11:15:00.000Z"),
      }];
      if (input.includeUnrelatedSupervisorSignal === true) {
        rows.push({
          supervisor_signal_id: "signal-other-hat",
          organization_id: "org-lfg",
          project_id: "project-billing",
          team_id: "team-platform",
          source_level: SupervisorChainLevel.TeamMember,
          target_level: SupervisorChainLevel.Manager,
          target_hat_assignment_id: "101",
          sender_agent_id: "agent-other-dev",
          sender_hat_assignment_id: "100",
          tool_type: SupervisorSignalToolType.ReportBlocker,
          status: SupervisorSignalStatus.Sent,
          title: "Another hat's blocker",
          message: "This signal belongs to a different hat assignment.",
          related_work_item_id: "work-billing-blocked",
          created_at: new Date("2026-06-01T11:20:00.000Z"),
        });
      }
      return rows;
    }
  }
}

function jsonArray(value: readonly unknown[], input: { jsonArraysAsStrings?: boolean }): unknown {
  return input.jsonArraysAsStrings === true ? JSON.stringify(value) : value;
}
