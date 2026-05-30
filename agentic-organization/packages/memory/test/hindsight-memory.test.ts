import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { MemoryOperation, type MemoryAttribution } from "../src/memory.ts";
import {
  createHindsightMemory,
  type HindsightClient,
  type HindsightRetainItem,
  type HindsightRecallRequest,
} from "../src/hindsight-memory.ts";

const attr: MemoryAttribution = {
  agentId: "agent-7",
  hatAssignmentId: "release-manager",
  projectId: "proj-1",
  workItemId: "work-1",
  promptFlowRunId: "run-1",
};

function fakeClient(): {
  client: HindsightClient;
  banks: string[];
  retained: { bankId: string; items: readonly HindsightRetainItem[] }[];
  recalls: { bankId: string; req: HindsightRecallRequest }[];
  reflects: { bankId: string; query: string }[];
} {
  const banks: string[] = [];
  const retained: { bankId: string; items: readonly HindsightRetainItem[] }[] = [];
  const recalls: { bankId: string; req: HindsightRecallRequest }[] = [];
  const reflects: { bankId: string; query: string }[] = [];
  const client: HindsightClient = {
    async ensureBank(bankId) { if (!banks.includes(bankId)) banks.push(bankId); },
    async retain(bankId, items) { retained.push({ bankId, items }); return { ids: items.map((_, i) => `hs-${i}`) }; },
    async recall(bankId, req) { recalls.push({ bankId, req }); return { results: [{ memoryId: "mem-a", text: "Require a rollback plan." }, { memoryId: "mem-b", text: "Pad QA by 20%." }] }; },
    async reflect(bankId, query) { reflects.push({ bankId, query }); return { operationId: "op-9" }; },
  };
  return { client, banks, retained, recalls, reflects };
}

test("retain → bank ensured, content + attribution metadata + scope tags sent", async () => {
  const f = fakeClient();
  const mem = createHindsightMemory({ client: f.client, organizationId: "org-lfg", clock: { now: () => 1000 } });
  const result = await mem.retain(attr, "Require a rollback plan before approving a release.");
  equal(result.operation, MemoryOperation.Retain);
  // bank_id = projectId (scoped, never global)
  deepEqual(f.banks, ["proj-1"]);
  const item = f.retained[0]!.items[0]!;
  equal(item.content, "Require a rollback plan before approving a release.");
  equal(item.metadata.agentId, "agent-7");
  equal(item.metadata.projectId, "proj-1");
  ok(item.tags.includes("agent:agent-7"));
  ok(item.tags.includes("work:work-1"));
  ok(item.tags.includes("hat:release-manager"));
  equal(result.memory.retainedAtMs, 1000);
});

test("recall is project-scoped (bank=projectId) and tag-filtered to the binding (any-match)", async () => {
  const f = fakeClient();
  const mem = createHindsightMemory({ client: f.client, organizationId: "org-lfg" });
  const result = await mem.recall(attr);
  equal(result.operation, MemoryOperation.Recall);
  equal(f.recalls[0]!.bankId, "proj-1");
  equal(f.recalls[0]!.req.tagsMatch, "any");
  ok(f.recalls[0]!.req.tags!.includes("work:work-1"));
  // results map our join id → memory records
  equal(result.memories.length, 2);
  equal(result.memories[0]!.memoryId, "mem-a");
  equal(result.memories[0]!.content, "Require a rollback plan.");
});

test("reflect drives Hindsight /reflect for the binding and reports the operation id", async () => {
  const f = fakeClient();
  const mem = createHindsightMemory({ client: f.client, organizationId: "org-lfg" });
  const result = await mem.reflect(attr);
  equal(result.operation, MemoryOperation.Reflect);
  equal(f.reflects[0]!.bankId, "proj-1");
  ok(result.summary.includes("op-9"));
});
