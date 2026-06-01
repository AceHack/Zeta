import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  ActRejectionReason,
  ControlPlaneFlagKind,
  ControlPlaneRateLimitKind,
  ControlPlaneScopeKind,
  ObserveCommandType,
  RunLifecyclePhase,
  RunScope,
  TriAvailability,
  type ControlPlaneFlag,
  type ControlPlaneRateLimit,
  type Menu16Slot,
} from "../../../packages/application/src/index.ts";
import { OrgEventKind, type OrgEvent } from "../../../packages/domain/src/index.ts";
import {
  createAgentCliMcpDispatcher,
  resolveAgentCliProductionRuntime,
  runAgentCliMain,
  type AgentCliMainRuntime,
} from "../src/agent-cli-main.ts";

test("resolveAgentCliProductionRuntime fails closed without COCKROACH_DATABASE_URL", async () => {
  const resolved = await resolveAgentCliProductionRuntime({
    env: {},
    now: () => "2026-05-31T00:00:00.000Z",
  });

  deepEqual(resolved, {
    ok: false,
    message: "COCKROACH_DATABASE_URL is required for production observe-act CLI dispatch",
  });
});

test("runAgentCliMain routes selected command slots through supplied production runtime", async () => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const commands: string[] = [];
  const events: OrgEvent[] = [];

  const exitCode = await runAgentCliMain({
    argv: [
      "observe",
      "--hat",
      "release_operator",
      "--scope",
      RunScope.WorkItem,
      "--phase",
      RunLifecyclePhase.AwaitingGate,
      "--run-id",
      "1",
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
      "--gate-approved",
      "--select-index",
      "4",
    ],
    env: {},
    now: () => "2026-05-31T00:00:00.000Z",
    writeStdout: (text) => {
      stdout.push(text);
    },
    writeStderr: (text) => {
      stderr.push(text);
    },
    runtime: {
      runCommand: async (commandType) => {
        commands.push(commandType);
        return { status: "accepted" };
      },
      dispatchTool: async () => ({ outcome: "feedback", feedback: { reason: "unused", message: "unused" } }),
      appendObserveActTick: async (event) => {
        events.push(event);
      },
      availableSecretScopes: ["github:write"],
      shutdown: async () => undefined,
    } as AgentCliMainRuntime & { appendObserveActTick: (event: OrgEvent) => Promise<void> },
  });

  equal(exitCode, 0);
  deepEqual(commands, [ObserveCommandType.LifecycleTransition]);
  equal(stderr.join(""), "");
  ok(stdout.join("").includes("action: dispatched command"));
  equal(events.length, 1);
  equal(events[0]?.kind, OrgEventKind.ObserveActTick);
  ok(events[0]?.evidenceRefs.some((ref) => ref.startsWith("observe-act:menu_hash:")));
  ok(events[0]?.evidenceRefs.includes("observe-act:selected_slot:4"));
  ok(events[0]?.evidenceRefs.includes("observe-act:selected_impl:command"));
  ok(events[0]?.evidenceRefs.includes("observe-act:action_outcome:dispatched"));
});

test("runAgentCliMain reports malformed env JSON as typed setup feedback instead of throwing", async () => {
  const stderr: string[] = [];
  let shutdowns = 0;

  const exitCode = await runAgentCliMain({
    argv: ["observe", "--hat", "release_operator", "--scope", RunScope.WorkItem],
    env: { AGENTIC_ORG_PROMPT_FLOW_TASKS_JSON: "{" },
    now: () => "2026-05-31T00:00:00.000Z",
    writeStdout: () => undefined,
    writeStderr: (text) => {
      stderr.push(text);
    },
    runtime: {
      runCommand: async () => ({ status: "accepted" }),
      dispatchTool: async () => ({ status: "unused" }),
      shutdown: async () => {
        shutdowns += 1;
      },
    },
  });

  equal(exitCode, 2);
  equal(shutdowns, 1);
  ok(stderr.join("").includes("agent CLI setup failed:"));
});

