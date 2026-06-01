import { createHash } from "node:crypto";

import {
  act,
  ActionClass,
  ActRejectionReason,
  asZetaIdDecimal,
  buildHatDefinitions,
  compilePromptFlowTasks,
  createTelemetryScopedMetricAgents,
  lintPromptFlowDefinition,
  rejectAct,
  type DeterministicRule,
  observeAgentSurface,
  ObserveCommandType,
  ObserveOutcome,
  PromptFlowGateKind,
  PromptFlowRunState,
  RunLifecyclePhase,
  RunScope,
  TriAvailability,
  type ActDependencies,
  type ActResult,
  type AgentObserveSnapshot,
  type ChatCompletionPort,
  type ChatCompletionResult,
  type HierarchyInitiative,
  type HierarchyMission,
  type HierarchyMissionMilestone,
  type HierarchyProject,
  type HierarchyReadout,
  type HierarchySnapshot,
  type HierarchyWorkBatch,
  type HierarchyWorkItem,
  type LifecycleTransitionCommandPayload,
  type Menu16,
  type Menu16Slot,
  type MetricBlock,
  type GlassHaloStatusSignal,
  type PromptFlowContext,
  type PromptFlowContextArtifact,
  type PromptFlowContextRequest,
  type PromptFlowDefinition,
  type PromptFlowPhaseDefinition,
  type PromptFlowPhaseGate,
  type PromptFlowReadout,
  type PromptFlowRun,
  type PromptFlowTask,
  type PromptFlowToolInjection,
  type ScopedMetricAgent,
  type ScopedReadout,
} from "../../../packages/application/src/index.ts";
import { CommandType, HatLevel, ToolBundle, type ToolBundle as ToolBundleName, type WorkScheduleBlock } from "../../../packages/domain/src/index.ts";
import { createLgtmTelemetryQueryPort } from "../../../packages/observability/src/index.ts";
import { createOllamaChatPort } from "../../workers/src/adapters/ollama-chat-port.ts";

export type ParsedAgentCliArgs = {
  command: "observe";
  hatId: string;
  scope: RunScope;
  phase: RunLifecyclePhase;
  runId: string;
  hatAssignmentId: string;
  agentId: string;
  organizationId: string;
  projectId: string;
  teamId?: string | undefined;
  workItemId: string;
  supervisorHatAssignmentId?: string | undefined;
  gateApproved: boolean;
  evidence: boolean;
  promptFlowPage?: number;
  selectIndex?: number;
};

export type ParseAgentCliArgsResult =
  | { ok: true; value: ParsedAgentCliArgs }
  | { ok: false; message: string };

type AgentCliZetaIdDecimal = ReturnType<typeof asZetaIdDecimal>;

type ParseAgentCliZetaIdResult =
  | { ok: true; value: AgentCliZetaIdDecimal }
  | { ok: false; message: string };

export type AgentCliScreen = {
  scope: RunScope;
  phase: RunLifecyclePhase;
  hatId: string;
  metrics: ScopedReadout;
  promptFlows?: PromptFlowReadout;
  page?: Menu16["page"];
  hierarchy?: HierarchyReadout;
  slots: readonly Pick<Menu16Slot, "index" | "direction" | "label" | "availability" | "reason">[];
};

export type AgentCliCycleInput = ActDependencies & {
  argv: readonly string[];
  now: () => string;
  writeStdout?: (text: string) => void;
  writeStderr?: (text: string) => void;
  metricAgents?: readonly ScopedMetricAgent[];
  promptFlowTasks?: readonly PromptFlowTask[];
  hierarchy?: HierarchySnapshot;
  scheduleBlocks?: readonly WorkScheduleBlock[];
  deterministicRules?: readonly DeterministicRule[];
  availableSecretScopes?: readonly string[];
  selectSlot?: MenuSelector;
};

export type CreateAgentCliMetricAgentsFromEnvInput = {
  env: Readonly<Record<string, string | undefined>>;
  now: () => string;
  fetchImpl?: typeof fetch;
};

export type CreateAgentCliPromptFlowTasksFromEnvInput = {
  env: Readonly<Record<string, string | undefined>>;
};

export type CreateAgentCliHierarchyFromEnvInput = {
  env: Readonly<Record<string, string | undefined>>;
};

export type AgentCliEnvLoadErrorSource = "prompt_flow_tasks" | "hierarchy";

export type AgentCliEnvLoadResult<T> =
  | { ok: true; value: T }
  | { ok: false; source: AgentCliEnvLoadErrorSource; message: string };

export const SelectorRejectionReason = {
  ModelError: "model_error",
  ParseFailure: "parse_failure",
  SlotOutOfRange: "slot_out_of_range",
  NonSelectableSlot: "non_selectable_slot",
} as const;

export type SelectorRejectionReason = (typeof SelectorRejectionReason)[keyof typeof SelectorRejectionReason];

export type MenuSelectorRejection = {
  reason: SelectorRejectionReason;
  fallbackIndex: number;
  rawOutput?: string | undefined;
  rejectedIndex?: number | undefined;
};

export type MenuSelectionResult = {
  index: number;
  reason: string;
  selectorRejection?: MenuSelectorRejection | undefined;
};

export type MenuSelectorOutput = number | MenuSelectionResult;

export type MenuSelector = (menu: Menu16) => Promise<MenuSelectorOutput> | MenuSelectorOutput;

export type CreateModelBackedMenuSelectorInput = {
  chat: ChatCompletionPort;
  fallback: MenuSelector;
};

export type CreateAgentCliSelectorFromEnvInput = {
  env: Readonly<Record<string, string | undefined>>;
  fetchImpl?: typeof fetch;
};

export type AgentCliCycleResult = {
  exitCode: number;
  actionResult?: ActResult;
  evidence?: AgentCliCycleEvidence;
};

export type AgentCliCycleEvidence = {
  menuHash: string;
  selectedIndex: number;
  vetoCount: number;
  trueSlotCount: number;
  statusSignalKind?: GlassHaloStatusSignal["kind"] | undefined;
  statusScope?: RunScope | undefined;
  statusPhase?: RunLifecyclePhase | undefined;
  statusHierarchyPriorityScope?: HierarchyReadout["priorityScope"] | undefined;
  selectedCommandType?: string | undefined;
  promptFlowPage?: number | undefined;
  selectedPromptFlowTaskId?: string | undefined;
  selectedPromptFlowId?: string | undefined;
  reobservePromptFlowPage?: number | undefined;
  promptFlowIds: readonly string[];
  metricBlockIds: readonly string[];
  selectorRejections: readonly MenuSelectorRejection[];
  actionRejectionReason?: ActRejectionReason | undefined;
};

export function parseAgentCliArgs(argv: readonly string[]): ParseAgentCliArgsResult {
  if (argv[0] !== "observe") {
    return { ok: false, message: "usage: observe --hat <id> --scope <run|work_item|initiative|project|organization>" };
  }

  const values = parseFlags(argv.slice(1));
  if (!values.ok) return values;

  const hatId = values.flags.get("hat");
  if (hatId === undefined || hatId.length === 0) {
    return { ok: false, message: "missing required --hat <id>" };
  }

  const scope = parseRunScope(values.flags.get("scope") ?? RunScope.Run);
  if (scope === undefined) {
    return { ok: false, message: `unknown scope '${values.flags.get("scope")}'` };
  }

  const phase = parseRunLifecyclePhase(values.flags.get("phase") ?? RunLifecyclePhase.Observing);
  if (phase === undefined) {
    return { ok: false, message: `unknown phase '${values.flags.get("phase")}'` };
  }

  const runId = values.flags.get("run-id") ?? "1";
  const hatAssignmentId = values.flags.get("hat-assignment") ?? "1";
  const agentId = values.flags.get("agent") ?? "agent-local";
  const organizationId = values.flags.get("organization") ?? "org-local";
  const projectId = values.flags.get("project") ?? "project-local";
  const teamId = values.flags.get("team");
  const workItemId = values.flags.get("work-item") ?? runId;
  const supervisorHatAssignmentId = values.flags.get("supervisor-hat-assignment");
  const selectIndexValue = values.flags.get("select-index");
  const selectIndex = selectIndexValue === undefined ? undefined : Number.parseInt(selectIndexValue, 10);
  if (selectIndexValue !== undefined && (!Number.isInteger(selectIndex) || String(selectIndex) !== selectIndexValue)) {
    return { ok: false, message: `--select-index must be an integer, got '${selectIndexValue}'` };
  }
  const promptFlowPageValue = values.flags.get("prompt-flow-page");
  const promptFlowPage = promptFlowPageValue === undefined ? undefined : Number.parseInt(promptFlowPageValue, 10);
  if (promptFlowPageValue !== undefined) {
    if (!Number.isInteger(promptFlowPage) || String(promptFlowPage) !== promptFlowPageValue || (promptFlowPage ?? -1) < 0) {
      return { ok: false, message: `--prompt-flow-page must be a non-negative integer, got '${promptFlowPageValue}'` };
    }
  }

  return {
    ok: true,
    value: {
      command: "observe",
      hatId,
      scope,
      phase,
      runId,
      hatAssignmentId,
      agentId,
      organizationId,
      projectId,
      ...(teamId === undefined ? {} : { teamId }),
      workItemId,
      ...(supervisorHatAssignmentId === undefined ? {} : { supervisorHatAssignmentId }),
      gateApproved: values.booleans.has("gate-approved"),
      evidence: values.booleans.has("evidence"),
      ...createOptionalPromptFlowPage(promptFlowPageValue === undefined ? undefined : promptFlowPage),
      ...createOptionalSelectIndex(selectIndexValue === undefined ? undefined : selectIndex),
    },
  };
}

