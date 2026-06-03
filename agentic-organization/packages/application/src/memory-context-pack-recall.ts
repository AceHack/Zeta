import type {
  Memory,
  MemoryAttribution,
  MemoryRecord,
} from "../../memory/src/index.ts";
import {
  isTerminalMemory,
  type MemoryEnvelope,
} from "../../domain/src/index.ts";
import {
  computeMemoryWeight,
  readFloorFor,
  type RetrievalCtx,
} from "./memory-ranking.ts";
import type {
  ContextPackMemoryRecall,
  ContextPackMemoryRecallPort,
  ContextPackMemoryRecallRequest,
  ContextPackMemoryRecallResult,
} from "./context-pack-builder.ts";
import {
  ContextPackMemorySimilarityCategory,
  ContextPackOmissionReason,
  type ContextPackMemoryGovernanceExplanation,
  type ContextPackOmittedItem,
} from "./observe.ts";

export type CreateMemoryContextPackRecallPortInput = {
  memory: Memory;
  governance?: ContextPackMemoryEnvelopeReaderPort | undefined;
  providerId?: string | undefined;
  maxMemories?: number | undefined;
  confidence?: number | undefined;
};

export type ContextPackMemoryEnvelopeReaderRequest = {
  organizationId: string;
  memoryIds: readonly string[];
};

export type ContextPackMemoryEnvelopeReaderPort = {
  listByMemoryIds: (
    request: ContextPackMemoryEnvelopeReaderRequest,
  ) => Promise<readonly MemoryEnvelope[]> | readonly MemoryEnvelope[];
};

type RankedContextPackMemoryRecall = {
  recall: ContextPackMemoryRecall;
  governanceWeight?: number | undefined;
};

type MemoryGovernanceForContextPackRecall = {
  envelope: MemoryEnvelope;
  weight: number;
  readFloor: number;
};

const DEFAULT_CONTEXT_PACK_MEMORY_PROVIDER_ID = "memory";
const DEFAULT_CONTEXT_PACK_MEMORY_MAX_MEMORIES = 5;
const CONTEXT_PACK_MEMORY_SIMILARITY_CONFIDENCE: Readonly<Record<ContextPackMemorySimilarityCategory, number>> = {
  [ContextPackMemorySimilarityCategory.SameHatSameWorkItem]: 0.9,
  [ContextPackMemorySimilarityCategory.SameWorkItem]: 0.82,
  [ContextPackMemorySimilarityCategory.SameHatDifferentWorkItem]: 0.74,
  [ContextPackMemorySimilarityCategory.SameProjectDifferentWorkItem]: 0.66,
  [ContextPackMemorySimilarityCategory.ProjectScoped]: 0.58,
  [ContextPackMemorySimilarityCategory.CrossProject]: 0.2,
};
const CONTEXT_PACK_MEMORY_SIMILARITY_RANK: Readonly<Record<ContextPackMemorySimilarityCategory, number>> = {
  [ContextPackMemorySimilarityCategory.SameHatSameWorkItem]: 0,
  [ContextPackMemorySimilarityCategory.SameWorkItem]: 1,
  [ContextPackMemorySimilarityCategory.SameHatDifferentWorkItem]: 2,
  [ContextPackMemorySimilarityCategory.SameProjectDifferentWorkItem]: 3,
  [ContextPackMemorySimilarityCategory.ProjectScoped]: 4,
  [ContextPackMemorySimilarityCategory.CrossProject]: 5,
};
const CONTEXT_PACK_MEMORY_RECALL_REASON = {
  ProjectScoped: "project-scoped memory recall",
  HatPrefix: "hat:",
  GovernancePhasePrefix: "governance-phase:",
  GovernanceScopePrefix: "governance-scope:",
  GovernanceTierPrefix: "governance-tier:",
  SimilarityPrefix: "similarity:",
  RequestedWorkPrefix: "requested-work:",
  SourceWorkPrefix: "source-work:",
  UnscopedWork: "unscoped",
} as const;
const CONTEXT_PACK_MEMORY_RECALL_QUERY_SEPARATOR = ":";
const CONTEXT_PACK_MEMORY_SCOPE_NODE_PREFIX = "memory_scope";
const PROJECT_MEMORY_RECALL_WORK_SCOPE_PREFIX = "project:";

