import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  AgenticEventType,
  ChangeArtifactKind,
  ChangeSetPhase,
  CommandType,
  ExternalSystem,
  OrgEventKind,
  ReactionPlanStatus,
  ScheduleBlockState,
  ScheduleBlockType,
  WorkItemState,
  WorkItemType,
  MemoryPhase,
  MemoryTier,
  type ChangeSet,
  type MemoryEnvelope,
  type OrgEvent,
  type ProjectionRef,
  type WorkScheduleBlock,
} from "../../../packages/domain/src/index.ts";
import {
  buildHatDefinitions,
  buildInternalOnlyPipeline,
  buildGitHubGatedPipeline,
  createCommandHandlerRegistry,
  createCommandPipeline,
  createObserveLifecycleTransitionHandler,
  CommandOutcomePersistenceStatus,
  ActionClass,
  ActRejectionReason,
  createContentAddressedEvidenceArtifact,
  type CommandResult,
  ExternalDecision,
  RunLifecyclePhase,
  RunScope,
  type ChangeControlPort,
  type CommandEffects,
  type CommandStateStoreFactory,
  type HierarchySnapshot,
  type ObserveLifecycleTransitionCommand,
  type PromptFlowTask,
} from "../../../packages/application/src/index.ts";
import { RecordingTelemetry } from "../../../packages/observability/src/index.ts";
import {
  PolicyDecisionObservationPersistenceStatus,
  PolicyDecisionStatus,
  type CommandAuthorizationPort,
  type PolicyDecisionObservationPort,
} from "../../../packages/policy/src/index.ts";
import {
  createObserveActWorkItemCadenceLane,
  createWorkOsCadenceLane,
  createMemoryMaintenanceCadenceLane,
  createChangeControlCadenceLane,
  createConformanceCadenceLane,
  createReleaseQueueCadenceLane,
  createAbandonedRunBindingScanCadenceLane,
  createDeadLetterClassifierCadenceLane,
  createStaleReactionPlanScanCadenceLane,
  createStrandedScheduleScanCadenceLane,
} from "../src/org-cadence-lanes.ts";

const NOW = Date.parse("2026-05-30T00:00:00Z");
let seq = 0;
const createId = (p: string) => `${p}-${++seq}`;

const someIntake = async () => ({ projectId: "proj-1", initiativeId: "init-1", initiativeBranch: "feat/auto" });

test("work-os lane drives one living-loop cycle and reports the final state", async () => {
  const events: OrgEvent[] = [];
  const lane = createWorkOsCadenceLane({ organizationId: "org-lfg", hats: buildHatDefinitions(), now: () => NOW, createId, intake: someIntake, appendEvent: async (e) => { events.push(e); } });
  const result = await lane.runOnce();
  equal(result.failures.length, 0);
  ok(result.status.startsWith("work-os:"));
  ok(events.length > 0, "the living loop emitted org_events");
});

test("observe-act work-item lane runs one tick through observe -> act -> org event effects with legacy disabled", async () => {
  let capturedEffects: CommandEffects | undefined;
  const observeEvents: OrgEvent[] = [];
  const pipeline = createCommandPipeline<ObserveLifecycleTransitionCommand>({
    stateStoreFactory: captureObserveActEffectsStoreFactory((effects) => {
      capturedEffects = effects;
    }),
    commandAuthorizationPort: createObserveActAllowingAuthorizationPort(),
    policyDecisionObservationPort: createObserveActPolicyObservationPort(),
    handlerRegistry: createCommandHandlerRegistry<ObserveLifecycleTransitionCommand, CommandResult>([
      createObserveLifecycleTransitionHandler(),
    ]),
    workAnchorStateReader: {
      findProject: async () => undefined,
      findInitiative: async () => undefined,
      findWorkItem: async () => ({
        workItemId: "work-1",
        organizationId: "org-lfg",
        projectId: "proj-1",
        workItemType: WorkItemType.Task,
        title: "Implement observe-act lane",
        description: "Prove worker cadence can route through observe.ts.",
        state: WorkItemState.Ready,
        createdAt: new Date(NOW).toISOString(),
        createdBy: { agentId: "agent-release-1", hatAssignmentId: "99" },
        metadata: {
          updatedAt: new Date(NOW).toISOString(),
          version: 1,
          correlationId: "corr-before",
          causationId: "cause-before",
          traceId: "trace-before",
        },
      }),
    },
    now: () => new Date(NOW).toISOString(),
    createId,
  });
  const lane = createObserveActWorkItemCadenceLane({
    organizationId: "org-lfg",
    hats: buildHatDefinitions(),
    now: () => NOW,
    createId,
    source: async () => ({
      runId: "1",
      projectId: "proj-1",
      workItemId: "work-1",
      scope: RunScope.WorkItem,
      phase: RunLifecyclePhase.AwaitingGate,
      hasGateApproval: true,
      hasEvidence: false,
      hatId: "release_operator",
      hatAssignmentId: "99",
      agentId: "agent-release-1",
    }),
    runCommand: async (_commandType, command) => await pipeline.execute(command as ObserveLifecycleTransitionCommand),
    dispatchTool: async () => {
      throw new Error("observe-act work-item lane should not dispatch MCP for lifecycle execution");
    },
    appendEvent: async (event) => {
      observeEvents.push(event);
    },
  });

  const result = await lane.runOnce();

  equal(result.failures.length, 0);
  equal(result.status, "observe-act:command:accepted");
  equal(capturedEffects?.outboxEvents[0]?.envelope.eventType, AgenticEventType.WorkItemStateChanged);
  equal(capturedEffects?.workAnchors?.workItemTransitions[0]?.transition.fromState, WorkItemState.Ready);
  equal(capturedEffects?.workAnchors?.workItemTransitions[0]?.transition.toState, WorkItemState.InProgress);
  equal(observeEvents.length, 1);
  equal(observeEvents[0]?.kind, OrgEventKind.ObserveActTick);
  equal(observeEvents[0]?.actorHatId, "release_operator");
  deepEqual(observeEvents[0]?.supervisorChain, [
    "executive_board_member",
    "ceo",
    "coo",
    "delivery_director",
    "release_manager",
    "release_operator",
  ]);
  ok(observeEvents[0]?.evidenceRefs.some((ref) => ref.startsWith("observe-act:menu_hash:")));
  ok(observeEvents[0]?.evidenceRefs.includes("observe-act:selected_slot:4"));
});

