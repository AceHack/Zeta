/**
 * The qualitative 3-agent code-review board.
 *
 * Operator vision 2026-05-29: quantitative metrics flag candidates, but the
 * review itself runs as a board of >= 3 reviewer agents. Reviewers discuss
 * correctness, SOLID principles, and adherence to the architecture.
 *
 * ## What changed, and why (PR #10945 / #10957 / #10974)
 *
 * This module used to adopt a finding only when a **quorum of distinct
 * reviewers agreed**, with `DEFAULT_REVIEW_QUORUM = 3` doubling as the minimum
 * board size. #10974 named the defect that falls out of those two numbers being
 * the same number: at the minimum convening size the agreement threshold is
 * `k = n` — **unanimity** — and `ofKOfN` normalises `k >= n` to `veto`.
 * Classifying a **recall** purpose against `veto` is `mirror-mismatch`: the rule
 * did not merely fail to dominate, it dominated on the **opposite** axis.
 *
 * Finding bugs is a **recall** task — a miss is the expensive error and a false
 * positive costs a reviewer's attention. The rule that dominates on recall is
 * `union` (`k = 1`): by set monotonicity the union contains whatever the best
 * finder found, on every sample path. So the board now:
 *
 *   1. **declares** its rule as an `AggregationRule` value (`union`) and its
 *      objective as a `Purpose` (`recall`), instead of hardcoding a count;
 *   2. **applies** that rule through `toBooleanRule` — there is no counting
 *      logic left in this file to drift from the declaration;
 *   3. **publishes** the agreement count as a `FindingConfidence` annotation
 *      rather than spending it as a gate. A withheld finding that is dropped is
 *      erasure; a surfaced finding carrying "1 of 3 agreed" is correction.
 *
 * ## Two numbers that were one number
 *
 * - `quorum` is now **only** an attendance floor: how many distinct reviewers
 *   must show up before the board may sit at all. In `AggregationRule` terms
 *   that is a `liveness-precondition`, explicitly **not** an accuracy claim, and
 *   it is the honest meaning of the word "quorum" in the first place.
 * - the **aggregation rule** decides adoption, and it is a separate, declared,
 *   caller-overridable value.
 *
 * Separating them is what removes the mismatch: the board can still refuse to
 * convene with two reviewers while adopting on one reviewer's finding.
 *
 * ## The rule is checked, not merely declared
 *
 * `evaluateReviewBoard` runs `classify(purpose, rule)` and **refuses** a pairing
 * whose verdict is `mirror-mismatch`. A future edit that sets the rule back to
 * `veto` (or writes `ofKOfN(n, n, ...)`) fails mechanically instead of being
 * noticed by a human three PRs later. Weaker verdicts (`does-not-dominate` for a
 * strict-middle threshold) are permitted, because a caller may legitimately pin
 * a threshold — the tests do exactly that to keep #10957's assertions alive.
 *
 * **No weights.** `toBooleanRule` returns `undefined` for a `weighted` rule, so
 * a weighted rule is structurally unusable here rather than merely discouraged.
 * Weighted aggregation waits on a measured-competence ledger; nothing in this
 * repo has one (`WeightBasis.log-odds-competence` ships deliberately
 * unpopulated), and calibration is not competence.
 *
 * Mirrors the governance constitution-gate's distinct-agreer semantics but does
 * not import it (different package); what it *does* import is the shared
 * aggregation algebra, so the classification is one source of truth across the
 * repo rather than a restatement that can drift.
 */

import {
  classify,
  dominanceAxes,
  toBooleanRule,
  union,
  verdictKey as aggregationVerdictKey,
  type Purpose,
  type Rule,
  type Verdict,
} from "../../../../src/Core.TypeScript/society/aggregation-rule.ts";

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

/** A proposed review comment, before the board has applied its rule to it. */
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

/**
 * **How well corroborated an adopted finding is — an annotation, never a gate.**
 *
 * This is the information the old quorum gate consumed and destroyed. Under
 * `union` a finding raised by one reviewer and a finding all three agreed on are
 * both adopted, and they are *not* the same finding; the difference lives here,
 * where a reader (or a downstream policy that chooses to, and says so) can see
 * it. Nothing in this module branches on these numbers.
 */
export type FindingConfidence = {
  /** Distinct reviewer agents who agreed. One agent voting three times counts once. */
  distinctAgree: number;
  /** Distinct reviewer agents who disagreed. */
  distinctDisagree: number;
  /** Distinct reviewer agents who explicitly abstained. */
  distinctAbstain: number;
  /** Distinct reviewers who convened — the denominator, including any who never voted on this finding. */
  reviewerCount: number;
  /** `distinctAgree / reviewerCount`. Derived; carried so consumers agree on the arithmetic. */
  agreementRatio: number;
  /**
   * True when the **dissent** would also have satisfied the rule. Under a
   * recall-dominant rule this is an annotation on an adopted finding (dissent
   * does not suppress a discovery); under any other rule it is the escalation
   * that produces `FindingDecisionState.Contested`.
   */
  contested: boolean;
};

