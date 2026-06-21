// src/Core.TypeScript/workflow-engine/agent-loop/work-lifecycle-state-machine.ts
//
// 081KSKBP80008QG0R000B3Y19A.5+ extension: work-lifecycle state machine — backlog row →
// claim → PR → review (possibly cycle review-push N times) → merge.
//
// Operator framing 2026-05-28:
//   "And can we model backlog -> claim -> pr -> review -> myabe cycle
//    push review a few times -> merge too with this?"
//
// Answer: yes. Same F# DU implicit state machine pattern as agent-loop
// state-machine.ts, but operating at WORK-LIFECYCLE scope instead of
// AGENT-CYCLE scope. The two state machines compose:
//
//   - agent-loop's PickWork action transitions a Backlog work-item to
//     Claimed (work-lifecycle transition)
//   - agent-loop's ExecutingWork state IS the work-lifecycle's
//     InProgress state for the picked item
//   - agent-loop's EmittingResult action transitions work to next
//     lifecycle state based on result (PrOpen if commit shipped;
//     Abandoned if work didn't ship)
//
// The cycle-push-review-a-few-times pattern is the InReview ↔
// RevisionRequested ↔ RevisionPushed loop. Can iterate N times before
// Approval.
//
// Composes with:
//   - state-machine.ts (agent-loop) — agent-decisions level
//   - src/Core.TypeScript/bus/claim.ts (existing) — claim acquisition substrate
//   - tools/github/poll-pr-gate.ts (existing) — PR state inspection
//   - 081KSKBP80008QG0R000B3Y19A + 081KSKBP80008QG0R000B3Y19A.5 (workflow engine v1 substrate)
//   - .claude/rules/claim-acquire-before-worktree-work.md (claim discipline)
//   - .claude/rules/blocked-green-ci-investigate-threads.md (revision-request handling)

import type { AgentPersona } from "./state-machine";

// ─── Work-item identity + metadata ───────────────────────────────────

export interface BacklogRow {
  readonly id: string; // "081KSKBP80008QG0R000B3Y19A.5"
  readonly title: string;
  readonly priority: "P0" | "P1" | "P2" | "P3";
  readonly filePath: string; // "docs/backlog/P1/081KSKBP80008QG0R000B3Y19A.5-..."
  readonly trajectory: string; // composes with 081KSKBP80008QG0R000B3Y19A trajectory taxonomy
}

// ─── Work-lifecycle state (F# DU) ────────────────────────────────────

/**
 * WorkLifecycleState — where a single work-item is in its progression
 * from filed-backlog to merged-on-main.
 *
 * F# DU equivalent:
 *
 *   type WorkLifecycleState =
 *     | Backlog of row: BacklogRow
 *     | Claimed of row: BacklogRow * claimedBy: AgentPersona * claimAt: string
 *     | InProgress of row: BacklogRow * claimedBy: AgentPersona * branchRef: string
 *     | PrOpen of row: BacklogRow * prNumber: int * openedBy: AgentPersona * openedAt: string
 *     | InReview of row: BacklogRow * prNumber: int * reviewers: string list * threadCount: int
 *     | RevisionRequested of row: BacklogRow * prNumber: int * revisionCount: int * threadIds: string list
 *     | RevisionPushed of row: BacklogRow * prNumber: int * revisionCount: int * lastPushSha: string
 *     | Approved of row: BacklogRow * prNumber: int * approvedAt: string
 *     | Merged of row: BacklogRow * prNumber: int * mergeCommit: string * mergedAt: string
 *     | Closed of row: BacklogRow * prNumber: int * closedAt: string * reason: string
 *     | Abandoned of row: BacklogRow * reason: string
 */
