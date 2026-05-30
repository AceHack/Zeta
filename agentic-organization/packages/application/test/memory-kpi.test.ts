import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  MemoryPhase,
  MemoryTier,
  type MemoryEnvelope,
  type MemoryInjectionRecord,
  type MemoryOutcomeCorrelation,
  type MemoryState,
} from "../../domain/src/index.ts";
import {
  OutcomeVerdict,
  workItemVerdict,
  bumpOutcome,
  recomputeConfidence,
  planOutcomeCorrelation,
} from "../src/memory-kpi.ts";

const AT = "2026-05-30T00:00:00Z";

function outcome(over: Partial<MemoryOutcomeCorrelation> = {}): MemoryOutcomeCorrelation {
  return { successCount: 0, failureCount: 0, inconclusiveCount: 0, workItemsObserved: [], ...over };
}

function envelope(memoryId: string, phase: MemoryPhase, o: MemoryOutcomeCorrelation): MemoryEnvelope {
  const state: MemoryState = {
    memoryId, organizationId: "org-lfg", phase, confidence: 0.7, weight: 0.5,
    freshnessAt: AT, reinforcementCount: 1, outcome: o,
    utility: { injectedCount: 6, citedCount: 3 },
    crossScope: { distinctScopes: [], firstObservedAt: AT, lastObservedAt: AT },
  };
  return { memoryId, organizationId: "org-lfg", tier: MemoryTier.Hat, scope: "release-manager", key: "k", protected: false, writtenBy: "system", writtenAt: AT, state };
}

function injection(memoryId: string, workItemId: string): MemoryInjectionRecord {
  return { injectionId: `inj-${memoryId}-${workItemId}`, organizationId: "org-lfg", memoryId, workItemId, hatId: "release-manager", agentId: "agent-7", promptFlowRunId: "run-1", weightAtInjection: 0.6, cited: false, injectedAt: AT };
}

test("merged → success; recovery path → failure; neither → inconclusive", () => {
  equal(workItemVerdict(true, false), OutcomeVerdict.Success);
  equal(workItemVerdict(false, true), OutcomeVerdict.Failure);
  equal(workItemVerdict(false, false), OutcomeVerdict.Inconclusive);
});

test("bumpOutcome is deduped on workItemId — a work item counts once", () => {
  const first = bumpOutcome(outcome(), OutcomeVerdict.Success, "work-1", AT);
  equal(first.successCount, 1);
  // same work item again → unchanged (no double count)
  const again = bumpOutcome(first, OutcomeVerdict.Success, "work-1", AT);
  equal(again, first);
  equal(again.successCount, 1);
  // a different work item does count
  const second = bumpOutcome(first, OutcomeVerdict.Failure, "work-2", AT);
  equal(second.successCount, 1);
  equal(second.failureCount, 1);
});

test("confidence is Laplace-smoothed: 0.5 at zero evidence, converges to the ratio", () => {
  equal(recomputeConfidence(outcome()), 0.5);
  // 8 success / 0 failure → (8+1)/(8+2) = 0.9
  equal(recomputeConfidence(outcome({ successCount: 8 })), 0.9);
  // 0 success / 8 failure → 1/10 = 0.1
  equal(recomputeConfidence(outcome({ failureCount: 8 })), 0.1);
  // inconclusive doesn't move confidence
  equal(recomputeConfidence(outcome({ inconclusiveCount: 5 })), 0.5);
});

test("planOutcomeCorrelation bumps every distinct injected memory, skips archived", () => {
  const envs = new Map<string, MemoryEnvelope>([
    ["m-active", envelope("m-active", MemoryPhase.Active, outcome({ successCount: 2 }))],
    ["m-archived", envelope("m-archived", MemoryPhase.Archived, outcome())],
  ]);
  // m-active injected twice in the same work item; m-archived once; m-missing has no envelope
  const injections = [injection("m-active", "work-9"), injection("m-active", "work-9"), injection("m-archived", "work-9"), injection("m-missing", "work-9")];

  const updates = planOutcomeCorrelation(injections, envs, OutcomeVerdict.Success, "work-9", AT);
  // only m-active updates (archived skipped; missing skipped; dup collapsed)
  equal(updates.length, 1);
  equal(updates[0]!.memoryId, "m-active");
  equal(updates[0]!.nextOutcome.successCount, 3);
  // confidence recomputed from (3+1)/(3+2) wait: total=3 → (3+1)/(3+2)=0.8
  ok(Math.abs(updates[0]!.nextConfidence - 0.8) < 1e-9);
});

test("planOutcomeCorrelation is idempotent for an already-counted work item", () => {
  const envs = new Map<string, MemoryEnvelope>([
    ["m1", envelope("m1", MemoryPhase.Active, outcome({ successCount: 1, workItemsObserved: ["work-7"] }))],
  ]);
  const updates = planOutcomeCorrelation([injection("m1", "work-7")], envs, OutcomeVerdict.Success, "work-7", AT);
  equal(updates.length, 0); // work-7 already counted → no update
});
