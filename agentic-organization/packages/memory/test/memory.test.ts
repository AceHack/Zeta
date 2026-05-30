import { equal } from "node:assert/strict";
import { test } from "node:test";
import {
  MemoryOperation,
  createInProcessMemory,
  type MemoryAttribution,
} from "../src/memory.ts";

function attribution(overrides: Partial<MemoryAttribution> = {}): MemoryAttribution {
  return {
    agentId: "agent-1",
    hatAssignmentId: "hat-1",
    projectId: "proj-1",
    workItemId: "wi-1",
    promptFlowRunId: "pf-1",
    ...overrides,
  };
}

test("retain stores a memory attributed to agent/hat/project/run", async () => {
  const memory = createInProcessMemory();
  const r = await memory.retain(attribution(), "the build flag is -O2");
  equal(r.operation, MemoryOperation.Retain);
  equal(r.memory.attribution.agentId, "agent-1");
  equal(r.memory.content, "the build flag is -O2");
});

test("recall returns memories within the same project scope", async () => {
  const memory = createInProcessMemory();
  await memory.retain(attribution(), "fact A");
  await memory.retain(attribution(), "fact B");
  const recalled = await memory.recall(attribution());
  equal(recalled.memories.length, 2);
});

test("recall is SCOPED — a different project does not see another project's memories", async () => {
  const memory = createInProcessMemory();
  await memory.retain(attribution({ projectId: "proj-1" }), "secret of proj 1");
  const other = await memory.recall(attribution({ projectId: "proj-2" }));
  equal(other.memories.length, 0);
});

test("reflect summarizes the memories in scope without losing attribution", async () => {
  const memory = createInProcessMemory();
  await memory.retain(attribution(), "fact A");
  await memory.retain(attribution(), "fact B");
  const reflection = await memory.reflect(attribution());
  equal(reflection.operation, MemoryOperation.Reflect);
  equal(reflection.consideredCount, 2);
  equal(reflection.summary.length > 0, true);
});

test("sticky attribution: a memory keeps its original agent even when recalled by another hat", async () => {
  const memory = createInProcessMemory();
  await memory.retain(attribution({ agentId: "agent-original" }), "owned by original");
  const recalled = await memory.recall(attribution({ agentId: "agent-other" }));
  // same project scope, so visible; attribution stays the original author
  equal(recalled.memories.length, 1);
  equal(recalled.memories[0]?.attribution.agentId, "agent-original");
});
