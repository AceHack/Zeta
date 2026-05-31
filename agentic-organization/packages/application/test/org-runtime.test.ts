import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { HatLevel, type HatBinding, type OrgEvent } from "../../domain/src/index.ts";
import { runOrgCycle } from "../src/org-runtime.ts";
import { PipelineStage } from "../src/pipeline.ts";

function harness() {
  const events: OrgEvent[] = [];
  const bindings = new Map<string, HatBinding>();
  let n = 0;
  return {
    events, bindings,
    deps: {
      organizationId: "org-lfg",
      workItemId: "wi-customer-goal-1",
      baseTimeMs: Date.parse("2026-05-30T10:00:00.000Z"),
      createId: (prefix: string) => `${prefix}-${++n}`,
      appendEvent: async (e: OrgEvent) => void events.push(e),
      upsertBinding: async (b: HatBinding) => void bindings.set(b.id, b),
    },
  };
}

test("one org cycle drives a customer goal all the way to Merged", async () => {
  const h = harness();
  const report = await runOrgCycle(h.deps);
  equal(report.finalStage, PipelineStage.Merged);
  equal(report.gatesPassed, 7); // all 7 gates passed
});

test("the entire hierarchy acts: events at Executive Board → C-suite → Director → Manager → Lead → IC", async () => {
  const h = harness();
  const report = await runOrgCycle(h.deps);
  for (const level of Object.values(HatLevel)) {
    ok(report.eventsByLevel[level]! >= 1, `no events at hierarchy level ${level}`);
  }
  // and the top of the chain genuinely acted
  ok(report.eventsByLevel[HatLevel.ExecutiveBoard]! >= 1);
  ok(report.eventsByLevel[HatLevel.CSuite]! >= 1);
});

test("hats are staffed and the binding lifecycle is exercised (expiry + succession observed)", async () => {
  const h = harness();
  const report = await runOrgCycle(h.deps);
  ok(report.bindingsCreated >= 5);
  equal(report.expiriesObserved, 1);
  equal(report.successionsPlanned, 1);
  // a binding actually ended up Expired in the persisted state
  ok([...h.bindings.values()].some((b) => b.phase === "expired"));
});

test("the cycle emits a rich, attributed trace (every event names its decision)", async () => {
  const h = harness();
  await runOrgCycle(h.deps);
  ok(h.events.length >= 20);
  // every event carries a human-readable decision and a supervisor chain
  for (const e of h.events) {
    ok(e.decision.length > 0);
    ok(Array.isArray(e.supervisorChain));
  }
  // gate evaluations + pipeline transitions + priority + supply + assignment + lifecycle are all present
  const kinds = new Set(h.events.map((e) => e.kind));
  ok(kinds.has("priority_decision"));
  ok(kinds.has("hat_supply_decision"));
  ok(kinds.has("hat_assignment"));
  ok(kinds.has("quality_gate_evaluation"));
  ok(kinds.has("pipeline_stage_transition"));
  ok(kinds.has("hat_binding_transition"));
  ok(kinds.has("succession_planned"));
});

test("RMO office chooses hat wearers from ranked reputation alternatives during the org cycle", async () => {
  const h = harness();
  await runOrgCycle(h.deps);
  const rmoAssignments = h.events.filter((e) => e.kind === "hat_assignment" && e.actorHatId === "rmo_office");
  ok(rmoAssignments.length >= 1);
  ok(rmoAssignments.every((e) => e.decision.includes("alternatives:")));
});
