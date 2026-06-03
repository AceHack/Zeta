import { deepEqual, equal, ok, throws } from "node:assert/strict";
import { test } from "node:test";

import {
  ActionClass,
  ActRejectionReason,
  asZetaIdDecimal,
  ContextPackAdvisoryPromotionDecisionStatus,
  DEFAULT_CONTEXT_PACK_ADVISORY_PROMOTION_POLICY_VERSION,
  ContextPackAttentionLaneKind,
  ContextPackAttentionLaneRefKind,
  ContextPackFreshness,
  ContextPackInboxAnchorPriority,
  ContextPackInboxAnchorStatus,
  ContextPackInboxWorkflowActionKind,
  ContextPackInboxWorkflowBatchKind,
  ContextPackItemKind,
  ContextPackOmissionReason,
  ContextPackRefreshReason,
  ContextPackSourcePointerKind,
  ContextPackStatus,
  ContextPackCurationProfileInstruction,
  ContextPackCurationProfileId,
  PromptFlowGateKind,
  PromptFlowRunState,
  RunLifecyclePhase,
  RunScope,
  WorkClaimState,
  WorkShardState,
  contextPackAdvisoryPromotionFingerprint,
  type ContextPackAdvisoryPromotionDecision,
  type ContextPackAdvisoryPromotionPolicyRequest,
  type ContextPackBuilderPort,
  type ContextPackInboxWorkflowView,
  type ContextReadout,
  type HatWorkQueue,
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
  DocScopeKind,
  MemoryPhase,
  MemoryTier,
  ScheduleBlockState,
  ScheduleBlockType,
  SupervisorChainLevel,
  SupervisorSignalToolType,
  TenantContextPackCurationInstruction,
  TenantContextPackCurationLaneKind,
  TenantContextPackCurationProfileId,
  TenantContextPackCompletenessRequirementId,
  TenantContextPackCompletenessRequirementSetId,
  TenantContextPackSynthesisRequirementReason,
  TenantContextPackSynthesisRequirementSetId,
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

test("parseAgentCliArgs accepts typed inbox workflow action flags", () => {
  const parsed = parseAgentCliArgs([
    "observe",
    "--hat",
    "release_operator",
    "--inbox-anchor",
    "inbox-release-blocker",
    "--inbox-action",
    ContextPackInboxWorkflowActionKind.MarkRead,
  ]);

  equal(parsed.ok, true);
  if (!parsed.ok) return;
  equal(parsed.value.inboxAnchorId, "inbox-release-blocker");
  equal(parsed.value.inboxAction, ContextPackInboxWorkflowActionKind.MarkRead);
});

test("parseAgentCliArgs rejects unknown advisory-promotion decision statuses", () => {
  const parsed = parseAgentCliArgs([
    "observe",
    "--hat",
    "engineering_director",
    "--context-advisory-promotion-item",
    "synthesis-gap-owner",
    "--context-advisory-promotion-status",
    "maybe",
    "--context-advisory-promotion-blocker",
    "ownership gap blocks execution",
  ]);

  equal(parsed.ok, false);
  if (parsed.ok) return;
  ok(parsed.message.includes("unknown context advisory-promotion status 'maybe'"));
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

test("formatAgentCliScreen prints context pack status, items, omissions, contradictions, stale inputs, and blockers", () => {
  const rendered = formatAgentCliScreen({
    scope: RunScope.Project,
    phase: RunLifecyclePhase.Blocked,
    hatId: "engineering_director",
    metrics: {
      scope: RunScope.Project,
      blocks: [],
    },
    context: contextReadout(),
    slots: Array.from({ length: 16 }, (_, index) => ({
      index,
      direction: `slot.${index}`,
      label: "empty",
      availability: "N",
      reason: "no action rendered for this direction",
    })),
  });

  ok(rendered.includes("context: conflicted ctx-pack-1"));
  ok(rendered.includes("context summary: required=1 optional=1 omissions=1 contradictions=1 stale=1 blockers=1"));
  ok(rendered.includes("- required context business_document doc-brd: BRD"));
  ok(rendered.includes("- optional context memory_pointer mem-1: Prior blocker memory"));
  ok(rendered.includes("context attention lanes:"));
  ok(rendered.includes("- attention lane required_documents priority=20 required=true: Resolve against approved docs"));
  ok(rendered.includes("refs=item:doc-brd"));
  ok(rendered.includes("- attention lane memory priority=50 required=false: Use advisory memory"));
  ok(rendered.includes("refs=item:mem-1"));
  ok(rendered.includes("- attention lane omissions priority=60 required=true: Resolve visible gaps"));
  ok(rendered.includes("refs=omission:decision-redacted"));
  ok(rendered.includes("- attention lane legal_actions priority=70 required=true: Pick legal next action"));
  ok(rendered.includes("refs=legal_action:meta.escalate"));
  ok(rendered.includes("context drill targets:"));
  ok(rendered.includes("- context drill doc-brd doc_unit:doc-brd:v1 Document doc-brd"));
  ok(rendered.includes("- context drill mem-1 hindsight_memory:hindsight:mem-1 Memory mem-1 governance=work/active weight=0.81 floor=0.35"));
  ok(rendered.includes("- context omission access_denied decision-redacted: redacted by policy"));
  ok(rendered.includes("- context contradiction: BRD conflicts with stale ADR"));
  ok(rendered.includes("- context stale input: adr-old"));
  ok(rendered.includes("- context blocker: work item is blocked"));
});

test("formatAgentCliScreen prints advisory-promotion candidates with derived fingerprints", () => {
  const context = advisoryPromotionContextReadout();
  const advisoryItem = context.pack.items.find((item) => item.id === "synthesis-gap-owner");
  ok(advisoryItem);
  const fingerprint = contextPackAdvisoryPromotionFingerprint(advisoryItem);

  const rendered = formatAgentCliScreen({
    scope: RunScope.WorkItem,
    phase: RunLifecyclePhase.AwaitingReview,
    hatId: "engineering_director",
    metrics: {
      scope: RunScope.WorkItem,
      blocks: [],
    },
    context,
    slots: Array.from({ length: 16 }, (_, index) => ({
      index,
      direction: `slot.${index}`,
      label: "empty",
      availability: "N",
      reason: "no action rendered for this direction",
    })),
  });

  ok(rendered.includes("context advisory-promotion candidates:"));
  ok(rendered.includes(`- advisory promotion candidate synthesis-gap-owner profile=management_blocker fingerprint=${fingerprint.itemKind}:${fingerprint.summaryHash}`));
  ok(rendered.includes("status=unknown"));
  ok(rendered.includes("title=Owner gap"));
  ok(rendered.includes("citations=context_requirement:owner,doc:billing-brd"));
  ok(rendered.includes("sourcePointers=doc_unit:doc-brd:1"));
  ok(rendered.includes("evidence=context_requirement:owner,doc:billing-brd,synthesis-gap-owner,synthesis:gap-owner"));
  ok(rendered.includes("command=--context-advisory-promotion-item synthesis-gap-owner --context-advisory-promotion-status approved --context-advisory-promotion-blocker <text>"));
  ok(!rendered.includes("advisory promotion candidate doc-brd"));
});

test("formatAgentCliScreen prints approved advisory-promotion status from scoped decisions", () => {
  const context = advisoryPromotionContextReadout();
  const advisoryItem = context.pack.items.find((item) => item.id === "synthesis-gap-owner");
  ok(advisoryItem);
  const decision = advisoryPromotionDecisionFor(advisoryItem);

  const rendered = formatAgentCliScreen({
    scope: RunScope.WorkItem,
    phase: RunLifecyclePhase.AwaitingReview,
    hatId: "engineering_director",
    metrics: {
      scope: RunScope.WorkItem,
      blocks: [],
    },
    context,
    advisoryPromotionDecisions: [decision],
    slots: Array.from({ length: 16 }, (_, index) => ({
      index,
      direction: `slot.${index}`,
      label: "empty",
      availability: "N",
      reason: "no action rendered for this direction",
    })),
  });

  ok(rendered.includes("status=approved"));
  ok(rendered.includes("decision=decision-synthesis-gap-owner"));
  ok(rendered.includes("blocker=ownership gap blocks execution"));
});

test("formatAgentCliScreen prints not-approved advisory-promotion status when no scoped approval matches", () => {
  const context = advisoryPromotionContextReadout();
  const advisoryItem = context.pack.items.find((item) => item.id === "synthesis-gap-owner");
  ok(advisoryItem);
  const decision = {
    ...advisoryPromotionDecisionFor(advisoryItem),
    fingerprint: {
      ...contextPackAdvisoryPromotionFingerprint(advisoryItem),
      summaryHash: "different-summary",
    },
  };

  const rendered = formatAgentCliScreen({
    scope: RunScope.WorkItem,
    phase: RunLifecyclePhase.AwaitingReview,
    hatId: "engineering_director",
    metrics: {
      scope: RunScope.WorkItem,
      blocks: [],
    },
    context,
    advisoryPromotionDecisions: [decision],
    slots: Array.from({ length: 16 }, (_, index) => ({
      index,
      direction: `slot.${index}`,
      label: "empty",
      availability: "N",
      reason: "no action rendered for this direction",
    })),
  });

  ok(rendered.includes("status=not_approved"));
  ok(!rendered.includes("status=approved"));
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

test("createModelBackedMenuSelector includes bounded context pack evidence in the selector prompt", async () => {
  const prompts: ChatCompletionRequest[] = [];
  const selector = createModelBackedMenuSelector({
    chat: {
      complete: async (request) => {
        prompts.push(request);
        return { content: JSON.stringify({ slot: 4, reason: "required BRD supports execution" }), model: "llama3.1" };
      },
    },
    fallback: selectFirstTrueSlot,
  });

  const selected = await selector(menuForSelection(), {
    context: contextReadout(),
    metrics: { scope: RunScope.Project, blocks: [{ id: "queue.pressure", label: "queue pressure", value: 3 }] },
  });

  equal(selected, 4);
  ok(prompts[0]?.user.includes("Context pack: conflicted ctx-pack-1"));
  ok(prompts[0]?.user.includes("Required context:"));
  ok(prompts[0]?.user.includes("- business_document doc-brd: BRD"));
  ok(prompts[0]?.user.includes("Attention lanes:"));
  ok(prompts[0]?.user.includes("- required_documents priority=20 required=true refs=item:doc-brd objective=Resolve against approved docs"));
  ok(prompts[0]?.user.includes("- memory priority=50 required=false refs=item:mem-1 objective=Use advisory memory"));
  ok(prompts[0]?.user.includes("Attention lane details:"));
  ok(prompts[0]?.user.includes("- lane=memory item memory_pointer mem-1: Prior blocker memory"));
  ok(prompts[0]?.user.includes("- lane=omissions omission access_denied decision-redacted: redacted by policy"));
  ok(prompts[0]?.user.includes("- legal_actions priority=70 required=true refs=legal_action:meta.escalate objective=Pick legal next action"));
  ok(prompts[0]?.user.includes("Context omissions: 1"));
  ok(prompts[0]?.user.includes("Metrics:"));
  ok(prompts[0]?.user.includes("- queue pressure: 3"));
});

test("createModelBackedMenuSelector includes bounded inbox workflow evidence in the selector prompt", async () => {
  const prompts: ChatCompletionRequest[] = [];
  const selector = createModelBackedMenuSelector({
    chat: {
      complete: async (request) => {
        prompts.push(request);
        return { content: JSON.stringify({ slot: 4, reason: "urgent inbox wakeup supports execution" }), model: "llama3.1" };
      },
    },
    fallback: selectFirstTrueSlot,
  });

  const selected = await selector(menuForSelection(), {
    inboxWorkflow: contextPackInboxWorkflowView(),
  });

  equal(selected, 4);
  ok(prompts[0]?.user.includes("Inbox workflow: total=2 urgent=1 normal=0 due=0 future=1 read=0"));
  ok(prompts[0]?.user.includes("- urgent_unread inbox-release-blocker urgent/unread: Release blocker inbox actions=mark_read,snooze"));
  ok(prompts[0]?.user.includes("- snoozed_future inbox-director-review normal/snoozed until=2026-05-31T14:30:00.000Z: Director review inbox actions=mark_read"));
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
  equal(result.evidence?.vetoCount, 1);
  equal(result.evidence?.trueSlotCount, 10);
  equal(result.evidence?.metricBlockIds[0], "queue");
  ok(result.evidence?.menuHash.match(/^[0-9a-f]{64}$/));
  deepEqual(commands, [
    'observe.lifecycle_transition:{"commandId":"cmd-observe-1-4","type":"observe.lifecycle_transition","idempotencyKey":"observe:1:99:awaiting_gate:4","requestHash":"observe.lifecycle_transition:1:99:awaiting_gate:execute:executing:4","correlationId":"observe-cli-1","causationId":"observe-cli-1","traceId":"observe-cli-1","organizationId":"org-1","projectId":"project-1","workItemId":"work-1","actor":{"agentId":"agent-release-1","hatAssignmentId":"99"},"policyContext":{"toolType":"write_code"},"runId":"1","fromPhase":"awaiting_gate","actionType":"execute","toPhase":"executing","toScope":"work_item","hatAssignmentId":"99"}',
  ]);
});

test("runAgentCliCycle dispatches typed inbox workflow actions from durable workflow items", async () => {
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
      "work-visible-but-not-trusted-for-command",
      "--scope",
      RunScope.WorkItem,
      "--phase",
      RunLifecyclePhase.AwaitingGate,
      "--gate-approved",
      "--inbox-anchor",
      "inbox-release-blocker",
      "--inbox-action",
      ContextPackInboxWorkflowActionKind.MarkRead,
    ],
    now: () => "2026-05-31T12:00:00.000Z",
    writeStdout: (text) => stdout.push(text),
    loadContextPackInboxWorkflow: async () => ({
      organizationId: "org-1",
      targetHatAssignmentId: "99",
      targetAgentId: "agent-release-1",
      observedAt: "2026-05-31T12:00:00.000Z",
      summary: {
        totalVisibleCount: 1,
        urgentUnreadCount: 1,
        normalUnreadCount: 0,
        readCount: 0,
        snoozedDueCount: 0,
        snoozedFutureCount: 0,
      },
      batches: [{
        kind: ContextPackInboxWorkflowBatchKind.UrgentUnread,
        items: [{
          inboxAnchorId: "inbox-release-blocker",
          organizationId: "org-1",
          projectId: "project-1",
          teamId: "team-release",
          workItemId: "work-from-workflow-item",
          targetHatAssignmentId: "99",
          targetAgentId: "agent-release-1",
          title: "Release blocker inbox",
          summary: "Release operator wakeup was triggered by missing gate evidence.",
          priority: ContextPackInboxAnchorPriority.Urgent,
          status: ContextPackInboxAnchorStatus.Unread,
          deliveredAt: "2026-05-31T00:40:00.000Z",
          actions: [{
            kind: ContextPackInboxWorkflowActionKind.MarkRead,
            targetStatus: ContextPackInboxAnchorStatus.Read,
            requiresSnoozedUntil: false,
          }],
        }],
      }],
    }),
    runCommand: async (commandType, command) => {
      commands.push(`${commandType}:${JSON.stringify(command)}`);
      return { status: "accepted" };
    },
    dispatchTool: async () => ({ ok: true }),
  });

  equal(result.exitCode, 0);
  equal(result.actionResult?.outcome, "dispatched");
  ok(stdout.join("\n").includes("inbox workflow: total=1 urgent=1 normal=0 due=0 future=0 read=0"));
  ok(stdout.join("\n").includes("action: dispatched command"));
  deepEqual(commands, [
    `${CommandType.UpdateContextPackInboxAnchorStatus}:{"commandId":"cmd-inbox-1-inbox-release-blocker-mark_read","type":"update_context_pack_inbox_anchor_status","idempotencyKey":"observe-inbox:1:99:awaiting_gate:inbox-release-blocker:mark_read","requestHash":"update_context_pack_inbox_anchor_status:1:99:awaiting_gate:inbox-release-blocker:mark_read:read","correlationId":"observe-cli-1","causationId":"observe-cli-1","traceId":"observe-cli-1","organizationId":"org-1","projectId":"project-1","teamId":"team-release","workItemId":"work-from-workflow-item","actor":{"agentId":"agent-release-1","hatAssignmentId":"99"},"inboxAnchorId":"inbox-release-blocker","targetHatAssignmentId":"99","targetAgentId":"agent-release-1","status":"read"}`,
  ]);
});

test("runAgentCliCycle rejects inbox snooze actions without a wake time", async () => {
  const commands: string[] = [];
  const stderr: string[] = [];

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
      "--scope",
      RunScope.WorkItem,
      "--phase",
      RunLifecyclePhase.AwaitingGate,
      "--inbox-anchor",
      "inbox-release-blocker",
      "--inbox-action",
      ContextPackInboxWorkflowActionKind.Snooze,
    ],
    now: () => "2026-05-31T12:00:00.000Z",
    writeStderr: (text) => stderr.push(text),
    loadContextPackInboxWorkflow: async () => ({
      organizationId: "org-1",
      targetHatAssignmentId: "99",
      targetAgentId: "agent-release-1",
      observedAt: "2026-05-31T12:00:00.000Z",
      summary: {
        totalVisibleCount: 1,
        urgentUnreadCount: 1,
        normalUnreadCount: 0,
        readCount: 0,
        snoozedDueCount: 0,
        snoozedFutureCount: 0,
      },
      batches: [{
        kind: ContextPackInboxWorkflowBatchKind.UrgentUnread,
        items: [{
          inboxAnchorId: "inbox-release-blocker",
          organizationId: "org-1",
          projectId: "project-1",
          targetHatAssignmentId: "99",
          targetAgentId: "agent-release-1",
          title: "Release blocker inbox",
          summary: "Release operator wakeup was triggered by missing gate evidence.",
          priority: ContextPackInboxAnchorPriority.Urgent,
          status: ContextPackInboxAnchorStatus.Unread,
          deliveredAt: "2026-05-31T00:40:00.000Z",
          actions: [{
            kind: ContextPackInboxWorkflowActionKind.Snooze,
            targetStatus: ContextPackInboxAnchorStatus.Snoozed,
            requiresSnoozedUntil: true,
          }],
        }],
      }],
    }),
    runCommand: async (commandType, command) => {
      commands.push(`${commandType}:${JSON.stringify(command)}`);
      return { status: "accepted" };
    },
    dispatchTool: async () => ({ ok: true }),
  });

  equal(result.exitCode, 1);
  equal(result.actionResult?.outcome, "rejected");
  ok(stderr.join("").includes("agent CLI inbox workflow action failed: --inbox-snoozed-until is required for snooze"));
  deepEqual(commands, []);
});