test("observe-act work-item lane persists selector rejection evidence on fallback-selected ticks", async () => {
  const observeEvents: OrgEvent[] = [];
  const lane = createObserveActWorkItemCadenceLane({
    organizationId: "org-lfg",
    hats: buildHatDefinitions(),
    now: () => NOW,
    createId,
    source: async () => ({
      runId: "1",
      projectId: "proj-1",
      workItemId: "work-1",
      scope: RunScope.WorkItem,
      phase: RunLifecyclePhase.AwaitingGate,
      hasGateApproval: true,
      hasEvidence: false,
      hatId: "release_operator",
      hatAssignmentId: "99",
      agentId: "agent-release-1",
    }),
    selectSlot: () => ({
      index: 4,
      reason: "fallback_after_selector_rejection",
      selectorRejection: {
        reason: "non_selectable_slot",
        rawOutput: "5",
        rejectedIndex: 5,
        fallbackIndex: 4,
      },
    }),
    runCommand: async () => ({ status: "accepted" }),
    dispatchTool: async () => ({ ok: true }),
    appendEvent: async (event) => {
      observeEvents.push(event);
    },
  });

  const result = await lane.runOnce();

  equal(result.failures.length, 0);
  equal(result.status, "observe-act:command:accepted");
  equal(observeEvents.length, 1);
  ok(observeEvents[0]?.evidenceRefs.includes("observe-act:selector_rejected:non_selectable_slot:5"));
  ok(observeEvents[0]?.evidenceRefs.includes("observe-act:selector_rejected_fallback_slot:4"));
});

test("observe-act work-item lane carries supplemental promotion evidence on tick events", async () => {
  const observeEvents: OrgEvent[] = [];
  const lane = createObserveActWorkItemCadenceLane({
    organizationId: "org-lfg",
    hats: buildHatDefinitions(),
    now: () => NOW,
    createId,
    source: async () => ({
      runId: "1",
      projectId: "proj-1",
      workItemId: "work-1",
      scope: RunScope.WorkItem,
      phase: RunLifecyclePhase.AwaitingGate,
      hasGateApproval: true,
      hasEvidence: false,
      hatId: "release_operator",
      hatAssignmentId: "99",
      agentId: "agent-release-1",
    }),
    runCommand: async () => ({ status: "accepted" }),
    dispatchTool: async () => ({ ok: true }),
    supplementalEvidenceRefs: [
      "observe-act-promotion:decision:shadow_window_clean",
      "observe-act-promotion:mode:primary",
    ],
    appendEvent: async (event) => {
      observeEvents.push(event);
    },
  });

  const result = await lane.runOnce();

  equal(result.failures.length, 0);
  equal(result.status, "observe-act:command:accepted");
  equal(observeEvents.length, 1);
  ok(observeEvents[0]?.evidenceRefs.includes("observe-act-promotion:decision:shadow_window_clean"));
  ok(observeEvents[0]?.evidenceRefs.includes("observe-act-promotion:mode:primary"));
});

test("observe-act work-item lane persists control-bypass rejection evidence", async () => {
  const observeEvents: OrgEvent[] = [];
  const lane = createObserveActWorkItemCadenceLane({
    organizationId: "org-lfg",
    hats: buildHatDefinitions(),
    now: () => NOW,
    createId,
    source: async () => ({
      runId: "1",
      projectId: "proj-1",
      workItemId: "work-1",
      scope: RunScope.WorkItem,
      phase: RunLifecyclePhase.AwaitingGate,
      hasGateApproval: true,
      hasEvidence: false,
      hatId: "release_operator",
      hatAssignmentId: "99",
      agentId: "agent-release-1",
    }),
    runCommand: async () => ({ status: "accepted" }),
    dispatchTool: async () => ({ ok: true }),
    authorizeSlot: async () => ({
      status: "denied",
      reason: ActRejectionReason.ControlPlaneDenied,
      message: "ESTOP active",
    }),
    appendEvent: async (event) => {
      observeEvents.push(event);
    },
  });

  const result = await lane.runOnce();

  equal(result.status, "observe-act:rejected:control_plane_denied");
  equal(result.failures.length, 1);
  equal(observeEvents.length, 1);
  ok(observeEvents[0]?.evidenceRefs.includes("observe-act:control_bypass_rejected:control_plane_denied:4"));
});

test("observe-act work-item lane persists glass-halo status evidence", async () => {
  const observeEvents: OrgEvent[] = [];
  const lane = createObserveActWorkItemCadenceLane({
    organizationId: "org-lfg",
    hats: buildHatDefinitions(),
    now: () => NOW,
    createId,
    source: async () => ({
      runId: "1",
      projectId: "proj-1",
      workItemId: "work-1",
      scope: RunScope.WorkItem,
      phase: RunLifecyclePhase.AwaitingGate,
      hasGateApproval: true,
      hasEvidence: false,
      hatId: "release_operator",
      hatAssignmentId: "99",
      agentId: "agent-release-1",
      promptFlowTasks: [
        promptFlowTask({
          taskId: "task-implement",
          promptFlowId: "flow-implement",
          label: "Implement work item",
          actionClass: ActionClass.WriteCode,
        }),
      ],
    }),
    metricAgents: [
      {
        id: "queue.pressure",
        scope: RunScope.WorkItem,
        compute: async () => ({ id: "queue.pressure", label: "queue pressure", value: 4 }),
      },
    ],
    selectSlot: () => 13,
    runCommand: async () => {
      throw new Error("status must not dispatch command side effects");
    },
    dispatchTool: async () => {
      throw new Error("status must not dispatch MCP side effects");
    },
    appendEvent: async (event) => {
      observeEvents.push(event);
    },
  });

  const result = await lane.runOnce();

  equal(result.failures.length, 0);
  equal(result.status, "observe-act:status:glass_halo_status");
  equal(observeEvents.length, 1);
  ok(observeEvents[0]?.evidenceRefs.includes("observe-act:status:glass_halo_status"));
  ok(observeEvents[0]?.evidenceRefs.includes("observe-act:status_scope:work_item"));
  ok(observeEvents[0]?.evidenceRefs.includes("observe-act:status_phase:awaiting_gate"));
  ok(observeEvents[0]?.evidenceRefs.includes("observe-act:metric:queue.pressure"));
  ok(observeEvents[0]?.evidenceRefs.includes("observe-act:prompt_flow:flow-implement"));
});

test("observe-act work-item lane persists status priority-scope evidence when hierarchy is available", async () => {
  const observeEvents: OrgEvent[] = [];
  const lane = createObserveActWorkItemCadenceLane({
    organizationId: "org-lfg",
    hats: buildHatDefinitions(),
    now: () => NOW,
    createId,
    source: async () => ({
      runId: "1",
      projectId: "project-eng",
      workItemId: "work-1",
      scope: RunScope.Project,
      phase: RunLifecyclePhase.Observing,
      hasGateApproval: false,
      hasEvidence: false,
      hatId: "engineering_director",
      hatAssignmentId: "99",
      agentId: "agent-director-1",
      hierarchy: directorHierarchySnapshot(),
    }),
    selectSlot: () => 13,
    runCommand: async () => {
      throw new Error("status must not dispatch command side effects");
    },
    dispatchTool: async () => {
      throw new Error("status must not dispatch MCP side effects");
    },
    appendEvent: async (event) => {
      observeEvents.push(event);
    },
  });

  const result = await lane.runOnce();

  equal(result.failures.length, 0);
  equal(result.status, "observe-act:status:glass_halo_status");
  equal(observeEvents.length, 1);
  ok(observeEvents[0]?.evidenceRefs.includes("observe-act:status_priority_scope:department_initiatives"));
});

