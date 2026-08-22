/**
 * Review board as a real gate (slice 5).
 *
 * Connects the qualitative >=3-agent review board (packages/metrics) to the
 * domain's quality-gate outcomes (QualityGateOutcome). A review-class gate
 * decision is not a single reviewer's call: it is the board's adopted findings.
 * This module runs the board and maps its outcome to a QualityGateOutcome
 * recommendation that the gate-evaluation path can consume:
 *
 *   - the board could not convene (< quorum reviewers)        -> feedback
 *   - the board adopted a blocking/major finding              -> Rejected
 *   - the board adopted only minor/info findings              -> ChangesRequested
 *   - the board adopted nothing (no finding reached quorum)   -> Approved
 *
 * Lives in the application layer because it composes two packages (domain's
 * QualityGateOutcome + metrics' review board); metrics stays dependency-free and
 * domain stays unaware of the board. Pure; no I/O.
 */

import { QualityGateOutcome } from "../../domain/src/index.ts";
import {
  ReviewSeverity,
  evaluateReviewBoard,
  type CandidateFinding,
  type FindingDecision,
  type ReviewBoardOutcome,
  type ReviewerVote,
} from "../../metrics/src/index.ts";

export const ReviewGateFeedbackReason = {
  BoardCouldNotConvene: "board_could_not_convene",
} as const;
export type ReviewGateFeedbackReason =
  (typeof ReviewGateFeedbackReason)[keyof typeof ReviewGateFeedbackReason];

export type ReviewGateResult =
  | {
      outcome: "ok";
      recommendedGateOutcome: QualityGateOutcome;
      board: ReviewBoardOutcome;
      adoptedFindingIds: readonly string[];
      reason: string;
    }
  | { outcome: "feedback"; feedback: { reason: ReviewGateFeedbackReason; message: string } };

function isBlockingOrMajor(decision: FindingDecision): boolean {
  return (
    decision.finding.severity === ReviewSeverity.Blocking ||
    decision.finding.severity === ReviewSeverity.Major
  );
}

/**
 * Run the review board over the findings + votes and recommend a gate outcome.
 * The adopted findings (those that reached quorum agreement) determine the
 * outcome: any adopted blocking/major finding rejects the gate; adopted
 * minor/info findings request changes; no adopted finding approves.
 */
export function evaluateReviewGate(input: {
  findings: readonly CandidateFinding[];
  votes: readonly ReviewerVote[];
  quorum?: number;
}): ReviewGateResult {
  const boardResult =
    input.quorum === undefined
      ? evaluateReviewBoard({ findings: input.findings, votes: input.votes })
      : evaluateReviewBoard({ findings: input.findings, votes: input.votes, quorum: input.quorum });

  if (boardResult.outcome === "feedback") {
    return {
      outcome: "feedback",
      feedback: { reason: ReviewGateFeedbackReason.BoardCouldNotConvene, message: boardResult.feedback.message },
    };
  }

  const adopted = boardResult.board.adopted;
  const adoptedFindingIds = adopted.map((decision) => decision.finding.findingId);

  let recommendedGateOutcome: QualityGateOutcome;
  let reason: string;
  if (adopted.length === 0) {
    recommendedGateOutcome = QualityGateOutcome.Approved;
    reason = "no finding reached quorum agreement; gate approved";
  } else if (adopted.some(isBlockingOrMajor)) {
    recommendedGateOutcome = QualityGateOutcome.Rejected;
    reason = `${adopted.length} finding(s) adopted, at least one major/blocking; gate rejected`;
  } else {
    recommendedGateOutcome = QualityGateOutcome.ChangesRequested;
    reason = `${adopted.length} minor/info finding(s) adopted; changes requested`;
  }

  return {
    outcome: "ok",
    recommendedGateOutcome,
    board: boardResult.board,
    adoptedFindingIds,
    reason,
  };
}
