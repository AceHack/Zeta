import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { buildHatDefinitions } from "../src/org-seed.ts";
import { firstLegalChooser } from "../src/org-decision.ts";
import {
  PriorityClass,
  PriorityDecidedBy,
  computePriorityRecommendation,
  decidePriority,
  legalPriorityClassesFor,
  type PriorityInputs,
} from "../src/prioritization.ts";
import {
  HatSupplyAction,
  computeRequiredHatSupply,
  decideHatSupply,
  recommendSupplyAction,
  type HatSupplyVote,
  type WorkloadItem,
} from "../src/rmo.ts";
import { HatLevel } from "../../domain/src/hat-definition.ts";

const hats = buildHatDefinitions();
const tpm = hats.find((h) => h.id === "tpm")!;
const director = hats.find((h) => h.id === "engineering_director")!;
const implementer = hats.find((h) => h.id === "backend_implementer")!;

const lowInputs: PriorityInputs = { executivePriority: 0, customerImpact: 0, severity: 0, releaseRisk: 0, blockedDownstreamCount: 0, dependencyFanOut: 0, queueAgeMs: 0, hatScarcity: 0, budgetBurn: 0, estimatedEffort: 0.5 };
const hotInputs: PriorityInputs = { executivePriority: 1, customerImpact: 1, severity: 1, releaseRisk: 1, blockedDownstreamCount: 5, dependencyFanOut: 5, queueAgeMs: 3_600_000, hatScarcity: 1, budgetBurn: 0, estimatedEffort: 0.3 };

const ctx = {
  createEventId: () => "evt-1",
  nowIso: () => "2026-05-30T09:00:00.000Z",
  organizationId: "org-1",
  supervisorChain: ["executive_board_member", "ceo", "cto", "engineering_director", "tpm"],
  correlationId: "c", causationId: "c", traceId: "t",
};

test("priority recommendation scores hot work as expedite, idle as defer", () => {
  const hot = computePriorityRecommendation("wi-hot", hotInputs, ["backend_implementer"]);
  equal(hot.priorityClass, PriorityClass.Expedite);
  ok(hot.reasonCodes.includes("executive_priority"));

  const cold = computePriorityRecommendation("wi-cold", lowInputs, []);
  ok(cold.priorityClass === PriorityClass.Defer || cold.priorityClass === PriorityClass.Normal);
});

test("legal priority classes are bounded by authority level", () => {
  ok(legalPriorityClassesFor(HatLevel.IndividualContributor).length === 0);
  ok(!legalPriorityClassesFor(HatLevel.Manager).includes(PriorityClass.Expedite)); // TPM cannot expedite
  ok(legalPriorityClassesFor(HatLevel.Director).includes(PriorityClass.Expedite)); // Director can
});

test("a TPM cannot expedite — the decision is clamped to its legal set", () => {
  const rec = computePriorityRecommendation("wi-1", hotInputs, ["backend_implementer"]); // wants expedite
  const result = decidePriority({ recommendation: rec, deciderHat: tpm, chooser: firstLegalChooser() }, ctx);
  equal(result.outcome, "decided");
  if (result.outcome !== "decided") return;
  // expedite is illegal for a TPM → falls to the highest it CAN set (high)
  equal(result.decision.priorityClass, PriorityClass.High);
  equal(result.decision.decidedBy, PriorityDecidedBy.Tpm);
});

test("a Director may honor an expedite recommendation", () => {
  const rec = computePriorityRecommendation("wi-1", hotInputs, ["backend_implementer"]);
  const result = decidePriority({ recommendation: rec, deciderHat: director, chooser: firstLegalChooser() }, ctx);
  equal(result.outcome, "decided");
  if (result.outcome !== "decided") return;
  equal(result.decision.priorityClass, PriorityClass.Expedite);
  equal(result.decision.decidedBy, PriorityDecidedBy.DepartmentDirector);
});

test("an individual contributor cannot decide priority", () => {
  const rec = computePriorityRecommendation("wi-1", hotInputs, []);
  const result = decidePriority({ recommendation: rec, deciderHat: implementer, chooser: firstLegalChooser() }, ctx);
  equal(result.outcome, "not_authorized");
});

test("RMO computes required hat supply from the prioritized workload", () => {
  const workload: WorkloadItem[] = [
    { workItemId: "a", priorityClass: PriorityClass.Expedite, requiredHats: ["backend_implementer", "code_reviewer"] },
    { workItemId: "b", priorityClass: PriorityClass.High, requiredHats: ["backend_implementer"] },
    { workItemId: "c", priorityClass: PriorityClass.Paused, requiredHats: ["backend_implementer"] }, // ignored
  ];
  const required = computeRequiredHatSupply(workload);
  // backend gets weight 2+2 = 4 → ceil(4/2)=2 wearers; code_reviewer weight 2 → 1
  equal(required.get("backend_implementer"), 2);
  equal(required.get("code_reviewer"), 1);
  ok(!required.has("qa_reviewer"));
});

test("recommendSupplyAction compares demand vs current", () => {
  equal(recommendSupplyAction(3, 1), HatSupplyAction.Expand);
  equal(recommendSupplyAction(1, 3), HatSupplyAction.Release);
  equal(recommendSupplyAction(2, 2), HatSupplyAction.Hold);
});

test("supervisor vote expands hat supply when quorum approves", () => {
  const votes: HatSupplyVote[] = [
    { voterHatId: "engineering_director", approve: true, proposedTarget: 3 },
    { voterHatId: "cfo", approve: true, proposedTarget: 2 },
    { voterHatId: "cost_controller", approve: false, proposedTarget: 1 },
  ];
  const { decision, event } = decideHatSupply({ hatId: "backend_implementer", hatName: "Backend Implementer", requiredCount: 3, currentCount: 1, votes }, ctx);
  equal(decision.quorumMet, true); // 2 of 3 approve
  equal(decision.action, HatSupplyAction.Expand);
  equal(decision.targetCount, 3); // median of approvers' proposals [2,3] = round(2.5) = 3
  ok(event.decision.includes("Backend Implementer"));
});

test("no quorum → supply holds at current", () => {
  const votes: HatSupplyVote[] = [
    { voterHatId: "engineering_director", approve: false, proposedTarget: 3 },
    { voterHatId: "cfo", approve: false, proposedTarget: 2 },
  ];
  const { decision } = decideHatSupply({ hatId: "backend_implementer", hatName: "Backend Implementer", requiredCount: 5, currentCount: 1, votes }, ctx);
  equal(decision.quorumMet, false);
  equal(decision.action, HatSupplyAction.Hold);
  equal(decision.targetCount, 1);
});
