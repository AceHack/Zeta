import { randomUUID } from "node:crypto";

import {
  ActRejectionReason,
  ObserveCommandType,
  buildHatDefinitions,
  createCommandHandlerRegistry,
  createCommandPipeline,
  createControlPlaneSlotAuthorizer,
  createContextPackSnapshotRecorder,
  createDefaultContextPackAdvisoryPromotionPolicy,
  createDefaultContextPackCompletenessPolicy,
  createDefaultContextPackReadinessPolicy,
  createDeterministicContextPackBuilder,
  createHatAuthorityPort,
  createLgtmContextPackRuntimeEvidencePort,
  createMemoryContextPackRecallPort,
  createModelBackedContextPackSynthesisPort,
  createObserveLifecycleTransitionHandler,
  createScheduleBlockCommandAuthority,
  createSendSupervisorSignalHandler,
  createTenantConfigContextPackCompletenessPolicy,
  createTenantConfigContextPackCurationIntentPolicy,
  createTenantConfigContextPackReadinessPolicy,
  createTenantConfigContextPackSynthesisRequirementPolicy,
  type ActDependencies,
  type CommandResult,
  type ContextPackBuilderPort,
  type ContextPackBuildRequest,
  type ContextPackEphemeralSynthesisPort,
  type ContextPackGraphRootSeed,
  type ContextPackReadinessPolicyPort,
  type ContextPackSnapshotStorePort,
  type ContextPackTelemetryEvidencePort,
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
  GraphNodeKind,
  OrgEventKind,
  graphNodeId,
  type OrgEvent,
} from "../../../packages/domain/src/index.ts";
import { dispatchMetricsTool } from "../../../packages/metrics/src/index.ts";
import {
  createLgtmTelemetryQueryPort,
} from "../../../packages/observability/src/index.ts";
import {
  createCommandAuthorizationPort,
  createPolicyDecisionObservationPort,
} from "../../../packages/policy/src/index.ts";
import {
  createCockroachControlPlaneStateStore,
  createCockroachContextPackAdvisoryPromotionDecisionStore,
  createCockroachContextPackDocumentPort,
  createCockroachContextPackMemoryEnvelopeReader,
  createCockroachContextPackInboxAnchorPort,
  createCockroachContextPackInboxWorkflowViewReader,
  createCockroachContextPackLifecycleAnchorPort,
  createCockroachContextPackSnapshotStore,
  createCockroachDocConsultLedgerStore,
  createCockroachDocEntityStore,
  createCockroachDocUnitStore,
  createCockroachDurableStateAdapters,
  createCockroachGraphStore,
  createCockroachMemory,
  createCockroachOrgEventStore,
  createCockroachSqlExecutor,
  createCockroachTenantConfigStore,
} from "../../../packages/state-cockroach/src/index.ts";
import type { CockroachGenericSqlExecutor } from "../../../packages/state-cockroach/src/cockroach-sql-executor.ts";
import {
  createCockroachMigrationBootstrapper,
} from "../../workers/src/adapters/cockroach-migration-bootstrapper.ts";
import { createOllamaChatPort } from "../../workers/src/adapters/ollama-chat-port.ts";
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
  createAgentCliMetricAgentsFromEnv,
  createAgentCliSelectorFromEnv,
  parseAgentCliArgs,
  runAgentCliCycle,
  tryCreateAgentCliHierarchyFromEnv,
  tryCreateAgentCliPromptFlowTasksFromEnv,
  tryCreateAgentCliWorkQueuesFromEnv,
  type AgentCliCycleEvidence,
  type AgentCliCycleFailureEvidence,
  type AgentCliCycleInput,
  type ParsedAgentCliArgs,
} from "./agent-cli.ts";

type ObserveActPipelineCommand = ObserveLifecycleTransitionCommand | SendSupervisorSignalCommand;