test("runAgentCliMain reports production runtime bootstrap failures as typed setup feedback", async () => {
  const stderr: string[] = [];

  const exitCode = await runAgentCliMain({
    argv: ["observe", "--hat", "release_operator", "--scope", RunScope.WorkItem],
    env: { COCKROACH_DATABASE_URL: "postgresql://root@127.0.0.1:1/defaultdb?sslmode=disable" },
    now: () => "2026-05-31T00:00:00.000Z",
    writeStdout: () => undefined,
    writeStderr: (text) => {
      stderr.push(text);
    },
  });

  equal(exitCode, 2);
  ok(stderr.join("").includes("agent CLI setup failed:"));
});

test("runAgentCliMain persists control-bypass rejection evidence", async () => {
  const events: OrgEvent[] = [];

  const exitCode = await runAgentCliMain({
    argv: [
      "observe",
      "--hat",
      "release_operator",
      "--scope",
      RunScope.WorkItem,
      "--phase",
      RunLifecyclePhase.AwaitingGate,
      "--run-id",
      "4",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-release-1",
      "--organization",
      "org-1",
      "--project",
      "project-1",
      "--work-item",
      "work-control-bypass",
      "--gate-approved",
      "--select-index",
      "4",
    ],
    env: {},
    now: () => "2026-05-31T00:00:00.000Z",
    writeStdout: () => undefined,
    writeStderr: () => undefined,
    runtime: {
      runCommand: async () => ({ status: "unused" }),
      dispatchTool: async () => ({ status: "unused" }),
      authorizeSlot: async () => ({
        status: "denied",
        reason: ActRejectionReason.ControlPlaneDenied,
        message: "ESTOP active",
      }),
      appendObserveActTick: async (event) => {
        events.push(event);
      },
      shutdown: async () => undefined,
    } as AgentCliMainRuntime & { appendObserveActTick: (event: OrgEvent) => Promise<void> },
  });

  equal(exitCode, 1);
  equal(events.length, 1);
  ok(events[0]?.evidenceRefs.includes("observe-act:control_bypass_rejected:control_plane_denied:4"));
});

test("runAgentCliMain wires production control-plane authorization for prompt-flow tool secrets", async () => {
  const events: OrgEvent[] = [];
  let loadedContext = false;

  const exitCode = await runAgentCliMain({
    argv: [
      "observe",
      "--hat",
      "release_operator",
      "--scope",
      RunScope.WorkItem,
      "--phase",
      RunLifecyclePhase.AwaitingGate,
      "--run-id",
      "6",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-release-1",
      "--organization",
      "org-secret-prod",
      "--project",
      "project-1",
      "--work-item",
      "work-prompt-flow-secret",
      "--gate-approved",
      "--select-index",
      "6",
    ],
    env: {
      AGENTIC_ORG_PROMPT_FLOW_TASKS_JSON: JSON.stringify([{
        taskId: "task-secret-context",
        workItemId: "work-prompt-flow-secret",
        title: "Load release context",
        promptFlowId: "flow-release",
        label: "load release context",
        scope: RunScope.WorkItem,
        priority: 100,
        allowedHatIds: ["release_operator"],
        directions: ["Load scoped release context."],
        toolInjections: [{ tool: "github.publish_release", requiredSecretScopes: ["github:write"] }],
        metrics: [],
        contextArtifactRefs: [],
      }]),
    },
    now: () => "2026-05-31T00:00:00.000Z",
    writeStdout: () => undefined,
    writeStderr: () => undefined,
    runtime: {
      runCommand: async () => ({ status: "unused" }),
      dispatchTool: async () => ({ status: "unused" }),
      loadPromptFlowContext: async () => {
        loadedContext = true;
        return {
          taskId: "task-secret-context",
          promptFlowId: "flow-release",
          directions: [],
          toolInjections: [],
          metrics: [],
          contextArtifacts: [],
        };
      },
      loadControlPlaneFlags: async () => [],
      availableSecretScopes: [],
      appendObserveActTick: async (event) => {
        events.push(event);
      },
      shutdown: async () => undefined,
    } as AgentCliMainRuntime & {
      appendObserveActTick: (event: OrgEvent) => Promise<void>;
      loadControlPlaneFlags: (organizationId: string, evaluatedAt: string) => Promise<readonly ControlPlaneFlag[]>;
      availableSecretScopes: readonly string[];
    },
  });

  equal(exitCode, 1);
  equal(loadedContext, false);
  equal(events.length, 1);
  ok(events[0]?.evidenceRefs.includes("observe-act:selected_slot:6"));
});

