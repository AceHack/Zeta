/**
 * Review board as a real gate (slice 5).
 *
 * Connects the qualitative >=3-agent review board (packages/metrics) to the
 * domain's quality-gate outcomes (QualityGateOutcome). A review-class gate
 * decision is not a single reviewer's call: it is the board's adopted findings —
 * PLUS, explicitly, the findings the board raised but did not adopt.
 *
 *   - the board could not convene (< quorum reviewers)        -> feedback
 *   - the board adopted a blocking/major finding              -> Rejected
 *   - the board adopted only minor/info findings              -> ChangesRequested
 *   - NOTHING was adopted, but a blocking/major finding was
 *     raised and fell short of quorum (or was contested)      -> ChangesRequested
 *   - NOTHING was adopted, only minor/info fell short         -> Approved + advisories
 *   - no candidate finding was raised at all                  -> Approved
 *
 * ## Why the last three rows are three rows and not one
 *
 * This module previously read `adopted.length === 0` as "the change is clean"
 * and returned Approved. That single variable represents two genuinely different
 * states, and conflating them is the defect:
 *
 *   1. no finding was ever RAISED           -> there is nothing to know; clean.
 *   2. findings were raised and WITHHELD    -> information exists, and reading it
 *      for lack of quorum agreement            as approval DISCARDS it.
 *
 * The upstream board (`review-board.ts`) withholds any finding fewer than
 * `quorum` distinct reviewers agree on, so state 2 is the normal case for a
 * solitary true finding by the single reviewer who spotted it. Approving on it
 * ships the bug AND erases the report. The `basis` field below is the state,
 * named; `recommendedGateOutcome` is derived from it rather than from a count
 * that cannot tell the two apart.
 *
 * ## Withheld findings are carried, not deleted
 *
 * Every non-adopted finding is surfaced on `advisoryFindings` — visible,
 * attributed (which reviewer agents agreed/disagreed), and NON-BLOCKING when its
 * severity is minor/info. A withheld finding that is dropped is erasure; a
 * withheld finding that is surfaced as advisory is correction. Attribution is
 * computed here from the votes the caller already supplied, so `packages/metrics`
 * is untouched by this module's needs.
 *
 * Note the deliberate restraint: a sub-quorum blocking/major finding yields
 * ChangesRequested, NOT Rejected. The board did not establish that the finding is
 * true — rejecting would assert it. ChangesRequested says "someone must look",
 * which is the weakest outcome that is not silent approval.
 *
 * ## Open question this module deliberately does NOT decide
 *
 * The upstream aggregation rule is still `AND`-of-3 (`review-board.ts`). For a
 * recall-shaped task like bug-finding the dominant rule is `OR`/union, and an
 * unweighted k-of-n count defers toward neither accept nor reject — so the
 * quorum is arguably the complement of the right rule, not merely a strict one.
 * Changing it alters what blocks merges repo-wide, so it is not this module's
 * call. Evidence and options: `docs/research/2026-08-16-dominance-lift-
 * aggregation-inventory-where-unweighted-majority-already-bites.md` §1.1.A.
 * What is fixed here is only the fail-open: whatever the quorum rule ends up
 * being, a withheld finding must not read as approval and must not be erased.
 *
 * Lives in the application layer because it composes two packages (domain's
 * QualityGateOutcome + metrics' review board); metrics stays dependency-free and
 * domain stays unaware of the board. Pure; no I/O.
 */

import { QualityGateOutcome } from "../../domain/src/index.ts";
import {
  FindingDecisionState,
  ReviewSeverity,
  ReviewStance,
  evaluateReviewBoard,
  type CandidateFinding,
  type FindingDecision,
  type ReviewBoardOutcome,
  type ReviewDimension,
  type ReviewerVote,
} from "../../metrics/src/index.ts";

export const ReviewGateFeedbackReason = {
  BoardCouldNotConvene: "board_could_not_convene",
} as const;
export type ReviewGateFeedbackReason =
  (typeof ReviewGateFeedbackReason)[keyof typeof ReviewGateFeedbackReason];

/**
 * WHY the gate recommended what it recommended — the state, named explicitly, so
 * that "nothing was adopted" can never again stand in for two different
 * situations. Each basis maps to exactly one QualityGateOutcome (see
 * `outcomeForBasis`); the mapping is the whole policy of this module.
 */
export const ReviewGateBasis = {
  /** No candidate finding was raised at all — the board convened and had nothing to decide. */
  NoCandidateFindings: "no_candidate_findings",
  /** At least one adopted finding is blocking/major. */
  AdoptedBlockingOrMajor: "adopted_blocking_or_major",
  /** Findings were adopted, all of them minor/info. */
  AdoptedMinorOrInfoOnly: "adopted_minor_or_info_only",
  /** Nothing adopted, but a blocking/major finding was raised and withheld/contested. */
  UnadoptedBlockingOrMajor: "unadopted_blocking_or_major",
  /** Nothing adopted, and every withheld/contested finding is minor/info. */
  UnadoptedMinorOrInfoOnly: "unadopted_minor_or_info_only",
} as const;
export type ReviewGateBasis = (typeof ReviewGateBasis)[keyof typeof ReviewGateBasis];

/**
 * A finding the board raised but did not adopt, carried forward instead of
 * discarded. Non-blocking on its own; the gate outcome is decided by `basis`.
 */
export type AdvisoryFinding = {
  findingId: string;
  dimension: ReviewDimension;
  severity: ReviewSeverity;
  subject: string;
  comment: string;
  /** Withheld (short of quorum) or Contested (quorum both ways — escalate). */
  state: FindingDecisionState;
  distinctAgree: number;
  distinctDisagree: number;
  quorum: number;
  /** Attribution: the distinct reviewer agents who agreed / disagreed. Sorted, ordinal. */
  agreedBy: readonly string[];
  disagreedBy: readonly string[];
  boardReason: string;
};

