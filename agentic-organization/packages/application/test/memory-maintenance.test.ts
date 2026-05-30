import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  MemoryPhase,
  MemoryTier,
  OrgEventKind,
  type MemoryEnvelope,
  type MemoryOutcomeCorrelation,
  type MemoryState,
} from "../../domain/src/index.ts";
import {
  MemoryConflictChoice,
  MemoryDemotionChoice,
  runMemoryMaintenanceCycle,
  type MemoryMaintenanceDeps,
} from "../src/memory-maintenance.ts";

const NOW = Date.parse("2026-05-30T00:00:00Z");
let seq = 0;
function deps(over: Partial<MemoryMaintenanceDeps> = {}): MemoryMaintenanceDeps {
  return { organizationId: "org-lfg", now: NOW, createId: (p) => `${p}-${++seq}`, ...over };
}

function env(over: {
  memoryId: string;
  tier?: MemoryTier;
  scope?: string;
  phase?: MemoryPhase;
  confidence?: number;
  protected?: boolean;
  freshnessAt?: string;
  outcome?: Partial<MemoryOutcomeCorrelation>;
  distinctScopes?: string[];
}): MemoryEnvelope {
  const state: MemoryState = {
    memoryId: over.memoryId, organizationId: "org-lfg", phase: over.phase ?? MemoryPhase.Active,
    confidence: over.confidence ?? 0.7, weight: 0.5, freshnessAt: over.freshnessAt ?? "2026-05-30T00:00:00Z",
    reinforcementCount: 1,
    outcome: { successCount: over.outcome?.successCount ?? 0, failureCount: over.outcome?.failureCount ?? 0, inconclusiveCount: 0, workItemsObserved: [] },
    utility: { injectedCount: 6, citedCount: 3 },
    crossScope: { distinctScopes: over.distinctScopes ?? [], firstObservedAt: "2026-05-30T00:00:00Z", lastObservedAt: "2026-05-30T00:00:00Z" },
  };
  return { memoryId: over.memoryId, organizationId: "org-lfg", tier: over.tier ?? MemoryTier.Hat, scope: over.scope ?? "release-manager", key: "k", protected: over.protected ?? false, writtenBy: "system", writtenAt: "2026-05-30T00:00:00Z", state };
}

test("Stage A: confidence reinforcement auto-applies when KPI rose (good news, no hat)", () => {
  // 8 success / 0 failure → recomputed confidence 0.9 > current 0.6 → auto-apply
  const r = runMemoryMaintenanceCycle([env({ memoryId: "m1", confidence: 0.6, outcome: { successCount: 8 } })], deps());
  ok(r.reinforced.includes("m1"));
  const upd = r.updates.find((u) => u.memoryId === "m1")!;
  ok(upd.nextConfidence > 0.6);
  ok(r.events.some((e) => e.kind === OrgEventKind.MemoryReinforced && e.subjectId === "m1"));
});

test("Stage A: archive-at-zero retires an aged, useless memory forever", () => {
  // fully decayed work memory with bad KPI → resting weight under archive floor
  const aged = env({ memoryId: "m-old", tier: MemoryTier.Work, scope: "work-1", confidence: 0.2, freshnessAt: new Date(NOW - 90 * 86_400_000).toISOString(), outcome: { successCount: 0, failureCount: 6 } });
  const r = runMemoryMaintenanceCycle([aged], deps());
  ok(r.archived.includes("m-old"));
  const upd = r.updates.find((u) => u.memoryId === "m-old")!;
  equal(upd.nextPhase, MemoryPhase.Archived);
  equal(upd.nextWeight, 0);
  ok(upd.archivedAt !== undefined);
  ok(r.events.some((e) => e.kind === OrgEventKind.MemoryArchived));
});

