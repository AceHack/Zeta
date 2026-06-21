// src/Core.TypeScript/workflow-engine/pr-review-lifecycle.ts
//
// PrReviewLifecycle — substrate-naming substrate for PRODUCING-side
// review work. Companion to B-0867.20 ReviewLifetime (receiving-side;
// reviewer-feedback gate-state).
//
// Per the human maintainer (2026-05-28): "also does it give you time to look at prs and
// put comments?" — substrate-engineering gap: AutoLoopLifetime (PR #5805)
// only models SHIP work, not REVIEW work. This DU makes producing-side
// review-substrate explicit.
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
export function dispatchPrReviewTransition(current, context) {
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
            const unsubstantiated = context.findings.find((f) => f.substrateAnchors === undefined || f.substrateAnchors.length === 0);
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
export const PR_REVIEW_LIFECYCLE_UNIVERSE = [
    { kind: "observe" },
    { kind: "identify-finding" },
    { kind: "compose" },
    { kind: "verify-finding" },
    { kind: "post" },
    { kind: "follow-up" },
    { kind: "conclude" },
];
/**
 * Returns true when the author lane requires coordination before touching
 * commits (peer-agent territory OR human-operator territory). Both lanes
 * are non-self-authored; both require coordination per
 * fighting-past-self-vs-peer-agent-distinguisher rule — but the lanes are
 * substantively DISTINCT and should NOT be conflated for any purpose
 * beyond "this is not my own commit-substrate." Callers that need to
 * distinguish should use `isPeerAgent` or `isHumanOperator` directly.
 */
export function requiresCoordinationLane(authorLane) {
    return isPeerAgent(authorLane) || isHumanOperator(authorLane);
}
/**
 * True iff the author lane is a peer-agent surface (otto-* / codex / lior /
 * alexa / vera / riven / amara / kestrel / prism / mika). Distinct from
 * human-operator per the fighting-past-self discriminator table.
 */
export function isPeerAgent(authorLane) {
    return authorLane.startsWith("peer-");
}
/**
 * True iff the author lane is the human operator. Distinct from peer-agent
 * per the fighting-past-self discriminator table; coordination shape
 * differs (peer-agents coordinate via bus / peer-call; human operator
 * coordinates via conversation / explicit authorization).
 */
export function isHumanOperator(authorLane) {
    return authorLane === "human-operator";
}
/**
 * Empty/initial ReviewContext for starting a new review.
 */
export function newReviewContext(prNumber, authorLane, substrateScope) {
    return {
        prNumber,
        authorLane,
        substrateScope,
        findings: [],
        observationsMade: 0,
    };
}
