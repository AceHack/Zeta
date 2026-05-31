import { deepEqual, equal, ok, throws } from "node:assert/strict";
import { test } from "node:test";
import { buildHatDefinitions } from "../src/org-seed.ts";
import { ActionClass } from "../src/hat-guardrails.ts";
import {
  CommandType,
  ScheduleBlockState,
  ScheduleBlockType,
  SupervisorChainLevel,
  SupervisorSignalToolType,
  type WorkScheduleBlock,
} from "../../domain/src/index.ts";
import {
  asZetaIdDecimal,
  act,
  ActRejectionReason,
  ComposerDecision,
  DecideOutcome,
  decide,
  observeAgent,
  observeAgentSurface,
  observe,
  ObserveFeedbackReason,
  ObserveOutcome,
  renderMenu16,
  RunLifecyclePhase,
  RunScope,
  type EphemeralComposerPort,
  type AgentObserveSnapshot,
  type HierarchyInitiative,
  type HierarchyProject,
  type HierarchyWorkBatch,
  type HierarchyWorkItem,
  type Menu16,
  type ObserveDependencies,
  type PromptFlowTask,
  type RunSnapshot,
} from "../src/observe.ts";
import { createControlPlaneSlotAuthorizer } from "../src/control-plane-guard.ts";

const deps: ObserveDependencies = {
  clock: { now: () => "2026-05-29T00:00:00.000Z" },
};

function snapshot(overrides: Partial<RunSnapshot> = {}): RunSnapshot {
  return {
    runId: asZetaIdDecimal("42"),
    scope: RunScope.Run,
    phase: RunLifecyclePhase.Observing,
    trace: { correlationId: "corr-1", causationId: "cause-1", traceId: "trace-1" },
    hasGateApproval: false,
    hasEvidence: false,
    ...overrides,
  };
}

function agentSnapshot(overrides: Partial<AgentObserveSnapshot> = {}): AgentObserveSnapshot {
  const hats = buildHatDefinitions();
  const hat = hats.find((h) => h.id === "tpm")!;
  return {
    ...snapshot(),
    hatAssignmentId: asZetaIdDecimal("99"),
    hat,
    ...overrides,
  };
}

test("asZetaIdDecimal rejects non base-10 ids", () => {
  throws(() => asZetaIdDecimal("0x2a"), /not a base-10 ZetaId/);
  equal(asZetaIdDecimal("128"), "128");
});

test("observe returns a readout with surviving options and applied rule names", () => {
  const result = observe(snapshot(), deps);
  equal(result.outcome, ObserveOutcome.Readout);
  if (result.outcome !== ObserveOutcome.Readout) return;
  equal(result.readout.phase, RunLifecyclePhase.Observing);
  equal(result.readout.observedAt, "2026-05-29T00:00:00.000Z");
  deepEqual(result.readout.trace, snapshot().trace);
  ok(result.readout.options.some((o) => o.actionType === "compose"));
  deepEqual(result.readout.deterministicRulesApplied, ["gate-precondition", "evidence-precondition"]);
});

test("gate precondition vetoes execute until gate is approved", () => {
  const blocked = observe(snapshot({ phase: RunLifecyclePhase.AwaitingGate, hasGateApproval: false }), deps);
  equal(blocked.outcome, ObserveOutcome.Readout);
  if (blocked.outcome !== ObserveOutcome.Readout) return;
  ok(!blocked.readout.options.some((o) => o.actionType === "execute"));

  const approved = observe(snapshot({ phase: RunLifecyclePhase.AwaitingGate, hasGateApproval: true }), deps);
  equal(approved.outcome, ObserveOutcome.Readout);
  if (approved.outcome !== ObserveOutcome.Readout) return;
  ok(approved.readout.options.some((o) => o.actionType === "execute"));
});

test("observe records vetoed options with rule names and reasons", () => {
  const blocked = observe(snapshot({ phase: RunLifecyclePhase.AwaitingGate, hasGateApproval: false }), deps);
  equal(blocked.outcome, ObserveOutcome.Readout);
  if (blocked.outcome !== ObserveOutcome.Readout) return;
  equal(blocked.readout.vetoedOptions.length, 1);
  equal(blocked.readout.vetoedOptions[0]?.option.actionType, "execute");
  equal(blocked.readout.vetoedOptions[0]?.ruleName, "gate-precondition");
  ok(blocked.readout.vetoedOptions[0]?.reason.includes("requires an approved gate"));
});

test("hat-aware observe vetoes write-code execution for a TPM at render time", () => {
  const tpm = buildHatDefinitions().find((h) => h.id === "tpm")!;
  const blocked = observeAgent(
    agentSnapshot({
      phase: RunLifecyclePhase.AwaitingGate,
      hasGateApproval: true,
      hat: tpm,
    }),
    deps,
  );
  equal(blocked.outcome, ObserveOutcome.Readout);
  if (blocked.outcome !== ObserveOutcome.Readout) return;
  ok(!blocked.readout.options.some((o) => o.actionType === "execute"));
  equal(blocked.readout.vetoedOptions[0]?.option.actionType, "execute");
  equal(blocked.readout.vetoedOptions[0]?.ruleName, "hat-authority");
  ok(blocked.readout.vetoedOptions[0]?.reason.includes("lacks"));
});

test("hat-aware observe leaves write-code execution available for a delivery hat", () => {
  const releaseOperator = buildHatDefinitions().find((h) => h.id === "release_operator")!;
  const allowed = observeAgent(
    agentSnapshot({
      phase: RunLifecyclePhase.AwaitingGate,
      hasGateApproval: true,
      hat: releaseOperator,
    }),
    deps,
  );
  equal(allowed.outcome, ObserveOutcome.Readout);
  if (allowed.outcome !== ObserveOutcome.Readout) return;
  ok(allowed.readout.options.some((o) => o.actionType === "execute"));
  ok(!allowed.readout.vetoedOptions.some((v) => v.option.actionType === "execute"));
});

test("hat-aware observe requires an active work schedule block before execution", () => {
  const releaseOperator = buildHatDefinitions().find((h) => h.id === "release_operator")!;
  const blocked = observeAgent(
    agentSnapshot({
      phase: RunLifecyclePhase.AwaitingGate,
      hasGateApproval: true,
      hat: releaseOperator,
    }),
    {
      ...deps,
      scheduleBlocks: [],
    },
  );

  equal(blocked.outcome, ObserveOutcome.Readout);
  if (blocked.outcome !== ObserveOutcome.Readout) return;
  ok(!blocked.readout.options.some((option) => option.actionType === "execute"));
  const veto = blocked.readout.vetoedOptions.find((vetoed) => vetoed.option.actionType === "execute");
  equal(veto?.ruleName, "schedule-authority");
  ok(veto?.reason.includes("requires a current schedule block"));
});

test("hat-aware observe allows execution during prioritized work or prompt-flow schedule blocks", () => {
  const releaseOperator = buildHatDefinitions().find((h) => h.id === "release_operator")!;
  const allowed = observeAgent(
    agentSnapshot({
      phase: RunLifecyclePhase.AwaitingGate,
      hasGateApproval: true,
      hat: releaseOperator,
    }),
    {
      ...deps,
      scheduleBlocks: [scheduleBlock()],
    },
  );

  equal(allowed.outcome, ObserveOutcome.Readout);
  if (allowed.outcome !== ObserveOutcome.Readout) return;
  ok(allowed.readout.options.some((option) => option.actionType === "execute"));
  ok(!allowed.readout.vetoedOptions.some((vetoed) => vetoed.option.actionType === "execute"));
});

