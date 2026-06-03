import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  ContextPackFreshness,
  ContextPackItemKind,
  ContextPackSourcePointerKind,
  RunScope,
  asZetaIdDecimal,
  contextPackDrillTargetGroupsForPack,
  contextPackDrillTargetsForItem,
  type ContextPack,
  type ContextPackItem,
  type ContextPackMemoryGovernanceExplanation,
} from "../src/index.ts";
import { MemoryPhase, MemoryTier } from "../../domain/src/index.ts";

const observedAt = "2026-06-03T12:00:00.000Z";

test("context pack drill targets map typed source pointers into deterministic UI targets", () => {
  const governance: ContextPackMemoryGovernanceExplanation = {
    tier: MemoryTier.Work,
    phase: MemoryPhase.Active,
    scope: "work-billing",
    weight: 0.81,
    readFloor: 0.35,
    freshnessAt: "2026-06-01T00:00:00.000Z",
    outcome: {
      successCount: 5,
      failureCount: 1,
      inconclusiveCount: 0,
    },
    utility: {
      injectedCount: 8,
      citedCount: 6,
    },
  };
  const item = contextItem({
    id: "memory:mem-billing",
    sourcePointers: [
      {
        kind: ContextPackSourcePointerKind.DocUnit,
        docUnitId: "doc-billing-brd",
        contentRef: "git:docs/billing-brd.md",
        contentHash: "hash-billing-brd",
        sourceId: "docs-main",
        version: 3,
      },
      { kind: ContextPackSourcePointerKind.Decision, decisionId: "decision-owner" },
      {
        kind: ContextPackSourcePointerKind.HindsightMemory,
        providerId: "hindsight",
        memoryId: "mem-billing",
        governance,
        advisory: true,
      },
    ],
  });

  const targets = contextPackDrillTargetsForItem(item);

  deepEqual(targets.map(({ label, routeRef, targetId, targetKind }) => ({
    label,
    routeRef,
    targetId,
    targetKind,
  })), [
    {
      label: "Document doc-billing-brd",
      routeRef: "doc_unit:doc-billing-brd:v3",
      targetId: "doc-billing-brd",
      targetKind: ContextPackSourcePointerKind.DocUnit,
    },
    {
      label: "Decision decision-owner",
      routeRef: "decision:decision-owner",
      targetId: "decision-owner",
      targetKind: ContextPackSourcePointerKind.Decision,
    },
    {
      label: "Memory mem-billing",
      routeRef: "hindsight_memory:hindsight:mem-billing",
      targetId: "mem-billing",
      targetKind: ContextPackSourcePointerKind.HindsightMemory,
    },
  ]);
  deepEqual(targets[2]?.governance, governance);
  ok(targets[2]?.governance !== governance);
  ok(targets[2]?.governance?.outcome !== governance.outcome);
});

test("context pack drill target groups skip items without pointers and dedupe repeated targets", () => {
  const pack: ContextPack = {
    id: "context-pack:run-1",
    runId: asZetaIdDecimal("1"),
    scope: RunScope.WorkItem,
    hatAssignmentId: asZetaIdDecimal("2"),
    hatId: "engineering_manager",
    generatedAt: observedAt,
    freshnessDeadline: "2026-06-03T12:15:00.000Z",
    sourceGraphVersion: "graph-v1",
    policyVersion: "test",
    tokenBudget: 2_000,
    curationPlan: {
      profileId: "test",
      policyVersion: "test",
      lanes: [],
      deterministicInstructions: [],
    },
    items: [
      contextItem({ id: "empty", sourcePointers: [] }),
      contextItem({
        id: "trace",
        sourcePointers: [
          { kind: ContextPackSourcePointerKind.Trace, traceId: "trace-billing" },
          { kind: ContextPackSourcePointerKind.Trace, traceId: "trace-billing" },
          {
            kind: ContextPackSourcePointerKind.Log,
            source: "lgtm",
            query: "trace_id=trace-billing",
            logRef: "log-billing-timeout",
          },
        ],
      }),
    ],
    omittedItemsWithReason: [],
    contradictions: [],
    staleInputs: [],
    lifecycleBlockers: [],
    curationTrace: [],
  };

  const groups = contextPackDrillTargetGroupsForPack(pack);

  equal(groups.length, 1);
  equal(groups[0]?.itemId, "trace");
  deepEqual(groups[0]?.targets.map(({ routeRef }) => routeRef), [
    "trace:trace-billing",
    "log:lgtm:log-billing-timeout",
  ]);
});

function contextItem(overrides: Partial<ContextPackItem> = {}): ContextPackItem {
  return {
    id: "item-1",
    kind: ContextPackItemKind.MemoryPointer,
    title: "Context item",
    summary: "Context item summary",
    sourceRef: "context:item",
    required: false,
    freshness: ContextPackFreshness.Current,
    confidence: 0.9,
    reasons: [],
    citationRefs: [],
    ...overrides,
  };
}
