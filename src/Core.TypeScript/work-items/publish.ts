/**
 * Work-item event G-Set publish (081KSXN940008QG0R002FWR9B2 slice 1).
 *
 * `writeEvent` is pure (atomic wx create; idempotent on identical content).
 * Optional direct-to-main git push: `git-push.ts` + CLI `--push` (slice 2c).
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
import { gitPushEventFile } from "./git-push";

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

/** Push a newly-written event to main when `--push` is set (no-op unless `created`). */
export function maybeGitPushEvent(
  result: WriteResult,
  event: WorkItemEvent,
  by: string,
  push: boolean,
): void {
  if (!push || result.kind !== "created") return;
  gitPushEventFile(result.path, by, event);
}