export type WorkLifecycleState =
  | { readonly tag: "Backlog"; readonly row: BacklogRow }
  | {
      readonly tag: "Claimed";
      readonly row: BacklogRow;
      readonly claimedBy: AgentPersona;
      readonly claimAt: string;
    }
  | {
      readonly tag: "InProgress";
      readonly row: BacklogRow;
      readonly claimedBy: AgentPersona;
      readonly branchRef: string;
    }
  | {
      readonly tag: "PrOpen";
      readonly row: BacklogRow;
      readonly prNumber: number;
      readonly openedBy: AgentPersona;
      readonly openedAt: string;
    }
  | {
      readonly tag: "InReview";
      readonly row: BacklogRow;
      readonly prNumber: number;
      readonly reviewers: readonly string[];
      readonly threadCount: number;
    }
  | {
      readonly tag: "RevisionRequested";
      readonly row: BacklogRow;
      readonly prNumber: number;
      readonly revisionCount: number; // increments on each revision cycle
      readonly threadIds: readonly string[];
    }
  | {
      readonly tag: "RevisionPushed";
      readonly row: BacklogRow;
      readonly prNumber: number;
      readonly revisionCount: number;
      readonly lastPushSha: string;
    }
  | {
      readonly tag: "Approved";
      readonly row: BacklogRow;
      readonly prNumber: number;
      readonly approvedAt: string;
    }
  | {
      readonly tag: "Merged";
      readonly row: BacklogRow;
      readonly prNumber: number;
      readonly mergeCommit: string;
      readonly mergedAt: string;
    }
  | {
      readonly tag: "Closed";
      readonly row: BacklogRow;
      readonly prNumber: number;
      readonly closedAt: string;
      readonly reason: string;
    }
  | {
      readonly tag: "Abandoned";
      readonly row: BacklogRow;
      readonly reason: string;
    };

// ─── Transition events ───────────────────────────────────────────────

/**
 * WorkLifecycleTransition — events that move a work-item between
 * lifecycle states. Each transition has an authoritative source
 * (claim coordinator / GitHub API / operator action / agent action);
 * the transition function is defensive about which transitions are
 * legal from which states.
 *
 * F# DU equivalent:
 *
 *   type WorkLifecycleTransition =
 *     | Claim of agent: AgentPersona * timestamp: string
 *     | StartWork of branchRef: string
 *     | OpenPr of prNumber: int * openedBy: AgentPersona * openedAt: string
 *     | RequestReview of reviewers: string list
 *     | ReceiveRevisionRequest of threadIds: string list
 *     | PushRevision of sha: string
 *     | ResolveAllThreads
 *     | Approve of approvedAt: string
 *     | Merge of mergeCommit: string * mergedAt: string
 *     | Close of closedAt: string * reason: string
 *     | Abandon of reason: string
 */
export type WorkLifecycleTransition =
  | {
      readonly tag: "Claim";
      readonly agent: AgentPersona;
      readonly timestamp: string;
    }
  | { readonly tag: "StartWork"; readonly branchRef: string }
  | {
      readonly tag: "OpenPr";
      readonly prNumber: number;
      readonly openedBy: AgentPersona;
      readonly openedAt: string;
    }
  | { readonly tag: "RequestReview"; readonly reviewers: readonly string[] }
  | {
      readonly tag: "ReceiveRevisionRequest";
      readonly threadIds: readonly string[];
    }
  | { readonly tag: "PushRevision"; readonly sha: string }
  | { readonly tag: "ResolveAllThreads" }
  | { readonly tag: "Approve"; readonly approvedAt: string }
  | {
      readonly tag: "Merge";
      readonly mergeCommit: string;
      readonly mergedAt: string;
    }
  | {
      readonly tag: "Close";
      readonly closedAt: string;
      readonly reason: string;
    }
  | { readonly tag: "Abandon"; readonly reason: string };

// ─── Transition function ─────────────────────────────────────────────

/**
 * Result type for the transition function. Encodes that transitions
 * can succeed (returning new state) or fail (returning the original
 * state + a reason why the transition was illegal from current state).
 *
 * Substrate-honest: invalid transitions are returned as failures
 * (not exceptions) so the caller can decide whether to retry, escalate,
 * or log + continue. Composes with non-coercion-invariant + asymmetric-
 * critic-with-clarity-first disciplines.
 */
export type TransitionResult =
  | { readonly ok: true; readonly state: WorkLifecycleState }
  | {
      readonly ok: false;
      readonly state: WorkLifecycleState;
      readonly reason: string;
    };

