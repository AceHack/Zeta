/**
 * Change-control reconciliation (CC4) — the ChangeSet phase reconciles INTO the one
 * authoritative WorkItemState mapping (STATE_RECONCILIATION), never a parallel
 * model, and maps OUT to each external system's coarse states. The external systems
 * see `In Progress → In Review → Done`; the org runs the fine-grained pipeline
 * between those hops — that gap is the product.
 */

import { ChangeSetPhase, ExternalSystem, WorkItemState } from "../../domain/src/index.ts";

/** ChangeSet phase → the canonical WorkItemState (reconciles into STATE_RECONCILIATION). */
export function workItemStateForChangeSet(phase: ChangeSetPhase): WorkItemState {
  switch (phase) {
    case ChangeSetPhase.Drafted:
      return WorkItemState.InProgress;
    case ChangeSetPhase.InReview:
    case ChangeSetPhase.Approved:
      return WorkItemState.Review;
    case ChangeSetPhase.ChangesRequested:
      return WorkItemState.InProgress; // bounced back to the proposer
    case ChangeSetPhase.Applied:
      return WorkItemState.Done;
    case ChangeSetPhase.Rejected:
    case ChangeSetPhase.Withdrawn:
      return WorkItemState.Blocked; // did not ship through this change set
    default:
      return WorkItemState.Review;
  }
}

/** ChangeSet phase → the coarse external state a given system would show. */
export function externalStateForChangeSet(system: ExternalSystem, phase: ChangeSetPhase): string {
  const merged = phase === ChangeSetPhase.Applied;
  const changes = phase === ChangeSetPhase.ChangesRequested;
  switch (system) {
    case ExternalSystem.GitHub:
    case ExternalSystem.GitLab:
      return merged ? "merged" : changes ? "changes_requested" : phase === ChangeSetPhase.Approved ? "approved" : "open";
    case ExternalSystem.Jira:
      return merged ? "Done" : changes ? "In Progress" : "In Review";
    default:
      return "internal";
  }
}