export type ReviewGateResult =
  | {
      outcome: "ok";
      recommendedGateOutcome: QualityGateOutcome;
      /** The named state the outcome was derived from. */
      basis: ReviewGateBasis;
      board: ReviewBoardOutcome;
      adoptedFindingIds: readonly string[];
      /** Every raised-but-not-adopted finding, with attribution. Never silently dropped. */
      advisoryFindings: readonly AdvisoryFinding[];
      reason: string;
    }
  | { outcome: "feedback"; feedback: { reason: ReviewGateFeedbackReason; message: string } };

function isBlockingOrMajor(decision: FindingDecision): boolean {
  return (
    decision.finding.severity === ReviewSeverity.Blocking ||
    decision.finding.severity === ReviewSeverity.Major
  );
}

/** Distinct reviewer agent ids holding `stance` on `findingId`, ordinal-sorted. */
function agentsWithStance(
  votes: readonly ReviewerVote[],
  findingId: string,
  stance: ReviewStance,
): readonly string[] {
  const agents = new Set<string>();
  for (const vote of votes) {
    if (vote.findingId === findingId && vote.stance === stance) {
      agents.add(vote.reviewerAgentId);
    }
  }
  return [...agents].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function toAdvisory(decision: FindingDecision, votes: readonly ReviewerVote[]): AdvisoryFinding {
  return {
    findingId: decision.finding.findingId,
    dimension: decision.finding.dimension,
    severity: decision.finding.severity,
    subject: decision.finding.subject,
    comment: decision.finding.comment,
    state: decision.state,
    distinctAgree: decision.distinctAgree,
    distinctDisagree: decision.distinctDisagree,
    quorum: decision.quorum,
    agreedBy: agentsWithStance(votes, decision.finding.findingId, ReviewStance.Agree),
    disagreedBy: agentsWithStance(votes, decision.finding.findingId, ReviewStance.Disagree),
    boardReason: decision.reason,
  };
}

/** The single place a basis becomes a gate outcome. */
function outcomeForBasis(basis: ReviewGateBasis): QualityGateOutcome {
  switch (basis) {
    case ReviewGateBasis.AdoptedBlockingOrMajor:
      return QualityGateOutcome.Rejected;
    case ReviewGateBasis.AdoptedMinorOrInfoOnly:
      return QualityGateOutcome.ChangesRequested;
    // The fix: information exists and is severe; it must not read as approval.
    // ChangesRequested, not Rejected — the board did not establish the finding is true.
    case ReviewGateBasis.UnadoptedBlockingOrMajor:
      return QualityGateOutcome.ChangesRequested;
    case ReviewGateBasis.UnadoptedMinorOrInfoOnly:
      return QualityGateOutcome.Approved;
    case ReviewGateBasis.NoCandidateFindings:
      return QualityGateOutcome.Approved;
  }
}

/**
 * Run the review board over the findings + votes and recommend a gate outcome.
 *
 * Adopted findings decide first (blocking/major rejects, minor/info requests
 * changes). If nothing was adopted, the gate distinguishes "no finding was
 * raised" (clean -> Approved) from "findings were raised and withheld"
 * (information exists -> ChangesRequested when any is blocking/major, Approved
 * with advisories otherwise). Withheld findings are always returned on
 * `advisoryFindings`.
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

  // Everything the board raised but did not adopt: withheld (short of quorum) and
  // contested (quorum both ways). Carried forward with attribution, never dropped.
  const notAdopted = boardResult.board.withheld;
  const advisoryFindings = notAdopted.map((decision) => toAdvisory(decision, input.votes));
  const contestedCount = notAdopted.filter((d) => d.state === FindingDecisionState.Contested).length;

  // Count what was RAISED, not just what survived aggregation: a zero here means
  // "nothing to know", and it is the only zero that may read as approval.
  const raisedCount = boardResult.board.decisions.length;

  let basis: ReviewGateBasis;
  let reason: string;
  if (adopted.length > 0 && adopted.some(isBlockingOrMajor)) {
    basis = ReviewGateBasis.AdoptedBlockingOrMajor;
    reason = `${adopted.length} finding(s) adopted, at least one major/blocking; gate rejected`;
  } else if (adopted.length > 0) {
    basis = ReviewGateBasis.AdoptedMinorOrInfoOnly;
    reason = `${adopted.length} minor/info finding(s) adopted; changes requested`;
  } else if (raisedCount === 0) {
    basis = ReviewGateBasis.NoCandidateFindings;
    reason = `board convened (${boardResult.board.reviewerCount} reviewers); no candidate finding was raised; gate approved`;
  } else if (notAdopted.some(isBlockingOrMajor)) {
    basis = ReviewGateBasis.UnadoptedBlockingOrMajor;
    const severeCount = notAdopted.filter(isBlockingOrMajor).length;
    reason =
      `no finding reached quorum agreement, but ${severeCount} major/blocking finding(s) were raised ` +
      `(${contestedCount} contested); carried as advisory, changes requested`;
  } else {
    basis = ReviewGateBasis.UnadoptedMinorOrInfoOnly;
    reason =
      `no finding reached quorum agreement; ${notAdopted.length} minor/info finding(s) ` +
      `(${contestedCount} contested) carried as advisory; gate approved`;
  }

  return {
    outcome: "ok",
    recommendedGateOutcome: outcomeForBasis(basis),
    basis,
    board: boardResult.board,
    adoptedFindingIds,
    advisoryFindings,
    reason,
  };
}
