/**
 * Work-item event G-Set publish (081KSXN940008QG0R002FWR9B2 slice 1).
 *
 * `writeEvent` is pure (atomic wx create; idempotent on identical content).
 * Git direct-to-main is deferred to a later slice — callers write locally first.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  WORKITEM_EVENTS_ROOT,
  eventPath,
  isCanonicalEventId,
  isCanonicalTimestamp,
  serializeEvent,
  type WorkItemEvent,
} from "./types";

export type WriteResult =
  | { readonly kind: "created"; readonly path: string }
  | { readonly kind: "exists-identical"; readonly path: string }
  | { readonly kind: "collision"; readonly path: string };

export function writeEvent(
  event: WorkItemEvent,
  root: string = WORKITEM_EVENTS_ROOT,
  at: Date = new Date(event.at),
): WriteResult {
  if (!isCanonicalTimestamp(event.at) || !isCanonicalEventId(event.id)) {
    throw new Error(
      `work-items: refusing to write malformed event (at=${JSON.stringify(event.at)}, id=${JSON.stringify(event.id)})`,
    );
  }
  const path = eventPath(root, event.id, at);
  const content = serializeEvent(event);
  mkdirSync(dirname(path), { recursive: true });
  try {
    writeFileSync(path, content, { flag: "wx" });
    return { kind: "created", path };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    return readFileSync(path, "utf-8") === content
      ? { kind: "exists-identical", path }
      : { kind: "collision", path };
  }
}