test("runAgentCliCycle renders tenant curation authoring preview without dispatching work", async () => {
  const commands: string[] = [];
  const stdout: string[] = [];

  const result = await runAgentCliCycle({
    argv: [
      "observe",
      "--hat",
      "engineering_director",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-director",
      "--organization",
      "org-lfg",
      "--project",
      "project-billing",
      "--team",
      "team-platform",
      "--work-item",
      "work-billing",
      "--scope",
      RunScope.WorkItem,
      "--phase",
      RunLifecyclePhase.Blocked,
      "--context-curation-preview",
      "--context-curation-profile",
      TenantContextPackCurationProfileId.SecurityControl,
      "--context-required-lane",
      TenantContextPackCurationLaneKind.Memory,
      "--context-lane-priority",
      `${TenantContextPackCurationLaneKind.LegalActions}=6`,
      "--context-deterministic-instruction",
      TenantContextPackCurationInstruction.SecurityControl,
      "--context-block-inherited-instructions",
    ],
    now: () => "2026-06-01T00:00:00.000Z",
    writeStdout: (text) => stdout.push(text),
    runCommand: async (commandType, command) => {
      commands.push(`${commandType}:${JSON.stringify(command)}`);
      return { status: "accepted" };
    },
    dispatchTool: async () => ({ ok: true }),
  });

  const rendered = stdout.join("\n");
  equal(result.exitCode, 0);
  equal(result.actionResult?.outcome, "rejected");
  deepEqual(commands, []);
  ok(rendered.includes("tenant context-pack curation authoring:"));
  ok(rendered.includes("- profile security_control focus=security_control docs=policy,adr,decision_record,architecture,runbook terms=credential proxy,least privilege,policy,audit evidence,decision"));
  ok(rendered.includes("- lane memory defaultPriority=50 required=false objective=Use scoped memory only as advisory color after source-of-truth context."));
  ok(rendered.includes("tenant curation preview: profile=security_control focus=security_control policy="));
  ok(rendered.includes("tenant curation preview docs: policy,adr,decision_record,architecture,runbook"));
  ok(rendered.includes("tenant curation preview query: credential proxy,least privilege,policy,audit evidence,decision"));
  ok(rendered.includes("- preview lane legal_actions priority=6"));
  ok(rendered.includes("- preview required lane memory"));
  ok(rendered.includes(`- preview instruction ${ContextPackCurationProfileInstruction.SecurityControl}`));
});

