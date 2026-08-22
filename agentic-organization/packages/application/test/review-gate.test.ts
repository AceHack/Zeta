import { equal } from "node:assert/strict";
import { test } from "node:test";
import { QualityGateOutcome } from "../../domain/src/index.ts";
import { ReviewDimension, ReviewSeverity, ReviewStance, type CandidateFinding, type ReviewerVote } from "../../metrics/src/index.ts";
import { ReviewGateFeedbackReason, evaluateReviewGate } from "../src/review-gate.ts";

function finding(id: string, severity: (typeof ReviewSeverity)[keyof typeof ReviewSeverity]): CandidateFinding {
  return { findingId: id, dimension: ReviewDimension.Correctness, severity, subject: "x", comment: "c" };
}

function agree(agent: string, findingId: string): ReviewerVote {
  return { reviewerAgentId: agent, hatAssignmentId: `${agent}-h`, findingId, stance: ReviewStance.Agree, rationale: "" };
}

test("no finding reaches quorum -> gate Approved", () => {
  const r = evaluateReviewGate({
    findings: [finding("F1", ReviewSeverity.Major)],
    // only 2 distinct agreers, quorum default 3 -> not adopted, but 3 reviewers present
    votes: [agree("a", "F1"), agree("b", "F1"), { reviewerAgentId: "c", hatAssignmentId: "c-h", findingId: "F1", stance: ReviewStance.Disagree, rationale: "" }],
  });
  equal(r.outcome, "ok");
  if (r.outcome !== "ok") return;
  equal(r.recommendedGateOutcome, QualityGateOutcome.Approved);
  equal(r.adoptedFindingIds.length, 0);
});

test("an adopted major finding -> gate Rejected", () => {
  const r = evaluateReviewGate({
    findings: [finding("F1", ReviewSeverity.Major)],
    votes: [agree("a", "F1"), agree("b", "F1"), agree("c", "F1")],
  });
  equal(r.outcome, "ok");
  if (r.outcome !== "ok") return;
  equal(r.recommendedGateOutcome, QualityGateOutcome.Rejected);
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
