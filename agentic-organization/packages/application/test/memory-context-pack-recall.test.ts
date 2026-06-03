import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  ContextPackMemorySimilarityCategory,
  ContextPackOmissionReason,
  contextPackMemorySimilarityConfidenceFor,
  createMemoryContextPackRecallPort,
} from "../src/index.ts";
import {
  MemoryPhase,
  MemoryTier,
  type MemoryEnvelope,
} from "../../domain/src/index.ts";
import type { Memory, MemoryAttribution } from "../../memory/src/index.ts";
import { readFloorFor } from "../src/memory-ranking.ts";

test("memory context-pack recall maps sticky memory attribution into context memory pointers", async () => {
  const recalledAttributions: MemoryAttribution[] = [];
  const port = createMemoryContextPackRecallPort({
    memory: {
      retain: async () => {
        throw new Error("not used");
      },
      reflect: async () => {
        throw new Error("not used");
      },
      recall: async (attribution) => {
        recalledAttributions.push(attribution);
        return {
          operation: "recall",
          memories: [
            {
              memoryId: "mem-1",
              content: "Prior reviewer learned the release gate needs screenshots.",
              retainedAtMs: Date.parse("2026-05-30T00:00:00.000Z"),
              attribution: {
                agentId: "agent-author",
                hatAssignmentId: "hat-author",
                projectId: "project-1",
                workItemId: "work-9",
                promptFlowRunId: "run-9",
              },
            },
          ],
        };
      },
    } satisfies Memory,
    providerId: "cockroach_hindsight",
    maxMemories: 1,
  });

  const result = await port.recall({
    query: "release operator awaiting gate",
    runId: "run-1",
    observedAt: "2026-05-31T00:00:00.000Z",
    hatId: "release_operator",
    hatAssignmentId: "hat-reader",
    agentId: "agent-reader",
    organizationId: "org-1",
    projectId: "project-1",
    workItemId: "work-1",
  });

  deepEqual(recalledAttributions, [
    {
      agentId: "agent-reader",
      hatAssignmentId: "hat-reader",
      projectId: "project-1",
      workItemId: "work-1",
      promptFlowRunId: "run-1",
    },
  ]);
  equal(result.memories[0]?.memoryId, "mem-1");
  equal(result.memories[0]?.providerId, "cockroach_hindsight");
  equal(result.memories[0]?.creatingAgentId, "agent-author");
  equal(result.memories[0]?.creatingHatAssignmentId, "hat-author");
  equal(result.memories[0]?.creatingProjectId, "project-1");
  equal(result.memories[0]?.creatingWorkItemId, "work-9");
  equal(result.memories[0]?.creatingPromptFlowRunId, "run-9");
  equal(result.memories[0]?.similarityCategory, ContextPackMemorySimilarityCategory.SameProjectDifferentWorkItem);
  equal(result.memories[0]?.recallAgentId, "agent-reader");
  equal(result.memories[0]?.recallHatAssignmentId, "hat-reader");
  equal(result.memories[0]?.recallProjectId, "project-1");
  equal(result.memories[0]?.recallWorkItemId, "work-1");
  equal(result.memories[0]?.retainedAt, "2026-05-30T00:00:00.000Z");
  equal(result.memories[0]?.advisory, true);
  deepEqual(result.memories[0]?.reasons, [
    "project-scoped memory recall",
    `similarity:${ContextPackMemorySimilarityCategory.SameProjectDifferentWorkItem}`,
    "hat:release_operator",
    "requested-work:work-1",
    "source-work:work-9",
  ]);
});