test("runAgentCliCycle renders tenant completeness authoring preview without dispatching work", async () => {
  const commands: string[] = [];
  const stdout: string[] = [];

  const result = await runAgentCliCycle({
    argv: [
      "observe",
      "--hat",
      "release_manager",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-release-manager",
      "--organization",
      "org-lfg",
      "--project",
      "project-release",
      "--work-item",
      "work-release",
      "--scope",
      RunScope.WorkItem,
      "--phase",
      RunLifecyclePhase.AwaitingReview,
      "--context-completeness-preview",
      "--context-completeness-set",
      TenantContextPackCompletenessRequirementSetId.ReleaseReadinessCore,
    ],
    now: () => "2026-06-01T00:00:00.000Z",
    writeStdout: (text) => stdout.push(text),
    runCommand: async (commandType, command) => {
      commands.push(`${commandType}:${JSON.stringify(command)}`);
      return { status: "accepted" };
    },
    dispatchTool: async () => ({ ok: true }),
  });

  const rendered = stdout.join("\n");
  equal(result.exitCode, 0);
  equal(result.actionResult?.outcome, "rejected");
  deepEqual(commands, []);
  ok(rendered.includes("tenant context-pack completeness authoring:"));
  ok(rendered.includes("- completeness set release_readiness_core requirements=release_deployment_evidence:evidence:active_scope,release_readiness_meeting:meeting:active_scope"));
  ok(rendered.includes(`- completeness preview omission context_requirement:${TenantContextPackCompletenessRequirementId.ReleaseDeploymentEvidence} not_indexed: release deployment evidence is required`));
  ok(rendered.includes(`- completeness preview omission context_requirement:${TenantContextPackCompletenessRequirementId.ReleaseReadinessMeeting} not_indexed: release readiness meeting notes are required`));
  ok(rendered.includes("- completeness preview blocker release deployment evidence is required"));
  ok(rendered.includes("- completeness preview blocker release readiness meeting notes are required"));
  ok(rendered.includes("- completeness preview evidence context_policy:tenant_release_readiness_core:v1"));
});

