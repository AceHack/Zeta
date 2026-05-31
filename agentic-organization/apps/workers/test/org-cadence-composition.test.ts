import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  ControlPlaneFlagKind,
  ControlPlaneScopeKind,
  RunLifecyclePhase,
  RunScope,
} from "../../../packages/application/src/index.ts";
import {
  HatAssignmentAuthorityState,
  ScheduleBlockState,
  ScheduleBlockType,
  WorkItemState,
} from "../../../packages/domain/src/index.ts";
import { RecordingTelemetry, TelemetryMetricKind } from "../../../packages/observability/src/index.ts";
import type { CockroachGenericSqlExecutor } from "../../../packages/state-cockroach/src/cockroach-sql-executor.ts";
import { composeOrgCadenceLoops } from "../src/org-cadence-composition.ts";
import type { CadenceLaneTickRecord } from "../src/cadence-lane.ts";

test("org cadence composition can disable legacy work-os and run the observe-act work-item lane", async () => {
  const records: CadenceLaneTickRecord[] = [];
  let observeActCommands = 0;
  let legacyIntakeCalls = 0;

  const handle = composeOrgCadenceLoops({
    executor: createEmptyCockroachExecutor(),
    organizationId: "org-lfg",
    now: () => Date.parse("2026-05-31T12:00:00.000Z"),
    createId: (prefix) => `${prefix}-composition-test`,
    sleep: async () => {},
    maxTicksPerLane: 1,
    observer: { record: (record) => records.push(record) },
    workOsDriver: "observe-act-primary",
    observeActPromotionWindow: {
      shadowTickCount: 100,
      shadowSoakHours: 1,
      shadowDivergenceRate: 0,
      shadowIllegalSelections: 0,
      primarySelectorRejections30m: 0,
      primaryControlBypassRejections30m: 0,
    },
    intake: async () => {
      legacyIntakeCalls += 1;
      throw new Error("legacy work-os intake should be disabled");
    },
    observeActWorkItems: async () => ({
      runId: "1",
      projectId: "project-1",
      workItemId: "work-1",
      scope: RunScope.WorkItem,
      phase: RunLifecyclePhase.AwaitingGate,
      hasGateApproval: true,
      hasEvidence: false,
      hatId: "release_operator",
      hatAssignmentId: "99",
      agentId: "agent-release-1",
    }),
    observeActRunCommand: async () => {
      observeActCommands += 1;
      return { status: "accepted" };
    },
    observeActAuthorizeSlot: async () => ({ status: "allowed" }),
    observeActDispatchTool: async () => {
      throw new Error("observe-act composition test should not dispatch MCP");
    },
  });

  await handle.done;

  ok(records.some((record) => record.lane === "observe-act-work-item"));
  ok(records.some((record) =>
    record.lane === "work-os" &&
    record.status === "work-os:observe-act-primary-suppressed"
  ));
  equal(legacyIntakeCalls, 0);
  equal(observeActCommands, 1);
});

test("org cadence production observe-act source supplies team and supervisor assignment for meta.escalate", async () => {
  const records: CadenceLaneTickRecord[] = [];
  const commands: { commandType: string; command: unknown }[] = [];

  const handle = composeOrgCadenceLoops({
    executor: createObserveActEscalationCockroachExecutor(),
    organizationId: "org-lfg",
    now: () => Date.parse("2026-05-31T12:00:00.000Z"),
    createId: (prefix) => `${prefix}-composition-escalation-test`,
    sleep: async () => {},
    maxTicksPerLane: 1,
    observer: { record: (record) => records.push(record) },
    workOsDriver: "observe-act-primary",
    observeActPromotionWindow: {
      shadowTickCount: 100,
      shadowSoakHours: 1,
      shadowDivergenceRate: 0,
      shadowIllegalSelections: 0,
      primarySelectorRejections30m: 0,
      primaryControlBypassRejections30m: 0,
    },
    observeActSelectSlot: () => 15,
    observeActRunCommand: async (commandType, command) => {
      commands.push({ commandType, command });
      return { status: "accepted" };
    },
    observeActDispatchTool: async () => {
      throw new Error("observe-act escalation source test should not dispatch MCP");
    },
  });

  await handle.done;

  equal(records.find((record) => record.lane === "observe-act-work-item")?.status, "observe-act:command:accepted");
  equal(commands[0]?.commandType, "send_supervisor_signal");
  const command = commands[0]?.command as { targetHatAssignmentId?: string; policyContext?: { scope?: { teamId?: string } } } | undefined;
  equal(command?.targetHatAssignmentId, "101");
  equal(command?.policyContext?.scope?.teamId, "team-runtime");
});