export function selectFirstTrueSlot(menu: Menu16): number {
  const selectable = menu.slots.filter((slot) => slot.availability === TriAvailability.True);
  return selectable.find((slot) => !slot.direction.startsWith("navigate."))?.index
    ?? selectable[0]?.index
    ?? -1;
}

export function formatAgentCliScreen(screen: AgentCliScreen): string {
  return [
    "observe",
    `scope: ${screen.scope}`,
    `phase: ${screen.phase}`,
    `hat: ${screen.hatId}`,
    "metrics:",
    ...formatMetricBlocks(screen.metrics.blocks),
    "prompt flows:",
    ...formatPromptFlowTasks(screen.promptFlows),
    ...formatMenuPage(screen.page),
    ...formatHierarchy(screen.hierarchy),
    "menu:",
    ...screen.slots.map(formatSlot),
  ].join("\n");
}

export function createAgentCliMetricAgentsFromEnv(
  input: CreateAgentCliMetricAgentsFromEnvInput,
): readonly ScopedMetricAgent[] {
  const mimirBaseUrl = input.env.AGENTIC_ORG_MIMIR_BASE_URL;
  const tempoBaseUrl = input.env.AGENTIC_ORG_TEMPO_BASE_URL;
  const lokiBaseUrl = input.env.AGENTIC_ORG_LOKI_BASE_URL;
  if (mimirBaseUrl === undefined || tempoBaseUrl === undefined || lokiBaseUrl === undefined) {
    return [];
  }

  const createTelemetryQueryPort: unknown = createLgtmTelemetryQueryPort;
  if (typeof createTelemetryQueryPort !== "function") {
    throw new Error("observability telemetry query port factory is unavailable");
  }

  const telemetry = (createTelemetryQueryPort as typeof createLgtmTelemetryQueryPort)({
    mimirBaseUrl,
    tempoBaseUrl,
    lokiBaseUrl,
    ...createOptionalFetchImpl(input.fetchImpl),
  });

  return createTelemetryScopedMetricAgents({
    telemetry,
    range: {
      start: input.env.AGENTIC_ORG_TELEMETRY_RANGE_START ?? oneHourBefore(input.now()),
      end: input.env.AGENTIC_ORG_TELEMETRY_RANGE_END ?? input.now(),
    },
  });
}

export function createAgentCliPromptFlowTasksFromEnv(
  input: CreateAgentCliPromptFlowTasksFromEnvInput,
): readonly PromptFlowTask[] {
  const compiled = compileAgentCliPromptFlowTasksFromEnv(input);
  const raw = input.env.AGENTIC_ORG_PROMPT_FLOW_TASKS_JSON;
  if (raw === undefined || raw.trim().length === 0) {
    return compiled;
  }
  const parsed = parseJsonEnv(raw, "AGENTIC_ORG_PROMPT_FLOW_TASKS_JSON");
  if (!Array.isArray(parsed)) {
    throw new Error("AGENTIC_ORG_PROMPT_FLOW_TASKS_JSON must be a JSON array");
  }
  return [
    ...compiled,
    ...parsed.map(parsePromptFlowTask),
  ];
}

export function tryCreateAgentCliPromptFlowTasksFromEnv(
  input: CreateAgentCliPromptFlowTasksFromEnvInput,
): AgentCliEnvLoadResult<readonly PromptFlowTask[]> {
  try {
    return { ok: true, value: createAgentCliPromptFlowTasksFromEnv(input) };
  } catch (error) {
    return {
      ok: false,
      source: "prompt_flow_tasks",
      message: extractErrorMessage(error),
    };
  }
}

export function createAgentCliHierarchyFromEnv(
  input: CreateAgentCliHierarchyFromEnvInput,
): HierarchySnapshot {
  const raw = input.env.AGENTIC_ORG_HIERARCHY_JSON;
  if (raw === undefined || raw.trim().length === 0) {
    return { projects: [], initiatives: [] };
  }
  const parsed = parseJsonEnv(raw, "AGENTIC_ORG_HIERARCHY_JSON");
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("AGENTIC_ORG_HIERARCHY_JSON must be a JSON object");
  }
  const candidate = parsed as Record<string, unknown>;
  return {
    projects: parseHierarchyProjects(candidate.projects),
    initiatives: parseHierarchyInitiatives(candidate.initiatives),
    workBatches: parseOptionalHierarchyWorkBatches(candidate.workBatches),
    workItems: parseOptionalHierarchyWorkItems(candidate.workItems),
    missions: parseOptionalHierarchyMissions(candidate.missions),
  };
}

export function tryCreateAgentCliHierarchyFromEnv(
  input: CreateAgentCliHierarchyFromEnvInput,
): AgentCliEnvLoadResult<HierarchySnapshot> {
  try {
    return { ok: true, value: createAgentCliHierarchyFromEnv(input) };
  } catch (error) {
    return {
      ok: false,
      source: "hierarchy",
      message: extractErrorMessage(error),
    };
  }
}

export function createModelBackedMenuSelector(input: CreateModelBackedMenuSelectorInput): MenuSelector {
  return async (menu) => {
    const selectable = menu.slots.filter((slot) => slot.availability === TriAvailability.True);
    if (selectable.length === 0) {
      return await input.fallback(menu);
    }

    let completion: ChatCompletionResult;
    try {
      completion = await input.chat.complete({
        system:
          "You are selecting from a deterministic 16-slot agent controller. Reply with only one selectable integer slot index and no prose.",
        user: buildMenuSelectorPrompt(selectable),
      });
    } catch {
      const fallback = normalizeMenuSelectionResult(await input.fallback(menu), "fallback_after_model_error");
      return {
        index: fallback.index,
        reason: "fallback_after_selector_rejection",
        selectorRejection: {
          reason: SelectorRejectionReason.ModelError,
          fallbackIndex: fallback.index,
        },
      };
    }

    const rawOutput = completionContent(completion);
    const parsed = parseModelSelectedIndex(rawOutput, menu);
    if (parsed.ok) return parsed.index;

    const fallback = normalizeMenuSelectionResult(await input.fallback(menu), "fallback_after_selector_rejection");
    return {
      index: fallback.index,
      reason: "fallback_after_selector_rejection",
      selectorRejection: {
        reason: parsed.reason,
        rawOutput,
        fallbackIndex: fallback.index,
        ...createOptionalRejectedIndex(parsed.rejectedIndex),
      },
    };
  };
}

export function createAgentCliSelectorFromEnv(input: CreateAgentCliSelectorFromEnvInput): MenuSelector {
  const baseUrl = input.env.AGENTIC_ORG_LLM_BASE_URL;
  const model = input.env.AGENTIC_ORG_LLM_MODEL;
  if (baseUrl === undefined || model === undefined) {
    return selectFirstTrueSlot;
  }

  return createModelBackedMenuSelector({
    chat: createOllamaChatPort({
      baseUrl,
      model,
      ...createOptionalFetchImpl(input.fetchImpl),
    }),
    fallback: selectFirstTrueSlot,
  });
}

