/**
 * Load work-item DORA metrics from the on-disk event G-Set (081KSXN slice 3 → dashboard).
 */
import { existsSync } from "node:fs";
import { workItemEventsRoot } from "../backlog/new-workitem";
import { computeDoraMetrics, type WorkItemDoraMetrics } from "../work-items/dora-fold";
import { readEventsFromRoot } from "../work-items/read-events";

/** Returns null when no event log exists or it is empty. */
export function loadWorkItemDoraMetrics(workItemsDir = "workitems"): WorkItemDoraMetrics | null {
  const eventsRoot = workItemEventsRoot(workItemsDir);
  if (!existsSync(eventsRoot)) return null;
  const events = readEventsFromRoot(eventsRoot);
  if (events.length === 0) return null;
  return computeDoraMetrics(events);
}