test("hat-aware observe vetoes execution when the current block type is not executable work", () => {
  const releaseOperator = buildHatDefinitions().find((h) => h.id === "release_operator")!;
  const blocked = observeAgent(
    agentSnapshot({
      phase: RunLifecyclePhase.AwaitingGate,
      hasGateApproval: true,
      hat: releaseOperator,
    }),
    {
      ...deps,
      scheduleBlocks: [scheduleBlock({ blockType: ScheduleBlockType.Meeting })],
    },
  );

  equal(blocked.outcome, ObserveOutcome.Readout);
  if (blocked.outcome !== ObserveOutcome.Readout) return;
  const veto = blocked.readout.vetoedOptions.find((vetoed) => vetoed.option.actionType === "execute");
  equal(veto?.ruleName, "schedule-authority");
  ok(veto?.reason.includes("does not allow execute"));
});

test("hat-aware observe does not authorize execution with a block for another work item", () => {
  const releaseOperator = buildHatDefinitions().find((h) => h.id === "release_operator")!;
  const blocked = observeAgent(
    agentSnapshot({
      phase: RunLifecyclePhase.AwaitingGate,
      hasGateApproval: true,
      hat: releaseOperator,
      agentId: "agent-1",
      organizationId: "org-1",
      projectId: "project-1",
      workItemId: "work-1",
    }),
    {
      ...deps,
      scheduleBlocks: [scheduleBlock({ workItemId: "work-other" })],
    },
  );

  equal(blocked.outcome, ObserveOutcome.Readout);
  if (blocked.outcome !== ObserveOutcome.Readout) return;
  const veto = blocked.readout.vetoedOptions.find((vetoed) => vetoed.option.actionType === "execute");
  equal(veto?.ruleName, "schedule-authority");
  ok(veto?.reason.includes("requires a current schedule block"));
});

test("renderMenu16 projects survivors, vetoes, and empty directions into fixed Tri slots", () => {
  const blocked = observe(snapshot({ phase: RunLifecyclePhase.AwaitingGate, hasGateApproval: false }), deps);
  equal(blocked.outcome, ObserveOutcome.Readout);
  if (blocked.outcome !== ObserveOutcome.Readout) return;

  const menu = renderMenu16(blocked.readout);
  equal(menu.slots.length, 16);
  ok(menu.slots.some((slot) => slot.availability === "T" && slot.action?.actionType === "block"));
  const executeSlot = menu.slots.find((slot) => slot.action?.actionType === "execute");
  equal(executeSlot?.availability, "F");
  ok(executeSlot?.reason?.includes("requires an approved gate"));
  ok(menu.slots.some((slot) => slot.availability === "N"));
});

test("renderMenu16 places lifecycle actions in the fixed commit bank", () => {
  const approved = observe(snapshot({ phase: RunLifecyclePhase.AwaitingGate, hasGateApproval: true }), deps);
  equal(approved.outcome, ObserveOutcome.Readout);
  if (approved.outcome !== ObserveOutcome.Readout) return;

  const menu = renderMenu16(approved.readout);

  equal(menu.slots[0]?.direction, "navigate.previous");
  equal(menu.slots[0]?.availability, "N");
  equal(menu.slots[4]?.direction, "commit.a");
  equal(menu.slots[4]?.availability, "T");
  equal(menu.slots[4]?.action?.actionType, "execute");
  equal(menu.slots[5]?.direction, "commit.b");
  equal(menu.slots[5]?.availability, "T");
  equal(menu.slots[5]?.action?.actionType, "block");
});

test("renderMenu16 keeps every lifecycle option visible in the commit bank", () => {
  const cases: readonly RunSnapshot[] = [
    snapshot({ phase: RunLifecyclePhase.Observing }),
    snapshot({ phase: RunLifecyclePhase.Composing }),
    snapshot({ phase: RunLifecyclePhase.AwaitingGate, hasGateApproval: true }),
    snapshot({ phase: RunLifecyclePhase.Executing }),
    snapshot({ phase: RunLifecyclePhase.AwaitingEvidence, hasEvidence: true }),
    snapshot({ phase: RunLifecyclePhase.AwaitingReview, hasEvidence: true }),
    snapshot({ phase: RunLifecyclePhase.Blocked }),
  ];

  for (const run of cases) {
    const observed = observe(run, deps);
    equal(observed.outcome, ObserveOutcome.Readout);
    if (observed.outcome !== ObserveOutcome.Readout) continue;
    const menu = renderMenu16(observed.readout);
    const renderedActions = new Set(menu.slots.flatMap((slot) => slot.action?.actionType ?? []));
    const readoutActions = [
      ...observed.readout.options.map((option) => option.actionType),
      ...observed.readout.vetoedOptions.map((vetoed) => vetoed.option.actionType),
    ];

    for (const actionType of readoutActions) {
      ok(renderedActions.has(actionType), `${run.phase} hides lifecycle action ${actionType}`);
    }
  }
});

test("renderMenu16 prompt-flow overflow prefers executable tasks over vetoed tasks", () => {
  const approved = observe(snapshot({
    scope: RunScope.WorkItem,
    phase: RunLifecyclePhase.AwaitingGate,
    hasGateApproval: true,
  }), deps);
  equal(approved.outcome, ObserveOutcome.Readout);
  if (approved.outcome !== ObserveOutcome.Readout) return;

  const allowed = promptFlowTask({
    taskId: "task-allowed",
    promptFlowId: "flow-allowed",
    label: "Allowed task",
    priority: 1,
  });
  const vetoedHigh = promptFlowTask({
    taskId: "task-vetoed-high",
    promptFlowId: "flow-vetoed-high",
    label: "Vetoed high task",
    priority: 100,
  });
  const vetoedNext = promptFlowTask({
    taskId: "task-vetoed-next",
    promptFlowId: "flow-vetoed-next",
    label: "Vetoed next task",
    priority: 99,
  });

  const menu = renderMenu16(approved.readout, {
    hatAssignmentId: asZetaIdDecimal("99"),
    promptFlows: {
      tasks: [allowed],
      vetoedTasks: [
        { task: vetoedHigh, ruleName: "hat-authority", reason: "hat lacks approval authority" },
        { task: vetoedNext, ruleName: "hat-authority", reason: "hat lacks review authority" },
      ],
    },
  });

  equal(menu.slots[6]?.label, "Allowed task");
  equal(menu.slots[6]?.availability, "T");
  equal(menu.slots[7]?.label, "Vetoed high task");
  equal(menu.slots[7]?.availability, "F");
});

test("renderMenu16 pages prompt-flow overflow through fixed navigation slots", async () => {
  const approved = observe(snapshot({
    scope: RunScope.WorkItem,
    phase: RunLifecyclePhase.AwaitingGate,
    hasGateApproval: true,
  }), deps);
  equal(approved.outcome, ObserveOutcome.Readout);
  if (approved.outcome !== ObserveOutcome.Readout) return;
  const tasks = Array.from({ length: 5 }, (_, index) => promptFlowTask({
    taskId: `task-${index + 1}`,
    promptFlowId: `flow-${index + 1}`,
    label: `Task ${index + 1}`,
    priority: 100 - index,
  }));

  const firstPage = renderMenu16(approved.readout, {
    hatAssignmentId: asZetaIdDecimal("99"),
    promptFlows: { tasks, vetoedTasks: [] },
  });

  deepEqual(firstPage.page?.promptFlows, { page: 0, pageSize: 2, pageCount: 3, total: 5 });
  equal(firstPage.slots[0]?.direction, "navigate.previous");
  equal(firstPage.slots[0]?.availability, "F");
  ok(firstPage.slots[0]?.reason?.includes("already at first prompt-flow page"));
  equal(firstPage.slots[1]?.direction, "navigate.next");
  equal(firstPage.slots[1]?.availability, "T");
  deepEqual(firstPage.slots[1]?.impl, {
    kind: "observe",
    toScope: RunScope.WorkItem,
    menuPage: { promptFlows: 1 },
  });
  deepEqual(firstPage.slots.slice(6, 8).map((slot) => slot.label), ["Task 1", "Task 2"]);

  const nextResult = await act(1, firstPage, {
    runCommand: async () => ({ ok: true }),
    dispatchTool: async () => ({ ok: true }),
  });

  deepEqual(nextResult, {
    outcome: "reobserve",
    scope: RunScope.WorkItem,
    menuPage: { promptFlows: 1 },
  });
});