export async function runAgentCliCycle(input: AgentCliCycleInput): Promise<AgentCliCycleResult> {
  const parsed = parseAgentCliArgs(input.argv);
  if (!parsed.ok) {
    input.writeStderr?.(`${parsed.message}\n`);
    return { exitCode: 2 };
  }

  const hats = buildHatDefinitions();
  const hat = hats.find((candidate) => candidate.id === parsed.value.hatId);
  if (hat === undefined) {
    input.writeStderr?.(`unknown hat '${parsed.value.hatId}'\n`);
    return { exitCode: 2 };
  }

  const runId = parseAgentCliZetaId(parsed.value.runId, "--run-id");
  if (!runId.ok) {
    input.writeStderr?.(`${runId.message}\n`);
    return { exitCode: 2 };
  }

  const hatAssignmentId = parseAgentCliZetaId(parsed.value.hatAssignmentId, "--hat-assignment");
  if (!hatAssignmentId.ok) {
    input.writeStderr?.(`${hatAssignmentId.message}\n`);
    return { exitCode: 2 };
  }

  const snapshot: AgentObserveSnapshot = {
    runId: runId.value,
    scope: parsed.value.scope,
    phase: parsed.value.phase,
    trace: {
      correlationId: `observe-cli-${parsed.value.runId}`,
      causationId: `observe-cli-${parsed.value.runId}`,
      traceId: `observe-cli-${parsed.value.runId}`,
    },
    hasGateApproval: parsed.value.gateApproved,
    hasEvidence: parsed.value.evidence,
    hatAssignmentId: hatAssignmentId.value,
    hat,
    agentId: parsed.value.agentId,
    organizationId: parsed.value.organizationId,
    projectId: parsed.value.projectId,
    ...(parsed.value.teamId === undefined ? {} : { teamId: parsed.value.teamId }),
    workItemId: parsed.value.workItemId,
    ...(parsed.value.supervisorHatAssignmentId === undefined ? {} : { supervisorHatAssignmentId: parsed.value.supervisorHatAssignmentId }),
  };

  const observed = await observeAgentSurface(snapshot, {
    clock: { now: input.now },
    ...createOptionalDeterministicRules(input.deterministicRules),
    ...createOptionalMetricAgents(input.metricAgents),
    ...createOptionalPromptFlowTasks(input.promptFlowTasks),
    ...createOptionalPromptFlowPage(parsed.value.promptFlowPage),
    ...createOptionalHierarchy(input.hierarchy),
    ...createOptionalScheduleBlocks(input.scheduleBlocks),
    ...createOptionalAvailableSecretScopes(input.availableSecretScopes),
  });
  if (observed.outcome === ObserveOutcome.Feedback) {
    input.writeStderr?.(`${observed.feedback.message}\n`);
    return { exitCode: 1 };
  }

  input.writeStdout?.(`${formatAgentCliScreen({
    scope: parsed.value.scope,
    phase: parsed.value.phase,
    hatId: parsed.value.hatId,
    metrics: observed.metrics,
    promptFlows: observed.promptFlows,
    page: observed.actions.page,
    hierarchy: observed.hierarchy,
    slots: observed.actions.slots,
  })}\n`);

  const selection = parsed.value.selectIndex === undefined
    ? normalizeMenuSelectionResult(
      await (input.selectSlot?.(observed.actions) ?? selectFirstTrueSlot(observed.actions)),
      "selector_selected",
    )
    : {
        index: parsed.value.selectIndex,
        reason: "cli_select_index",
      };
  const selectedIndex = selection.index;
  if (!observed.actions.slots.some((slot) => slot.availability === TriAvailability.True)) {
    const actionResult = rejectAct(
      ActRejectionReason.NoSelectableSlot,
      "no TriAvailability.True slots in rendered menu",
    );
    const evidence = createAgentCliCycleEvidence(observed.actions, selection, observed.promptFlows, observed.metrics, actionResult);
    input.writeStdout?.(`action: ${formatActResult(actionResult)}\n`);
    return { exitCode: 1, actionResult, evidence };
  }
  const actionResult = await act(selectedIndex, observed.actions, {
    runCommand: async (commandType, command, slot) =>
      await input.runCommand(commandType, materializeCommand(commandType, command, slot, parsed.value), slot),
    dispatchTool: input.dispatchTool,
    loadPromptFlowContext: input.loadPromptFlowContext ?? loadPromptFlowContextFromRequest,
    ...createOptionalSlotAuthorizer(input.authorizeSlot),
  });
  input.writeStdout?.(`action: ${formatActResult(actionResult)}\n`);
  if (actionResult.outcome === "loaded_context") {
    input.writeStdout?.(`${formatPromptFlowContext(actionResult.context)}\n`);
  }
  return {
    exitCode: actionResult.outcome === "rejected" ? 1 : 0,
    actionResult,
    evidence: createAgentCliCycleEvidence(observed.actions, selection, observed.promptFlows, observed.metrics, actionResult),
  };
}

async function loadPromptFlowContextFromRequest(
  request: PromptFlowContextRequest,
): Promise<PromptFlowContext> {
  return {
    taskId: request.taskId,
    promptFlowId: request.promptFlowId,
    directions: request.directions,
    toolInjections: request.toolInjections,
    metrics: request.metrics,
    contextArtifacts: request.contextArtifactRefs.map((ref): PromptFlowContextArtifact => ({
      id: ref,
      label: ref,
      value: ref,
    })),
    ...copyPromptFlowRequestMetadata(request),
  };
}

function createOptionalScheduleBlocks(
  scheduleBlocks: readonly WorkScheduleBlock[] | undefined,
): { scheduleBlocks?: readonly WorkScheduleBlock[] } {
  return scheduleBlocks === undefined ? {} : { scheduleBlocks };
}

function createOptionalAvailableSecretScopes(
  availableSecretScopes: readonly string[] | undefined,
): { availableSecretScopes?: readonly string[] } {
  return availableSecretScopes === undefined ? {} : { availableSecretScopes };
}

function createOptionalSlotAuthorizer(
  authorizeSlot: AgentCliCycleInput["authorizeSlot"],
): Pick<ActDependencies, "authorizeSlot"> {
  return authorizeSlot === undefined ? {} : { authorizeSlot };
}

function materializeCommand(
  commandType: string,
  command: unknown,
  slot: Menu16Slot,
  args: ParsedAgentCliArgs,
): unknown {
  if (commandType !== ObserveCommandType.LifecycleTransition || !isLifecycleTransitionPayload(command)) {
    if (commandType === CommandType.SendSupervisorSignal && isSupervisorSignalPayload(command)) {
      return {
        commandId: `cmd-observe-${args.runId}-${slot.index}`,
        type: CommandType.SendSupervisorSignal,
        idempotencyKey: `observe:${args.runId}:${args.hatAssignmentId}:${args.phase}:${slot.index}`,
        requestHash: [
          CommandType.SendSupervisorSignal,
          args.runId,
          args.hatAssignmentId,
          args.phase,
          slot.index,
          command.targetHatAssignmentId,
        ].join(":"),
        correlationId: `observe-cli-${args.runId}`,
        causationId: `observe-cli-${args.runId}`,
        traceId: `observe-cli-${args.runId}`,
        organizationId: args.organizationId,
        projectId: args.projectId,
        workItemId: args.workItemId,
        actor: {
          agentId: args.agentId,
          hatAssignmentId: args.hatAssignmentId,
        },
        ...command,
      };
    }
    return command;
  }

  return {
    commandId: `cmd-observe-${args.runId}-${slot.index}`,
    type: ObserveCommandType.LifecycleTransition,
    idempotencyKey: `observe:${args.runId}:${args.hatAssignmentId}:${args.phase}:${slot.index}`,
    requestHash: [
      ObserveCommandType.LifecycleTransition,
      args.runId,
      args.hatAssignmentId,
      args.phase,
      command.actionType,
      command.toPhase,
      slot.index,
    ].join(":"),
    correlationId: `observe-cli-${args.runId}`,
    causationId: `observe-cli-${args.runId}`,
    traceId: `observe-cli-${args.runId}`,
    organizationId: args.organizationId,
    projectId: args.projectId,
    workItemId: args.workItemId,
    actor: {
      agentId: args.agentId,
      hatAssignmentId: args.hatAssignmentId,
    },
    ...createOptionalObserveLifecyclePolicyContext(command.actionType),
    ...command,
  };
}

function createOptionalObserveLifecyclePolicyContext(actionType: string): { policyContext?: { toolType: ActionClass } } {
  const toolType = ACTION_CLASS_FOR_OBSERVE_LIFECYCLE[actionType];
  return toolType === undefined ? {} : { policyContext: { toolType } };
}

const ACTION_CLASS_FOR_OBSERVE_LIFECYCLE: Readonly<Record<string, ActionClass>> = {
  execute: ActionClass.WriteCode,
  request_review: ActionClass.ReviewCode,
  complete: ActionClass.ApproveReview,
  rework: ActionClass.WriteCode,
  resume: ActionClass.WriteCode,
};

function createAgentCliCycleEvidence(
  menu: Menu16,
  selection: MenuSelectionResult,
  promptFlows: PromptFlowReadout,
  metrics: ScopedReadout,
  actionResult?: ActResult | undefined,
): AgentCliCycleEvidence {
  return {
    menuHash: hashMenu(menu),
    selectedIndex: selection.index,
    vetoCount: menu.slots.filter((slot) => slot.availability === TriAvailability.False).length,
    trueSlotCount: menu.slots.filter((slot) => slot.availability === TriAvailability.True).length,
    ...selectedStatusEvidence(actionResult),
    ...selectedCommandEvidence(menu, selection.index),
    ...createOptionalEvidenceNumber("promptFlowPage", menu.page?.promptFlows?.page),
    ...selectedPromptFlowEvidence(menu, selection.index),
    ...(actionResult?.outcome === "reobserve" ? createOptionalEvidenceNumber("reobservePromptFlowPage", actionResult.menuPage?.promptFlows) : {}),
    promptFlowIds: uniqueSorted([
      ...promptFlows.tasks.map((task) => task.promptFlowId),
      ...promptFlows.vetoedTasks.map((vetoed) => vetoed.task.promptFlowId),
    ]),
    metricBlockIds: uniqueSorted(metrics.blocks.map((block) => block.id)),
    selectorRejections: selection.selectorRejection === undefined ? [] : [selection.selectorRejection],
    ...(actionResult?.outcome === "rejected" ? { actionRejectionReason: actionResult.reason } : {}),
  };
}

