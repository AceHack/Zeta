import { randomUUID } from "node:crypto";

import {
  ActRejectionReason,
  ObserveCommandType,
  buildHatDefinitions,
  createCommandHandlerRegistry,
  createCommandPipeline,
  createControlPlaneSlotAuthorizer,
  createHatAuthorityPort,
  createObserveLifecycleTransitionHandler,
  createScheduleBlockCommandAuthority,
  createSendSupervisorSignalHandler,
  type ActDependencies,
  type CommandResult,
  type ControlPlaneBoundary,
  type ControlPlaneFlag,
  type ControlPlaneRateLimit,
  type ControlPlaneUsage,
  type Menu16Slot,
  type ObserveLifecycleTransitionCommand,
  type SendSupervisorSignalCommand,
} from "../../../packages/application/src/index.ts";
import {
  CommandType,
  OrgEventKind,
  type OrgEvent,
} from "../../../packages/domain/src/index.ts";
import { dispatchMetricsTool } from "../../../packages/metrics/src/index.ts";
import {
  createCommandAuthorizationPort,
  createPolicyDecisionObservationPort,
} from "../../../packages/policy/src/index.ts";
import {
  createCockroachControlPlaneStateStore,
  createCockroachDurableStateAdapters,
  createCockroachOrgEventStore,
  createCockroachSqlExecutor,
} from "../../../packages/state-cockroach/src/index.ts";
import type { CockroachGenericSqlExecutor } from "../../../packages/state-cockroach/src/cockroach-sql-executor.ts";
import {
  createCockroachMigrationBootstrapper,
} from "../../workers/src/adapters/cockroach-migration-bootstrapper.ts";
import {
  createCockroachWorkerShutdownPort,
  createCockroachWorkerSqlClient,
  type CockroachWorkerShutdownPool,
} from "../../workers/src/adapters/cockroach-worker-client.ts";
import {
  createPgCockroachWorkerPool,
  type PgCockroachWorkerPool,
} from "../../workers/src/adapters/pg-cockroach-worker-pool.ts";
import {
  createAgentCliHierarchyFromEnv,
  createAgentCliMetricAgentsFromEnv,
  createAgentCliPromptFlowTasksFromEnv,
  createAgentCliSelectorFromEnv,
  parseAgentCliArgs,
  runAgentCliCycle,
  type AgentCliCycleEvidence,
  type ParsedAgentCliArgs,
} from "./agent-cli.ts";

type ObserveActPipelineCommand = ObserveLifecycleTransitionCommand | SendSupervisorSignalCommand;

export type AgentCliMainRuntime = Pick<ActDependencies, "runCommand" | "dispatchTool"> &
  Partial<Pick<ActDependencies, "authorizeSlot" | "loadPromptFlowContext">> & {
    appendObserveActTick?: ((event: OrgEvent) => Promise<void>) | undefined;
    loadControlPlaneFlags?: ((organizationId: string, evaluatedAt: string) => Promise<readonly ControlPlaneFlag[]>) | undefined;
    loadControlPlaneRateLimits?: ((
      organizationId: string,
      evaluatedAt: string,
    ) => Promise<readonly ControlPlaneRateLimit[]>) | undefined;
    rateLimits?: readonly ControlPlaneRateLimit[] | undefined;
    availableSecretScopes?: readonly string[] | undefined;
    shutdown: () => Promise<void>;
  };

export type ResolveAgentCliProductionRuntimeInput = {
  env: Readonly<Record<string, string | undefined>>;
  now: () => string;
};

export type ResolveAgentCliProductionRuntimeResult =
  | { ok: true; runtime: AgentCliMainRuntime }
  | { ok: false; message: string };

export type RunAgentCliMainInput = {
  argv: readonly string[];
  env: Readonly<Record<string, string | undefined>>;
  now: () => string;
  writeStdout: (text: string) => void;
  writeStderr: (text: string) => void;
  fetchImpl?: typeof fetch | undefined;
  runtime?: AgentCliMainRuntime | undefined;
};

export async function runAgentCliMain(input: RunAgentCliMainInput): Promise<number> {
  let runtime: AgentCliMainRuntime | undefined;

  try {
    runtime = input.runtime ?? await runtimeFromEnvOrReport(input);
  } catch (error) {
    input.writeStderr(`agent CLI setup failed: ${extractErrorMessage(error)}\n`);
    return 2;
  }

  if (runtime === undefined) return 2;

  try {
    const cycleInput = createRunAgentCliCycleInput(input, runtime);
    const result = await runAgentCliCycle({
      ...cycleInput,
    });
    const evidenceExitCode = await appendObserveActEvidenceIfPresent(input, runtime, result.evidence);
    if (evidenceExitCode !== undefined) return evidenceExitCode;
    return result.exitCode;
  } catch (error) {
    input.writeStderr(`agent CLI setup failed: ${extractErrorMessage(error)}\n`);
    return 2;
  } finally {
    await runtime.shutdown();
  }
}

