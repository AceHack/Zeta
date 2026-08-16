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
 * The upstream board withheld any finding fewer than `quorum` distinct reviewers
 * agreed on, so state 2 was the normal case for a solitary true finding by the
 * single reviewer who spotted it. Approving on it ships the bug AND erases the
 * report. The `basis` field below is the state, named; `recommendedGateOutcome`
 * is derived from it rather than from a count that cannot tell the two apart.
 *
 * That distinction is still load-bearing and is still tested — it is just no
 * longer the *default* path, because the board now adopts on `union` (see the
 * section below). State 2 is reached whenever a caller pins a threshold rule, and
 * whenever the rule is not satisfied at all.
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
 * ## The open question this module deferred — now decided upstream
 *
 * This header used to record that the upstream aggregation rule was still
 * `AND`-of-3, that union is the dominant rule for a recall-shaped task, and that
 * changing it "alters what blocks merges repo-wide, so it is not this module's
 * call". That call has since been made, in `review-board.ts`: the board declares
 * `AggregationRule.union` against `Purpose.recall`, and adopts every finding any
 * reviewer raises. Nothing in the fail-open fix depended on the quorum rule —
 * the invariant here was always "a withheld finding must not read as approval
 * and must not be erased", and it holds unchanged under union.
 *
 * **What that changes for this module.** Under union, the ordinary path for a
 * solitary true finding is now `Adopted`, not `Withheld` — so it flows through
 * `AdoptedBlockingOrMajor` and the gate returns `Rejected` where it previously
 * returned `ChangesRequested`. The basis -> outcome mapping below is
 * **unchanged**; only which basis a given input reaches has moved. The
 * `Unadopted*` bases remain live and remain tested: they are what a caller gets
 * when it pins a threshold rule, which the tests do precisely so the assertions
 * written for the pre-union regime stay under test rather than being deleted.
 *
 * The restraint recorded below ("rejecting would assert it") applied to a rule
 * under which non-adoption was the alternative. Under union, adoption means
 * "some reviewer found this", and how well corroborated it is is published on
 * `confidence` rather than spent as a gate. Corroboration is an annotation here
 * too: this module does **not** branch on the agreement count, because doing so
 * would reintroduce a k-of-n threshold one layer up.
 *
 * Lives in the application layer because it composes two packages (domain's
 * QualityGateOutcome + metrics' review board); metrics stays dependency-free and
 * domain stays unaware of the board. Pure; no I/O.
 */

import type { Rule } from "../../../../src/Core.TypeScript/society/aggregation-rule.ts";
import { QualityGateOutcome } from "../../domain/src/index.ts";
import {
  FindingDecisionState,
  ReviewBoardFeedbackReason,
  ReviewSeverity,
  ReviewStance,
  evaluateReviewBoard,
  type CandidateFinding,
  type FindingConfidence,
  type FindingDecision,
  type ReviewBoardOutcome,
  type ReviewDimension,
  type ReviewerVote,
} from "../../metrics/src/index.ts";

export const ReviewGateFeedbackReason = {
  BoardCouldNotConvene: "board_could_not_convene",
  /** The board refused the declared aggregation rule (mirror mismatch, or no boolean reading). */
  AggregationRuleRefused: "aggregation_rule_refused",
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
 * A finding the board decided on, carried forward with attribution instead of
 * reduced to an id. Used for **both** halves of the output — adopted and
 * advisory — because under `union` the interesting question is no longer
 * "did it survive the count" but "who raised it, and who else agreed".
 */
export type ReportedFinding = {
  findingId: string;
  dimension: ReviewDimension;
  severity: ReviewSeverity;
  subject: string;
  comment: string;
  /** Adopted, Withheld (rule unsatisfied), or Contested (both sides satisfied it — escalate). */
  state: FindingDecisionState;
  distinctAgree: number;
  distinctDisagree: number;
  /** The board's attendance floor. Not an agreement threshold (see review-board.ts). */
  quorum: number;
  /**
   * The agreement count as an annotation. Present on adopted findings too: this
   * is the "1 of 3 agreed" vs "3 of 3 agreed" distinction that the old quorum
   * gate consumed. Nothing in this module branches on it.
   */
  confidence: FindingConfidence;
  /** Attribution: the distinct reviewer agents who agreed / disagreed. Sorted, ordinal. */
  agreedBy: readonly string[];
  disagreedBy: readonly string[];
  boardReason: string;
};

/**
 * A finding the board raised but did not adopt, carried forward instead of
 * discarded. Non-blocking on its own; the gate outcome is decided by `basis`.
 * Structurally identical to `ReportedFinding`; the name is kept because it is
 * the vocabulary #10957 established for the carried-not-erased half.
 */
export type AdvisoryFinding = ReportedFinding;

export type ReviewGateResult =
  | {
      outcome: "ok";
      recommendedGateOutcome: QualityGateOutcome;
      /** The named state the outcome was derived from. */
      basis: ReviewGateBasis;
      board: ReviewBoardOutcome;
      adoptedFindingIds: readonly string[];
      /** Every adopted finding with its attribution and agreement count. */
      adoptedFindings: readonly ReportedFinding[];
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

function toReported(decision: FindingDecision, votes: readonly ReviewerVote[]): ReportedFinding {
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
    confidence: decision.confidence,
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
  /** Override the board's declared aggregation rule. Omit for `union` (the recall-dominant default). */
  rule?: Rule;
}): ReviewGateResult {
  const boardResult = evaluateReviewBoard({
    findings: input.findings,
    votes: input.votes,
    ...(input.quorum === undefined ? {} : { quorum: input.quorum }),
    ...(input.rule === undefined ? {} : { rule: input.rule }),
  });

  if (boardResult.outcome === "feedback") {
    const reason =
      boardResult.feedback.reason === ReviewBoardFeedbackReason.TooFewReviewers
        ? ReviewGateFeedbackReason.BoardCouldNotConvene
        : ReviewGateFeedbackReason.AggregationRuleRefused;
    return { outcome: "feedback", feedback: { reason, message: boardResult.feedback.message } };
  }

  const adopted = boardResult.board.adopted;
  const adoptedFindingIds = adopted.map((decision) => decision.finding.findingId);
  const adoptedFindings = adopted.map((decision) => toReported(decision, input.votes));

  // Everything the board raised but did not adopt: withheld (rule unsatisfied) and
  // contested (both sides satisfied it). Carried forward with attribution, never dropped.
  const notAdopted = boardResult.board.withheld;
  const advisoryFindings = notAdopted.map((decision) => toReported(decision, input.votes));
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
      `no finding satisfied the board's aggregation rule, but ${severeCount} major/blocking finding(s) were raised ` +
      `(${contestedCount} contested); carried as advisory, changes requested`;
  } else {
    basis = ReviewGateBasis.UnadoptedMinorOrInfoOnly;
    reason =
      `no finding satisfied the board's aggregation rule; ${notAdopted.length} minor/info finding(s) ` +
      `(${contestedCount} contested) carried as advisory; gate approved`;
  }

  return {
    outcome: "ok",
    recommendedGateOutcome: outcomeForBasis(basis),
    basis,
    board: boardResult.board,
    adoptedFindingIds,
    adoptedFindings,
    advisoryFindings,
    reason,
  };
}
