import { deepEqual, equal, ok, throws } from "node:assert/strict";
import { test } from "node:test";

import {
  ActionClass,
  ActRejectionReason,
  PromptFlowGateKind,
  PromptFlowRunState,
  RunLifecyclePhase,
  RunScope,
  type PromptFlowDefinition,
  type ChatCompletionRequest,
  type HierarchySnapshot,
  type HierarchyMission,
  type PromptFlowTask,
} from "../../../packages/application/src/index.ts";
import {
  createAgentCliMetricAgentsFromEnv,
  createAgentCliHierarchyFromEnv,
  createAgentCliPromptFlowTasksFromEnv,
  createAgentCliSelectorFromEnv,
  createModelBackedMenuSelector,
  formatAgentCliScreen,
  parseAgentCliArgs,
  runAgentCliCycle,
  selectFirstTrueSlot,
  tryCreateAgentCliHierarchyFromEnv,
  tryCreateAgentCliPromptFlowTasksFromEnv,
} from "../src/agent-cli.ts";
import {
  CommandType,
  ScheduleBlockState,
  ScheduleBlockType,
  SupervisorChainLevel,
  SupervisorSignalToolType,
  ToolBundle,
  type WorkScheduleBlock,
} from "../../../packages/domain/src/index.ts";

test("parseAgentCliArgs accepts the minimal observe invocation and defaults replayable snapshot fields", () => {
  const parsed = parseAgentCliArgs(["observe", "--hat", "release_operator", "--scope", "work_item"]);

  equal(parsed.ok, true);
  if (!parsed.ok) return;
  equal(parsed.value.hatId, "release_operator");
  equal(parsed.value.scope, RunScope.WorkItem);
  equal(parsed.value.phase, RunLifecyclePhase.Observing);
  equal(parsed.value.runId, "1");
  equal(parsed.value.hatAssignmentId, "1");
  equal(parsed.value.selectIndex, undefined);
});

test("formatAgentCliScreen prints the scoped dashboard and all 16 controller slots", () => {
  const rendered = formatAgentCliScreen({
    scope: RunScope.WorkItem,
    phase: RunLifecyclePhase.AwaitingGate,
    hatId: "release_operator",
    metrics: {
      scope: RunScope.WorkItem,
      blocks: [{ id: "tests", label: "tests", value: 7 }],
    },
    slots: Array.from({ length: 16 }, (_, index) => ({
      index,
      direction: index === 4 ? "commit.a" : `slot.${index}`,
      label: index === 4 ? "execute" : "empty",
      availability: index === 4 ? "T" : "N",
      ...(index === 4 ? {} : { reason: "no action rendered for this direction" }),
    })),
  });

  ok(rendered.includes("scope: work_item"));
  ok(rendered.includes("hat: release_operator"));
  ok(rendered.includes("metrics:"));
  ok(rendered.includes("- tests: 7"));
  equal(rendered.split("\n").filter((line) => /^\[[0-9]{2}\]/.test(line)).length, 16);
  ok(rendered.includes("[04] T commit.a execute"));
});

test("selectFirstTrueSlot returns the first selectable slot index", () => {
  equal(
    selectFirstTrueSlot({
      slots: [
        { index: 0, direction: "meta.pause", label: "empty", availability: "N" },
        { index: 1, direction: "commit.a", label: "execute", availability: "T" },
      ],
    }),
    1,
  );
});

test("selectFirstTrueSlot prefers executable work over page navigation", () => {
  equal(
    selectFirstTrueSlot({
      slots: [
        { index: 1, direction: "navigate.next", label: "next prompt-flow page", availability: "T" },
        { index: 4, direction: "commit.a", label: "execute", availability: "T" },
        { index: 6, direction: "inspect.more", label: "Task context", availability: "T" },
      ],
    }),
    4,
  );
  equal(
    selectFirstTrueSlot({
      slots: [
        { index: 1, direction: "navigate.next", label: "next prompt-flow page", availability: "T" },
      ],
    }),
    1,
  );
});

test("createModelBackedMenuSelector accepts only rendered T slot indexes from the local model", async () => {
  const prompts: ChatCompletionRequest[] = [];
  const selector = createModelBackedMenuSelector({
    chat: {
      complete: async (request) => {
        prompts.push(request);
        return { content: JSON.stringify({ slot: 4, reason: "execute the available work item" }), model: "llama3.1" };
      },
    },
    fallback: selectFirstTrueSlot,
  });

  const selected = await selector(menuForSelection());

  equal(selected, 4);
  deepEqual(prompts[0]?.format, {
    type: "object",
    additionalProperties: false,
    required: ["slot", "reason"],
    properties: {
      slot: { type: "integer", enum: [4] },
      reason: { type: "string", minLength: 1 },
    },
  });
  ok(prompts[0]?.user.includes("[04] commit.a execute"));
  ok(!prompts[0]?.user.includes("[05] commit.b blocked"));
});

test("createModelBackedMenuSelector rejects free-form slot text instead of regex-parsing it", async () => {
  const selector = createModelBackedMenuSelector({
    chat: {
      complete: async () => "[04]",
    },
    fallback: () => 4,
  });

  deepEqual(await selector(menuForSelection()), {
    index: 4,
    reason: "fallback_after_selector_rejection",
    selectorRejection: {
      reason: "parse_failure",
      rawOutput: "[04]",
      fallbackIndex: 4,
    },
  });
});

test("createModelBackedMenuSelector records selector rejection evidence when the model chooses a non-selectable slot", async () => {
  const selector = createModelBackedMenuSelector({
    chat: {
      complete: async () => JSON.stringify({ slot: 5, reason: "try blocked slot" }),
    },
    fallback: () => 4,
  });

  deepEqual(await selector(menuForSelection()), {
    index: 4,
    reason: "fallback_after_selector_rejection",
    selectorRejection: {
      reason: "non_selectable_slot",
      rawOutput: "{\"slot\":5,\"reason\":\"try blocked slot\"}",
      rejectedIndex: 5,
      fallbackIndex: 4,
    },
  });
});

test("runAgentCliCycle carries selector rejection evidence into observe-act tick evidence", async () => {
  const result = await runAgentCliCycle({
    argv: [
      "observe",
      "--hat",
      "release_operator",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-release-1",
      "--organization",
      "org-1",
      "--project",
      "project-1",
      "--work-item",
      "work-1",
      "--scope",
      "work_item",
      "--phase",
      "awaiting_gate",
      "--gate-approved",
    ],
    now: () => "2026-05-31T12:00:00.000Z",
    selectSlot: createModelBackedMenuSelector({
      chat: {
        complete: async () => JSON.stringify({ slot: 15, reason: "escalate instead" }),
      },
      fallback: () => 4,
    }),
    runCommand: async () => ({ status: "accepted" }),
    dispatchTool: async () => ({ ok: true }),
  });

  equal(result.exitCode, 0);
  equal(result.evidence?.selectedIndex, 4);
  deepEqual(result.evidence?.selectorRejections, [{
    reason: "non_selectable_slot",
    rawOutput: "{\"slot\":15,\"reason\":\"escalate instead\"}",
    rejectedIndex: 15,
    fallbackIndex: 4,
  }]);
});