export async function resolveAgentCliProductionRuntime(
  input: ResolveAgentCliProductionRuntimeInput,
): Promise<ResolveAgentCliProductionRuntimeResult> {
  const databaseUrl = input.env.COCKROACH_DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl.trim().length === 0) {
    return {
      ok: false,
      message: "COCKROACH_DATABASE_URL is required for production observe-act CLI dispatch",
    };
  }

  const pool = await createPgCockroachWorkerPool({ databaseUrl });
  const sqlClient = createCockroachWorkerSqlClient({ pool });
  const executor = createCockroachSqlExecutor({ client: sqlClient });
  await createCockroachMigrationBootstrapper({ executor }).bootstrap();

  return {
    ok: true,
    runtime: createAgentCliProductionRuntime({
      executor,
      pool,
      now: input.now,
      createId: (prefix) => `${prefix}-${randomUUID()}`,
      availableSecretScopes: parseAvailableSecretScopes(input.env.AGENTIC_ORG_AVAILABLE_SECRET_SCOPES),
    }),
  };
}

export function createAgentCliMcpDispatcher(): ActDependencies["dispatchTool"] {
  return async (tool, args) => dispatchMetricsTool(tool, args);
}

function createAgentCliProductionRuntime(input: {
  executor: CockroachGenericSqlExecutor;
  pool: PgCockroachWorkerPool & CockroachWorkerShutdownPool;
  now: () => string;
  createId: (prefix: string) => string;
  availableSecretScopes?: readonly string[] | undefined;
}): AgentCliMainRuntime {
  const controlPlaneState = createCockroachControlPlaneStateStore({ executor: input.executor });
  return {
    runCommand: createCockroachAgentCliCommandRunner(input),
    dispatchTool: createAgentCliMcpDispatcher(),
    loadControlPlaneFlags: async (organizationId, evaluatedAt) =>
      await controlPlaneState.listActiveFlags(organizationId, evaluatedAt) as readonly ControlPlaneFlag[],
    loadControlPlaneRateLimits: async (organizationId, evaluatedAt) =>
      await controlPlaneState.listActiveRateLimits(organizationId, evaluatedAt) as readonly ControlPlaneRateLimit[],
    ...createOptionalAvailableSecretScopes(input.availableSecretScopes),
    appendObserveActTick: async (event) => {
      await createCockroachOrgEventStore({ executor: input.executor }).append(event);
    },
    shutdown: async () => {
      await createCockroachWorkerShutdownPort({ pool: input.pool }).shutdown();
    },
  };
}

function createRunAgentCliCycleInput(
  input: RunAgentCliMainInput,
  runtime: AgentCliMainRuntime,
): Parameters<typeof runAgentCliCycle>[0] {
  const parsed = parseAgentCliArgs(input.argv);
  const authorizeSlot = runtime.authorizeSlot ?? (
    parsed.ok ? createAgentCliControlPlaneSlotAuthorizer(runtime, parsed.value, input.now) : undefined
  );
  return {
    argv: input.argv,
    now: input.now,
    writeStdout: input.writeStdout,
    writeStderr: input.writeStderr,
    metricAgents: createAgentCliMetricAgentsFromEnv({
      env: input.env,
      now: input.now,
      ...createOptionalFetchImpl(input.fetchImpl),
    }),
    promptFlowTasks: createAgentCliPromptFlowTasksFromEnv({
      env: input.env,
    }),
    hierarchy: createAgentCliHierarchyFromEnv({
      env: input.env,
    }),
    selectSlot: createAgentCliSelectorFromEnv({
      env: input.env,
      ...createOptionalFetchImpl(input.fetchImpl),
    }),
    runCommand: runtime.runCommand,
    dispatchTool: runtime.dispatchTool,
    ...createOptionalAuthorizeSlot(authorizeSlot),
    ...createOptionalLoadPromptFlowContext(runtime.loadPromptFlowContext),
    ...createOptionalAvailableSecretScopes(runtime.availableSecretScopes),
  };
}

function createAgentCliControlPlaneSlotAuthorizer(
  runtime: AgentCliMainRuntime,
  args: ParsedAgentCliArgs,
  now: () => string,
): NonNullable<ActDependencies["authorizeSlot"]> {
  return async (slot) => {
    const evaluatedAt = now();
    const authorizer = createControlPlaneSlotAuthorizer({
      organizationId: args.organizationId,
      tenantId: args.organizationId,
      actorHatId: args.hatId,
      providerId: providerIdForSlot(slot),
      boundary: boundaryForSlot(slot),
      evaluatedAt,
      flags: await (runtime.loadControlPlaneFlags?.(args.organizationId, evaluatedAt) ?? []),
      rateLimits: await loadControlPlaneRateLimits(runtime, args.organizationId, evaluatedAt),
      availableSecretScopes: runtime.availableSecretScopes,
      usageForSlot: usageForSlot,
    });
    return await authorizer(slot);
  };
}