test("memory context-pack recall ranks by typed similarity before limiting and derives confidence from category", async () => {
  const port = createMemoryContextPackRecallPort({
    memory: {
      retain: async () => {
        throw new Error("not used");
      },
      reflect: async () => {
        throw new Error("not used");
      },
      recall: async () => ({
        operation: "recall",
        memories: [
          {
            memoryId: "mem-project-neighbor",
            content: "Neighbor work item mentions the same release gate.",
            retainedAtMs: Date.parse("2026-05-31T00:00:00.000Z"),
            attribution: {
              agentId: "agent-other",
              hatAssignmentId: "hat-other",
              projectId: "project-1",
              workItemId: "work-9",
              promptFlowRunId: "run-9",
            },
          },
          {
            memoryId: "mem-same-work",
            content: "Same work item from another hat found the release screenshot rule.",
            retainedAtMs: Date.parse("2026-05-30T00:00:00.000Z"),
            attribution: {
              agentId: "agent-other",
              hatAssignmentId: "hat-other",
              projectId: "project-1",
              workItemId: "work-1",
              promptFlowRunId: "run-8",
            },
          },
          {
            memoryId: "mem-same-hat-work",
            content: "Same hat and same work item captured the exact gate.",
            retainedAtMs: Date.parse("2026-05-29T00:00:00.000Z"),
            attribution: {
              agentId: "agent-reader",
              hatAssignmentId: "hat-reader",
              projectId: "project-1",
              workItemId: "work-1",
              promptFlowRunId: "run-7",
            },
          },
        ],
      }),
    } satisfies Memory,
    maxMemories: 2,
  });

  const result = await port.recall({
    query: "release operator awaiting gate",
    runId: "run-1",
    observedAt: "2026-05-31T00:00:00.000Z",
    hatId: "release_operator",
    hatAssignmentId: "hat-reader",
    agentId: "agent-reader",
    organizationId: "org-1",
    projectId: "project-1",
    workItemId: "work-1",
  });

  deepEqual(result.memories.map((memory) => memory.memoryId), [
    "mem-same-hat-work",
    "mem-same-work",
  ]);
  equal(result.memories[0]?.similarityCategory, ContextPackMemorySimilarityCategory.SameHatSameWorkItem);
  equal(
    result.memories[0]?.confidence,
    contextPackMemorySimilarityConfidenceFor(ContextPackMemorySimilarityCategory.SameHatSameWorkItem),
  );
  equal(result.memories[1]?.similarityCategory, ContextPackMemorySimilarityCategory.SameWorkItem);
  equal(
    result.memories[1]?.confidence,
    contextPackMemorySimilarityConfidenceFor(ContextPackMemorySimilarityCategory.SameWorkItem),
  );
});