test("runAgentCliMain wires production control-plane authorization for active flags", async () => {
  const events: OrgEvent[] = [];
  let commandDispatched = false;

  const exitCode = await runAgentCliMain({
    argv: [
      "observe",
      "--hat",
      "release_operator",
      "--scope",
      RunScope.WorkItem,
      "--phase",
      RunLifecyclePhase.AwaitingGate,
      "--run-id",
      "7",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-release-1",
      "--organization",
      "org-freeze-prod",
      "--project",
      "project-1",
      "--work-item",
      "work-command-freeze",
      "--gate-approved",
      "--select-index",
      "4",
    ],
    env: {},
    now: () => "2026-05-31T00:00:00.000Z",
    writeStdout: () => undefined,
    writeStderr: () => undefined,
    runtime: {
      runCommand: async () => {
        commandDispatched = true;
        return { status: "should_not_dispatch" };
      },
      dispatchTool: async () => ({ status: "unused" }),
      loadControlPlaneFlags: async () => [{
        controlPlaneFlagId: "flag-org-freeze",
        organizationId: "org-freeze-prod",
        scope: { kind: ControlPlaneScopeKind.Organization },
        flag: ControlPlaneFlagKind.Freeze,
        reason: "operator freeze",
        setByHatId: "incident_commander",
        setAt: "2026-05-31T00:00:00.000Z",
      }],
      appendObserveActTick: async (event) => {
        events.push(event);
      },
      shutdown: async () => undefined,
    } as AgentCliMainRuntime & {
      appendObserveActTick: (event: OrgEvent) => Promise<void>;
      loadControlPlaneFlags: (organizationId: string, evaluatedAt: string) => Promise<readonly ControlPlaneFlag[]>;
    },
  });

  equal(exitCode, 1);
  equal(commandDispatched, false);
  equal(events.length, 1);
  ok(events[0]?.evidenceRefs.includes("observe-act:control_bypass_rejected:control_plane_denied:4"));
});

test("runAgentCliMain loads active production rate limits before selected prompt-flow tool dispatch", async () => {
  const events: OrgEvent[] = [];
  let loadedContext = false;

  const exitCode = await runAgentCliMain({
    argv: [
      "observe",
      "--hat",
      "release_operator",
      "--scope",
      RunScope.WorkItem,
      "--phase",
      RunLifecyclePhase.AwaitingGate,
      "--run-id",
      "8",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-release-1",
      "--organization",
      "org-rate-limit-prod",
      "--project",
      "project-1",
      "--work-item",
      "work-command-rate-limit",
      "--gate-approved",
      "--select-index",
      "6",
    ],
    env: {
      AGENTIC_ORG_PROMPT_FLOW_TASKS_JSON: JSON.stringify([{
        taskId: "task-rate-limit-context",
        workItemId: "work-command-rate-limit",
        title: "Load release context",
        promptFlowId: "flow-release-rate-limit",
        label: "load release context",
        scope: RunScope.WorkItem,
        priority: 100,
        allowedHatIds: ["release_operator"],
        directions: ["Load scoped release context."],
        toolInjections: [{ tool: "github.publish_release", requiredSecretScopes: ["github:write"] }],
        metrics: [],
        contextArtifactRefs: [],
      }]),
    },
    now: () => "2026-05-31T00:00:00.000Z",
    writeStdout: () => undefined,
    writeStderr: () => undefined,
    runtime: {
      runCommand: async () => ({ status: "unused" }),
      dispatchTool: async () => ({ status: "unused" }),
      loadPromptFlowContext: async () => {
        loadedContext = true;
        return {
          taskId: "task-rate-limit-context",
          promptFlowId: "flow-release-rate-limit",
          directions: [],
          toolInjections: [],
          metrics: [],
          contextArtifacts: [],
        };
      },
      loadControlPlaneFlags: async () => [],
      loadControlPlaneRateLimits: async () => [{
        rateLimitId: "rate-limit-tools",
        organizationId: "org-rate-limit-prod",
        scope: { kind: ControlPlaneScopeKind.Tenant, tenantId: "org-rate-limit-prod" },
        kind: ControlPlaneRateLimitKind.ExternalProviderCalls,
        window: {
          startedAt: "2026-05-30T23:59:00.000Z",
          endsAt: "2026-05-31T00:01:00.000Z",
        },
        limit: 1,
        used: 1,
      }],
      availableSecretScopes: ["github:write"],
      appendObserveActTick: async (event) => {
        events.push(event);
      },
      shutdown: async () => undefined,
    } as AgentCliMainRuntime & {
      appendObserveActTick: (event: OrgEvent) => Promise<void>;
      loadControlPlaneFlags: (organizationId: string, evaluatedAt: string) => Promise<readonly ControlPlaneFlag[]>;
      loadControlPlaneRateLimits: (
        organizationId: string,
        evaluatedAt: string,
      ) => Promise<readonly ControlPlaneRateLimit[]>;
      availableSecretScopes: readonly string[];
    },
  });

  equal(exitCode, 1);
  equal(loadedContext, false);
  equal(events.length, 1);
  ok(events[0]?.evidenceRefs.includes("observe-act:control_bypass_rejected:control_plane_denied:6"));
});