test("observe-act work-item lane routes meta.escalate through supervisor-signal command with evidence", async () => {
  const commands: { commandType: string; command: unknown }[] = [];
  const observeEvents: OrgEvent[] = [];
  const lane = createObserveActWorkItemCadenceLane({
    organizationId: "org-lfg",
    hats: buildHatDefinitions(),
    now: () => NOW,
    createId,
    source: async () => ({
      runId: "1",
      projectId: "proj-1",
      teamId: "team-runtime",
      workItemId: "work-1",
      scope: RunScope.WorkItem,
      phase: RunLifecyclePhase.AwaitingGate,
      hasGateApproval: true,
      hasEvidence: false,
      hatId: "dependency_manager",
      hatAssignmentId: "99",
      supervisorHatAssignmentId: "hat-manager-1",
      agentId: "agent-release-1",
    }),
    selectSlot: () => 15,
    runCommand: async (commandType, command) => {
      commands.push({ commandType, command });
      return { status: "accepted" };
    },
    dispatchTool: async () => {
      throw new Error("meta.escalate should dispatch a command, not an MCP tool");
    },
    appendEvent: async (event) => {
      observeEvents.push(event);
    },
  });

  const result = await lane.runOnce();

  equal(result.failures.length, 0);
  equal(result.status, "observe-act:command:accepted");
  equal(commands.length, 1);
  equal(commands[0]?.commandType, CommandType.SendSupervisorSignal);
  deepEqual(commands[0]?.command, {
    commandId: "cmd-observe-1-15",
    type: CommandType.SendSupervisorSignal,
    idempotencyKey: "observe:1:99:awaiting_gate:15",
    requestHash: "send_supervisor_signal:1:99:awaiting_gate:15:hat-manager-1",
    correlationId: "observe-cli-1",
    causationId: "observe-cli-1",
    traceId: "observe-cli-1",
    organizationId: "org-lfg",
    projectId: "proj-1",
    workItemId: "work-1",
    actor: {
      agentId: "agent-release-1",
      hatAssignmentId: "99",
    },
    targetHatAssignmentId: "hat-manager-1",
    title: "Observe-act escalation for work_item awaiting_gate",
    message: "Agent requested supervisor triage for run 1 at work_item/awaiting_gate. Legal options: 1; vetoed options: 1.",
    policyContext: {
      scope: {
        teamId: "team-runtime",
        workItemId: "work-1",
      },
      toolType: "request_escalation",
      supervisorChain: {
        sourceLevel: "team_member",
        targetLevel: "manager",
      },
    },
  });
  equal(observeEvents.length, 1);
  ok(observeEvents[0]?.evidenceRefs.includes("observe-act:command_type:send_supervisor_signal"));
});

test("observe-act work-item lane can load a prompt-flow task context instead of requiring hat-specific agent knowledge", async () => {
  const loaded: string[] = [];
  const lane = createObserveActWorkItemCadenceLane({
    organizationId: "org-lfg",
    hats: buildHatDefinitions(),
    now: () => NOW,
    createId,
    source: async () => ({
      runId: "1",
      projectId: "proj-1",
      workItemId: "work-1",
      scope: RunScope.WorkItem,
      phase: RunLifecyclePhase.AwaitingGate,
      hasGateApproval: true,
      hasEvidence: false,
      hatId: "release_operator",
      hatAssignmentId: "99",
      agentId: "agent-release-1",
      promptFlowTasks: [
        promptFlowTask({
          taskId: "task-implement",
          promptFlowId: "flow-implement",
          label: "Implement work item",
          actionClass: ActionClass.WriteCode,
          directions: ["Load implementation plan"],
          toolInjections: [{ tool: "repo.search", args: { q: "work-1" } }],
          metrics: [{ id: "work_item.failures", label: "failing tests", value: 2 }],
        }),
      ],
    }),
    selectSlot: () => 6,
    runCommand: async () => {
      throw new Error("prompt-flow context loading should not dispatch a command");
    },
    dispatchTool: async () => {
      throw new Error("prompt-flow context loading should not dispatch MCP directly");
    },
    loadPromptFlowContext: async (request) => {
      loaded.push(`${request.taskId}:${request.directions[0]}:${request.toolInjections[0]?.tool}:${request.metrics[0]?.id}`);
      return {
        taskId: request.taskId,
        promptFlowId: request.promptFlowId,
        directions: request.directions,
        toolInjections: request.toolInjections,
        metrics: request.metrics,
        contextArtifacts: [{ id: "ctx-1", label: "plan", value: "plan body" }],
      };
    },
  });

  const result = await lane.runOnce();

  equal(result.failures.length, 0);
  equal(result.status, "observe-act:context:task-implement");
  deepEqual(loaded, ["task-implement:Load implementation plan:repo.search:work_item.failures"]);
});

test("observe-act work-item lane carries prompt-flow overflow page navigation into the next tick and evidence", async () => {
  const stdout: string[] = [];
  const observeEvents: OrgEvent[] = [];
  const loaded: string[] = [];
  let tick = 0;
  const tasks = Array.from({ length: 3 }, (_, index) => promptFlowTask({
    taskId: `task-${index + 1}`,
    promptFlowId: `flow-${index + 1}`,
    label: `Task ${index + 1}`,
    actionClass: ActionClass.WriteCode,
    priority: 100 - index,
    directions: [`Load task ${index + 1}`],
  }));
  const lane = createObserveActWorkItemCadenceLane({
    organizationId: "org-lfg",
    hats: buildHatDefinitions(),
    now: () => NOW,
    createId,
    source: async () => ({
      runId: "1",
      projectId: "proj-1",
      workItemId: "work-1",
      scope: RunScope.WorkItem,
      phase: RunLifecyclePhase.AwaitingGate,
      hasGateApproval: true,
      hasEvidence: false,
      hatId: "release_operator",
      hatAssignmentId: "99",
      agentId: "agent-release-1",
      promptFlowTasks: tasks,
    }),
    writeObserveStdout: (text) => {
      stdout.push(text);
    },
    selectSlot: () => {
      tick += 1;
      return tick === 1 ? 1 : 6;
    },
    runCommand: async () => {
      throw new Error("prompt-flow paging test should not dispatch a command");
    },
    dispatchTool: async () => {
      throw new Error("prompt-flow paging test should not dispatch MCP directly");
    },
    loadPromptFlowContext: async (request) => {
      loaded.push(request.taskId);
      return {
        taskId: request.taskId,
        promptFlowId: request.promptFlowId,
        directions: request.directions,
        toolInjections: request.toolInjections,
        metrics: request.metrics,
        contextArtifacts: [],
      };
    },
    appendEvent: async (event) => {
      observeEvents.push(event);
    },
  });

  const first = await lane.runOnce();
  const second = await lane.runOnce();

  equal(first.failures.length, 0);
  equal(first.status, "observe-act:reobserve:work_item:prompt_flow_page:1");
  equal(second.failures.length, 0);
  equal(second.status, "observe-act:context:task-2");
  ok(stdout.join("\n").includes("prompt-flow page: 2/3"));
  deepEqual(loaded, ["task-2"]);
  ok(observeEvents[0]?.evidenceRefs.includes("observe-act:prompt_flow_page:0"));
  ok(observeEvents[0]?.evidenceRefs.includes("observe-act:reobserve_prompt_flow_page:1"));
  ok(observeEvents[1]?.evidenceRefs.includes("observe-act:prompt_flow_page:1"));
  ok(observeEvents[1]?.evidenceRefs.includes("observe-act:selected_prompt_flow_task:task-2"));
  ok(observeEvents[1]?.evidenceRefs.includes("observe-act:selected_prompt_flow:flow-2"));
});

