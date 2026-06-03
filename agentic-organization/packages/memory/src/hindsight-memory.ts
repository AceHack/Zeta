/**
 * Hindsight adapter behind the Memory port (MEM7, §13.2). We do NOT fork or adopt
 * Hindsight wholesale — we COMPOSE with it: Hindsight owns content storage,
 * embeddings, and recall fusion; we own tier-scoping, the KPI-weighted re-rank,
 * decay, the maintenance cycle, and the org_event trace. This adapter implements
 * the existing `Memory { retain; recall; reflect }` port by driving Hindsight's
 * REST API (NOT its MCP server — §12 makes memory a harness invariant, not a tool).
 *
 *   bank_id   = attribution.projectId   (recall is project-scoped, never global)
 *   metadata  = the attribution map      (carries our content-addressed memoryId)
 *   tags      = ["agent:"+agentId, "work:"+workItemId, "hat:"+hatAssignmentId]
 *   join key  = result.metadata.memoryId (our id; survives Hindsight's chunking)
 *
 * createHindsightHttpClient drives the live service over native fetch; the client
 * is an interface so tests inject a fake and the worker injects the real one.
 */

import {
  MemoryOperation,
  type Memory,
  type MemoryAttribution,
  type RecallResult,
  type ReflectResult,
  type RetainResult,
} from "./memory.ts";

export type HindsightRetainItem = {
  content: string;
  metadata: Record<string, string>;
  tags: readonly string[];
};

export type HindsightRecallRequest = {
  query: string;
  tags?: readonly string[];
  tagsMatch?: "any" | "all";
  maxTokens?: number;
};

/** A recall candidate normalized for our re-rank: our join id + text. */
export type HindsightRecallCandidate = {
  memoryId: string;
  text: string;
  metadata: Record<string, string>;
};

export type HindsightClient = {
  ensureBank: (bankId: string) => Promise<void>;
  retain: (bankId: string, items: readonly HindsightRetainItem[]) => Promise<{ ids: readonly string[] }>;
  recall: (bankId: string, req: HindsightRecallRequest) => Promise<{ results: readonly HindsightRecallCandidate[] }>;
  reflect: (bankId: string, query: string) => Promise<{ operationId: string }>;
};

// ── live REST client (native fetch) ─────────────────────────────────────────

export type CreateHindsightHttpClientInput = {
  baseUrl: string; // e.g. http://hindsight:8888
  fetchImpl?: typeof fetch;
};

type RawRecallResult = { id?: string; text?: string; metadata?: Record<string, string> };

export function createHindsightHttpClient(input: CreateHindsightHttpClientInput): HindsightClient {
  const doFetch = input.fetchImpl ?? fetch;
  const base = input.baseUrl.replace(/\/$/, "");
  const bankUrl = (bankId: string) => `${base}/v1/default/banks/${encodeURIComponent(bankId)}`;

  async function json<T>(res: Response, op: string): Promise<T> {
    if (!res.ok) throw new Error(`hindsight ${op} failed: ${res.status} ${await res.text()}`);
    return (await res.json()) as T;
  }

  return {
    async ensureBank(bankId: string): Promise<void> {
      const res = await doFetch(bankUrl(bankId), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description: `agentic-org memory bank ${bankId}` }),
      });
      if (!res.ok && res.status !== 409) throw new Error(`hindsight ensureBank failed: ${res.status} ${await res.text()}`);
    },

    async retain(bankId: string, items: readonly HindsightRetainItem[]): Promise<{ ids: readonly string[] }> {
      const res = await doFetch(`${bankUrl(bankId)}/memories`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // async: extraction/embedding happens in the background — retain returns fast
        // (store-everything; the weight engine decides worth later, not the hot path)
        body: JSON.stringify({ async: true, items: items.map((i) => ({ content: i.content, metadata: i.metadata, tags: i.tags })) }),
      });
      const body = await json<{ memory_ids?: string[]; operation_ids?: string[] }>(res, "retain");
      return { ids: body.memory_ids ?? body.operation_ids ?? [] };
    },

    async recall(bankId: string, req: HindsightRecallRequest): Promise<{ results: readonly HindsightRecallCandidate[] }> {
      const res = await doFetch(`${bankUrl(bankId)}/memories/recall`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: req.query,
          ...(req.tags !== undefined ? { tags: req.tags } : {}),
          ...(req.tagsMatch !== undefined ? { tags_match: req.tagsMatch } : {}),
          max_tokens: req.maxTokens ?? 2000,
        }),
      });
      const body = await json<{ results?: RawRecallResult[] }>(res, "recall");
      const seen = new Set<string>();
      const results: HindsightRecallCandidate[] = [];
      for (const r of body.results ?? []) {
        // our content-addressed memoryId rides in metadata; fall back to Hindsight's id
        const memoryId = r.metadata?.memoryId ?? r.id ?? "";
        if (memoryId === "" || seen.has(memoryId)) continue;
        seen.add(memoryId);
        results.push({ memoryId, text: r.text ?? "", metadata: r.metadata ?? {} });
      }
      return { results };
    },

    async reflect(bankId: string, query: string): Promise<{ operationId: string }> {
      const res = await doFetch(`${bankUrl(bankId)}/reflect`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const body = await json<{ operation_id?: string }>(res, "reflect");
      return { operationId: body.operation_id ?? "" };
    },
  };
}