test("protected memories are excluded from auto-archive and confidence decay", () => {
  const prot = env({ memoryId: "m-prot", tier: MemoryTier.Work, scope: "work-1", protected: true, confidence: 0.9, freshnessAt: new Date(NOW - 90 * 86_400_000).toISOString(), outcome: { successCount: 0, failureCount: 6 } });
  const r = runMemoryMaintenanceCycle([prot], deps());
  ok(!r.archived.includes("m-prot"), "protected memory must not be auto-archived");
  const upd = r.updates.find((u) => u.memoryId === "m-prot")!;
  equal(upd.nextPhase, MemoryPhase.Active);
  equal(upd.nextConfidence, 0.9, "protected confidence does not decay");
});

test("Stage B: a bad-KPI memory is FLAGGED but kept by default (bad news asks a hat)", () => {
  const bad = env({ memoryId: "m-bad", confidence: 0.8, outcome: { successCount: 1, failureCount: 5 } });
  const r = runMemoryMaintenanceCycle([bad], deps());
  ok(r.demotionCandidates.includes("m-bad"), "flagged as a demotion candidate");
  ok(!r.demoted.includes("m-bad"), "but NOT auto-demoted — default chooser keeps it");
  equal(r.updates.find((u) => u.memoryId === "m-bad")!.nextPhase, MemoryPhase.Active);
});

test("Stage B: a hat chooser CAN demote within the legal set", () => {
  const bad = env({ memoryId: "m-bad", confidence: 0.8, outcome: { successCount: 1, failureCount: 5 } });
  const r = runMemoryMaintenanceCycle([bad], deps({
    chooseDemotion: (legal) => ({ index: legal.indexOf(MemoryDemotionChoice.Demote), reason: "reviewer demotes" }),
  }));
  ok(r.demoted.includes("m-bad"));
  equal(r.updates.find((u) => u.memoryId === "m-bad")!.nextPhase, MemoryPhase.Demoted);
  ok(r.events.some((e) => e.kind === OrgEventKind.MemoryDemoted && e.actorHatId === "memory_reviewer"));
});

test("Stage B: a lesson seen across ≥3 scopes is a promotion candidate; chooser approves work→hat", () => {
  const cross = env({ memoryId: "m-cross", tier: MemoryTier.Work, scope: "work-1", confidence: 0.8, outcome: { successCount: 5 }, distinctScopes: ["work-1", "work-2", "work-3"] });
  const r = runMemoryMaintenanceCycle([cross], deps({ choosePromotion: (legal) => ({ index: legal.indexOf(true), reason: "router approves" }) }));
  ok(r.promotionCandidates.includes("m-cross"));
  equal(r.promoted[0]!.memoryId, "m-cross");
  equal(r.promoted[0]!.target.toTier, MemoryTier.Hat);
  ok(r.events.some((e) => e.kind === OrgEventKind.MemoryPromoted && e.actorHatId === "knowledge_router"));
});

test("Stage B: conflict resolution routes through memory_reviewer within the legal set", () => {
  const conflicted = env({ memoryId: "m-conf", phase: MemoryPhase.Conflicted, confidence: 0.8, outcome: { successCount: 5 } });
  const r = runMemoryMaintenanceCycle([conflicted], deps({
    chooseConflict: (legal) => ({ index: legal.indexOf(MemoryConflictChoice.KeepThis), reason: "reviewer keeps this" }),
  }));
  ok(r.conflictsResolved.includes("m-conf"));
  equal(r.updates.find((u) => u.memoryId === "m-conf")!.nextPhase, MemoryPhase.Active);
  ok(r.events.some((e) => e.kind === OrgEventKind.MemoryConflictFlagged));
});

test("the cycle emits one summary MemoryMaintenanceCycle event and skips archived memories", () => {
  const r = runMemoryMaintenanceCycle(
    [env({ memoryId: "m-active" }), env({ memoryId: "m-already", phase: MemoryPhase.Archived })],
    deps(),
  );
  equal(r.recomputed, 1); // archived skipped
  ok(r.events.some((e) => e.kind === OrgEventKind.MemoryMaintenanceCycle && e.subjectId === "org-lfg"));
});