test("renderMenu16 renders later prompt-flow overflow pages without changing slot count", () => {
  const approved = observe(snapshot({
    scope: RunScope.WorkItem,
    phase: RunLifecyclePhase.AwaitingGate,
    hasGateApproval: true,
  }), deps);
  equal(approved.outcome, ObserveOutcome.Readout);
  if (approved.outcome !== ObserveOutcome.Readout) return;
  const tasks = Array.from({ length: 5 }, (_, index) => promptFlowTask({
    taskId: `task-${index + 1}`,
    promptFlowId: `flow-${index + 1}`,
    label: `Task ${index + 1}`,
    priority: 100 - index,
  }));

  const middlePage = renderMenu16(approved.readout, {
    hatAssignmentId: asZetaIdDecimal("99"),
    promptFlowPage: 1,
    promptFlows: { tasks, vetoedTasks: [] },
  });

  equal(middlePage.slots.length, 16);
  deepEqual(middlePage.page?.promptFlows, { page: 1, pageSize: 2, pageCount: 3, total: 5 });
  equal(middlePage.slots[0]?.availability, "T");
  deepEqual(middlePage.slots[0]?.impl, {
    kind: "observe",
    toScope: RunScope.WorkItem,
    menuPage: { promptFlows: 0 },
  });
  equal(middlePage.slots[1]?.availability, "T");
  deepEqual(middlePage.slots[1]?.impl, {
    kind: "observe",
    toScope: RunScope.WorkItem,
    menuPage: { promptFlows: 2 },
  });
  deepEqual(middlePage.slots.slice(6, 8).map((slot) => slot.label), ["Task 3", "Task 4"]);

  const lastPage = renderMenu16(approved.readout, {
    hatAssignmentId: asZetaIdDecimal("99"),
    promptFlowPage: 2,
    promptFlows: { tasks, vetoedTasks: [] },
  });

  deepEqual(lastPage.page?.promptFlows, { page: 2, pageSize: 2, pageCount: 3, total: 5 });
  equal(lastPage.slots[0]?.availability, "T");
  equal(lastPage.slots[1]?.availability, "F");
  ok(lastPage.slots[1]?.reason?.includes("already at last prompt-flow page"));
  equal(lastPage.slots[6]?.label, "Task 5");
  equal(lastPage.slots[6]?.availability, "T");
  equal(lastPage.slots[7]?.label, "empty");
  equal(lastPage.slots[7]?.availability, "N");
});

test("renderMenu16 exposes ADR scope, history, and meta controller slots", async () => {
  const approved = observe(snapshot({
    scope: RunScope.WorkItem,
    phase: RunLifecyclePhase.AwaitingGate,
    hasGateApproval: true,
  }), deps);
  equal(approved.outcome, ObserveOutcome.Readout);
  if (approved.outcome !== ObserveOutcome.Readout) return;

  const menu = renderMenu16(approved.readout);

  equal(menu.slots[8]?.direction, "scope.out");
  equal(menu.slots[8]?.label, "scope out to initiative");
  equal(menu.slots[8]?.availability, "T");
  deepEqual(menu.slots[8]?.impl, { kind: "observe", toScope: RunScope.Initiative });
  equal(menu.slots[9]?.direction, "scope.in");
  equal(menu.slots[9]?.label, "scope in to run");
  equal(menu.slots[9]?.availability, "T");
  deepEqual(menu.slots[9]?.impl, { kind: "observe", toScope: RunScope.Run });
  equal(menu.slots[10]?.direction, "history.retract");
  equal(menu.slots[10]?.label, "retract");
  equal(menu.slots[10]?.availability, "F");
  ok(menu.slots[10]?.reason?.includes("retraction is not wired"));
  equal(menu.slots[11]?.direction, "history.redo");
  equal(menu.slots[11]?.label, "redo");
  equal(menu.slots[11]?.availability, "F");
  ok(menu.slots[11]?.reason?.includes("redo is not wired"));
  equal(menu.slots[12]?.direction, "meta.refresh");
  equal(menu.slots[12]?.label, "refresh");
  equal(menu.slots[12]?.availability, "T");
  equal(menu.slots[13]?.direction, "meta.status");
  equal(menu.slots[13]?.label, "status / glass-halo");
  equal(menu.slots[14]?.direction, "meta.pause");
  equal(menu.slots[14]?.label, "pause");
  equal(menu.slots[15]?.direction, "meta.escalate");
  equal(menu.slots[15]?.label, "escalate");

  const scopeResult = await act(8, menu, {
    runCommand: async () => ({ ok: true }),
    dispatchTool: async () => ({ ok: true }),
  });
  deepEqual(scopeResult, { outcome: "reobserve", scope: RunScope.Initiative });

  const drillResult = await act(9, menu, {
    runCommand: async () => ({ ok: true }),
    dispatchTool: async () => ({ ok: true }),
  });
  deepEqual(drillResult, { outcome: "reobserve", scope: RunScope.Run });

  const refreshResult = await act(12, menu, {
    runCommand: async () => ({ ok: true }),
    dispatchTool: async () => ({ ok: true }),
  });
  deepEqual(refreshResult, { outcome: "reobserve", scope: RunScope.WorkItem });
});

test("renderMenu16 makes meta.status emit a glass-halo status signal", async () => {
  const approved = observe(snapshot({
    scope: RunScope.WorkItem,
    phase: RunLifecyclePhase.AwaitingGate,
    hasGateApproval: true,
  }), deps);
  equal(approved.outcome, ObserveOutcome.Readout);
  if (approved.outcome !== ObserveOutcome.Readout) return;

  const menu = renderMenu16(approved.readout, {
    status: {
      metricBlockIds: ["queue.pressure", "review.lag"],
      promptFlowIds: ["flow-implement"],
      promptFlowTaskCount: 1,
      vetoedPromptFlowTaskCount: 0,
    },
  });

  equal(menu.slots[13]?.direction, "meta.status");
  equal(menu.slots[13]?.label, "status / glass-halo");
  equal(menu.slots[13]?.availability, "T");
  deepEqual(menu.slots[13]?.impl, {
    kind: "status",
    status: {
      kind: "glass_halo_status",
      runId: "42",
      scope: RunScope.WorkItem,
      phase: RunLifecyclePhase.AwaitingGate,
      observedAt: "2026-05-29T00:00:00.000Z",
      trace: { correlationId: "corr-1", causationId: "cause-1", traceId: "trace-1" },
      legalOptionCount: 2,
      vetoedOptionCount: 0,
      deterministicRulesApplied: ["gate-precondition", "evidence-precondition"],
      metricBlockIds: ["queue.pressure", "review.lag"],
      promptFlowIds: ["flow-implement"],
      promptFlowTaskCount: 1,
      vetoedPromptFlowTaskCount: 0,
    },
  });

  const result = await act(13, menu, {
    runCommand: async () => {
      throw new Error("status must not dispatch command side effects");
    },
    dispatchTool: async () => {
      throw new Error("status must not dispatch MCP side effects");
    },
  });

  deepEqual(result, {
    outcome: "status_report",
    status: menu.slots[13]?.impl?.kind === "status" ? menu.slots[13].impl.status : undefined,
  });
});