function hashMenu(menu: Menu16): string {
  const stable = {
    page: menu.page ?? null,
    slots: menu.slots.map((slot) => ({
      index: slot.index,
      direction: slot.direction,
      label: slot.label,
      availability: slot.availability,
      reason: slot.reason ?? null,
      impl: stableSlotImpl(slot),
      actionType: slot.action?.actionType ?? null,
    })),
  };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

function stableSlotImpl(slot: Menu16Slot): unknown {
  switch (slot.impl?.kind) {
    case undefined:
      return null;
    case "prompt_flow":
      return {
        kind: slot.impl.kind,
        taskId: slot.impl.request.taskId,
        promptFlowId: slot.impl.request.promptFlowId,
      };
    case "observe":
      return {
        kind: slot.impl.kind,
        toScope: slot.impl.toScope,
        menuPage: slot.impl.menuPage ?? null,
      };
    case "status":
      return {
        kind: slot.impl.kind,
        statusKind: slot.impl.status.kind,
        scope: slot.impl.status.scope,
        phase: slot.impl.status.phase,
        metricBlockIds: slot.impl.status.metricBlockIds,
        promptFlowIds: slot.impl.status.promptFlowIds,
        hierarchy: slot.impl.status.hierarchy ?? null,
      };
    case "command":
      return {
        kind: slot.impl.kind,
        commandType: slot.impl.commandType,
      };
    case "mcp":
      return {
        kind: slot.impl.kind,
        tool: slot.impl.tool,
      };
  }
}

function selectedStatusEvidence(
  actionResult: ActResult | undefined,
): Pick<AgentCliCycleEvidence, "statusSignalKind" | "statusScope" | "statusPhase" | "statusHierarchyPriorityScope"> {
  if (actionResult?.outcome !== "status_report") return {};
  return {
    statusSignalKind: actionResult.status.kind,
    statusScope: actionResult.status.scope,
    statusPhase: actionResult.status.phase,
    ...(actionResult.status.hierarchy === undefined ? {} : {
      statusHierarchyPriorityScope: actionResult.status.hierarchy.priorityScope,
    }),
  };
}

function selectedPromptFlowEvidence(
  menu: Menu16,
  selectedIndex: number,
): { selectedPromptFlowTaskId?: string; selectedPromptFlowId?: string } {
  const selected = menu.slots.find((slot) => slot.index === selectedIndex);
  if (selected?.impl?.kind !== "prompt_flow") return {};
  return {
    selectedPromptFlowTaskId: selected.impl.request.taskId,
    selectedPromptFlowId: selected.impl.request.promptFlowId,
  };
}

function selectedCommandEvidence(
  menu: Menu16,
  selectedIndex: number,
): { selectedCommandType?: string } {
  const selected = menu.slots.find((slot) => slot.index === selectedIndex);
  return selected?.impl?.kind === "command" ? { selectedCommandType: selected.impl.commandType } : {};
}

function createOptionalEvidenceNumber<K extends string>(
  key: K,
  value: number | undefined,
): { [P in K]?: number } {
  return value === undefined ? {} : { [key]: value } as { [P in K]?: number };
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function buildMenuSelectorPrompt(selectable: readonly Menu16Slot[]): string {
  return [
    "Selectable slots:",
    ...selectable.map((slot) => `[${String(slot.index).padStart(2, "0")}] ${slot.direction} ${slot.label}`),
    "Reply with one slot index from the list above. Do not explain.",
  ].join("\n");
}

function completionContent(completion: ChatCompletionResult): string {
  return typeof completion === "string" ? completion : completion.content;
}

function parseModelSelectedIndex(
  raw: string,
  menu: Menu16,
): { ok: true; index: number } | { ok: false; reason: SelectorRejectionReason; rejectedIndex?: number | undefined } {
  const normalized = raw.trim();
  const match = /^(?:\[(\d{1,2})\]|(\d{1,2}))$/.exec(normalized);
  if (match === null) {
    return { ok: false, reason: SelectorRejectionReason.ParseFailure };
  }
  const index = Number.parseInt((match[1] ?? match[2])!, 10);
  if (index < 0 || index >= 16) {
    return { ok: false, reason: SelectorRejectionReason.SlotOutOfRange, rejectedIndex: index };
  }
  const slot = menu.slots.find((candidate) => candidate.index === index);
  if (slot?.availability !== TriAvailability.True) {
    return { ok: false, reason: SelectorRejectionReason.NonSelectableSlot, rejectedIndex: index };
  }
  return { ok: true, index };
}

function normalizeMenuSelectionResult(
  output: MenuSelectorOutput,
  defaultReason: string,
): MenuSelectionResult {
  return typeof output === "number" ? { index: output, reason: defaultReason } : output;
}

function createOptionalRejectedIndex(
  rejectedIndex: number | undefined,
): { rejectedIndex?: number } {
  return rejectedIndex === undefined ? {} : { rejectedIndex };
}

function isLifecycleTransitionPayload(value: unknown): value is LifecycleTransitionCommandPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<Record<keyof LifecycleTransitionCommandPayload, unknown>>;
  return (
    typeof candidate.runId === "string" &&
    typeof candidate.fromPhase === "string" &&
    typeof candidate.actionType === "string" &&
    typeof candidate.toPhase === "string" &&
    typeof candidate.toScope === "string"
  );
}

function isSupervisorSignalPayload(
  value: unknown,
): value is {
  targetHatAssignmentId: string;
  title: string;
  message: string;
  policyContext: unknown;
} {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.targetHatAssignmentId === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.message === "string" &&
    typeof candidate.policyContext === "object" &&
    candidate.policyContext !== null
  );
}

function parseFlags(args: readonly string[]): { ok: true; flags: Map<string, string>; booleans: Set<string> } | { ok: false; message: string } {
  const flags = new Map<string, string>();
  const booleans = new Set<string>();
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === "--gate-approved" || token === "--evidence") {
      booleans.add(token.slice(2));
      continue;
    }
    if (token?.startsWith("--") !== true) {
      return { ok: false, message: `unexpected argument '${token}'` };
    }
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) {
      return { ok: false, message: `missing value for ${token}` };
    }
    flags.set(token.slice(2), value);
    index += 1;
  }
  return { ok: true, flags, booleans };
}

function parseRunScope(value: string): RunScope | undefined {
  return Object.values(RunScope).includes(value as RunScope) ? (value as RunScope) : undefined;
}

function parseRunLifecyclePhase(value: string): RunLifecyclePhase | undefined {
  return Object.values(RunLifecyclePhase).includes(value as RunLifecyclePhase)
    ? (value as RunLifecyclePhase)
    : undefined;
}

function createOptionalSelectIndex(selectIndex: number | undefined): { selectIndex?: number } {
  return selectIndex === undefined ? {} : { selectIndex };
}

function createOptionalPromptFlowPage(promptFlowPage: number | undefined): { promptFlowPage?: number } {
  return promptFlowPage === undefined ? {} : { promptFlowPage };
}

function createOptionalMetricAgents(
  metricAgents: readonly ScopedMetricAgent[] | undefined,
): { metricAgents?: readonly ScopedMetricAgent[] } {
  return metricAgents === undefined ? {} : { metricAgents };
}

function createOptionalPromptFlowTasks(
  promptFlowTasks: readonly PromptFlowTask[] | undefined,
): { promptFlowTasks?: readonly PromptFlowTask[] } {
  return promptFlowTasks === undefined ? {} : { promptFlowTasks };
}

function createOptionalHierarchy(
  hierarchy: HierarchySnapshot | undefined,
): { hierarchy?: HierarchySnapshot } {
  return hierarchy === undefined ? {} : { hierarchy };
}

function createOptionalDeterministicRules(
  deterministicRules: readonly DeterministicRule[] | undefined,
): { deterministicRules?: readonly DeterministicRule[] } {
  return deterministicRules === undefined ? {} : { deterministicRules };
}

function createOptionalFetchImpl(fetchImpl: typeof fetch | undefined): { fetchImpl?: typeof fetch } {
  return fetchImpl === undefined ? {} : { fetchImpl };
}

function oneHourBefore(iso: string): string {
  return new Date(Date.parse(iso) - 60 * 60 * 1000).toISOString();
}

function formatMetricBlocks(blocks: readonly MetricBlock[]): readonly string[] {
  if (blocks.length === 0) {
    return ["- no scoped metrics"];
  }
  return blocks.map((block) => `- ${block.label}: ${block.value}${block.unit ?? ""}`);
}

function formatPromptFlowTasks(promptFlows: PromptFlowReadout | undefined): readonly string[] {
  if (promptFlows === undefined || (promptFlows.tasks.length === 0 && promptFlows.vetoedTasks.length === 0)) {
    return ["- no prompt-flow tasks"];
  }
  return [
    ...promptFlows.tasks.map((task) => `- ${task.taskId} ${task.promptFlowId} ${task.label}`),
    ...promptFlows.vetoedTasks.map((vetoed) => `- ${vetoed.task.taskId} ${vetoed.task.promptFlowId} ${vetoed.task.label} (${vetoed.reason})`),
  ];
}

function formatMenuPage(page: Menu16["page"] | undefined): readonly string[] {
  if (page?.promptFlows === undefined) return [];
  return [`prompt-flow page: ${page.promptFlows.page + 1}/${page.promptFlows.pageCount}`];
}

function formatHierarchy(hierarchy: HierarchyReadout | undefined): readonly string[] {
  if (hierarchy === undefined) {
    return ["hierarchy: unavailable", "- no hierarchy items"];
  }
  return [
    `hierarchy: ${hierarchy.level}`,
    `priority scope: ${hierarchy.priorityScope}`,
    ...formatHierarchyMission(hierarchy.mission),
    ...formatHierarchyProjects(hierarchy.projects),
    ...formatHierarchyInitiatives(hierarchy.initiatives),
    ...formatHierarchyMetrics(hierarchy.metrics),
    ...formatHierarchyPriorityItems(hierarchy.priorityItems),
    ...formatHierarchyScopedMetrics(hierarchy.scopedMetrics),
    ...formatHierarchyActions(hierarchy.actions),
    ...formatHierarchyVetoedActions(hierarchy.vetoedActions),
    ...formatHierarchyPolicyViolations(hierarchy.policyViolations),
  ];
}