test("createAgentCliSelectorFromEnv wires a local Ollama selector when configured", async () => {
  const calls: { url: string; body: unknown }[] = [];
  const selector = createAgentCliSelectorFromEnv({
    env: {
      AGENTIC_ORG_LLM_BASE_URL: "http://ollama:11434",
      AGENTIC_ORG_LLM_MODEL: "llama3.1",
    },
    fetchImpl: (async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify({ message: { content: JSON.stringify({ slot: 4, reason: "execute" }) }, model: "llama3.1" }));
    }) as typeof fetch,
  });

  equal(await selector(menuForSelection()), 4);
  equal(calls[0]?.url, "http://ollama:11434/api/chat");
  deepEqual((calls[0]?.body as { format?: unknown } | undefined)?.format, {
    type: "object",
    additionalProperties: false,
    required: ["slot", "reason"],
    properties: {
      slot: { type: "integer", enum: [4] },
      reason: { type: "string", minLength: 1 },
    },
  });
});

test("runAgentCliCycle renders observe output and routes the selected slot through act", async () => {
  const commands: string[] = [];
  const stdout: string[] = [];
  const result = await runAgentCliCycle({
    argv: [
      "observe",
      "--hat",
      "release_operator",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-release-1",
      "--organization",
      "org-1",
      "--project",
      "project-1",
      "--work-item",
      "work-1",
      "--scope",
      "work_item",
      "--phase",
      "awaiting_gate",
      "--gate-approved",
      "--select-index",
      "4",
    ],
    now: () => "2026-05-31T12:00:00.000Z",
    writeStdout: (text) => stdout.push(text),
    metricAgents: [
      {
        id: "queue",
        scope: RunScope.WorkItem,
        compute: async () => ({ id: "queue", label: "queue", value: 3 }),
      },
    ],
    runCommand: async (commandType, command) => {
      commands.push(`${commandType}:${JSON.stringify(command)}`);
      return { appendedOrgEvent: "org-event-1" };
    },
    dispatchTool: async () => ({ ok: true }),
  });

  equal(result.exitCode, 0);
  equal(result.actionResult?.outcome, "dispatched");
  ok(stdout.join("\n").includes("[04] T commit.a execute"));
  ok(stdout.join("\n").includes("action: dispatched command"));
  equal(result.evidence?.selectedIndex, 4);
  equal(result.evidence?.vetoCount, 3);
  equal(result.evidence?.trueSlotCount, 8);
  equal(result.evidence?.metricBlockIds[0], "queue");
  ok(result.evidence?.menuHash.match(/^[0-9a-f]{64}$/));
  deepEqual(commands, [
    'observe.lifecycle_transition:{"commandId":"cmd-observe-1-4","type":"observe.lifecycle_transition","idempotencyKey":"observe:1:99:awaiting_gate:4","requestHash":"observe.lifecycle_transition:1:99:awaiting_gate:execute:executing:4","correlationId":"observe-cli-1","causationId":"observe-cli-1","traceId":"observe-cli-1","organizationId":"org-1","projectId":"project-1","workItemId":"work-1","actor":{"agentId":"agent-release-1","hatAssignmentId":"99"},"policyContext":{"toolType":"write_code"},"runId":"1","fromPhase":"awaiting_gate","actionType":"execute","toPhase":"executing","toScope":"work_item","hatAssignmentId":"99"}',
  ]);
});

test("runAgentCliCycle materializes meta.escalate as a send-supervisor-signal command", async () => {
  const commands: string[] = [];
  const stdout: string[] = [];
  const result = await runAgentCliCycle({
    argv: [
      "observe",
      "--hat",
      "dependency_manager",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-release-1",
      "--organization",
      "org-1",
      "--project",
      "project-1",
      "--team",
      "team-runtime",
      "--work-item",
      "work-1",
      "--supervisor-hat-assignment",
      "hat-manager-1",
      "--scope",
      "work_item",
      "--phase",
      "awaiting_gate",
      "--gate-approved",
      "--select-index",
      "15",
    ],
    now: () => "2026-05-31T12:00:00.000Z",
    writeStdout: (text) => stdout.push(text),
    runCommand: async (commandType, command) => {
      commands.push(`${commandType}:${JSON.stringify(command)}`);
      return { status: "accepted" };
    },
    dispatchTool: async () => ({ ok: true }),
  });

  equal(result.exitCode, 0);
  equal(result.actionResult?.outcome, "dispatched");
  ok(stdout.join("\n").includes("[15] T meta.escalate escalate to manager"));
  equal(result.evidence?.selectedIndex, 15);
  equal(result.evidence?.selectedCommandType, CommandType.SendSupervisorSignal);
  deepEqual(commands, [
    `${CommandType.SendSupervisorSignal}:{"commandId":"cmd-observe-1-15","type":"send_supervisor_signal","idempotencyKey":"observe:1:99:awaiting_gate:15","requestHash":"send_supervisor_signal:1:99:awaiting_gate:15:hat-manager-1","correlationId":"observe-cli-1","causationId":"observe-cli-1","traceId":"observe-cli-1","organizationId":"org-1","projectId":"project-1","workItemId":"work-1","actor":{"agentId":"agent-release-1","hatAssignmentId":"99"},"targetHatAssignmentId":"hat-manager-1","title":"Observe-act escalation for work_item awaiting_gate","message":"Agent requested supervisor triage for run 1 at work_item/awaiting_gate. Legal options: 1; vetoed options: 1.","policyContext":{"scope":{"teamId":"team-runtime","workItemId":"work-1"},"toolType":"request_escalation","supervisorChain":{"sourceLevel":"team_member","targetLevel":"manager"}}}`,
  ]);
  ok(commands[0]?.includes(SupervisorSignalToolType.RequestEscalation));
  ok(commands[0]?.includes(SupervisorChainLevel.Manager));
});

test("runAgentCliCycle passes schedule blocks into observe so execution can fail closed", async () => {
  let dispatched = false;
  const stdout: string[] = [];
  const result = await runAgentCliCycle({
    argv: [
      "observe",
      "--hat",
      "release_operator",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-release-1",
      "--organization",
      "org-1",
      "--project",
      "project-1",
      "--work-item",
      "work-1",
      "--scope",
      "work_item",
      "--phase",
      "awaiting_gate",
      "--gate-approved",
      "--select-index",
      "4",
    ],
    now: () => "2026-05-31T12:00:00.000Z",
    writeStdout: (text) => stdout.push(text),
    scheduleBlocks: [],
    runCommand: async () => {
      dispatched = true;
      return { ok: true };
    },
    dispatchTool: async () => {
      dispatched = true;
      return { ok: true };
    },
  });

  equal(result.exitCode, 1);
  equal(result.actionResult?.outcome, "rejected");
  if (result.actionResult?.outcome !== "rejected") return;
  equal(result.actionResult.reason, ActRejectionReason.SlotNotSelectable);
  ok(result.actionResult.message.includes("requires a current schedule block"));
  equal(dispatched, false);
  ok(stdout.join("\n").includes("[04] F commit.a execute"));
  ok(stdout.join("\n").includes("requires a current schedule block"));
});

