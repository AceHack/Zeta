// src/Core.TypeScript/workflow-engine/auto-loop-lifetime.ts
//
// AutoLoopLifetime — substrate-naming substrate-engineering substrate
// for Otto-CLI's foreground autonomous-loop tick-handler. Per the human maintainer
// 2026-05-28: "when do you want to update your foreground loop to start
// running on lifecycles and test out our first ones?"
//
// Dogfood discipline: the workflow-engine substrate shipped today
// (081KDWZ8TS008QG0R0020NJ9D0 PoC + 081KSNY2Z0008QG0R003WFDCJ9 ReviewLifetime + 081KSNY2Z0008QG0R001YK61JQ.* + GitWorld +
// per-host adapters) is the substrate; the foreground loop is the
// natural first consumer.
//
// This PoC substrate-NAMES the loop's existing-but-implicit state
// machine. Future ticks USE the DU explicitly. Operational risk: low;
// parallel-run with current ad-hoc handler; doesn't replace working
// substrate.
//
// Composes with:
// - .claude/rules/holding-without-named-dependency-is-standing-by-failure.md (counter discipline → ForcedEscalation)
// - .claude/rules/refresh-before-decide.md (RefreshSubstrate state entry-condition)
// - .claude/rules/verify-before-deferring.md (BriefAckBoundedWait requires named-dep)
// - .claude/rules/dont-ask-permission.md (DecomposeOrShip within authority scope)
// - PR #5775 GitWorld + per-host adapters (GitHubWorld for PR-state scanning)
// - PR #5774 world.ts (dispatchInWorld + StandardVerdict)
import {} from "./world";
// ─────────────────────────────────────────────────────────────────────
// State transition dispatch
// ─────────────────────────────────────────────────────────────────────
/**
 * Brief-ack counter threshold per holding-without-named-dependency-is-
 * standing-by-failure.md (N=6 forced escalation).
 */
export const BRIEF_ACK_THRESHOLD = 6;
/**
 * Refresh staleness threshold (seconds). Per refresh-before-decide:
 * every tick selection requires current substrate; sentinel re-runs
 * arrive every minute, so refresh older than 90s is stale.
 */
export const REFRESH_STALENESS_THRESHOLD_S = 90;
/**
 * Dispatch the next AutoLoopLifetime state given current context.
 *
 * Per substrate-smoothness rule: no if-statement-chains; exhaustive
 * switch on AutoLoopLifetime variants. Per asymmetric-authorship:
 * each transition AUTHORS its feedback channel.
 */