test("observe-act work-item lane passes hierarchy readouts through to the agent observe surface", async () => {
  const stdout: string[] = [];
  const lane = createObserveActWorkItemCadenceLane({
    organizationId: "org-lfg",
    hats: buildHatDefinitions(),
    now: () => NOW,
    createId,
    source: async () => ({
      runId: "1",
      projectId: "project-eng",
      workItemId: "work-1",
      scope: RunScope.Project,
      phase: RunLifecyclePhase.Observing,
      hasGateApproval: true,
      hasEvidence: false,
      hatId: "engineering_director",
      hatAssignmentId: "99",
      agentId: "agent-director-1",
      hierarchy: hierarchySnapshot(),
    }),
    writeObserveStdout: (text) => {
      stdout.push(text);
    },
    selectSlot: () => 4,
    runCommand: async () => ({ status: "observed" }),
    dispatchTool: async () => ({ ok: true }),
  });

  const result = await lane.runOnce();

  equal(result.failures.length, 0);
  ok(stdout.join("\n").includes("hierarchy: director"));
  ok(stdout.join("\n").includes("priority scope: department_initiatives"));
  ok(stdout.join("\n").includes("- project project-eng Engineering Project"));
  ok(stdout.join("\n").includes("- initiative init-eng-a Readiness Initiative"));
  ok(stdout.join("\n").includes("- hierarchy action record_priority_decision: Rank department initiatives"));
});

test("observe-act work-item lane forwards schedule blocks and slot authorization into the foreground loop", async () => {
  let dispatched = false;
  let authorizedSlot = -1;
  const lane = createObserveActWorkItemCadenceLane({
    organizationId: "org-lfg",
    hats: buildHatDefinitions(),
    now: () => NOW,
    createId,
    source: async () => ({
      runId: "1",
      projectId: "proj-1",
      workItemId: "work-1",
      scope: RunScope.WorkItem,
      phase: RunLifecyclePhase.AwaitingGate,
      hasGateApproval: true,
      hasEvidence: false,
      hatId: "release_operator",
      hatAssignmentId: "99",
      agentId: "agent-release-1",
      scheduleBlocks: [scheduleBlock()],
    }),
    authorizeSlot: async ({ slot }) => {
      authorizedSlot = slot.index;
      return {
        status: "denied",
        reason: "schedule_block_required",
        message: "schedule block expired before dispatch",
      };
    },
    runCommand: async () => {
      dispatched = true;
      return { status: "accepted" };
    },
    dispatchTool: async () => {
      throw new Error("observe-act schedule test should not dispatch MCP");
    },
  });

  const result = await lane.runOnce();

  equal(result.status, "observe-act:rejected:schedule_authority_denied");
  equal(result.failures.length, 1);
  equal(result.failures[0]?.message, "observe-act lane: schedule_authority_denied: schedule block expired before dispatch");
  equal(authorizedSlot, 4);
  equal(dispatched, false);
});

test("work-os lane stays IDLE (no cycle, no events) when intake returns null", async () => {
  const events: OrgEvent[] = [];
  const lane = createWorkOsCadenceLane({ organizationId: "org-lfg", hats: buildHatDefinitions(), now: () => NOW, createId, intake: async () => null, appendEvent: async (e) => { events.push(e); } });
  const result = await lane.runOnce();
  equal(result.status, "work-os:idle");
  equal(result.failures.length, 0);
  equal(events.length, 0, "an idle tick emits no org_events (no synthetic flood)");
});

test("work-os lane CATCHES errors into failures (never throws)", async () => {
  const lane = createWorkOsCadenceLane({ organizationId: "org-lfg", hats: buildHatDefinitions(), now: () => NOW, createId, intake: someIntake, appendEvent: async () => { throw new Error("sink down"); } });
  const result = await lane.runOnce();
  equal(result.status, "degraded");
  ok(result.failures[0]!.message.includes("work-os lane"));
});

function memEnvelope(memoryId: string, phase: MemoryPhase, freshnessAt: string, confidence: number): MemoryEnvelope {
  return {
    memoryId, organizationId: "org-lfg", tier: MemoryTier.Work, scope: "work-1", key: "k", protected: false, writtenBy: "system", writtenAt: "2026-05-30T00:00:00Z",
    state: { memoryId, organizationId: "org-lfg", phase, confidence, weight: 0.5, freshnessAt, reinforcementCount: 1, outcome: { successCount: 8, failureCount: 0, inconclusiveCount: 0, workItemsObserved: [] }, utility: { injectedCount: 6, citedCount: 5 }, crossScope: { distinctScopes: [], firstObservedAt: "2026-05-30T00:00:00Z", lastObservedAt: "2026-05-30T00:00:00Z" } },
  };
}

function scheduleBlock(overrides: Partial<WorkScheduleBlock> = {}): WorkScheduleBlock {
  return {
    workScheduleBlockId: "schedule-1",
    organizationId: "org-lfg",
    projectId: "proj-1",
    workItemId: "work-1",
    assignedAgentId: "agent-release-1",
    assignedHatAssignmentId: "99",
    blockType: ScheduleBlockType.PrioritizedWork,
    state: ScheduleBlockState.Active,
    title: "Observe-act work",
    purpose: "Authorize lifecycle execution",
    startsAt: "2026-05-29T23:30:00.000Z",
    endsAt: "2026-05-30T00:30:00.000Z",
    scheduledAt: "2026-05-29T23:00:00.000Z",
    scheduledBy: { agentId: "agent-manager-1", hatAssignmentId: "hat-manager-1" },
    metadata: { updatedAt: "2026-05-29T23:00:00.000Z", version: 1, correlationId: "corr", causationId: "cause", traceId: "trace" },
    ...overrides,
  };
}