type StateWithTag<Tag extends WorkLifecycleState["tag"]> = Extract<WorkLifecycleState, { readonly tag: Tag }>;

function ok(state: WorkLifecycleState): TransitionResult {
  return { ok: true, state };
}

function abandon(row: BacklogRow, reason: string): TransitionResult {
  return ok({ tag: "Abandoned", row, reason });
}

function close(
  row: BacklogRow,
  prNumber: number,
  event: { readonly closedAt: string; readonly reason: string },
): TransitionResult {
  return ok({
    tag: "Closed",
    row,
    prNumber,
    closedAt: event.closedAt,
    reason: event.reason,
  });
}

function approve(row: BacklogRow, prNumber: number, approvedAt: string): TransitionResult {
  return ok({ tag: "Approved", row, prNumber, approvedAt });
}

function illegalTransition(state: WorkLifecycleState, event: WorkLifecycleTransition): TransitionResult {
  return {
    ok: false,
    state,
    reason: `illegal transition: ${state.tag} cannot accept ${event.tag}`,
  };
}

function terminalTransition(state: WorkLifecycleState, event: WorkLifecycleTransition): TransitionResult {
  return {
    ok: false,
    state,
    reason: `terminal state ${state.tag} cannot transition via ${event.tag}`,
  };
}

function transitionBacklog(state: StateWithTag<"Backlog">, event: WorkLifecycleTransition): TransitionResult {
  switch (event.tag) {
    case "Claim":
      return ok({
        tag: "Claimed",
        row: state.row,
        claimedBy: event.agent,
        claimAt: event.timestamp,
      });
    case "Abandon":
      return abandon(state.row, event.reason);
    default:
      return illegalTransition(state, event);
  }
}

function transitionClaimed(state: StateWithTag<"Claimed">, event: WorkLifecycleTransition): TransitionResult {
  switch (event.tag) {
    case "StartWork":
      return ok({
        tag: "InProgress",
        row: state.row,
        claimedBy: state.claimedBy,
        branchRef: event.branchRef,
      });
    case "Abandon":
      return abandon(state.row, event.reason);
    default:
      return illegalTransition(state, event);
  }
}

function transitionInProgress(state: StateWithTag<"InProgress">, event: WorkLifecycleTransition): TransitionResult {
  switch (event.tag) {
    case "OpenPr":
      return ok({
        tag: "PrOpen",
        row: state.row,
        prNumber: event.prNumber,
        openedBy: event.openedBy,
        openedAt: event.openedAt,
      });
    case "Abandon":
      return abandon(state.row, event.reason);
    default:
      return illegalTransition(state, event);
  }
}

function transitionPrOpen(state: StateWithTag<"PrOpen">, event: WorkLifecycleTransition): TransitionResult {
  switch (event.tag) {
    case "RequestReview":
      return ok({
        tag: "InReview",
        row: state.row,
        prNumber: state.prNumber,
        reviewers: event.reviewers,
        threadCount: 0,
      });
    case "Close":
      return close(state.row, state.prNumber, event);
    default:
      return illegalTransition(state, event);
  }
}

function transitionInReview(state: StateWithTag<"InReview">, event: WorkLifecycleTransition): TransitionResult {
  switch (event.tag) {
    case "ReceiveRevisionRequest":
      return ok({
        tag: "RevisionRequested",
        row: state.row,
        prNumber: state.prNumber,
        revisionCount: state.threadCount === 0 ? 1 : state.threadCount + 1,
        threadIds: event.threadIds,
      });
    case "ResolveAllThreads":
      return approve(state.row, state.prNumber, new Date().toISOString());
    case "Approve":
      return approve(state.row, state.prNumber, event.approvedAt);
    case "Close":
      return close(state.row, state.prNumber, event);
    default:
      return illegalTransition(state, event);
  }
}

function transitionRevisionRequested(
  state: StateWithTag<"RevisionRequested">,
  event: WorkLifecycleTransition,
): TransitionResult {
  switch (event.tag) {
    case "PushRevision":
      return ok({
        tag: "RevisionPushed",
        row: state.row,
        prNumber: state.prNumber,
        revisionCount: state.revisionCount,
        lastPushSha: event.sha,
      });
    case "Close":
      return close(state.row, state.prNumber, event);
    default:
      return illegalTransition(state, event);
  }
}