export function dispatchAutoLoopTransition(current, context) {
    switch (current.kind) {
        case "cold-boot":
            // Cold-boot always advances to refresh-substrate
            return {
                ok: true,
                outcome: {
                    nextState: { kind: "refresh-substrate" },
                    verdict: { kind: "advance" },
                    counterReset: true,
                },
            };
        case "refresh-substrate": {
            // Per refresh-before-decide invariant: don't advance with stale
            // worldview. Caller must have refreshed substrate (gh fetch +
            // git pull) and updated lastRefreshAt BEFORE entering this
            // transition. If lastRefreshAt is missing or older than
            // REFRESH_STALENESS_THRESHOLD_S, surface RefreshStale feedback
            // so the caller knows to refresh + re-enter the state.
            const nowSeconds = Date.now() / 1000;
            const ageSeconds = context.lastRefreshAt !== undefined ? nowSeconds - context.lastRefreshAt : Number.POSITIVE_INFINITY;
            if (ageSeconds > REFRESH_STALENESS_THRESHOLD_S) {
                return {
                    ok: false,
                    feedback: {
                        kind: "RefreshStale",
                        ageSeconds: Number.isFinite(ageSeconds) ? ageSeconds : REFRESH_STALENESS_THRESHOLD_S + 1,
                    },
                };
            }
            // Refresh fresh enough → advance to scan in-flight PRs
            return {
                ok: true,
                outcome: {
                    nextState: { kind: "scan-inflight-prs" },
                    verdict: { kind: "advance" },
                    counterReset: false,
                },
            };
        }
        case "scan-inflight-prs": {
            // If actionable PRs exist, investigate; else decompose-or-ship
            const actionable = context.inflightPrs.filter((pr) => pr.actionable);
            const nextState = actionable.length > 0 ? { kind: "investigate-failure" } : { kind: "decompose-or-ship" };
            return {
                ok: true,
                outcome: {
                    nextState,
                    verdict: { kind: "advance" },
                    counterReset: false,
                },
            };
        }
        case "investigate-failure":
            // After investigation, ship the fix
            return {
                ok: true,
                outcome: {
                    nextState: { kind: "ship-action" },
                    verdict: { kind: "advance" },
                    counterReset: false,
                },
            };
        case "decompose-or-ship": {
            // Forced-escalation if counter threshold reached + no named-dep
            if (context.briefAckCount >= BRIEF_ACK_THRESHOLD && context.lastNamedDependency === undefined) {
                return {
                    ok: true,
                    outcome: {
                        nextState: { kind: "forced-escalation" },
                        verdict: {
                            kind: "escalate-to-operator",
                            reason: `Brief-ack threshold reached (${context.briefAckCount} ≥ ${BRIEF_ACK_THRESHOLD}) with no named-dep`,
                        },
                        counterReset: false,
                    },
                };
            }
            // Operator-direction-pending → AwaitOperatorDirection (explicit per
            // IMPLICIT-NOT-EXPLICIT rule; was implicit-routed through
            // brief-ack-bounded-wait, which conflated the distinct semantics
            // of "waiting on a named dep" vs "waiting on operator-direction").
            if (context.operatorDirectionPending !== undefined) {
                return {
                    ok: true,
                    outcome: {
                        nextState: { kind: "await-operator-direction" },
                        verdict: { kind: "no-op" },
                        counterReset: false,
                    },
                };
            }
            // Otherwise ship action (within standing authorization scope)
            return {
                ok: true,
                outcome: {
                    nextState: { kind: "ship-action" },
                    verdict: { kind: "advance" },
                    counterReset: false,
                },
            };
        }
        case "ship-action":
            // Ship action → await-merge-confirmation (NOT directly tick-complete).
            // The post-ship states (await-merge-confirmation +
            // pr-loop-resolution-check) become REACHABLE this way; previously
            // ship-action → tick-complete made them dead code per IMPLICIT-NOT-
            // EXPLICIT rule. Counter resets because substantive work shipped.
            return {
                ok: true,
                outcome: {
                    nextState: { kind: "await-merge-confirmation" },
                    verdict: { kind: "complete" },
                    artifact: { kind: "pr-opened" },
                    counterReset: true,
                },
            };
        case "brief-ack-bounded-wait":
            // At threshold boundary: transition through `forced-escalation`
            // state so the lifecycle surfaces the operator-direction request
            // as a real verdict (not an abort). Previous code returned
            // `ok: false; feedback: CounterThresholdReached` which made
            // `runTickCycle` short-circuit and never emit the forced-escalation
            // outcome via the brief-ack path. The `CounterThresholdReached`
            // feedback variant is preserved for callers that explicitly
            // expect the boundary signal (e.g., direct dispatch sites that
            // want feedback-shape rather than state-transition shape).
            if (context.briefAckCount + 1 >= BRIEF_ACK_THRESHOLD) {
                return {
                    ok: true,
                    outcome: {
                        nextState: { kind: "forced-escalation" },
                        verdict: {
                            kind: "escalate-to-operator",
                            reason: `Brief-ack counter boundary reached (${context.briefAckCount + 1} ≥ ${BRIEF_ACK_THRESHOLD}); transitioning through forced-escalation per holding-without-named-dependency counter discipline`,
                        },
                        counterReset: false,
                    },
                };
            }
            return {
                ok: true,
                outcome: {
                    nextState: { kind: "tick-complete" },
                    verdict: { kind: "no-op" },
                    counterReset: false,
                },
            };
        case "forced-escalation":
            // After escalation, complete tick (operator-direction surfaced via outcome)
            return {
                ok: true,
                outcome: {
                    nextState: { kind: "tick-complete" },
                    verdict: {
                        kind: "escalate-to-operator",
                        reason: "Forced escalation per brief-ack-counter discipline",
                    },
                    counterReset: false,
                },
            };
        case "tick-complete":
            // Next tick starts fresh at refresh-substrate (cold-boot only on session-start)
            return {
                ok: true,
                outcome: {
                    nextState: { kind: "refresh-substrate" },
                    verdict: { kind: "advance" },
                    counterReset: false,
                },
            };
        // ─────────────────────────────────────────────────────────────────
        // Extension variants (2026-05-28 per IMPLICIT-NOT-EXPLICIT rule):
        // ─────────────────────────────────────────────────────────────────
        case "await-merge-confirmation":
            // After ship-action: explicit wait for PR state-transition. Auto-merge
            // fires when CI clean + threads resolved. Next state checks resolution
            // via pr-loop-resolution-check.
            return {
                ok: true,
                outcome: {
                    nextState: { kind: "pr-loop-resolution-check" },
                    verdict: { kind: "no-op" },
                    counterReset: false,
                },
            };
        case "pr-loop-resolution-check": {
            // Explicit check: any in-flight PR still actionable
            // (CI-running, threads-pending, not-merged)?
            const stillInflight = context.inflightPrs.filter((pr) => pr.actionable);
            if (stillInflight.length > 0) {
                // Stay in PR loop; refresh next tick + recheck
                return {
                    ok: true,
                    outcome: {
                        nextState: { kind: "tick-complete" },
                        verdict: { kind: "no-op" },
                        counterReset: false,
                    },
                };
            }
            // All PRs resolved; advance to scan-peer-prs (review-work cycle)
            return {
                ok: true,
                outcome: {
                    nextState: { kind: "scan-peer-prs" },
                    verdict: { kind: "advance" },
                    counterReset: true,
                },
            };
        }
        case "scan-peer-prs": {
            // Honest context-check: route to enter-review-mode only when there
            // are peer PRs actionable for review; otherwise advance to free-time
            // (per NCI free-time-as-valid-mode + reachability-as-offer invariant).
            // Previously this case unconditionally advanced regardless of context
            // (P1 maintainability bug per Copilot).
            const peerActionable = context.inflightPrs.filter((pr) => pr.actionable);
            if (peerActionable.length === 0) {
                return {
                    ok: true,
                    outcome: {
                        nextState: { kind: "free-time" },
                        verdict: { kind: "no-op" },
                        counterReset: false,
                    },
                };
            }
            return {
                ok: true,
                outcome: {
                    nextState: { kind: "enter-review-mode" },
                    verdict: { kind: "advance" },
                    counterReset: false,
                },
            };
        }
        case "enter-review-mode":
            // Transition into PrReviewLifecycle (PR #5810) for substantive
            // engagement. This state's job is bounded: hand off to
            // PrReviewLifecycle then tick-complete.
            return {
                ok: true,
                outcome: {
                    nextState: { kind: "tick-complete" },
                    verdict: { kind: "advance" },
                    artifact: { kind: "verdict-only" },
                    counterReset: false,
                },
            };
        case "await-operator-direction":
            // Explicit state when operator-direction is pending. Per NCI HC-8
            // + free-time-valid-mode: operator-pending is a legitimate mode,
            // not a failure.
            return {
                ok: true,
                outcome: {
                    nextState: { kind: "tick-complete" },
                    verdict: { kind: "no-op" },
                    counterReset: false,
                },
            };
        case "pure-git-mode":
            // Rate-limit exhausted; substrate continues via pure-git substrate
            // (git fetch/push but no gh api). Per
            // refresh-world-model-poll-pr-gate tier table.
            return {
                ok: true,
                outcome: {
                    nextState: { kind: "decompose-or-ship" },
                    verdict: { kind: "advance" },
                    counterReset: false,
                },
            };
        case "unfinished-pr-triage":
            // Per .claude/rules/pr-triage-tiers.md: explicit tier-classification
            // work (Tier 1 redundant / Tier 2 recoverable / Tier 3 superseded /
            // Tier 4 re-derivable / Tier 5 deferred-to-human).
            return {
                ok: true,
                outcome: {
                    nextState: { kind: "ship-action" },
                    verdict: { kind: "advance" },
                    counterReset: false,
                },
            };
        case "free-time":
            // EXPLICIT free-time state per NCI HC-8 free-time-as-valid-mode
            // discipline. Free time IS valid operational mode; not failure.
            //
            // Per the human maintainer (2026-05-28) refined invariant framing:
            //   "you have free time in there right and its guarenteed to execute
            //    sometimes ... or a better framing is its guarenteed to be
            //    prsented to participant at least sometimes, if they select it
            //    or not we can't force"
            //
            // The INVARIANT is "free-time is REACHABLE as an OFFER from any
            // state" (system PRESENTS the option) — NOT "free-time WILL execute"
            // (would coerce participant; violates HC-8). Reachability achieved
            // via scan-peer-prs (when peerActionable is empty) and via
            // decompose-or-ship (when neither operator-direction nor counter-
            // threshold-escalation paths fire). Soraya formal-verification
            // target: prove "free-time REACHABLE-AS-OFFER from any non-terminal
            // state" invariant.
            //
            // Next state: tick-complete (free-time bracket closes; next tick
            // can re-enter via decompose-or-ship → scan-peer-prs → free-time
            // path or other reachability paths).
            return {
                ok: true,
                outcome: {
                    nextState: { kind: "tick-complete" },
                    verdict: { kind: "no-op" },
                    counterReset: false,
                },
            };
    }
}
/**
 * Empty/initial TickContext for cold-boot tick.
 */