function createPolicySimulationArtifact(changeSetId: string) {
  return createContentAddressedEvidenceArtifact("simulation-report", {
    changeSetId,
    decision: "accepted",
    metrics: { delivery: "better", quality: "non_regression", cost: "acceptable", safety: "non_regression" },
  });
}

test("memory-maintenance lane recomputes + persists updates + emits the cycle event", async () => {
  const aged = memEnvelope("m-old", MemoryPhase.Active, new Date(NOW - 90 * 86_400_000).toISOString(), 0.2);
  aged.state.outcome = { successCount: 0, failureCount: 6, inconclusiveCount: 0, workItemsObserved: [] };
  aged.state.utility = { injectedCount: 12, citedCount: 0 };
  const upserts: string[] = [];
  const events: OrgEvent[] = [];
  const lane = createMemoryMaintenanceCadenceLane({
    organizationId: "org-lfg", now: () => NOW, createId,
    reader: { listAll: async () => [aged] },
    writer: { upsert: async (r) => { upserts.push(r.memoryId); } },
    appendEvent: async (e) => { events.push(e); },
  });
  const result = await lane.runOnce();
  equal(result.failures.length, 0);
  ok(result.status.includes("recomputed"));
  ok(upserts.includes("m-old"));
  ok(events.some((e) => e.kind === "memory_maintenance_cycle"));
});

function changeSet(phase: ChangeSetPhase, currentStageIndex: number, revision = 2): ChangeSet {
  return { changeSetId: "cs-1", organizationId: "org-lfg", workItemId: "work-1", proposerHatId: "code_author", title: "t", targetRef: "feat/x", phase, pipelineId: "internal-only", currentStageIndex, artifacts: [{ kind: "code_diff", path: "a.ts", diff: "+x", language: "ts" }], projections: [], revision, openedAt: "2026-05-30T00:00:00Z", updatedAt: "2026-05-30T00:00:00Z" };
}

test("change-control lane advances an in_review ChangeSet one stage and persists it", async () => {
  const cs = changeSet(ChangeSetPhase.InReview, 0);
  const upserts: ChangeSet[] = [];
  const events: OrgEvent[] = [];
  const lane = createChangeControlCadenceLane({
    organizationId: "org-lfg", now: () => NOW, createId,
    reader: { listByOrgPhase: async (_o, phase) => (phase === ChangeSetPhase.InReview ? [cs] : []) },
    writer: { upsert: async (c) => { upserts.push(c); } },
    pipelineFor: () => buildInternalOnlyPipeline("org-lfg"),
    appendEvent: async (e) => { events.push(e); },
  });
  const result = await lane.runOnce();
  equal(result.failures.length, 0);
  ok(result.status.includes("advanced"));
  ok(upserts.length > 0);
  ok(events.some((e) => e.kind === "review_stage_advanced" || e.kind === "stage_approved"));
});

test("change-control lane drives an EXTERNAL stage through the live port (projects once + pulls the decision)", async () => {
  const pipeline = buildGitHubGatedPipeline("org-lfg");
  const externalIndex = pipeline.stages.findIndex((s) => s.authority.kind === "external");
  const cs: ChangeSet = { ...changeSet(ChangeSetPhase.InReview, externalIndex), pipelineId: pipeline.pipelineId };

  let projects = 0;
  let pulls = 0;
  const ref: ProjectionRef = { system: ExternalSystem.GitHub, externalId: "99", url: "https://github.com/o/r/pull/99", lastSyncedState: "open", syncedAt: "2026-05-30T00:00:00Z" };
  const externalPort: ChangeControlPort = {
    system: ExternalSystem.GitHub,
    project: async () => { projects += 1; return ref; },
    pull: async () => { pulls += 1; return { decision: ExternalDecision.Approved, merged: false, detail: "approved" }; },
    push: async () => {},
    merge: async () => {},
  };

  const upserts: ChangeSet[] = [];
  const lane = createChangeControlCadenceLane({
    organizationId: "org-lfg", now: () => NOW, createId,
    reader: { listByOrgPhase: async (_o, phase) => (phase === ChangeSetPhase.InReview ? [cs] : []) },
    writer: { upsert: async (c) => { upserts.push(c); } },
    pipelineFor: () => pipeline,
    appendEvent: async () => {},
    externalPort,
  });
  const result = await lane.runOnce();

  equal(result.failures.length, 0);
  equal(projects, 1, "the live port projected a real PR for the external stage");
  ok(pulls >= 1, "the external decision was PULLED from the port, not auto-approved");
  ok(upserts.some((c) => c.projections.some((p) => p.externalId === "99")), "the projection ref was persisted onto the ChangeSet");
});

test("change-control lane is a no-op (0 advanced) when nothing is in review", async () => {
  const lane = createChangeControlCadenceLane({
    organizationId: "org-lfg", now: () => NOW, createId,
    reader: { listByOrgPhase: async () => [] },
    writer: { upsert: async () => {} },
    pipelineFor: () => buildInternalOnlyPipeline("org-lfg"),
    appendEvent: async () => {},
  });
  const result = await lane.runOnce();
  equal(result.status, "change-control:0advanced");
});

function releaseChangeSet(changeSetId: string, phase: ChangeSetPhase = ChangeSetPhase.Approved): ChangeSet {
  return {
    ...changeSet(phase, 0),
    changeSetId,
    workItemId: `work-${changeSetId}`,
    targetRef: `feat/${changeSetId}`,
    title: `Release ${changeSetId}`,
  };
}

function releaseConfigChangeSet(changeSetId: string, phase: ChangeSetPhase = ChangeSetPhase.Approved): ChangeSet {
  return {
    ...releaseChangeSet(changeSetId, phase),
    targetRef: `org-policy/${changeSetId}`,
    artifacts: [{
      kind: ChangeArtifactKind.ConfigChange,
      key: "rmo.assignment.explorationRate",
      before: "0.10",
      after: "0.20",
    }],
  };
}

test("release-queue lane applies a green approved batch and emits apply events", async () => {
  const approved = [releaseChangeSet("cs-a"), releaseChangeSet("cs-b")];
  const upserts: ChangeSet[] = [];
  const events: OrgEvent[] = [];
  const lane = createReleaseQueueCadenceLane({
    organizationId: "org-lfg",
    now: () => NOW,
    createId,
    reader: { listByOrgPhase: async (_o, phase) => (phase === ChangeSetPhase.Approved ? approved : []) },
    writer: { upsert: async (cs) => { upserts.push(cs); } },
    appendEvent: async (event) => { events.push(event); },
    evaluateBatch: () => ({ green: true, evidenceRefs: ["release-proof:green"] }),
  });

  const result = await lane.runOnce();

  equal(result.failures.length, 0);
  equal(result.status, "release-queue:2applied/0changes_requested/0requeued");
  deepEqual(upserts.map((cs) => cs.phase), [ChangeSetPhase.Applied, ChangeSetPhase.Applied]);
  equal(events.filter((event) => event.kind === OrgEventKind.ChangeSetApplied).length, 2);
});

