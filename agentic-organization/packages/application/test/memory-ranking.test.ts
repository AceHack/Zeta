import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  MemoryPhase,
  MemoryTier,
  type MemoryEnvelope,
  type MemoryState,
} from "../../domain/src/index.ts";
import {
  computeFreshness,
  outcomeRatio,
  utilityRatio,
  computeMemoryWeight,
  isBelowArchiveFloor,
  isAboveReadFloor,
  scopeUnionFor,
  retrieveRanked,
  archiveFloorFor,
  type RetrievalCtx,
} from "../src/memory-ranking.ts";

const NOW = Date.parse("2026-05-30T00:00:00Z");

function ctx(over: Partial<RetrievalCtx> = {}): RetrievalCtx {
  return {
    now: NOW,
    organizationId: "org-lfg",
    hatId: "release-manager",
    agentId: "agent-7",
    workItemId: "work-1",
    departmentId: "engineering",
    ...over,
  };
}

function envelope(over: {
  memoryId?: string;
  tier?: MemoryTier;
  scope?: string;
  confidence?: number;
  freshnessAt?: string;
  outcome?: Partial<MemoryState["outcome"]>;
  utility?: Partial<MemoryState["utility"]>;
  phase?: MemoryPhase;
}): MemoryEnvelope {
  const state: MemoryState = {
    memoryId: over.memoryId ?? "mem-1",
    organizationId: "org-lfg",
    phase: over.phase ?? MemoryPhase.Active,
    confidence: over.confidence ?? 0.8,
    weight: 0,
    freshnessAt: over.freshnessAt ?? "2026-05-30T00:00:00Z",
    reinforcementCount: 1,
    outcome: {
      successCount: over.outcome?.successCount ?? 0,
      failureCount: over.outcome?.failureCount ?? 0,
      inconclusiveCount: 0,
      workItemsObserved: [],
    },
    utility: {
      injectedCount: over.utility?.injectedCount ?? 0,
      citedCount: over.utility?.citedCount ?? 0,
    },
    crossScope: { distinctScopes: [], firstObservedAt: "2026-05-30T00:00:00Z", lastObservedAt: "2026-05-30T00:00:00Z" },
  };
  return {
    memoryId: over.memoryId ?? "mem-1",
    organizationId: "org-lfg",
    tier: over.tier ?? MemoryTier.Hat,
    scope: over.scope ?? "release-manager",
    key: "k",
    protected: false,
    writtenBy: "system",
    writtenAt: "2026-05-30T00:00:00Z",
    state,
  };
}

test("freshness is 1.0 at the freshness timestamp and decays to 0 at 2× half-life", () => {
  const fresh = envelope({ tier: MemoryTier.Work, freshnessAt: "2026-05-30T00:00:00Z" });
  equal(computeFreshness(fresh, NOW), 1);
  // work half-life = 30d → 0 at 60d
  const old = envelope({ tier: MemoryTier.Work, freshnessAt: new Date(NOW - 60 * 86_400_000).toISOString() });
  equal(computeFreshness(old, NOW), 0);
  const half = envelope({ tier: MemoryTier.Work, freshnessAt: new Date(NOW - 30 * 86_400_000).toISOString() });
  ok(Math.abs(computeFreshness(half, NOW) - 0.5) < 1e-9);
});

test("outcome and utility ratios stay neutral 0.5 until enough samples", () => {
  equal(outcomeRatio(envelope({ outcome: { successCount: 1, failureCount: 1 } })), 0.5); // <3 → neutral
  equal(outcomeRatio(envelope({ outcome: { successCount: 3, failureCount: 1 } })), 0.75); // ≥3 → real
  equal(utilityRatio(envelope({ utility: { injectedCount: 4, citedCount: 0 } })), 0.5); // <5 → neutral
  equal(utilityRatio(envelope({ utility: { injectedCount: 10, citedCount: 0 } })), 0); // injected-never-cited → 0
});

test("a directly-bound hat memory gets the +0.05 scope boost", () => {
  const bound = envelope({ tier: MemoryTier.Hat, scope: "release-manager" });
  const other = envelope({ tier: MemoryTier.Hat, scope: "some-other-hat" });
  ok(computeMemoryWeight(bound, ctx()) > computeMemoryWeight(other, ctx()));
});