test("renderMenu16 makes meta.escalate emit a scoped supervisor signal when supervisor context is present", async () => {
  const approved = observe(snapshot({
    scope: RunScope.WorkItem,
    phase: RunLifecyclePhase.AwaitingGate,
    hasGateApproval: true,
  }), deps);
  equal(approved.outcome, ObserveOutcome.Readout);
  if (approved.outcome !== ObserveOutcome.Readout) return;

  const menu = renderMenu16(approved.readout, {
    hatAssignmentId: asZetaIdDecimal("99"),
    escalation: {
      teamId: "team-runtime",
      workItemId: "work-1",
      sourceLevel: SupervisorChainLevel.TeamMember,
      targetLevel: SupervisorChainLevel.Manager,
      targetHatAssignmentId: "hat-manager-1",
    },
  });

  equal(menu.slots[15]?.direction, "meta.escalate");
  equal(menu.slots[15]?.label, "escalate to manager");
  equal(menu.slots[15]?.availability, "T");
  deepEqual(menu.slots[15]?.impl, {
    kind: "command",
    commandType: CommandType.SendSupervisorSignal,
    command: {
      targetHatAssignmentId: "hat-manager-1",
      title: "Observe-act escalation for work_item awaiting_gate",
      message: "Agent requested supervisor triage for run 42 at work_item/awaiting_gate. Legal options: 2; vetoed options: 0.",
      policyContext: {
        scope: {
          teamId: "team-runtime",
          workItemId: "work-1",
        },
        toolType: SupervisorSignalToolType.RequestEscalation,
        supervisorChain: {
          sourceLevel: SupervisorChainLevel.TeamMember,
          targetLevel: SupervisorChainLevel.Manager,
        },
      },
    },
  });

  const result = await act(15, menu, {
    runCommand: async (commandType, command) => ({ commandType, command }),
    dispatchTool: async () => ({ ok: true }),
  });

  deepEqual(result, {
    outcome: "dispatched",
    kind: "command",
    result: {
      commandType: CommandType.SendSupervisorSignal,
      command: menu.slots[15]?.impl?.kind === "command" ? menu.slots[15].impl.command : undefined,
    },
  });
});

test("observeAgentSurface disables meta.escalate when the hat lacks supervisor-signal authority", async () => {
  const releaseOperator = buildHatDefinitions().find((h) => h.id === "release_operator")!;
  const surface = await observeAgentSurface(
    agentSnapshot({
      scope: RunScope.WorkItem,
      phase: RunLifecyclePhase.AwaitingGate,
      hasGateApproval: true,
      hat: releaseOperator,
      agentId: "agent-release-1",
      organizationId: "org-1",
      projectId: "project-1",
      teamId: "team-runtime",
      workItemId: "work-1",
      supervisorHatAssignmentId: "hat-manager-1",
    }),
    deps,
  );

  equal(surface.outcome, ObserveOutcome.Readout);
  if (surface.outcome !== ObserveOutcome.Readout) return;
  equal(surface.actions.slots[15]?.availability, "F");
  ok(surface.actions.slots[15]?.reason?.includes("lacks"));
  ok(surface.actions.slots[15]?.reason?.includes("backlog_and_defect"));
});

test("renderMenu16 disables scope-out at organization scope and scope-in at run scope", () => {
  const approved = observe(snapshot({
    scope: RunScope.Organization,
    phase: RunLifecyclePhase.Observing,
  }), deps);
  equal(approved.outcome, ObserveOutcome.Readout);
  if (approved.outcome !== ObserveOutcome.Readout) return;

  const menu = renderMenu16(approved.readout);

  equal(menu.slots[8]?.direction, "scope.out");
  equal(menu.slots[8]?.label, "scope out");
  equal(menu.slots[8]?.availability, "F");
  ok(menu.slots[8]?.reason?.includes("already at organization scope"));
  equal(menu.slots[9]?.direction, "scope.in");
  equal(menu.slots[9]?.label, "scope in to project");
  equal(menu.slots[9]?.availability, "T");

  const run = observe(snapshot({
    scope: RunScope.Run,
    phase: RunLifecyclePhase.Observing,
  }), deps);
  equal(run.outcome, ObserveOutcome.Readout);
  if (run.outcome !== ObserveOutcome.Readout) return;

  const runMenu = renderMenu16(run.readout);
  equal(runMenu.slots[8]?.direction, "scope.out");
  equal(runMenu.slots[8]?.label, "scope out to work_item");
  equal(runMenu.slots[8]?.availability, "T");
  equal(runMenu.slots[9]?.direction, "scope.in");
  equal(runMenu.slots[9]?.label, "scope in");
  equal(runMenu.slots[9]?.availability, "F");
  ok(runMenu.slots[9]?.reason?.includes("already at run scope"));
});

test("observe returns an all-vetoed readout so renderMenu16 can show dark slots with reasons", () => {
  const blocked = observe(snapshot({ phase: RunLifecyclePhase.Observing }), {
    clock: deps.clock,
    deterministicRules: [
      {
        name: "maintenance-freeze",
        veto: (option) => `maintenance freeze blocks ${option.actionType}`,
      },
    ],
  });

  equal(blocked.outcome, ObserveOutcome.Readout);
  if (blocked.outcome !== ObserveOutcome.Readout) return;
  equal(blocked.readout.options.length, 0);
  equal(blocked.readout.vetoedOptions.length, 2);

  const menu = renderMenu16(blocked.readout);
  equal(menu.slots[4]?.availability, "F");
  equal(menu.slots[4]?.action?.actionType, "compose");
  ok(menu.slots[4]?.reason?.includes("maintenance freeze blocks compose"));
  equal(menu.slots[5]?.availability, "F");
  equal(menu.slots[5]?.action?.actionType, "block");
});

test("renderMenu16 keeps all-vetoed menus dark even when prompt-flow tasks exist", () => {
  const blocked = observe(snapshot({ phase: RunLifecyclePhase.Observing }), {
    clock: deps.clock,
    deterministicRules: [
      {
        name: "maintenance-freeze",
        veto: (option) => `maintenance freeze blocks ${option.actionType}`,
      },
    ],
  });

  equal(blocked.outcome, ObserveOutcome.Readout);
  if (blocked.outcome !== ObserveOutcome.Readout) return;

  const menu = renderMenu16(blocked.readout, {
    hatAssignmentId: asZetaIdDecimal("99"),
    promptFlows: {
      tasks: [promptFlowTask({ taskId: "task-execute", promptFlowId: "flow-implement", label: "Implement work item" })],
      vetoedTasks: [],
    },
  });

  equal(menu.slots[4]?.availability, "F");
  equal(menu.slots[5]?.availability, "F");
  equal(menu.slots[6]?.direction, "inspect.more");
  equal(menu.slots[6]?.availability, "N");
  equal(menu.slots[6]?.label, "empty");
  equal(menu.slots[7]?.direction, "branch.fork");
  equal(menu.slots[7]?.availability, "N");
  equal(menu.slots[8]?.availability, "N");
});