test("runAgentCliCycle renders tenant synthesis-requirement authoring preview without dispatching work", async () => {
  const commands: string[] = [];
  const stdout: string[] = [];

  const result = await runAgentCliCycle({
    argv: [
      "observe",
      "--hat",
      "release_manager",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-release-manager",
      "--organization",
      "org-lfg",
      "--project",
      "project-release",
      "--work-item",
      "work-release",
      "--scope",
      RunScope.WorkItem,
      "--phase",
      RunLifecyclePhase.AwaitingReview,
      "--context-synthesis-preview",
      "--context-synthesis-set",
      TenantContextPackSynthesisRequirementSetId.ReleaseReadinessCore,
    ],
    now: () => "2026-06-01T00:00:00.000Z",
    writeStdout: (text) => stdout.push(text),
    runCommand: async (commandType, command) => {
      commands.push(`${commandType}:${JSON.stringify(command)}`);
      return { status: "accepted" };
    },
    dispatchTool: async () => ({ ok: true }),
  });

  const rendered = stdout.join("\n");
  equal(result.exitCode, 0);
  equal(result.actionResult?.outcome, "rejected");
  deepEqual(commands, []);
  ok(rendered.includes("tenant context-pack synthesis-requirement authoring:"));
  ok(rendered.includes(`- synthesis set release_readiness_core requirements=tenant_release_readiness_model_briefing:${TenantContextPackSynthesisRequirementReason.TenantRequiresReleaseReadinessBriefing} phases=awaiting_review scopes=work_item,project`));
  ok(rendered.includes(`tenant synthesis preview: decision=required reason=${TenantContextPackSynthesisRequirementReason.TenantRequiresReleaseReadinessBriefing} policy=`));
});

test("runAgentCliCycle dispatches advisory-promotion decisions from visible synthesis gap items", async () => {
  const commands: { commandType: string; command: Record<string, unknown> }[] = [];
  const stdout: string[] = [];
  const stderr: string[] = [];
  const context = advisoryPromotionContextReadout();
  const advisoryItem = context.pack.items.find((item) => item.id === "synthesis-gap-owner");
  ok(advisoryItem);

  const result = await runAgentCliCycle({
    argv: [
      "observe",
      "--hat",
      "engineering_director",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-director",
      "--organization",
      "org-lfg",
      "--project",
      "project-billing",
      "--team",
      "team-platform",
      "--work-item",
      "work-billing",
      "--scope",
      RunScope.WorkItem,
      "--phase",
      RunLifecyclePhase.AwaitingReview,
      "--context-advisory-promotion-item",
      advisoryItem.id,
      "--context-advisory-promotion-status",
      ContextPackAdvisoryPromotionDecisionStatus.Approved,
      "--context-advisory-promotion-blocker",
      "ownership gap blocks execution",
    ],
    now: () => "2026-06-01T00:00:00.000Z",
    contextPackBuilder: { build: async () => ({ pack: context.pack }) },
    writeStdout: (text) => stdout.push(text),
    writeStderr: (text) => stderr.push(text),
    runCommand: async (commandType, command) => {
      commands.push({ commandType, command: command as Record<string, unknown> });
      return { status: "accepted" };
    },
    dispatchTool: async () => ({ ok: true }),
  });

  equal(result.exitCode, 0, stderr.join(""));
  equal(result.actionResult?.outcome, "dispatched");
  equal(commands.length, 1);
  equal(commands[0]?.commandType, CommandType.AuthorContextPackAdvisoryPromotionDecision);
  equal(commands[0]?.command.type, CommandType.AuthorContextPackAdvisoryPromotionDecision);
  equal(commands[0]?.command.hatId, "engineering_director");
  equal(commands[0]?.command.hatAssignmentId, "99");
  equal(commands[0]?.command.curationProfileId, ContextPackCurationProfileId.ManagementBlocker);
  equal(commands[0]?.command.status, ContextPackAdvisoryPromotionDecisionStatus.Approved);
  equal(commands[0]?.command.lifecycleBlocker, "ownership gap blocks execution");
  deepEqual(commands[0]?.command.fingerprint, contextPackAdvisoryPromotionFingerprint(advisoryItem));
  deepEqual(commands[0]?.command.evidenceRefs, [
    "context_requirement:owner",
    "doc:billing-brd",
    "synthesis-gap-owner",
    "synthesis:gap-owner",
  ]);
  ok(stdout.join("\n").includes("action: dispatched command"));
});

