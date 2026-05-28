// tools/workflow-engine/pr-review-lifecycle.ts
//
// PrReviewLifecycle — substrate-naming substrate for PRODUCING-side
// review work. Companion to B-0867.20 ReviewLifetime (receiving-side;
// reviewer-feedback gate-state).
//
// Per the human maintainer (2026-05-28): "also does it give you time to look at prs and
// put comments?" — substrate-engineering substrate-engineering substrate
// gap: AutoLoopLifetime (PR #5805) only models SHIP work, not REVIEW
// work. This DU makes producing-side review-substrate explicit.
//
// Composes with:
// - .claude/rules/fighting-past-self-vs-peer-agent-distinguisher-fix-your-own-coordinate-on-peers-dont-punt-by-default.md
//   (peer-agent commits = don't touch; peer-agent reviews = substantively engage)
// - .claude/rules/asymmetric-authorship-substrate-entity-defines-consent-channel-recipient-acknowledges.md
//   (reviewer AUTHORS feedback; receiving-side ACKNOWLEDGES)
// - .claude/rules/honor-those-that-came-before.md (peer-agent work honored via substantive review)
// - .claude/rules/glass-halo-bidirectional.md (review comments are public substrate; compound)
// - B-0867.20 ReviewLifetime DU (PR #5758) — receiving-side; this PR
//   provides producing-side complement
// - AutoLoopLifetime (PR #5805) — will compose; producing-side review
//   work becomes additional state-transition in loop substrate

import { type LifetimeState } from "./world";

// ─────────────────────────────────────────────────────────────────────
// PrReviewLifecycle — producing-side state machine
// ─────────────────────────────────────────────────────────────────────

/**
 * PrReviewLifecycle — substrate-naming substrate for PRODUCING-side
 * review work. Captures the state machine for reviewing peer PRs +
 * composing + posting substantive review comments.
 *
 * Distinguishes from B-0867.20 ReviewLifetime which captures
 * RECEIVING-side gate states (my-PR-under-review states). This DU is
 * for when I AM the reviewer of someone else's work.
 */
export interface PrReviewLifecycle extends LifetimeState {
  readonly kind:
    | "observe"               // read PR + diff + context; no engagement yet
    | "identify-finding"      // substrate-engineering issue / question / praise surfaced
    | "compose"               // write review comment with substantive content
    | "verify-finding"        // grep substrate-anchor; check claim before posting (per substrate-honest discipline)
    | "post"                  // ship the review via gh api / GraphQL mutation
    | "follow-up"             // engage on author's response if any
    | "conclude";             // no further engagement; mark as concluded
}

// ─────────────────────────────────────────────────────────────────────
// Review-finding substrate
// ─────────────────────────────────────────────────────────────────────

/**
 * ReviewFindingKind — substrate-engineering taxonomy of review-comment
 * shapes. Each kind has different operational discipline.
 */
export type ReviewFindingKind =
  | { kind: "bug"; severity: "critical" | "major" | "minor" }
  | { kind: "design-question"; subject: string }
  | { kind: "substrate-engineering-suggestion"; alternative: string }
  | { kind: "naming-improvement"; current: string; proposed: string }
  | { kind: "test-gap"; uncovered: string }
  | { kind: "substrate-honest-praise"; reason: string }
  | { kind: "documentation-gap"; missing: string }
  | { kind: "composes-with-substrate"; relatedRef: string };

/**
 * ReviewFinding — substrate-engineering observation worth posting as
 * review comment.
 */
export interface ReviewFinding {
  readonly prNumber: number;
  readonly filePath?: string;            // optional; some findings are PR-scoped
  readonly lineNumber?: number;          // optional; some findings are file-scoped
  readonly kind: ReviewFindingKind;
  readonly content: string;              // substantive review-comment body
  readonly substrateAnchors?: ReadonlyArray<string>;  // grep-substrate-anchors per rule
}

// ─────────────────────────────────────────────────────────────────────
// Review context + outcome
// ─────────────────────────────────────────────────────────────────────

/**
 * ReviewContext — substrate carried across the review-lifecycle.
 */
export interface ReviewContext {
  readonly prNumber: number;
  readonly authorLane: "self" | "peer-otto" | "peer-codex" | "peer-lior" | "peer-alexa" | "peer-vera" | "peer-riven" | "peer-amara" | "peer-kestrel" | "peer-prism" | "peer-mika" | "human-operator" | "unknown";
  readonly substrateScope: "workflow-engine" | "encryption" | "zflash" | "ferry-preservation" | "rule-update" | "memory-file" | "infrastructure" | "other";
  readonly findings: ReadonlyArray<ReviewFinding>;
  readonly observationsMade: number;     // count of observe → identify cycles
}

/**
 * ReviewOutcome — what the review-lifecycle produced.
 */
export interface ReviewOutcome {
  readonly nextState: PrReviewLifecycle;
  readonly artifact?: {
    readonly kind: "review-comment-posted" | "thread-resolved" | "approval-given" | "no-engagement-warranted";
    readonly threadId?: string;
  };
}