test("release-queue lane passes simulation evidence into config policy apply", async () => {
  const approved = [releaseConfigChangeSet("cs-policy")];
  const simulationEvidence = createPolicySimulationArtifact("cs-policy");
  const upserts: ChangeSet[] = [];
  const events: OrgEvent[] = [];
  const lane = createReleaseQueueCadenceLane({
    organizationId: "org-lfg",
    now: () => NOW,
    createId,
    reader: { listByOrgPhase: async (_o, phase) => (phase === ChangeSetPhase.Approved ? approved : []) },
    writer: { upsert: async (cs) => { upserts.push(cs); } },
    appendEvent: async (event) => { events.push(event); },
    evaluateBatch: () => ({ green: true, evidenceRefs: [simulationEvidence.ref], evidenceArtifacts: [simulationEvidence] }),
  });

  const result = await lane.runOnce();

  equal(result.failures.length, 0);
  equal(result.status, "release-queue:1applied/0changes_requested/0requeued");
  deepEqual(upserts.map((cs) => cs.phase), [ChangeSetPhase.Applied]);
  ok(events.some((event) => event.kind === OrgEventKind.ChangeSetApplied && event.evidenceRefs.includes(simulationEvidence.ref)));
  equal(events.find((event) => event.kind === OrgEventKind.ChangeSetApplied)?.evidenceRefs.filter((ref) => ref === simulationEvidence.ref).length, 1);
});

test("release-queue lane holds config policy apply without simulation evidence", async () => {
  const approved = [releaseConfigChangeSet("cs-policy")];
  const upserts: ChangeSet[] = [];
  const events: OrgEvent[] = [];
  const lane = createReleaseQueueCadenceLane({
    organizationId: "org-lfg",
    now: () => NOW,
    createId,
    reader: { listByOrgPhase: async (_o, phase) => (phase === ChangeSetPhase.Approved ? approved : []) },
    writer: { upsert: async (cs) => { upserts.push(cs); } },
    appendEvent: async (event) => { events.push(event); },
    evaluateBatch: () => ({ green: true, evidenceRefs: ["release-proof:green"] }),
  });

  const result = await lane.runOnce();

  equal(result.failures.length, 0);
  equal(result.status, "release-queue:0applied/0changes_requested/1requeued");
  deepEqual(upserts.map((cs) => cs.phase), [ChangeSetPhase.Approved]);
  ok(events.some((event) => event.kind === OrgEventKind.ReviewFindingRaised && event.decision.includes("simulation evidence")));
});

test("release-queue lane does not reuse simulation evidence across config policy changes", async () => {
  const approved = [releaseConfigChangeSet("cs-policy-a"), releaseConfigChangeSet("cs-policy-b")];
  const simulationEvidence = createPolicySimulationArtifact("cs-policy-a");
  const upserts: ChangeSet[] = [];
  const events: OrgEvent[] = [];
  const lane = createReleaseQueueCadenceLane({
    organizationId: "org-lfg",
    now: () => NOW,
    createId,
    reader: { listByOrgPhase: async (_o, phase) => (phase === ChangeSetPhase.Approved ? approved : []) },
    writer: { upsert: async (cs) => { upserts.push(cs); } },
    appendEvent: async (event) => { events.push(event); },
    evaluateBatch: () => ({ green: true, evidenceRefs: [simulationEvidence.ref], evidenceArtifacts: [simulationEvidence] }),
  });

  const result = await lane.runOnce();

  equal(result.failures.length, 0);
  equal(result.status, "release-queue:1applied/0changes_requested/1requeued");
  deepEqual(upserts.map((cs) => [cs.changeSetId, cs.phase]), [
    ["cs-policy-a", ChangeSetPhase.Applied],
    ["cs-policy-b", ChangeSetPhase.Approved],
  ]);
  ok(events.some((event) => event.kind === OrgEventKind.ChangeSetApplied && event.subjectId === "cs-policy-a"));
  ok(events.some((event) => event.kind === OrgEventKind.ReviewFindingRaised && event.subjectId === "cs-policy-b"));
  ok(!events.some((event) => event.subjectId === "cs-policy-b" && event.evidenceRefs.includes(simulationEvidence.ref)));
});

test("release-queue lane bisects a red batch and bounces only the culprit", async () => {
  const approved = [releaseChangeSet("cs-a"), releaseChangeSet("cs-b"), releaseChangeSet("cs-c")];
  const upserts: ChangeSet[] = [];
  const events: OrgEvent[] = [];
  const lane = createReleaseQueueCadenceLane({
    organizationId: "org-lfg",
    now: () => NOW,
    createId,
    reader: { listByOrgPhase: async (_o, phase) => (phase === ChangeSetPhase.Approved ? approved : []) },
    writer: { upsert: async (cs) => { upserts.push(cs); } },
    appendEvent: async (event) => { events.push(event); },
    evaluateBatch: (batch) => ({
      green: !batch.some((cs) => cs.changeSetId === "cs-b"),
      evidenceRefs: [`release-proof:${batch.map((cs) => cs.changeSetId).join("+")}`],
    }),
  });

  const result = await lane.runOnce();

  equal(result.failures.length, 0);
  equal(result.status, "release-queue:2applied/1changes_requested/0requeued");
  deepEqual(upserts.map((cs) => [cs.changeSetId, cs.phase]), [
    ["cs-a", ChangeSetPhase.Applied],
    ["cs-b", ChangeSetPhase.ChangesRequested],
    ["cs-c", ChangeSetPhase.Applied],
  ]);
  ok(events.some((event) => event.kind === OrgEventKind.ChangesRequested && event.subjectId === "cs-b"));
});

test("release-queue lane persists batch actions through the provided atomic boundary", async () => {
  const approved = [releaseChangeSet("cs-a"), releaseChangeSet("cs-b")];
  const upserts: ChangeSet[] = [];
  let atomicCalls = 0;
  const lane = createReleaseQueueCadenceLane({
    organizationId: "org-lfg",
    now: () => NOW,
    createId,
    reader: { listByOrgPhase: async (_o, phase) => (phase === ChangeSetPhase.Approved ? approved : []) },
    writer: { upsert: async () => { throw new Error("non-atomic writer used"); } },
    appendEvent: async () => { throw new Error("non-atomic event sink used"); },
    evaluateBatch: () => ({ green: true, evidenceRefs: ["release-proof:green"] }),
    runAtomically: async (operation) => {
      atomicCalls += 1;
      await operation({
        writer: { upsert: async (cs) => { upserts.push(cs); } },
        appendEvent: async () => {},
      });
    },
  });

  const result = await lane.runOnce();

  equal(result.failures.length, 0);
  equal(atomicCalls, 1);
  deepEqual(upserts.map((cs) => cs.phase), [ChangeSetPhase.Applied, ChangeSetPhase.Applied]);
});

