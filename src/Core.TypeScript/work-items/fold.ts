/**
 * Fold work-item events → current projections (081KSXN940008QG0R002FWR9B2 slice 2).
 *
 * Open backlog = items whose folded state is `backlog` or `in-progress` (Z-set view
 * filter over the event G-Set; closure/closed removes from this view).
 */
import type { WorkItemEvent, WorkItemLifecycleState } from "./types";
import { stringCompare } from "../collation/collation";

export interface WorkItemProjection {
  readonly workItemId: string;
  readonly state: WorkItemLifecycleState;
  readonly lastEventAt: string;
}

export function eventOrder(a: WorkItemEvent, b: WorkItemEvent): number {
  const byAt = stringCompare(a.at, b.at);
  return byAt !== 0 ? byAt : stringCompare(a.id, b.id);
}

/** Deterministic fold: apply events in `(at, id)` order. */
export function foldWorkItemEvents(events: readonly WorkItemEvent[]): Map<string, WorkItemProjection> {
  const sorted = [...events].sort(eventOrder);
  const byId = new Map<string, WorkItemProjection>();

  for (const event of sorted) {
    if (event.kind === "created") {
      byId.set(event.payload.workItemId, {
        workItemId: event.payload.workItemId,
        state: "backlog",
        lastEventAt: event.at,
      });
      continue;
    }
    if (event.kind === "state-changed") {
      const prev = byId.get(event.payload.workItemId);
      byId.set(event.payload.workItemId, {
        workItemId: event.payload.workItemId,
        state: event.payload.to,
        lastEventAt: event.at,
      });
      if (!prev && event.payload.from === "backlog") {
        // tolerate state-changed without a prior created (imported items)
        continue;
      }
      continue;
    }
    if (event.kind === "closed") {
      byId.set(event.payload.workItemId, {
        workItemId: event.payload.workItemId,
        state: "closed",
        lastEventAt: event.at,
      });
    }
  }

  return byId;
}

const OPEN_STATES: ReadonlySet<WorkItemLifecycleState> = new Set(["backlog", "in-progress"]);

export function openWorkItems(projections: ReadonlyMap<string, WorkItemProjection>): WorkItemProjection[] {
  return [...projections.values()]
    .filter((p) => OPEN_STATES.has(p.state))
    .sort((a, b) => stringCompare(a.workItemId, b.workItemId));
}