function transitionRevisionPushed(
  state: StateWithTag<"RevisionPushed">,
  event: WorkLifecycleTransition,
): TransitionResult {
  switch (event.tag) {
    case "RequestReview":
      return ok({
        tag: "InReview",
        row: state.row,
        prNumber: state.prNumber,
        reviewers: event.reviewers,
        threadCount: state.revisionCount,
      });
    case "ResolveAllThreads":
      return approve(state.row, state.prNumber, new Date().toISOString());
    default:
      return illegalTransition(state, event);
  }
}

function transitionApproved(state: StateWithTag<"Approved">, event: WorkLifecycleTransition): TransitionResult {
  if (event.tag !== "Merge") {
    return illegalTransition(state, event);
  }

  return ok({
    tag: "Merged",
    row: state.row,
    prNumber: state.prNumber,
    mergeCommit: event.mergeCommit,
    mergedAt: event.mergedAt,
  });
}

/**
 * applyTransition — pure function: current state + transition event →
 * either new state (legal transition) or failure (illegal transition).
 *
 * Legal transition graph:
 *
 *   Backlog --Claim--> Claimed
 *   Claimed --StartWork--> InProgress
 *   InProgress --OpenPr--> PrOpen
 *   PrOpen --RequestReview--> InReview
 *   InReview --ReceiveRevisionRequest--> RevisionRequested
 *   RevisionRequested --PushRevision--> RevisionPushed
 *   RevisionPushed --RequestReview--> InReview  (the cycle-push loop)
 *   InReview --ResolveAllThreads--> Approved
 *   Approved --Merge--> Merged
 *   (most non-terminal states) --Close--> Closed
 *   (most non-terminal states) --Abandon--> Abandoned
 *
 * The cycle-push-review-a-few-times pattern is the InReview ↔
 * RevisionRequested ↔ RevisionPushed loop. revisionCount increments
 * on each PushRevision. Operator-substrate-honest: high revisionCount
 * is a signal that the work-item may need substrate-engineering
 * attention (decomposition; alternative approach; escalation).
 */
export function applyTransition(state: WorkLifecycleState, event: WorkLifecycleTransition): TransitionResult {
  switch (state.tag) {
    case "Backlog":
      return transitionBacklog(state, event);
    case "Claimed":
      return transitionClaimed(state, event);
    case "InProgress":
      return transitionInProgress(state, event);
    case "PrOpen":
      return transitionPrOpen(state, event);
    case "InReview":
      return transitionInReview(state, event);
    case "RevisionRequested":
      return transitionRevisionRequested(state, event);
    case "RevisionPushed":
      return transitionRevisionPushed(state, event);
    case "Approved":
      return transitionApproved(state, event);
    case "Merged":
    case "Closed":
    case "Abandoned":
      return terminalTransition(state, event);
  }
}

// ─── Lifecycle metrics ───────────────────────────────────────────────

/**
 * isTerminal — work-item has reached an end state (Merged / Closed /
 * Abandoned). Used by aggregators to filter active work from completed.
 */
export function isTerminal(state: WorkLifecycleState): boolean {
  return state.tag === "Merged" || state.tag === "Closed" || state.tag === "Abandoned";
}

/**
 * revisionCount — how many revision cycles a work-item has been
 * through. High values are operator-substrate-honest signals that the
 * work-item may need substrate-engineering attention.
 */
export function revisionCount(state: WorkLifecycleState): number {
  if (state.tag === "RevisionRequested" || state.tag === "RevisionPushed") {
    return state.revisionCount;
  }
  return 0;
}

/**
 * leadTimeSeconds — time from Claim → Merged (DORA lead-time metric).
 * Requires the state's history (not encoded in the state itself for
 * stateless storage simplicity; caller passes the claimAt timestamp).
 */
export function leadTimeSeconds(claimAtIso: string, mergedAtIso: string): number {
  return (new Date(mergedAtIso).getTime() - new Date(claimAtIso).getTime()) / 1000;
}
