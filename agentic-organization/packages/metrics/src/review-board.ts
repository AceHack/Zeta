/**
 * The qualitative 3-agent code-review board.
 *
 * Operator vision 2026-05-29: quantitative metrics flag candidates, but the
 * review itself runs as a board of >= 3 reviewer agents who must AGREE before a
 * comment is published. Reviewers discuss correctness, SOLID principles, and
 * adherence to the architecture; a finding is adopted only when a quorum of
 * DISTINCT reviewers agree on it.
 *
 * This mirrors the governance constitution-gate agreement semantics (distinct
 * agreers >= quorum, objection vetoes) applied to review findings rather than
 * constitutions. The two share a shape but live in different packages, so the
 * agreement logic is restated here (no cross-package import); both are explicit
 * DUs with no buried thresholds.
 */

/** The dimensions a reviewer evaluates a candidate finding along. */
export const ReviewDimension = {
  Correctness: "correctness",
  Solid: "solid",
  ArchitectureAdherence: "architecture_adherence",
  Performance: "performance",
  Testing: "testing",
} as const;
export type ReviewDimension = (typeof ReviewDimension)[keyof typeof ReviewDimension];

/** A reviewer's stance on one candidate finding. */
export const ReviewStance = {
  Agree: "agree",
  Disagree: "disagree",
  Abstain: "abstain",
} as const;
export type ReviewStance = (typeof ReviewStance)[keyof typeof ReviewStance];

export const ReviewSeverity = {
  Info: "info",
  Minor: "minor",
  Major: "major",
  Blocking: "blocking",
} as const;
export type ReviewSeverity = (typeof ReviewSeverity)[keyof typeof ReviewSeverity];

/** A proposed review comment, before the board has agreed on it. */
export type CandidateFinding = {
  findingId: string;
  dimension: ReviewDimension;
  severity: ReviewSeverity;
  subject: string;
  comment: string;
};

/** One reviewer agent's vote on one candidate finding. */
export type ReviewerVote = {
  reviewerAgentId: string;
  hatAssignmentId: string;
  findingId: string;
  stance: ReviewStance;
  rationale: string;
};

/** The adopted/withheld decision for a single finding. */
export const FindingDecisionState = {
  Adopted: "adopted",
  Withheld: "withheld",
  Contested: "contested",
} as const;
export type FindingDecisionState = (typeof FindingDecisionState)[keyof typeof FindingDecisionState];

export type FindingDecision = {
  finding: CandidateFinding;
  state: FindingDecisionState;
  distinctAgree: number;
  distinctDisagree: number;
  quorum: number;
  reason: string;
};

export type ReviewBoardOutcome = {
  quorum: number;
  reviewerCount: number;
  adopted: readonly FindingDecision[];
  withheld: readonly FindingDecision[];
  decisions: readonly FindingDecision[];
};

export const DEFAULT_REVIEW_QUORUM = 3;

export const ReviewBoardFeedbackReason = {
  TooFewReviewers: "too_few_reviewers",
} as const;
export type ReviewBoardFeedbackReason =
  (typeof ReviewBoardFeedbackReason)[keyof typeof ReviewBoardFeedbackReason];

export type ReviewBoardResult =
  | { outcome: "ok"; board: ReviewBoardOutcome }
  | { outcome: "feedback"; feedback: { reason: ReviewBoardFeedbackReason; message: string } };

function distinctStance(votes: readonly ReviewerVote[], stance: ReviewStance): number {
  const agents = new Set<string>();
  for (const vote of votes) {
    if (vote.stance === stance) {
      agents.add(vote.reviewerAgentId);
    }
  }
  return agents.size;
}

function decideFinding(finding: CandidateFinding, votes: readonly ReviewerVote[], quorum: number): FindingDecision {
  const forFinding = votes.filter((vote) => vote.findingId === finding.findingId);
  const distinctAgree = distinctStance(forFinding, ReviewStance.Agree);
  const distinctDisagree = distinctStance(forFinding, ReviewStance.Disagree);

  // Agreement gate: a finding is adopted only when a quorum of DISTINCT
  // reviewers agree AND no fewer disagree than agree at quorum strength.
  if (distinctAgree >= quorum && distinctDisagree < quorum) {
    return { finding, state: FindingDecisionState.Adopted, distinctAgree, distinctDisagree, quorum, reason: `${distinctAgree} distinct reviewers agreed (quorum ${quorum})` };
  }
  if (distinctAgree >= quorum && distinctDisagree >= quorum) {
    return { finding, state: FindingDecisionState.Contested, distinctAgree, distinctDisagree, quorum, reason: `quorum agreed (${distinctAgree}) but quorum also disagreed (${distinctDisagree}) — escalate` };
  }
  return { finding, state: FindingDecisionState.Withheld, distinctAgree, distinctDisagree, quorum, reason: `only ${distinctAgree} distinct reviewers agreed (quorum ${quorum})` };
}

/** Distinct reviewer agents who cast any vote. */
function distinctReviewers(votes: readonly ReviewerVote[]): number {
  const agents = new Set<string>();
  for (const vote of votes) {
    agents.add(vote.reviewerAgentId);
  }
  return agents.size;
}

/**
 * Run the review board over a set of candidate findings and reviewer votes.
 * Requires at least `quorum` distinct reviewers to have participated, otherwise
 * returns feedback (a board of fewer than quorum cannot adopt anything).
 */
export function evaluateReviewBoard(input: {
  findings: readonly CandidateFinding[];
  votes: readonly ReviewerVote[];
  quorum?: number;
}): ReviewBoardResult {
  const quorum = Math.max(1, input.quorum ?? DEFAULT_REVIEW_QUORUM);
  const reviewerCount = distinctReviewers(input.votes);

  if (reviewerCount < quorum) {
    return {
      outcome: "feedback",
      feedback: { reason: ReviewBoardFeedbackReason.TooFewReviewers, message: `review board needs >= ${quorum} distinct reviewers, got ${reviewerCount}` },
    };
  }

  const decisions = input.findings.map((finding) => decideFinding(finding, input.votes, quorum));
  const adopted = decisions.filter((d) => d.state === FindingDecisionState.Adopted);
  const withheld = decisions.filter((d) => d.state !== FindingDecisionState.Adopted);

  return {
    outcome: "ok",
    board: { quorum, reviewerCount, adopted, withheld, decisions },
  };
}