function formatHierarchyMission(mission: HierarchyReadout["mission"]): readonly string[] {
  if (mission === undefined) return ["- no hierarchy mission"];
  return [
    `mission: ${mission.mission.goal}`,
    `mission timeframe: ${mission.mission.timeframe.startsAt} -> ${mission.mission.timeframe.targetAt}`,
    `mission status: ${mission.status}`,
    `mission progress: ${mission.actualProgressPercent}% actual / ${mission.expectedProgressPercent}% expected`,
    `mission days remaining: ${mission.daysRemaining}`,
    ...mission.objectives.map((objective) => `- mission objective ${objective}`),
    ...mission.nextMilestones.map((milestone) => `- mission milestone ${milestone.milestoneId} ${milestone.title} (${milestone.status})`),
    ...mission.metrics.map((metric) => `- mission metric ${metric.label}: ${metric.value}${metric.unit ?? ""}`),
    ...mission.lagSignals.map((signal) => `- mission lag ${signal.label}: ${signal.value}${signal.unit ?? ""}`),
    ...mission.correctiveActions.map((action) => `- mission corrective action ${action.kind}: ${action.label}`),
    ...mission.vetoedCorrectiveActions.map((vetoed) => `- mission corrective action veto ${vetoed.action.kind}: ${vetoed.reason}`),
  ];
}

function formatHierarchyProjects(projects: readonly HierarchyProject[]): readonly string[] {
  if (projects.length === 0) return ["- no visible projects"];
  return projects.flatMap((project) => [
    `- project ${project.projectId} ${project.name}`,
    ...project.trajectory.map((metric) => `  trajectory ${metric.label}: ${metric.value}${metric.unit ?? ""}`),
  ]);
}

function formatHierarchyInitiatives(initiatives: readonly HierarchyInitiative[]): readonly string[] {
  if (initiatives.length === 0) return ["- no visible initiatives"];
  return initiatives.map((initiative) => `- initiative ${initiative.initiativeId} ${initiative.title}`);
}

function formatHierarchyMetrics(metrics: readonly MetricBlock[]): readonly string[] {
  if (metrics.length === 0) return ["- no hierarchy metrics"];
  return metrics.map((metric) => `- hierarchy metric ${metric.label}: ${metric.value}${metric.unit ?? ""}`);
}

function formatHierarchyPriorityItems(items: HierarchyReadout["priorityItems"]): readonly string[] {
  if (items.length === 0) return ["- no hierarchy priority items"];
  return items.map((item) => `- priority ${item.kind} ${item.itemId} ${item.label}`);
}

function formatHierarchyScopedMetrics(metrics: readonly MetricBlock[]): readonly string[] {
  if (metrics.length === 0) return ["- no hierarchy scoped metrics"];
  return metrics.map((metric) => `- hierarchy scoped metric ${metric.label}: ${metric.value}${metric.unit ?? ""}`);
}

function formatHierarchyActions(actions: HierarchyReadout["actions"]): readonly string[] {
  if (actions.length === 0) return ["- no hierarchy actions"];
  return actions.map((action) => `- hierarchy action ${action.kind}: ${action.label}`);
}

function formatHierarchyVetoedActions(actions: HierarchyReadout["vetoedActions"]): readonly string[] {
  if (actions.length === 0) return ["- no hierarchy action vetoes"];
  return actions.map((vetoed) => `- hierarchy action veto ${vetoed.action.kind}: ${vetoed.reason}`);
}

function formatHierarchyPolicyViolations(violations: HierarchyReadout["policyViolations"]): readonly string[] {
  if (violations.length === 0) return ["- no hierarchy policy violations"];
  return violations.map((violation) => `- policy violation ${violation.ruleName}: ${violation.reason}`);
}

function formatPromptFlowContext(context: PromptFlowContext): string {
  return [
    ...formatPromptFlowContextMetadata(context),
    "directions:",
    ...formatStringList(context.directions),
    "tools:",
    ...formatToolInjections(context.toolInjections),
    "context metrics:",
    ...formatMetricBlocks(context.metrics),
    "context artifacts:",
    ...formatContextArtifacts(context.contextArtifacts),
  ].join("\n");
}

function copyPromptFlowRequestMetadata(request: PromptFlowContextRequest): Partial<PromptFlowContext> {
  return {
    ...(request.definitionVersion !== undefined ? { definitionVersion: request.definitionVersion } : {}),
    ...(request.phaseId !== undefined ? { phaseId: request.phaseId } : {}),
    ...(request.runState !== undefined ? { runState: request.runState } : {}),
    ...(request.permittedUniversalActions !== undefined ? { permittedUniversalActions: request.permittedUniversalActions } : {}),
    ...(request.requiredEvidenceRefs !== undefined ? { requiredEvidenceRefs: request.requiredEvidenceRefs } : {}),
    ...(request.gate !== undefined ? { gate: request.gate } : {}),
    ...(request.reviewerHatIds !== undefined ? { reviewerHatIds: request.reviewerHatIds } : {}),
    ...(request.timeoutSeconds !== undefined ? { timeoutSeconds: request.timeoutSeconds } : {}),
    ...(request.retryLimit !== undefined ? { retryLimit: request.retryLimit } : {}),
    ...(request.rollbackPolicy !== undefined ? { rollbackPolicy: request.rollbackPolicy } : {}),
  };
}

function formatPromptFlowContextMetadata(context: PromptFlowContext): readonly string[] {
  const rows: string[] = [];
  if (context.phaseId !== undefined || context.runState !== undefined) {
    rows.push(`phase: ${context.phaseId ?? "unknown"} ${context.runState ?? "unknown"}`);
  }
  if (context.requiredEvidenceRefs !== undefined) {
    rows.push("required evidence:", ...formatStringList(context.requiredEvidenceRefs));
  }
  if (context.gate !== undefined) {
    rows.push(`gate: ${context.gate.kind}`);
  }
  if (context.reviewerHatIds !== undefined) {
    rows.push("reviewers:", ...formatStringList(context.reviewerHatIds));
  }
  if (context.timeoutSeconds !== undefined) {
    rows.push(`timeout seconds: ${context.timeoutSeconds}`);
  }
  if (context.rollbackPolicy !== undefined) {
    rows.push(`rollback: ${context.rollbackPolicy.kind} ${context.rollbackPolicy.description}`);
  }
  return rows;
}

function formatStringList(values: readonly string[]): readonly string[] {
  return values.length === 0 ? ["- none"] : values.map((value) => `- ${value}`);
}

function formatToolInjections(tools: readonly PromptFlowToolInjection[]): readonly string[] {
  return tools.length === 0
    ? ["- none"]
    : tools.map((tool) => `- ${tool.tool}${tool.args === undefined ? "" : ` ${JSON.stringify(tool.args)}`}`);
}

function formatContextArtifacts(artifacts: readonly PromptFlowContextArtifact[]): readonly string[] {
  return artifacts.length === 0
    ? ["- none"]
    : artifacts.map((artifact) => `- ${artifact.label}: ${artifact.value}`);
}

function formatSlot(slot: Pick<Menu16Slot, "index" | "direction" | "label" | "availability" | "reason">): string {
  const prefix = `[${String(slot.index).padStart(2, "0")}] ${slot.availability} ${slot.direction} ${slot.label}`;
  return slot.reason === undefined ? prefix : `${prefix} (${slot.reason})`;
}

function formatActResult(result: ActResult): string {
  switch (result.outcome) {
    case "dispatched":
      return `dispatched ${result.kind}`;
    case "loaded_context":
      return `loaded context ${result.context.taskId}`;
    case "status_report":
      return `status ${result.status.kind} ${result.status.scope} ${result.status.phase}`;
    case "reobserve":
      return `reobserve ${result.scope}${result.menuPage?.promptFlows === undefined ? "" : ` prompt-flow-page ${result.menuPage.promptFlows + 1}`}`;
    case "rejected":
      return `rejected ${result.reason}: ${result.message}`;
  }
}