test("release-queue lane degrades instead of applying when no release evaluator is wired", async () => {
  const approved = [releaseChangeSet("cs-a")];
  const upserts: ChangeSet[] = [];
  const events: OrgEvent[] = [];
  const lane = createReleaseQueueCadenceLane({
    organizationId: "org-lfg",
    now: () => NOW,
    createId,
    reader: { listByOrgPhase: async (_o, phase) => (phase === ChangeSetPhase.Approved ? approved : []) },
    writer: { upsert: async (cs) => { upserts.push(cs); } },
    appendEvent: async (event) => { events.push(event); },
  });

  const result = await lane.runOnce();

  equal(result.status, "degraded");
  equal(result.failures.length, 1);
  ok(result.failures[0]!.message.includes("release batch evaluator unavailable"));
  equal(upserts.length, 0);
  equal(events.length, 0);
});

test("release-queue lane fails open on transient reader errors", async () => {
  const lane = createReleaseQueueCadenceLane({
    organizationId: "org-lfg",
    now: () => NOW,
    createId,
    reader: {
      listByOrgPhase: async () => {
        throw new Error("cockroach timeout");
      },
    },
    writer: { upsert: async () => {} },
    appendEvent: async () => {},
    evaluateBatch: () => ({ green: true, evidenceRefs: [] }),
  });

  const result = await lane.runOnce();

  equal(result.status, "degraded");
  equal(result.failures.length, 1);
  ok(result.failures[0]!.message.includes("release-queue lane"));
});

test("doc-maintenance lane flags a stale unit + persists it + emits the cycle event", async () => {
  const { createDocMaintenanceCadenceLane } = await import("../src/org-cadence-lanes.ts");
  const { DocType, DocScopeKind, DocLifecycleState } = await import("../../../packages/domain/src/index.ts");
  const aged = {
    docUnitId: "du-old", organizationId: "org-lfg", sourceId: "s", type: DocType.Runbook, scopeKind: DocScopeKind.Department,
    scopeId: "eng", title: "Old runbook", summary: "", contentRef: "r", contentHash: "h", status: DocLifecycleState.Active,
    freshnessAt: new Date(NOW - 200 * 86_400_000).toISOString(), boundHatIds: [], boundStageIds: [],
    createdAt: new Date(NOW - 200 * 86_400_000).toISOString(), updatedAt: new Date(NOW - 200 * 86_400_000).toISOString(), version: 1,
  };
  const upserts: string[] = [];
  const events: OrgEvent[] = [];
  const lane = createDocMaintenanceCadenceLane({
    organizationId: "org-lfg", now: () => NOW, createId,
    reader: { listByOrgStatus: async (_o: string, status: string) => (status === DocLifecycleState.Active ? [aged] : []) },
    writer: { upsert: async (d: { docUnitId: string }) => { upserts.push(d.docUnitId); } },
    appendEvent: async (e: OrgEvent) => { events.push(e); },
  });
  const result = await lane.runOnce();
  equal(result.failures.length, 0);
  ok(result.status.includes("stale"));
  ok(upserts.includes("du-old"));
  ok(events.some((e) => e.kind === "doc_maintenance_cycle"));
});

function orgEvent(over: Partial<OrgEvent> = {}): OrgEvent {
  return {
    id: "evt-1",
    kind: OrgEventKind.WorkItemTransition,
    occurredAt: "2026-05-30T00:00:00.000Z",
    organizationId: "org-lfg",
    subjectId: "work-1",
    fromState: WorkItemState.Created,
    toState: WorkItemState.Intake,
    decision: "created to intake",
    supervisorChain: [],
    evidenceRefs: [],
    correlationId: "corr-1",
    causationId: "cause-1",
    traceId: "trace-1",
    ...over,
  };
}

function conformanceMetric(name: string, value: number, attributes: Record<string, string | number | boolean>) {
  return {
    kind: "gauge",
    name,
    value,
    attributes: {
      "agentic.organization.id": "org-lfg",
      ...attributes,
    },
  };
}

test("conformance lane replays org_events and reports a clean theorem tick", async () => {
  const lane = createConformanceCadenceLane({
    organizationId: "org-lfg",
    limit: 100,
    reader: { listByOrganization: async () => [orgEvent()] },
  });

  const result = await lane.runOnce();

  equal(result.failures.length, 0);
  equal(result.status, "conformance:1checked/0violations/0skipped");
});

test("conformance lane emits pass-ratio and coverage-ratio SLI metrics for Grafana alerts", async () => {
  const telemetry = new RecordingTelemetry();
  const lane = createConformanceCadenceLane({
    organizationId: "org-lfg",
    limit: 100,
    reader: {
      listByOrganization: async () => [
        orgEvent({ id: "evt-legal", fromState: WorkItemState.Created, toState: WorkItemState.Intake }),
        orgEvent({ id: "evt-illegal", fromState: WorkItemState.Created, toState: WorkItemState.Done }),
      ],
    },
    telemetry,
  });

  await lane.runOnce();

  deepEqual(telemetry.metrics, [
    conformanceMetric("org_conformance_pass_ratio", 0.5, {
      "agentic.conformance.checked": 2,
      "agentic.conformance.conformant": 1,
      "agentic.conformance.nonconformant": 1,
      "agentic.conformance.skipped": 0,
      "agentic.conformance.skipped_ambiguous": 0,
    }),
    conformanceMetric("org_conformance_coverage_ratio", 1, {
      "agentic.conformance.checked": 2,
      "agentic.conformance.skipped_ambiguous": 0,
    }),
  ]);
});

test("conformance lane degrades when replay finds an illegal durable transition", async () => {
  const lane = createConformanceCadenceLane({
    organizationId: "org-lfg",
    limit: 100,
    reader: { listByOrganization: async () => [orgEvent({ id: "evt-bypass", fromState: WorkItemState.Created, toState: WorkItemState.Done })] },
  });

  const result = await lane.runOnce();

  equal(result.status, "degraded");
  equal(result.failures.length, 1);
  ok(result.failures[0]!.message.includes("evt-bypass"));
});

test("conformance lane degrades when ambiguous transition skips exceed the ratchet", async () => {
  const lane = createConformanceCadenceLane({
    organizationId: "org-lfg",
    limit: 100,
    reader: {
      listByOrganization: async () => [
        orgEvent({
          id: "evt-approved",
          kind: OrgEventKind.ChangeSetApproved,
          fromState: ChangeSetPhase.InReview,
          toState: ChangeSetPhase.Approved,
        }),
      ],
    },
  });

  const result = await lane.runOnce();

  equal(result.status, "degraded");
  equal(result.failures.length, 1);
  ok(result.failures[0]!.message.includes("ambiguous transition skip ratchet"));
});

