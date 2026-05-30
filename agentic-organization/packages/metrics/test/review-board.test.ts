import { equal } from "node:assert/strict";
import { test } from "node:test";
import {
  FindingDecisionState,
  ReviewDimension,
  ReviewSeverity,
  ReviewStance,
  evaluateReviewBoard,
  type CandidateFinding,
  type ReviewerVote,
} from "../src/review-board.ts";

const finding: CandidateFinding = {
  findingId: "F1",
  dimension: ReviewDimension.Solid,
  severity: ReviewSeverity.Major,
  subject: "GodClass",
  comment: "violates SRP",
};

function vote(agent: string, stance: (typeof ReviewStance)[keyof typeof ReviewStance]): ReviewerVote {
  return { reviewerAgentId: agent, hatAssignmentId: `${agent}-hat`, findingId: "F1", stance, rationale: "" };
}

test("three distinct agreeing reviewers adopt the finding", () => {
  const result = evaluateReviewBoard({
    findings: [finding],
    votes: [vote("a", ReviewStance.Agree), vote("b", ReviewStance.Agree), vote("c", ReviewStance.Agree)],
  });
  equal(result.outcome, "ok");
  if (result.outcome !== "ok") return;
  equal(result.board.adopted.length, 1);
  equal(result.board.adopted[0]?.state, FindingDecisionState.Adopted);
  equal(result.board.adopted[0]?.distinctAgree, 3);
});

test("one agent agreeing three times does NOT adopt (no self-amplification)", () => {
  const result = evaluateReviewBoard({
    findings: [finding],
    votes: [vote("a", ReviewStance.Agree), vote("a", ReviewStance.Agree), vote("a", ReviewStance.Agree), vote("b", ReviewStance.Agree), vote("c", ReviewStance.Abstain)],
  });
  equal(result.outcome, "ok");
  if (result.outcome !== "ok") return;
  // distinct agreers = a,b = 2 < quorum 3
  equal(result.board.decisions[0]?.distinctAgree, 2);
  equal(result.board.decisions[0]?.state, FindingDecisionState.Withheld);
});

test("fewer than quorum reviewers yields feedback", () => {
  const result = evaluateReviewBoard({
    findings: [finding],
    votes: [vote("a", ReviewStance.Agree), vote("b", ReviewStance.Agree)],
  });
  equal(result.outcome, "feedback");
  if (result.outcome !== "feedback") return;
  equal(result.feedback.reason, "too_few_reviewers");
});

test("quorum agree AND quorum disagree marks the finding contested", () => {
  const votes: ReviewerVote[] = [
    vote("a", ReviewStance.Agree), vote("b", ReviewStance.Agree), vote("c", ReviewStance.Agree),
    vote("d", ReviewStance.Disagree), vote("e", ReviewStance.Disagree), vote("f", ReviewStance.Disagree),
  ];
  const result = evaluateReviewBoard({ findings: [finding], votes });
  equal(result.outcome, "ok");
  if (result.outcome !== "ok") return;
  equal(result.board.decisions[0]?.state, FindingDecisionState.Contested);
});

test("custom quorum of 2 adopts with two distinct agreers", () => {
  const result = evaluateReviewBoard({
    findings: [finding],
    votes: [vote("a", ReviewStance.Agree), vote("b", ReviewStance.Agree)],
    quorum: 2,
  });
  equal(result.outcome, "ok");
  if (result.outcome !== "ok") return;
  equal(result.board.adopted.length, 1);
});