function compileAgentCliPromptFlowTasksFromEnv(
  input: CreateAgentCliPromptFlowTasksFromEnvInput,
): readonly PromptFlowTask[] {
  const definitionsRaw = input.env.AGENTIC_ORG_PROMPT_FLOW_DEFINITIONS_JSON;
  const runsRaw = input.env.AGENTIC_ORG_PROMPT_FLOW_RUNS_JSON;
  if ((definitionsRaw === undefined || definitionsRaw.trim().length === 0) && (runsRaw === undefined || runsRaw.trim().length === 0)) {
    return [];
  }
  if (definitionsRaw === undefined || definitionsRaw.trim().length === 0 || runsRaw === undefined || runsRaw.trim().length === 0) {
    throw new Error("AGENTIC_ORG_PROMPT_FLOW_DEFINITIONS_JSON and AGENTIC_ORG_PROMPT_FLOW_RUNS_JSON must be provided together");
  }
  const definitions = parsePromptFlowDefinitionsJson(definitionsRaw);
  const lintMessages = definitions.flatMap((definition) =>
    lintPromptFlowDefinition(definition).map((diagnostic) =>
      `${definition.promptFlowId}@${definition.version}${diagnostic.phaseId === undefined ? "" : `:${diagnostic.phaseId}`}:${diagnostic.code}`,
    ),
  );
  if (lintMessages.length > 0) {
    throw new Error(`AGENTIC_ORG_PROMPT_FLOW_DEFINITIONS_JSON failed lint: ${lintMessages.join(", ")}`);
  }
  const runs = parsePromptFlowRunsJson(runsRaw);
  const tasks = compilePromptFlowTasks({
    definitions,
    runs,
  });
  assertPromptFlowRunCompileCoverage(runs, tasks);
  return tasks;
}

function parsePromptFlowDefinitionsJson(raw: string): readonly PromptFlowDefinition[] {
  const parsed = parseJsonEnv(raw, "AGENTIC_ORG_PROMPT_FLOW_DEFINITIONS_JSON");
  if (!Array.isArray(parsed)) {
    throw new Error("AGENTIC_ORG_PROMPT_FLOW_DEFINITIONS_JSON must be a JSON array");
  }
  const definitions = parsed.map(parsePromptFlowDefinition);
  const duplicateDefinitionKeys = repeatedValues(definitions.map(promptFlowDefinitionKey));
  if (duplicateDefinitionKeys.length > 0) {
    throw new Error(`AGENTIC_ORG_PROMPT_FLOW_DEFINITIONS_JSON contains duplicate definition keys: ${duplicateDefinitionKeys.join(", ")}`);
  }
  return definitions;
}

function parsePromptFlowRunsJson(raw: string): readonly PromptFlowRun[] {
  const parsed = parseJsonEnv(raw, "AGENTIC_ORG_PROMPT_FLOW_RUNS_JSON");
  if (!Array.isArray(parsed)) {
    throw new Error("AGENTIC_ORG_PROMPT_FLOW_RUNS_JSON must be a JSON array");
  }
  const runs = parsed.map(parsePromptFlowRun);
  const duplicateRunIds = repeatedValues(runs.map((run) => run.runId));
  if (duplicateRunIds.length > 0) {
    throw new Error(`AGENTIC_ORG_PROMPT_FLOW_RUNS_JSON contains duplicate run ids: ${duplicateRunIds.join(", ")}`);
  }
  return runs;
}

function parsePromptFlowTask(value: unknown): PromptFlowTask {
  if (typeof value !== "object" || value === null) {
    throw new Error("prompt-flow task must be an object");
  }
  const candidate = value as Record<string, unknown>;
  return {
    taskId: parseRequiredString(candidate, "taskId"),
    workItemId: parseRequiredString(candidate, "workItemId"),
    title: parseRequiredString(candidate, "title"),
    promptFlowId: parseRequiredString(candidate, "promptFlowId"),
    label: parseRequiredString(candidate, "label"),
    scope: parsePromptFlowRunScope(candidate.scope),
    priority: parsePromptFlowPriority(candidate.priority),
    ...parseOptionalStringArray(candidate.allowedHatIds, "allowedHatIds"),
    ...parseOptionalActionClass(candidate.actionClass),
    ...parseOptionalRequiredToolBundles(candidate.requiredToolBundles),
    directions: parseStringArray(candidate.directions, "directions"),
    toolInjections: parseToolInjections(candidate.toolInjections),
    metrics: parseMetricBlocks(candidate.metrics),
    contextArtifactRefs: parseStringArray(candidate.contextArtifactRefs, "contextArtifactRefs"),
    ...parseOptionalPromptFlowMetadata(candidate),
  };
}

function parsePromptFlowDefinition(value: unknown): PromptFlowDefinition {
  if (typeof value !== "object" || value === null) {
    throw new Error("prompt-flow definition must be an object");
  }
  const candidate = value as Record<string, unknown>;
  const definition = {
    promptFlowId: parsePromptFlowDefinitionString(candidate, "promptFlowId"),
    version: parsePromptFlowDefinitionString(candidate, "version"),
    name: parsePromptFlowDefinitionString(candidate, "name"),
    ownerDepartmentId: parsePromptFlowDefinitionString(candidate, "ownerDepartmentId"),
    allowedHatIds: parseStringArray(candidate.allowedHatIds, "allowedHatIds"),
    requiredScope: parsePromptFlowRunScope(candidate.requiredScope),
    phases: parsePromptFlowPhases(candidate.phases),
    reviewerHatIds: parseStringArray(candidate.reviewerHatIds, "reviewerHatIds"),
    rollbackPolicy: parsePromptFlowRollbackPolicy(candidate.rollbackPolicy),
  };
  const duplicatePhaseIds = repeatedValues(definition.phases.map((phase) => phase.phaseId));
  if (duplicatePhaseIds.length > 0) {
    throw new Error(`prompt-flow definition ${promptFlowDefinitionKey(definition)} contains duplicate phase ids: ${duplicatePhaseIds.join(", ")}`);
  }
  return definition;
}

function parsePromptFlowRun(value: unknown): PromptFlowRun {
  if (typeof value !== "object" || value === null) {
    throw new Error("prompt-flow run must be an object");
  }
  const candidate = value as Record<string, unknown>;
  return {
    runId: parseRequiredString(candidate, "runId"),
    promptFlowId: parseRequiredString(candidate, "promptFlowId"),
    definitionVersion: parseRequiredString(candidate, "definitionVersion"),
    workItemId: parseRequiredString(candidate, "workItemId"),
    scope: parsePromptFlowRunScope(candidate.scope),
    currentPhaseId: parseRequiredString(candidate, "currentPhaseId"),
    state: parsePromptFlowRunState(candidate.state),
    priority: parsePromptFlowPriority(candidate.priority),
  };
}

function assertPromptFlowRunCompileCoverage(
  runs: readonly PromptFlowRun[],
  tasks: readonly PromptFlowTask[],
): void {
  const executableRunIds = new Set(
    runs
      .filter((run) => isExecutablePromptFlowRunState(run.state))
      .map((run) => run.runId),
  );
  for (const task of tasks) {
    executableRunIds.delete(task.taskId);
  }
  if (executableRunIds.size > 0) {
    throw new Error(`AGENTIC_ORG_PROMPT_FLOW_RUNS_JSON failed compile coverage: ${[...executableRunIds].sort().join(", ")}`);
  }
}

function isExecutablePromptFlowRunState(state: PromptFlowRunState): boolean {
  return (
    state === PromptFlowRunState.Created ||
    state === PromptFlowRunState.ContextLoaded ||
    state === PromptFlowRunState.RunningPhase ||
    state === PromptFlowRunState.AwaitingGate
  );
}

function parsePromptFlowPhases(value: unknown): readonly PromptFlowPhaseDefinition[] {
  if (!Array.isArray(value)) {
    throw new Error("prompt-flow definition phases must be an array");
  }
  return value.map(parsePromptFlowPhaseDefinition);
}

function parsePromptFlowPhaseDefinition(value: unknown): PromptFlowPhaseDefinition {
  if (typeof value !== "object" || value === null) {
    throw new Error("prompt-flow definition phase must be an object");
  }
  const phase = value as Record<string, unknown>;
  return {
    phaseId: parsePromptFlowDefinitionString(phase, "phaseId"),
    label: parsePromptFlowDefinitionString(phase, "label"),
    ...parseOptionalActionClass(phase.actionClass),
    permittedUniversalActions: parseStringArray(phase.permittedUniversalActions, "permittedUniversalActions"),
    directions: parseStringArray(phase.directions, "directions"),
    ...parseOptionalRequiredToolBundles(phase.requiredToolBundles),
    toolInjections: parseToolInjections(phase.toolInjections),
    contextArtifactRefs: parseStringArray(phase.contextArtifactRefs, "contextArtifactRefs"),
    requiredEvidenceRefs: parseStringArray(phase.requiredEvidenceRefs, "requiredEvidenceRefs"),
    gate: parsePromptFlowGate(phase.gate),
    timeoutSeconds: parsePositiveInteger(phase.timeoutSeconds, "timeoutSeconds"),
    retryLimit: parseNonNegativeInteger(phase.retryLimit, "retryLimit"),
    ...(phase.metrics === undefined ? {} : { metrics: parseMetricBlocks(phase.metrics) }),
  };
}

function parseHierarchyProjects(value: unknown): readonly HierarchyProject[] {
  if (!Array.isArray(value)) {
    throw new Error("hierarchy projects must be an array");
  }
  return value.map((item) => {
    if (typeof item !== "object" || item === null) {
      throw new Error("hierarchy project must be an object");
    }
    const project = item as Record<string, unknown>;
    return {
      projectId: parseHierarchyRequiredString(project, "projectId"),
      organizationId: parseHierarchyRequiredString(project, "organizationId"),
      departmentId: parseHierarchyRequiredString(project, "departmentId"),
      name: parseHierarchyRequiredString(project, "name"),
      status: parseHierarchyProjectStatus(project.status),
      trajectory: parseHierarchyMetricBlocks(project.trajectory, "trajectory"),
      metrics: parseHierarchyMetricBlocks(project.metrics, "metrics"),
    };
  });
}