test("org cadence production observe-act source skips stale rows and falls back to project-wide supervisors", async () => {
  const records: CadenceLaneTickRecord[] = [];
  const commands: { commandType: string; command: unknown }[] = [];
  const supervisorSql: string[] = [];

  const handle = composeOrgCadenceLoops({
    executor: createObserveActEscalationCockroachExecutor({
      staleFirst: true,
      projectWideSupervisor: true,
      supervisorSql,
    }),
    organizationId: "org-lfg",
    now: () => Date.parse("2026-05-31T12:00:00.000Z"),
    createId: (prefix) => `${prefix}-composition-escalation-fallback-test`,
    sleep: async () => {},
    maxTicksPerLane: 1,
    observer: { record: (record) => records.push(record) },
    workOsDriver: "observe-act-primary",
    observeActPromotionWindow: {
      shadowTickCount: 100,
      shadowSoakHours: 1,
      shadowDivergenceRate: 0,
      shadowIllegalSelections: 0,
      primarySelectorRejections30m: 0,
      primaryControlBypassRejections30m: 0,
    },
    observeActSelectSlot: () => 15,
    observeActRunCommand: async (commandType, command) => {
      commands.push({ commandType, command });
      return { status: "accepted" };
    },
    observeActDispatchTool: async () => {
      throw new Error("observe-act escalation fallback test should not dispatch MCP");
    },
  });

  await handle.done;

  equal(records.find((record) => record.lane === "observe-act-work-item")?.status, "observe-act:command:accepted");
  const command = commands[0]?.command as { targetHatAssignmentId?: string } | undefined;
  equal(command?.targetHatAssignmentId, "101-project-wide");
  ok(supervisorSql[0]?.includes("OR team_id IS NULL"));
});

test("org cadence composition shadow mode observes selected slots without dispatching observe-act side effects", async () => {
  const records: CadenceLaneTickRecord[] = [];
  let observeActCommands = 0;
  let legacyIntakeCalls = 0;

  const handle = composeOrgCadenceLoops({
    executor: createEmptyCockroachExecutor(),
    organizationId: "org-lfg",
    now: () => Date.parse("2026-05-31T12:00:00.000Z"),
    createId: (prefix) => `${prefix}-composition-shadow-test`,
    sleep: async () => {},
    maxTicksPerLane: 1,
    observer: { record: (record) => records.push(record) },
    workOsDriver: "observe-act-shadow",
    intake: async () => {
      legacyIntakeCalls += 1;
      return null;
    },
    observeActWorkItems: async () => ({
      runId: "1",
      projectId: "project-1",
      workItemId: "work-1",
      scope: RunScope.WorkItem,
      phase: RunLifecyclePhase.AwaitingGate,
      hasGateApproval: true,
      hasEvidence: false,
      hatId: "release_operator",
      hatAssignmentId: "99",
      agentId: "agent-release-1",
    }),
    observeActRunCommand: async () => {
      observeActCommands += 1;
      return { status: "accepted" };
    },
    observeActAuthorizeSlot: async () => ({ status: "allowed" }),
    observeActDispatchTool: async () => {
      throw new Error("observe-act composition test should not dispatch MCP");
    },
  });

  await handle.done;

  ok(records.some((record) => record.lane === "work-os"));
  ok(records.some((record) =>
    record.lane === "observe-act-work-item" &&
    record.status === "observe-act-shadow:command:shadow_selected"
  ));
  equal(legacyIntakeCalls, 1);
  equal(observeActCommands, 0);
});