test("stale-reaction-plan scan lane emits incident and completion events", async () => {
  const events: OrgEvent[] = [];
  const lane = createStaleReactionPlanScanCadenceLane({
    organizationId: "org-lfg",
    now: () => NOW,
    createId,
    staleAfterMs: 60_000,
    reader: {
      listStaleReactionPlanCandidates: async () => [
        {
          reactionPlanId: "rp-expired",
          organizationId: "org-lfg",
          status: ReactionPlanStatus.Claimed,
          createdAt: "2026-05-29T23:00:00.000Z",
          claimExpiresAt: "2026-05-29T23:59:00.000Z",
          attemptCount: 1,
        },
      ],
    },
    appendEvent: async (event) => {
      events.push(event);
    },
  });

  const result = await lane.runOnce();

  equal(result.failures.length, 0);
  equal(result.status, "stale-reaction-plan-scan:1incidents");
  deepEqual(events.map((event) => event.kind), [
    OrgEventKind.RecoveryIncidentDetected,
    OrgEventKind.RecoveryScanCompleted,
  ]);
  equal(events[0]?.subjectId, "rp-expired");
});

test("recovery scan lanes fail open on transient reader errors", async () => {
  const lane = createStrandedScheduleScanCadenceLane({
    organizationId: "org-lfg",
    now: () => NOW,
    createId,
    graceMs: 60_000,
    reader: {
      listStrandedScheduleCandidates: async () => {
        throw new Error("cockroach timeout");
      },
    },
    appendEvent: async () => {},
  });

  const result = await lane.runOnce();

  equal(result.status, "degraded");
  equal(result.failures.length, 1);
  ok(result.failures[0]!.message.includes("stranded-schedule-scan lane"));
});

test("stranded-schedule scan lane reports ended capacity holds", async () => {
  const events: OrgEvent[] = [];
  const lane = createStrandedScheduleScanCadenceLane({
    organizationId: "org-lfg",
    now: () => NOW,
    createId,
    graceMs: 60_000,
    reader: {
      listStrandedScheduleCandidates: async () => [
        {
          workScheduleBlockId: "sched-1",
          organizationId: "org-lfg",
          workItemId: "work-1",
          assignedAgentId: "agent-1",
          assignedHatAssignmentId: "hat-1",
          state: ScheduleBlockState.Scheduled,
          startsAt: "2026-05-29T22:00:00.000Z",
          endsAt: "2026-05-29T23:00:00.000Z",
        },
      ],
    },
    appendEvent: async (event) => {
      events.push(event);
    },
  });

  const result = await lane.runOnce();

  equal(result.status, "stranded-schedule-scan:1incidents");
  equal(events.filter((event) => event.kind === OrgEventKind.RecoveryIncidentDetected).length, 1);
  equal(events.at(-1)?.kind, OrgEventKind.RecoveryScanCompleted);
});

test("abandoned-run-binding scan lane reports stale running Hermes runs", async () => {
  const events: OrgEvent[] = [];
  const lane = createAbandonedRunBindingScanCadenceLane({
    organizationId: "org-lfg",
    now: () => NOW,
    createId,
    heartbeatDeadlineMs: 60_000,
    reader: {
      listAbandonedRunBindingCandidates: async () => [
        {
          runId: "run-1",
          workItemId: "work-1",
          agentId: "agent-1",
          sessionId: "session-1",
          hatAssignmentId: "hat-1",
          promptFlowRunId: "prompt-1",
          state: "running",
          lastHeartbeatMs: NOW - 61_000,
        },
      ],
    },
    appendEvent: async (event) => {
      events.push(event);
    },
  });

  const result = await lane.runOnce();

  equal(result.status, "abandoned-run-binding-scan:1incidents");
  equal(events[0]?.subjectId, "run-1");
  equal(events.at(-1)?.kind, OrgEventKind.RecoveryScanCompleted);
});

test("dead-letter classifier lane reports terminal reaction-plan failures", async () => {
  const events: OrgEvent[] = [];
  const lane = createDeadLetterClassifierCadenceLane({
    organizationId: "org-lfg",
    now: () => NOW,
    createId,
    reader: {
      listDeadLetterCandidates: async () => [
        {
          deadLetterId: "rp-failed",
          organizationId: "org-lfg",
          createdAt: "2026-05-29T22:00:00.000Z",
          failedAt: "2026-05-29T23:00:00.000Z",
          failureMessage: "invalid durable reaction plan action",
          retryable: false,
          attemptCount: 1,
        },
      ],
    },
    appendEvent: async (event) => {
      events.push(event);
    },
  });

  const result = await lane.runOnce();

  equal(result.status, "dead-letter-classifier:1incidents");
  equal(events[0]?.subjectId, "rp-failed");
  ok(events[0]?.evidenceRefs.includes("classification:poison-payload"));
  equal(events.at(-1)?.kind, OrgEventKind.RecoveryScanCompleted);
});

function captureObserveActEffectsStoreFactory(
  capture: (effects: CommandEffects) => void,
): CommandStateStoreFactory<CommandResult> {
  return {
    createCommandStateStore: () => ({
      findIdempotencyRecord: async () => undefined,
      recordCommandOutcome: async (input) => {
        capture(input.effects);
        return {
          status: CommandOutcomePersistenceStatus.Committed,
          result: input.idempotencyRecord.result,
        };
      },
    }),
  };
}

function createObserveActAllowingAuthorizationPort(): CommandAuthorizationPort {
  return {
    authorizeCommand: async () => ({
      status: PolicyDecisionStatus.Allowed,
      decisionId: "policy-decision-observe-act",
      policyVersion: "policy-v1",
    }),
  };
}

function createObserveActPolicyObservationPort(): PolicyDecisionObservationPort {
  return {
    observePolicyDecision: async () => ({
      status: PolicyDecisionObservationPersistenceStatus.Recorded,
    }),
  };
}

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

function hierarchySnapshot(): HierarchySnapshot {
  return {
    projects: [
      {
        projectId: "project-eng",
        organizationId: "org-lfg",
        departmentId: "engineering",
        name: "Engineering Project",
        status: "active",
        trajectory: [{ id: "delivery", label: "delivery trajectory", value: "on_track" }],
        metrics: [],
      },
    ],
    initiatives: [
      {
        initiativeId: "init-eng-a",
        projectId: "project-eng",
        organizationId: "org-lfg",
        title: "Readiness Initiative",
        status: "active",
        metrics: [],
      },
    ],
  };
}

function directorHierarchySnapshot(): HierarchySnapshot {
  return {
    projects: [
      {
        projectId: "project-eng",
        organizationId: "org-lfg",
        departmentId: "engineering",
        name: "Engineering Project",
        status: "active",
        trajectory: [{ id: "delivery", label: "delivery trajectory", value: "on_track" }],
        metrics: [],
      },
    ],
    initiatives: [
      {
        initiativeId: "init-eng-a",
        projectId: "project-eng",
        organizationId: "org-lfg",
        title: "Readiness Initiative",
        status: "active",
        priorityScore: 75,
        metrics: [],
      },
    ],
  };
}