// ─────────────────────────────────────────────────────────────────────
// PrReviewFeedback — asymmetric-authorship per rule
// ─────────────────────────────────────────────────────────────────────

export type PrReviewFeedback =
  | { kind: "PrNotAccessible"; prNumber: number; reason: string }
  | { kind: "PeerAgentTerritory"; prNumber: number; lane: ReviewContext["authorLane"] }  // don't-touch-commits but review-allowed
  | { kind: "FindingUnsubstantiated"; finding: ReviewFinding }       // failed verify step
  | { kind: "RateLimitExhausted"; budget: "rest" | "graphql"; resetAt: number }
  | { kind: "NoActionableFinding"; prNumber: number };

export type PrReviewResult<T> =
  | { ok: true; outcome: T }
  | { ok: false; feedback: PrReviewFeedback };

// ─────────────────────────────────────────────────────────────────────
// State transition dispatch
// ─────────────────────────────────────────────────────────────────────

/**
 * Dispatch the next PrReviewLifecycle state given current context.
 *
 * Per substrate-smoothness rule: exhaustive switch on PrReviewLifecycle
 * variants; no if-statement chains. Per asymmetric-authorship: each
 * transition AUTHORS feedback channel.
 */
export function dispatchPrReviewTransition(
  current: PrReviewLifecycle,
  context: ReviewContext,
): PrReviewResult<ReviewOutcome> {
  switch (current.kind) {
    case "observe":
      // After observing, identify findings (or conclude if no findings)
      if (context.findings.length === 0) {
        return {
          ok: true,
          outcome: {
            nextState: { kind: "conclude" },
            artifact: { kind: "no-engagement-warranted" },
          },
        };
      }
      return {
        ok: true,
        outcome: {
          nextState: { kind: "identify-finding" },
        },
      };

    case "identify-finding":
      // After identifying, compose the review comment
      return {
        ok: true,
        outcome: {
          nextState: { kind: "compose" },
        },
      };

    case "compose":
      // After composing, verify (grep substrate-anchors)
      return {
        ok: true,
        outcome: {
          nextState: { kind: "verify-finding" },
        },
      };

    case "verify-finding": {
      // Per grep-substrate-anchors-before-razor-as-metaphysical: every
      // finding MUST carry substrate-anchors before advancing to post.
      // Both missing `substrateAnchors` AND an empty array mean
      // unsubstantiated. Iterate all findings (not just findings[0]).
      // Zero findings = NoActionableFinding feedback (can't post review
      // when there's nothing to say).
      if (context.findings.length === 0) {
        return {
          ok: false,
          feedback: { kind: "NoActionableFinding", prNumber: context.prNumber },
        };
      }
      const unsubstantiated = context.findings.find((f) =>
        f.substrateAnchors === undefined || f.substrateAnchors.length === 0
      );
      if (unsubstantiated !== undefined) {
        return {
          ok: false,
          feedback: { kind: "FindingUnsubstantiated", finding: unsubstantiated },
        };
      }
      return {
        ok: true,
        outcome: {
          nextState: { kind: "post" },
        },
      };
    }

    case "post":
      // After posting, await follow-up (or conclude if no follow-up expected)
      return {
        ok: true,
        outcome: {
          nextState: { kind: "follow-up" },
          artifact: { kind: "review-comment-posted" },
        },
      };

    case "follow-up":
      // After follow-up window, conclude
      return {
        ok: true,
        outcome: {
          nextState: { kind: "conclude" },
        },
      };

    case "conclude":
      // Terminal state; stays at conclude
      return {
        ok: true,
        outcome: {
          nextState: { kind: "conclude" },
        },
      };
  }
}

// ─────────────────────────────────────────────────────────────────────
// Reusable substrate exports
// ─────────────────────────────────────────────────────────────────────

export const PR_REVIEW_LIFECYCLE_UNIVERSE: ReadonlyArray<PrReviewLifecycle> = [
  { kind: "observe" },
  { kind: "identify-finding" },
  { kind: "compose" },
  { kind: "verify-finding" },
  { kind: "post" },
  { kind: "follow-up" },
  { kind: "conclude" },
];

/**
 * Determines if a PR is in peer-agent territory (don't touch commits but
 * review-allowed per fighting-past-self-vs-peer-agent-distinguisher rule).
 */
export function isPeerAgentTerritory(authorLane: ReviewContext["authorLane"]): boolean {
  return authorLane.startsWith("peer-") || authorLane === "human-operator";
}

/**
 * Empty/initial ReviewContext for starting a new review.
 */
export function newReviewContext(
  prNumber: number,
  authorLane: ReviewContext["authorLane"],
  substrateScope: ReviewContext["substrateScope"],
): ReviewContext {
  return {
    prNumber,
    authorLane,
    substrateScope,
    findings: [],
    observationsMade: 0,
  };
}
