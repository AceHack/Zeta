import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";
import { QualityGateOutcome } from "../../domain/src/index.ts";
import { FindingDecisionState, ReviewDimension, ReviewSeverity, ReviewStance, type CandidateFinding, type ReviewerVote } from "../../metrics/src/index.ts";
import { ReviewGateBasis, ReviewGateFeedbackReason, evaluateReviewGate } from "../src/review-gate.ts";

function finding(id: string, severity: (typeof ReviewSeverity)[keyof typeof ReviewSeverity]): CandidateFinding {
  return { findingId: id, dimension: ReviewDimension.Correctness, severity, subject: "x", comment: "c" };
}

function agree(agent: string, findingId: string): ReviewerVote {
  return { reviewerAgentId: agent, hatAssignmentId: `${agent}-h`, findingId, stance: ReviewStance.Agree, rationale: "" };
}

function disagree(agent: string, findingId: string): ReviewerVote {
  return { reviewerAgentId: agent, hatAssignmentId: `${agent}-h`, findingId, stance: ReviewStance.Disagree, rationale: "" };
}

test("an adopted major finding -> gate Rejected", () => {
  const r = evaluateReviewGate({
    findings: [finding("F1", ReviewSeverity.Major)],
    votes: [agree("a", "F1"), agree("b", "F1"), agree("c", "F1")],
  });
  equal(r.outcome, "ok");
  if (r.outcome !== "ok") return;
  equal(r.recommendedGateOutcome, QualityGateOutcome.Rejected);
  equal(r.basis, ReviewGateBasis.AdoptedBlockingOrMajor);
  equal(r.adoptedFindingIds.includes("F1"), true);
});

test("adopted minor-only findings -> ChangesRequested", () => {
  const r = evaluateReviewGate({
    findings: [finding("F1", ReviewSeverity.Minor)],
    votes: [agree("a", "F1"), agree("b", "F1"), agree("c", "F1")],
  });
  equal(r.outcome, "ok");
  if (r.outcome !== "ok") return;
  equal(r.recommendedGateOutcome, QualityGateOutcome.ChangesRequested);
  equal(r.basis, ReviewGateBasis.AdoptedMinorOrInfoOnly);
});

test("fewer than quorum reviewers -> feedback (board could not convene)", () => {
  const r = evaluateReviewGate({
    findings: [finding("F1", ReviewSeverity.Major)],
    votes: [agree("a", "F1"), agree("b", "F1")],
  });
  equal(r.outcome, "feedback");
  if (r.outcome !== "feedback") return;
  equal(r.feedback.reason, ReviewGateFeedbackReason.BoardCouldNotConvene);
});

test("custom quorum of 2 adopts a major finding and rejects the gate", () => {
  const r = evaluateReviewGate({
    findings: [finding("F1", ReviewSeverity.Blocking)],
    votes: [agree("a", "F1"), agree("b", "F1")],
    quorum: 2,
  });
  equal(r.outcome, "ok");
  if (r.outcome !== "ok") return;
  equal(r.recommendedGateOutcome, QualityGateOutcome.Rejected);
});

// ---------------------------------------------------------------------------
// The fail-open defect: `adopted.length === 0` used to mean BOTH "nothing was
// raised" (clean) and "something was raised and withheld" (information exists).
// These tests pin the two states apart. The first one is the case Aaron named:
// a true blocking finding raised by one reviewer only used to APPROVE the gate.
// ---------------------------------------------------------------------------

test("FALSIFIER: a blocking finding raised by ONE reviewer only must NOT approve the gate", () => {
  const r = evaluateReviewGate({
    findings: [finding("F1", ReviewSeverity.Blocking)],
    // 3 reviewers convene; only "a" agrees -> sub-quorum -> withheld upstream.
    votes: [agree("a", "F1"), disagree("b", "F1"), disagree("c", "F1")],
  });
  equal(r.outcome, "ok");
  if (r.outcome !== "ok") return;
  // The old code returned Approved here. That is the shipped bug.
  ok(r.recommendedGateOutcome !== QualityGateOutcome.Approved, "sub-quorum blocking finding must not approve");
  equal(r.recommendedGateOutcome, QualityGateOutcome.ChangesRequested);
  equal(r.basis, ReviewGateBasis.UnadoptedBlockingOrMajor);
  equal(r.adoptedFindingIds.length, 0);
});

test("FALSIFIER: a sub-quorum MAJOR finding must not approve either", () => {
  const r = evaluateReviewGate({
    findings: [finding("F1", ReviewSeverity.Major)],
    // This is the EXACT input of the old "no finding reaches quorum -> Approved"
    // test, which asserted the defect. Same input, corrected expectation.
    votes: [agree("a", "F1"), agree("b", "F1"), disagree("c", "F1")],
  });
  equal(r.outcome, "ok");
  if (r.outcome !== "ok") return;
  equal(r.recommendedGateOutcome, QualityGateOutcome.ChangesRequested);
  equal(r.basis, ReviewGateBasis.UnadoptedBlockingOrMajor);
});

test("FALSIFIER: a genuinely EMPTY review still approves (the clean path is not broken)", () => {
  const r = evaluateReviewGate({
    findings: [],
    // Board convened (3 distinct reviewers) with no candidate finding in scope.
    votes: [agree("a", "F-other"), agree("b", "F-other"), agree("c", "F-other")],
  });
  equal(r.outcome, "ok");
  if (r.outcome !== "ok") return;
  equal(r.recommendedGateOutcome, QualityGateOutcome.Approved);
  equal(r.basis, ReviewGateBasis.NoCandidateFindings);
  equal(r.advisoryFindings.length, 0);
});

