import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  ActionClass,
  RunLifecyclePhase,
  RunScope,
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
} from "../src/agent-cli.ts";

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
        { index: 0, direction: "meta.hold", label: "empty", availability: "N" },
        { index: 1, direction: "commit.a", label: "execute", availability: "T" },
      ],
    }),
    1,
  );
});

test("createModelBackedMenuSelector accepts only rendered T slot indexes from the local model", async () => {
  const prompts: { system: string; user: string }[] = [];
  const selector = createModelBackedMenuSelector({
    chat: {
      complete: async (request) => {
        prompts.push(request);
        return { content: "[04]", model: "llama3.1" };
      },
    },
    fallback: selectFirstTrueSlot,
  });

  const selected = await selector(menuForSelection());

  equal(selected, 4);
  ok(prompts[0]?.user.includes("[04] commit.a execute"));
  ok(!prompts[0]?.user.includes("[05] commit.b blocked"));
});

test("createModelBackedMenuSelector falls back when the model chooses a non-selectable slot", async () => {
  const selector = createModelBackedMenuSelector({
    chat: {
      complete: async () => "5",
    },
    fallback: () => 4,
  });

  equal(await selector(menuForSelection()), 4);
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
      return new Response(JSON.stringify({ message: { content: "4" }, model: "llama3.1" }));
    }) as typeof fetch,
  });

  equal(await selector(menuForSelection()), 4);
  equal(calls[0]?.url, "http://ollama:11434/api/chat");
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
  deepEqual(commands, [
    'observe.lifecycle_transition:{"commandId":"cmd-observe-1-4","type":"observe.lifecycle_transition","idempotencyKey":"observe:1:99:awaiting_gate:4","requestHash":"observe.lifecycle_transition:1:99:awaiting_gate:execute:executing:4","correlationId":"observe-cli-1","causationId":"observe-cli-1","traceId":"observe-cli-1","organizationId":"org-1","projectId":"project-1","workItemId":"work-1","actor":{"agentId":"agent-release-1","hatAssignmentId":"99"},"runId":"1","fromPhase":"awaiting_gate","actionType":"execute","toPhase":"executing","toScope":"work_item","hatAssignmentId":"99"}',
  ]);
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
      "8",
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
  ok(stdout.join("\n").includes("[08] T scope.run Implement work item"));
  ok(stdout.join("\n").includes("action: loaded context task-implement"));
  ok(stdout.join("\n").includes("directions:"));
  ok(stdout.join("\n").includes("- Load implementation plan"));
  ok(stdout.join("\n").includes("tools:"));
  ok(stdout.join("\n").includes('- repo.search {"q":"work-1"}'));
  ok(stdout.join("\n").includes("context metrics:"));
  ok(stdout.join("\n").includes("- failing tests: 2"));
  deepEqual(contexts, ["task-implement:repo.search:work_item.failures"]);
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
      "8",
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
          directions: ["Load plan"],
          toolInjections: [{ tool: "repo.search", args: { q: "work-1" } }],
          metrics: [{ id: "work_item.failures", label: "failing tests", value: 2 }],
        }),
      ]),
    },
  });

  equal(tasks.length, 1);
  equal(tasks[0]?.taskId, "task-implement");
  equal(tasks[0]?.toolInjections[0]?.tool, "repo.search");
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