async function loadControlPlaneRateLimits(
  runtime: AgentCliMainRuntime,
  organizationId: string,
  evaluatedAt: string,
): Promise<readonly ControlPlaneRateLimit[]> {
  const loaded = await (runtime.loadControlPlaneRateLimits?.(organizationId, evaluatedAt) ?? []);
  return [...loaded, ...(runtime.rateLimits ?? [])];
}

function boundaryForSlot(slot: Menu16Slot): ControlPlaneBoundary {
  if (slot.impl?.kind === "command") return "command_dispatch";
  if (slot.impl?.kind === "mcp" || slot.impl?.kind === "prompt_flow") return "mcp_dispatch";
  return "act";
}

function providerIdForSlot(slot: Menu16Slot): string | undefined {
  const tools = toolsForSlot(slot);
  const providerIds = [...new Set(tools.map(providerIdForTool).filter(isNonEmptyString))];
  return providerIds.length === 1 ? providerIds[0] : undefined;
}

function providerIdForTool(tool: string): string | undefined {
  return tool.split(".")[0];
}

function isNonEmptyString(value: string | undefined): value is string {
  return value !== undefined && value.length > 0;
}

function usageForSlot(slot: Menu16Slot): ControlPlaneUsage | undefined {
  return toolsForSlot(slot).length === 0 ? undefined : { externalProviderCallCost: 1, toolCallCost: 1 };
}

function toolsForSlot(slot: Menu16Slot): readonly string[] {
  if (slot.impl?.kind === "mcp") return [slot.impl.tool];
  if (slot.impl?.kind === "prompt_flow") return slot.impl.request.toolInjections.map((injection) => injection.tool);
  return [];
}

function createOptionalFetchImpl(
  fetchImpl: typeof fetch | undefined,
): { fetchImpl?: typeof fetch } {
  return fetchImpl === undefined ? {} : { fetchImpl };
}

function createOptionalAvailableSecretScopes(
  availableSecretScopes: readonly string[] | undefined,
): { availableSecretScopes?: readonly string[] } {
  return availableSecretScopes === undefined ? {} : { availableSecretScopes };
}

function parseAvailableSecretScopes(value: string | undefined): readonly string[] | undefined {
  if (value === undefined || value.trim().length === 0) return undefined;
  return [...new Set(value.split(",").map((scope) => scope.trim()).filter((scope) => scope.length > 0))];
}

async function appendObserveActEvidenceIfPresent(
  input: RunAgentCliMainInput,
  runtime: AgentCliMainRuntime,
  evidence: AgentCliCycleEvidence | undefined,
): Promise<number | undefined> {
  if (evidence === undefined || runtime.appendObserveActTick === undefined) return undefined;
  const parsed = parseAgentCliArgs(input.argv);
  if (!parsed.ok) return undefined;
  try {
    await runtime.appendObserveActTick(createAgentCliObserveActTickEvent(parsed.value, evidence, input.now()));
    return undefined;
  } catch (error) {
    input.writeStderr(`agent CLI evidence append failed: ${extractErrorMessage(error)}\n`);
    return 1;
  }
}

function createAgentCliObserveActTickEvent(
  args: ParsedAgentCliArgs,
  evidence: AgentCliCycleEvidence,
  occurredAt: string,
): OrgEvent {
  const eventId = `observeactevt-${randomUUID()}`;
  const traceId = `observe-cli-${args.runId}`;
  return {
    id: eventId,
    kind: OrgEventKind.ObserveActTick,
    occurredAt,
    organizationId: args.organizationId,
    actorHatId: args.hatId,
    actorAgentId: args.agentId,
    subjectId: args.workItemId,
    decision: `observe-act selected slot ${evidence.selectedIndex} for run ${args.runId}`,
    supervisorChain: [args.hatId],
    evidenceRefs: observeActEvidenceRefs(evidence),
    correlationId: traceId,
    causationId: eventId,
    traceId,
  };
}

function observeActEvidenceRefs(evidence: AgentCliCycleEvidence): readonly string[] {
  return [
    `observe-act:menu_hash:${evidence.menuHash}`,
    `observe-act:selected_slot:${evidence.selectedIndex}`,
    `observe-act:veto_count:${evidence.vetoCount}`,
    `observe-act:true_slot_count:${evidence.trueSlotCount}`,
    ...evidence.selectorRejections.flatMap(selectorRejectionEvidenceRefs),
    ...statusEvidenceRefs(evidence),
    ...actionRejectionEvidenceRefs(evidence),
    ...evidence.promptFlowIds.map((id) => `observe-act:prompt_flow:${id}`),
    ...evidence.metricBlockIds.map((id) => `observe-act:metric:${id}`),
  ];
}

