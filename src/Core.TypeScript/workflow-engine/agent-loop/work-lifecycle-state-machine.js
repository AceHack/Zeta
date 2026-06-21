// src/Core.TypeScript/workflow-engine/agent-loop/work-lifecycle-state-machine.ts
//
// B-0867.5+ extension: work-lifecycle state machine — backlog row →
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
//   - B-0867 + B-0867.5 (workflow engine v1 substrate)
//   - .claude/rules/claim-acquire-before-worktree-work.md (claim discipline)
//   - .claude/rules/blocked-green-ci-investigate-threads.md (revision-request handling)
function ok(state) {
    return { ok: true, state };
}
function abandon(row, reason) {
    return ok({ tag: "Abandoned", row, reason });
}
function close(row, prNumber, event) {
    return ok({
        tag: "Closed",
        row,
        prNumber,
        closedAt: event.closedAt,
        reason: event.reason,
    });
}
function approve(row, prNumber, approvedAt) {
    return ok({ tag: "Approved", row, prNumber, approvedAt });
}
function illegalTransition(state, event) {
    return {
        ok: false,
        state,
        reason: `illegal transition: ${state.tag} cannot accept ${event.tag}`,
    };
}
function terminalTransition(state, event) {
    return {
        ok: false,
        state,
        reason: `terminal state ${state.tag} cannot transition via ${event.tag}`,
    };
}
function transitionBacklog(state, event) {
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
function transitionClaimed(state, event) {
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
function transitionInProgress(state, event) {
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
function transitionPrOpen(state, event) {
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
function transitionInReview(state, event) {
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
function transitionRevisionRequested(state, event) {
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
function transitionRevisionPushed(state, event) {
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
function transitionApproved(state, event) {
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
export function applyTransition(state, event) {
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
export function isTerminal(state) {
    return state.tag === "Merged" || state.tag === "Closed" || state.tag === "Abandoned";
}
/**
 * revisionCount — how many revision cycles a work-item has been
 * through. High values are operator-substrate-honest signals that the
 * work-item may need substrate-engineering attention.
 */
export function revisionCount(state) {
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
export function leadTimeSeconds(claimAtIso, mergedAtIso) {
    return (new Date(mergedAtIso).getTime() - new Date(claimAtIso).getTime()) / 1000;
}