test("org cadence promotion gate promotes a clean shadow window to observe-act primary", async () => {
  const records: CadenceLaneTickRecord[] = [];
  let observeActCommands = 0;
  let legacyIntakeCalls = 0;

  const handle = composeOrgCadenceLoops({
    executor: createEmptyCockroachExecutor(),
    organizationId: "org-lfg",
    now: () => Date.parse("2026-05-31T12:00:00.000Z"),
    createId: (prefix) => `${prefix}-promotion-test`,
    sleep: async () => {},
    maxTicksPerLane: 1,
    observer: { record: (record) => records.push(record) },
    workOsDriver: "observe-act-shadow",
    observeActPromotionWindow: {
      shadowTickCount: 100,
      shadowSoakHours: 1,
      shadowDivergenceRate: 0.01,
      shadowIllegalSelections: 0,
      primarySelectorRejections30m: 0,
      primaryControlBypassRejections30m: 0,
    },
    intake: async () => {
      legacyIntakeCalls += 1;
      throw new Error("legacy work-os should not run after observe-act promotion");
    },
    observeActWorkItems: async () => ({
      runId: "1",
      projectId: "project-1",
      workItemId: "work-1",
      scope: RunScope.WorkItem,
      phase: RunLifecyclePhase.AwaitingGate,
      hasGateApproval: true,
      hasEvidence: false,
      hatId: "release_operator",
      hatAssignmentId: "99",
      agentId: "agent-release-1",
    }),
    observeActRunCommand: async () => {
      observeActCommands += 1;
      return { status: "accepted" };
    },
    observeActAuthorizeSlot: async () => ({ status: "allowed" }),
    observeActDispatchTool: async () => {
      throw new Error("observe-act promotion test should not dispatch MCP");
    },
  });

  await handle.done;

  ok(records.some((record) =>
    record.lane === "observe-act-work-item" &&
    record.status === "observe-act:command:accepted"
  ));
  ok(records.some((record) =>
    record.lane === "work-os" &&
    record.status === "work-os:observe-act-primary-suppressed"
  ));
  equal(legacyIntakeCalls, 0);
  equal(observeActCommands, 1);
});

test("org cadence promotion gate can promote from a rolling window source", async () => {
  const records: CadenceLaneTickRecord[] = [];
  let observeActCommands = 0;
  let legacyIntakeCalls = 0;

  const handle = composeOrgCadenceLoops({
    executor: createEmptyCockroachExecutor(),
    organizationId: "org-lfg",
    now: () => Date.parse("2026-05-31T12:00:00.000Z"),
    createId: (prefix) => `${prefix}-promotion-source-test`,
    sleep: async () => {},
    maxTicksPerLane: 1,
    observer: { record: (record) => records.push(record) },
    workOsDriver: "observe-act-primary",
    observeActPromotionWindowSource: async () => ({
      shadowTickCount: 100,
      shadowSoakHours: 1,
      shadowDivergenceRate: 0,
      shadowIllegalSelections: 0,
      primarySelectorRejections30m: 0,
      primaryControlBypassRejections30m: 0,
    }),
    intake: async () => {
      legacyIntakeCalls += 1;
      throw new Error("legacy work-os should be suppressed after rolling promotion");
    },
    observeActWorkItems: async () => ({
      runId: "1",
      projectId: "project-1",
      workItemId: "work-1",
      scope: RunScope.WorkItem,
      phase: RunLifecyclePhase.AwaitingGate,
      hasGateApproval: true,
      hasEvidence: false,
      hatId: "release_operator",
      hatAssignmentId: "99",
      agentId: "agent-release-1",
    }),
    observeActRunCommand: async () => {
      observeActCommands += 1;
      return { status: "accepted" };
    },
    observeActAuthorizeSlot: async () => ({ status: "allowed" }),
    observeActDispatchTool: async () => {
      throw new Error("observe-act rolling promotion test should not dispatch MCP");
    },
  });

  await handle.done;

  ok(records.some((record) =>
    record.lane === "observe-act-work-item" &&
    record.status === "observe-act:command:accepted"
  ));
  ok(records.some((record) =>
    record.lane === "work-os" &&
    record.status === "work-os:observe-act-primary-suppressed"
  ));
  equal(legacyIntakeCalls, 0);
  equal(observeActCommands, 1);
});