function statusEvidenceRefs(evidence: AgentCliCycleEvidence): readonly string[] {
  if (evidence.statusSignalKind === undefined) return [];
  return [
    `observe-act:status:${evidence.statusSignalKind}`,
    ...(evidence.statusScope === undefined ? [] : [`observe-act:status_scope:${evidence.statusScope}`]),
    ...(evidence.statusPhase === undefined ? [] : [`observe-act:status_phase:${evidence.statusPhase}`]),
    ...(evidence.statusHierarchyPriorityScope === undefined ? [] : [`observe-act:status_priority_scope:${evidence.statusHierarchyPriorityScope}`]),
  ];
}

function actionRejectionEvidenceRefs(evidence: AgentCliCycleEvidence): readonly string[] {
  if (
    evidence.actionRejectionReason !== ActRejectionReason.ControlPlaneDenied &&
    evidence.actionRejectionReason !== ActRejectionReason.ScheduleAuthorityDenied
  ) {
    return [];
  }
  return [
    `observe-act:control_bypass_rejected:${evidence.actionRejectionReason}:${evidence.selectedIndex}`,
  ];
}

function selectorRejectionEvidenceRefs(
  rejection: AgentCliCycleEvidence["selectorRejections"][number],
): readonly string[] {
  const rejectedIndex = rejection.rejectedIndex === undefined ? "unknown" : String(rejection.rejectedIndex);
  return [
    `observe-act:selector_rejected:${rejection.reason}:${rejectedIndex}`,
    `observe-act:selector_rejected_fallback_slot:${rejection.fallbackIndex}`,
  ];
}

function createCockroachAgentCliCommandRunner(input: {
  executor: CockroachGenericSqlExecutor;
  now: () => string;
  createId: (prefix: string) => string;
}): ActDependencies["runCommand"] {
  const hats = buildHatDefinitions();
  const stateAdapters = createCockroachDurableStateAdapters<CommandResult>({ executor: input.executor });
  const controlPlaneState = createCockroachControlPlaneStateStore({ executor: input.executor });
  const pipeline = createCommandPipeline<ObserveActPipelineCommand>({
    stateStoreFactory: stateAdapters.commandStateStoreFactory,
    commandAuthorizationPort: createCommandAuthorizationPort({
      hatAuthorityPort: createHatAuthorityPort({
        hatAssignmentAuthorityReader: stateAdapters.hatAssignmentAuthorityReader,
        hatDefinitions: hats,
        createId: input.createId,
      }),
    }),
    policyDecisionObservationPort: createPolicyDecisionObservationPort({
      store: stateAdapters.policyDecisionObservationStore,
    }),
    commandScheduleAuthorityPort: createScheduleBlockCommandAuthority({
      scheduleBlockReader: stateAdapters.workScheduleBlockAuthorityReader,
    }),
    handlerRegistry: createCommandHandlerRegistry<ObserveActPipelineCommand, CommandResult>([
      createObserveLifecycleTransitionHandler(),
      createSendSupervisorSignalHandler(),
    ]),
    workAnchorStateReader: stateAdapters.workAnchorStateStore,
    controlPlane: {
      loadFlags: async (command) =>
        await controlPlaneState.listActiveFlags(command.organizationId, input.now()),
      now: input.now,
    },
    now: input.now,
    createId: input.createId,
  });

  return async (commandType, command) => {
    if (commandType !== ObserveCommandType.LifecycleTransition && commandType !== CommandType.SendSupervisorSignal) {
      return { status: "unsupported_command_type", commandType };
    }
    return await pipeline.execute(command as ObserveActPipelineCommand);
  };
}

async function runtimeFromEnvOrReport(input: RunAgentCliMainInput): Promise<AgentCliMainRuntime | undefined> {
  const resolved = await resolveAgentCliProductionRuntime({
    env: input.env,
    now: input.now,
  });
  if (!resolved.ok) {
    input.writeStderr(`${resolved.message}\n`);
    return undefined;
  }
  return resolved.runtime;
}

function createOptionalAuthorizeSlot(
  authorizeSlot: AgentCliMainRuntime["authorizeSlot"],
): Pick<ActDependencies, "authorizeSlot"> {
  return authorizeSlot === undefined ? {} : { authorizeSlot };
}

function createOptionalLoadPromptFlowContext(
  loadPromptFlowContext: AgentCliMainRuntime["loadPromptFlowContext"],
): Pick<ActDependencies, "loadPromptFlowContext"> {
  return loadPromptFlowContext === undefined ? {} : { loadPromptFlowContext };
}

function extractErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