const COCKROACH_HINDSIGHT_CONTEXT_PROVIDER_ID = "cockroach_hindsight";
const CONTEXT_GRAPH_ROOT_REASON = {
  OrganizationRuntime: "organization runtime root",
  ProjectTrajectory: "project trajectory root",
  TeamCoordination: "team coordination root",
  HatAuthority: "hat authority root",
  WorkItemLifecycle: "work item lifecycle root",
  InitiativePriority: "initiative priority root",
  MissionManagement: "mission management root",
  PriorityItem: "hierarchy priority item root",
} as const;
const CONTEXT_GRAPH_ROOT_LIMIT = {
  HierarchyProjects: 8,
  HierarchyInitiatives: 12,
  PriorityItems: 12,
} as const;
const CONTEXT_SYNTHESIS_ENV = {
  BaseUrl: "AGENTIC_ORG_CONTEXT_SYNTHESIS_LLM_BASE_URL",
  Model: "AGENTIC_ORG_CONTEXT_SYNTHESIS_LLM_MODEL",
  FallbackBaseUrl: "AGENTIC_ORG_LLM_BASE_URL",
  FallbackModel: "AGENTIC_ORG_LLM_MODEL",
} as const;
const CONTEXT_RUNTIME_EVIDENCE_ENV = {
  MimirBaseUrl: "AGENTIC_ORG_MIMIR_BASE_URL",
  TempoBaseUrl: "AGENTIC_ORG_TEMPO_BASE_URL",
  LokiBaseUrl: "AGENTIC_ORG_LOKI_BASE_URL",
  RangeStart: "AGENTIC_ORG_TELEMETRY_RANGE_START",
  RangeEnd: "AGENTIC_ORG_TELEMETRY_RANGE_END",
} as const;

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
    contextPackBuilder?: ContextPackBuilderPort | undefined;
    contextPackReadinessPolicy?: ContextPackReadinessPolicyPort | undefined;
    enforceContextReadiness?: boolean | undefined;
    loadLatestContextPackSnapshot?: ContextPackSnapshotStorePort["latestForScope"] | undefined;
    recordContextPackSnapshot?: ContextPackSnapshotStorePort["record"] | undefined;
    loadContextPackInboxWorkflow?: AgentCliCycleInput["loadContextPackInboxWorkflow"] | undefined;
    loadContextPackAdvisoryPromotionDecisions?: AgentCliCycleInput["loadContextPackAdvisoryPromotionDecisions"] | undefined;
    shutdown: () => Promise<void>;
  };