test("runAgentCliMain loads prompt-flow context and persists observe-act tick evidence", async () => {
  const stdout: string[] = [];
  const events: OrgEvent[] = [];

  const exitCode = await runAgentCliMain({
    argv: [
      "observe",
      "--hat",
      "release_operator",
      "--scope",
      RunScope.WorkItem,
      "--phase",
      RunLifecyclePhase.AwaitingGate,
      "--run-id",
      "2",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-release-1",
      "--organization",
      "org-1",
      "--project",
      "project-1",
      "--work-item",
      "work-prompt-flow",
      "--gate-approved",
      "--select-index",
      "6",
    ],
    env: {
      AGENTIC_ORG_PROMPT_FLOW_TASKS_JSON: JSON.stringify([{
        taskId: "task-context",
        workItemId: "work-prompt-flow",
        title: "Load implementation context",
        promptFlowId: "flow-code-change",
        label: "load context",
        scope: RunScope.WorkItem,
        priority: 100,
        allowedHatIds: ["release_operator"],
        directions: ["Read the scoped implementation plan."],
        toolInjections: [],
        metrics: [{ id: "flow.ready", label: "flow ready", value: true }],
        contextArtifactRefs: ["artifact:plan"],
      }]),
    },
    now: () => "2026-05-31T00:00:00.000Z",
    writeStdout: (text) => {
      stdout.push(text);
    },
    writeStderr: () => undefined,
    runtime: {
      runCommand: async () => ({ status: "unused" }),
      dispatchTool: async () => ({ status: "unused" }),
      loadPromptFlowContext: async (request) => ({
        taskId: request.taskId,
        promptFlowId: request.promptFlowId,
        directions: request.directions,
        toolInjections: request.toolInjections,
        metrics: request.metrics,
        contextArtifacts: [{ id: "artifact:plan", label: "Plan", value: "phase plan" }],
      }),
      appendObserveActTick: async (event) => {
        events.push(event);
      },
      shutdown: async () => undefined,
    } as AgentCliMainRuntime & { appendObserveActTick: (event: OrgEvent) => Promise<void> },
  });

  equal(exitCode, 0);
  ok(stdout.join("").includes("action: loaded context task-context"));
  equal(events.length, 1);
  ok(events[0]?.evidenceRefs.includes("observe-act:selected_slot:6"));
  ok(events[0]?.evidenceRefs.includes("observe-act:prompt_flow:flow-code-change"));
});