test("runAgentCliCycle loads scoped advisory-promotion decisions before rendering candidates", async () => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const requests: ContextPackAdvisoryPromotionPolicyRequest[] = [];
  const context = advisoryPromotionContextReadout();
  const advisoryItem = context.pack.items.find((item) => item.id === "synthesis-gap-owner");
  ok(advisoryItem);

  const result = await runAgentCliCycle({
    argv: [
      "observe",
      "--hat",
      "engineering_director",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-director",
      "--organization",
      "org-lfg",
      "--project",
      "project-billing",
      "--team",
      "team-platform",
      "--work-item",
      "work-billing",
      "--scope",
      RunScope.WorkItem,
      "--phase",
      RunLifecyclePhase.AwaitingReview,
      "--context-curation-preview",
      "--context-curation-profile",
      TenantContextPackCurationProfileId.ManagementBlocker,
    ],
    now: () => "2026-06-01T00:00:00.000Z",
    contextPackBuilder: { build: async () => ({ pack: context.pack }) },
    loadContextPackAdvisoryPromotionDecisions: async (request) => {
      requests.push(request);
      return [advisoryPromotionDecisionFor(advisoryItem)];
    },
    writeStdout: (text) => stdout.push(text),
    writeStderr: (text) => stderr.push(text),
    runCommand: async () => ({ status: "accepted" }),
    dispatchTool: async () => ({ ok: true }),
  });

  const rendered = stdout.join("\n");
  equal(result.exitCode, 0, stderr.join(""));
  equal(requests.length, 1);
  equal(requests[0]?.request.snapshot.organizationId, "org-lfg");
  equal(requests[0]?.request.snapshot.hat.id, "engineering_director");
  equal(requests[0]?.request.snapshot.hatAssignmentId, "99");
  equal(requests[0]?.request.snapshot.projectId, "project-billing");
  equal(requests[0]?.request.snapshot.teamId, "team-platform");
  equal(requests[0]?.request.snapshot.workItemId, "work-billing");
  equal(requests[0]?.curationPlan?.profileId, ContextPackCurationProfileId.ManagementBlocker);
  ok(requests[0]?.advisoryItems.some((item) => item.id === "synthesis-gap-owner"));
  ok(requests[0]?.deterministicItems.every((item) => item.kind !== ContextPackItemKind.SynthesisGapHypothesis));
  ok(rendered.includes("status=approved"));
  ok(rendered.includes("blocker=ownership gap blocks execution"));
});

test("runAgentCliCycle rejects advisory-promotion decisions for non-synthesis items", async () => {
  const commands: unknown[] = [];
  const stderr: string[] = [];
  const context = advisoryPromotionContextReadout();

  const result = await runAgentCliCycle({
    argv: [
      "observe",
      "--hat",
      "engineering_director",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-director",
      "--organization",
      "org-lfg",
      "--project",
      "project-billing",
      "--team",
      "team-platform",
      "--work-item",
      "work-billing",
      "--scope",
      RunScope.WorkItem,
      "--phase",
      RunLifecyclePhase.AwaitingReview,
      "--context-advisory-promotion-item",
      "doc-brd",
      "--context-advisory-promotion-status",
      ContextPackAdvisoryPromotionDecisionStatus.Approved,
      "--context-advisory-promotion-blocker",
      "ownership gap blocks execution",
    ],
    now: () => "2026-06-01T00:00:00.000Z",
    contextPackBuilder: { build: async () => ({ pack: context.pack }) },
    writeStderr: (text) => stderr.push(text),
    runCommand: async (commandType, command) => {
      commands.push({ commandType, command });
      return { status: "accepted" };
    },
    dispatchTool: async () => ({ ok: true }),
  });

  equal(result.exitCode, 1);
  equal(result.actionResult?.outcome, "rejected");
  deepEqual(commands, []);
  ok(stderr.join("").includes("requested advisory-promotion item is not a synthesis gap hypothesis"));
});

test("runAgentCliCycle records context pack identity and health in cycle evidence", async () => {
  const contextPackBuilder: ContextPackBuilderPort = {
    build: async (request) => ({
      pack: {
        id: "ctx-director-blocker",
        runId: request.snapshot.runId,
        scope: request.snapshot.scope,
        hatAssignmentId: request.snapshot.hatAssignmentId,
        hatId: request.snapshot.hat.id,
        generatedAt: request.observedAt,
        freshnessDeadline: "2026-05-31T12:05:00.000Z",
        sourceGraphVersion: "git-index:abc123",
        policyVersion: "context-policy:v1",
        tokenBudget: 4096,
        organizationId: request.snapshot.organizationId,
        projectId: request.snapshot.projectId,
        workItemId: request.snapshot.workItemId,
        agentId: request.snapshot.agentId,
        items: [
          {
            id: "brd-blocker",
            kind: ContextPackItemKind.BusinessDocument,
            title: "Blocker BRD",
            summary: "Defines the customer outcome blocked by this issue.",
            sourceRef: "git://docs/brd/blocker.md",
            freshness: ContextPackFreshness.Current,
            confidence: 0.97,
            required: true,
            reasons: ["required business context for blocked project work"],
          },
        ],
        omittedItemsWithReason: [
          {
            reason: ContextPackOmissionReason.NotIndexed,
            nodeId: "meeting-followup",
            message: "recent director discussion has not been indexed yet",
          },
        ],
        contradictions: ["BRD priority conflicts with an older ADR"],
        staleInputs: ["adr-old"],
        lifecycleBlockers: ["work item work-blocked is blocked"],
        curationTrace: [],
      },
    }),
  };

  const result = await runAgentCliCycle({
    argv: [
      "observe",
      "--hat",
      "engineering_director",
      "--hat-assignment",
      "77",
      "--agent",
      "agent-director-1",
      "--organization",
      "org-1",
      "--project",
      "project-1",
      "--work-item",
      "work-blocked",
      "--scope",
      "project",
      "--phase",
      "blocked",
      "--select-index",
      "13",
    ],
    now: () => "2026-05-31T12:00:00.000Z",
    contextPackBuilder,
    writeStdout: () => {},
    runCommand: async () => ({ appendedOrgEvent: "org-event-1" }),
    dispatchTool: async () => ({ ok: true }),
  });

  equal(result.exitCode, 0);
  equal(result.evidence?.contextPackId, "ctx-director-blocker");
  equal(result.evidence?.contextPackStatus, ContextPackStatus.Conflicted);
  equal(result.evidence?.contextRequiredItemCount, 1);
  equal(result.evidence?.contextOptionalItemCount, 0);
  equal(result.evidence?.contextOmissionCount, 1);
  equal(result.evidence?.contextContradictionCount, 1);
  equal(result.evidence?.contextStaleInputCount, 1);
  equal(result.evidence?.contextLifecycleBlockerCount, 1);
  deepEqual(result.evidence?.contextRequiredItemIds, ["brd-blocker"]);
  equal(result.evidence?.contextSnapshot?.pack.id, "ctx-director-blocker");
  equal(result.evidence?.contextSnapshot?.status, ContextPackStatus.Conflicted);
  equal(result.evidence?.contextSnapshot?.pack.organizationId, "org-1");
});