test("KPI failure sinks a memory relative to a healthy one (KPI is weighted)", () => {
  const c = ctx({ semanticScore: 0.5 });
  const failing = envelope({ tier: MemoryTier.Hat, scope: "release-manager", confidence: 0.8, outcome: { successCount: 0, failureCount: 12 }, utility: { injectedCount: 20, citedCount: 0 } });
  const healthy = envelope({ tier: MemoryTier.Hat, scope: "release-manager", confidence: 0.8, outcome: { successCount: 12, failureCount: 0 }, utility: { injectedCount: 20, citedCount: 18 } });
  // same freshness + confidence; only KPI differs → the failing one is strictly lower
  ok(computeMemoryWeight(failing, c) < computeMemoryWeight(healthy, c));
});

test("the two paths to zero COMBINE — bad KPI + aging + no utility crosses the archive floor", () => {
  // a fresh-but-confident memory resists archiving (correct: first failures could be noise)
  const freshButFailing = envelope({
    tier: MemoryTier.Work, scope: "work-1", confidence: 0.9, freshnessAt: "2026-05-30T00:00:00Z",
    outcome: { successCount: 0, failureCount: 12 }, utility: { injectedCount: 20, citedCount: 0 },
  });
  const c = ctx({ semanticScore: 0 });
  ok(!isBelowArchiveFloor(freshButFailing, c), "fresh+confident resists archiving even with bad KPI");

  // once it ALSO ages out, the combination drops it under the archive floor → never surfaces again
  const agedAndFailing = envelope({
    tier: MemoryTier.Work, scope: "work-1", confidence: 0.3,
    freshnessAt: new Date(NOW - 55 * 86_400_000).toISOString(), // nearly fully decayed (work 2×30d)
    outcome: { successCount: 0, failureCount: 12 }, utility: { injectedCount: 20, citedCount: 0 },
  });
  ok(isBelowArchiveFloor(agedAndFailing, c), `weight=${computeMemoryWeight(agedAndFailing, c)} should be < ${archiveFloorFor(MemoryTier.Work)}`);
});

test("scope union dedupes and includes org ⊕ dept ⊕ hat ⊕ agent ⊕ work", () => {
  const scopes = [...scopeUnionFor(ctx())].sort();
  deepEqual(scopes, ["agent-7", "engineering", "org-lfg", "release-manager", "work-1"].sort());
});

test("retrieveRanked drops below-read-floor, sorts weight-desc, packs to budget", () => {
  const strong = envelope({ memoryId: "m-strong", tier: MemoryTier.Hat, scope: "release-manager", confidence: 0.95, outcome: { successCount: 9, failureCount: 0 }, utility: { injectedCount: 10, citedCount: 9 } });
  const weak = envelope({ memoryId: "m-weak", tier: MemoryTier.Work, scope: "work-1", confidence: 0.2, freshnessAt: new Date(NOW - 55 * 86_400_000).toISOString(), outcome: { successCount: 0, failureCount: 8 }, utility: { injectedCount: 12, citedCount: 0 } });
  const mid = envelope({ memoryId: "m-mid", tier: MemoryTier.Agent, scope: "agent-7", confidence: 0.7 });

  const ranked = retrieveRanked([weak, strong, mid], ctx({ semanticScore: 0.6 }), { maxCount: 2 });
  // weak is under its read floor → excluded; strong outranks mid; budget = 2
  equal(ranked.length, 2);
  equal(ranked[0]!.envelope.memoryId, "m-strong");
  ok(ranked.every((r) => r.envelope.memoryId !== "m-weak"));
  ok(ranked[0]!.weight >= ranked[1]!.weight);
});

test("read floor and archive floor compose — above read implies above archive", () => {
  const e = envelope({ tier: MemoryTier.Hat, scope: "release-manager", confidence: 0.9, outcome: { successCount: 5, failureCount: 0 }, utility: { injectedCount: 6, citedCount: 6 } });
  const c = ctx({ semanticScore: 0.8 });
  ok(isAboveReadFloor(e, c));
  ok(!isBelowArchiveFloor(e, c));
});