export type ResolveAgentCliProductionRuntimeInput = {
  env: Readonly<Record<string, string | undefined>>;
  now: () => string;
  fetchImpl?: typeof fetch | undefined;
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
    if (!cycleInput.ok) {
      input.writeStderr(`agent CLI setup failed: ${cycleInput.message}\n`);
      return 2;
    }
    const result = await runAgentCliCycle({
      ...cycleInput.value,
    });
    const failureEvidenceExitCode = await appendObserveActFailureEvidenceIfPresent(input, runtime, result.failureEvidence);
    if (failureEvidenceExitCode !== undefined) return failureEvidenceExitCode;
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
      contextPackSynthesis: createAgentCliContextPackSynthesisFromEnv(input.env),
      contextPackRuntimeEvidence: createAgentCliContextPackRuntimeEvidenceFromEnv({
        env: input.env,
        now: input.now,
        ...createOptionalFetchImpl(input.fetchImpl),
      }),
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
  contextPackSynthesis?: ContextPackEphemeralSynthesisPort | undefined;
  contextPackRuntimeEvidence?: ContextPackTelemetryEvidencePort | undefined;
}): AgentCliMainRuntime {
  const controlPlaneState = createCockroachControlPlaneStateStore({ executor: input.executor });
  const contextPackSnapshots = createCockroachContextPackSnapshotStore({ executor: input.executor });
  const docConsultLedger = createCockroachDocConsultLedgerStore({ executor: input.executor });
  const inboxWorkflowReader = createCockroachContextPackInboxWorkflowViewReader({ executor: input.executor });
  const advisoryPromotionDecisions = createCockroachContextPackAdvisoryPromotionDecisionStore({
    executor: input.executor,
  });
  return {
    runCommand: createCockroachAgentCliCommandRunner(input),
    dispatchTool: createAgentCliMcpDispatcher(),
    loadControlPlaneFlags: async (organizationId, evaluatedAt) =>
      await controlPlaneState.listActiveFlags(organizationId, evaluatedAt) as readonly ControlPlaneFlag[],
    loadControlPlaneRateLimits: async (organizationId, evaluatedAt) =>
      await controlPlaneState.listActiveRateLimits(organizationId, evaluatedAt) as readonly ControlPlaneRateLimit[],
    ...createOptionalAvailableSecretScopes(input.availableSecretScopes),
    contextPackBuilder: createCockroachAgentCliContextPackBuilder({
      executor: input.executor,
      synthesis: input.contextPackSynthesis,
      telemetryEvidence: input.contextPackRuntimeEvidence,
    }),
    contextPackReadinessPolicy: createCockroachAgentCliContextPackReadinessPolicy({
      executor: input.executor,
    }),
    enforceContextReadiness: true,
    loadLatestContextPackSnapshot: async (lookup) => await contextPackSnapshots.latestForScope(lookup),
    loadContextPackInboxWorkflow: async (lookup) => await inboxWorkflowReader.load(lookup),
    loadContextPackAdvisoryPromotionDecisions: async (request) =>
      await advisoryPromotionDecisions.listForPromotion(request),
    recordContextPackSnapshot: createContextPackSnapshotRecorder({
      snapshots: contextPackSnapshots,
      docConsultLedger,
      transaction: {
        run: async (operation) => {
          await input.executor.executeTransaction(async (transactionExecutor) =>
            await operation({
              snapshots: createCockroachContextPackSnapshotStore({ executor: transactionExecutor }),
              docConsultLedger: createCockroachDocConsultLedgerStore({ executor: transactionExecutor }),
            })
          );
        },
      },
    }),
    appendObserveActTick: async (event) => {
      await createCockroachOrgEventStore({ executor: input.executor }).append(event);
    },
    shutdown: async () => {
      await createCockroachWorkerShutdownPort({ pool: input.pool }).shutdown();
    },
  };
}

export function createCockroachAgentCliContextPackBuilder(input: {
  executor: CockroachGenericSqlExecutor;
  synthesis?: ContextPackEphemeralSynthesisPort | undefined;
  telemetryEvidence?: ContextPackTelemetryEvidencePort | undefined;
}): ContextPackBuilderPort {
  const tenantConfigs = createCockroachTenantConfigStore({ executor: input.executor });
  return createDeterministicContextPackBuilder({
    documents: createCockroachContextPackDocumentPort({
      docUnits: createCockroachDocUnitStore({ executor: input.executor }),
      docEntities: createCockroachDocEntityStore({ executor: input.executor }),
      consultOutcomes: createCockroachDocConsultLedgerStore({ executor: input.executor }),
    }),
    graph: createCockroachGraphStore({ executor: input.executor }),
    memory: createMemoryContextPackRecallPort({
      memory: createCockroachMemory({ executor: input.executor }),
      governance: createCockroachContextPackMemoryEnvelopeReader({ executor: input.executor }),
      providerId: COCKROACH_HINDSIGHT_CONTEXT_PROVIDER_ID,
    }),
    lifecycleAnchors: createCockroachContextPackLifecycleAnchorPort({
      executor: input.executor,
    }),
    inboxAnchors: createCockroachContextPackInboxAnchorPort({
      executor: input.executor,
    }),
    telemetryEvidence: input.telemetryEvidence,
    synthesis: input.synthesis,
    completenessPolicy: createTenantConfigContextPackCompletenessPolicy({
      tenantConfigs,
      fallback: createDefaultContextPackCompletenessPolicy(),
    }),
    curationIntentPolicy: createTenantConfigContextPackCurationIntentPolicy({
      tenantConfigs,
    }),
    synthesisRequirementPolicy: createTenantConfigContextPackSynthesisRequirementPolicy({
      tenantConfigs,
    }),
    advisoryPromotionPolicy: createDefaultContextPackAdvisoryPromotionPolicy({
      decisions: createCockroachContextPackAdvisoryPromotionDecisionStore({ executor: input.executor }),
    }),
    nodeIdForDocUnit: (unit) => graphNodeId(unit.organizationId, GraphNodeKind.DocUnit, unit.docUnitId),
    graphRootSeeds: createAgentCliContextGraphRootSeeds,
  });
}