export type FindingDecision = {
  finding: CandidateFinding;
  state: FindingDecisionState;
  /** Retained for compatibility; identical to `confidence.distinctAgree`. */
  distinctAgree: number;
  /** Retained for compatibility; identical to `confidence.distinctDisagree`. */
  distinctDisagree: number;
  /**
   * The **attendance floor** the board convened under. It no longer gates
   * adoption — kept because consumers report it, and because "how many
   * reviewers were required to be present" is still a fact about the decision.
   */
  quorum: number;
  /** The agreement counts, published rather than spent. */
  confidence: FindingConfidence;
  reason: string;
};

export type ReviewBoardOutcome = {
  /** Attendance floor (liveness precondition), not an agreement threshold. */
  quorum: number;
  reviewerCount: number;
  /** The declared aggregation rule this board applied. */
  rule: Rule;
  /** The declared objective the rule was chosen for. */
  purpose: Purpose;
  /** `classify(purpose, rule)` — the machine-checked standing of the pairing. */
  verdict: Verdict;
  /** Ordinal text key of `verdict`, e.g. `"dominates:recall"`. Cross-oracle comparable. */
  verdictKey: string;
  adopted: readonly FindingDecision[];
  withheld: readonly FindingDecision[];
  decisions: readonly FindingDecision[];
};

/**
 * **Attendance floor**, not an agreement threshold. Justification:
 * `liveness-precondition` — "enough participants to proceed at all", which the
 * `AggregationRule` taxonomy classifies as `out-of-scope` for the Dominance Lift
 * theorem rather than as an aggregator that dominates on nothing.
 *
 * The name is kept (and is now used correctly): a quorum is a minimum
 * *attendance*. Using it as a minimum *agreement* is what produced the mirror
 * mismatch.
 */
export const DEFAULT_REVIEW_QUORUM = 3;

/**
 * **What the board is for.** Bug-finding is discovery: a missed defect is the
 * expensive error, a false positive costs a reviewer's attention. Declared here
 * so `classify` has something to check the rule against.
 */
export const REVIEW_BOARD_PURPOSE: Purpose = { kind: "recall" };

/**
 * **The declared aggregation rule.** `union` is `k = 1` — every finding any
 * reviewer raises is adopted. It is the endpoint of the k-of-n family that
 * dominates on recall, which is the axis `REVIEW_BOARD_PURPOSE` needs.
 *
 * Swap this for `threshold(3, ...)` and the single-reviewer falsifier in
 * `test/review-board.test.ts` goes red — that is the mutant the change is
 * demonstrated against.
 */
export const DEFAULT_REVIEW_RULE: Rule = union;

export const ReviewBoardFeedbackReason = {
  TooFewReviewers: "too_few_reviewers",
  /** The declared rule dominates on the axis opposite to the declared purpose. */
  AggregationRuleMirrorMismatch: "aggregation_rule_mirror_mismatch",
  /** The declared rule has no boolean reading — `weighted` and `plurality` have none. */
  AggregationRuleNotApplicable: "aggregation_rule_not_applicable",
} as const;
export type ReviewBoardFeedbackReason =
  (typeof ReviewBoardFeedbackReason)[keyof typeof ReviewBoardFeedbackReason];

export type ReviewBoardResult =
  | { outcome: "ok"; board: ReviewBoardOutcome }
  | { outcome: "feedback"; feedback: { reason: ReviewBoardFeedbackReason; message: string } };

/** Distinct reviewer agent ids holding `stance` on `findingId`. */
function agentsWithStance(
  votes: readonly ReviewerVote[],
  findingId: string,
  stance: ReviewStance,
): ReadonlySet<string> {
  const agents = new Set<string>();
  for (const vote of votes) {
    if (vote.findingId === findingId && vote.stance === stance) {
      agents.add(vote.reviewerAgentId);
    }
  }
  return agents;
}