export const ContextPackMemoryScopeGap = {
  MissingAgentId: "missing_agent_id",
  MissingProjectId: "missing_project_id",
  MissingWorkItemId: "missing_work_item_id",
} as const;

export type ContextPackMemoryScopeGap = (typeof ContextPackMemoryScopeGap)[keyof typeof ContextPackMemoryScopeGap];

const CONTEXT_PACK_MEMORY_SCOPE_GAP_MESSAGES: Readonly<Record<ContextPackMemoryScopeGap, string>> = {
  [ContextPackMemoryScopeGap.MissingAgentId]: "memory recall requires agent scope for context-pack retrieval",
  [ContextPackMemoryScopeGap.MissingProjectId]: "memory recall requires project scope for context-pack retrieval",
  [ContextPackMemoryScopeGap.MissingWorkItemId]: "memory recall requires work-item scope for context-pack retrieval",
};

export function createMemoryContextPackRecallPort(
  input: CreateMemoryContextPackRecallPortInput,
): ContextPackMemoryRecallPort {
  return {
    async recall(request): Promise<ContextPackMemoryRecallResult> {
      const attribution = attributionForContextPackRecall(request);
      if (attribution === undefined) {
        return {
          memories: [],
          omittedItemsWithReason: memoryScopeOmissionsFor(request),
        };
      }
      const recalled = await input.memory.recall(attribution);
      const memories = await rankedMemoryRecallsFor(recalled.memories, request, input);
      return {
        memories: memories
          .slice(0, input.maxMemories ?? DEFAULT_CONTEXT_PACK_MEMORY_MAX_MEMORIES)
          .map((memory) => memory.recall),
      };
    },
  };
}

export function contextPackMemorySimilarityConfidenceFor(
  category: ContextPackMemorySimilarityCategory,
): number {
  return CONTEXT_PACK_MEMORY_SIMILARITY_CONFIDENCE[category];
}

function memoryScopeOmissionsFor(request: ContextPackMemoryRecallRequest): readonly ContextPackOmittedItem[] {
  return memoryScopeGapsFor(request).map((gap) => ({
    nodeId: `${CONTEXT_PACK_MEMORY_SCOPE_NODE_PREFIX}:${gap}`,
    reason: ContextPackOmissionReason.OutOfScope,
    message: CONTEXT_PACK_MEMORY_SCOPE_GAP_MESSAGES[gap],
  }));
}

function memoryScopeGapsFor(request: ContextPackMemoryRecallRequest): readonly ContextPackMemoryScopeGap[] {
  return [
    ...(request.agentId === undefined ? [ContextPackMemoryScopeGap.MissingAgentId] : []),
    ...(request.projectId === undefined ? [ContextPackMemoryScopeGap.MissingProjectId] : []),
  ];
}

function attributionForContextPackRecall(
  request: ContextPackMemoryRecallRequest,
): MemoryAttribution | undefined {
  if (
    request.agentId === undefined ||
    request.projectId === undefined
  ) {
    return undefined;
  }
  return {
    agentId: request.agentId,
    hatAssignmentId: request.hatAssignmentId,
    projectId: request.projectId,
    workItemId: request.workItemId ?? projectMemoryRecallWorkScope(request.projectId),
    promptFlowRunId: request.runId,
  };
}

function projectMemoryRecallWorkScope(projectId: string): string {
  return `${PROJECT_MEMORY_RECALL_WORK_SCOPE_PREFIX}${projectId}`;
}

async function rankedMemoryRecallsFor(
  memories: readonly MemoryRecord[],
  request: ContextPackMemoryRecallRequest,
  input: CreateMemoryContextPackRecallPortInput,
): Promise<readonly RankedContextPackMemoryRecall[]> {
  const envelopeById = await memoryEnvelopeByIdFor(memories, request, input);
  return memories
    .flatMap((memory) => rankedMemoryRecallFor(memory, request, input, envelopeById))
    .sort(compareRankedContextPackMemoryRecall);
}