export function createCockroachAgentCliContextPackReadinessPolicy(input: {
  executor: CockroachGenericSqlExecutor;
}): ContextPackReadinessPolicyPort {
  return createTenantConfigContextPackReadinessPolicy({
    tenantConfigs: createCockroachTenantConfigStore({ executor: input.executor }),
    fallback: createDefaultContextPackReadinessPolicy(),
  });
}

function createAgentCliContextPackSynthesisFromEnv(
  env: Readonly<Record<string, string | undefined>>,
): ContextPackEphemeralSynthesisPort | undefined {
  const baseUrl = firstNonEmptyEnv(env, CONTEXT_SYNTHESIS_ENV.BaseUrl, CONTEXT_SYNTHESIS_ENV.FallbackBaseUrl);
  const model = firstNonEmptyEnv(env, CONTEXT_SYNTHESIS_ENV.Model, CONTEXT_SYNTHESIS_ENV.FallbackModel);
  if (baseUrl === undefined || model === undefined) return undefined;
  return createModelBackedContextPackSynthesisPort({
    chat: createOllamaChatPort({ baseUrl, model }),
  });
}

function createAgentCliContextPackRuntimeEvidenceFromEnv(input: {
  env: Readonly<Record<string, string | undefined>>;
  now: () => string;
  fetchImpl?: typeof fetch | undefined;
}): ContextPackTelemetryEvidencePort | undefined {
  const mimirBaseUrl = input.env[CONTEXT_RUNTIME_EVIDENCE_ENV.MimirBaseUrl];
  const tempoBaseUrl = input.env[CONTEXT_RUNTIME_EVIDENCE_ENV.TempoBaseUrl];
  const lokiBaseUrl = input.env[CONTEXT_RUNTIME_EVIDENCE_ENV.LokiBaseUrl];
  if (mimirBaseUrl === undefined || tempoBaseUrl === undefined || lokiBaseUrl === undefined) return undefined;

  return createLgtmContextPackRuntimeEvidencePort({
    telemetry: createLgtmTelemetryQueryPort({
      mimirBaseUrl,
      tempoBaseUrl,
      lokiBaseUrl,
      ...createOptionalFetchImpl(input.fetchImpl),
    }),
    range: {
      start: input.env[CONTEXT_RUNTIME_EVIDENCE_ENV.RangeStart] ?? oneHourBefore(input.now()),
      end: input.env[CONTEXT_RUNTIME_EVIDENCE_ENV.RangeEnd] ?? input.now(),
    },
  });
}

function firstNonEmptyEnv(
  env: Readonly<Record<string, string | undefined>>,
  primary: string,
  fallback: string,
): string | undefined {
  const primaryValue = env[primary]?.trim();
  if (primaryValue !== undefined && primaryValue.length > 0) return primaryValue;
  const fallbackValue = env[fallback]?.trim();
  return fallbackValue === undefined || fallbackValue.length === 0 ? undefined : fallbackValue;
}

function oneHourBefore(iso: string): string {
  return new Date(new Date(iso).getTime() - 60 * 60 * 1000).toISOString();
}