/** Every distinct reviewer agent who cast any vote, ordinal-sorted (culture-invariant). */
function convenedReviewers(votes: readonly ReviewerVote[]): readonly string[] {
  const agents = new Set<string>();
  for (const vote of votes) {
    agents.add(vote.reviewerAgentId);
  }
  return [...agents].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

type BoardContext = {
  reviewerIds: readonly string[];
  quorum: number;
  rule: Rule;
  /** The rule's boolean reading, resolved once. */
  apply: (votes: readonly boolean[]) => boolean;
  /** Whether the rule dominates on recall — decides whether dissent escalates or merely annotates. */
  recallDominant: boolean;
};

/**
 * Apply the declared rule to one finding.
 *
 * The vote vector has **one slot per convened reviewer**, in ordinal id order —
 * so `union` is "any reviewer agreed", `veto` is "every convened reviewer
 * agreed", and a reviewer who never voted on this finding contributes `false`:
 * silence is not agreement. The rule, not this function, decides what that
 * vector means.
 */
function decideFinding(finding: CandidateFinding, votes: readonly ReviewerVote[], ctx: BoardContext): FindingDecision {
  const agreed = agentsWithStance(votes, finding.findingId, ReviewStance.Agree);
  const disagreed = agentsWithStance(votes, finding.findingId, ReviewStance.Disagree);
  const abstained = agentsWithStance(votes, finding.findingId, ReviewStance.Abstain);

  const accepts = ctx.apply(ctx.reviewerIds.map((id) => agreed.has(id)));
  const dissentAccepts = ctx.apply(ctx.reviewerIds.map((id) => disagreed.has(id)));

  const reviewerCount = ctx.reviewerIds.length;
  const confidence: FindingConfidence = {
    distinctAgree: agreed.size,
    distinctDisagree: disagreed.size,
    distinctAbstain: abstained.size,
    reviewerCount,
    agreementRatio: reviewerCount === 0 ? 0 : agreed.size / reviewerCount,
    contested: accepts && dissentAccepts,
  };

  const base = {
    finding,
    distinctAgree: agreed.size,
    distinctDisagree: disagreed.size,
    quorum: ctx.quorum,
    confidence,
  };

  if (!accepts) {
    return {
      ...base,
      state: FindingDecisionState.Withheld,
      reason: `rule '${ctx.rule.kind}' not satisfied: ${agreed.size} of ${reviewerCount} distinct reviewers agreed`,
    };
  }

  // Dissent escalates only when the rule is NOT recall-dominant. Letting dissent
  // suppress a finding under `union` would reinstate the mirror defect through
  // the back door: a single disagreeing reviewer would veto a discovery.
  if (dissentAccepts && !ctx.recallDominant) {
    return {
      ...base,
      state: FindingDecisionState.Contested,
      reason: `rule '${ctx.rule.kind}' satisfied by both sides (${agreed.size} agreed, ${disagreed.size} disagreed) — escalate`,
    };
  }

  const dissentNote = confidence.contested ? `, contested by ${disagreed.size}` : "";
  return {
    ...base,
    state: FindingDecisionState.Adopted,
    reason: `rule '${ctx.rule.kind}' satisfied: ${agreed.size} of ${reviewerCount} distinct reviewers agreed${dissentNote}`,
  };
}

/**
 * Run the review board over a set of candidate findings and reviewer votes.
 *
 * Two independent gates, deliberately kept apart:
 *
 * - **attendance** (`quorum`): fewer than `quorum` distinct reviewers showed up
 *   -> `feedback`. A liveness precondition, not a verdict about any finding.
 * - **aggregation** (`rule`): decides adoption per finding. Defaults to
 *   `DEFAULT_REVIEW_RULE` (`union`), checked against `REVIEW_BOARD_PURPOSE`
 *   (`recall`) before anything is decided.
 *
 * Callers may pin a different rule — the tests pin `threshold(k, ...)` to keep
 * the pre-#10974 regime under test — but may not pin one that classifies as
 * `mirror-mismatch`.
 */
export function evaluateReviewBoard(input: {
  findings: readonly CandidateFinding[];
  votes: readonly ReviewerVote[];
  quorum?: number;
  rule?: Rule;
  purpose?: Purpose;
}): ReviewBoardResult {
  const quorum = Math.max(1, input.quorum ?? DEFAULT_REVIEW_QUORUM);
  const rule = input.rule ?? DEFAULT_REVIEW_RULE;
  const purpose = input.purpose ?? REVIEW_BOARD_PURPOSE;

  // The declaration is checked, not trusted. A rule that dominates on the
  // OPPOSITE one-sided axis to the purpose is refused outright.
  const verdict = classify(purpose, rule);
  if (verdict.kind === "mirror-mismatch") {
    return {
      outcome: "feedback",
      feedback: {
        reason: ReviewBoardFeedbackReason.AggregationRuleMirrorMismatch,
        message: `review board rule '${rule.kind}' dominates on ${verdict.offered} but the board's purpose needs ${verdict.needed} (${aggregationVerdictKey(verdict)})`,
      },
    };
  }

  const apply = toBooleanRule(rule);
  if (apply === undefined) {
    return {
      outcome: "feedback",
      feedback: {
        reason: ReviewBoardFeedbackReason.AggregationRuleNotApplicable,
        message: `review board rule '${rule.kind}' has no boolean reading over votes; weighted aggregation needs a measured-competence ledger, which does not exist`,
      },
    };
  }

  const reviewerIds = convenedReviewers(input.votes);
  if (reviewerIds.length < quorum) {
    return {
      outcome: "feedback",
      feedback: {
        reason: ReviewBoardFeedbackReason.TooFewReviewers,
        message: `review board needs >= ${quorum} distinct reviewers, got ${reviewerIds.length}`,
      },
    };
  }

  const ctx: BoardContext = {
    reviewerIds,
    quorum,
    rule,
    apply,
    recallDominant: dominanceAxes(rule).includes("recall"),
  };

  const decisions = input.findings.map((finding) => decideFinding(finding, input.votes, ctx));
  const adopted = decisions.filter((d) => d.state === FindingDecisionState.Adopted);
  const withheld = decisions.filter((d) => d.state !== FindingDecisionState.Adopted);

  return {
    outcome: "ok",
    board: {
      quorum,
      reviewerCount: reviewerIds.length,
      rule,
      purpose,
      verdict,
      verdictKey: aggregationVerdictKey(verdict),
      adopted,
      withheld,
      decisions,
    },
  };
}