test("org cadence promotion gate demotes unsafe primary windows to shadow", async () => {
  const records: CadenceLaneTickRecord[] = [];
  let observeActCommands = 0;
  let legacyIntakeCalls = 0;

  const handle = composeOrgCadenceLoops({
    executor: createEmptyCockroachExecutor(),
    organizationId: "org-lfg",
    now: () => Date.parse("2026-05-31T12:00:00.000Z"),
    createId: (prefix) => `${prefix}-demotion-test`,
    sleep: async () => {},
    maxTicksPerLane: 1,
    observer: { record: (record) => records.push(record) },
    workOsDriver: "observe-act-primary",
    observeActPromotionWindow: {
      shadowTickCount: 100,
      shadowSoakHours: 1,
      shadowDivergenceRate: 0,
      shadowIllegalSelections: 0,
      primarySelectorRejections30m: 2,
      primaryControlBypassRejections30m: 0,
    },
    intake: async () => {
      legacyIntakeCalls += 1;
      return null;
    },
    observeActWorkItems: async () => ({
      runId: "1",
      projectId: "project-1",
      workItemId: "work-1",
      scope: RunScope.WorkItem,
      phase: RunLifecyclePhase.AwaitingGate,
      hasGateApproval: true,
      hasEvidence: false,
      hatId: "release_operator",
      hatAssignmentId: "99",
      agentId: "agent-release-1",
    }),
    observeActRunCommand: async () => {
      observeActCommands += 1;
      return { status: "accepted" };
    },
    observeActAuthorizeSlot: async () => ({ status: "allowed" }),
    observeActDispatchTool: async () => {
      throw new Error("observe-act demotion test should not dispatch MCP");
    },
  });

  await handle.done;

  ok(records.some((record) => record.lane === "work-os"));
  ok(records.some((record) =>
    record.lane === "observe-act-work-item" &&
    record.status === "observe-act-shadow:command:shadow_selected"
  ));
  equal(legacyIntakeCalls, 1);
  equal(observeActCommands, 0);
});

test("org cadence promotion gate fails closed when primary mode has no promotion window", async () => {
  const records: CadenceLaneTickRecord[] = [];
  let observeActCommands = 0;
  let legacyIntakeCalls = 0;

  const handle = composeOrgCadenceLoops({
    executor: createEmptyCockroachExecutor(),
    organizationId: "org-lfg",
    now: () => Date.parse("2026-05-31T12:00:00.000Z"),
    createId: (prefix) => `${prefix}-missing-window-test`,
    sleep: async () => {},
    maxTicksPerLane: 1,
    observer: { record: (record) => records.push(record) },
    workOsDriver: "observe-act-primary",
    intake: async () => {
      legacyIntakeCalls += 1;
      return null;
    },
    observeActWorkItems: async () => ({
      runId: "1",
      projectId: "project-1",
      workItemId: "work-1",
      scope: RunScope.WorkItem,
      phase: RunLifecyclePhase.AwaitingGate,
      hasGateApproval: true,
      hasEvidence: false,
      hatId: "release_operator",
      hatAssignmentId: "99",
      agentId: "agent-release-1",
    }),
    observeActRunCommand: async () => {
      observeActCommands += 1;
      return { status: "accepted" };
    },
    observeActAuthorizeSlot: async () => ({ status: "allowed" }),
    observeActDispatchTool: async () => {
      throw new Error("observe-act missing-window test should not dispatch MCP");
    },
  });

  await handle.done;

  ok(records.some((record) => record.lane === "work-os"));
  ok(records.some((record) =>
    record.lane === "observe-act-work-item" &&
    record.status === "observe-act-shadow:command:shadow_selected"
  ));
  equal(legacyIntakeCalls, 1);
  equal(observeActCommands, 0);
});

