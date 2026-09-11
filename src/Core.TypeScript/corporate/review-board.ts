/**
 * review-board.ts — several reviewers, one decision per finding, and a rule that says which.
 *
 * ── THE DOC ──────────────────────────────────────────────────────────────────
 * `METRICS_AND_REVIEW_BOARD.md` §"Qualitative — the 3-agent review board". The register had
 * `evaluateGate`: ONE hat, one verdict, separation of duties enforced. That is the right shape for
 * an authority decision and the wrong shape for a review, because a review is a DISCOVERY task —
 * the expensive error is missing something, not flagging something that turns out fine.
 *
 * ── THE DEFECT THE DOC NAMES, RESTATED HERE BECAUSE IT IS EASY TO REINTRODUCE ─
 * A quorum of three used to be BOTH the minimum board size and the agreement threshold. At the
 * minimum convening size that makes the threshold `k = n`, which `ofKOfN` normalises to `veto` —
 * and a veto on a discovery task is `mirror-mismatch(recall, safety)`. The rule did not merely fail
 * to dominate on the axis the work needed; **it dominated on the opposite one**. One reviewer
 * disagreeing suppressed a true finding, and the suppression was invisible because it looked like
 * rigour.
 *
 * So the two numbers are separate here and named for what they are:
 *
 *   - `quorum` — an ATTENDANCE FLOOR. How many distinct reviewers must show up before the board may
 *     sit. Explicitly not an accuracy claim.
 *   - `rule` — what decides adoption. `union` by default: any reviewer agreeing adopts, so a
 *     solitary true finding is not dropped.
 *
 * ── THE DECLARATION IS CHECKED, NOT TRUSTED ──────────────────────────────────
 * The board states its purpose (`recall`) and its rule, and `classify` from
 * `society/aggregation-rule.ts` judges the PAIRING before anything is decided. Setting the rule
 * back to `veto`, or writing `ofKOfN(n, n, …)`, fails mechanically rather than by review. The
 * algebra is IMPORTED rather than restated, so the classification has one source of truth — a
 * second copy of "which rules dominate recall" is a second thing to keep in step, and the copy is
 * always the one that drifts.
 *
 * ── AGREEMENT IS PUBLISHED, NOT SPENT ────────────────────────────────────────
 * Every decision carries its counts, and NOTHING BRANCHES ON THEM. A 1-of-3 finding and a 3-of-3
 * finding reach the same outcome and are never indistinguishable. The old quorum gate consumed that
 * number — it turned agreement into a threshold and then threw it away — and a withheld finding
 * that is dropped is erasure rather than a decision.
 */

import {
  classify,
  toBooleanRule,
  union,
  type Purpose,
  type Rule,
  type Verdict,
  verdictKey,
} from "../society/aggregation-rule";

/** The axes reviewers vote along. */
export const ReviewDimension = {
  Correctness: "correctness",
  Solid: "solid",
  ArchitectureAdherence: "architecture_adherence",
  Performance: "performance",
  Testing: "testing",
} as const;

export type ReviewDimension = (typeof ReviewDimension)[keyof typeof ReviewDimension];

/**
 * What this board is trying to be right about.
 *
 * RECALL. A review that misses a real defect has cost the thing reviews exist to prevent; one that
 * raises a finding which turns out fine has cost a conversation. Stating it as a value is what lets
 * the rule be checked against it instead of argued about.
 */
export const REVIEW_BOARD_PURPOSE: Purpose = { kind: "recall" };

/** Adoption rule. `union` — any reviewer agreeing adopts, so a solitary true finding survives. */
export const DEFAULT_REVIEW_RULE: Rule = union;

/**
 * ATTENDANCE FLOOR, and nothing else.
 *
 * How many DISTINCT reviewers must have voted before the board may sit. It says nothing about how
 * many must agree — that is `rule`'s job, and conflating the two is the defect at the top of this
 * file.
 */
export const DEFAULT_REVIEW_QUORUM = 3;

export interface CandidateFinding {
  readonly findingId: string;
  readonly dimension: ReviewDimension;
  readonly summary: string;
}

export interface ReviewerVote {
  readonly reviewerHatId: string;
  readonly findingId: string;
  /** Agree the finding is real, disagree that it is, or decline to judge. */
  readonly stance: "agree" | "disagree" | "abstain";
}

/**
 * The counts behind a decision. PUBLISHED, never consumed.
 *
 * Nothing in this module branches on any field here, and nothing downstream should either. The
 * whole point is that a 1-of-3 finding and a 3-of-3 finding reach the same outcome and remain
 * distinguishable to whoever reads them.
 */
export interface FindingConfidence {
  readonly distinctAgree: number;
  readonly distinctDisagree: number;
  readonly distinctAbstain: number;
  readonly reviewerCount: number;
  /** Agreement among reviewers who took a side. `0` when nobody did. */
  readonly agreementRatio: number;
  readonly contested: boolean;
}

export const FindingState = {
  /** The rule was satisfied. Under `union`: at least one reviewer agreed. */
  Adopted: "adopted",
  /** The rule was not satisfied. Under `union`: NOBODY agreed — union is k=1, not k=0. */
  Withheld: "withheld",
  /**
   * Both sides satisfied the rule.
   *
   * Under a recall-dominant rule this is an ANNOTATION ON AN ADOPTED FINDING, not an escalation.
   * Letting one disagreeing reviewer send a discovery finding away for adjudication reinstates the
   * mirror defect through the back door, wearing procedure instead of a rule.
   */
  Contested: "contested",
} as const;

