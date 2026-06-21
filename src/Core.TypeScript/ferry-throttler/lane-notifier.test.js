/**
 * lane-notifier.test.ts — unit tests for LaneNotifier.
 *
 * Covers: single wake, multiple concurrent wakes, abort rejection,
 * already-aborted signal, fresh-cycle semantics, and rapid notify behavior.
 */
import { describe, expect, it } from "bun:test";
import { createLaneNotifier } from "./lane-notifier";
// ─── Helpers ────────────────────────────────────────────────────────────────
/** Creates a deferred that tracks whether a promise resolved or rejected. */
function track(p) {
    const state = {
        resolved: false,
        rejected: false,
        reason: undefined,
        promise: null,
    };
    state.promise = p.then(() => {
        state.resolved = true;
    }, (err) => {
        state.rejected = true;
        state.reason = err;
    });
    return state;
}
/** Flush microtask queue so promises settle. */
async function flush() {
    await new Promise((r) => {
        setTimeout(r, 0);
    });
}
// ─── Tests ──────────────────────────────────────────────────────────────────
describe("LaneNotifier", () => {
    it("notify wakes a single waiting wait() call", async () => {
        const notifier = createLaneNotifier();
        const ac = new AbortController();
        const state = track(notifier.wait(ac.signal));
        await flush();
        expect(state.resolved).toBe(false);
        notifier.notify();
        await flush();
        expect(state.resolved).toBe(true);
    });
    it("notify wakes multiple concurrent wait() calls", async () => {
        const notifier = createLaneNotifier();
        const ac1 = new AbortController();
        const ac2 = new AbortController();
        const ac3 = new AbortController();
        const s1 = track(notifier.wait(ac1.signal));
        const s2 = track(notifier.wait(ac2.signal));
        const s3 = track(notifier.wait(ac3.signal));
        await flush();
        expect(s1.resolved).toBe(false);
        expect(s2.resolved).toBe(false);
        expect(s3.resolved).toBe(false);
        notifier.notify();
        await flush();
        expect(s1.resolved).toBe(true);
        expect(s2.resolved).toBe(true);
        expect(s3.resolved).toBe(true);
    });
    it("wait rejects with abort reason when signal is aborted", async () => {
        const notifier = createLaneNotifier();
        const ac = new AbortController();
        const reason = new Error("cancelled");
        const state = track(notifier.wait(ac.signal));
        await flush();
        expect(state.rejected).toBe(false);
        ac.abort(reason);
        await flush();
        expect(state.rejected).toBe(true);
        expect(state.reason).toBe(reason);
    });
    it("wait rejects immediately if signal is already aborted", async () => {
        const notifier = createLaneNotifier();
        const ac = new AbortController();
        const reason = new Error("already done");
        ac.abort(reason);
        const state = track(notifier.wait(ac.signal));
        await flush();
        expect(state.rejected).toBe(true);
        expect(state.reason).toBe(reason);
    });
    it("after notify, next wait does NOT resolve immediately (waits for next notify)", async () => {
        const notifier = createLaneNotifier();
        const ac1 = new AbortController();
        const ac2 = new AbortController();
        // First cycle: wait then notify
        const s1 = track(notifier.wait(ac1.signal));
        notifier.notify();
        await flush();
        expect(s1.resolved).toBe(true);
        // Second cycle: wait should NOT resolve immediately
        const s2 = track(notifier.wait(ac2.signal));
        await flush();
        expect(s2.resolved).toBe(false);
        // Only resolves on the next notify
        notifier.notify();
        await flush();
        expect(s2.resolved).toBe(true);
    });
    it("multiple rapid notify calls don't accumulate (each creates one fresh cycle)", async () => {
        const notifier = createLaneNotifier();
        const ac = new AbortController();
        // Fire several notifies without any waiter
        notifier.notify();
        notifier.notify();
        notifier.notify();
        // A wait issued AFTER the rapid notifies should NOT resolve immediately
        const state = track(notifier.wait(ac.signal));
        await flush();
        expect(state.resolved).toBe(false);
        // Only resolves on the next notify
        notifier.notify();
        await flush();
        expect(state.resolved).toBe(true);
    });
});