test("org cadence promotion gate fails closed for compatibility observe-act mode without a promotion window", async () => {
  const records: CadenceLaneTickRecord[] = [];
  let observeActCommands = 0;
  let legacyIntakeCalls = 0;

  const handle = composeOrgCadenceLoops({
    executor: createEmptyCockroachExecutor(),
    organizationId: "org-lfg",
    now: () => Date.parse("2026-05-31T12:00:00.000Z"),
    createId: (prefix) => `${prefix}-compat-missing-window-test`,
    sleep: async () => {},
    maxTicksPerLane: 1,
    observer: { record: (record) => records.push(record) },
    workOsDriver: "observe-act",
    intake: async () => {
      legacyIntakeCalls += 1;
      return null;
    },
    observeActWorkItems: async () => ({
      runId: "1",
      projectId: "project-1",
      workItemId: "work-1",
      scope: RunScope.WorkItem,
      phase: RunLifecyclePhase.AwaitingGate,
      hasGateApproval: true,
      hasEvidence: false,
      hatId: "release_operator",
      hatAssignmentId: "99",
      agentId: "agent-release-1",
    }),
    observeActRunCommand: async () => {
      observeActCommands += 1;
      return { status: "accepted" };
    },
    observeActAuthorizeSlot: async () => ({ status: "allowed" }),
    observeActDispatchTool: async () => {
      throw new Error("observe-act compatibility missing-window test should not dispatch MCP");
    },
  });

  await handle.done;

  ok(records.some((record) => record.lane === "work-os"));
  ok(records.some((record) =>
    record.lane === "observe-act-work-item" &&
    record.status === "observe-act-shadow:command:shadow_selected"
  ));
  equal(legacyIntakeCalls, 1);
  equal(observeActCommands, 0);
});

test("org cadence composition passes telemetry through every composed lane", async () => {
  const telemetry = new RecordingTelemetry();
  const expectedLanes = [
    "work-os",
    "memory-maintenance",
    "change-control",
    "release-queue",
    "doc-maintenance",
    "conformance",
    "stale-reaction-plan-scan",
    "stranded-schedule-scan",
    "abandoned-run-binding-scan",
    "dead-letter-classifier",
  ];

  const handle = composeOrgCadenceLoops({
    executor: createEmptyCockroachExecutor(),
    organizationId: "org-lfg",
    now: () => Date.parse("2026-05-31T12:00:00.000Z"),
    createId: (prefix) => `${prefix}-telemetry-test`,
    sleep: async () => {},
    maxTicksPerLane: 1,
    telemetry,
  });

  await handle.done;

  equal(telemetry.spans.filter((span) => span.name === "org.lane.tick").length, expectedLanes.length);
  equal(telemetry.metrics.filter((metric) => metric.name === "org_lane_ticks_total").length, expectedLanes.length);
  for (const lane of expectedLanes) {
    ok(
      telemetry.spans.some((span) =>
        span.name === "org.lane.tick" &&
        span.ended &&
        span.attributes["agentic.lane"] === lane,
      ),
      `missing org.lane.tick span for ${lane}`,
    );
    ok(
      telemetry.metrics.some((metric) =>
        metric.kind === TelemetryMetricKind.Counter &&
        metric.name === "org_lane_ticks_total" &&
        metric.attributes?.["agentic.lane"] === lane,
      ),
      `missing org_lane_ticks_total metric for ${lane}`,
    );
  }
});

test("org cadence control-plane ESTOP blocks work lanes while control lanes keep ticking", async () => {
  const records: CadenceLaneTickRecord[] = [];
  let observeActCommands = 0;

  const handle = composeOrgCadenceLoops({
    executor: createEmptyCockroachExecutor(),
    organizationId: "org-lfg",
    now: () => Date.parse("2026-05-31T12:00:00.000Z"),
    createId: (prefix) => `${prefix}-control-plane-test`,
    sleep: async () => {},
    maxTicksPerLane: 1,
    observer: { record: (record) => records.push(record) },
    workOsDriver: "observe-act-primary",
    observeActPromotionWindow: {
      shadowTickCount: 100,
      shadowSoakHours: 1,
      shadowDivergenceRate: 0,
      shadowIllegalSelections: 0,
      primarySelectorRejections30m: 0,
      primaryControlBypassRejections30m: 0,
    },
    controlPlane: {
      flags: [{
        controlPlaneFlagId: "flag-estop",
        organizationId: "org-lfg",
        scope: { kind: ControlPlaneScopeKind.Organization },
        flag: ControlPlaneFlagKind.Estop,
        reason: "operator estop",
        setByHatId: "incident_commander",
        setAt: "2026-05-31T11:59:00.000Z",
      }],
    },
    observeActWorkItems: async () => {
      throw new Error("observe-act source should not run under ESTOP");
    },
    observeActRunCommand: async () => {
      observeActCommands += 1;
      return { status: "accepted" };
    },
    observeActDispatchTool: async () => ({ status: "dispatched" }),
  });

  await handle.done;

  const observeAct = records.find((record) => record.lane === "observe-act-work-item");
  const conformance = records.find((record) => record.lane === "conformance");
  const staleScan = records.find((record) => record.lane === "stale-reaction-plan-scan");
  equal(observeAct?.status, "observe-act-work-item:control-plane-denied");
  equal(observeAct?.failureCount, 1);
  equal(conformance?.status.startsWith("conformance:"), true);
  equal(staleScan?.status.startsWith("stale-reaction-plan-scan:"), true);
  equal(observeActCommands, 0);
});

