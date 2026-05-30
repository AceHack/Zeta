import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  MemoryPhase,
  MemoryTier,
  type MemoryEnvelope,
  type MemoryState,
} from "../../domain/src/index.ts";
import type { RetrievalCtx } from "../src/memory-ranking.ts";
import { rerankRecalled, positionalSemanticScore, type RecalledCandidate } from "../src/memory-recall.ts";

const NOW = Date.parse("2026-05-30T00:00:00Z");
const ctx: RetrievalCtx = { now: NOW, organizationId: "org-lfg", hatId: "release-manager", agentId: "agent-7", workItemId: "work-1" };

function env(
  memoryId: string, tier: MemoryTier, scope: string, confidence: number,
  kpi: { successCount?: number; failureCount?: number; injectedCount?: number; citedCount?: number } = {},
): MemoryEnvelope {
  const state: MemoryState = {
    memoryId, organizationId: "org-lfg", phase: MemoryPhase.Active, confidence, weight: 0,
    freshnessAt: "2026-05-30T00:00:00Z", reinforcementCount: 1,
    outcome: { successCount: kpi.successCount ?? 6, failureCount: kpi.failureCount ?? 0, inconclusiveCount: 0, workItemsObserved: [] },
    utility: { injectedCount: kpi.injectedCount ?? 6, citedCount: kpi.citedCount ?? 5 },
    crossScope: { distinctScopes: [], firstObservedAt: "2026-05-30T00:00:00Z", lastObservedAt: "2026-05-30T00:00:00Z" },
  };
  return { memoryId, organizationId: "org-lfg", tier, scope, key: "k", protected: false, writtenBy: "system", writtenAt: "2026-05-30T00:00:00Z", state };
}

test("positional semantic score rewards earlier recall positions", () => {
  equal(positionalSemanticScore(0, 4), 1);
  ok(positionalSemanticScore(0, 4) > positionalSemanticScore(3, 4));
  equal(positionalSemanticScore(0, 1), 1);
});

test("rerankRecalled joins candidates to envelopes and re-ranks by OUR weight, packs budget", () => {
  const envs = new Map<string, MemoryEnvelope>([
    ["m-strong", env("m-strong", MemoryTier.Hat, "release-manager", 0.95)],
    // m-weak: low confidence + bad KPI + never cited — semantically close but governance-weak
    ["m-weak", env("m-weak", MemoryTier.Agent, "agent-7", 0.2, { successCount: 2, failureCount: 6, injectedCount: 10, citedCount: 1 })],
  ]);
  // Hindsight returned m-weak FIRST (higher semantic), m-strong second — but our
  // weight should still surface m-strong above (KPI + confidence + scope boost).
  const candidates: RecalledCandidate[] = [
    { memoryId: "m-weak", value: "weak", semanticScore: 0.9 },
    { memoryId: "m-strong", value: "strong", semanticScore: 0.6 },
  ];
  const out = rerankRecalled(candidates, envs, ctx, { maxCount: 2 });
  equal(out.length, 2);
  equal(out[0]!.envelope.memoryId, "m-strong"); // re-ranked above despite lower semantic
  equal(out[0]!.value, "strong");
});

test("candidates with no governance envelope are skipped (cannot be weighted → cannot surface)", () => {
  const envs = new Map<string, MemoryEnvelope>([["m-known", env("m-known", MemoryTier.Hat, "release-manager", 0.9)]]);
  const candidates: RecalledCandidate[] = [
    { memoryId: "m-known", value: "known", semanticScore: 0.8 },
    { memoryId: "m-orphan", value: "orphan content with no state row", semanticScore: 0.99 },
  ];
  const out = rerankRecalled(candidates, envs, ctx, { maxCount: 5 });
  equal(out.length, 1);
  equal(out[0]!.envelope.memoryId, "m-known");
});

test("budget packs the top-N after re-rank", () => {
  const envs = new Map<string, MemoryEnvelope>([
    ["a", env("a", MemoryTier.Hat, "release-manager", 0.95)],
    ["b", env("b", MemoryTier.Hat, "release-manager", 0.9)],
    ["c", env("c", MemoryTier.Hat, "release-manager", 0.85)],
  ]);
  const candidates: RecalledCandidate[] = [
    { memoryId: "a", value: "a", semanticScore: 0.7 },
    { memoryId: "b", value: "b", semanticScore: 0.7 },
    { memoryId: "c", value: "c", semanticScore: 0.7 },
  ];
  const out = rerankRecalled(candidates, envs, ctx, { maxCount: 2 });
  equal(out.length, 2);
  ok(out[0]!.weight >= out[1]!.weight);
});
