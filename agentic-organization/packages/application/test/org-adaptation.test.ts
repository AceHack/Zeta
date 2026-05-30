import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { AutonomyLevel, WorkItemType, defaultTenantConfig } from "../../domain/src/index.ts";
import { planOnboarding, planSelfHealing, type AdaptationDeps } from "../src/index.ts";

let seq = 0;
const deps: AdaptationDeps = { organizationId: "org-lfg", now: () => Date.parse("2026-05-30T00:00:00Z"), createId: (p) => `${p}-${++seq}` };

test("C2: onboarding is planned as WORK the org runs through its normal loop (ingest/graph/handbooks/autonomy)", () => {
  const config = { ...defaultTenantConfig("org-lfg", "2026-05-30T00:00:00Z"), autonomy: { level: AutonomyLevel.Assisted, humanGatedStageIds: ["human-qa-signoff"] } };
  const { work, events } = planOnboarding(config, deps);
  const titles = work.map((w) => w.title);
  ok(titles.some((t) => t.includes("Ingest")));
  ok(titles.some((t) => t.includes("knowledge graph")));
  ok(titles.some((t) => t.includes("handbooks")));
  ok(titles.some((t) => t.includes("autonomy dial")), "the autonomy confirmation is itself a work item");
  equal(events.length, work.length, "each planned work item records an org_event");
});

test("C6: self-healing emits corrective work ONLY for non-zero drift signals (no busy-work)", () => {
  const none = planSelfHealing({ staleDocCount: 0, failingGateCount: 0, lowConfidenceEdgeCount: 0, docConflictCount: 0 }, deps);
  equal(none.work.length, 0, "a healthy org plans no healing work");

  const drifting = planSelfHealing({ staleDocCount: 3, failingGateCount: 1, lowConfidenceEdgeCount: 5, docConflictCount: 2 }, deps);
  equal(drifting.work.length, 4, "one corrective work item per non-zero signal");
  // a failing gate becomes a Defect; the rest are Tasks
  ok(drifting.work.some((w) => w.workItemType === WorkItemType.Defect && w.title.includes("failing quality gate")));
  ok(drifting.work.some((w) => w.title.includes("Re-review 3 stale")));
  ok(drifting.work.some((w) => w.title.includes("Verify 5 low-confidence")));
  ok(drifting.work.some((w) => w.title.includes("Resolve 2 document conflict")));
});

test("C6: a partial drift produces only the matching corrections", () => {
  const partial = planSelfHealing({ staleDocCount: 7, failingGateCount: 0, lowConfidenceEdgeCount: 0, docConflictCount: 0 }, deps);
  equal(partial.work.length, 1);
  ok(partial.work[0]!.title.includes("Re-review 7 stale"));
});