test("runAgentCliCycle records context refresh reason when an agent wakes with a reassigned hat", async () => {
  const latestLookups: unknown[] = [];
  let builderWakeReason: string | undefined;
  let builderPreviousPackId: string | undefined;
  const contextPackBuilder: ContextPackBuilderPort = {
    build: async (request) => {
      builderWakeReason = request.wakeContext?.reason;
      builderPreviousPackId = request.wakeContext?.previousContextPackId;
      return {
        pack: {
          id: "ctx-new-assignment",
          runId: request.snapshot.runId,
          scope: request.snapshot.scope,
          hatAssignmentId: request.snapshot.hatAssignmentId,
          hatId: request.snapshot.hat.id,
          generatedAt: request.observedAt,
          freshnessDeadline: "2026-06-02T12:05:00.000Z",
          sourceGraphVersion: "git-index:new",
          policyVersion: "context-policy:v1",
          tokenBudget: 4096,
          organizationId: request.snapshot.organizationId,
          projectId: request.snapshot.projectId,
          workItemId: request.snapshot.workItemId,
          agentId: request.snapshot.agentId,
          items: [],
          omittedItemsWithReason: [],
          contradictions: [],
          staleInputs: [],
          lifecycleBlockers: [],
          curationTrace: [],
        },
      };
    },
  };

  const result = await runAgentCliCycle({
    argv: [
      "observe",
      "--hat",
      "engineering_director",
      "--hat-assignment",
      "77",
      "--agent",
      "agent-director-1",
      "--organization",
      "org-1",
      "--project",
      "project-1",
      "--work-item",
      "work-1",
      "--scope",
      "project",
      "--phase",
      "blocked",
      "--select-index",
      "13",
    ],
    now: () => "2026-06-02T12:00:00.000Z",
    contextPackBuilder,
    loadLatestContextPackSnapshot: async (lookup) => {
      latestLookups.push(lookup);
      return {
        context: {
          ...contextReadout(),
          status: ContextPackStatus.Current,
          pack: {
            ...contextReadout().pack,
            id: "ctx-previous-assignment",
            hatAssignmentId: asZetaIdDecimal("76"),
            generatedAt: "2026-06-02T11:55:00.000Z",
            freshnessDeadline: "2026-06-02T12:05:00.000Z",
          },
        },
        recordedAt: "2026-06-02T11:55:00.000Z",
        trace: {
          traceId: "trace-previous-assignment",
          correlationId: "corr-previous-assignment",
          causationId: "cause-previous-assignment",
        },
      };
    },
    writeStdout: () => {},
    runCommand: async () => ({ appendedOrgEvent: "org-event-1" }),
    dispatchTool: async () => ({ ok: true }),
  });

  equal(result.exitCode, 0);
  deepEqual(latestLookups, [{
    organizationId: "org-1",
    agentId: "agent-director-1",
  }]);
  equal(result.evidence?.contextRefreshReason, ContextPackRefreshReason.HatAssignmentChanged);
  equal(result.evidence?.previousContextPackId, "ctx-previous-assignment");
  equal(result.evidence?.contextRefreshRequiresBuild, true);
  equal(result.evidence?.previousContextPackStatus, ContextPackStatus.Current);
  equal(builderWakeReason, ContextPackRefreshReason.HatAssignmentChanged);
  equal(builderPreviousPackId, "ctx-previous-assignment");
});

test("runAgentCliCycle fails closed when previous context-pack lookup fails", async () => {
  const stderr: string[] = [];
  const result = await runAgentCliCycle({
    argv: [
      "observe",
      "--hat",
      "engineering_director",
      "--hat-assignment",
      "77",
      "--agent",
      "agent-director-1",
      "--organization",
      "org-1",
      "--project",
      "project-1",
      "--work-item",
      "work-1",
      "--scope",
      "project",
      "--phase",
      "blocked",
      "--select-index",
      "13",
    ],
    now: () => "2026-06-02T12:00:00.000Z",
    loadLatestContextPackSnapshot: async () => {
      throw new Error("snapshot index unavailable");
    },
    writeStderr: (text) => stderr.push(text),
    runCommand: async () => ({ ok: true }),
    dispatchTool: async () => ({ ok: true }),
  });

  equal(result.exitCode, 1);
  ok(stderr.join("").includes("agent CLI context-pack previous snapshot lookup failed: snapshot index unavailable"));
});

test("runAgentCliCycle records replayable context before selector choice and action execution", async () => {
  const order: string[] = [];

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
    contextPackBuilder: { build: async () => ({ pack: matchingReleaseContextReadout().pack }) },
    recordContextPackSnapshot: async (snapshot) => {
      order.push(`snapshot:${snapshot.context.pack.id}`);
    },
    selectSlot: () => {
      order.push("selector");
      return 4;
    },
    writeStdout: () => {},
    runCommand: async () => {
      order.push("action");
      return { appendedOrgEvent: "org-event-1" };
    },
    dispatchTool: async () => ({ ok: true }),
  });

  equal(result.exitCode, 0);
  deepEqual(order, ["snapshot:ctx-release-match", "selector", "action"]);
});

