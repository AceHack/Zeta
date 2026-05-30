import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { HatLevel, OrgEventKind, WorkItemState, type OrgEvent } from "../../domain/src/index.ts";
import { buildHatDefinitions } from "../src/org-seed.ts";
import {
  EscalationTrigger,
  EscalationAction,
  bounceBackCount,
  detectChurn,
  legalEscalationActions,
  decideEscalation,
} from "../src/index.ts";
import { firstLegalChooser } from "../src/org-decision.ts";

const hats = buildHatDefinitions();
const byId = new Map(hats.map((h) => [h.id, h]));
const manager = hats.find((h) => h.level === HatLevel.Manager)!;
const ic = hats.find((h) => h.level === HatLevel.IndividualContributor)!;

function bounce(workItemId: string, i: number): OrgEvent {
  return {
    id: `e${i}`, kind: OrgEventKind.WorkItemTransition, occurredAt: `2026-05-30T0${i}:00:00.000Z`,
    organizationId: "org-lfg", subjectId: workItemId, fromState: WorkItemState.Review, toState: WorkItemState.InProgress,
    decision: "QA failed; rework", supervisorChain: [], evidenceRefs: [], correlationId: "c", causationId: "c", traceId: "t",
  };
}
function ctx() {
  return { organizationId: "org-lfg", createEventId: () => "evt-x", nowIso: () => "2026-05-30T05:00:00.000Z", supervisorChain: ["ceo", manager.id], correlationId: "c", causationId: "c", traceId: "t" };
}

test("bounce-backs are counted and churn crosses the threshold at 3", () => {
  const events = [bounce("wi-1", 1), bounce("wi-1", 2), bounce("wi-1", 3)];
  equal(bounceBackCount("wi-1", events), 3);
  ok(detectChurn("wi-1", events));
  ok(!detectChurn("wi-1", events.slice(0, 2))); // 2 < 3, not yet churn
});

test("legal escalations are bounded per trigger and require management authority", () => {
  const mgr = legalEscalationActions(EscalationTrigger.RepeatedQaBounceBack, HatLevel.Manager);
  ok(mgr.includes(EscalationAction.AddAgents));
  ok(mgr.includes(EscalationAction.BringInArchitect));
  // an IC/Lead has no escalation authority → empty legal set
  equal(legalEscalationActions(EscalationTrigger.RepeatedQaBounceBack, HatLevel.IndividualContributor).length, 0);
});

test("an IC cannot escalate (no authority)", () => {
  const r = decideEscalation(
    { trigger: EscalationTrigger.RepeatedQaBounceBack, workItemId: "wi-1", ownerHatIds: ["backend_implementer"], deciderHat: ic, chooser: firstLegalChooser() },
    ctx(),
  );
  equal(r.outcome, "no_authority");
});

test("AddAgents escalation routes to RMO supply-expand (more agents)", () => {
  // chooser picks index 0 = AddAgents (first legal for RepeatedQaBounceBack)
  const r = decideEscalation(
    { trigger: EscalationTrigger.RepeatedQaBounceBack, workItemId: "wi-1", ownerHatIds: ["backend_implementer", "code_reviewer"], deciderHat: manager, chooser: firstLegalChooser() },
    ctx(),
  );
  equal(r.outcome, "escalated");
  if (r.outcome !== "escalated") return;
  equal(r.action, EscalationAction.AddAgents);
  equal(r.change.kind, "expand_supply");
  if (r.change.kind === "expand_supply") {
    equal(r.change.ownerHatIds.length, 2);
    ok(r.change.addCount >= 1);
  }
  equal(r.event.kind, OrgEventKind.EscalationDecision);
});

test("BringInArchitect changes the approach (reopens architecture gate)", () => {
  // chooser picks index 1 = BringInArchitect
  const r = decideEscalation(
    { trigger: EscalationTrigger.RepeatedQaBounceBack, workItemId: "wi-1", ownerHatIds: ["backend_implementer"], deciderHat: manager, chooser: () => ({ index: 1, reason: "approach is wrong; bring architect" }) },
    ctx(),
  );
  if (r.outcome !== "escalated") throw new Error("expected escalation");
  equal(r.action, EscalationAction.BringInArchitect);
  equal(r.change.kind, "new_approach");
  if (r.change.kind === "new_approach") equal(r.change.reopenGate, "architecture_approval");
});

test("an out-of-range chooser index is clamped into the legal set (cannot escape)", () => {
  const r = decideEscalation(
    { trigger: EscalationTrigger.StaleBlocker, workItemId: "wi-1", ownerHatIds: [], deciderHat: manager, chooser: () => ({ index: 999, reason: "garbage" }) },
    ctx(),
  );
  if (r.outcome !== "escalated") throw new Error("expected escalation");
  ok(legalEscalationActions(EscalationTrigger.StaleBlocker, HatLevel.Manager).includes(r.action));
});

void byId;