test("act rejects non-selectable slots before any implementation dispatch", async () => {
  const blocked = observe(snapshot({ phase: RunLifecyclePhase.AwaitingGate, hasGateApproval: false }), deps);
  equal(blocked.outcome, ObserveOutcome.Readout);
  if (blocked.outcome !== ObserveOutcome.Readout) return;
  const menu = renderMenu16(blocked.readout);
  const darkIndex = menu.slots.find((slot) => slot.availability === "F")!.index;
  let dispatched = false;

  const result = await act(darkIndex, menu, {
    runCommand: async () => {
      dispatched = true;
      return { ok: true };
    },
    dispatchTool: async () => {
      dispatched = true;
      return { ok: true };
    },
  });

  equal(result.outcome, "rejected");
  equal(dispatched, false);
});

test("act rejects slot indexes outside the fixed 16-direction grammar even if a malformed menu is longer", async () => {
  const malformed: Menu16 = {
    slots: [
      ...Array.from({ length: 16 }, (_, index) => ({
        index,
        direction: `slot.${index}`,
        label: "empty",
        availability: "N" as const,
      })),
      {
        index: 16,
        direction: "overflow.illegal",
        label: "illegal seventeenth slot",
        availability: "T",
        impl: { kind: "mcp" as const, tool: "unsafe.extra_slot" },
      },
    ],
  };
  let dispatched = false;

  const result = await act(16, malformed, {
    runCommand: async () => ({ ok: true }),
    dispatchTool: async () => {
      dispatched = true;
      return { ok: true };
    },
  });

  equal(result.outcome, "rejected");
  if (result.outcome !== "rejected") return;
  equal(result.reason, ActRejectionReason.SlotOutOfRange);
  equal(dispatched, false);
});

test("act re-authorizes selectable slots before dispatching side effects", async () => {
  const approved = observe(snapshot({ phase: RunLifecyclePhase.AwaitingGate, hasGateApproval: true }), deps);
  equal(approved.outcome, ObserveOutcome.Readout);
  if (approved.outcome !== ObserveOutcome.Readout) return;
  const menu = renderMenu16(approved.readout);
  let dispatched = false;

  const result = await act(4, menu, {
    authorizeSlot: async () => ({
      status: "denied",
      reason: "schedule_authority_denied",
      message: "current schedule block expired after observe",
    }),
    runCommand: async () => {
      dispatched = true;
      return { ok: true };
    },
    dispatchTool: async () => {
      dispatched = true;
      return { ok: true };
    },
  });

  equal(result.outcome, "rejected");
  if (result.outcome !== "rejected") return;
  equal(result.reason, ActRejectionReason.ScheduleAuthorityDenied);
  equal(result.message, "current schedule block expired after observe");
  equal(dispatched, false);
});

test("act routes selectable MCP, command, and observe slots through injected implementations", async () => {
  const menu: Menu16 = {
    slots: [
      {
        index: 0,
        direction: "commit.a",
        label: "metrics",
        availability: "T",
        impl: { kind: "mcp", tool: "metrics.snapshot", args: { scope: "work_item" } },
      },
      {
        index: 1,
        direction: "commit.b",
        label: "schedule",
        availability: "T",
        impl: { kind: "command", commandType: "schedule_work_block", command: { workItemId: "work-1" } },
      },
      {
        index: 2,
        direction: "scope.in",
        label: "drill",
        availability: "T",
        impl: { kind: "observe", toScope: RunScope.WorkItem },
      },
      ...Array.from({ length: 13 }, (_, offset) => ({
        index: offset + 3,
        direction: `empty.${offset}`,
        label: "empty",
        availability: "N" as const,
      })),
    ],
  };
  const calls: string[] = [];

  const mcp = await act(0, menu, {
    runCommand: async () => {
      calls.push("command");
      return { ok: true };
    },
    dispatchTool: async (tool, args) => {
      calls.push(`mcp:${tool}:${JSON.stringify(args)}`);
      return { ok: true };
    },
  });
  const command = await act(1, menu, {
    runCommand: async (commandType, commandPayload) => {
      calls.push(`command:${commandType}:${JSON.stringify(commandPayload)}`);
      return { ok: true };
    },
    dispatchTool: async () => {
      calls.push("mcp");
      return { ok: true };
    },
  });
  const observeAgain = await act(2, menu, {
    runCommand: async () => ({ ok: true }),
    dispatchTool: async () => ({ ok: true }),
  });

  equal(mcp.outcome, "dispatched");
  equal(command.outcome, "dispatched");
  equal(observeAgain.outcome, "reobserve");
  if (observeAgain.outcome === "reobserve") equal(observeAgain.scope, RunScope.WorkItem);
  deepEqual(calls, [
    'mcp:metrics.snapshot:{"scope":"work_item"}',
    'command:schedule_work_block:{"workItemId":"work-1"}',
  ]);
});

test("act-time control plane vetoes MCP slots when required secret scopes are unavailable", async () => {
  const menu: Menu16 = {
    slots: [
      {
        index: 0,
        direction: "commit.a",
        label: "publish provider update",
        availability: "T",
        impl: {
          kind: "mcp",
          tool: "github.publish",
          args: { branch: "phase-2-controls" },
          requiredSecretScopes: ["github:write"],
        },
      },
      ...Array.from({ length: 15 }, (_, offset) => ({
        index: offset + 1,
        direction: `empty.${offset}`,
        label: "empty",
        availability: "N" as const,
      })),
    ],
  };
  let dispatched = false;

  const result = await act(0, menu, {
    authorizeSlot: createControlPlaneSlotAuthorizer({
      organizationId: "org-lfg",
      actorHatId: "release_operator",
      boundary: "mcp_dispatch",
      evaluatedAt: "2026-05-31T21:00:00.000Z",
      flags: [],
      availableSecretScopes: [],
    }),
    runCommand: async () => ({ ok: true }),
    dispatchTool: async () => {
      dispatched = true;
      return { ok: true };
    },
  });

  equal(result.outcome, "rejected");
  if (result.outcome !== "rejected") return;
  equal(result.reason, ActRejectionReason.ControlPlaneDenied);
  ok(result.message.includes("secret_scope_unavailable"));
  equal(dispatched, false);
});

test("observeAgentSurface hides prompt-flow tasks whose tool injections require unavailable secrets", async () => {
  const releaseOperator = buildHatDefinitions().find((h) => h.id === "release_operator")!;
  const task: PromptFlowTask = {
    taskId: "pft-secret",
    workItemId: "work-secret",
    title: "Publish release note",
    promptFlowId: "pf-release-publish",
    label: "publish release note",
    scope: RunScope.WorkItem,
    priority: 80,
    allowedHatIds: ["release_operator"],
    directions: ["commit.a"],
    toolInjections: [{
      tool: "github.publish_release",
      args: { draft: false },
      requiredSecretScopes: ["github:write"],
    }],
    metrics: [],
    contextArtifactRefs: [],
  };

  const surface = await observeAgentSurface(
    agentSnapshot({
      scope: RunScope.WorkItem,
      phase: RunLifecyclePhase.AwaitingGate,
      hasGateApproval: true,
      hat: releaseOperator,
    }),
    {
      ...deps,
      promptFlowTasks: [task],
      availableSecretScopes: [],
    },
  );

  equal(surface.outcome, ObserveOutcome.Readout);
  if (surface.outcome !== ObserveOutcome.Readout) return;
  equal(surface.promptFlows.tasks.length, 0);
  equal(surface.promptFlows.vetoedTasks[0]?.ruleName, "prompt-flow-secret-scope");
  ok(surface.actions.slots.some((slot) =>
    slot.label === "publish release note" &&
    slot.availability === "F" &&
    slot.reason?.includes("github:write")
  ));
});