function createEmptyCockroachExecutor(): CockroachGenericSqlExecutor {
  return {
    execute: async () => ({ rows: [] }),
    executeTransaction: async (operation) =>
      await operation({
        execute: async () => ({ rows: [] }),
      }),
  };
}

function createObserveActEscalationCockroachExecutor(options: {
  staleFirst?: boolean;
  projectWideSupervisor?: boolean;
  supervisorSql?: string[];
} = {}): CockroachGenericSqlExecutor {
  const now = "2026-05-31T12:00:00.000Z";
  return {
    execute: async (statement) => {
      if (statement.name === "claimable_observe_act_work_item") {
        return sqlRows([
          ...(options.staleFirst ? [{
            work_item_id: "work-stale",
            project_id: "project-1",
            state: WorkItemState.Ready,
            version: 6,
            created_by_agent_id: "agent-stale-1",
            created_by_hat_assignment_id: "999",
          }] : []),
          {
            work_item_id: "work-1",
            project_id: "project-1",
            state: WorkItemState.Ready,
            version: 7,
            created_by_agent_id: "agent-dependency-1",
            created_by_hat_assignment_id: "100",
          },
        ]);
      }
      if (statement.name === "find_hat_assignment_authority") {
        if (statement.parameters[0] === "999") {
          return sqlRows([]);
        }
        return sqlRows([{
            hat_assignment_id: "100",
            hat_id: "dependency_manager",
            organization_id: "org-lfg",
            project_id: "project-1",
            team_id: "team-runtime",
            assigned_agent_id: "agent-dependency-1",
            state: HatAssignmentAuthorityState.Active,
          }]);
      }
      if (statement.name === "find_active_observe_act_supervisor_hat_assignment") {
        options.supervisorSql?.push(statement.sql);
        return sqlRows([{ hat_assignment_id: options.projectWideSupervisor ? "101-project-wide" : "101" }]);
      }
      if (statement.name === "find_authorizing_schedule_blocks") {
        return sqlRows([{
            work_schedule_block_id: "schedule-1",
            organization_id: "org-lfg",
            project_id: "project-1",
            team_id: "team-runtime",
            work_item_id: "work-1",
            discussion_anchor_id: null,
            assigned_agent_id: "agent-dependency-1",
            assigned_hat_assignment_id: "100",
            block_type: ScheduleBlockType.PrioritizedWork,
            state: ScheduleBlockState.Active,
            title: "Resolve dependency blocker",
            purpose: "Authorize observe-act escalation",
            starts_at: "2026-05-31T11:00:00.000Z",
            ends_at: "2026-05-31T13:00:00.000Z",
            scheduled_by_agent_id: "agent-tpm-1",
            scheduled_by_hat_assignment_id: "101",
            scheduled_at: "2026-05-31T10:00:00.000Z",
            updated_at: now,
            version: 1,
            correlation_id: "corr-1",
            causation_id: "cause-1",
            trace_id: "trace-1",
          }]);
      }
      return sqlRows([]);
    },
    executeTransaction: async (operation) =>
      await operation({
        execute: async () => ({ rows: [] }),
      }),
  };
}

function sqlRows<Row = Record<string, unknown>>(rows: readonly unknown[]): { rows: readonly Row[] } {
  return { rows: rows as readonly Row[] };
}