function createAgentCliContextGraphRootSeeds(request: ContextPackBuildRequest): readonly ContextPackGraphRootSeed[] {
  const organizationId = request.snapshot.organizationId;
  if (organizationId === undefined) return [];
  return uniqueContextGraphRootSeeds([
    ...(request.snapshot.workItemId === undefined
      ? []
      : [workItemGraphRootSeed(organizationId, request.snapshot.workItemId, CONTEXT_GRAPH_ROOT_REASON.WorkItemLifecycle)]),
    ...(request.hierarchy.mission === undefined
      ? []
      : [missionGraphRootSeed(organizationId, request.hierarchy.mission.mission.missionId)]),
    hatGraphRootSeed(organizationId, request.snapshot.hat.id),
    ...(request.snapshot.projectId === undefined
      ? []
      : [projectGraphRootSeed(organizationId, request.snapshot.projectId, projectNameFor(request, request.snapshot.projectId))]),
    ...takeContextGraphRootSeeds(
      request.hierarchy.initiatives.map((initiative) =>
        initiativeGraphRootSeed(organizationId, initiative.initiativeId, initiative.title),
      ),
      CONTEXT_GRAPH_ROOT_LIMIT.HierarchyInitiatives,
    ),
    ...(request.snapshot.teamId === undefined ? [] : [teamGraphRootSeed(organizationId, request.snapshot.teamId)]),
    organizationGraphRootSeed(organizationId),
    ...takeContextGraphRootSeeds(
      request.hierarchy.projects.map((project) =>
        projectGraphRootSeed(organizationId, project.projectId, project.name),
      ),
      CONTEXT_GRAPH_ROOT_LIMIT.HierarchyProjects,
    ),
    ...takeContextGraphRootSeeds(
      request.hierarchy.priorityItems.flatMap((item) => priorityItemGraphRootSeed(organizationId, item)),
      CONTEXT_GRAPH_ROOT_LIMIT.PriorityItems,
    ),
  ]);
}

function organizationGraphRootSeed(organizationId: string): ContextPackGraphRootSeed {
  return {
    nodeId: graphNodeId(organizationId, GraphNodeKind.Organization, organizationId),
    title: `Organization context for ${organizationId}`,
    citationRefs: [`org:${organizationId}`],
    reasons: [CONTEXT_GRAPH_ROOT_REASON.OrganizationRuntime],
  };
}

function projectGraphRootSeed(
  organizationId: string,
  projectId: string,
  projectName: string,
): ContextPackGraphRootSeed {
  return {
    nodeId: graphNodeId(organizationId, GraphNodeKind.Project, projectId),
    title: `Project context for ${projectName}`,
    citationRefs: [`project:${projectId}`],
    reasons: [CONTEXT_GRAPH_ROOT_REASON.ProjectTrajectory],
  };
}

function teamGraphRootSeed(organizationId: string, teamId: string): ContextPackGraphRootSeed {
  return {
    nodeId: graphNodeId(organizationId, GraphNodeKind.Team, teamId),
    title: `Team context for ${teamId}`,
    citationRefs: [`team:${teamId}`],
    reasons: [CONTEXT_GRAPH_ROOT_REASON.TeamCoordination],
  };
}

function hatGraphRootSeed(organizationId: string, hatId: string): ContextPackGraphRootSeed {
  return {
    nodeId: graphNodeId(organizationId, GraphNodeKind.Hat, hatId),
    title: `Hat context for ${hatId}`,
    citationRefs: [`hat:${hatId}`],
    reasons: [CONTEXT_GRAPH_ROOT_REASON.HatAuthority],
  };
}

function workItemGraphRootSeed(
  organizationId: string,
  workItemId: string,
  reason: string,
): ContextPackGraphRootSeed {
  return {
    nodeId: graphNodeId(organizationId, GraphNodeKind.WorkItem, workItemId),
    title: `Work item context for ${workItemId}`,
    citationRefs: [`work:${workItemId}`],
    reasons: [reason],
  };
}

function initiativeGraphRootSeed(
  organizationId: string,
  initiativeId: string,
  title: string,
): ContextPackGraphRootSeed {
  return {
    nodeId: graphNodeId(organizationId, GraphNodeKind.Initiative, initiativeId),
    title: `Initiative context for ${title}`,
    citationRefs: [`initiative:${initiativeId}`],
    reasons: [CONTEXT_GRAPH_ROOT_REASON.InitiativePriority],
  };
}

function missionGraphRootSeed(organizationId: string, missionId: string): ContextPackGraphRootSeed {
  return {
    nodeId: graphNodeId(organizationId, GraphNodeKind.Mission, missionId),
    title: `Mission context for ${missionId}`,
    citationRefs: [`mission:${missionId}`],
    reasons: [CONTEXT_GRAPH_ROOT_REASON.MissionManagement],
  };
}

