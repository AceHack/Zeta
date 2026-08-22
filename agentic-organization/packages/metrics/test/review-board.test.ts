import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";
import {
  threshold,
  veto,
  type Justification,
} from "../../../../src/Core.TypeScript/society/aggregation-rule.ts";
import {
  DEFAULT_REVIEW_RULE,
  FindingDecisionState,
  REVIEW_BOARD_PURPOSE,
  ReviewBoardFeedbackReason,
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

/**
 * The pre-#10974 rule, made explicit. Every assertion written for the quorum
 * regime is kept alive by pinning it here rather than being deleted — and it
 * doubles as the revert-mutant: passing this as the board default turns the
 * single-reviewer falsifier below red.
 */
const legacyQuorumWhy: Justification = {
  kind: "unstated",
  note: "the pre-#10974 quorum gate, pinned so its assertions stay under test",
};
const legacyQuorumRule = threshold(3, legacyQuorumWhy);

// ---------------------------------------------------------------------------
// The declaration itself. The rule is a value, and the value is checked.
// ---------------------------------------------------------------------------

test("the board declares union against a recall purpose, and the pairing dominates", () => {
  equal(DEFAULT_REVIEW_RULE.kind, "union");
  equal(REVIEW_BOARD_PURPOSE.kind, "recall");
  const result = evaluateReviewBoard({
    findings: [finding],
    votes: [vote("a", ReviewStance.Agree), vote("b", ReviewStance.Agree), vote("c", ReviewStance.Agree)],
  });
  equal(result.outcome, "ok");
  if (result.outcome !== "ok") return;
  // The machine-checked standing of the pairing, not a comment claiming it.
  equal(result.board.verdictKey, "dominates:recall");
  equal(result.board.rule.kind, "union");
});

test("FALSIFIER: a rule that dominates on the OPPOSITE axis is refused mechanically", () => {
  // `veto` is k=n — what `quorum === reviewerCount` normalised to, which is the
  // mirror defect #10974 found at this site. It can no longer be configured.
  const result = evaluateReviewBoard({
    findings: [finding],
    votes: [vote("a", ReviewStance.Agree), vote("b", ReviewStance.Agree), vote("c", ReviewStance.Agree)],
    rule: veto,
  });
  equal(result.outcome, "feedback");
  if (result.outcome !== "feedback") return;
  equal(result.feedback.reason, ReviewBoardFeedbackReason.AggregationRuleMirrorMismatch);
  ok(result.feedback.message.includes("mirror-mismatch:recall:safety"));
});

// ---------------------------------------------------------------------------
// Union: every finding any reviewer raises is adopted.
// ---------------------------------------------------------------------------

test("FALSIFIER: a finding raised by ONE reviewer of three is adopted under union", () => {
  const result = evaluateReviewBoard({
    findings: [finding],
    votes: [vote("a", ReviewStance.Agree), vote("b", ReviewStance.Disagree), vote("c", ReviewStance.Disagree)],
  });
  equal(result.outcome, "ok");
  if (result.outcome !== "ok") return;
  equal(result.board.adopted.length, 1);
  equal(result.board.adopted[0]?.state, FindingDecisionState.Adopted);
  // ...and the agreement count is PUBLISHED, not spent.
  equal(result.board.adopted[0]?.confidence.distinctAgree, 1);
  equal(result.board.adopted[0]?.confidence.distinctDisagree, 2);
  equal(result.board.adopted[0]?.confidence.reviewerCount, 3);
  equal(result.board.adopted[0]?.confidence.contested, true);
});

test("MUTANT: the same finding under the pinned threshold(3) rule is withheld", () => {
  const result = evaluateReviewBoard({
    findings: [finding],
    votes: [vote("a", ReviewStance.Agree), vote("b", ReviewStance.Disagree), vote("c", ReviewStance.Disagree)],
    rule: legacyQuorumRule,
  });
  equal(result.outcome, "ok");
  if (result.outcome !== "ok") return;
  equal(result.board.adopted.length, 0);
  equal(result.board.decisions[0]?.state, FindingDecisionState.Withheld);
});

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
  equal(result.board.adopted[0]?.confidence.agreementRatio, 1);
  equal(result.board.adopted[0]?.confidence.contested, false);
});

test("a finding NOBODY agreed with is still withheld under union", () => {
  // Union is k=1, not k=0: it is not a rule that cannot fail.
  const result = evaluateReviewBoard({
    findings: [finding],
    votes: [vote("a", ReviewStance.Disagree), vote("b", ReviewStance.Disagree), vote("c", ReviewStance.Abstain)],
  });
  equal(result.outcome, "ok");
  if (result.outcome !== "ok") return;
  equal(result.board.adopted.length, 0);
  equal(result.board.decisions[0]?.state, FindingDecisionState.Withheld);
  equal(result.board.decisions[0]?.confidence.distinctAbstain, 1);
});

// ---------------------------------------------------------------------------
// Distinct counting survives the rule change: the anti-self-amplification
// property was never a consequence of the threshold, and must not become one.
// ---------------------------------------------------------------------------

test("one agent voting three times counts ONCE in the confidence annotation", () => {
  const result = evaluateReviewBoard({
    findings: [finding],
    votes: [
      vote("a", ReviewStance.Agree), vote("a", ReviewStance.Agree), vote("a", ReviewStance.Agree),
      vote("b", ReviewStance.Agree), vote("c", ReviewStance.Abstain),
    ],
  });
  equal(result.outcome, "ok");
  if (result.outcome !== "ok") return;
  // Four agree VOTES, two distinct agreeing AGENTS. The count published is 2.
  equal(result.board.decisions[0]?.confidence.distinctAgree, 2);
  equal(result.board.decisions[0]?.confidence.reviewerCount, 3);
  // Adopted under union — but on the strength of two agents, and it says so.
  equal(result.board.decisions[0]?.state, FindingDecisionState.Adopted);
});

