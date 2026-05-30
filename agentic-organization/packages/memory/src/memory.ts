/**
 * Memory port (Hindsight contract) + in-process simulated adapter.
 *
 * The North Star "Hindsight Memory Attribution" gap: memory writes are attributed
 * by active hat assignment (agent, hat, project, work item, prompt-flow run) and
 * recall is SCOPED through Organization memory policy. Hindsight exposes explicit
 * retain / recall / reflect operations (CLUSTER_EXECUTION_AND_MEMORY_SUBSTRATE).
 *
 * V0 ships a port + in-process fake so the vertical slice (an agent retains what
 * it learned, recalls scoped context, reflects at outcome review) runs end to
 * end. A real Hindsight adapter implements the same port. Attribution is STICKY:
 * a memory keeps its original author even when recalled by another hat (the doc's
 * "sticky attribution after hat release"). Every operation result is an explicit
 * DU; recall is scoped by projectId, never global.
 */

export const MemoryOperation = {
  Retain: "retain",
  Recall: "recall",
  Reflect: "reflect",
} as const;
export type MemoryOperation = (typeof MemoryOperation)[keyof typeof MemoryOperation];

/** Who/what a memory write is attributed to (the governance scope). */
export type MemoryAttribution = {
  agentId: string;
  hatAssignmentId: string;
  projectId: string;
  workItemId: string;
  promptFlowRunId: string;
};

export type MemoryRecord = {
  memoryId: string;
  attribution: MemoryAttribution;
  content: string;
  retainedAtMs: number;
};

export type RetainResult = { operation: typeof MemoryOperation.Retain; memory: MemoryRecord };
export type RecallResult = { operation: typeof MemoryOperation.Recall; memories: readonly MemoryRecord[] };
export type ReflectResult = {
  operation: typeof MemoryOperation.Reflect;
  consideredCount: number;
  summary: string;
};

export interface Memory {
  retain(attribution: MemoryAttribution, content: string): Promise<RetainResult>;
  recall(attribution: MemoryAttribution): Promise<RecallResult>;
  reflect(attribution: MemoryAttribution): Promise<ReflectResult>;
}

export type MemoryDeps = {
  clock: { now: () => number };
  idGenerator: { nextMemoryId: () => string };
};

function defaultDeps(): MemoryDeps {
  let counter = 0;
  return {
    clock: { now: () => Date.now() },
    idGenerator: { nextMemoryId: () => `mem-${++counter}` },
  };
}

/**
 * In-process simulated memory. Recall is scoped to the requesting attribution's
 * projectId (Organization memory policy: scoped recall, not global). Stored
 * memories keep their original attribution (sticky).
 */
export function createInProcessMemory(deps: MemoryDeps = defaultDeps()): Memory {
  const store: MemoryRecord[] = [];

  function inScope(record: MemoryRecord, attribution: MemoryAttribution): boolean {
    return record.attribution.projectId === attribution.projectId;
  }

  return {
    async retain(attribution: MemoryAttribution, content: string): Promise<RetainResult> {
      const memory: MemoryRecord = {
        memoryId: deps.idGenerator.nextMemoryId(),
        attribution: { ...attribution },
        content,
        retainedAtMs: deps.clock.now(),
      };
      store.push(memory);
      return { operation: MemoryOperation.Retain, memory: { ...memory } };
    },

    async recall(attribution: MemoryAttribution): Promise<RecallResult> {
      const memories = store.filter((record) => inScope(record, attribution)).map((record) => ({ ...record }));
      return { operation: MemoryOperation.Recall, memories };
    },

    async reflect(attribution: MemoryAttribution): Promise<ReflectResult> {
      const inScopeRecords = store.filter((record) => inScope(record, attribution));
      const summary =
        inScopeRecords.length === 0
          ? "no memories in scope to reflect on"
          : `reflected on ${inScopeRecords.length} memories in project ${attribution.projectId}`;
      return { operation: MemoryOperation.Reflect, consideredCount: inScopeRecords.length, summary };
    },
  };
}
