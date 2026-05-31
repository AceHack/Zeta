import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  ChangeSetPhase,
  OrgEventKind,
  ReviewGateKind,
  StageOutcome,
  type ChangeSet,
  type ReviewPipeline,
  type ReviewStage,
} from "../../domain/src/index.ts";
import {
  ExternalDecision,
  runReviewStage,
  resumeHumanStage,
  applyChangeSet,
  openChangeSet,
  resubmitChangeSet,
  contentAddressedChangeSetId,
  createContentAddressedEvidenceRef,
  type ReviewKernelDeps,
} from "../src/index.ts";

const NOW = Date.parse("2026-05-30T00:00:00Z");
let seq = 0;
function deps(over: Partial<ReviewKernelDeps> = {}): ReviewKernelDeps {
  return { organizationId: "org-lfg", now: NOW, createId: (p) => `${p}-${++seq}`, ...over };
}

function stage(over: Partial<ReviewStage> & { id: string }): ReviewStage {
  return { ownerLabel: "code_reviewer", authority: { kind: "hat", hatId: "code_reviewer" }, gate: ReviewGateKind.NoBlockingFindings, blocking: true, ...over };
}
function pipeline(stages: readonly ReviewStage[]): ReviewPipeline {
  return { pipelineId: "pl-1", organizationId: "org-lfg", stages };
}
function changeSet(over: Partial<ChangeSet> = {}): ChangeSet {
  return {
    changeSetId: "cs-1", organizationId: "org-lfg", workItemId: "work-1", proposerHatId: "code_author",
    title: "t", targetRef: "feat/x", phase: ChangeSetPhase.InReview, pipelineId: "pl-1", currentStageIndex: 0,
    artifacts: [{ kind: "code_diff", path: "a.ts", diff: "+x", language: "ts" }], projections: [], revision: 1,
    openedAt: "2026-05-30T00:00:00Z", updatedAt: "2026-05-30T00:00:00Z", ...over,
  };
}

test("content-addressed changeSetId is deterministic + revision-keyed", () => {
  const a = contentAddressedChangeSetId("org-lfg", "work-1", "feat/x", 1);
  equal(a, contentAddressedChangeSetId("org-lfg", "work-1", "feat/x", 1));
  ok(a !== contentAddressedChangeSetId("org-lfg", "work-1", "feat/x", 2)); // new revision → new id
});

test("openChangeSet: drafted → in_review at stage 0, emits ChangeSetOpened", () => {
  const r = openChangeSet(changeSet({ phase: ChangeSetPhase.Drafted, currentStageIndex: 5 }), deps());
  equal(r.changeSet.phase, ChangeSetPhase.InReview);
  equal(r.changeSet.currentStageIndex, 0);
  ok(r.events.some((e) => e.kind === OrgEventKind.ChangeSetOpened));
});

test("hat stage: a satisfiable gate advances the cursor (ReviewStageAdvanced)", () => {
  const pl = pipeline([stage({ id: "code-review" }), stage({ id: "security" })]);
  const evidence = gateEvidenceRef("review", "code-review-clean");
  const r = runReviewStage(changeSet({ currentStageIndex: 0 }), pl, deps({
    blockingFindings: () => 0,
    stageEvidenceRefs: () => [evidence],
  }));
  equal(r.paused, false);
  equal(r.changeSet.currentStageIndex, 1);
  equal(r.changeSet.phase, ChangeSetPhase.InReview);
  ok(r.events.some((e) => e.kind === OrgEventKind.ReviewStageAdvanced));
  ok(r.events.some((e) => e.evidenceRefs.includes(evidence)));
});

test("hat stage: a true gate without content-addressed evidence cannot advance", () => {
  const pl = pipeline([stage({ id: "code-review" })]);
  const r = runReviewStage(changeSet({ currentStageIndex: 0 }), pl, deps({
    blockingFindings: () => 0,
  }));

  equal(r.changeSet.phase, ChangeSetPhase.ChangesRequested);
  equal(r.gate.satisfiable, false);
  ok(r.events.some((e) => e.kind === OrgEventKind.ChangesRequested));
});

test("THE CLAMP: a hat cannot approve an unsatisfiable gate — it is forced to request_changes", () => {
  const pl = pipeline([stage({ id: "code-review" })]);
  // hat chooser TRIES to approve (index 0 of a normally-approve-first set), but the gate is unsatisfiable
  const r = runReviewStage(changeSet(), pl, deps({
    blockingFindings: () => 3, // gate NOT satisfiable
    hatChooser: () => ({ index: 0, reason: "I approve" }), // attempts approve
  }));
  equal(r.changeSet.phase, ChangeSetPhase.ChangesRequested, "approve clamped to request_changes");
  ok(r.events.some((e) => e.kind === OrgEventKind.ChangesRequested));
});

test("last stage approve → ChangeSetApproved", () => {
  const pl = pipeline([stage({ id: "code-review" }), stage({ id: "final" })]);
  const r = runReviewStage(changeSet({ currentStageIndex: 1 }), pl, deps({
    blockingFindings: () => 0,
    stageEvidenceRefs: () => [gateEvidenceRef("review", "final-clean")],
  }));
  equal(r.changeSet.phase, ChangeSetPhase.Approved);
  const approved = r.events.find((e) => e.kind === OrgEventKind.ChangeSetApproved);
  ok(approved);
  equal(approved!.fromState, ChangeSetPhase.InReview);
  equal(approved!.toState, ChangeSetPhase.Approved);
});