test("runAgentCliCycle re-authorizes selected slots before command dispatch", async () => {
  let dispatched = false;
  const result = await runAgentCliCycle({
    argv: [
      "observe",
      "--hat",
      "release_operator",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-release-1",
      "--organization",
      "org-1",
      "--project",
      "project-1",
      "--work-item",
      "work-1",
      "--scope",
      "work_item",
      "--phase",
      "awaiting_gate",
      "--gate-approved",
      "--select-index",
      "4",
    ],
    now: () => "2026-05-31T12:00:00.000Z",
    scheduleBlocks: [scheduleBlock()],
    authorizeSlot: async () => ({
      status: "denied",
      reason: "schedule_block_required",
      message: "schedule authority changed after observe",
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

  equal(result.exitCode, 1);
  equal(result.actionResult?.outcome, "rejected");
  if (result.actionResult?.outcome !== "rejected") return;
  equal(result.actionResult.reason, ActRejectionReason.ScheduleAuthorityDenied);
  equal(result.actionResult.message, "schedule authority changed after observe");
  equal(dispatched, false);
});

test("runAgentCliCycle can select scope controls without dispatching side effects", async () => {
  let dispatched = false;
  const stdout: string[] = [];
  const result = await runAgentCliCycle({
    argv: [
      "observe",
      "--hat",
      "release_operator",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-release-1",
      "--organization",
      "org-1",
      "--project",
      "project-1",
      "--work-item",
      "work-1",
      "--scope",
      "work_item",
      "--phase",
      "awaiting_gate",
      "--gate-approved",
      "--select-index",
      "8",
    ],
    now: () => "2026-05-31T12:00:00.000Z",
    writeStdout: (text) => stdout.push(text),
    runCommand: async () => {
      dispatched = true;
      return { ok: true };
    },
    dispatchTool: async () => {
      dispatched = true;
      return { ok: true };
    },
  });

  equal(result.exitCode, 0);
  deepEqual(result.actionResult, { outcome: "reobserve", scope: RunScope.Initiative });
  equal(dispatched, false);
  ok(stdout.join("\n").includes("[08] T scope.out scope out to initiative"));
  ok(stdout.join("\n").includes("action: reobserve initiative"));
  equal(result.evidence?.selectedIndex, 8);
});

test("runAgentCliCycle can select meta.status and returns glass-halo evidence", async () => {
  let dispatched = false;
  const stdout: string[] = [];
  const result = await runAgentCliCycle({
    argv: [
      "observe",
      "--hat",
      "release_operator",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-release-1",
      "--organization",
      "org-1",
      "--project",
      "project-1",
      "--work-item",
      "work-1",
      "--scope",
      "work_item",
      "--phase",
      "awaiting_gate",
      "--gate-approved",
      "--select-index",
      "13",
    ],
    now: () => "2026-05-31T12:00:00.000Z",
    writeStdout: (text) => stdout.push(text),
    metricAgents: [
      {
        id: "queue.pressure",
        scope: RunScope.WorkItem,
        compute: async () => ({ id: "queue.pressure", label: "queue pressure", value: 4 }),
      },
    ],
    promptFlowTasks: [
      promptFlowTask({
        taskId: "task-implement",
        promptFlowId: "flow-implement",
        label: "Implement work item",
        actionClass: ActionClass.WriteCode,
      }),
    ],
    runCommand: async () => {
      dispatched = true;
      return { ok: true };
    },
    dispatchTool: async () => {
      dispatched = true;
      return { ok: true };
    },
  });

  equal(result.exitCode, 0);
  equal(dispatched, false);
  equal(result.actionResult?.outcome, "status_report");
  ok(stdout.join("\n").includes("[13] T meta.status status / glass-halo"));
  ok(stdout.join("\n").includes("action: status glass_halo_status work_item awaiting_gate"));
  equal(result.evidence?.selectedIndex, 13);
  equal(result.evidence?.statusSignalKind, "glass_halo_status");
  equal(result.evidence?.statusScope, RunScope.WorkItem);
  equal(result.evidence?.statusPhase, RunLifecyclePhase.AwaitingGate);
  deepEqual(result.evidence?.metricBlockIds, ["queue.pressure"]);
  deepEqual(result.evidence?.promptFlowIds, ["flow-implement"]);
});

test("runAgentCliCycle status evidence includes hierarchy priority scope when hierarchy is available", async () => {
  const result = await runAgentCliCycle({
    argv: [
      "observe",
      "--hat",
      "engineering_director",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-director-1",
      "--organization",
      "org-1",
      "--project",
      "project-eng",
      "--work-item",
      "work-1",
      "--scope",
      "project",
      "--phase",
      "observing",
      "--select-index",
      "13",
    ],
    now: () => "2026-05-31T12:00:00.000Z",
    hierarchy: hierarchySnapshot(),
    runCommand: async () => {
      throw new Error("status must not dispatch command side effects");
    },
    dispatchTool: async () => {
      throw new Error("status must not dispatch MCP side effects");
    },
  });

  equal(result.exitCode, 0);
  equal(result.actionResult?.outcome, "status_report");
  equal(result.evidence?.statusHierarchyPriorityScope, "department_initiatives");
});

test("runAgentCliCycle can select free-time/rest without dispatching side effects", async () => {
  const stdout: string[] = [];
  const result = await runAgentCliCycle({
    argv: [
      "observe",
      "--hat",
      "release_operator",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-release-1",
      "--organization",
      "org-1",
      "--project",
      "project-1",
      "--work-item",
      "work-1",
      "--scope",
      "work_item",
      "--phase",
      "awaiting_gate",
      "--gate-approved",
      "--select-index",
      "14",
    ],
    now: () => "2026-05-31T12:00:00.000Z",
    writeStdout: (text) => stdout.push(text),
    runCommand: async () => {
      throw new Error("rest must not dispatch command side effects");
    },
    dispatchTool: async () => {
      throw new Error("rest must not dispatch MCP side effects");
    },
  });

  equal(result.exitCode, 0);
  equal(result.actionResult?.outcome, "rested");
  ok(stdout.join("\n").includes("[14] T meta.pause free-time / rest"));
  ok(stdout.join("\n").includes("action: rested free-time/rest selected; no side effects for this tick"));
  equal(result.evidence?.selectedIndex, 14);
});

test("runAgentCliCycle can select edit-grammar/branch without dispatching side effects", async () => {
  const stdout: string[] = [];
  const result = await runAgentCliCycle({
    argv: [
      "observe",
      "--hat",
      "release_operator",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-release-1",
      "--organization",
      "org-1",
      "--project",
      "project-1",
      "--work-item",
      "work-1",
      "--scope",
      "work_item",
      "--phase",
      "awaiting_gate",
      "--gate-approved",
      "--select-index",
      "7",
    ],
    now: () => "2026-05-31T12:00:00.000Z",
    writeStdout: (text) => stdout.push(text),
    runCommand: async () => {
      throw new Error("edit-grammar/branch must not dispatch command side effects");
    },
    dispatchTool: async () => {
      throw new Error("edit-grammar/branch must not dispatch MCP side effects");
    },
  });

  equal(result.exitCode, 0);
  equal(result.actionResult?.outcome, "grammar_branch_requested");
  ok(stdout.join("\n").includes("[07] T branch.fork edit-grammar / branch"));
  ok(stdout.join("\n").includes("action: grammar-branch requested edit-grammar/branch selected; no side effects for this tick"));
  equal(result.evidence?.selectedIndex, 7);
});

test("runAgentCliCycle rejects vetoed work slots while keeping all-vetoed meta controls visible", async () => {
  let dispatched = false;
  const stdout: string[] = [];
  const result = await runAgentCliCycle({
    argv: [
      "observe",
      "--hat",
      "release_operator",
      "--scope",
      "run",
      "--phase",
      "observing",
      "--select-index",
      "4",
    ],
    now: () => "2026-05-31T12:00:00.000Z",
    writeStdout: (text) => stdout.push(text),
    deterministicRules: [
      {
        name: "tenant-freeze",
        veto: (option) => `tenant freeze blocks ${option.actionType}`,
      },
    ],
    runCommand: async () => {
      dispatched = true;
      return { ok: true };
    },
    dispatchTool: async () => {
      dispatched = true;
      return { ok: true };
    },
  });

  equal(result.exitCode, 1);
  equal(result.actionResult?.outcome, "rejected");
  if (result.actionResult?.outcome !== "rejected") return;
  equal(result.actionResult.reason, "slot_not_selectable");
  equal(result.actionResult.message, "tenant freeze blocks compose");
  equal(result.evidence?.selectedIndex, 4);
  equal(result.evidence?.vetoCount, 3);
  equal(result.evidence?.trueSlotCount, 4);
  equal(dispatched, false);
  ok(stdout.join("\n").includes("[04] F commit.a compose (tenant freeze blocks compose)"));
  ok(stdout.join("\n").includes("[05] F commit.b block (tenant freeze blocks block)"));
  ok(stdout.join("\n").includes("[07] T branch.fork edit-grammar / branch"));
  ok(stdout.join("\n").includes("[12] T meta.refresh refresh"));
  ok(stdout.join("\n").includes("[13] T meta.status status / glass-halo"));
  ok(stdout.join("\n").includes("[14] T meta.pause free-time / rest"));
});

test("runAgentCliCycle renders prompt-flow tasks and loads selected context", async () => {
  const contexts: string[] = [];
  const stdout: string[] = [];
  const result = await runAgentCliCycle({
    argv: [
      "observe",
      "--hat",
      "release_operator",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-release-1",
      "--organization",
      "org-1",
      "--project",
      "project-1",
      "--work-item",
      "work-1",
      "--scope",
      "work_item",
      "--phase",
      "awaiting_gate",
      "--gate-approved",
      "--select-index",
      "6",
    ],
    now: () => "2026-05-31T12:00:00.000Z",
    writeStdout: (text) => stdout.push(text),
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
    runCommand: async () => ({ ok: true }),
    dispatchTool: async () => ({ ok: true }),
    loadPromptFlowContext: async (request) => {
      contexts.push(`${request.taskId}:${request.toolInjections[0]?.tool}:${request.metrics[0]?.id}`);
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

  equal(result.exitCode, 0);
  equal(result.actionResult?.outcome, "loaded_context");
  ok(stdout.join("\n").includes("prompt flows:"));
  ok(stdout.join("\n").includes("- task-implement flow-implement Implement work item"));
  ok(stdout.join("\n").includes("[06] T inspect.more Implement work item"));
  ok(stdout.join("\n").includes("action: loaded context task-implement"));
  ok(stdout.join("\n").includes("directions:"));
  ok(stdout.join("\n").includes("- Load implementation plan"));
  ok(stdout.join("\n").includes("tools:"));
  ok(stdout.join("\n").includes('- repo.search {"q":"work-1"}'));
  ok(stdout.join("\n").includes("context metrics:"));
  ok(stdout.join("\n").includes("- failing tests: 2"));
  deepEqual(contexts, ["task-implement:repo.search:work_item.failures"]);
});

test("runAgentCliCycle renders prompt-flow overflow pages and reobserve page navigation", async () => {
  const stdout: string[] = [];
  const tasks = Array.from({ length: 3 }, (_, index) => promptFlowTask({
    taskId: `task-${index + 1}`,
    promptFlowId: `flow-${index + 1}`,
    label: `Task ${index + 1}`,
    actionClass: ActionClass.WriteCode,
    priority: 100 - index,
  }));

  const result = await runAgentCliCycle({
    argv: [
      "observe",
      "--hat",
      "release_operator",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-release-1",
      "--organization",
      "org-1",
      "--project",
      "project-1",
      "--work-item",
      "work-1",
      "--scope",
      "work_item",
      "--phase",
      "awaiting_gate",
      "--gate-approved",
      "--prompt-flow-page",
      "1",
      "--select-index",
      "0",
    ],
    now: () => "2026-05-31T12:00:00.000Z",
    writeStdout: (text) => stdout.push(text),
    promptFlowTasks: tasks,
    runCommand: async () => ({ ok: true }),
    dispatchTool: async () => ({ ok: true }),
  });

  equal(result.exitCode, 0);
  deepEqual(result.actionResult, {
    outcome: "reobserve",
    scope: RunScope.WorkItem,
    menuPage: { promptFlows: 0 },
  });
  const rendered = stdout.join("\n");
  ok(rendered.includes("prompt-flow page: 2/3"));
  ok(rendered.includes("[06] T inspect.more Task 2"));
  ok(rendered.includes("[07] T branch.fork edit-grammar / branch"));
  ok(rendered.includes("[00] T navigate.previous previous prompt-flow page"));
  ok(rendered.includes("action: reobserve work_item prompt-flow-page 1"));
  equal(result.evidence?.promptFlowPage, 1);
  equal(result.evidence?.selectedPromptFlowTaskId, undefined);
  equal(result.evidence?.reobservePromptFlowPage, 0);
});

test("runAgentCliCycle binds selected prompt-flow task identity into evidence", async () => {
  const tasks = Array.from({ length: 3 }, (_, index) => promptFlowTask({
    taskId: `task-${index + 1}`,
    promptFlowId: `flow-${index + 1}`,
    label: "Duplicate label",
    actionClass: ActionClass.WriteCode,
    priority: 100 - index,
  }));

  const result = await runAgentCliCycle({
    argv: [
      "observe",
      "--hat",
      "release_operator",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-release-1",
      "--organization",
      "org-1",
      "--project",
      "project-1",
      "--work-item",
      "work-1",
      "--scope",
      "work_item",
      "--phase",
      "awaiting_gate",
      "--gate-approved",
      "--prompt-flow-page",
      "1",
      "--select-index",
      "6",
    ],
    now: () => "2026-05-31T12:00:00.000Z",
    promptFlowTasks: tasks,
    runCommand: async () => ({ ok: true }),
    dispatchTool: async () => ({ ok: true }),
  });

  equal(result.exitCode, 0);
  equal(result.evidence?.promptFlowPage, 1);
  equal(result.evidence?.selectedPromptFlowTaskId, "task-2");
  equal(result.evidence?.selectedPromptFlowId, "flow-2");
});

test("runAgentCliCycle default prompt-flow loader preserves compiled phase metadata", async () => {
  const stdout: string[] = [];
  const result = await runAgentCliCycle({
    argv: [
      "observe",
      "--hat",
      "release_operator",
      "--work-item",
      "work-1",
      "--scope",
      "work_item",
      "--phase",
      "awaiting_gate",
      "--gate-approved",
      "--select-index",
      "6",
    ],
    now: () => "2026-05-31T12:00:00.000Z",
    writeStdout: (text) => stdout.push(text),
    promptFlowTasks: [
      promptFlowTask({
        taskId: "task-compiled",
        promptFlowId: "flow-implement",
        label: "Execute implementation",
        actionClass: ActionClass.WriteCode,
        directions: ["Patch the smallest surface"],
        toolInjections: [{ tool: "repo.patch" }],
        contextArtifactRefs: ["work:work-1"],
        definitionVersion: "1.0.0",
        phaseId: "execute",
        runState: PromptFlowRunState.RunningPhase,
        requiredEvidenceRefs: ["tests.green"],
        gate: { kind: PromptFlowGateKind.Evidence, requiredEvidenceRefs: ["tests.green"] },
        reviewerHatIds: ["code_reviewer"],
        timeoutSeconds: 900,
        rollbackPolicy: { kind: "compensating_action", description: "revert patch" },
      }),
    ],
    runCommand: async () => ({ ok: true }),
    dispatchTool: async () => ({ ok: true }),
  });

  equal(result.exitCode, 0);
  equal(result.actionResult?.outcome, "loaded_context");
  ok(stdout.join("\n").includes("phase: execute running_phase"));
  ok(stdout.join("\n").includes("required evidence:"));
  ok(stdout.join("\n").includes("- tests.green"));
  ok(stdout.join("\n").includes("gate: evidence"));
  ok(stdout.join("\n").includes("reviewers:"));
  ok(stdout.join("\n").includes("- code_reviewer"));
  ok(stdout.join("\n").includes("timeout seconds: 900"));
  ok(stdout.join("\n").includes("rollback: compensating_action revert patch"));
});

test("runAgentCliCycle renders hierarchy items for the active hat level", async () => {
  const stdout: string[] = [];
  const result = await runAgentCliCycle({
    argv: [
      "observe",
      "--hat",
      "engineering_director",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-director-1",
      "--organization",
      "org-1",
      "--project",
      "project-eng",
      "--work-item",
      "work-1",
      "--scope",
      "project",
      "--phase",
      "observing",
      "--select-index",
      "4",
    ],
    now: () => "2026-05-31T12:00:00.000Z",
    writeStdout: (text) => stdout.push(text),
    hierarchy: hierarchySnapshot(),
    runCommand: async () => ({ status: "ok" }),
    dispatchTool: async () => ({ ok: true }),
  });

  equal(result.exitCode, 0);
  ok(stdout.join("\n").includes("hierarchy: director"));
  ok(stdout.join("\n").includes("priority scope: department_initiatives"));
  ok(stdout.join("\n").includes("- project project-eng Engineering Project"));
  ok(stdout.join("\n").includes("- initiative init-eng-a Readiness Initiative"));
  ok(stdout.join("\n").includes("- priority initiative init-eng-a Readiness Initiative"));
  ok(stdout.join("\n").includes("- hierarchy action record_priority_decision: Rank department initiatives"));
  ok(!stdout.join("\n").includes("project-qa"));
});

test("createAgentCliHierarchyFromEnv reads hierarchy projects and initiatives from JSON", () => {
  const hierarchy = createAgentCliHierarchyFromEnv({
    env: {
      AGENTIC_ORG_HIERARCHY_JSON: JSON.stringify(hierarchySnapshot()),
    },
  });

  equal(hierarchy.projects.length, 2);
  equal(hierarchy.projects[0]?.trajectory[0]?.id, "delivery");
  equal(hierarchy.initiatives[0]?.initiativeId, "init-eng-a");
  equal(hierarchy.workBatches?.[0]?.batchId, "batch-run");
  equal(hierarchy.workItems?.[0]?.workItemId, "work-ready");
});

test("tryCreateAgentCliHierarchyFromEnv returns typed feedback for malformed hierarchy JSON", () => {
  const result = tryCreateAgentCliHierarchyFromEnv({
    env: {
      AGENTIC_ORG_HIERARCHY_JSON: "{",
    },
  });

  equal(result.ok, false);
  if (result.ok) throw new Error("expected typed hierarchy parse failure");
  equal(result.source, "hierarchy");
  ok(result.message.includes("AGENTIC_ORG_HIERARCHY_JSON"));
});

test("runAgentCliCycle renders TPM operating readout for work batches and meetings", async () => {
  const stdout: string[] = [];
  const result = await runAgentCliCycle({
    argv: [
      "observe",
      "--hat",
      "tpm",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-tpm-1",
      "--organization",
      "org-1",
      "--project",
      "project-program",
      "--work-item",
      "work-ready",
      "--scope",
      "initiative",
      "--phase",
      "observing",
      "--select-index",
      "4",
    ],
    now: () => "2026-05-31T12:00:00.000Z",
    writeStdout: (text) => stdout.push(text),
    hierarchy: tpmHierarchySnapshot(),
    runCommand: async () => ({ status: "ok" }),
    dispatchTool: async () => ({ ok: true }),
  });

  equal(result.exitCode, 0);
  ok(stdout.join("\n").includes("hierarchy: manager"));
  ok(stdout.join("\n").includes("priority scope: initiative_execution"));
  ok(stdout.join("\n").includes("- priority work_batch batch-run Unblock rollout"));
  ok(stdout.join("\n").includes("- priority work_item work-ready Ready implementation"));
  ok(stdout.join("\n").includes("- hierarchy scoped metric blockers: 3"));
  ok(stdout.join("\n").includes("- hierarchy action schedule_coordination_meeting: Schedule coordination meeting"));
  ok(stdout.join("\n").includes("- hierarchy action schedule_prioritized_work: Schedule prioritized work block"));
});

test("runAgentCliCycle renders management mission, schedule pressure, and corrective actions", async () => {
  const stdout: string[] = [];
  const result = await runAgentCliCycle({
    argv: [
      "observe",
      "--hat",
      "engineering_director",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-director-1",
      "--organization",
      "org-1",
      "--project",
      "project-eng",
      "--work-item",
      "work-1",
      "--scope",
      "project",
      "--phase",
      "observing",
      "--select-index",
      "4",
    ],
    now: () => "2026-05-29T00:00:00.000Z",
    writeStdout: (text) => stdout.push(text),
    hierarchy: managementMissionHierarchySnapshot(),
    runCommand: async () => ({ status: "ok" }),
    dispatchTool: async () => ({ ok: true }),
  });

  equal(result.exitCode, 0);
  ok(stdout.join("\n").includes("mission: Ship the observe-act management surface"));
  ok(stdout.join("\n").includes("mission timeframe: 2026-05-01T00:00:00.000Z -> 2026-06-30T00:00:00.000Z"));
  ok(stdout.join("\n").includes("mission status: behind"));
  ok(stdout.join("\n").includes("mission progress: 20% actual / 46% expected"));
  ok(stdout.join("\n").includes("- mission lag progress variance: -26pct"));
  ok(stdout.join("\n").includes("- mission corrective action request_staffing: Request staffing or hat supply"));
  ok(stdout.join("\n").includes("- mission corrective action veto schedule_coordination_meeting:"));
});

test("createAgentCliHierarchyFromEnv reads management missions from JSON", () => {
  const hierarchy = createAgentCliHierarchyFromEnv({
    env: {
      AGENTIC_ORG_HIERARCHY_JSON: JSON.stringify(managementMissionHierarchySnapshot()),
    },
  });

  equal(hierarchy.missions?.length, 1);
  equal(hierarchy.missions?.[0]?.missionId, "mission-eng-director");
  equal(hierarchy.missions?.[0]?.milestones[0]?.milestoneId, "milestone-readout");
});

test("runAgentCliCycle can load prompt-flow context with the built-in context loader", async () => {
  const stdout: string[] = [];
  const result = await runAgentCliCycle({
    argv: [
      "observe",
      "--hat",
      "release_operator",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-release-1",
      "--organization",
      "org-1",
      "--project",
      "project-1",
      "--work-item",
      "work-1",
      "--scope",
      "work_item",
      "--phase",
      "awaiting_gate",
      "--gate-approved",
      "--select-index",
      "6",
    ],
    now: () => "2026-05-31T12:00:00.000Z",
    writeStdout: (text) => stdout.push(text),
    promptFlowTasks: [
      promptFlowTask({
        taskId: "task-implement",
        promptFlowId: "flow-implement",
        label: "Implement work item",
        actionClass: ActionClass.WriteCode,
        directions: ["Load implementation plan"],
        toolInjections: [{ tool: "repo.search", args: { q: "work-1" } }],
        metrics: [{ id: "work_item.failures", label: "failing tests", value: 2 }],
        contextArtifactRefs: ["artifact:plan"],
      }),
    ],
    runCommand: async () => ({ ok: true }),
    dispatchTool: async () => ({ ok: true }),
  });

  equal(result.exitCode, 0);
  equal(result.actionResult?.outcome, "loaded_context");
  ok(stdout.join("\n").includes("- artifact:plan: artifact:plan"));
});

test("runAgentCliCycle rejects an unknown hat before rendering authority", async () => {
  const stderr: string[] = [];
  const result = await runAgentCliCycle({
    argv: ["observe", "--hat", "missing_hat", "--scope", "work_item"],
    now: () => "2026-05-31T12:00:00.000Z",
    writeStderr: (text) => stderr.push(text),
    runCommand: async () => ({ ok: true }),
    dispatchTool: async () => ({ ok: true }),
  });

  equal(result.exitCode, 2);
  ok(stderr.join("\n").includes("unknown hat"));
});

test("runAgentCliCycle rejects malformed run ids before rendering authority", async () => {
  const stderr: string[] = [];
  const result = await runAgentCliCycle({
    argv: ["observe", "--hat", "release_operator", "--scope", "work_item", "--run-id", "0x2a"],
    now: () => "2026-05-31T12:00:00.000Z",
    writeStderr: (text) => stderr.push(text),
    runCommand: async () => ({ ok: true }),
    dispatchTool: async () => ({ ok: true }),
  });

  equal(result.exitCode, 2);
  ok(stderr.join("\n").includes("--run-id must be a base-10 ZetaId"));
});

test("runAgentCliCycle rejects malformed hat assignment ids before rendering authority", async () => {
  const stderr: string[] = [];
  const result = await runAgentCliCycle({
    argv: ["observe", "--hat", "release_operator", "--scope", "work_item", "--hat-assignment", "hat-99"],
    now: () => "2026-05-31T12:00:00.000Z",
    writeStderr: (text) => stderr.push(text),
    runCommand: async () => ({ ok: true }),
    dispatchTool: async () => ({ ok: true }),
  });

  equal(result.exitCode, 2);
  ok(stderr.join("\n").includes("--hat-assignment must be a base-10 ZetaId"));
});

test("createAgentCliMetricAgentsFromEnv wires live LGTM telemetry when all endpoints are configured", () => {
  const fetchCalls: string[] = [];
  const agents = createAgentCliMetricAgentsFromEnv({
    env: {
      AGENTIC_ORG_MIMIR_BASE_URL: "http://mimir:9009/prometheus",
      AGENTIC_ORG_TEMPO_BASE_URL: "http://tempo:3200",
      AGENTIC_ORG_LOKI_BASE_URL: "http://loki:3100",
      AGENTIC_ORG_TELEMETRY_RANGE_START: "2026-05-31T11:00:00.000Z",
      AGENTIC_ORG_TELEMETRY_RANGE_END: "2026-05-31T12:00:00.000Z",
    },
    now: () => "2026-05-31T12:00:00.000Z",
    fetchImpl: (async (url) => {
      fetchCalls.push(String(url));
      return new Response(JSON.stringify({ status: "success", data: { result: [] }, traces: [] }));
    }) as typeof fetch,
  });

  equal(agents.length, 15);
  equal(agents[0]?.scope, RunScope.Run);
});

test("createAgentCliPromptFlowTasksFromEnv reads current tasks from JSON", () => {
  const tasks = createAgentCliPromptFlowTasksFromEnv({
    env: {
      AGENTIC_ORG_PROMPT_FLOW_TASKS_JSON: JSON.stringify([
        promptFlowTask({
          taskId: "task-implement",
          promptFlowId: "flow-implement",
          label: "Implement work item",
          actionClass: ActionClass.WriteCode,
          allowedHatIds: ["backend_implementer"],
          directions: ["Load plan"],
          toolInjections: [{ tool: "repo.search", args: { q: "work-1" }, requiredSecretScopes: ["repo:read"] }],
          metrics: [{ id: "work_item.failures", label: "failing tests", value: 2 }],
          definitionVersion: "1.0.0",
          phaseId: "execute",
          runState: PromptFlowRunState.RunningPhase,
          requiredEvidenceRefs: ["tests.green"],
          gate: {
            kind: PromptFlowGateKind.HumanApproval,
            requiredEvidenceRefs: ["tests.green"],
            approverHatIds: ["operations_director"],
            requiredHumanApprovalCount: 1,
          },
          reviewerHatIds: ["code_reviewer"],
          timeoutSeconds: 900,
          retryLimit: 2,
          rollbackPolicy: { kind: "compensating_action", description: "revert patch" },
        }),
      ]),
    },
  });

  equal(tasks.length, 1);
  equal(tasks[0]?.taskId, "task-implement");
  equal(tasks[0]?.toolInjections[0]?.tool, "repo.search");
  deepEqual(tasks[0]?.toolInjections[0]?.requiredSecretScopes, ["repo:read"]);
  deepEqual(tasks[0]?.allowedHatIds, ["backend_implementer"]);
  equal(tasks[0]?.phaseId, "execute");
  equal(tasks[0]?.runState, PromptFlowRunState.RunningPhase);
  deepEqual(tasks[0]?.requiredEvidenceRefs, ["tests.green"]);
  equal(tasks[0]?.gate?.kind, PromptFlowGateKind.HumanApproval);
  deepEqual(tasks[0]?.gate?.approverHatIds, ["operations_director"]);
  equal(tasks[0]?.gate?.requiredHumanApprovalCount, 1);
  deepEqual(tasks[0]?.reviewerHatIds, ["code_reviewer"]);
  equal(tasks[0]?.timeoutSeconds, 900);
  equal(tasks[0]?.retryLimit, 2);
  equal(tasks[0]?.rollbackPolicy?.kind, "compensating_action");
});

test("tryCreateAgentCliPromptFlowTasksFromEnv returns typed feedback for malformed prompt-flow JSON", () => {
  const result = tryCreateAgentCliPromptFlowTasksFromEnv({
    env: {
      AGENTIC_ORG_PROMPT_FLOW_TASKS_JSON: "{",
    },
  });

  equal(result.ok, false);
  if (result.ok) throw new Error("expected typed prompt-flow parse failure");
  equal(result.source, "prompt_flow_tasks");
  ok(result.message.includes("AGENTIC_ORG_PROMPT_FLOW_TASKS_JSON"));
});

test("createAgentCliPromptFlowTasksFromEnv compiles durable definitions and runs into current tasks", () => {
  const tasks = createAgentCliPromptFlowTasksFromEnv({
    env: {
      AGENTIC_ORG_PROMPT_FLOW_DEFINITIONS_JSON: JSON.stringify([promptFlowDefinition()]),
      AGENTIC_ORG_PROMPT_FLOW_RUNS_JSON: JSON.stringify([
        {
          runId: "pfr-compile-1",
          promptFlowId: "flow-code-change",
          definitionVersion: "1.0.0",
          workItemId: "work-compile-1",
          scope: RunScope.WorkItem,
          currentPhaseId: "execute",
          state: PromptFlowRunState.RunningPhase,
          priority: 42,
        },
      ]),
    },
  });

  equal(tasks.length, 1);
  equal(tasks[0]?.taskId, "pfr-compile-1");
  equal(tasks[0]?.promptFlowId, "flow-code-change");
  equal(tasks[0]?.definitionVersion, "1.0.0");
  equal(tasks[0]?.phaseId, "execute");
  deepEqual(tasks[0]?.directions, ["Patch the smallest surface", "Run focused tests"]);
  deepEqual(tasks[0]?.toolInjections, [{ tool: "repo.patch", requiredSecretScopes: ["repo:write"] }]);
  deepEqual(tasks[0]?.requiredEvidenceRefs, ["tests.green", "diff.reviewable"]);
  equal(tasks[0]?.rollbackPolicy?.kind, "compensating_action");
});

test("createAgentCliPromptFlowTasksFromEnv rejects invalid durable prompt-flow definitions before observe", () => {
  throws(
    () => createAgentCliPromptFlowTasksFromEnv({
      env: {
        AGENTIC_ORG_PROMPT_FLOW_DEFINITIONS_JSON: JSON.stringify([
          promptFlowDefinition({
            allowedHatIds: [],
            phases: [
              {
                ...promptFlowDefinition().phases[0]!,
                requiredEvidenceRefs: [],
              },
            ],
          }),
        ]),
        AGENTIC_ORG_PROMPT_FLOW_RUNS_JSON: JSON.stringify([]),
      },
    }),
    /AGENTIC_ORG_PROMPT_FLOW_DEFINITIONS_JSON failed lint/,
  );
});

test("createAgentCliPromptFlowTasksFromEnv rejects blank durable visible strings before observe", () => {
  throws(
    () => createAgentCliPromptFlowTasksFromEnv({
      env: {
        AGENTIC_ORG_PROMPT_FLOW_DEFINITIONS_JSON: JSON.stringify([
          promptFlowDefinition({
            name: "   ",
            phases: [{ ...promptFlowDefinition().phases[0]!, label: "   " }],
          }),
        ]),
        AGENTIC_ORG_PROMPT_FLOW_RUNS_JSON: JSON.stringify([]),
      },
    }),
    /prompt-flow definition name must be a non-empty string/,
  );
});

test("createAgentCliPromptFlowTasksFromEnv rejects blank strings inside durable phase arrays", () => {
  throws(
    () => createAgentCliPromptFlowTasksFromEnv({
      env: {
        AGENTIC_ORG_PROMPT_FLOW_DEFINITIONS_JSON: JSON.stringify([
          promptFlowDefinition({
            phases: [
              {
                ...promptFlowDefinition().phases[0]!,
                directions: [""],
              },
            ],
          }),
        ]),
        AGENTIC_ORG_PROMPT_FLOW_RUNS_JSON: JSON.stringify([]),
      },
    }),
    /prompt-flow task directions must contain only non-empty strings/,
  );
});

test("createAgentCliPromptFlowTasksFromEnv rejects durable runs that cannot compile into observe-visible tasks", () => {
  throws(
    () => createAgentCliPromptFlowTasksFromEnv({
      env: {
        AGENTIC_ORG_PROMPT_FLOW_DEFINITIONS_JSON: JSON.stringify([promptFlowDefinition()]),
        AGENTIC_ORG_PROMPT_FLOW_RUNS_JSON: JSON.stringify([
          {
            runId: "pfr-typo",
            promptFlowId: "flow-code-change",
            definitionVersion: "1.0.0",
            workItemId: "work-compile-1",
            scope: RunScope.WorkItem,
            currentPhaseId: "missing-phase",
            state: PromptFlowRunState.RunningPhase,
            priority: 42,
          },
        ]),
      },
    }),
    /AGENTIC_ORG_PROMPT_FLOW_RUNS_JSON failed compile coverage/,
  );
});

test("createAgentCliPromptFlowTasksFromEnv rejects duplicate durable run ids before compile coverage", () => {
  const run = {
    runId: "pfr-duplicate",
    promptFlowId: "flow-code-change",
    definitionVersion: "1.0.0",
    workItemId: "work-compile-1",
    scope: RunScope.WorkItem,
    currentPhaseId: "execute",
    state: PromptFlowRunState.RunningPhase,
    priority: 42,
  };

  throws(
    () => createAgentCliPromptFlowTasksFromEnv({
      env: {
        AGENTIC_ORG_PROMPT_FLOW_DEFINITIONS_JSON: JSON.stringify([promptFlowDefinition()]),
        AGENTIC_ORG_PROMPT_FLOW_RUNS_JSON: JSON.stringify([
          run,
          { ...run, currentPhaseId: "missing-phase" },
        ]),
      },
    }),
    /AGENTIC_ORG_PROMPT_FLOW_RUNS_JSON contains duplicate run ids: pfr-duplicate/,
  );
});

test("createAgentCliPromptFlowTasksFromEnv rejects duplicate durable definition keys", () => {
  throws(
    () => createAgentCliPromptFlowTasksFromEnv({
      env: {
        AGENTIC_ORG_PROMPT_FLOW_DEFINITIONS_JSON: JSON.stringify([
          promptFlowDefinition(),
          promptFlowDefinition({ name: "Duplicate flow" }),
        ]),
        AGENTIC_ORG_PROMPT_FLOW_RUNS_JSON: JSON.stringify([]),
      },
    }),
    /AGENTIC_ORG_PROMPT_FLOW_DEFINITIONS_JSON contains duplicate definition keys: flow-code-change@1.0.0/,
  );
});

test("createAgentCliPromptFlowTasksFromEnv rejects duplicate durable phase ids", () => {
  throws(
    () => createAgentCliPromptFlowTasksFromEnv({
      env: {
        AGENTIC_ORG_PROMPT_FLOW_DEFINITIONS_JSON: JSON.stringify([
          promptFlowDefinition({
            phases: [
              promptFlowDefinition().phases[0]!,
              { ...promptFlowDefinition().phases[1]!, phaseId: "context" },
            ],
          }),
        ]),
        AGENTIC_ORG_PROMPT_FLOW_RUNS_JSON: JSON.stringify([]),
      },
    }),
    /prompt-flow definition flow-code-change@1.0.0 contains duplicate phase ids: context/,
  );
});

function menuForSelection() {
  return {
    slots: [
      { index: 0, direction: "navigate.previous", label: "empty", availability: "N" as const },
      { index: 4, direction: "commit.a", label: "execute", availability: "T" as const },
      { index: 5, direction: "commit.b", label: "blocked", availability: "F" as const, reason: "no authority" },
    ],
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

function promptFlowDefinition(overrides: Partial<PromptFlowDefinition> = {}): PromptFlowDefinition {
  return {
    promptFlowId: "flow-code-change",
    version: "1.0.0",
    name: "Code change flow",
    ownerDepartmentId: "engineering",
    allowedHatIds: ["backend_implementer"],
    requiredScope: RunScope.WorkItem,
    reviewerHatIds: ["code_reviewer"],
    rollbackPolicy: { kind: "compensating_action", description: "revert patch and release claim" },
    phases: [
      {
        phaseId: "context",
        label: "Load implementation context",
        actionClass: ActionClass.WriteDoc,
        permittedUniversalActions: ["load_context"],
        directions: ["Load work item", "Load initiative constraints"],
        requiredToolBundles: [ToolBundle.Task],
        toolInjections: [{ tool: "repo.search", args: { q: "work-compile-1" } }],
        contextArtifactRefs: ["work:work-compile-1", "initiative:init-1"],
        requiredEvidenceRefs: ["context.loaded"],
        gate: { kind: PromptFlowGateKind.Evidence, requiredEvidenceRefs: ["context.loaded"] },
        timeoutSeconds: 300,
        retryLimit: 1,
        metrics: [{ id: "context.age", label: "context age", value: 3, unit: "minutes" }],
      },
      {
        phaseId: "execute",
        label: "Execute implementation",
        actionClass: ActionClass.WriteCode,
        permittedUniversalActions: ["execute", "submit_evidence"],
        directions: ["Patch the smallest surface", "Run focused tests"],
        requiredToolBundles: [ToolBundle.Delivery],
        toolInjections: [{ tool: "repo.patch", requiredSecretScopes: ["repo:write"] }],
        contextArtifactRefs: ["work:work-compile-1", "decision:observe-act"],
        requiredEvidenceRefs: ["tests.green", "diff.reviewable"],
        gate: { kind: PromptFlowGateKind.Evidence, requiredEvidenceRefs: ["tests.green", "diff.reviewable"] },
        timeoutSeconds: 900,
        retryLimit: 2,
        metrics: [{ id: "test.failures", label: "test failures", value: 0, unit: "count" }],
      },
    ],
    ...overrides,
  };
}

function scheduleBlock(overrides: Partial<WorkScheduleBlock> = {}): WorkScheduleBlock {
  return {
    workScheduleBlockId: "schedule-1",
    organizationId: "org-1",
    projectId: "project-1",
    workItemId: "work-1",
    assignedAgentId: "agent-release-1",
    assignedHatAssignmentId: "99",
    blockType: ScheduleBlockType.PrioritizedWork,
    state: ScheduleBlockState.Active,
    title: "Execute current work",
    purpose: "Authorize observe-act lifecycle execution",
    startsAt: "2026-05-31T11:00:00.000Z",
    endsAt: "2026-05-31T13:00:00.000Z",
    scheduledAt: "2026-05-31T10:00:00.000Z",
    scheduledBy: {
      agentId: "agent-manager-1",
      hatAssignmentId: "hat-manager-1",
    },
    metadata: {
      updatedAt: "2026-05-31T10:00:00.000Z",
      version: 1,
      correlationId: "corr-1",
      causationId: "cause-1",
      traceId: "trace-1",
    },
    ...overrides,
  };
}

function hierarchySnapshot(): HierarchySnapshot {
  return {
    projects: [
      {
        projectId: "project-eng",
        organizationId: "org-1",
        departmentId: "engineering",
        name: "Engineering Project",
        status: "active",
        trajectory: [{ id: "delivery", label: "delivery trajectory", value: "on_track" }],
        metrics: [{ id: "project.health", label: "project health", value: "green" }],
      },
      {
        projectId: "project-qa",
        organizationId: "org-1",
        departmentId: "qa_engineering",
        name: "QA Project",
        status: "active",
        trajectory: [],
        metrics: [],
      },
    ],
    initiatives: [
      {
        initiativeId: "init-eng-a",
        projectId: "project-eng",
        organizationId: "org-1",
        title: "Readiness Initiative",
        status: "active",
        priorityScore: 75,
        metrics: [{ id: "initiative.ready", label: "ready work", value: 3 }],
      },
      {
        initiativeId: "init-qa",
        projectId: "project-qa",
        organizationId: "org-1",
        title: "QA Initiative",
        status: "active",
        metrics: [],
      },
    ],
    workBatches: [
      {
        batchId: "batch-run",
        projectId: "project-eng",
        initiativeId: "init-eng-a",
        organizationId: "org-1",
        title: "Run batch",
        status: "active",
        priorityScore: 10,
        metrics: [{ id: "batch.blockers", label: "batch blockers", value: 1 }],
      },
    ],
    workItems: [
      {
        workItemId: "work-ready",
        projectId: "project-eng",
        initiativeId: "init-eng-a",
        organizationId: "org-1",
        title: "Ready implementation",
        state: "ready",
        priorityScore: 8,
        metrics: [{ id: "work.age", label: "age", value: 2, unit: "days" }],
      },
    ],
  };
}

function tpmHierarchySnapshot(): HierarchySnapshot {
  return {
    projects: [
      {
        projectId: "project-program",
        organizationId: "org-1",
        departmentId: "program_and_initiative_management",
        name: "Program Project",
        status: "active",
        trajectory: [],
        metrics: [],
      },
    ],
    initiatives: [
      {
        initiativeId: "init-run",
        projectId: "project-program",
        organizationId: "org-1",
        title: "Run Initiative",
        status: "active",
        metrics: [],
      },
    ],
    workBatches: [
      {
        batchId: "batch-run",
        projectId: "project-program",
        initiativeId: "init-run",
        organizationId: "org-1",
        title: "Unblock rollout",
        status: "active",
        priorityScore: 80,
        metrics: [{ id: "batch.blockers", label: "blockers", value: 3 }],
      },
    ],
    workItems: [
      {
        workItemId: "work-ready",
        projectId: "project-program",
        initiativeId: "init-run",
        organizationId: "org-1",
        title: "Ready implementation",
        state: "ready",
        priorityScore: 65,
        metrics: [{ id: "work.age", label: "age", value: 2, unit: "days" }],
      },
    ],
  };
}

function managementMissionHierarchySnapshot(): HierarchySnapshot {
  return {
    projects: [
      {
        projectId: "project-eng",
        organizationId: "org-1",
        departmentId: "engineering",
        name: "Engineering Project",
        status: "active",
        trajectory: [{ id: "delivery", label: "delivery trajectory", value: "at_risk" }],
        metrics: [{ id: "project.health", label: "project health", value: "yellow" }],
      },
    ],
    initiatives: [
      {
        initiativeId: "init-eng-a",
        projectId: "project-eng",
        organizationId: "org-1",
        title: "Readiness Initiative",
        status: "active",
        priorityScore: 75,
        metrics: [{ id: "initiative.ready", label: "ready work", value: 3 }],
      },
    ],
    missions: [managementMission()],
  };
}

function managementMission(overrides: Partial<HierarchyMission> = {}): HierarchyMission {
  return {
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
    ...overrides,
  };
}
