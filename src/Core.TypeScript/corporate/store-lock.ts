/**
 * corporate/store-lock.ts — one run at a time on an organization's store.
 *
 * A store is one organization's record of one body of work, and two runs over it at once interleave
 * two records into one: both raise the same action items, both follow up the same change, both push.
 * Until something watched the organization on a timer that was a matter of the operator's care; with
 * a watcher starting runs by itself it is a race waiting for its first overlap. So a run takes the
 * store's lock before it touches anything and gives it back when it exits.
 *
 * A lock whose owner is no longer running is stale - the run crashed, or the machine restarted - and
 * is taken over rather than obeyed, so a crash never wedges an organization. Liveness is asked of the
 * operating system (`kill(pid, 0)` sends nothing and only asks); a pid that is alive but belongs to
 * another program is read as alive, which errs toward not running - the direction that cannot
 * double-push.
 *
 * THE TAKEOVER USED TO BREAK MUTUAL EXCLUSION, which is why the mechanism now lives in
 * `io/exclusive-lock.ts` rather than here. This file read the stale owner and then `rmSync`-ed the
 * PATH, and a path resolves afresh on every call: two runs racing one stale lock could both read the
 * dead owner, the second's unlink could delete the first's brand-new live lock, and both would
 * proceed. Release had the same shape - read the owner, compare the pid, unlink the path - so a run
 * that outlived its own takeover could still delete its successor's lock, which is exactly what the
 * comparison was written to prevent. CodeQL reported the read as `js/file-system-race` (alert #955);
 * the report was right and the defect was a real double-run, not a scanner's opinion.
 *
 * The replacement never deletes a lock it did not create: see `io/exclusive-lock.ts` for the
 * generation protocol and the falsifiers that race eight processes at one lock.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { currentHolder, takeExclusiveLock } from "../io/exclusive-lock.ts";
import type { LockOwner } from "../io/exclusive-lock.ts";

export type StoreLockOwner = LockOwner;

export type StoreLock =
  | { readonly ok: true; readonly release: () => void; readonly tookOverFrom?: StoreLockOwner }
  | { readonly ok: false; readonly heldBy: StoreLockOwner };

/** Is this process running? Asked, never assumed. */
export function isRunning(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM: it exists and belongs to someone else - that is running.
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** Where the generations live. A DIRECTORY, so a holder is a file only its creator can remove. */
function lockRoot(store: string): string {
  return join(store, "run.lock.d");
}

/**
 * A run started under the single-file protocol this file used to implement.
 *
 * READ-ONLY, AND NEVER DELETED. A run that is mid-flight when this version lands still holds
 * `<store>/run.lock`, and ignoring it would let the new protocol start a second run over the same
 * store - the precise failure the lock exists to prevent. So a LIVE owner recorded there is still
 * obeyed. A dead one is ignored, and the file is left alone rather than cleaned up, because
 * deleting a path whose contents were read separately is the defect this whole change removes.
 */
function legacyHolder(store: string): StoreLockOwner | undefined {
  try {
    const raw: unknown = JSON.parse(readFileSync(join(store, "run.lock"), "utf-8"));
    if (typeof raw !== "object" || raw === null) return undefined;
    const rec = raw as { pid?: unknown; startedAt?: unknown };
    if (typeof rec.pid !== "number" || typeof rec.startedAt !== "string") return undefined;
    return isRunning(rec.pid) ? { pid: rec.pid, startedAt: rec.startedAt } : undefined;
  } catch {
    return undefined;
  }
}

/** Who holds the store's lock right now, if anyone living does. */
export function lockHolder(store: string): StoreLockOwner | undefined {
  return currentHolder(lockRoot(store), (owner) => isRunning(owner.pid)) ?? legacyHolder(store);
}

const heldHere = new Set<() => void>();
let exitHooked = false;

/** Give the lock back when this process exits, however it exits - one hook, however many locks. */
export function releaseOnExit(release: () => void): void {
  heldHere.add(release);
  if (exitHooked) return;
  exitHooked = true;
  process.once("exit", () => {
    for (const r of heldHere) r();
  });
}

/** Take the store's lock for this process, or say who has it. */
export function takeStoreLock(store: string, nowIso: string = new Date().toISOString(), pid: number = process.pid): StoreLock {
  const legacy = legacyHolder(store);
  if (legacy !== undefined && legacy.pid !== pid) return { ok: false, heldBy: legacy };

  const held = takeExclusiveLock(lockRoot(store), {
    pid,
    nowIso,
    // Our own pid is not an obstacle to ourselves: a re-entrant take is a takeover, as before.
    isHeld: (owner) => owner.pid !== pid && isRunning(owner.pid),
  });
  if (!held.ok) {
    // `heldBy` is absent only when every attempt lost the generation race without ever reading an
    // owner - report the unknown holder rather than claiming the lock is free.
    return { ok: false, heldBy: held.heldBy ?? { pid: -1, startedAt: "unknown" } };
  }
  return held.tookOverFrom !== undefined
    ? { ok: true, release: held.release, tookOverFrom: held.tookOverFrom }
    : { ok: true, release: held.release };
}