test("memory context-pack recall joins durable governance envelopes before ranking and limiting", async () => {
  const envelopeLookups: string[][] = [];
  const port = createMemoryContextPackRecallPort({
    memory: {
      retain: async () => {
        throw new Error("not used");
      },
      reflect: async () => {
        throw new Error("not used");
      },
      recall: async () => ({
        operation: "recall",
        memories: [
          memoryRecord("mem-archived", "Archived same-work memory", "2026-05-31T00:00:00.000Z"),
          memoryRecord("mem-low-governance", "New but low-value same-work memory", "2026-05-30T00:00:00.000Z"),
          memoryRecord("mem-high-governance", "Older but useful same-work memory", "2026-05-29T00:00:00.000Z"),
        ],
      }),
    } satisfies Memory,
    governance: {
      listByMemoryIds: async (request) => {
        envelopeLookups.push([...request.memoryIds]);
        return [
          memoryEnvelope("mem-archived", { phase: MemoryPhase.Archived }),
          memoryEnvelope("mem-low-governance", {
            confidence: 0,
            freshnessAt: "1900-01-01T00:00:00.000Z",
            successCount: 0,
            failureCount: 5,
            injectedCount: 10,
            citedCount: 0,
          }),
          memoryEnvelope("mem-high-governance", {
            freshnessAt: "2026-05-31T00:00:00.000Z",
            successCount: 5,
            failureCount: 0,
            injectedCount: 10,
            citedCount: 8,
          }),
        ];
      },
    },
    maxMemories: 1,
  });

  const result = await port.recall({
    query: "release operator awaiting gate",
    runId: "run-1",
    observedAt: "2026-05-31T00:00:00.000Z",
    hatId: "release_operator",
    hatAssignmentId: "hat-reader",
    agentId: "agent-reader",
    organizationId: "org-1",
    projectId: "project-1",
    workItemId: "work-1",
  });

  deepEqual(envelopeLookups, [[
    "mem-archived",
    "mem-low-governance",
    "mem-high-governance",
  ]]);
  deepEqual(result.memories.map((memory) => memory.memoryId), ["mem-high-governance"]);
  equal(result.memories[0]?.similarityCategory, ContextPackMemorySimilarityCategory.SameWorkItem);
  equal(result.memories[0]?.governance?.tier, MemoryTier.Work);
  equal(result.memories[0]?.governance?.phase, MemoryPhase.Active);
  equal(result.memories[0]?.governance?.scope, "work-1");
  equal(result.memories[0]?.governance?.readFloor, readFloorFor(MemoryTier.Work));
  ok((result.memories[0]?.governance?.weight ?? 0) >= (result.memories[0]?.governance?.readFloor ?? 1));
  deepEqual(result.memories[0]?.governance?.outcome, {
    successCount: 5,
    failureCount: 0,
    inconclusiveCount: 0,
  });
  deepEqual(result.memories[0]?.governance?.utility, {
    injectedCount: 10,
    citedCount: 8,
  });
  equal(result.memories[0]?.governance?.freshnessAt, "2026-05-31T00:00:00.000Z");
  deepEqual(result.memories[0]?.reasons, [
    "project-scoped memory recall",
    `similarity:${ContextPackMemorySimilarityCategory.SameWorkItem}`,
    "hat:release_operator",
    "requested-work:work-1",
    "source-work:work-1",
    "governance-tier:work",
    "governance-phase:active",
    "governance-scope:work-1",
  ]);
});

test("memory context-pack recall reports an omission when the context lacks recall scope", async () => {
  let called = false;
  const port = createMemoryContextPackRecallPort({
    memory: {
      retain: async () => {
        throw new Error("not used");
      },
      reflect: async () => {
        throw new Error("not used");
      },
      recall: async () => {
        called = true;
        return { operation: "recall", memories: [] };
      },
    } satisfies Memory,
  });

  const result = await port.recall({
    query: "missing project",
    runId: "run-1",
    observedAt: "2026-05-31T00:00:00.000Z",
    hatId: "release_operator",
    hatAssignmentId: "hat-reader",
    agentId: "agent-reader",
    organizationId: "org-1",
  });

  equal(called, false);
  deepEqual(result.memories, []);
  deepEqual(result.omittedItemsWithReason, [
    {
      nodeId: "memory_scope:missing_project_id",
      reason: ContextPackOmissionReason.OutOfScope,
      message: "memory recall requires project scope for context-pack retrieval",
    },
  ]);
});

function memoryRecord(
  memoryId: string,
  content: string,
  retainedAt: string,
) {
  return {
    memoryId,
    content,
    retainedAtMs: Date.parse(retainedAt),
    attribution: {
      agentId: "agent-other",
      hatAssignmentId: "hat-other",
      projectId: "project-1",
      workItemId: "work-1",
      promptFlowRunId: "run-9",
    },
  };
}