export type FindingState = (typeof FindingState)[keyof typeof FindingState];

export interface FindingDecision {
  readonly finding: CandidateFinding;
  readonly state: FindingState;
  /** Whether the finding stands. TRUE for both `adopted` and a recall-dominant `contested`. */
  readonly adopted: boolean;
  readonly confidence: FindingConfidence;
}

export const BoardFeedback = {
  /** Below the attendance floor. The board may not sit. */
  TooFewReviewers: "too_few_reviewers",
  /** The rule has no boolean reading — a weighted rule needs numbers, not votes. */
  RuleNotApplicable: "aggregation_rule_not_applicable",
  /** The rule dominates on the OPPOSITE axis to the board's purpose. */
  RuleMirrorMismatch: "aggregation_rule_mirror_mismatch",
} as const;

export type BoardFeedback = (typeof BoardFeedback)[keyof typeof BoardFeedback];

export type BoardResult =
  | {
      readonly ok: true;
      readonly decisions: readonly FindingDecision[];
      /** How the declared pairing classified. Reported so a caller can see WHY it was allowed. */
      readonly verdict: Verdict;
      readonly reviewerCount: number;
    }
  | { readonly ok: false; readonly feedback: BoardFeedback; readonly reason: string };

export interface BoardInput {
  readonly findings: readonly CandidateFinding[];
  readonly votes: readonly ReviewerVote[];
  readonly quorum?: number;
  readonly rule?: Rule;
  readonly purpose?: Purpose;
}

/**
 * Sit the board.
 *
 * Order matters and is fixed: the PAIRING is checked before any finding is decided, because a board
 * that decides first and validates its rule afterwards has already produced the verdicts it was
 * supposed to be prevented from producing.
 */
export function evaluateReviewBoard(input: BoardInput): BoardResult {
  const rule = input.rule ?? DEFAULT_REVIEW_RULE;
  const purpose = input.purpose ?? REVIEW_BOARD_PURPOSE;
  const quorum = input.quorum ?? DEFAULT_REVIEW_QUORUM;

  const verdict = classify(purpose, rule);
  if (verdict.kind === "mirror-mismatch") {
    return {
      ok: false,
      feedback: BoardFeedback.RuleMirrorMismatch,
      reason: `the rule dominates on ${verdict.offered} where this board needs ${verdict.needed} (${verdictKey(verdict)})`,
    };
  }

  const decide = toBooleanRule(rule);
  if (decide === undefined) {
    // A weighted rule is STRUCTURALLY UNUSABLE here rather than merely discouraged. Weighted
    // aggregation waits on a measured-competence ledger, and this organization has none —
    // calibration is not competence, and a weight nobody measured is a preference with a number on.
    return {
      ok: false,
      feedback: BoardFeedback.RuleNotApplicable,
      reason: `'${rule.kind}' has no boolean reading; a board counts votes`,
    };
  }

  // DISTINCT reviewers. One agent voting three times is one reviewer — otherwise the attendance
  // floor and every count below can be self-amplified by whoever votes most.
  const reviewers = new Set(input.votes.map((v) => v.reviewerHatId));
  if (reviewers.size < quorum) {
    return {
      ok: false,
      feedback: BoardFeedback.TooFewReviewers,
      reason: `${String(reviewers.size)} distinct reviewer(s); the floor is ${String(quorum)}`,
    };
  }

  const recallDominant = verdict.kind === "dominates" && verdict.axis === "recall";
  const decisions = input.findings.map((finding) =>
    decideFinding(finding, input.votes, reviewers.size, decide, recallDominant),
  );
  return { ok: true, decisions, verdict, reviewerCount: reviewers.size };
}

function decideFinding(
  finding: CandidateFinding,
  votes: readonly ReviewerVote[],
  reviewerCount: number,
  decide: (votes: readonly boolean[]) => boolean,
  recallDominant: boolean,
): FindingDecision {
  const mine = votes.filter((v) => v.findingId === finding.findingId);
  const agree = distinct(mine, "agree");
  const disagree = distinct(mine, "disagree");
  const abstain = distinct(mine, "abstain");

  // The rule is applied to the DISTINCT stances, in both directions. Asking it only about the
  // agreers would make `contested` unreachable, and an unreachable state is a claim the code makes
  // and never keeps.
  const forStands = decide(Array.from({ length: agree.size }, () => true));
  const againstStands = decide(Array.from({ length: disagree.size }, () => true));

  const sided = agree.size + disagree.size;
  const confidence: FindingConfidence = {
    distinctAgree: agree.size,
    distinctDisagree: disagree.size,
    distinctAbstain: abstain.size,
    reviewerCount,
    agreementRatio: sided === 0 ? 0 : agree.size / sided,
    contested: forStands && againstStands,
  };

  if (forStands && againstStands) {
    return { finding, state: FindingState.Contested, adopted: recallDominant, confidence };
  }
  if (forStands) return { finding, state: FindingState.Adopted, adopted: true, confidence };
  return { finding, state: FindingState.Withheld, adopted: false, confidence };
}

function distinct(votes: readonly ReviewerVote[], stance: ReviewerVote["stance"]): ReadonlySet<string> {
  return new Set(votes.filter((v) => v.stance === stance).map((v) => v.reviewerHatId));
}

/** Every finding that stands, in the order they were put to the board. */
export function adoptedFindings(result: BoardResult): readonly CandidateFinding[] {
  return result.ok ? result.decisions.filter((d) => d.adopted).map((d) => d.finding) : [];
}
