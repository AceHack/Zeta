/**
 * WorkBatch / Mission Run — a durable grouping of related work items
 * (WORK_AND_RELEASE_MANAGEMENT_OS §Work Batch). The batch is the unit a
 * Lead/Director prioritizes over and the object that carries the rolled-up
 * metrics (completion %, defect counts, QA bounce-backs — computed in W2 by a
 * pure fold over the batch's member work items + test runs + org_events).
 *
 * Batches link to work items; they never embed them — so the fold reads the
 * members rather than a denormalized copy.
 *
 *   created → scoped → capacity_planned → scheduled → active
 *   active ⇄ partially_blocked → completion_check → done
 */

export const WorkBatchState = {
  Created: "created",
  Scoped: "scoped",
  CapacityPlanned: "capacity_planned",
  Scheduled: "scheduled",
  Active: "active",
  PartiallyBlocked: "partially_blocked",
  CompletionCheck: "completion_check",
  Done: "done",
} as const;
export type WorkBatchState = (typeof WorkBatchState)[keyof typeof WorkBatchState];

export const TerminalWorkBatchStates: ReadonlySet<WorkBatchState> = new Set([WorkBatchState.Done]);

export type WorkBatch = {
  batchId: string;
  organizationId: string;
  /** the scope this batch belongs to: an initiative, a department push, a release */
  scopeKind: "initiative" | "release" | "incident" | "department";
  scopeId: string;
  /** the department/lead that owns prioritization of this batch (W2 authority scope) */
  ownerHatId: string;
  state: WorkBatchState;
  capacityPlannedHats: number; // how many hats the batch reserved (RMO)
  createdAt: string;
  updatedAt: string;
};

const allowed = new Map<WorkBatchState, ReadonlySet<WorkBatchState>>([
  [WorkBatchState.Created, new Set([WorkBatchState.Scoped])],
  [WorkBatchState.Scoped, new Set([WorkBatchState.CapacityPlanned])],
  [WorkBatchState.CapacityPlanned, new Set([WorkBatchState.Scheduled])],
  [WorkBatchState.Scheduled, new Set([WorkBatchState.Active])],
  [WorkBatchState.Active, new Set([WorkBatchState.PartiallyBlocked, WorkBatchState.CompletionCheck])],
  [WorkBatchState.PartiallyBlocked, new Set([WorkBatchState.Active, WorkBatchState.CompletionCheck])],
  [WorkBatchState.CompletionCheck, new Set([WorkBatchState.Active, WorkBatchState.Done])],
]);

export function legalNextBatchStates(from: WorkBatchState): readonly WorkBatchState[] {
  return [...(allowed.get(from) ?? new Set<WorkBatchState>())];
}

export function isTerminalWorkBatch(state: WorkBatchState): boolean {
  return TerminalWorkBatchStates.has(state);
}

export function assertWorkBatchTransition(from: WorkBatchState, to: WorkBatchState): void {
  if (!allowed.get(from)?.has(to)) {
    throw new Error(`illegal work batch transition from ${from} to ${to}`);
  }
}