function parseHierarchyInitiatives(value: unknown): readonly HierarchyInitiative[] {
  if (!Array.isArray(value)) {
    throw new Error("hierarchy initiatives must be an array");
  }
  return value.map((item) => {
    if (typeof item !== "object" || item === null) {
      throw new Error("hierarchy initiative must be an object");
    }
    const initiative = item as Record<string, unknown>;
    return {
      initiativeId: parseHierarchyRequiredString(initiative, "initiativeId"),
      projectId: parseHierarchyRequiredString(initiative, "projectId"),
      organizationId: parseHierarchyRequiredString(initiative, "organizationId"),
      title: parseHierarchyRequiredString(initiative, "title"),
      status: parseHierarchyInitiativeStatus(initiative.status),
      ...parseOptionalHierarchyPriorityScore(initiative.priorityScore),
      metrics: parseHierarchyMetricBlocks(initiative.metrics, "metrics"),
    };
  });
}

function parseOptionalHierarchyWorkBatches(value: unknown): readonly HierarchyWorkBatch[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new Error("hierarchy workBatches must be an array");
  }
  return value.map((item) => {
    if (typeof item !== "object" || item === null) {
      throw new Error("hierarchy work batch must be an object");
    }
    const batch = item as Record<string, unknown>;
    return {
      batchId: parseHierarchyRequiredString(batch, "batchId"),
      projectId: parseHierarchyRequiredString(batch, "projectId"),
      initiativeId: parseHierarchyRequiredString(batch, "initiativeId"),
      organizationId: parseHierarchyRequiredString(batch, "organizationId"),
      title: parseHierarchyRequiredString(batch, "title"),
      status: parseHierarchyWorkBatchStatus(batch.status),
      ...parseOptionalHierarchyPriorityScore(batch.priorityScore),
      metrics: parseHierarchyMetricBlocks(batch.metrics, "metrics"),
    };
  });
}

function parseOptionalHierarchyWorkItems(value: unknown): readonly HierarchyWorkItem[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new Error("hierarchy workItems must be an array");
  }
  return value.map((item) => {
    if (typeof item !== "object" || item === null) {
      throw new Error("hierarchy work item must be an object");
    }
    const workItem = item as Record<string, unknown>;
    return {
      workItemId: parseHierarchyRequiredString(workItem, "workItemId"),
      projectId: parseHierarchyRequiredString(workItem, "projectId"),
      ...parseOptionalHierarchyInitiativeId(workItem.initiativeId),
      organizationId: parseHierarchyRequiredString(workItem, "organizationId"),
      title: parseHierarchyRequiredString(workItem, "title"),
      state: parseHierarchyRequiredString(workItem, "state"),
      ...parseOptionalHierarchyPriorityScore(workItem.priorityScore),
      metrics: parseHierarchyMetricBlocks(workItem.metrics, "metrics"),
    };
  });
}

function parseOptionalHierarchyMissions(value: unknown): readonly HierarchyMission[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new Error("hierarchy missions must be an array");
  }
  return value.map((item) => {
    if (typeof item !== "object" || item === null) {
      throw new Error("hierarchy mission must be an object");
    }
    const mission = item as Record<string, unknown>;
    return {
      missionId: parseHierarchyRequiredString(mission, "missionId"),
      issuedByHatId: parseHierarchyRequiredString(mission, "issuedByHatId"),
      ...parseOptionalHierarchyString(mission.assignedHatId, "assignedHatId"),
      ...parseOptionalHierarchyString(mission.departmentId, "departmentId"),
      ...parseOptionalHierarchyString(mission.projectId, "projectId"),
      ...parseOptionalHierarchyString(mission.initiativeId, "initiativeId"),
      ...parseOptionalHierarchyMissionLevel(mission.level),
      goal: parseHierarchyRequiredString(mission, "goal"),
      strategy: parseStringArray(mission.strategy, "strategy"),
      successCriteria: parseStringArray(mission.successCriteria, "successCriteria"),
      timeframe: parseHierarchyMissionTimeframe(mission.timeframe),
      status: parseHierarchyMissionStatus(mission.status),
      progressPercent: parseHierarchyProgressPercent(mission.progressPercent),
      metrics: parseHierarchyMetricBlocks(mission.metrics, "metrics"),
      milestones: parseHierarchyMissionMilestones(mission.milestones),
    };
  });
}

function parseHierarchyMissionTimeframe(value: unknown): HierarchyMission["timeframe"] {
  if (typeof value !== "object" || value === null) {
    throw new Error("hierarchy mission timeframe must be an object");
  }
  const timeframe = value as Record<string, unknown>;
  return {
    startsAt: parseHierarchyRequiredString(timeframe, "startsAt"),
    targetAt: parseHierarchyRequiredString(timeframe, "targetAt"),
  };
}

function parseHierarchyMissionMilestones(value: unknown): readonly HierarchyMissionMilestone[] {
  if (!Array.isArray(value)) {
    throw new Error("hierarchy mission milestones must be an array");
  }
  return value.map((item) => {
    if (typeof item !== "object" || item === null) {
      throw new Error("hierarchy mission milestone must be an object");
    }
    const milestone = item as Record<string, unknown>;
    return {
      milestoneId: parseHierarchyRequiredString(milestone, "milestoneId"),
      title: parseHierarchyRequiredString(milestone, "title"),
      targetAt: parseHierarchyRequiredString(milestone, "targetAt"),
      status: parseHierarchyMissionStatus(milestone.status),
      ...parseOptionalHierarchyProgressPercent(milestone.progressPercent),
      metrics: parseHierarchyMetricBlocks(milestone.metrics, "metrics"),
    };
  });
}

function parseHierarchyMissionStatus(value: unknown): HierarchyMission["status"] {
  if (value === "on_track" || value === "at_risk" || value === "behind" || value === "blocked" || value === "complete") {
    return value;
  }
  throw new Error("hierarchy mission requires valid status");
}

function parseOptionalHierarchyMissionLevel(value: unknown): { level?: HatLevel } {
  if (value === undefined) return {};
  if (typeof value !== "string" || !Object.values(HatLevel).includes(value as HatLevel)) {
    throw new Error("hierarchy mission level must be a valid hat level when present");
  }
  return { level: value as HatLevel };
}

function parseHierarchyProgressPercent(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("hierarchy mission progressPercent must be numeric");
  }
  return value;
}

function parseOptionalHierarchyProgressPercent(value: unknown): { progressPercent?: number } {
  if (value === undefined) return {};
  return { progressPercent: parseHierarchyProgressPercent(value) };
}

function parseOptionalHierarchyString(value: unknown, property: string): Record<string, string> {
  if (value === undefined) return {};
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`hierarchy mission ${property} must be a string when present`);
  }
  return { [property]: value };
}

function parseHierarchyRequiredString(candidate: Record<string, unknown>, property: string): string {
  const value = candidate[property];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`hierarchy requires string ${property}`);
  }
  return value;
}

function parseHierarchyProjectStatus(value: unknown): HierarchyProject["status"] {
  if (value === "active" || value === "archived") return value;
  throw new Error("hierarchy project requires valid status");
}

function parseHierarchyInitiativeStatus(value: unknown): HierarchyInitiative["status"] {
  if (value === "proposed" || value === "active" || value === "completed" || value === "archived") return value;
  throw new Error("hierarchy initiative requires valid status");
}

function parseHierarchyWorkBatchStatus(value: unknown): HierarchyWorkBatch["status"] {
  if (value === "active" || value === "scheduled" || value === "blocked" || value === "completed" || value === "archived") return value;
  throw new Error("hierarchy work batch requires valid status");
}

function parseOptionalHierarchyInitiativeId(value: unknown): { initiativeId?: string } {
  if (value === undefined) return {};
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("hierarchy work item initiativeId must be a string when present");
  }
  return { initiativeId: value };
}

function parseOptionalHierarchyPriorityScore(value: unknown): { priorityScore?: number } {
  if (value === undefined) return {};
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("hierarchy priorityScore must be numeric when present");
  }
  return { priorityScore: value };
}

function parseHierarchyMetricBlocks(value: unknown, property: string): readonly MetricBlock[] {
  if (!Array.isArray(value)) {
    throw new Error(`hierarchy ${property} must be an array`);
  }
  return value.map((item) => {
    if (typeof item !== "object" || item === null) {
      throw new Error(`hierarchy ${property} metric must be an object`);
    }
    const metric = item as Record<string, unknown>;
    return {
      id: parseHierarchyRequiredString(metric, "id"),
      label: parseHierarchyRequiredString(metric, "label"),
      value: parseMetricValue(metric.value),
      ...parseOptionalMetricUnit(metric.unit),
    };
  });
}

function parseRequiredString(candidate: Record<string, unknown>, property: string): string {
  const value = candidate[property];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`prompt-flow task requires string ${property}`);
  }
  return value;
}

function parsePromptFlowDefinitionString(candidate: Record<string, unknown>, property: string): string {
  const value = candidate[property];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`prompt-flow definition ${property} must be a non-empty string`);
  }
  return value;
}