test("one agent voting three times does not reach a pinned threshold(3) either", () => {
  // The original #10957-era assertion, preserved verbatim under its own rule.
  const result = evaluateReviewBoard({
    findings: [finding],
    votes: [
      vote("a", ReviewStance.Agree), vote("a", ReviewStance.Agree), vote("a", ReviewStance.Agree),
      vote("b", ReviewStance.Agree), vote("c", ReviewStance.Abstain),
    ],
    rule: legacyQuorumRule,
  });
  equal(result.outcome, "ok");
  if (result.outcome !== "ok") return;
  equal(result.board.decisions[0]?.distinctAgree, 2);
  equal(result.board.decisions[0]?.state, FindingDecisionState.Withheld);
});

// ---------------------------------------------------------------------------
// Attendance: a liveness precondition, kept and kept separate.
// ---------------------------------------------------------------------------

test("fewer than quorum reviewers yields feedback", () => {
  const result = evaluateReviewBoard({
    findings: [finding],
    votes: [vote("a", ReviewStance.Agree), vote("b", ReviewStance.Agree)],
  });
  equal(result.outcome, "feedback");
  if (result.outcome !== "feedback") return;
  equal(result.feedback.reason, ReviewBoardFeedbackReason.TooFewReviewers);
});

test("custom quorum of 2 lets a two-reviewer board convene", () => {
  const result = evaluateReviewBoard({
    findings: [finding],
    votes: [vote("a", ReviewStance.Agree), vote("b", ReviewStance.Agree)],
    quorum: 2,
  });
  equal(result.outcome, "ok");
  if (result.outcome !== "ok") return;
  equal(result.board.adopted.length, 1);
  equal(result.board.reviewerCount, 2);
});

test("the attendance floor does not gate adoption — one agreer on a 3-reviewer board adopts", () => {
  // The two numbers that used to be one number, pulled apart: quorum 3 is met by
  // attendance, and adoption needs 1.
  const result = evaluateReviewBoard({
    findings: [finding],
    votes: [vote("a", ReviewStance.Agree), vote("b", ReviewStance.Abstain), vote("c", ReviewStance.Abstain)],
  });
  equal(result.outcome, "ok");
  if (result.outcome !== "ok") return;
  equal(result.board.quorum, 3);
  equal(result.board.reviewerCount, 3);
  equal(result.board.adopted.length, 1);
});

// ---------------------------------------------------------------------------
// Contest: an annotation under a recall-dominant rule, an escalation otherwise.
// ---------------------------------------------------------------------------

test("under union, dissent annotates but does not suppress", () => {
  const votes: ReviewerVote[] = [
    vote("a", ReviewStance.Agree), vote("b", ReviewStance.Agree), vote("c", ReviewStance.Agree),
    vote("d", ReviewStance.Disagree), vote("e", ReviewStance.Disagree), vote("f", ReviewStance.Disagree),
  ];
  const result = evaluateReviewBoard({ findings: [finding], votes });
  equal(result.outcome, "ok");
  if (result.outcome !== "ok") return;
  // Letting dissent suppress here would be the mirror defect through the back
  // door: one disagreeing reviewer vetoing a discovery.
  equal(result.board.decisions[0]?.state, FindingDecisionState.Adopted);
  equal(result.board.decisions[0]?.confidence.contested, true);
  equal(result.board.decisions[0]?.confidence.distinctDisagree, 3);
});

test("quorum agree AND quorum disagree marks the finding contested under a pinned threshold", () => {
  const votes: ReviewerVote[] = [
    vote("a", ReviewStance.Agree), vote("b", ReviewStance.Agree), vote("c", ReviewStance.Agree),
    vote("d", ReviewStance.Disagree), vote("e", ReviewStance.Disagree), vote("f", ReviewStance.Disagree),
  ];
  const result = evaluateReviewBoard({ findings: [finding], votes, rule: legacyQuorumRule });
  equal(result.outcome, "ok");
  if (result.outcome !== "ok") return;
  equal(result.board.decisions[0]?.state, FindingDecisionState.Contested);
});

// ---------------------------------------------------------------------------
// Weights are structurally unavailable, not merely discouraged.
// ---------------------------------------------------------------------------

test("a weighted rule is refused: no site in this repo has a measured-competence ledger", () => {
  const result = evaluateReviewBoard({
    findings: [finding],
    votes: [vote("a", ReviewStance.Agree), vote("b", ReviewStance.Agree), vote("c", ReviewStance.Agree)],
    rule: { kind: "weighted", basis: { kind: "log-odds-competence" } },
  });
  equal(result.outcome, "feedback");
  if (result.outcome !== "feedback") return;
  equal(result.feedback.reason, ReviewBoardFeedbackReason.AggregationRuleNotApplicable);
});

// ---------------------------------------------------------------------------
// Silence is not agreement.
// ---------------------------------------------------------------------------

test("a reviewer who never voted on a finding is a false slot, not an implicit agreement", () => {
  const other: CandidateFinding = { ...finding, findingId: "F2" };
  const result = evaluateReviewBoard({
    findings: [other],
    votes: [vote("a", ReviewStance.Agree), vote("b", ReviewStance.Agree), vote("c", ReviewStance.Agree)],
  });
  equal(result.outcome, "ok");
  if (result.outcome !== "ok") return;
  // All three votes are on F1; nobody agreed on F2.
  equal(result.board.decisions[0]?.confidence.distinctAgree, 0);
  equal(result.board.decisions[0]?.state, FindingDecisionState.Withheld);
  deepEqual(result.board.decisions[0]?.confidence.reviewerCount, 3);
});