test("runAgentCliMain persists glass-halo status evidence", async () => {
  const stdout: string[] = [];
  const events: OrgEvent[] = [];

  const exitCode = await runAgentCliMain({
    argv: [
      "observe",
      "--hat",
      "release_operator",
      "--scope",
      RunScope.WorkItem,
      "--phase",
      RunLifecyclePhase.AwaitingGate,
      "--run-id",
      "5",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-release-1",
      "--organization",
      "org-1",
      "--project",
      "project-1",
      "--work-item",
      "work-status",
      "--gate-approved",
      "--select-index",
      "13",
    ],
    env: {
      AGENTIC_ORG_PROMPT_FLOW_TASKS_JSON: JSON.stringify([{
        taskId: "task-status",
        workItemId: "work-status",
        title: "Load implementation context",
        promptFlowId: "flow-status",
        label: "load context",
        scope: RunScope.WorkItem,
        priority: 100,
        allowedHatIds: ["release_operator"],
        directions: ["Read the scoped implementation plan."],
        toolInjections: [],
        metrics: [],
        contextArtifactRefs: [],
      }]),
    },
    now: () => "2026-05-31T00:00:00.000Z",
    writeStdout: (text) => {
      stdout.push(text);
    },
    writeStderr: () => undefined,
    runtime: {
      runCommand: async () => {
        throw new Error("status must not dispatch command side effects");
      },
      dispatchTool: async () => {
        throw new Error("status must not dispatch MCP side effects");
      },
      appendObserveActTick: async (event) => {
        events.push(event);
      },
      shutdown: async () => undefined,
    } as AgentCliMainRuntime & { appendObserveActTick: (event: OrgEvent) => Promise<void> },
  });

  equal(exitCode, 0);
  ok(stdout.join("").includes("action: status glass_halo_status work_item awaiting_gate"));
  equal(events.length, 1);
  ok(events[0]?.evidenceRefs.includes("observe-act:selected_slot:13"));
  ok(events[0]?.evidenceRefs.includes("observe-act:status:glass_halo_status"));
  ok(events[0]?.evidenceRefs.includes("observe-act:status_scope:work_item"));
  ok(events[0]?.evidenceRefs.includes("observe-act:status_phase:awaiting_gate"));
  ok(events[0]?.evidenceRefs.includes("observe-act:prompt_flow:flow-status"));
});

test("runAgentCliMain persists selector rejection evidence from local model fallback", async () => {
  const events: OrgEvent[] = [];

  const exitCode = await runAgentCliMain({
    argv: [
      "observe",
      "--hat",
      "release_operator",
      "--scope",
      RunScope.WorkItem,
      "--phase",
      RunLifecyclePhase.AwaitingGate,
      "--run-id",
      "3",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-release-1",
      "--organization",
      "org-1",
      "--project",
      "project-1",
      "--work-item",
      "work-selector",
      "--gate-approved",
    ],
    env: {
      AGENTIC_ORG_LLM_BASE_URL: "http://ollama:11434",
      AGENTIC_ORG_LLM_MODEL: "llama3.1",
    },
    fetchImpl: (async () =>
      new Response(JSON.stringify({ message: { content: JSON.stringify({ slot: 15, reason: "try escalation" }) }, model: "llama3.1" }))) as typeof fetch,
    now: () => "2026-05-31T00:00:00.000Z",
    writeStdout: () => undefined,
    writeStderr: () => undefined,
    runtime: {
      runCommand: async () => ({ status: "accepted" }),
      dispatchTool: async () => ({ status: "unused" }),
      appendObserveActTick: async (event) => {
        events.push(event);
      },
      shutdown: async () => undefined,
    } as AgentCliMainRuntime & { appendObserveActTick: (event: OrgEvent) => Promise<void> },
  });

  equal(exitCode, 0);
  equal(events.length, 1);
  ok(events[0]?.evidenceRefs.includes("observe-act:selected_slot:4"));
  ok(events[0]?.evidenceRefs.includes("observe-act:selector_rejected:non_selectable_slot:15"));
  ok(events[0]?.evidenceRefs.includes("observe-act:selector_rejected_fallback_slot:4"));
});

test("createAgentCliMcpDispatcher dispatches in-process metrics tools and returns typed unknown-tool feedback", async () => {
  const dispatchTool = createAgentCliMcpDispatcher();
  const slot: Menu16Slot = {
    index: 0,
    direction: "commit.a",
    label: "metrics",
    availability: TriAvailability.True,
  };

  const report = await dispatchTool("analyze_source", {
    filePath: "sample.ts",
    source: "export function tiny() { return 1; }\n",
  }, slot);
  const unknown = await dispatchTool("missing_tool", {}, slot);

  equal((report as { outcome?: string }).outcome, "ok");
  deepEqual(unknown, {
    outcome: "feedback",
    feedback: {
      reason: "unknown_tool",
      message: "no metrics tool named 'missing_tool'",
    },
  });
});