function priorityItemGraphRootSeed(
  organizationId: string,
  item: ContextPackBuildRequest["hierarchy"]["priorityItems"][number],
): readonly ContextPackGraphRootSeed[] {
  if (item.kind === "project") {
    return [{
      ...projectGraphRootSeed(organizationId, item.itemId, item.label),
      reasons: [CONTEXT_GRAPH_ROOT_REASON.ProjectTrajectory, CONTEXT_GRAPH_ROOT_REASON.PriorityItem],
    }];
  }
  if (item.kind === "initiative") {
    return [{
      ...initiativeGraphRootSeed(organizationId, item.itemId, item.label),
      reasons: [CONTEXT_GRAPH_ROOT_REASON.InitiativePriority, CONTEXT_GRAPH_ROOT_REASON.PriorityItem],
    }];
  }
  if (item.kind === "work_item") {
    return [workItemGraphRootSeed(organizationId, item.itemId, CONTEXT_GRAPH_ROOT_REASON.PriorityItem)];
  }
  return [];
}

function projectNameFor(request: ContextPackBuildRequest, projectId: string): string {
  return request.hierarchy.projects.find((project) => project.projectId === projectId)?.name ?? projectId;
}

function uniqueContextGraphRootSeeds(seeds: readonly ContextPackGraphRootSeed[]): readonly ContextPackGraphRootSeed[] {
  const merged = new Map<string, ContextPackGraphRootSeed>();
  for (const seed of seeds) {
    const existing = merged.get(seed.nodeId);
    if (existing === undefined) {
      merged.set(seed.nodeId, seed);
      continue;
    }
    merged.set(seed.nodeId, {
      ...existing,
      citationRefs: uniqueStrings([...(existing.citationRefs ?? []), ...(seed.citationRefs ?? [])]),
      reasons: uniqueStrings([...(existing.reasons ?? []), ...(seed.reasons ?? [])]),
    });
  }
  return [...merged.values()];
}