test("quorum stage: the board's agreement IS the gate (≥ threshold → approve)", () => {
  const pl = pipeline([stage({ id: "security", authority: { kind: "quorum", hatIds: ["a", "b", "c"], threshold: 3 }, gate: ReviewGateKind.QuorumAgreed }), stage({ id: "final" })]);
  const agreed = runReviewStage(changeSet({ currentStageIndex: 0 }), pl, deps({
    quorumApprovals: () => 3,
    stageEvidenceRefs: () => [gateEvidenceRef("quorum-vote", "security-3-of-3")],
  }));
  ok(agreed.events.some((e) => e.kind === OrgEventKind.StageApproved));
  equal(agreed.changeSet.currentStageIndex, 1);
  // not enough approvals → request changes
  const shy = runReviewStage(changeSet({ currentStageIndex: 0 }), pl, deps({ quorumApprovals: () => 2 }));
  equal(shy.changeSet.phase, ChangeSetPhase.ChangesRequested);
});

test("human stage PAUSES the change set (HITL) — does not advance until resumed", () => {
  const pl = pipeline([stage({ id: "human-signoff", authority: { kind: "human", role: "qa_lead" }, gate: ReviewGateKind.NoBlockingFindings }), stage({ id: "final" })]);
  const paused = runReviewStage(changeSet({ currentStageIndex: 0 }), pl, deps());
  equal(paused.paused, true);
  equal(paused.changeSet.currentStageIndex, 0, "cursor did not move");
  ok(paused.events.some((e) => e.kind === OrgEventKind.HumanSignoffRequested));
  // the human signs off → resume advances
  const resumed = resumeHumanStage(paused.changeSet, pl, StageOutcome.Approve, "qa_lead", deps({
    stageEvidenceRefs: () => [gateEvidenceRef("human-signoff", "qa-lead")],
  }));
  equal(resumed.changeSet.currentStageIndex, 1);
  ok(resumed.events.some((e) => e.kind === OrgEventKind.StageApproved));
});

test("human stage resume cannot approve without content-addressed evidence", () => {
  const pl = pipeline([stage({ id: "human-signoff", authority: { kind: "human", role: "qa_lead" }, gate: ReviewGateKind.NoBlockingFindings }), stage({ id: "final" })]);
  const paused = runReviewStage(changeSet({ currentStageIndex: 0 }), pl, deps());

  const resumed = resumeHumanStage(paused.changeSet, pl, StageOutcome.Approve, "qa_lead", deps());

  equal(resumed.changeSet.phase, ChangeSetPhase.ChangesRequested);
  ok(resumed.events.some((e) => e.kind === OrgEventKind.ChangesRequested));
});

test("external stage: an external approval flows IN as a gate satisfaction (not a bypass)", () => {
  const pl = pipeline([stage({ id: "external-code-review", authority: { kind: "external", system: "github" }, gate: ReviewGateKind.ExternalApproved, projectTo: "github" }), stage({ id: "final" })]);
  // still pending externally → the change set waits
  const waiting = runReviewStage(changeSet({ currentStageIndex: 0 }), pl, deps({ externalDecision: () => ExternalDecision.Pending }));
  equal(waiting.paused, true);
  equal(waiting.changeSet.currentStageIndex, 0);
  // human approves the PR externally → next run reads approved → advances through the SAME kernel
  const approved = runReviewStage(changeSet({ currentStageIndex: 0 }), pl, deps({
    externalDecision: () => ExternalDecision.Approved,
    stageEvidenceRefs: () => [gateEvidenceRef("external-approval", "github-approved")],
  }));
  equal(approved.paused, false);
  equal(approved.changeSet.currentStageIndex, 1);
  ok(approved.events.some((e) => e.kind === OrgEventKind.StageApproved && e.decision.includes("external:github")));
});

test("changes_requested → resubmit bumps revision + re-enters review at stage 0", () => {
  const r = resubmitChangeSet(changeSet({ phase: ChangeSetPhase.ChangesRequested, revision: 1, currentStageIndex: 2 }), deps());
  equal(r.changeSet.phase, ChangeSetPhase.InReview);
  equal(r.changeSet.revision, 2);
  equal(r.changeSet.currentStageIndex, 0);
});

test("approved → applied materializes (ChangeSetApplied)", () => {
  const r = applyChangeSet(changeSet({ phase: ChangeSetPhase.Approved }), deps());
  equal(r.changeSet.phase, ChangeSetPhase.Applied);
  ok(r.events.some((e) => e.kind === OrgEventKind.ChangeSetApplied));
});

test("a blocking stage may reject — terminal", () => {
  const pl = pipeline([stage({ id: "security", blocking: true })]);
  const r = runReviewStage(changeSet(), pl, deps({
    blockingFindings: () => 0,
    stageEvidenceRefs: () => [gateEvidenceRef("review", "security-clean")],
    hatChooser: (legal) => ({ index: legal.indexOf(StageOutcome.Reject), reason: "unsafe" }),
  }));
  equal(r.changeSet.phase, ChangeSetPhase.Rejected);
  ok(r.events.some((e) => e.kind === OrgEventKind.ChangeSetRejected));
});

function gateEvidenceRef(kind: string, id: string): string {
  return createContentAddressedEvidenceRef(kind, { id });
}