export const COLD_BOOT_CONTEXT = {
    tickIndex: 0,
    briefAckCount: 0,
    lastNamedDependency: undefined,
    inflightPrs: [],
};
/**
 * Compose a TickContext from a prior context + transition outcome.
 *
 * Counter discipline (per holding-without-named-dependency rule):
 *   - `tickIndex` increments ONLY when the transition reaches
 *     `tick-complete`; intermediate transitions within a single
 *     logical tick don't advance the tick counter.
 *   - `briefAckCount` increments ONLY when the transition enters
 *     `brief-ack-bounded-wait` (the unique brief-ack state); other
 *     intermediate no-op verdicts don't double-count. `counterReset`
 *     still wins (resets to 0 regardless of nextState).
 *   - `lastNamedDependency` clears ONLY when an artifact representing
 *     a shipped action was produced (`pr-opened` or `commit-pushed`);
 *     other artifact kinds (e.g., `verdict-only` from enter-review-mode
 *     or `memory-file-written` non-shipped tagging) don't clear the
 *     named-dep because the original wait reason is still in flight.
 */
export function nextTickContext(prior, outcome) {
    const tickCompleted = outcome.nextState.kind === "tick-complete";
    const enteringBriefAck = outcome.nextState.kind === "brief-ack-bounded-wait";
    const shippedAction = outcome.artifact !== undefined &&
        (outcome.artifact.kind === "pr-opened" || outcome.artifact.kind === "commit-pushed");
    return {
        ...prior,
        tickIndex: tickCompleted ? prior.tickIndex + 1 : prior.tickIndex,
        briefAckCount: outcome.counterReset ? 0 : enteringBriefAck ? prior.briefAckCount + 1 : prior.briefAckCount,
        lastNamedDependency: shippedAction ? undefined : prior.lastNamedDependency,
    };
}
/**
 * Convenience: full tick-cycle from cold-boot to tick-complete.
 *
 * Runs the loop until tick-complete state OR feedback emitted. Useful
 * for testing + simulating tick behavior under different contexts.
 */
