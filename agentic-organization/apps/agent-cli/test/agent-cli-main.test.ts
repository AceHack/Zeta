import { deepEqual, equal, ok } from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  ActRejectionReason,
  ControlPlaneFlagKind,
  ControlPlaneRateLimitKind,
  ControlPlaneScopeKind,
  ObserveCommandType,
  RunLifecyclePhase,
  RunScope,
  TriAvailability,
  WorkClaimState,
  WorkShardState,
  type ControlPlaneFlag,
  type ControlPlaneRateLimit,
  type HatWorkQueue,
  type Menu16Slot,
} from "../../../packages/application/src/index.ts";
import { OrgEventKind, type OrgEvent } from "../../../packages/domain/src/index.ts";
import {
  createAgentCliMcpDispatcher,
  resolveAgentCliProductionRuntime,
  runAgentCliMain,
  type AgentCliMainRuntime,
} from "../src/agent-cli-main.ts";

test("package metadata exposes observe-act as the production CLI entrypoint", async () => {
  const packageJsonUrl = new URL("../../../package.json", import.meta.url);
  const packageJson = JSON.parse(await readFile(fileURLToPath(packageJsonUrl), "utf8")) as {
    scripts?: Record<string, string>;
    bin?: Record<string, string>;
    engines?: Record<string, string>;
  };
  const mainEntrypointUrl = new URL("../src/main.ts", import.meta.url);
  const mainEntrypoint = await readFile(fileURLToPath(mainEntrypointUrl), "utf8");

  equal(packageJson.scripts?.["agent:observe"], "node --experimental-strip-types apps/agent-cli/src/main.ts");
  equal(packageJson.bin?.["agentic-org-observe"], "./apps/agent-cli/src/main.ts");
  equal(packageJson.engines?.node, ">=22.12.0");
  ok(mainEntrypoint.startsWith("#!/usr/bin/env -S node --experimental-strip-types\n"));
});

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

test("runAgentCliMain loads work-market queues from env and renders queue pressure", async () => {
  const stdout: string[] = [];

  const exitCode = await runAgentCliMain({
    argv: [
      "observe",
      "--hat",
      "backend_implementer",
      "--scope",
      RunScope.WorkItem,
      "--phase",
      RunLifecyclePhase.Observing,
      "--run-id",
      "7",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-backend-1",
      "--organization",
      "org-1",
      "--project",
      "project-1",
      "--work-item",
      "work-1",
      "--select-index",
      "13",
    ],
    env: {
      AGENTIC_ORG_WORK_MARKET_QUEUES_JSON: JSON.stringify([workMarketQueue()]),
    },
    now: () => "2026-05-31T12:30:00.000Z",
    writeStdout: (text) => {
      stdout.push(text);
    },
    writeStderr: () => undefined,
    runtime: {
      runCommand: async () => ({ status: "unused" }),
      dispatchTool: async () => ({ status: "unused" }),
      shutdown: async () => undefined,
    },
  });

  equal(exitCode, 0);
  const rendered = stdout.join("\n");
  ok(rendered.includes("work market: elevated"));
  ok(rendered.includes("- active claim claim-stale shard=shard-claimed owner=agent-backend-2 fence=fence-stale"));
});

test("runAgentCliMain rejects malformed work-market review state as typed setup feedback", async () => {
  const stderr: string[] = [];
  let shutdowns = 0;

  const exitCode = await runAgentCliMain({
    argv: [
      "observe",
      "--hat",
      "backend_implementer",
      "--scope",
      RunScope.WorkItem,
      "--phase",
      RunLifecyclePhase.Observing,
      "--select-index",
      "13",
    ],
    env: {
      AGENTIC_ORG_WORK_MARKET_QUEUES_JSON: JSON.stringify([{ ...workMarketQueue(), reviews: "not-array" }]),
    },
    now: () => "2026-05-31T12:30:00.000Z",
    writeStdout: () => undefined,
    writeStderr: (text) => {
      stderr.push(text);
    },
    runtime: {
      runCommand: async () => ({ status: "unused" }),
      dispatchTool: async () => ({ status: "unused" }),
      shutdown: async () => {
        shutdowns += 1;
      },
    },
  });

  equal(exitCode, 2);
  equal(shutdowns, 1);
  ok(stderr.join("").includes("work-market queue reviews must be an array"));
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

function workMarketQueue(overrides: Partial<HatWorkQueue> = {}): HatWorkQueue {
  return {
    queueId: "queue-backend-project-1",
    organizationId: "org-1",
    hatId: "backend_implementer",
    scope: { kind: "project", id: "project-1" },
    priorityClass: "high",
    slaDeadlineAt: "2026-05-31T14:00:00.000Z",
    shardability: "by_component",
    requiredSkills: ["typescript"],
    reviewQuorum: {
      requiredApprovals: 1,
      reviewerHatIds: ["architect_reviewer"],
      allowProducerApproval: false,
    },
    shards: [
      {
        shardId: "shard-ready",
        workItemId: "work-ready",
        title: "Ready shard",
        priority: 80,
        state: WorkShardState.Ready,
        dependencyShardIds: [],
        mergePolicy: "independent",
      },
      {
        shardId: "shard-claimed",
        workItemId: "work-claimed",
        title: "Claimed shard",
        priority: 90,
        state: WorkShardState.Claimed,
        dependencyShardIds: [],
        mergePolicy: "independent",
        claimedByClaimId: "claim-stale",
      },
    ],
    claims: [
      {
        claimId: "claim-stale",
        shardId: "shard-claimed",
        ownerAgentId: "agent-backend-2",
        hatAssignmentId: "hat-backend-2",
        fencingToken: "fence-stale",
        leaseExpiresAt: "2026-05-31T12:00:00.000Z",
        heartbeatAt: "2026-05-31T11:55:00.000Z",
        scheduleBlockId: "block-1",
        runtimeSessionId: "session-1",
        workspaceRef: "worktree:agent-backend-2",
        credentialScope: "tenant:org-1:repo:agentic-organization",
        compensatingAction: "release_claim_and_requeue_shard",
        state: WorkClaimState.Active,
        claimedAt: "2026-05-31T11:45:00.000Z",
      },
    ],
    runtimeLeases: [],
    reviews: [],
    ...overrides,
  };
}