test("zero reviewers and zero findings cannot approve — it fails closed to feedback", () => {
  // Count what you inspected: no participation evidence at all is not a clean review.
  const r = evaluateReviewGate({ findings: [], votes: [] });
  equal(r.outcome, "feedback");
  if (r.outcome !== "feedback") return;
  equal(r.feedback.reason, ReviewGateFeedbackReason.BoardCouldNotConvene);
});

// ---------------------------------------------------------------------------
// Information preservation: a withheld finding that is dropped is erasure; a
// withheld finding that is surfaced is correction. These assert PRESENCE and
// ATTRIBUTION, not just the outcome.
// ---------------------------------------------------------------------------

test("FALSIFIER: sub-quorum findings are surfaced as advisories, with attribution", () => {
  const r = evaluateReviewGate({
    findings: [finding("F1", ReviewSeverity.Blocking)],
    votes: [agree("a", "F1"), disagree("c", "F1"), disagree("b", "F1")],
  });
  equal(r.outcome, "ok");
  if (r.outcome !== "ok") return;
  equal(r.advisoryFindings.length, 1);
  const advisory = r.advisoryFindings[0]!;
  equal(advisory.findingId, "F1");
  equal(advisory.severity, ReviewSeverity.Blocking);
  equal(advisory.state, FindingDecisionState.Withheld);
  equal(advisory.comment, "c");
  equal(advisory.distinctAgree, 1);
  equal(advisory.distinctDisagree, 2);
  equal(advisory.quorum, 3);
  // Attribution: WHO raised it, ordinal-sorted.
  deepEqual([...advisory.agreedBy], ["a"]);
  deepEqual([...advisory.disagreedBy], ["b", "c"]);
});

test("minor-only sub-quorum findings approve, but are still carried as advisories", () => {
  const r = evaluateReviewGate({
    findings: [finding("F1", ReviewSeverity.Minor), finding("F2", ReviewSeverity.Info)],
    votes: [agree("a", "F1"), agree("b", "F2"), disagree("c", "F1")],
  });
  equal(r.outcome, "ok");
  if (r.outcome !== "ok") return;
  // Non-blocking: minor/info that nobody agreed on does not gate a change.
  equal(r.recommendedGateOutcome, QualityGateOutcome.Approved);
  equal(r.basis, ReviewGateBasis.UnadoptedMinorOrInfoOnly);
  // But the information is NOT erased.
  equal(r.advisoryFindings.length, 2);
  deepEqual(r.advisoryFindings.map((a) => a.findingId).sort(), ["F1", "F2"]);
});

test("Approved-with-advisories and Approved-clean are distinguishable states", () => {
  const clean = evaluateReviewGate({
    findings: [],
    votes: [agree("a", "F-other"), agree("b", "F-other"), agree("c", "F-other")],
  });
  const advisory = evaluateReviewGate({
    findings: [finding("F1", ReviewSeverity.Minor)],
    votes: [agree("a", "F1"), disagree("b", "F1"), disagree("c", "F1")],
  });
  equal(clean.outcome, "ok");
  equal(advisory.outcome, "ok");
  if (clean.outcome !== "ok" || advisory.outcome !== "ok") return;
  // Same recommended outcome...
  equal(clean.recommendedGateOutcome, advisory.recommendedGateOutcome);
  // ...but never the same state. This is the defect, pinned: one variable must
  // not represent both situations.
  ok(clean.basis !== advisory.basis, "clean and advisory approvals must not share a basis");
  equal(clean.advisoryFindings.length, 0);
  equal(advisory.advisoryFindings.length, 1);
});

test("a CONTESTED finding (quorum both ways) does not approve when blocking", () => {
  const r = evaluateReviewGate({
    findings: [finding("F1", ReviewSeverity.Blocking)],
    votes: [
      agree("a", "F1"), agree("b", "F1"),
      disagree("c", "F1"), disagree("d", "F1"),
    ],
    quorum: 2,
  });
  equal(r.outcome, "ok");
  if (r.outcome !== "ok") return;
  equal(r.adoptedFindingIds.length, 0);
  equal(r.recommendedGateOutcome, QualityGateOutcome.ChangesRequested);
  equal(r.basis, ReviewGateBasis.UnadoptedBlockingOrMajor);
  equal(r.advisoryFindings[0]!.state, FindingDecisionState.Contested);
});

test("an adopted blocking finding still rejects even when advisories are present", () => {
  const r = evaluateReviewGate({
    findings: [finding("F1", ReviewSeverity.Blocking), finding("F2", ReviewSeverity.Minor)],
    votes: [
      agree("a", "F1"), agree("b", "F1"), agree("c", "F1"),
      agree("a", "F2"),
    ],
  });
  equal(r.outcome, "ok");
  if (r.outcome !== "ok") return;
  equal(r.recommendedGateOutcome, QualityGateOutcome.Rejected);
  equal(r.basis, ReviewGateBasis.AdoptedBlockingOrMajor);
  deepEqual([...r.adoptedFindingIds], ["F1"]);
  equal(r.advisoryFindings.length, 1);
  equal(r.advisoryFindings[0]!.findingId, "F2");
});