test("observeAgentSurface renders prompt-flow tasks when required secret scopes are available", async () => {
  const releaseOperator = buildHatDefinitions().find((h) => h.id === "release_operator")!;
  const task: PromptFlowTask = {
    taskId: "pft-secret-allowed",
    workItemId: "work-secret",
    title: "Publish release note",
    promptFlowId: "pf-release-publish",
    label: "publish release note",
    scope: RunScope.WorkItem,
    priority: 80,
    allowedHatIds: ["release_operator"],
    directions: ["commit.a"],
    toolInjections: [{
      tool: "github.publish_release",
      args: { draft: false },
      requiredSecretScopes: ["github:write"],
    }],
    metrics: [],
    contextArtifactRefs: [],
  };

  const surface = await observeAgentSurface(
    agentSnapshot({
      scope: RunScope.WorkItem,
      phase: RunLifecyclePhase.AwaitingGate,
      hasGateApproval: true,
      hat: releaseOperator,
    }),
    {
      ...deps,
      promptFlowTasks: [task],
      availableSecretScopes: ["github:write"],
    },
  );

  equal(surface.outcome, ObserveOutcome.Readout);
  if (surface.outcome !== ObserveOutcome.Readout) return;
  equal(surface.promptFlows.tasks.length, 1);
  equal(surface.promptFlows.vetoedTasks.length, 0);
  ok(surface.actions.slots.some((slot) =>
    slot.label === "publish release note" &&
    slot.availability === "T" &&
    slot.impl?.kind === "prompt_flow" &&
    slot.impl.request.toolInjections[0]?.requiredSecretScopes?.includes("github:write")
  ));
});

test("observeAgentSurface returns the 16-slot controller plus deterministic scoped dashboard blocks", async () => {
  const releaseOperator = buildHatDefinitions().find((h) => h.id === "release_operator")!;
  const surface = await observeAgentSurface(
    agentSnapshot({
      scope: RunScope.WorkItem,
      phase: RunLifecyclePhase.AwaitingGate,
      hasGateApproval: true,
      hat: releaseOperator,
    }),
    {
      ...deps,
      metricAgents: [
        {
          id: "work-item-tests",
          scope: RunScope.WorkItem,
          compute: async (ctx) => ({
            id: "work-item-tests",
            label: `tests for ${ctx.scope}`,
            value: 7,
          }),
        },
        {
          id: "org-rollup",
          scope: RunScope.Organization,
          compute: async () => ({
            id: "org-rollup",
            label: "org rollup",
            value: 99,
          }),
        },
      ],
    },
  );

  equal(surface.outcome, ObserveOutcome.Readout);
  if (surface.outcome !== ObserveOutcome.Readout) return;
  equal(surface.actions.slots.length, 16);
  deepEqual(surface.metrics.blocks.map((block) => block.id), ["work-item-tests"]);
  equal(surface.metrics.scope, RunScope.WorkItem);
});

test("observeAgentSurface renders current hat-allowed prompt-flow tasks as context-loading slots", async () => {
  const releaseOperator = buildHatDefinitions().find((h) => h.id === "release_operator")!;
  const promptFlowTasks: readonly PromptFlowTask[] = [
    promptFlowTask({
      taskId: "task-execute",
      promptFlowId: "flow-implement",
      label: "Implement work item",
      actionClass: ActionClass.WriteCode,
      priority: 10,
      directions: ["Load implementation plan", "Inspect failing tests", "Patch the smallest surface"],
      toolInjections: [{ tool: "repo.search", args: { q: "work-1" } }],
      metrics: [{ id: "work_item.failures", label: "failing tests", value: 2, unit: "count" }],
    }),
    promptFlowTask({
      taskId: "task-review",
      promptFlowId: "flow-review",
      label: "Approve review",
      actionClass: ActionClass.ApproveReview,
      priority: 9,
    }),
  ];

  const surface = await observeAgentSurface(
    agentSnapshot({
      scope: RunScope.WorkItem,
      phase: RunLifecyclePhase.AwaitingGate,
      hasGateApproval: true,
      hat: releaseOperator,
    }),
    {
      ...deps,
      promptFlowTasks,
    },
  );

  equal(surface.outcome, ObserveOutcome.Readout);
  if (surface.outcome !== ObserveOutcome.Readout) return;
  deepEqual(surface.promptFlows.tasks.map((task) => task.taskId), ["task-execute"]);
  equal(surface.promptFlows.vetoedTasks[0]?.task.taskId, "task-review");
  ok(surface.promptFlows.vetoedTasks[0]?.reason.includes("lacks"));
  equal(surface.actions.slots[6]?.availability, "T");
  equal(surface.actions.slots[6]?.label, "Implement work item");
  equal(surface.actions.slots[6]?.impl?.kind, "prompt_flow");
  equal(surface.actions.slots[7]?.availability, "F");
  equal(surface.actions.slots[7]?.label, "Approve review");
});

test("observeAgentSurface shows C-suite projects with trajectories and policy violations", async () => {
  const coo = buildHatDefinitions().find((h) => h.id === "coo")!;
  const surface = await observeAgentSurface(
    agentSnapshot({
      scope: RunScope.Organization,
      phase: RunLifecyclePhase.Observing,
      hat: coo,
    }),
    {
      ...deps,
      hierarchy: {
        projects: [
          hierarchyProject({
            projectId: "project-alpha",
            departmentId: "engineering",
            trajectory: [{ id: "delivery", label: "delivery trajectory", value: "on_track" }],
          }),
          hierarchyProject({
            projectId: "project-beta",
            departmentId: "engineering",
          }),
        ],
        initiatives: [
          hierarchyInitiative({ initiativeId: "init-alpha", projectId: "project-alpha" }),
          hierarchyInitiative({ initiativeId: "init-beta", projectId: "project-beta" }),
        ],
      },
    },
  );

  equal(surface.outcome, ObserveOutcome.Readout);
  if (surface.outcome !== ObserveOutcome.Readout) return;
  equal(surface.hierarchy.level, "c_suite");
  deepEqual(surface.hierarchy.projects.map((project) => project.projectId), ["project-alpha", "project-beta"]);
  deepEqual(surface.hierarchy.initiatives.map((initiative) => initiative.initiativeId), []);
  equal(surface.hierarchy.projects[0]?.trajectory[0]?.id, "delivery");
  equal(surface.hierarchy.policyViolations[0]?.ruleName, "department-active-project-limit");
  ok(surface.hierarchy.policyViolations[0]?.reason.includes("engineering"));
});

test("observeAgentSurface shows directors the initiatives under their department active project", async () => {
  const engineeringDirector = buildHatDefinitions().find((h) => h.id === "engineering_director")!;
  const surface = await observeAgentSurface(
    agentSnapshot({
      scope: RunScope.Project,
      phase: RunLifecyclePhase.Observing,
      hat: engineeringDirector,
    }),
    {
      ...deps,
      hierarchy: {
        projects: [
          hierarchyProject({ projectId: "project-eng", departmentId: "engineering" }),
          hierarchyProject({ projectId: "project-qa", departmentId: "qa_engineering" }),
        ],
        initiatives: [
          hierarchyInitiative({ initiativeId: "init-eng-a", projectId: "project-eng" }),
          hierarchyInitiative({ initiativeId: "init-eng-b", projectId: "project-eng" }),
          hierarchyInitiative({ initiativeId: "init-qa", projectId: "project-qa" }),
        ],
      },
    },
  );

  equal(surface.outcome, ObserveOutcome.Readout);
  if (surface.outcome !== ObserveOutcome.Readout) return;
  equal(surface.hierarchy.level, "director");
  deepEqual(surface.hierarchy.projects.map((project) => project.projectId), ["project-eng"]);
  deepEqual(surface.hierarchy.initiatives.map((initiative) => initiative.initiativeId), ["init-eng-a", "init-eng-b"]);
  deepEqual(surface.hierarchy.policyViolations, []);
});