function takeContextGraphRootSeeds(
  seeds: readonly ContextPackGraphRootSeed[],
  limit: number,
): readonly ContextPackGraphRootSeed[] {
  return seeds.slice(0, limit);
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function createRunAgentCliCycleInput(
  input: RunAgentCliMainInput,
  runtime: AgentCliMainRuntime,
): { ok: true; value: Parameters<typeof runAgentCliCycle>[0] } | { ok: false; message: string } {
  const parsed = parseAgentCliArgs(input.argv);
  const authorizeSlot = runtime.authorizeSlot ?? (
    parsed.ok ? createAgentCliControlPlaneSlotAuthorizer(runtime, parsed.value, input.now) : undefined
  );
  const promptFlowTasks = tryCreateAgentCliPromptFlowTasksFromEnv({
    env: input.env,
  });
  if (!promptFlowTasks.ok) return { ok: false, message: promptFlowTasks.message };

  const hierarchy = tryCreateAgentCliHierarchyFromEnv({
    env: input.env,
  });
  if (!hierarchy.ok) return { ok: false, message: hierarchy.message };

  const workQueues = tryCreateAgentCliWorkQueuesFromEnv({
    env: input.env,
  });
  if (!workQueues.ok) return { ok: false, message: workQueues.message };

  return {
    ok: true,
    value: {
      argv: input.argv,
      now: input.now,
      writeStdout: input.writeStdout,
      writeStderr: input.writeStderr,
      metricAgents: createAgentCliMetricAgentsFromEnv({
        env: input.env,
        now: input.now,
        ...createOptionalFetchImpl(input.fetchImpl),
      }),
      promptFlowTasks: promptFlowTasks.value,
      hierarchy: hierarchy.value,
      workQueues: workQueues.value,
      selectSlot: createAgentCliSelectorFromEnv({
        env: input.env,
        ...createOptionalFetchImpl(input.fetchImpl),
      }),
      runCommand: runtime.runCommand,
      dispatchTool: runtime.dispatchTool,
      ...createOptionalAuthorizeSlot(authorizeSlot),
      ...createOptionalLoadPromptFlowContext(runtime.loadPromptFlowContext),
      ...createOptionalAvailableSecretScopes(runtime.availableSecretScopes),
      ...createOptionalContextPackBuilder(runtime.contextPackBuilder),
      ...createOptionalContextPackReadinessPolicy(runtime.contextPackReadinessPolicy),
      ...createOptionalContextReadinessEnforcement(runtime.enforceContextReadiness),
      ...createOptionalContextPackSnapshotLoader(runtime.loadLatestContextPackSnapshot),
      ...createOptionalContextPackSnapshotRecorder(runtime.recordContextPackSnapshot),
      ...createOptionalContextPackInboxWorkflowLoader(runtime.loadContextPackInboxWorkflow),
      ...createOptionalContextPackAdvisoryPromotionDecisionLoader(
        runtime.loadContextPackAdvisoryPromotionDecisions,
      ),
    },
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
    ...selectedSemanticEvidenceRefs(evidence),
    ...evidence.selectorRejections.flatMap(selectorRejectionEvidenceRefs),
    ...statusEvidenceRefs(evidence),
    ...actionRejectionEvidenceRefs(evidence),
    ...contextPackEvidenceRefs(evidence),
    ...contextPackRefreshEvidenceRefs(evidence),
    ...evidence.promptFlowIds.map((id) => `observe-act:prompt_flow:${id}`),
    ...evidence.metricBlockIds.map((id) => `observe-act:metric:${id}`),
  ];
}

function contextPackEvidenceRefs(evidence: AgentCliCycleEvidence): readonly string[] {
  return [
    ...(evidence.contextPackId === undefined ? [] : [`observe-act:context_pack:${evidence.contextPackId}`]),
    ...(evidence.contextPackStatus === undefined ? [] : [`observe-act:context_status:${evidence.contextPackStatus}`]),
    ...createOptionalEvidenceNumberRef("context_required_count", evidence.contextRequiredItemCount),
    ...createOptionalEvidenceNumberRef("context_optional_count", evidence.contextOptionalItemCount),
    ...createOptionalEvidenceNumberRef("context_omission_count", evidence.contextOmissionCount),
    ...createOptionalEvidenceNumberRef("context_contradiction_count", evidence.contextContradictionCount),
    ...createOptionalEvidenceNumberRef("context_stale_count", evidence.contextStaleInputCount),
    ...createOptionalEvidenceNumberRef("context_blocker_count", evidence.contextLifecycleBlockerCount),
    ...(evidence.contextSourceGraphVersion === undefined ? [] : [`observe-act:context_source_graph:${evidence.contextSourceGraphVersion}`]),
    ...(evidence.contextPolicyVersion === undefined ? [] : [`observe-act:context_policy:${evidence.contextPolicyVersion}`]),
    ...evidence.contextCurationStages.map((stage) => `observe-act:context_curation_stage:${stage}`),
    ...evidence.contextRequiredItemIds.map((id) => `observe-act:context_required_item:${id}`),
    ...evidence.contextSourcePointerRefs.map((ref) => `observe-act:context_source:${ref}`),
  ];
}

function createOptionalEvidenceNumberRef(label: string, value: number | undefined): readonly string[] {
  return value === undefined ? [] : [`observe-act:${label}:${value}`];
}

function contextPackRefreshEvidenceRefs(evidence: AgentCliCycleEvidence): readonly string[] {
  return [
    ...(evidence.contextRefreshReason === undefined
      ? []
      : [`observe-act:context_refresh_reason:${evidence.contextRefreshReason}`]),
    ...(evidence.contextRefreshRequiresBuild === undefined
      ? []
      : [`observe-act:context_refresh_policy_requires_build:${String(evidence.contextRefreshRequiresBuild)}`]),
    ...(evidence.previousContextPackId === undefined
      ? []
      : [`observe-act:previous_context_pack:${evidence.previousContextPackId}`]),
    ...(evidence.previousContextPackStatus === undefined
      ? []
      : [`observe-act:previous_context_status:${evidence.previousContextPackStatus}`]),
  ];
}

async function appendObserveActFailureEvidenceIfPresent(
  input: RunAgentCliMainInput,
  runtime: AgentCliMainRuntime,
  failureEvidence: AgentCliCycleFailureEvidence | undefined,
): Promise<number | undefined> {
  if (failureEvidence === undefined || runtime.appendObserveActTick === undefined) return undefined;
  const parsed = parseAgentCliArgs(input.argv);
  if (!parsed.ok) return undefined;
  try {
    await runtime.appendObserveActTick(createAgentCliObserveActFailureEvent(parsed.value, failureEvidence, input.now()));
    return undefined;
  } catch (error) {
    input.writeStderr(`agent CLI failure evidence append failed: ${extractErrorMessage(error)}\n`);
    return 1;
  }
}

function createAgentCliObserveActFailureEvent(
  args: ParsedAgentCliArgs,
  failureEvidence: AgentCliCycleFailureEvidence,
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
    decision: `observe-act failed before menu for run ${args.runId}`,
    supervisorChain: [args.hatId],
    evidenceRefs: [
      `observe-act:failure:${failureEvidence.kind}`,
      `observe-act:failure_message:${failureEvidence.message}`,
    ],
    correlationId: traceId,
    causationId: eventId,
    traceId,
  };
}

