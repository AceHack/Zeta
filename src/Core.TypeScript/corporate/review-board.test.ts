/**
 * review-board.test.ts — the defect this board exists to not have is INVISIBLE while it works.
 *
 * A three-reviewer board with a threshold of three suppresses every finding one reviewer doubts,
 * and looks like rigour doing it. So the load-bearing tests here are the ones that would pass a
 * board with that defect and fail this one: a solitary true finding survives, a disagreeing
 * reviewer does not suppress it, and setting the rule back to `veto` is refused mechanically rather
 * than by somebody noticing.
 */

import { describe, expect, test } from "bun:test";
import {
  adoptedFindings,
  BoardFeedback,
  type CandidateFinding,
  DEFAULT_REVIEW_QUORUM,
  DEFAULT_REVIEW_RULE,
  evaluateReviewBoard,
  FindingState,
  REVIEW_BOARD_PURPOSE,
  ReviewDimension,
  type ReviewerVote,
} from "./review-board";
import { classify, ofKOfN, threshold, union, veto, weighted } from "../society/aggregation-rule";

const FINDING: CandidateFinding = {
  findingId: "f1",
  dimension: ReviewDimension.Correctness,
  summary: "the retry loop reads its stop condition over the channel it saturates",
};

function vote(reviewerHatId: string, stance: ReviewerVote["stance"], findingId = "f1"): ReviewerVote {
  return { reviewerHatId, findingId, stance };
}

/** Three reviewers present, which is the attendance floor. */
const PRESENT = [vote("a", "abstain"), vote("b", "abstain"), vote("c", "abstain")];

function board(votes: readonly ReviewerVote[], over: Partial<Parameters<typeof evaluateReviewBoard>[0]> = {}) {
  return evaluateReviewBoard({ findings: [FINDING], votes, ...over });
}

describe("THE DECLARED PAIRING IS CHECKED BEFORE ANYTHING IS DECIDED", () => {
  test("the board's own defaults classify as dominating on recall", () => {
    expect(classify(REVIEW_BOARD_PURPOSE, DEFAULT_REVIEW_RULE)).toEqual({ kind: "dominates", axis: "recall" });
  });

  test("SETTING THE RULE BACK TO VETO IS REFUSED — the mirror defect, mechanically", () => {
    // A veto on a discovery task dominates on SAFETY: it makes a false pass cheap and a miss
    // expensive, which is the opposite of what a review needs. This is the whole reason the rule is
    // a checked value rather than a comment.
    const r = board([vote("a", "agree"), ...PRESENT.slice(1)], { rule: veto });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.feedback).toBe(BoardFeedback.RuleMirrorMismatch);
  });

  test("...and so is the SAME RULE WRITTEN AS A THRESHOLD — k=n normalises to veto", () => {
    // The historical shape: quorum and threshold were one number, so at the minimum board size the
    // threshold WAS the board size. Writing it the long way must not get past the same check.
    const r = board([vote("a", "agree"), ...PRESENT.slice(1)], {
      rule: ofKOfN(3, 3, { kind: "unstated", note: "the historical quorum-as-threshold" }),
    });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.feedback).toBe(BoardFeedback.RuleMirrorMismatch);
  });

  test("a WEIGHTED rule is structurally unusable, not merely discouraged", () => {
    // Weighted aggregation waits on a measured-competence ledger this organization does not have,
    // and a weight nobody measured is a preference with a number on it.
    const r = board(PRESENT, { rule: weighted({ kind: "self-asserted", quantity: "reviewer seniority" }) });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.feedback).toBe(BoardFeedback.RuleNotApplicable);
  });

  test("a weaker verdict is PERMITTED — a caller may pin a threshold below n", () => {
    const r = board([vote("a", "agree"), vote("b", "agree"), vote("c", "disagree")], {
      rule: threshold(2, { kind: "fault-tolerance", toleratedFaults: 1 }),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.decisions[0]?.state).toBe(FindingState.Adopted);
  });
});

describe("THE TWO NUMBERS ARE SEPARATE", () => {
  test("the quorum is an ATTENDANCE FLOOR — below it the board does not sit", () => {
    const r = board([vote("a", "agree"), vote("b", "agree")]);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.feedback).toBe(BoardFeedback.TooFewReviewers);
    expect(DEFAULT_REVIEW_QUORUM).toBe(3);
  });

  test("ATTENDANCE IS NOT AGREEMENT — three present and one agreeing adopts", () => {
    // The claim in one test. A board conflating the two would withhold this finding.
    const r = board([vote("a", "agree"), vote("b", "abstain"), vote("c", "abstain")]);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.decisions[0]?.state).toBe(FindingState.Adopted);
  });

  test("ONE AGENT VOTING THREE TIMES IS ONE REVIEWER", () => {
    // Otherwise the floor and every count below it are self-amplifiable by whoever votes most.
    const r = board([vote("a", "agree"), vote("a", "agree"), vote("a", "agree")]);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.feedback).toBe(BoardFeedback.TooFewReviewers);
  });

  test("...and its agreement is counted once too", () => {
    const r = board([vote("a", "agree"), vote("a", "agree"), vote("b", "abstain"), vote("c", "abstain")]);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.decisions[0]?.confidence.distinctAgree).toBe(1);
  });
});