async function memoryEnvelopeByIdFor(
  memories: readonly MemoryRecord[],
  request: ContextPackMemoryRecallRequest,
  input: CreateMemoryContextPackRecallPortInput,
): Promise<ReadonlyMap<string, MemoryEnvelope> | undefined> {
  if (input.governance === undefined || request.organizationId === undefined) {
    return undefined;
  }
  const memoryIds = [...new Set(memories.map((memory) => memory.memoryId))];
  const envelopes = await input.governance.listByMemoryIds({
    organizationId: request.organizationId,
    memoryIds,
  });
  return new Map(envelopes.map((envelope) => [envelope.memoryId, envelope]));
}

function rankedMemoryRecallFor(
  memory: MemoryRecord,
  request: ContextPackMemoryRecallRequest,
  input: CreateMemoryContextPackRecallPortInput,
  envelopeById: ReadonlyMap<string, MemoryEnvelope> | undefined,
): readonly RankedContextPackMemoryRecall[] {
  if (envelopeById === undefined) {
    return [{ recall: memoryRecallFor(memory, request, input) }];
  }

  const envelope = envelopeById.get(memory.memoryId);
  if (envelope === undefined || isTerminalMemory(envelope.state.phase)) {
    return [];
  }

  const similarityCategory = memorySimilarityCategoryFor(memory, request);
  const governanceWeight = governanceWeightFor(envelope, request, similarityCategory);
  const readFloor = readFloorFor(envelope.tier);
  if (governanceWeight < readFloor) {
    return [];
  }

  return [{
    recall: memoryRecallFor(memory, request, input, { envelope, weight: governanceWeight, readFloor }),
    governanceWeight,
  }];
}

function memoryRecallFor(
  memory: MemoryRecord,
  request: ContextPackMemoryRecallRequest,
  input: CreateMemoryContextPackRecallPortInput,
  governance?: MemoryGovernanceForContextPackRecall | undefined,
): ContextPackMemoryRecall {
  const similarityCategory = memorySimilarityCategoryFor(memory, request);
  const envelope = governance?.envelope;
  return {
    memoryId: memory.memoryId,
    providerId: input.providerId ?? DEFAULT_CONTEXT_PACK_MEMORY_PROVIDER_ID,
    summary: memory.content,
    confidence: input.confidence ?? contextPackMemorySimilarityConfidenceFor(similarityCategory),
    retainedAt: new Date(memory.retainedAtMs).toISOString(),
    advisory: true,
    reasons: [
      CONTEXT_PACK_MEMORY_RECALL_REASON.ProjectScoped,
      `${CONTEXT_PACK_MEMORY_RECALL_REASON.SimilarityPrefix}${similarityCategory}`,
      `${CONTEXT_PACK_MEMORY_RECALL_REASON.HatPrefix}${request.hatId}`,
      `${CONTEXT_PACK_MEMORY_RECALL_REASON.RequestedWorkPrefix}${request.workItemId ?? CONTEXT_PACK_MEMORY_RECALL_REASON.UnscopedWork}`,
      `${CONTEXT_PACK_MEMORY_RECALL_REASON.SourceWorkPrefix}${memory.attribution.workItemId}`,
      ...(envelope === undefined
        ? []
        : [
            `${CONTEXT_PACK_MEMORY_RECALL_REASON.GovernanceTierPrefix}${envelope.tier}`,
            `${CONTEXT_PACK_MEMORY_RECALL_REASON.GovernancePhasePrefix}${envelope.state.phase}`,
            `${CONTEXT_PACK_MEMORY_RECALL_REASON.GovernanceScopePrefix}${envelope.scope}`,
          ]),
    ],
    creatingAgentId: memory.attribution.agentId,
    creatingHatAssignmentId: memory.attribution.hatAssignmentId,
    creatingProjectId: memory.attribution.projectId,
    creatingWorkItemId: memory.attribution.workItemId,
    creatingPromptFlowRunId: memory.attribution.promptFlowRunId,
    recallAgentId: request.agentId,
    recallHatAssignmentId: request.hatAssignmentId,
    recallProjectId: request.projectId,
    recallWorkItemId: request.workItemId,
    recallQueryId: `${request.runId}${CONTEXT_PACK_MEMORY_RECALL_QUERY_SEPARATOR}${request.hatAssignmentId}`,
    similarityCategory,
    ...(governance === undefined ? {} : { governance: memoryGovernanceExplanationFor(governance) }),
  };
}