function selectedSemanticEvidenceRefs(evidence: AgentCliCycleEvidence): readonly string[] {
  return [
    ...(evidence.selectedImplKind === undefined ? [] : [`observe-act:selected_impl:${evidence.selectedImplKind}`]),
    ...(evidence.actionOutcome === undefined ? [] : [`observe-act:action_outcome:${evidence.actionOutcome}`]),
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
    ...createOptionalFetchImpl(input.fetchImpl),
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

function createOptionalContextPackBuilder(
  contextPackBuilder: AgentCliMainRuntime["contextPackBuilder"],
): { contextPackBuilder?: ContextPackBuilderPort } {
  return contextPackBuilder === undefined ? {} : { contextPackBuilder };
}

function createOptionalContextPackReadinessPolicy(
  contextPackReadinessPolicy: AgentCliMainRuntime["contextPackReadinessPolicy"],
): { contextPackReadinessPolicy?: ContextPackReadinessPolicyPort } {
  return contextPackReadinessPolicy === undefined ? {} : { contextPackReadinessPolicy };
}

function createOptionalContextReadinessEnforcement(
  enforceContextReadiness: AgentCliMainRuntime["enforceContextReadiness"],
): { enforceContextReadiness?: boolean } {
  return enforceContextReadiness === undefined ? {} : { enforceContextReadiness };
}

function createOptionalContextPackSnapshotRecorder(
  recordContextPackSnapshot: AgentCliMainRuntime["recordContextPackSnapshot"],
): { recordContextPackSnapshot?: ContextPackSnapshotStorePort["record"] } {
  return recordContextPackSnapshot === undefined ? {} : { recordContextPackSnapshot };
}

function createOptionalContextPackSnapshotLoader(
  loadLatestContextPackSnapshot: AgentCliMainRuntime["loadLatestContextPackSnapshot"],
): { loadLatestContextPackSnapshot?: ContextPackSnapshotStorePort["latestForScope"] } {
  return loadLatestContextPackSnapshot === undefined ? {} : { loadLatestContextPackSnapshot };
}

function createOptionalContextPackInboxWorkflowLoader(
  loadContextPackInboxWorkflow: AgentCliMainRuntime["loadContextPackInboxWorkflow"],
): Pick<AgentCliCycleInput, "loadContextPackInboxWorkflow"> {
  return loadContextPackInboxWorkflow === undefined ? {} : { loadContextPackInboxWorkflow };
}

function createOptionalContextPackAdvisoryPromotionDecisionLoader(
  loadContextPackAdvisoryPromotionDecisions: AgentCliMainRuntime["loadContextPackAdvisoryPromotionDecisions"],
): Pick<AgentCliCycleInput, "loadContextPackAdvisoryPromotionDecisions"> {
  return loadContextPackAdvisoryPromotionDecisions === undefined
    ? {}
    : { loadContextPackAdvisoryPromotionDecisions };
}

function extractErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
