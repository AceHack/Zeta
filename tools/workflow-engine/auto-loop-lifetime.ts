// tools/workflow-engine/auto-loop-lifetime.ts
//
// AutoLoopLifetime — substrate-naming substrate-engineering substrate
// for Otto-CLI's foreground autonomous-loop tick-handler. Per the human maintainer
// 2026-05-28: "when do you want to update your foreground loop to start
// running on lifecycles and test out our first ones?"
//
// Dogfood discipline: the workflow-engine substrate shipped today
// (B-0867.5 PoC + B-0867.20 ReviewLifetime + B-0914.* + GitWorld +
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

import {
  type LifetimeState,
  type StandardVerdict,
} from "./world";

// ─────────────────────────────────────────────────────────────────────
// AutoLoopLifetime — the loop's state machine
// ─────────────────────────────────────────────────────────────────────

/**
 * AutoLoopLifetime — substrate-naming substrate for Otto-CLI foreground
 * loop's tick-handler state machine.
 *
 * Captures the existing-but-implicit states the handler cycles through
 * on each tick. Substrate-engineering substrate-naming substrate makes
 * the state machine observable + dispatch-table-driven.
 */
export interface AutoLoopLifetime extends LifetimeState {
  readonly kind:
    | "cold-boot"               // session-start; cron-list + sentinel arm check
    | "refresh-substrate"       // git fetch + PR state check (per refresh-before-decide invariant)
    | "scan-inflight-prs"       // identify Otto-PRs with actionable issues
    | "investigate-failure"     // pull failing job log; classify as flake/real-issue/pre-existing
    | "decompose-or-ship"       // pick from backlog OR substrate-engineering work (per never-be-idle + dont-ask-permission)
    | "ship-action"             // commit + push + PR open + arm auto-merge
    | "brief-ack-bounded-wait"  // named-dep wait per counter discipline
    | "forced-escalation"       // at N=6 brief-acks per counter-with-escalation
    | "tick-complete";          // bracket-closure; ready for next tick
}

// ─────────────────────────────────────────────────────────────────────
// Tick context + outcome substrate
// ─────────────────────────────────────────────────────────────────────

/**
 * TickContext — substrate the loop carries across state transitions.
 *
 * Holds counter state (brief-ack count + last named-dep), refresh
 * timestamp, PR snapshot, and operator-direction status.
 */
export interface TickContext {
  readonly tickIndex: number;                   // monotonic per-session
  readonly briefAckCount: number;               // counter discipline tracking
  readonly lastNamedDependency?: string;        // bounded-wait reason (or undefined)
  readonly lastRefreshAt?: number;              // unix timestamp of last substrate refresh
  readonly inflightPrs: ReadonlyArray<{
    readonly number: number;
    readonly state: string;
    readonly actionable: boolean;
  }>;
  readonly operatorDirectionPending?: string;   // pending question to operator (or undefined)
}

/**
 * TickOutcome — what the loop produced this tick.
 *
 * Composes with StandardVerdict from world.ts for routing to next state.
 */
export interface TickOutcome {
  readonly nextState: AutoLoopLifetime;
  readonly verdict: StandardVerdict;
  readonly artifact?: {
    readonly kind: "pr-opened" | "commit-pushed" | "memory-file-written" | "verdict-only";
    readonly ref?: string;                       // PR number, commit SHA, etc.
  };
  readonly counterReset: boolean;                // did this tick reset the brief-ack counter?
}

// ─────────────────────────────────────────────────────────────────────
// AutoLoopFeedback — asymmetric-authorship per rule
// ─────────────────────────────────────────────────────────────────────

export type AutoLoopFeedback =
  | { kind: "SentinelMissing" }                 // cron-list returned empty; needs re-arm
  | { kind: "RefreshStale"; ageSeconds: number } // refresh-before-decide invariant violation
  | { kind: "CounterThresholdReached"; briefAcks: number }
  | { kind: "OperatorDirectionPending"; question: string }
  | { kind: "RateLimitExhausted"; budget: "rest" | "graphql"; resetAt: number }
  | { kind: "PeerAgentTerritory"; prNumber: number; lane: string }
  | { kind: "NoActionableWork"; rationale: string };

export type AutoLoopResult<T> =
  | { ok: true; outcome: T }
  | { ok: false; feedback: AutoLoopFeedback };

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
export function dispatchAutoLoopTransition(
  current: AutoLoopLifetime,
  context: TickContext,
): AutoLoopResult<TickOutcome> {
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
      const ageSeconds = context.lastRefreshAt !== undefined
        ? nowSeconds - context.lastRefreshAt
        : Number.POSITIVE_INFINITY;
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
      const nextState: AutoLoopLifetime = actionable.length > 0
        ? { kind: "investigate-failure" }
        : { kind: "decompose-or-ship" };
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
      if (
        context.briefAckCount >= BRIEF_ACK_THRESHOLD &&
        context.lastNamedDependency === undefined
      ) {
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
      // Operator-direction-pending → BriefAckBoundedWait
      if (context.operatorDirectionPending !== undefined) {
        return {
          ok: true,
          outcome: {
            nextState: { kind: "brief-ack-bounded-wait" },
            verdict: {
              kind: "no-op",
            },
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
      // Ship action → tick complete; counter reset
      return {
        ok: true,
        outcome: {
          nextState: { kind: "tick-complete" },
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
  }
}

/**
 * Empty/initial TickContext for cold-boot tick.
 */
export const COLD_BOOT_CONTEXT: TickContext = {
  tickIndex: 0,
  briefAckCount: 0,
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
 *     intermediate no-op verdicts (e.g., the no-op produced when
 *     decompose-or-ship transitions into brief-ack-bounded-wait on
 *     operator-direction-pending) don't double-count. `counterReset`
 *     still wins (resets to 0 regardless of nextState).
 *   - `lastNamedDependency` clears if an artifact was produced
 *     (action shipped → previous named-dep is moot).
 */
export function nextTickContext(
  prior: TickContext,
  outcome: TickOutcome,
): TickContext {
  const tickCompleted = outcome.nextState.kind === "tick-complete";
  const enteringBriefAck = outcome.nextState.kind === "brief-ack-bounded-wait";
  return {
    ...prior,
    tickIndex: tickCompleted ? prior.tickIndex + 1 : prior.tickIndex,
    briefAckCount: outcome.counterReset
      ? 0
      : (enteringBriefAck ? prior.briefAckCount + 1 : prior.briefAckCount),
    lastNamedDependency: outcome.artifact !== undefined ? undefined : prior.lastNamedDependency,
  };
}

/**
 * Convenience: full tick-cycle from cold-boot to tick-complete.
 *
 * Runs the loop until tick-complete state OR feedback emitted. Useful
 * for testing + simulating tick behavior under different contexts.
 */
export function runTickCycle(
  initialState: AutoLoopLifetime,
  context: TickContext,
  maxTransitions: number = 20,
): AutoLoopResult<{
  readonly finalState: AutoLoopLifetime;
  readonly transitions: ReadonlyArray<AutoLoopLifetime>;
  readonly finalContext: TickContext;
}> {
  const transitions: AutoLoopLifetime[] = [initialState];
  let current = initialState;
  let ctx = context;
  for (let i = 0; i < maxTransitions; i++) {
    const result = dispatchAutoLoopTransition(current, ctx);
    if (!result.ok) return result;
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

export const AUTO_LOOP_UNIVERSE: ReadonlyArray<AutoLoopLifetime> = [
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