function parsePromptFlowRunScope(value: unknown): RunScope {
  if (typeof value !== "string" || !Object.values(RunScope).includes(value as RunScope)) {
    throw new Error("prompt-flow task requires valid scope");
  }
  return value as RunScope;
}

function parsePromptFlowPriority(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("prompt-flow task requires numeric priority");
  }
  return value;
}

function parsePromptFlowRunState(value: unknown): PromptFlowRunState {
  if (typeof value !== "string" || !Object.values(PromptFlowRunState).includes(value as PromptFlowRunState)) {
    throw new Error("prompt-flow run state is invalid");
  }
  return value as PromptFlowRunState;
}

function parseOptionalActionClass(value: unknown): { actionClass?: ActionClass } {
  if (value === undefined) return {};
  if (typeof value !== "string" || !Object.values(ActionClass).includes(value as ActionClass)) {
    throw new Error("prompt-flow task actionClass is invalid");
  }
  return { actionClass: value as ActionClass };
}

function parseOptionalRequiredToolBundles(value: unknown): { requiredToolBundles?: readonly ToolBundleName[] } {
  if (value === undefined) return {};
  const bundles = parseStringArray(value, "requiredToolBundles");
  for (const bundle of bundles) {
    if (!Object.values(ToolBundle).includes(bundle as ToolBundleName)) {
      throw new Error(`prompt-flow task requiredToolBundles contains invalid bundle '${bundle}'`);
    }
  }
  return { requiredToolBundles: bundles as readonly ToolBundleName[] };
}

function parseOptionalStringArray(value: unknown, property: string): Record<string, readonly string[]> {
  if (value === undefined) return {};
  return { [property]: parseStringArray(value, property) };
}

function parseOptionalPromptFlowMetadata(candidate: Record<string, unknown>): Partial<PromptFlowTask> {
  return {
    ...parseOptionalString(candidate.definitionVersion, "definitionVersion"),
    ...parseOptionalString(candidate.phaseId, "phaseId"),
    ...parseOptionalPromptFlowRunState(candidate.runState),
    ...parseOptionalStringArray(candidate.permittedUniversalActions, "permittedUniversalActions"),
    ...parseOptionalStringArray(candidate.requiredEvidenceRefs, "requiredEvidenceRefs"),
    ...parseOptionalPromptFlowGate(candidate.gate),
    ...parseOptionalStringArray(candidate.reviewerHatIds, "reviewerHatIds"),
    ...parseOptionalPositiveInteger(candidate.timeoutSeconds, "timeoutSeconds"),
    ...parseOptionalPositiveInteger(candidate.retryLimit, "retryLimit"),
    ...parseOptionalRollbackPolicy(candidate.rollbackPolicy),
  };
}

function parseOptionalString(value: unknown, property: string): Record<string, string> {
  if (value === undefined) return {};
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`prompt-flow task ${property} must be a non-empty string when present`);
  }
  return { [property]: value };
}

function parseOptionalPromptFlowRunState(value: unknown): { runState?: PromptFlowRunState } {
  if (value === undefined) return {};
  if (typeof value !== "string" || !Object.values(PromptFlowRunState).includes(value as PromptFlowRunState)) {
    throw new Error("prompt-flow task runState is invalid");
  }
  return { runState: value as PromptFlowRunState };
}

function parseOptionalPromptFlowGate(value: unknown): Pick<PromptFlowTask, "gate"> {
  if (value === undefined) return {};
  return { gate: parsePromptFlowGate(value) };
}

function parsePromptFlowGate(value: unknown): PromptFlowPhaseGate {
  if (typeof value !== "object" || value === null) {
    throw new Error("prompt-flow task gate must be an object when present");
  }
  const gate = value as Record<string, unknown>;
  if (typeof gate.kind !== "string" || !Object.values(PromptFlowGateKind).includes(gate.kind as PromptFlowGateKind)) {
    throw new Error("prompt-flow task gate kind is invalid");
  }
  return {
    kind: gate.kind as PromptFlowGateKind,
    requiredEvidenceRefs: parseStringArray(gate.requiredEvidenceRefs, "gate.requiredEvidenceRefs"),
    ...(gate.reviewerHatIds === undefined ? {} : { reviewerHatIds: parseStringArray(gate.reviewerHatIds, "gate.reviewerHatIds") }),
    ...(gate.approverHatIds === undefined ? {} : { approverHatIds: parseStringArray(gate.approverHatIds, "gate.approverHatIds") }),
    ...(gate.requiredHumanApprovalCount === undefined
      ? {}
      : { requiredHumanApprovalCount: parsePositiveInteger(gate.requiredHumanApprovalCount, "gate.requiredHumanApprovalCount") }),
  };
}

function parseOptionalPositiveInteger(value: unknown, property: "timeoutSeconds" | "retryLimit"): Partial<Pick<PromptFlowTask, "timeoutSeconds" | "retryLimit">> {
  if (value === undefined) return {};
  const parsed = property === "timeoutSeconds"
    ? parsePositiveInteger(value, property)
    : parseNonNegativeInteger(value, property);
  return { [property]: parsed } as Partial<Pick<PromptFlowTask, "timeoutSeconds" | "retryLimit">>;
}

function parsePositiveInteger(value: unknown, property: "timeoutSeconds" | "gate.requiredHumanApprovalCount"): number {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new Error(`prompt-flow task ${property} must be a positive integer when present`);
  }
  return value as number;
}

function parseNonNegativeInteger(value: unknown, property: "retryLimit"): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`prompt-flow task ${property} must be a positive integer when present`);
  }
  return value as number;
}

function parseOptionalRollbackPolicy(value: unknown): Pick<PromptFlowTask, "rollbackPolicy"> {
  if (value === undefined) return {};
  return { rollbackPolicy: parsePromptFlowRollbackPolicy(value) };
}

function parsePromptFlowRollbackPolicy(value: unknown): PromptFlowDefinition["rollbackPolicy"] {
  if (typeof value !== "object" || value === null) {
    throw new Error("prompt-flow task rollbackPolicy must be an object when present");
  }
  const rollback = value as Record<string, unknown>;
  if (rollback.kind !== "compensating_action" && rollback.kind !== "revert_artifact" && rollback.kind !== "cancel_only") {
    throw new Error("prompt-flow task rollbackPolicy kind is invalid");
  }
  if (typeof rollback.description !== "string" || rollback.description.length === 0) {
    throw new Error("prompt-flow task rollbackPolicy description is required");
  }
  return { kind: rollback.kind, description: rollback.description };
}

function parseStringArray(value: unknown, property: string): readonly string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && item.trim().length > 0)) {
    throw new Error(`prompt-flow task ${property} must contain only non-empty strings`);
  }
  return value;
}

function repeatedValues(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      repeated.add(value);
    }
    seen.add(value);
  }
  return [...repeated].sort();
}

function promptFlowDefinitionKey(definition: Pick<PromptFlowDefinition, "promptFlowId" | "version">): string {
  return `${definition.promptFlowId}@${definition.version}`;
}

function parseToolInjections(value: unknown): readonly PromptFlowToolInjection[] {
  if (!Array.isArray(value)) {
    throw new Error("prompt-flow task toolInjections must be an array");
  }
  return value.map((item) => {
    if (typeof item !== "object" || item === null || typeof (item as { tool?: unknown }).tool !== "string") {
      throw new Error("prompt-flow task tool injection requires a tool");
    }
    const injection = item as { tool: string; args?: unknown; requiredSecretScopes?: unknown };
    return {
      tool: injection.tool,
      ...(injection.args === undefined ? {} : { args: injection.args }),
      ...parseOptionalToolInjectionSecretScopes(injection.requiredSecretScopes),
    };
  });
}

function parseOptionalToolInjectionSecretScopes(value: unknown): { requiredSecretScopes?: readonly string[] } {
  if (value === undefined) return {};
  return { requiredSecretScopes: parseStringArray(value, "toolInjection.requiredSecretScopes") };
}

function parseMetricBlocks(value: unknown): readonly MetricBlock[] {
  if (!Array.isArray(value)) {
    throw new Error("prompt-flow task metrics must be an array");
  }
  return value.map((item) => {
    if (typeof item !== "object" || item === null) {
      throw new Error("prompt-flow task metric must be an object");
    }
    const metric = item as Record<string, unknown>;
    const parsed: MetricBlock = {
      id: parseRequiredString(metric, "id"),
      label: parseRequiredString(metric, "label"),
      value: parseMetricValue(metric.value),
      ...parseOptionalMetricUnit(metric.unit),
    };
    return parsed;
  });
}

function parseMetricValue(value: unknown): number | string | boolean {
  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  throw new Error("prompt-flow task metric value must be number, string, or boolean");
}

function parseOptionalMetricUnit(value: unknown): { unit?: string } {
  if (value === undefined) return {};
  if (typeof value !== "string") {
    throw new Error("prompt-flow task metric unit must be a string");
  }
  return { unit: value };
}

function parseAgentCliZetaId(value: string, flagName: string): ParseAgentCliZetaIdResult {
  try {
    return { ok: true, value: asZetaIdDecimal(value) };
  } catch {
    return { ok: false, message: `${flagName} must be a base-10 ZetaId, got '${value}'` };
  }
}

function parseJsonEnv(raw: string, envName: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${envName} invalid JSON: ${extractErrorMessage(error)}`);
  }
}

function extractErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