function memoryGovernanceExplanationFor(
  governance: MemoryGovernanceForContextPackRecall,
): ContextPackMemoryGovernanceExplanation {
  const { envelope } = governance;
  return {
    tier: envelope.tier,
    phase: envelope.state.phase,
    scope: envelope.scope,
    weight: governance.weight,
    readFloor: governance.readFloor,
    freshnessAt: envelope.state.freshnessAt,
    outcome: {
      successCount: envelope.state.outcome.successCount,
      failureCount: envelope.state.outcome.failureCount,
      inconclusiveCount: envelope.state.outcome.inconclusiveCount,
    },
    utility: {
      injectedCount: envelope.state.utility.injectedCount,
      citedCount: envelope.state.utility.citedCount,
    },
  };
}

function compareRankedContextPackMemoryRecall(
  a: RankedContextPackMemoryRecall,
  b: RankedContextPackMemoryRecall,
): number {
  const rankDelta = similarityRankFor(a.recall.similarityCategory) - similarityRankFor(b.recall.similarityCategory);
  if (rankDelta !== 0) return rankDelta;
  const governanceDelta = (b.governanceWeight ?? -1) - (a.governanceWeight ?? -1);
  if (governanceDelta !== 0) return governanceDelta;
  const retainedDelta = Date.parse(b.recall.retainedAt) - Date.parse(a.recall.retainedAt);
  if (retainedDelta !== 0) return retainedDelta;
  return a.recall.memoryId.localeCompare(b.recall.memoryId);
}

function similarityRankFor(category: ContextPackMemorySimilarityCategory | undefined): number {
  return category === undefined
    ? Number.MAX_SAFE_INTEGER
    : CONTEXT_PACK_MEMORY_SIMILARITY_RANK[category];
}

function memorySimilarityCategoryFor(
  memory: MemoryRecord,
  request: ContextPackMemoryRecallRequest,
): ContextPackMemorySimilarityCategory {
  if (memory.attribution.projectId !== request.projectId) {
    return ContextPackMemorySimilarityCategory.CrossProject;
  }
  if (request.workItemId === undefined) {
    return ContextPackMemorySimilarityCategory.ProjectScoped;
  }
  if (
    memory.attribution.workItemId === request.workItemId &&
    memory.attribution.hatAssignmentId === request.hatAssignmentId
  ) {
    return ContextPackMemorySimilarityCategory.SameHatSameWorkItem;
  }
  if (memory.attribution.workItemId === request.workItemId) {
    return ContextPackMemorySimilarityCategory.SameWorkItem;
  }
  if (memory.attribution.hatAssignmentId === request.hatAssignmentId) {
    return ContextPackMemorySimilarityCategory.SameHatDifferentWorkItem;
  }
  return ContextPackMemorySimilarityCategory.SameProjectDifferentWorkItem;
}

function governanceWeightFor(
  envelope: MemoryEnvelope,
  request: ContextPackMemoryRecallRequest,
  similarityCategory: ContextPackMemorySimilarityCategory,
): number {
  return computeMemoryWeight(envelope, governanceRetrievalContextFor(request, similarityCategory));
}

function governanceRetrievalContextFor(
  request: ContextPackMemoryRecallRequest,
  similarityCategory: ContextPackMemorySimilarityCategory,
): RetrievalCtx {
  return {
    now: observedAtMsFor(request.observedAt),
    organizationId: request.organizationId ?? "",
    hatId: request.hatId,
    agentId: request.agentId ?? "",
    workItemId: request.workItemId ?? projectMemoryRecallWorkScope(request.projectId ?? ""),
    semanticScore: contextPackMemorySimilarityConfidenceFor(similarityCategory),
  };
}

function observedAtMsFor(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