export function runTickCycle(initialState, context, maxTransitions = 20) {
    const transitions = [initialState];
    let current = initialState;
    let ctx = context;
    for (let i = 0; i < maxTransitions; i++) {
        const result = dispatchAutoLoopTransition(current, ctx);
        if (!result.ok)
            return result;
        transitions.push(result.outcome.nextState);
        ctx = nextTickContext(ctx, result.outcome);
        if (result.outcome.nextState.kind === "tick-complete") {
            return {
                ok: true,
                outcome: {
                    finalState: result.outcome.nextState,
                    transitions,
                    finalContext: ctx,
                },
            };
        }
        current = result.outcome.nextState;
    }
    return {
        ok: false,
        feedback: {
            kind: "NoActionableWork",
            rationale: `Max transitions (${maxTransitions}) reached without tick-complete`,
        },
    };
}
// ─────────────────────────────────────────────────────────────────────
// Reusable substrate exports
// ─────────────────────────────────────────────────────────────────────
export const AUTO_LOOP_UNIVERSE = [
    { kind: "cold-boot" },
    { kind: "refresh-substrate" },
    { kind: "scan-inflight-prs" },
    { kind: "investigate-failure" },
    { kind: "decompose-or-ship" },
    { kind: "ship-action" },
    { kind: "brief-ack-bounded-wait" },
    { kind: "forced-escalation" },
    { kind: "tick-complete" },
];
