import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { MemoryTier, type MemoryEnvelope, type MemoryState } from "../../domain/src/index.ts";
import type { RankedMemory, RetrievalCtx } from "../src/memory-ranking.ts";
import {
  composeInjectionQuery,
  injectionQueryHash,
  buildRelevantMemoryBlock,
  injectionId,
  recordInjections,
  verifyCitations,
  nextUtility,
  unaddressedHighWeight,
  type HydratedMemory,
} from "../src/memory-injection.ts";

function ranked(memoryId: string, tier: MemoryTier, scope: string, weight: number): RankedMemory {
  const state: MemoryState = {
    memoryId,
    organizationId: "org-lfg",
    phase: "active",
    confidence: 0.8,
    weight,
    freshnessAt: "2026-05-30T00:00:00Z",
    reinforcementCount: 1,
    outcome: { successCount: 3, failureCount: 1, inconclusiveCount: 0, workItemsObserved: [] },
    utility: { injectedCount: 6, citedCount: 4 },
    crossScope: { distinctScopes: [], firstObservedAt: "2026-05-30T00:00:00Z", lastObservedAt: "2026-05-30T00:00:00Z" },
  };
  const envelope: MemoryEnvelope = {
    memoryId, organizationId: "org-lfg", tier, scope, key: "k", protected: false,
    writtenBy: "system", writtenAt: "2026-05-30T00:00:00Z", state,
  };
  return { envelope, weight, freshness: 1, outcome: 0.75, utility: 0.66, semantic: 0.6 };
}

const ctx: RetrievalCtx = {
  now: Date.parse("2026-05-30T00:00:00Z"),
  organizationId: "org-lfg",
  hatId: "release-manager",
  agentId: "agent-7",
  workItemId: "work-1",
};

test("the injection query is a pure function of the binding (reproducible + hashable)", () => {
  const a = composeInjectionQuery({ roleSentence: "You are the release manager.", taskSummary: "approve release", recentTurns: ["x", "y"] });
  const b = composeInjectionQuery({ roleSentence: "You are the release manager.", taskSummary: "approve release", recentTurns: ["x", "y"] });
  equal(a, b);
  equal(injectionQueryHash(a), injectionQueryHash(b));
  ok(a.includes("release manager"));
});

test("the relevant-memory block groups by tier and annotates weight + KPI", () => {
  const hydrated: HydratedMemory[] = [
    { ...ranked("m-hat", MemoryTier.Hat, "release-manager", 0.8), value: "Require a rollback plan." },
    { ...ranked("m-agent", MemoryTier.Agent, "agent-7", 0.7), value: "Pad QA by 20%." },
  ];
  const block = buildRelevantMemoryBlock(hydrated);
  ok(block.startsWith("## Relevant memory"));
  ok(block.includes("### Hat"));
  ok(block.includes("### You (agent)"));
  ok(block.includes("Require a rollback plan."));
  ok(block.includes("w=0.80"));
  ok(block.includes("kpi=3/4"));
});

test("empty surfacing renders an explicit (none surfaced) block", () => {
  equal(buildRelevantMemoryBlock([]), "## Relevant memory\n\n(none surfaced)");
});

test("injection ledger ids are deterministic per (run, memory) — re-injection is idempotent", () => {
  const id1 = injectionId("run-1", "m-hat");
  const id2 = injectionId("run-1", "m-hat");
  equal(id1, id2);
  ok(injectionId("run-1", "m-hat") !== injectionId("run-2", "m-hat"));
});

test("recordInjections produces one ledger row per surfaced memory, cited=false", () => {
  const rows = recordInjections([ranked("m-hat", MemoryTier.Hat, "release-manager", 0.8), ranked("m-agent", MemoryTier.Agent, "agent-7", 0.7)], ctx, "run-1", "2026-05-30T00:00:00Z");
  equal(rows.length, 2);
  ok(rows.every((r) => r.cited === false && r.promptFlowRunId === "run-1" && r.workItemId === "work-1"));
  equal(rows[0]!.weightAtInjection, 0.8);
});

test("anti-laundering: a cited id not injected this turn is rejected as fabrication", () => {
  const v = verifyCitations(["m-hat", "m-fabricated"], ["m-hat", "m-agent"]);
  deepEqual([...v.valid], ["m-hat"]);
  deepEqual([...v.laundered], ["m-fabricated"]);
});

test("nextUtility increments injected always, cited only when actually cited", () => {
  const prev = { injectedCount: 5, citedCount: 2 };
  const injectedCited = nextUtility(prev, true, true, "2026-05-30T00:00:00Z");
  equal(injectedCited.injectedCount, 6);
  equal(injectedCited.citedCount, 3);
  equal(injectedCited.lastInjectedAt, "2026-05-30T00:00:00Z");
  const injectedUncited = nextUtility(prev, true, false, "2026-05-30T00:00:00Z");
  equal(injectedUncited.injectedCount, 6);
  equal(injectedUncited.citedCount, 2);
});

test("must-address: a high-weight surfaced-but-uncited memory is flagged", () => {
  const surfaced = [ranked("m-high", MemoryTier.Hat, "release-manager", 0.8), ranked("m-low", MemoryTier.Work, "work-1", 0.4)];
  const flagged = unaddressedHighWeight(surfaced, [], 0.6);
  equal(flagged.length, 1);
  equal(flagged[0]!.envelope.memoryId, "m-high");
  // citing it clears the flag
  equal(unaddressedHighWeight(surfaced, ["m-high"], 0.6).length, 0);
});
