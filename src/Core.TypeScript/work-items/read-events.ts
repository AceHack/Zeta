/**
 * Read work-item events from the on-disk G-Set (081KSXN940008QG0R002FWR9B2 slice 2).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isCanonicalEventId, isCanonicalTimestamp, type WorkItemEvent } from "./types";

function isWorkItemEvent(value: unknown): value is WorkItemEvent {
  if (!value || typeof value !== "object") return false;
  const e = value as WorkItemEvent;
  if (!isCanonicalEventId(e.id) || !isCanonicalTimestamp(e.at)) return false;
  if (e.kind === "created") return typeof e.payload?.workItemId === "string";
  if (e.kind === "state-changed") {
    return typeof e.payload?.workItemId === "string" && typeof e.payload.from === "string" && typeof e.payload.to === "string";
  }
  if (e.kind === "closed") return typeof e.payload?.workItemId === "string";
  return false;
}

/** Recursively collect `*.json` event files under `eventsRoot`. */
export function listEventFiles(eventsRoot: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.isFile() && entry.name.endsWith(".json")) out.push(p);
    }
  };
  walk(eventsRoot);
  return out.sort();
}

export function readEventsFromFiles(paths: readonly string[]): WorkItemEvent[] {
  const events: WorkItemEvent[] = [];
  for (const path of paths) {
    try {
      const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
      if (isWorkItemEvent(parsed)) events.push(parsed);
    } catch {
      // schema-on-read: skip malformed files
    }
  }
  return events;
}

export function readEventsFromRoot(eventsRoot: string): WorkItemEvent[] {
  return readEventsFromFiles(listEventFiles(eventsRoot));
}
