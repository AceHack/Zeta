/**
 * corporate/store-lock.ts — one run at a time on an organization's store.
 *
 * A store is one organization's record of one body of work, and two runs over it at once interleave
 * two records into one: both raise the same action items, both follow up the same change, both push.
 * Until something watched the organization on a timer that was a matter of the operator's care; with
 * a watcher starting runs by itself it is a race waiting for its first overlap. So a run takes the
 * store's lock before it touches anything and gives it back when it exits.
 *
 * The lock is a file created EXCLUSIVELY (`wx`), holding the owner's pid. A lock whose owner is no
 * longer running is stale - the run crashed, or the machine restarted - and is taken over rather than
 * obeyed, so a crash never wedges an organization. Liveness is asked of the operating system
 * (`kill(pid, 0)` sends nothing and only asks); a pid that is alive but belongs to another program is
 * read as alive, which errs toward not running - the direction that cannot double-push.
 */

import { closeSync, openSync, readFileSync, rmSync, writeSync } from "node:fs";
import { join } from "node:path";

export interface StoreLockOwner {
  readonly pid: number;
  readonly startedAt: string;
}

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

/** Who holds the store's lock right now, if anyone living does. */
export function lockHolder(store: string): StoreLockOwner | undefined {
  try {
    const owner = JSON.parse(readFileSync(join(store, "run.lock"), "utf-8")) as StoreLockOwner;
    return isRunning(owner.pid) ? owner : undefined;
  } catch {
    return undefined;
  }
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
  const path = join(store, "run.lock");
  const me: StoreLockOwner = { pid, startedAt: nowIso };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(path, "wx", 0o600);
      writeSync(fd, JSON.stringify(me));
      closeSync(fd);
      let released = false;
      const release = (): void => {
        if (released) return;
        released = true;
        // Only OUR lock is removed: a run that outlived a takeover must not delete its successor's.
        try {
          const now = JSON.parse(readFileSync(path, "utf-8")) as StoreLockOwner;
          if (now.pid === pid) rmSync(path, { force: true });
        } catch {
          // already gone
        }
      };
      return { ok: true, release };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      let held: StoreLockOwner | undefined;
      try {
        held = JSON.parse(readFileSync(path, "utf-8")) as StoreLockOwner;
      } catch {
        held = undefined;
      }
      if (held !== undefined && isRunning(held.pid) && held.pid !== pid) return { ok: false, heldBy: held };
      // STALE (its owner is gone) or unreadable: taken over, once.
      rmSync(path, { force: true });
      if (attempt === 1 && held !== undefined) return { ok: false, heldBy: held };
    }
  }
  return { ok: false, heldBy: { pid: -1, startedAt: "unknown" } };
}
