import {
  act,
  ActionClass,
  asZetaIdDecimal,
  buildHatDefinitions,
  createTelemetryScopedMetricAgents,
  observeAgentSurface,
  ObserveCommandType,
  ObserveOutcome,
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
  type PromptFlowContext,
  type PromptFlowContextArtifact,
  type PromptFlowContextRequest,
  type PromptFlowReadout,
  type PromptFlowTask,
  type PromptFlowToolInjection,
  type ScopedMetricAgent,
  type ScopedReadout,
} from "../../../packages/application/src/index.ts";
import { HatLevel, ToolBundle, type ToolBundle as ToolBundleName } from "../../../packages/domain/src/index.ts";
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
  workItemId: string;
  gateApproved: boolean;
  evidence: boolean;
  selectIndex?: number;
};

export type ParseAgentCliArgsResult =
  | { ok: true; value: ParsedAgentCliArgs }
  | { ok: false; message: string };

export type AgentCliScreen = {
  scope: RunScope;
  phase: RunLifecyclePhase;
  hatId: string;
  metrics: ScopedReadout;
  promptFlows?: PromptFlowReadout;
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
  selectSlot?: (menu: Menu16) => Promise<number> | number;
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

export type MenuSelector = (menu: Menu16) => Promise<number> | number;

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
  const workItemId = values.flags.get("work-item") ?? runId;
  const selectIndexValue = values.flags.get("select-index");
  const selectIndex = selectIndexValue === undefined ? undefined : Number.parseInt(selectIndexValue, 10);
  if (selectIndexValue !== undefined && (!Number.isInteger(selectIndex) || String(selectIndex) !== selectIndexValue)) {
    return { ok: false, message: `--select-index must be an integer, got '${selectIndexValue}'` };
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
      workItemId,
      gateApproved: values.booleans.has("gate-approved"),
      evidence: values.booleans.has("evidence"),
      ...createOptionalSelectIndex(selectIndexValue === undefined ? undefined : selectIndex),
    },
  };
}

export function selectFirstTrueSlot(menu: Menu16): number {
  return menu.slots.find((slot) => slot.availability === TriAvailability.True)?.index ?? -1;
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
  const raw = input.env.AGENTIC_ORG_PROMPT_FLOW_TASKS_JSON;
  if (raw === undefined || raw.trim().length === 0) {
    return [];
  }
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("AGENTIC_ORG_PROMPT_FLOW_TASKS_JSON must be a JSON array");
  }
  return parsed.map(parsePromptFlowTask);
}

export function createAgentCliHierarchyFromEnv(
  input: CreateAgentCliHierarchyFromEnvInput,
): HierarchySnapshot {
  const raw = input.env.AGENTIC_ORG_HIERARCHY_JSON;
  if (raw === undefined || raw.trim().length === 0) {
    return { projects: [], initiatives: [] };
  }
  const parsed: unknown = JSON.parse(raw);
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
          "You are selecting from a deterministic 16-slot agent controller. Reply with only one selectable slot index.",
        user: buildMenuSelectorPrompt(selectable),
      });
    } catch {
      return await input.fallback(menu);
    }

    const index = parseModelSelectedIndex(completionContent(completion), selectable);
    return index ?? (await input.fallback(menu));
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

  const snapshot: AgentObserveSnapshot = {
    runId: asZetaIdDecimal(parsed.value.runId),
    scope: parsed.value.scope,
    phase: parsed.value.phase,
    trace: {
      correlationId: `observe-cli-${parsed.value.runId}`,
      causationId: `observe-cli-${parsed.value.runId}`,
      traceId: `observe-cli-${parsed.value.runId}`,
    },
    hasGateApproval: parsed.value.gateApproved,
    hasEvidence: parsed.value.evidence,
    hatAssignmentId: asZetaIdDecimal(parsed.value.hatAssignmentId),
    hat,
  };

  const observed = await observeAgentSurface(snapshot, {
    clock: { now: input.now },
    ...createOptionalMetricAgents(input.metricAgents),
    ...createOptionalPromptFlowTasks(input.promptFlowTasks),
    ...createOptionalHierarchy(input.hierarchy),
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
    hierarchy: observed.hierarchy,
    slots: observed.actions.slots,
  })}\n`);

  const selectedIndex =
    parsed.value.selectIndex ?? (await (input.selectSlot?.(observed.actions) ?? selectFirstTrueSlot(observed.actions)));
  const actionResult = await act(selectedIndex, observed.actions, {
    runCommand: async (commandType, command, slot) =>
      await input.runCommand(commandType, materializeCommand(commandType, command, slot, parsed.value), slot),
    dispatchTool: input.dispatchTool,
    loadPromptFlowContext: input.loadPromptFlowContext ?? loadPromptFlowContextFromRequest,
  });
  input.writeStdout?.(`action: ${formatActResult(actionResult)}\n`);
  if (actionResult.outcome === "loaded_context") {
    input.writeStdout?.(`${formatPromptFlowContext(actionResult.context)}\n`);
  }
  return { exitCode: actionResult.outcome === "rejected" ? 1 : 0, actionResult };
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
  };
}

function materializeCommand(
  commandType: string,
  command: unknown,
  slot: Menu16Slot,
  args: ParsedAgentCliArgs,
): unknown {
  if (commandType !== ObserveCommandType.LifecycleTransition || !isLifecycleTransitionPayload(command)) {
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
    ...command,
  };
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

function parseModelSelectedIndex(raw: string, selectable: readonly Menu16Slot[]): number | undefined {
  const normalized = raw.trim();
  const match = /(?:^|\D)(\d{1,2})(?:\D|$)/.exec(normalized);
  if (match === null) {
    return undefined;
  }
  const index = Number.parseInt(match[1]!, 10);
  return selectable.some((slot) => slot.index === index) ? index : undefined;
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
    case "reobserve":
      return `reobserve ${result.scope}`;
    case "rejected":
      return `rejected ${result.reason}`;
  }
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
    ...parseOptionalActionClass(candidate.actionClass),
    ...parseOptionalRequiredToolBundles(candidate.requiredToolBundles),
    directions: parseStringArray(candidate.directions, "directions"),
    toolInjections: parseToolInjections(candidate.toolInjections),
    metrics: parseMetricBlocks(candidate.metrics),
    contextArtifactRefs: parseStringArray(candidate.contextArtifactRefs, "contextArtifactRefs"),
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

function parseStringArray(value: unknown, property: string): readonly string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`prompt-flow task ${property} must be a string array`);
  }
  return value;
}

function parseToolInjections(value: unknown): readonly PromptFlowToolInjection[] {
  if (!Array.isArray(value)) {
    throw new Error("prompt-flow task toolInjections must be an array");
  }
  return value.map((item) => {
    if (typeof item !== "object" || item === null || typeof (item as { tool?: unknown }).tool !== "string") {
      throw new Error("prompt-flow task tool injection requires a tool");
    }
    const injection = item as { tool: string; args?: unknown };
    return injection.args === undefined ? { tool: injection.tool } : { tool: injection.tool, args: injection.args };
  });
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