function memoryEnvelope(
  memoryId: string,
  overrides: {
    phase?: MemoryPhase | undefined;
    confidence?: number | undefined;
    freshnessAt?: string | undefined;
    successCount?: number | undefined;
    failureCount?: number | undefined;
    injectedCount?: number | undefined;
    citedCount?: number | undefined;
  } = {},
): MemoryEnvelope {
  return {
    memoryId,
    organizationId: "org-1",
    tier: MemoryTier.Work,
    scope: "work-1",
    key: `memory:${memoryId}`,
    protected: false,
    writtenBy: "memory_curator",
    writtenAt: "2026-05-30T00:00:00.000Z",
    state: {
      memoryId,
      organizationId: "org-1",
      phase: overrides.phase ?? MemoryPhase.Active,
      confidence: overrides.confidence ?? 1,
      freshnessAt: overrides.freshnessAt ?? "2026-05-30T00:00:00.000Z",
      weight: 0.5,
      reinforcementCount: 0,
      outcome: {
        successCount: overrides.successCount ?? 3,
        failureCount: overrides.failureCount ?? 0,
        inconclusiveCount: 0,
        workItemsObserved: ["work-1"],
      },
      utility: {
        injectedCount: overrides.injectedCount ?? 6,
        citedCount: overrides.citedCount ?? 6,
      },
      crossScope: {
        distinctScopes: ["work-1"],
        firstObservedAt: "2026-05-30T00:00:00.000Z",
        lastObservedAt: "2026-05-30T00:00:00.000Z",
      },
    },
  };
}

test("memory context-pack recall supports project-scoped director recall without a current work item", async () => {
  const recalledAttributions: MemoryAttribution[] = [];
  const port = createMemoryContextPackRecallPort({
    memory: {
      retain: async () => {
        throw new Error("not used");
      },
      reflect: async () => {
        throw new Error("not used");
      },
      recall: async (attribution) => {
        recalledAttributions.push(attribution);
        return {
          operation: "recall",
          memories: [
            {
              memoryId: "mem-project",
              content: "Project-level director review found repeated QA lag.",
              retainedAtMs: Date.parse("2026-05-30T00:00:00.000Z"),
              attribution: {
                agentId: "agent-author",
                hatAssignmentId: "hat-author",
                projectId: "project-1",
                workItemId: "work-9",
                promptFlowRunId: "run-9",
              },
            },
          ],
        };
      },
    } satisfies Memory,
  });

  const result = await port.recall({
    query: "director project blocker review",
    runId: "run-1",
    observedAt: "2026-05-31T00:00:00.000Z",
    hatId: "engineering_director",
    hatAssignmentId: "hat-reader",
    agentId: "agent-reader",
    organizationId: "org-1",
    projectId: "project-1",
  });

  deepEqual(recalledAttributions, [
    {
      agentId: "agent-reader",
      hatAssignmentId: "hat-reader",
      projectId: "project-1",
      workItemId: "project:project-1",
      promptFlowRunId: "run-1",
    },
  ]);
  equal(result.omittedItemsWithReason, undefined);
  equal(result.memories[0]?.memoryId, "mem-project");
  equal(result.memories[0]?.creatingWorkItemId, "work-9");
  equal(result.memories[0]?.similarityCategory, ContextPackMemorySimilarityCategory.ProjectScoped);
  equal(result.memories[0]?.recallWorkItemId, undefined);
  deepEqual(result.memories[0]?.reasons, [
    "project-scoped memory recall",
    `similarity:${ContextPackMemorySimilarityCategory.ProjectScoped}`,
    "hat:engineering_director",
    "requested-work:unscoped",
    "source-work:work-9",
  ]);
});

test("memory context-pack recall reports an omission when agent scope is missing", async () => {
  let called = false;
  const port = createMemoryContextPackRecallPort({
    memory: {
      retain: async () => {
        throw new Error("not used");
      },
      reflect: async () => {
        throw new Error("not used");
      },
      recall: async () => {
        called = true;
        return { operation: "recall", memories: [] };
      },
    } satisfies Memory,
  });

  const result = await port.recall({
    query: "missing agent",
    runId: "run-1",
    observedAt: "2026-05-31T00:00:00.000Z",
    hatId: "release_operator",
    hatAssignmentId: "hat-reader",
    organizationId: "org-1",
    projectId: "project-1",
    workItemId: "work-1",
  });

  equal(called, false);
  deepEqual(result.memories, []);
  deepEqual(result.omittedItemsWithReason, [
    {
      nodeId: "memory_scope:missing_agent_id",
      reason: ContextPackOmissionReason.OutOfScope,
      message: "memory recall requires agent scope for context-pack retrieval",
    },
  ]);
});
