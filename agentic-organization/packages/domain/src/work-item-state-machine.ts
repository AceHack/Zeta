export const WorkItemState = {
  New: "new",
  Triage: "triage",
  Ready: "ready",
  Approved: "approved",
} as const;

export type WorkItemState = (typeof WorkItemState)[keyof typeof WorkItemState];

const allowedTransitions = new Map<WorkItemState, ReadonlySet<WorkItemState>>([
  [WorkItemState.New, new Set([WorkItemState.Triage])],
  [WorkItemState.Triage, new Set([WorkItemState.Ready])],
  [WorkItemState.Ready, new Set([WorkItemState.Approved])],
]);

export function createInitialWorkItemState(): WorkItemState {
  return WorkItemState.New;
}

export function assertWorkItemTransition(fromState: WorkItemState, toState: WorkItemState): void {
  if (!allowedTransitions.get(fromState)?.has(toState)) {
    throw new Error(`illegal work item transition from ${fromState} to ${toState}`);
  }
}
