/**
 * lane-notifier.ts — shared notification primitive for multi-lane ferry throttler.
 *
 * Provides a simple signal/wait mechanism so the drain loop can sleep until
 * a lane has new work or completes. Multiple concurrent `wait()` calls all
 * resolve on the same `notify()`. After `notify()`, the next `wait()` waits
 * for the NEXT notify (does not immediately resolve).
 */
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
export function createLaneNotifier() {
    let resolve;
    let promise = new Promise((r) => {
        resolve = r;
    });
    return {
        notify() {
            const prev = resolve;
            promise = new Promise((r) => {
                resolve = r;
            });
            prev();
        },
        wait(signal) {
            if (signal.aborted) {
                return Promise.reject(signal.reason);
            }
            const current = promise;
            return new Promise((res, rej) => {
                let settled = false;
                const onAbort = () => {
                    if (!settled) {
                        settled = true;
                        rej(signal.reason);
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
