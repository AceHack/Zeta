/**
 * Publish work-item lifecycle events (081KSXN940008QG0R002FWR9B2 slice 2).
 */
import type { WorkItemEnv } from "../backlog/new-workitem";
import { writeEvent, maybeGitPushEvent, type WriteResult } from "./publish";
import {
  makeClosedEvent,
  makeStateChangedEvent,
  mintWorkItemEventIdHex,
  type WorkItemLifecycleState,
} from "./types";

function mintFromEnv(env: WorkItemEnv): (atMs: number) => string {
  return (ms) => mintWorkItemEventIdHex(env, ms);
}

export function publishStateChangedEvent(
  workItemId: string,
  from: WorkItemLifecycleState,
  to: WorkItemLifecycleState,
  env: WorkItemEnv,
  by: string,
  eventsRoot?: string,
  push = false,
): WriteResult {
  const atMs = env.nowMs();
  const event = makeStateChangedEvent({ workItemId, from, to }, by, atMs, mintFromEnv(env));
  const result = writeEvent(event, eventsRoot);
  maybeGitPushEvent(result, event, by, push);
  return result;
}

export function publishClosedEvent(
  workItemId: string,
  env: WorkItemEnv,
  by: string,
  eventsRoot?: string,
  reason?: string,
  push = false,
): WriteResult {
  const atMs = env.nowMs();
  const payload = reason !== undefined ? { workItemId, reason } : { workItemId };
  const event = makeClosedEvent(payload, by, atMs, mintFromEnv(env));
  const result = writeEvent(event, eventsRoot);
  maybeGitPushEvent(result, event, by, push);
  return result;
}