describe("WITHHELD MEANS NOBODY AGREED — union is k=1, not k=0", () => {
  test("a finding no reviewer agreed with is withheld", () => {
    const r = board(PRESENT);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.decisions[0]?.state).toBe(FindingState.Withheld);
    expect(r.decisions[0]?.adopted).toBe(false);
  });

  test("A BOARD THAT ADOPTS EVERYTHING WOULD BE A CHECK THAT CANNOT FAIL", () => {
    // The mirror of the defect at the top. Union is permissive on purpose and still has to be able
    // to say no, or the board's output carries no information at all.
    const r = board([vote("a", "disagree"), vote("b", "disagree"), vote("c", "disagree")]);
    if (!r.ok) throw new Error("expected a sitting");
    expect(r.decisions[0]?.adopted).toBe(false);
  });
});

describe("CONTESTED IS AN ANNOTATION HERE, NOT AN ESCALATION", () => {
  const split = [vote("a", "agree"), vote("b", "disagree"), vote("c", "abstain")];

  test("both sides satisfying the rule marks it contested AND KEEPS IT ADOPTED", () => {
    // Letting one disagreeing reviewer send a discovery finding away for adjudication reinstates
    // the mirror defect through the back door, wearing procedure instead of a rule.
    const r = board(split);
    if (!r.ok) throw new Error("expected a sitting");
    expect(r.decisions[0]?.state).toBe(FindingState.Contested);
    expect(r.decisions[0]?.adopted).toBe(true);
    expect(adoptedFindings(r)).toEqual([FINDING]);
  });

  test("UNDER A NON-RECALL-DOMINANT RULE IT DOES NOT STAND", () => {
    // The behaviour is conditioned on the classification, not hardcoded — so a caller that pins a
    // threshold gets the escalating reading, which is the right one for that rule.
    const r = board([vote("a", "agree"), vote("b", "agree"), vote("c", "disagree"), vote("d", "disagree")], {
      rule: threshold(2, { kind: "fault-tolerance", toleratedFaults: 1 }),
    });
    if (!r.ok) throw new Error("expected a sitting");
    expect(r.decisions[0]?.state).toBe(FindingState.Contested);
    expect(r.decisions[0]?.adopted).toBe(false);
  });
});

describe("AGREEMENT IS PUBLISHED, NOT SPENT", () => {
  test("1-of-3 and 3-of-3 reach the SAME outcome and stay DISTINGUISHABLE", () => {
    // The old quorum gate consumed this number — it turned agreement into a threshold and then
    // threw it away, and a withheld finding that is dropped is erasure rather than a decision.
    const thin = board([vote("a", "agree"), vote("b", "abstain"), vote("c", "abstain")]);
    const thick = board([vote("a", "agree"), vote("b", "agree"), vote("c", "agree")]);
    if (!thin.ok || !thick.ok) throw new Error("expected sittings");
    expect(thin.decisions[0]?.state).toBe(thick.decisions[0]?.state);
    expect(thin.decisions[0]?.confidence.distinctAgree).toBe(1);
    expect(thick.decisions[0]?.confidence.distinctAgree).toBe(3);
    expect(thin.decisions[0]?.confidence.agreementRatio).toBe(1);
  });

  test("the ratio is over reviewers who TOOK A SIDE, and abstentions are counted separately", () => {
    const r = board([vote("a", "agree"), vote("b", "disagree"), vote("c", "abstain")]);
    if (!r.ok) throw new Error("expected a sitting");
    expect(r.decisions[0]?.confidence.agreementRatio).toBe(0.5);
    expect(r.decisions[0]?.confidence.distinctAbstain).toBe(1);
    expect(r.decisions[0]?.confidence.reviewerCount).toBe(3);
  });

  test("nobody taking a side gives a ratio of zero rather than a division by nothing", () => {
    const r = board(PRESENT);
    if (!r.ok) throw new Error("expected a sitting");
    expect(r.decisions[0]?.confidence.agreementRatio).toBe(0);
  });
});

describe("several findings, judged independently", () => {
  test("each finding is decided on ITS OWN votes", () => {
    const second: CandidateFinding = { findingId: "f2", dimension: ReviewDimension.Testing, summary: "no falsifier" };
    const r = evaluateReviewBoard({
      findings: [FINDING, second],
      votes: [vote("a", "agree", "f1"), vote("b", "abstain", "f1"), vote("c", "abstain", "f1"), vote("a", "disagree", "f2")],
    });
    if (!r.ok) throw new Error("expected a sitting");
    expect(r.decisions[0]?.adopted).toBe(true);
    expect(r.decisions[1]?.adopted).toBe(false);
    expect(adoptedFindings(r)).toEqual([FINDING]);
  });

  test("a board with nothing to judge sits and decides nothing", () => {
    const r = evaluateReviewBoard({ findings: [], votes: PRESENT });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.decisions).toEqual([]);
    expect(r.reviewerCount).toBe(3);
  });

  test("the verdict is REPORTED, so a caller can see why the rule was allowed", () => {
    const r = board(PRESENT);
    if (!r.ok) throw new Error("expected a sitting");
    expect(r.verdict).toEqual({ kind: "dominates", axis: "recall" });
    expect(DEFAULT_REVIEW_RULE).toEqual(union);
  });

  test("nothing is adopted out of a board that did not sit", () => {
    expect(adoptedFindings(board([vote("a", "agree")]))).toEqual([]);
  });
});