test("runAgentCliCycle fails closed when replayable context cannot be recorded", async () => {
  const order: string[] = [];
  const stderr: string[] = [];

  const result = await runAgentCliCycle({
    argv: [
      "observe",
      "--hat",
      "engineering_director",
      "--hat-assignment",
      "77",
      "--agent",
      "agent-director-1",
      "--organization",
      "org-1",
      "--project",
      "project-1",
      "--work-item",
      "work-blocked",
      "--scope",
      "project",
      "--phase",
      "blocked",
    ],
    now: () => "2026-05-31T12:00:00.000Z",
    contextPackBuilder: { build: async () => ({ pack: matchingReleaseContextReadout().pack }) },
    recordContextPackSnapshot: async () => {
      order.push("snapshot");
      throw new Error("database unavailable");
    },
    selectSlot: () => {
      order.push("selector");
      return 13;
    },
    writeStdout: () => {},
    writeStderr: (text) => stderr.push(text),
    runCommand: async () => {
      order.push("action");
      return { appendedOrgEvent: "org-event-1" };
    },
    dispatchTool: async () => ({ ok: true }),
  });

  equal(result.exitCode, 1);
  deepEqual(order, ["snapshot"]);
  ok(stderr.join("").includes("agent CLI context-pack snapshot record failed: database unavailable"));
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
  const latestLookups: unknown[] = [];
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
    loadLatestContextPackSnapshot: async (lookup) => {
      latestLookups.push(lookup);
      return null;
    },
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
  deepEqual(latestLookups, [{ organizationId: "org-1", agentId: "agent-release-1" }]);
  equal(result.evidence?.contextRefreshReason, ContextPackRefreshReason.FirstHatWake);
  equal(result.evidence?.contextRefreshRequiresBuild, true);
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

test("runAgentCliCycle renders work-market queue pressure and active claim status", async () => {
  const stdout: string[] = [];

  const result = await runAgentCliCycle({
    argv: [
      "observe",
      "--hat",
      "backend_implementer",
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
      "--scope",
      "work_item",
      "--phase",
      "observing",
      "--select-index",
      "13",
    ],
    now: () => "2026-05-31T12:30:00.000Z",
    writeStdout: (text) => stdout.push(text),
    workQueues: [workMarketQueue()],
    runCommand: async () => ({ ok: true }),
    dispatchTool: async () => ({ ok: true }),
  });

  equal(result.exitCode, 0);
  const rendered = stdout.join("\n");
  ok(rendered.includes("work market: elevated"));
  ok(rendered.includes("- queue queue-backend-project-1 project:project-1 ready=1 claimed=1 stale=1"));
  ok(rendered.includes("- active claim claim-stale shard=shard-claimed owner=agent-backend-2 fence=fence-stale"));
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

test("runAgentCliCycle can select history retract/redo without dispatching side effects", async () => {
  for (const [slotIndex, label, outcome, actionLine] of [
    [10, "history.retract retract", "history_retract_requested", "action: history-retract requested history.retract selected; no ledger mutation for this tick"],
    [11, "history.redo redo", "history_redo_requested", "action: history-redo requested history.redo selected; no ledger mutation for this tick"],
  ] as const) {
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
        String(slotIndex),
      ],
      now: () => "2026-05-31T12:00:00.000Z",
      writeStdout: (text) => stdout.push(text),
      runCommand: async () => {
        throw new Error(`${label} must not dispatch command side effects`);
      },
      dispatchTool: async () => {
        throw new Error(`${label} must not dispatch MCP side effects`);
      },
    });

    equal(result.exitCode, 0);
    equal(result.actionResult?.outcome, outcome);
    ok(stdout.join("\n").includes(`[${String(slotIndex).padStart(2, "0")}] T ${label}`));
    ok(stdout.join("\n").includes(actionLine));
    equal(result.evidence?.selectedIndex, slotIndex);
  }
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

function contextReadout(): ContextReadout {
  const docUnitId = "doc-brd";
  const memoryId = "mem-1";
  const requiredItem = {
    id: docUnitId,
    kind: ContextPackItemKind.BusinessDocument,
    title: "BRD",
    summary: "Business context.",
    sourceRef: "doc:brd",
    required: true,
    freshness: ContextPackFreshness.Current,
    confidence: 1,
    reasons: ["stage-bound"],
    sourcePointers: [{
      kind: ContextPackSourcePointerKind.DocUnit,
      docUnitId,
      contentRef: "docs/project/brd.md",
      contentHash: "hash-brd",
      sourceId: "source-main",
      version: 1,
    }],
  };
  const optionalItem = {
    id: memoryId,
    kind: ContextPackItemKind.MemoryPointer,
    title: "Prior blocker memory",
    summary: "A prior blocker was resolved by staffing docs first.",
    sourceRef: "memory:1",
    required: false,
    freshness: ContextPackFreshness.Current,
    confidence: 0.7,
    reasons: ["hat-scoped recall"],
    sourcePointers: [{
      kind: ContextPackSourcePointerKind.HindsightMemory,
      providerId: "hindsight",
      memoryId,
      advisory: true,
    }],
  };
  const pack = {
    id: "ctx-pack-1",
    runId: asZetaIdDecimal("1"),
    scope: RunScope.Project,
    hatAssignmentId: asZetaIdDecimal("2"),
    hatId: "engineering_director",
    generatedAt: "2026-05-29T00:00:00.000Z",
    freshnessDeadline: "2026-05-29T00:15:00.000Z",
    sourceGraphVersion: "graph-1",
    policyVersion: "policy-1",
    tokenBudget: 2048,
    items: [requiredItem, optionalItem],
    omittedItemsWithReason: [
      {
        nodeId: "decision-redacted",
        reason: ContextPackOmissionReason.AccessDenied,
        message: "redacted by policy",
      },
    ],
    contradictions: ["BRD conflicts with stale ADR"],
    staleInputs: ["adr-old"],
    lifecycleBlockers: ["work item is blocked"],
    curationPlan: {
      lanes: [
        {
          kind: ContextPackAttentionLaneKind.Authority,
          priority: 10,
          objective: "Understand hat authority",
          required: true,
          refs: [{ kind: ContextPackAttentionLaneRefKind.ScopeAnchor, anchorRef: "hat:engineering_director" }],
        },
        {
          kind: ContextPackAttentionLaneKind.RequiredDocuments,
          priority: 20,
          objective: "Resolve against approved docs",
          required: true,
          refs: [{ kind: ContextPackAttentionLaneRefKind.Item, itemId: "doc-brd" }],
        },
        {
          kind: ContextPackAttentionLaneKind.ActiveWork,
          priority: 30,
          objective: "Anchor current work",
          required: true,
          refs: [{ kind: ContextPackAttentionLaneRefKind.ScopeAnchor, anchorRef: "project:project-1" }],
        },
        {
          kind: ContextPackAttentionLaneKind.GraphNeighborhood,
          priority: 40,
          objective: "Traverse graph context",
          required: false,
          refs: [{ kind: ContextPackAttentionLaneRefKind.ScopeAnchor, anchorRef: "graph:project-1" }],
        },
        {
          kind: ContextPackAttentionLaneKind.Memory,
          priority: 50,
          objective: "Use advisory memory",
          required: false,
          refs: [{ kind: ContextPackAttentionLaneRefKind.Item, itemId: "mem-1" }],
        },
        {
          kind: ContextPackAttentionLaneKind.LegalActions,
          priority: 70,
          objective: "Pick legal next action",
          required: true,
          refs: [{ kind: ContextPackAttentionLaneRefKind.LegalAction, actionType: "meta.escalate" }],
        },
        {
          kind: ContextPackAttentionLaneKind.Omissions,
          priority: 60,
          objective: "Resolve visible gaps",
          required: true,
          refs: [{ kind: ContextPackAttentionLaneRefKind.Omission, omissionRef: "decision-redacted" }],
        },
      ],
      deterministicInstructions: ["Rank source-of-truth docs before advisory memory"],
    },
    curationTrace: [],
  };
  return {
    status: ContextPackStatus.Conflicted,
    pack,
    requiredItems: [requiredItem],
    optionalItems: [optionalItem],
    omittedItemsWithReason: pack.omittedItemsWithReason,
    contradictions: pack.contradictions,
    staleInputs: pack.staleInputs,
    lifecycleBlockers: pack.lifecycleBlockers,
    uncertainty: {
      signalCount: 0,
      highSeverityCount: 0,
      mediumSeverityCount: 0,
      lowSeverityCount: 0,
      groups: [],
    },
    drillTargetGroups: [
      {
        itemId: docUnitId,
        itemKind: ContextPackItemKind.BusinessDocument,
        itemTitle: "BRD",
        targets: [{
          targetKind: ContextPackSourcePointerKind.DocUnit,
          targetId: docUnitId,
          routeRef: "doc_unit:doc-brd:v1",
          label: "Document doc-brd",
          sourcePointer: requiredItem.sourcePointers[0]!,
        }],
      },
      {
        itemId: memoryId,
        itemKind: ContextPackItemKind.MemoryPointer,
        itemTitle: "Prior blocker memory",
        targets: [{
          targetKind: ContextPackSourcePointerKind.HindsightMemory,
          targetId: memoryId,
          routeRef: "hindsight_memory:hindsight:mem-1",
          label: "Memory mem-1",
          sourcePointer: optionalItem.sourcePointers[0]!,
          governance: {
            tier: MemoryTier.Work,
            phase: MemoryPhase.Active,
            scope: "work-1",
            weight: 0.81,
            readFloor: 0.35,
            freshnessAt: "2026-05-29T00:00:00.000Z",
            outcome: {
              successCount: 4,
              failureCount: 1,
              inconclusiveCount: 0,
            },
            utility: {
              injectedCount: 8,
              citedCount: 6,
            },
          },
        }],
      },
    ],
    summary: {
      requiredItemCount: 1,
      optionalItemCount: 1,
      omissionCount: 1,
      contradictionCount: 1,
      staleInputCount: 1,
      lifecycleBlockerCount: 1,
      uncertaintySignalCount: 0,
    },
  };
}

function matchingReleaseContextReadout(): ContextReadout {
  const readout = contextReadout();
  const pack = {
    ...readout.pack,
    id: "ctx-release-match",
    scope: RunScope.WorkItem,
    hatAssignmentId: asZetaIdDecimal("99"),
    hatId: "release_operator",
    agentId: "agent-release-1",
    organizationId: "org-1",
    projectId: "project-1",
    workItemId: "work-1",
  };
  return {
    ...readout,
    pack,
  };
}

function advisoryPromotionContextReadout(): ContextReadout {
  const readout = contextReadout();
  const advisoryItem = {
    id: "synthesis-gap-owner",
    kind: ContextPackItemKind.SynthesisGapHypothesis,
    title: "Owner gap",
    summary: "The work is ready for review but no accountable owner is recorded.",
    sourceRef: "synthesis:gap-owner",
    required: false,
    freshness: ContextPackFreshness.Current,
    confidence: 0.72,
    reasons: ["grounded synthesis gap"],
    citationRefs: ["doc:billing-brd", "context_requirement:owner"],
    sourcePointers: [{
      kind: ContextPackSourcePointerKind.DocUnit,
      docUnitId: "doc-brd",
      contentRef: "docs/project/brd.md",
      contentHash: "hash-brd",
      sourceId: "source-main",
      version: 1,
      organizationId: "org-lfg",
      scopeKind: DocScopeKind.Project,
      scopeId: "project-billing",
    }],
  };
  const scopedExistingItems = readout.pack.items.map((item) => ({
    ...item,
    sourcePointers: (item.sourcePointers ?? []).map((pointer) =>
      pointer.kind === ContextPackSourcePointerKind.DocUnit
        ? {
            ...pointer,
            organizationId: "org-lfg",
            scopeKind: DocScopeKind.Project,
            scopeId: "project-billing",
          }
        : pointer
    ),
  }));
  const baseCurationPlan = readout.pack.curationPlan;
  if (baseCurationPlan === undefined) throw new Error("context readout fixture is missing curation plan");
  const pack = {
    ...readout.pack,
    id: "ctx-advisory-promotion",
    scope: RunScope.WorkItem,
    hatAssignmentId: asZetaIdDecimal("99"),
    hatId: "engineering_director",
    organizationId: "org-lfg",
    projectId: "project-billing",
    teamId: "team-platform",
    workItemId: "work-billing",
    agentId: "agent-director",
    items: [...scopedExistingItems, advisoryItem],
    curationPlan: {
      ...baseCurationPlan,
      profileId: ContextPackCurationProfileId.ManagementBlocker,
    },
  };
  return {
    ...readout,
    pack,
    optionalItems: [...readout.optionalItems, advisoryItem],
    summary: {
      ...readout.summary,
      optionalItemCount: readout.summary.optionalItemCount + 1,
    },
  };
}

function advisoryPromotionDecisionFor(
  item: ContextReadout["pack"]["items"][number],
): ContextPackAdvisoryPromotionDecision {
  return {
    decisionId: `decision-${item.id}`,
    status: ContextPackAdvisoryPromotionDecisionStatus.Approved,
    policyVersion: DEFAULT_CONTEXT_PACK_ADVISORY_PROMOTION_POLICY_VERSION,
    lifecycleBlocker: "ownership gap blocks execution",
    fingerprint: contextPackAdvisoryPromotionFingerprint(item),
    evidenceRefs: ["doc:billing-brd"],
    organizationId: "org-lfg",
    hatId: "engineering_director",
    hatAssignmentId: "99",
    projectId: "project-billing",
    teamId: "team-platform",
    workItemId: "work-billing",
    curationProfileId: ContextPackCurationProfileId.ManagementBlocker,
  };
}

function contextPackInboxWorkflowView(): ContextPackInboxWorkflowView {
  return {
    organizationId: "org-1",
    targetHatAssignmentId: "99",
    targetAgentId: "agent-release-1",
    observedAt: "2026-05-31T12:00:00.000Z",
    summary: {
      totalVisibleCount: 2,
      urgentUnreadCount: 1,
      normalUnreadCount: 0,
      readCount: 0,
      snoozedDueCount: 0,
      snoozedFutureCount: 1,
    },
    batches: [
      {
        kind: ContextPackInboxWorkflowBatchKind.UrgentUnread,
        items: [{
          inboxAnchorId: "inbox-release-blocker",
          organizationId: "org-1",
          projectId: "project-1",
          teamId: "team-release",
          workItemId: "work-1",
          targetHatAssignmentId: "99",
          targetAgentId: "agent-release-1",
          title: "Release blocker inbox",
          summary: "Release operator wakeup was triggered by missing gate evidence.",
          priority: ContextPackInboxAnchorPriority.Urgent,
          status: ContextPackInboxAnchorStatus.Unread,
          deliveredAt: "2026-05-31T00:40:00.000Z",
          actions: [
            {
              kind: ContextPackInboxWorkflowActionKind.MarkRead,
              targetStatus: ContextPackInboxAnchorStatus.Read,
              requiresSnoozedUntil: false,
            },
            {
              kind: ContextPackInboxWorkflowActionKind.Snooze,
              targetStatus: ContextPackInboxAnchorStatus.Snoozed,
              requiresSnoozedUntil: true,
            },
          ],
        }],
      },
      {
        kind: ContextPackInboxWorkflowBatchKind.SnoozedFuture,
        items: [{
          inboxAnchorId: "inbox-director-review",
          organizationId: "org-1",
          projectId: "project-1",
          targetHatAssignmentId: "99",
          targetAgentId: "agent-release-1",
          title: "Director review inbox",
          summary: "Director requested a later review of the release decision.",
          priority: ContextPackInboxAnchorPriority.Normal,
          status: ContextPackInboxAnchorStatus.Snoozed,
          deliveredAt: "2026-05-31T00:45:00.000Z",
          snoozedUntil: "2026-05-31T14:30:00.000Z",
          actions: [{
            kind: ContextPackInboxWorkflowActionKind.MarkRead,
            targetStatus: ContextPackInboxAnchorStatus.Read,
            requiresSnoozedUntil: false,
          }],
        }],
      },
    ],
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