test("observeAgentSurface gives directors initiative priority scope, scoped metrics, and management actions", async () => {
  const engineeringDirector = buildHatDefinitions().find((h) => h.id === "engineering_director")!;
  const surface = await observeAgentSurface(
    agentSnapshot({
      scope: RunScope.Project,
      phase: RunLifecyclePhase.Observing,
      hat: engineeringDirector,
    }),
    {
      ...deps,
      hierarchy: {
        projects: [hierarchyProject({ projectId: "project-eng", departmentId: "engineering" })],
        initiatives: [
          hierarchyInitiative({
            initiativeId: "init-risk",
            projectId: "project-eng",
            title: "Stabilize workflow",
            priorityScore: 92,
            metrics: [{ id: "initiative.blockers", label: "blockers", value: 4 }],
          }),
          hierarchyInitiative({
            initiativeId: "init-docs",
            projectId: "project-eng",
            title: "Improve docs",
            priorityScore: 40,
          }),
        ],
      },
    },
  );

  equal(surface.outcome, ObserveOutcome.Readout);
  if (surface.outcome !== ObserveOutcome.Readout) return;
  equal(surface.hierarchy.priorityScope, "department_initiatives");
  deepEqual(surface.hierarchy.priorityItems.map((item) => item.itemId), ["init-risk", "init-docs"]);
  equal(surface.hierarchy.priorityItems[0]?.kind, "initiative");
  deepEqual(surface.hierarchy.scopedMetrics.map((metric) => metric.id), ["initiative.blockers"]);
  ok(surface.hierarchy.actions.some((action) => action.kind === "record_priority_decision"));
  ok(surface.hierarchy.actions.some((action) => action.kind === "request_staffing"));
  ok(surface.hierarchy.vetoedActions.some((action) => action.action.kind === "schedule_coordination_meeting"));
});

test("observeAgentSurface gives management hats their top-down mission, timeframe, lag signals, and corrective actions", async () => {
  const engineeringDirector = buildHatDefinitions().find((h) => h.id === "engineering_director")!;
  const surface = await observeAgentSurface(
    agentSnapshot({
      scope: RunScope.Project,
      phase: RunLifecyclePhase.Observing,
      hat: engineeringDirector,
    }),
    {
      ...deps,
      hierarchy: {
        projects: [hierarchyProject({ projectId: "project-eng", departmentId: "engineering" })],
        initiatives: [
          hierarchyInitiative({
            initiativeId: "init-risk",
            projectId: "project-eng",
            title: "Stabilize workflow",
            priorityScore: 92,
            metrics: [{ id: "initiative.blockers", label: "blockers", value: 4 }],
          }),
        ],
        missions: [
          {
            missionId: "mission-eng-director",
            issuedByHatId: "cto",
            assignedHatId: "engineering_director",
            departmentId: "engineering",
            projectId: "project-eng",
            goal: "Ship the observe-act management surface",
            strategy: ["Rank the riskiest initiatives", "Staff the blocker path first"],
            successCriteria: ["Director can see current risk", "Lagging initiatives trigger an escalation path"],
            timeframe: {
              startsAt: "2026-05-01T00:00:00.000Z",
              targetAt: "2026-06-30T00:00:00.000Z",
            },
            status: "on_track",
            progressPercent: 20,
            metrics: [{ id: "mission.blockers", label: "mission blockers", value: 4 }],
            milestones: [
              {
                milestoneId: "milestone-readout",
                title: "Mission readout implemented",
                targetAt: "2026-06-01T00:00:00.000Z",
                status: "behind",
                progressPercent: 50,
                metrics: [{ id: "milestone.open_items", label: "open items", value: 3 }],
              },
            ],
          },
        ],
      },
    },
  );

  equal(surface.outcome, ObserveOutcome.Readout);
  if (surface.outcome !== ObserveOutcome.Readout) return;
  equal(surface.hierarchy.mission?.mission.missionId, "mission-eng-director");
  equal(surface.hierarchy.mission?.mission.goal, "Ship the observe-act management surface");
  equal(surface.hierarchy.mission?.expectedProgressPercent, 46);
  equal(surface.hierarchy.mission?.actualProgressPercent, 20);
  equal(surface.hierarchy.mission?.status, "behind");
  deepEqual(surface.hierarchy.mission?.objectives, [
    "Rank the riskiest initiatives",
    "Staff the blocker path first",
  ]);
  equal(surface.hierarchy.mission?.nextMilestones[0]?.milestoneId, "milestone-readout");
  ok(surface.hierarchy.mission?.lagSignals.some((signal) => signal.id === "mission.progress_variance"));
  ok(surface.hierarchy.mission?.correctiveActions.some((action) => action.kind === "request_staffing"));
  ok(surface.hierarchy.mission?.vetoedCorrectiveActions.some((vetoed) => vetoed.action.kind === "schedule_coordination_meeting"));
});

test("observeAgentSurface does not attach management missions to individual contributor hats", async () => {
  const implementer = buildHatDefinitions().find((h) => h.id === "backend_implementer")!;
  const surface = await observeAgentSurface(
    agentSnapshot({
      scope: RunScope.WorkItem,
      phase: RunLifecyclePhase.Observing,
      hat: implementer,
    }),
    {
      ...deps,
      hierarchy: {
        projects: [hierarchyProject({ projectId: "project-eng", departmentId: "engineering" })],
        initiatives: [hierarchyInitiative({ initiativeId: "init-risk", projectId: "project-eng" })],
        missions: [
          {
            missionId: "mission-eng-dept",
            issuedByHatId: "cto",
            departmentId: "engineering",
            goal: "Deliver the department mission",
            strategy: ["Keep the active project moving"],
            successCriteria: ["No stale blockers"],
            timeframe: {
              startsAt: "2026-05-01T00:00:00.000Z",
              targetAt: "2026-06-30T00:00:00.000Z",
            },
            status: "on_track",
            progressPercent: 20,
            metrics: [],
            milestones: [],
          },
        ],
      },
    },
  );

  equal(surface.outcome, ObserveOutcome.Readout);
  if (surface.outcome !== ObserveOutcome.Readout) return;
  equal(surface.hierarchy.mission, undefined);
});

test("observeAgentSurface gives TPMs initiative execution priority over work batches and work items", async () => {
  const tpm = buildHatDefinitions().find((h) => h.id === "tpm")!;
  const surface = await observeAgentSurface(
    agentSnapshot({
      scope: RunScope.Initiative,
      phase: RunLifecyclePhase.Observing,
      hat: tpm,
    }),
    {
      ...deps,
      hierarchy: {
        projects: [hierarchyProject({ projectId: "project-eng", departmentId: "program_and_initiative_management" })],
        initiatives: [hierarchyInitiative({ initiativeId: "init-run", projectId: "project-eng" })],
        workBatches: [
          hierarchyWorkBatch({
            batchId: "batch-blocked",
            initiativeId: "init-run",
            title: "Unblock execution",
            priorityScore: 80,
            metrics: [{ id: "batch.blockers", label: "blockers", value: 3 }],
          }),
        ],
        workItems: [
          hierarchyWorkItem({
            workItemId: "work-ready",
            initiativeId: "init-run",
            title: "Ready implementation",
            priorityScore: 65,
            metrics: [{ id: "work.age", label: "age", value: 2, unit: "days" }],
          }),
        ],
      },
    },
  );

  equal(surface.outcome, ObserveOutcome.Readout);
  if (surface.outcome !== ObserveOutcome.Readout) return;
  equal(surface.hierarchy.priorityScope, "initiative_execution");
  deepEqual(surface.hierarchy.priorityItems.map((item) => item.itemId), ["batch-blocked", "work-ready"]);
  deepEqual(surface.hierarchy.scopedMetrics.map((metric) => metric.id), ["batch.blockers", "work.age"]);
  ok(surface.hierarchy.actions.some((action) => action.kind === "schedule_coordination_meeting"));
  ok(surface.hierarchy.actions.some((action) => action.kind === "schedule_prioritized_work"));
  ok(surface.hierarchy.actions.some((action) => action.kind === "send_supervisor_signal"));
});