// ── the port adapter ────────────────────────────────────────────────────────

export type CreateHindsightMemoryInput = {
  client: HindsightClient;
  organizationId: string;
  clock?: { now: () => number };
};

function attributionToMetadata(attr: MemoryAttribution, organizationId: string): Record<string, string> {
  return {
    organizationId,
    agentId: attr.agentId,
    hatAssignmentId: attr.hatAssignmentId,
    projectId: attr.projectId,
    workItemId: attr.workItemId,
    promptFlowRunId: attr.promptFlowRunId,
  };
}

function attributionFromMetadata(metadata: Record<string, string>): MemoryAttribution | undefined {
  const {
    agentId,
    hatAssignmentId,
    projectId,
    workItemId,
    promptFlowRunId,
  } = metadata;
  if (
    agentId === undefined ||
    hatAssignmentId === undefined ||
    projectId === undefined ||
    workItemId === undefined ||
    promptFlowRunId === undefined
  ) {
    return undefined;
  }
  return {
    agentId,
    hatAssignmentId,
    projectId,
    workItemId,
    promptFlowRunId,
  };
}

function scopeTags(attr: MemoryAttribution): readonly string[] {
  return [`agent:${attr.agentId}`, `work:${attr.workItemId}`, `hat:${attr.hatAssignmentId}`];
}

export function createHindsightMemory(input: CreateHindsightMemoryInput): Memory {
  const now = () => (input.clock ? input.clock.now() : Date.now());

  return {
    async retain(attribution: MemoryAttribution, content: string): Promise<RetainResult> {
      const bankId = attribution.projectId;
      await input.client.ensureBank(bankId);
      const metadata = attributionToMetadata(attribution, input.organizationId);
      const { ids } = await input.client.retain(bankId, [{ content, metadata, tags: scopeTags(attribution) }]);
      const memoryId = ids[0] ?? attribution.promptFlowRunId;
      return {
        operation: MemoryOperation.Retain,
        memory: { memoryId, attribution, content, retainedAtMs: now() },
      };
    },

    async recall(attribution: MemoryAttribution): Promise<RecallResult> {
      const bankId = attribution.projectId;
      // scoped recall (never global): filter to this binding's scope tags, any-match
      const { results } = await input.client.recall(bankId, {
        query: `${attribution.hatAssignmentId} ${attribution.workItemId}`.trim() || attribution.projectId,
        tags: [`agent:${attribution.agentId}`, `work:${attribution.workItemId}`, `hat:${attribution.hatAssignmentId}`],
        tagsMatch: "any",
        maxTokens: 2000,
      });
      return {
        operation: MemoryOperation.Recall,
        memories: results.flatMap((r) => {
          const originalAttribution = attributionFromMetadata(r.metadata);
          if (originalAttribution === undefined) return [];
          return [{ memoryId: r.memoryId, attribution: originalAttribution, content: r.text, retainedAtMs: now() }];
        }),
      };
    },

    async reflect(attribution: MemoryAttribution): Promise<ReflectResult> {
      const bankId = attribution.projectId;
      const { operationId } = await input.client.reflect(bankId, `Insights for ${attribution.hatAssignmentId} on ${attribution.workItemId}`);
      return {
        operation: MemoryOperation.Reflect,
        consideredCount: 0,
        summary: `hindsight reflect queued (operation ${operationId})`,
      };
    },
  };
}
