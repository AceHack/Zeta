import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { QualityGateKind, QualityGateOutcome } from "../../domain/src/records.ts";
import { buildHatDefinitions } from "../src/org-seed.ts";
import { firstLegalChooser, type OrgChooser } from "../src/org-decision.ts";
import {
  GateOwnerHats,
  PipelineStage,
  evaluateGate,
  nextLegalGate,
  recoveryPathFor,
  stageFor,
} from "../src/pipeline.ts";

const hats = buildHatDefinitions();
const byId = new Map(hats.map((h) => [h.id, h]));

const ctx = {
  createEventId: (() => { let n = 0; return () => `evt-${++n}`; })(),
  nowIso: () => "2026-05-30T09:00:00.000Z",
  organizationId: "org-1",
  supervisorChain: ["executive_board_member", "ceo", "product_director", "product_owner"],
  correlationId: "c", causationId: "c", traceId: "t",
};

// a chooser that always picks a specific outcome
function pick(outcome: QualityGateOutcome): OrgChooser<QualityGateOutcome> {
  return (legal) => ({ index: legal.indexOf(outcome), reason: `chose ${outcome}` });
}

test("the first legal gate is customer_rfp_review with nothing passed", () => {
  equal(nextLegalGate(new Set()), QualityGateKind.CustomerRfpReview);
  equal(stageFor(new Set()), PipelineStage.AwaitingCustomerRfpReview);
});

test("gates unlock strictly in order as priors pass", () => {
  equal(nextLegalGate(new Set([QualityGateKind.CustomerRfpReview])), QualityGateKind.BrdApproval);
  equal(nextLegalGate(new Set([QualityGateKind.CustomerRfpReview, QualityGateKind.BrdApproval])), QualityGateKind.ArchitectureApproval);
});

test("when all 7 gates pass, the work item may merge", () => {
  const allPassed = new Set(Object.values(QualityGateKind));
  equal(nextLegalGate(allPassed), undefined);
  equal(stageFor(allPassed), PipelineStage.Merged);
});

test("an owner hat approves a gate and advances the work item one stage", () => {
  const productOwner = byId.get("product_owner")!;
  const result = evaluateGate({
    workItemId: "wi-1",
    gateKind: QualityGateKind.CustomerRfpReview,
    evaluatorHat: productOwner,
    passedGateKinds: new Set(),
    outcomeChooser: pick(QualityGateOutcome.Approved),
  }, ctx);
  equal(result.outcome, "evaluated");
  if (result.outcome !== "evaluated") return;
  equal(result.evaluation.outcome, QualityGateOutcome.Approved);
  equal(result.advancedTo, PipelineStage.AwaitingBrdApproval);
  // emits both a gate-evaluation event AND a stage-transition event
  equal(result.events.length, 2);
  ok(result.events.some((e) => e.decision.includes("advanced")));
});

test("a non-owner hat cannot evaluate a gate", () => {
  const backend = byId.get("backend_implementer")!;
  const result = evaluateGate({
    workItemId: "wi-1",
    gateKind: QualityGateKind.CustomerRfpReview,
    evaluatorHat: backend,
    passedGateKinds: new Set(),
    outcomeChooser: firstLegalChooser(),
  }, ctx);
  equal(result.outcome, "not_authorized");
});

test("changes_requested does NOT advance the stage (stays put)", () => {
  const productOwner = byId.get("product_owner")!;
  const result = evaluateGate({
    workItemId: "wi-1",
    gateKind: QualityGateKind.CustomerRfpReview,
    evaluatorHat: productOwner,
    passedGateKinds: new Set(),
    outcomeChooser: pick(QualityGateOutcome.ChangesRequested),
  }, ctx);
  equal(result.outcome, "evaluated");
  if (result.outcome !== "evaluated") return;
  equal(result.advancedTo, PipelineStage.AwaitingCustomerRfpReview); // unchanged
  equal(result.events.length, 1); // only the evaluation event
});

test("every gate has at least one owner hat that actually holds its approval scope", () => {
  for (const [gateKind, owners] of Object.entries(GateOwnerHats)) {
    const valid = owners.filter((id) => byId.get(id)?.approvalScopes.includes(gateKind));
    ok(valid.length >= 1, `gate ${gateKind} has no owner with the approval scope`);
  }
});

test("failures route to the documented recovery path", () => {
  equal(recoveryPathFor(QualityGateKind.ImplementationReview), "back_to_engineering");
  equal(recoveryPathFor(QualityGateKind.ArchitectureApproval), "reopen_architecture");
  equal(recoveryPathFor(QualityGateKind.BrdApproval), "reopen_discovery_or_brd");
});