test("act loads prompt-flow context through the injected context loader", async () => {
  const releaseOperator = buildHatDefinitions().find((h) => h.id === "release_operator")!;
  const task = promptFlowTask({
    taskId: "task-execute",
    promptFlowId: "flow-implement",
    label: "Implement work item",
    actionClass: ActionClass.WriteCode,
    directions: ["Load implementation plan"],
    toolInjections: [{ tool: "repo.search", args: { q: "work-1" } }],
    metrics: [{ id: "work_item.failures", label: "failing tests", value: 2 }],
  });
  const surface = await observeAgentSurface(
    agentSnapshot({
      scope: RunScope.WorkItem,
      phase: RunLifecyclePhase.AwaitingGate,
      hasGateApproval: true,
      hat: releaseOperator,
    }),
    {
      ...deps,
      promptFlowTasks: [task],
    },
  );
  equal(surface.outcome, ObserveOutcome.Readout);
  if (surface.outcome !== ObserveOutcome.Readout) return;

  const result = await act(6, surface.actions, {
    runCommand: async () => ({ ok: true }),
    dispatchTool: async () => ({ ok: true }),
    loadPromptFlowContext: async (request) => ({
      taskId: request.taskId,
      promptFlowId: request.promptFlowId,
      directions: request.directions,
      toolInjections: request.toolInjections,
      metrics: request.metrics,
      contextArtifacts: [{ id: "ctx-1", label: "implementation plan", value: "plan body" }],
    }),
  });

  equal(result.outcome, "loaded_context");
  if (result.outcome !== "loaded_context") return;
  equal(result.context.taskId, "task-execute");
  deepEqual(result.context.directions, ["Load implementation plan"]);
  deepEqual(result.context.toolInjections, [{ tool: "repo.search", args: { q: "work-1" } }]);
  deepEqual(result.context.metrics.map((metric) => metric.id), ["work_item.failures"]);
});

test("terminal phase yields feedback, not a readout", () => {
  const result = observe(snapshot({ phase: RunLifecyclePhase.Completed }), deps);
  equal(result.outcome, ObserveOutcome.Feedback);
  if (result.outcome !== ObserveOutcome.Feedback) return;
  equal(result.feedback.reason, ObserveFeedbackReason.TerminalPhase);
});

test("unknown phase yields unknown-phase feedback", () => {
  const result = observe(snapshot({ phase: "nonsense" as RunLifecyclePhase }), deps);
  equal(result.outcome, ObserveOutcome.Feedback);
  if (result.outcome !== ObserveOutcome.Feedback) return;
  equal(result.feedback.reason, ObserveFeedbackReason.UnknownPhase);
});

test("decide selects an option the memoryless composer picks from the readout", () => {
  const composer: EphemeralComposerPort = {
    compose: ({ readout }) => ({
      decision: ComposerDecision.Select,
      option: readout.options[0]!,
      reason: "first legal move",
    }),
  };
  const result = decide(snapshot(), composer, deps);
  equal(result.outcome, DecideOutcome.Selected);
  if (result.outcome !== DecideOutcome.Selected) return;
  equal(result.selection.option.actionType, "compose");
});

test("decide rejects a composer that selects an option outside the readout", () => {
  const rogue: EphemeralComposerPort = {
    compose: () => ({
      decision: ComposerDecision.Select,
      option: { actionType: "execute", toPhase: RunLifecyclePhase.Executing, toScope: RunScope.WorkItem, requiresGate: true, requiresEvidence: false, rationale: "smuggled" },
      reason: "tries to skip the gate",
    }),
  };
  const result = decide(snapshot(), rogue, deps);
  equal(result.outcome, DecideOutcome.Feedback);
  if (result.outcome !== DecideOutcome.Feedback) return;
  equal(result.feedback.reason, ObserveFeedbackReason.DeterministicRuleViolation);
});

test("decide surfaces a hold when the composer declines to move", () => {
  const cautious: EphemeralComposerPort = {
    compose: () => ({ decision: ComposerDecision.Hold, reason: "waiting for more context" }),
  };
  const result = decide(snapshot(), cautious, deps);
  equal(result.outcome, DecideOutcome.Held);
});

function promptFlowTask(overrides: Partial<PromptFlowTask> = {}): PromptFlowTask {
  return {
    taskId: "task-1",
    workItemId: "work-1",
    title: "Work item task",
    promptFlowId: "flow-1",
    label: "Load task context",
    scope: RunScope.WorkItem,
    priority: 1,
    directions: [],
    toolInjections: [],
    metrics: [],
    contextArtifactRefs: [],
    ...overrides,
  };
}

function hierarchyProject(overrides: Partial<HierarchyProject> = {}): HierarchyProject {
  return {
    projectId: "project-1",
    organizationId: "org-1",
    departmentId: "engineering",
    name: "Project 1",
    status: "active",
    trajectory: [],
    metrics: [],
    ...overrides,
  };
}

function hierarchyInitiative(overrides: Partial<HierarchyInitiative> = {}): HierarchyInitiative {
  return {
    initiativeId: "init-1",
    projectId: "project-1",
    organizationId: "org-1",
    title: "Initiative 1",
    status: "active",
    metrics: [],
    ...overrides,
  };
}

function hierarchyWorkBatch(overrides: Partial<HierarchyWorkBatch> = {}): HierarchyWorkBatch {
  return {
    batchId: "batch-1",
    projectId: "project-1",
    initiativeId: "init-1",
    organizationId: "org-1",
    title: "Batch 1",
    status: "active",
    priorityScore: 1,
    metrics: [],
    ...overrides,
  };
}

function hierarchyWorkItem(overrides: Partial<HierarchyWorkItem> = {}): HierarchyWorkItem {
  return {
    workItemId: "work-1",
    projectId: "project-1",
    initiativeId: "init-1",
    organizationId: "org-1",
    title: "Work 1",
    state: "ready",
    priorityScore: 1,
    metrics: [],
    ...overrides,
  };
}

function scheduleBlock(overrides: Partial<WorkScheduleBlock> = {}): WorkScheduleBlock {
  return {
    workScheduleBlockId: "schedule-1",
    organizationId: "org-1",
    projectId: "project-1",
    workItemId: "work-1",
    assignedAgentId: "agent-1",
    assignedHatAssignmentId: "99",
    blockType: ScheduleBlockType.PrioritizedWork,
    state: ScheduleBlockState.Active,
    title: "Implement current work",
    purpose: "Authorize observe-act execution",
    startsAt: "2026-05-28T23:00:00.000Z",
    endsAt: "2026-05-29T01:00:00.000Z",
    scheduledAt: "2026-05-28T22:00:00.000Z",
    scheduledBy: {
      agentId: "supervisor-1",
      hatAssignmentId: "supervisor-hat-1",
    },
    metadata: {
      updatedAt: "2026-05-28T22:00:00.000Z",
      version: 1,
      correlationId: "corr-1",
      causationId: "cause-1",
      traceId: "trace-1",
    },
    ...overrides,
  };
}
