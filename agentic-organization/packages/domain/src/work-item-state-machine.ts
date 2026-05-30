export const WorkItemState = {
  Created: "created",
  Intake: "intake",
  Triage: "triage",
  Ready: "ready",
  InProgress: "in_progress",
  Blocked: "blocked",
  Review: "review",
  Done: "done",
} as const;

export type WorkItemState = (typeof WorkItemState)[keyof typeof WorkItemState];

export const WorkItemType = {
  // The shared enum stays small (WORK_AND_RELEASE_MANAGEMENT_OS: "promote a state
  // only once stable"); the FULL set of types is first-class so each can carry a
  // type-specific workflow policy (see work-item.ts) without growing the shared
  // WorkItemState enum.
  Goal: "goal",
  Report: "report",
  ServiceRequest: "service_request",
  Task: "task",
  Defect: "defect",
  CapabilityRequest: "capability_request",
  Review: "review",
  Incident: "incident",
  Release: "release",
} as const;

export type WorkItemType = (typeof WorkItemType)[keyof typeof WorkItemType];

/** Where a work item entered the system from (G3 — work flows in from outside). */
export const WorkItemSource = {
  Internal: "internal",
  External: "external",
} as const;
export type WorkItemSource = (typeof WorkItemSource)[keyof typeof WorkItemSource];

/** Defect/incident severity (drives prioritization weight + QA routing). */
export const WorkItemSeverity = {
  Sev1: "sev1",
  Sev2: "sev2",
  Sev3: "sev3",
  Sev4: "sev4",
} as const;
export type WorkItemSeverity = (typeof WorkItemSeverity)[keyof typeof WorkItemSeverity];

export type WorkItemTransitionContext = {
  workItemType?: WorkItemType | undefined;
  hasTriageFields?: boolean | undefined;
  hasRequiredEvidence?: boolean | undefined;
  assignedEngineerHatAssignmentId?: string | undefined;
  scheduledWorkBlockId?: string | undefined;
};

const allowedTransitions = new Map<WorkItemState, ReadonlySet<WorkItemState>>([
  [WorkItemState.Created, new Set([WorkItemState.Intake])],
  [WorkItemState.Intake, new Set([WorkItemState.Triage])],
  [WorkItemState.Triage, new Set([WorkItemState.Ready])],
  [WorkItemState.Ready, new Set([WorkItemState.InProgress])],
  [WorkItemState.InProgress, new Set([WorkItemState.Blocked, WorkItemState.Review])],
  [WorkItemState.Blocked, new Set([WorkItemState.InProgress])],
  [WorkItemState.Review, new Set([WorkItemState.InProgress, WorkItemState.Done])],
]);

export function createInitialWorkItemState(): WorkItemState {
  return WorkItemState.Created;
}

/** The base (shared) legal next states from a given state, before type-specific policy (work-item.ts). */
export function baseLegalNextStates(fromState: WorkItemState): readonly WorkItemState[] {
  return [...(allowedTransitions.get(fromState) ?? new Set<WorkItemState>())];
}

export function assertInitialWorkItemState(workItemType: WorkItemType, initialState: WorkItemState): void {
  if (workItemType === WorkItemType.Defect && initialState !== WorkItemState.Created) {
    throw new Error("defect work items must start in created");
  }
}

export function assertWorkItemTransition(
  fromState: WorkItemState,
  toState: WorkItemState,
  context: WorkItemTransitionContext = {},
): void {
  if (!allowedTransitions.get(fromState)?.has(toState)) {
    throw new Error(`illegal work item transition from ${fromState} to ${toState}`);
  }

  assertDefectTransitionRequirements(fromState, toState, context);
}

function assertDefectTransitionRequirements(
  fromState: WorkItemState,
  toState: WorkItemState,
  context: WorkItemTransitionContext,
): void {
  if (context.workItemType !== WorkItemType.Defect) {
    return;
  }

  if (fromState === WorkItemState.Triage && toState === WorkItemState.Ready) {
    if (context.hasTriageFields !== true) {
      throw new Error("defect ready transition requires triage fields");
    }

    if (context.hasRequiredEvidence !== true) {
      throw new Error("defect ready transition requires evidence");
    }
  }

  if (fromState === WorkItemState.Ready && toState === WorkItemState.InProgress) {
    if (isBlank(context.assignedEngineerHatAssignmentId)) {
      throw new Error("defect in_progress transition requires assigned engineer");
    }

    if (isBlank(context.scheduledWorkBlockId)) {
      throw new Error("defect in_progress transition requires scheduled work block");
    }
  }
}

function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim().length === 0;
}
