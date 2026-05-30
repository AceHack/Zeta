import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { HatBindingPhase } from "../../domain/src/index.ts";
import { HatLevel } from "../../domain/src/index.ts";
import { OrgEventKind, type OrgEvent } from "../../domain/src/index.ts";
import type { HatBinding } from "../../domain/src/index.ts";
import { buildHatDefinitions } from "../../application/src/index.ts";
import { buildOrgSnapshot, renderOrgSnapshot } from "../src/org-snapshot.ts";

const hats = buildHatDefinitions();
const NOW = 2_000_000;

function binding(id: string, hatId: string, agent: string, phase: HatBindingPhase, expiresInS: number): HatBinding {
  return {
    id, hatId, organizationId: "org-1", wearerAgentId: agent, phase,
    boundAt: new Date(NOW - 1000).toISOString(),
    warmupEndsAt: new Date(NOW - 500).toISOString(),
    expiresAt: new Date(NOW + expiresInS * 1000).toISOString(),
  };
}

function ev(kind: OrgEventKind, actorHatId: string | undefined, subjectId: string, toState: string, decision: string, atMs: number): OrgEvent {
  return {
    id: `e-${atMs}`, kind, occurredAt: new Date(atMs).toISOString(), organizationId: "org-1",
    ...(actorHatId !== undefined ? { actorHatId } : {}),
    subjectId, toState, decision, supervisorChain: [], evidenceRefs: [],
    correlationId: "c", causationId: "c", traceId: "t",
  };
}

test("the snapshot surfaces activity at every hierarchy level (whole hierarchy working)", () => {
  // one event from each level of the hierarchy
  const events: OrgEvent[] = [
    ev(OrgEventKind.PriorityDecision, "executive_board_member", "wi-1", "expedite", "board set priority", NOW - 6000),
    ev(OrgEventKind.HatSupplyDecision, "cfo", "backend_implementer", "expand", "cfo approved supply", NOW - 5000),
    ev(OrgEventKind.PriorityDecision, "engineering_director", "wi-2", "high", "director set priority", NOW - 4000),
    ev(OrgEventKind.HatAssignment, "engineering_manager", "code_reviewer", "assigned", "manager assigned", NOW - 3000),
    ev(OrgEventKind.HatBindingTransition, "team_lead", "b-1", "active", "lead active", NOW - 2000),
    ev(OrgEventKind.QualityGateEvaluation, "backend_implementer", "wi-1", "approved", "ic acted", NOW - 1000),
  ];
  const snap = buildOrgSnapshot({ hats, bindings: [], events, nowMs: NOW, nowIso: new Date(NOW).toISOString() });

  // every hierarchy level shows at least one event → the whole chain is acting
  for (const level of Object.values(HatLevel)) {
    const activity = snap.hierarchyActivity.find((h) => h.level === level)!;
    ok(activity.eventCount >= 1, `no activity at level ${level}`);
  }
  // the hierarchy is ordered Executive Board first
  equal(snap.hierarchyActivity[0]?.level, HatLevel.ExecutiveBoard);
});

test("active bindings roll up per department and show time-to-expiry", () => {
  const bindings: HatBinding[] = [
    binding("b-1", "backend_implementer", "agent-A", HatBindingPhase.Active, 10),
    binding("b-2", "code_reviewer", "agent-B", HatBindingPhase.Active, 90),
    binding("b-3", "tpm", "agent-C", HatBindingPhase.Expired, -5), // terminal → excluded
  ];
  const snap = buildOrgSnapshot({ hats, bindings, events: [], nowMs: NOW, nowIso: new Date(NOW).toISOString() });
  equal(snap.totalActiveBindings, 2); // expired excluded
  ok(snap.departments.length >= 1);
  // backend expires in ~10s → expiring soon (default 30s window)
  ok(snap.expiringSoon.some((b) => b.hatId === "backend_implementer"));
  ok(!snap.expiringSoon.some((b) => b.hatId === "code_reviewer")); // 90s out
});

test("pipeline stage, priority, and supply are folded from the event stream", () => {
  const events: OrgEvent[] = [
    ev(OrgEventKind.PipelineStageTransition, "product_owner", "wi-1", "awaiting_brd_approval", "advanced", NOW - 2000),
    ev(OrgEventKind.PipelineStageTransition, "brd_reviewer", "wi-1", "awaiting_architecture_approval", "advanced", NOW - 1000), // later wins
    ev(OrgEventKind.PriorityDecision, "engineering_director", "wi-1", "high", "priority", NOW - 1500),
    ev(OrgEventKind.HatSupplyDecision, undefined, "backend_implementer", "expand", "supply", NOW - 1200),
  ];
  const snap = buildOrgSnapshot({ hats, bindings: [], events, nowMs: NOW, nowIso: new Date(NOW).toISOString() });
  equal(snap.pipeline.find((p) => p.workItemId === "wi-1")?.stage, "awaiting_architecture_approval");
  equal(snap.latestPriorityByWorkItem["wi-1"], "high");
  equal(snap.latestSupplyByHat["backend_implementer"], "expand");
});

test("the fold is order-independent: newest-state wins even when events arrive DESC (store returns newest-first)", () => {
  // Same 7-gate progression, but presented newest→oldest the way the Cockroach
  // store returns rows (ORDER BY occurred_at DESC). A naive last-write-wins fold
  // would pick the OLDEST stage; the correct fold keeps the newest by timestamp.
  const stages = [
    "awaiting_brd_approval", "awaiting_architecture_approval", "awaiting_implementation_review",
    "awaiting_runtime_validation", "awaiting_final_business_validation", "awaiting_release_readiness", "merged",
  ];
  const ascending: OrgEvent[] = stages.map((s, i) =>
    ev(OrgEventKind.PipelineStageTransition, "product_owner", "wi-9", s, "advanced", NOW - (stages.length - i) * 1000),
  );
  const descending = [...ascending].reverse(); // newest first, as the store returns them
  const snap = buildOrgSnapshot({ hats, bindings: [], events: descending, nowMs: NOW, nowIso: new Date(NOW).toISOString() });
  equal(snap.pipeline.find((p) => p.workItemId === "wi-9")?.stage, "merged");
});

test("renderOrgSnapshot produces a readable report", () => {
  const snap = buildOrgSnapshot({ hats, bindings: [binding("b-1", "ceo", "agent-A", HatBindingPhase.Active, 100)], events: [], nowMs: NOW, nowIso: new Date(NOW).toISOString() });
  const report = renderOrgSnapshot(snap);
  ok(report.includes("ORG SNAPSHOT"));
  ok(report.includes("HIERARCHY ACTIVITY"));
});
