/**
 * lane-notifier.ts — shared notification primitive for multi-lane ferry throttler.
 *
 * Provides a simple signal/wait mechanism so the drain loop can sleep until
 * a lane has new work or completes. Multiple concurrent `wait()` calls all
 * resolve on the same `notify()`. After `notify()`, the next `wait()` waits
 * for the NEXT notify (does not immediately resolve).
 */

// ─── Interface ──────────────────────────────────────────────────────────────

/** Shared notification primitive for lane coordination. */
export interface LaneNotifier {
  /** Signal that a lane has new work or has completed. */
  notify(): void;
  /** Wait until any lane has work or all lanes are done. Rejects on abort. */
  wait(signal: AbortSignal): Promise<void>;
}

// ─── Implementation ─────────────────────────────────────────────────────────

/**
 * Creates a LaneNotifier backed by a single promise + resolver pair.
 *
 * - `notify()` resolves the current promise, then creates a fresh one for
 *   the next wait cycle.
 * - `wait(signal)` awaits the current promise. If the signal is already
 *   aborted, rejects immediately. Registers an abort listener that rejects
 *   the wait.
 * - Multiple concurrent `wait()` calls all wake on the same `notify()`.
 * - After `notify()`, the next `wait()` call waits for the NEXT notify.
 */
export function createLaneNotifier(): LaneNotifier {
  let resolve: () => void;
  let promise = new Promise<void>((r) => {
    resolve = r;
  });

  return {
    notify(): void {
      const prev = resolve;
      promise = new Promise<void>((r) => {
        resolve = r;
      });
      prev();
    },

    wait(signal: AbortSignal): Promise<void> {
      if (signal.aborted) {
        return Promise.reject(signal.reason as unknown);
      }

      const current = promise;

      return new Promise<void>((res, rej) => {
        let settled = false;

        const onAbort = (): void => {
          if (!settled) {
            settled = true;
            rej(signal.reason as unknown);
          }
        };

        signal.addEventListener("abort", onAbort, { once: true });

        void current.then(() => {
          if (!settled) {
            settled = true;
            signal.removeEventListener("abort", onAbort);
            res();
          }
        });
      });
    },
  };
}
