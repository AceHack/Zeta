/**
 * src/Core.TypeScript/observe/do-item.test.ts — Phase-1 acceptance for effectful do_item (B-0964).
 *
 * Proves: the observation envelope (Started→Succeeded|Failed), the injected executor port
 * (fake — no shell), the success/failure transitions, the audit tier in the
 * Started observation, applyObservation-delegates-to-simulate (single reducer), and the
 * load-bearing correctness guarantee — **replay folds observations without an executor**
 * (foldObservations has no executor param, so re-running the log cannot re-run the work).
 */
import { describe, expect, it } from "bun:test";
import { simulate } from "./observe";
import { applyObservation, executeDoItem, fakeExecutor, foldObservations } from "./do-item";
const item = (id) => ({ id, title: id, ready: true, ambiguous: false });
const w = (backlog) => ({ backlog });
/** Fake observation-sink: records appends; never touches git. */
function fakeObservationSink() {
    const appended = [];
    return {
        appended,
        append: (event) => {
            appended.push(event);
            return Promise.resolve({ ok: true, eventId: `evt-${String(appended.length)}` });
        },
    };
}
/** Observation-sink that fails the Nth append (1-based) — for durability-failure tests. */
function failingObservationSink(failOn) {
    const appended = [];
    const sink = {
        appended,
        calls: 0,
        append: (event) => {
            sink.calls += 1;
            if (sink.calls === failOn)
                return Promise.resolve({ ok: false, reason: "remote ahead" });
            appended.push(event);
            return Promise.resolve({ ok: true, eventId: `evt-${String(sink.calls)}` });
        },
    };
    return sink;
}
const okRun = { ok: true, stdout: "built", exitCode: 0 };
const failRun = { ok: false, reason: "build failed", exitCode: 1, stderr: "error" };
const opts = { spec: { script: "noop" }, gated: false };
describe("executeDoItem — the observation envelope", () => {
    it("success: Started→Succeeded logged, item leaves backlog, completed=true", async () => {
        const world = w([item("B-1"), item("B-2")]);
        const sink = fakeObservationSink();
        const r = await executeDoItem(world, item("B-1"), sink, fakeExecutor(okRun), opts);
        expect(r.ok).toBe(true);
        if (!r.ok)
            return;
        expect(r.completed).toBe(true);
        expect(r.world.backlog.map((i) => i.id)).toEqual(["B-2"]); // B-1 done, gone
        expect(r.world.mode).toBe("work");
        expect(sink.appended.map((f) => f.kind)).toEqual(["ActionExecutionStarted", "ActionExecutionSucceeded"]);
    });
    it("failure: Started→Failed logged, item STAYS, completed=false, reason carried", async () => {
        const world = w([item("B-1")]);
        const sink = fakeObservationSink();
        const r = await executeDoItem(world, item("B-1"), sink, fakeExecutor(failRun), opts);
        expect(r.ok).toBe(true);
        if (!r.ok || r.completed)
            return;
        expect(r.world.backlog.map((i) => i.id)).toEqual(["B-1"]); // still there — work failed
        expect(r.reason).toBe("build failed");
        expect(sink.appended.map((f) => f.kind)).toEqual(["ActionExecutionStarted", "ActionExecutionFailed"]);
    });
    it("the Started observation records the executor TIER + gated (the §3 glass-halo audit)", async () => {
        const sink = fakeObservationSink();
        const ociExec = { tier: "oci", run: () => Promise.resolve(okRun) };
        await executeDoItem(w([item("B-1")]), item("B-1"), sink, ociExec, { spec: { script: "x" }, gated: true });
        const started = sink.appended[0];
        expect(started?.kind).toBe("ActionExecutionStarted");
        if (started?.kind !== "ActionExecutionStarted")
            return;
        expect(started.tier).toBe("oci");
        expect(started.gated).toBe(true);
    });
    it("durability failure on Started: no executor run, no transition, ok=false", async () => {
        const world = w([item("B-1")]);
        const sink = failingObservationSink(1); // first append (Started) fails
        let ran = false;
        const watchExecutor = {
            tier: "fake",
            run: () => {
                ran = true;
                return Promise.resolve(okRun);
            },
        };
        const r = await executeDoItem(world, item("B-1"), sink, watchExecutor, opts);
        expect(r.ok).toBe(false);
        if (r.ok)
            return;
        expect(r.feedback.kind).toBe("append-failed");
        expect(ran).toBe(false); // executor never ran — append-first
        expect(sink.appended).toHaveLength(0);
    });
    it("terminal-append failure (executor RAN): reconcile-needed feedback, not blind-retryable (PR review 2026-06-01)", async () => {
        const world = w([item("B-1")]);
        const sink = failingObservationSink(2); // Started lands; the terminal Succeeded append fails
        let ran = false;
        const watchExecutor = {
            tier: "fake",
            run: () => {
                ran = true;
                return Promise.resolve(okRun);
            },
        };
        const r = await executeDoItem(world, item("B-1"), sink, watchExecutor, opts);
        expect(ran).toBe(true); // the side-effect DID happen
        expect(r.ok).toBe(false);
        if (r.ok)
            return;
        expect(r.feedback.kind).toBe("terminal-append-failed"); // distinct from append-failed — do NOT blind-retry
        if (r.feedback.kind !== "terminal-append-failed")
            return;
        expect(r.feedback.ranOutcome).toBe("succeeded");
        expect(r.feedback.durableObservations.map((f) => f.kind)).toEqual(["ActionExecutionStarted"]); // only Started is durable
    });
    it("executor THROWS/rejects: converted to ActionExecutionFailed, never an unhandled rejection (PR review 2026-06-01)", async () => {
        const world = w([item("B-1")]);
        const sink = fakeObservationSink();
        const throwingExecutor = {
            tier: "fake",
            run: () => Promise.reject(new Error("spawn ENOENT")),
        };
        const r = await executeDoItem(world, item("B-1"), sink, throwingExecutor, opts);
        // a throw must still produce a clean terminal observation (Started→Failed), not crash
        expect(r.ok).toBe(true); // machinery worked: both observations landed
        if (!r.ok)
            return;
        expect(r.completed).toBe(false); // the WORK failed
        expect(sink.appended.map((f) => f.kind)).toEqual(["ActionExecutionStarted", "ActionExecutionFailed"]);
        const failed = sink.appended[1];
        if (failed?.kind !== "ActionExecutionFailed")
            return;
        expect(failed.reason).toContain("executor threw"); // the throw is captured in the observation's reason
        expect(failed.reason).toContain("spawn ENOENT");
        expect(world.backlog.some((b) => b.id === "B-1")).toBe(true); // failed work leaves the item in the backlog
    });
    it("terminal-append failure on a FAILED run preserves the executor reason via ranReason (PR review 2026-06-01)", async () => {
        const world = w([item("B-1")]);
        const sink = failingObservationSink(2); // Started lands; the terminal Failed append fails
        const r = await executeDoItem(world, item("B-1"), sink, fakeExecutor(failRun), opts);
        expect(r.ok).toBe(false);
        if (r.ok)
            return;
        expect(r.feedback.kind).toBe("terminal-append-failed");
        if (r.feedback.kind !== "terminal-append-failed")
            return;
        expect(r.feedback.ranOutcome).toBe("failed");
        expect(r.feedback.reason).toBe("remote ahead"); // the APPEND failure (why we're reconcile-needed)
        expect(r.feedback.ranReason).toBe("build failed"); // the EXECUTOR failure preserved (why the work failed)
        expect(r.feedback.durableObservations.map((f) => f.kind)).toEqual(["ActionExecutionStarted"]);
    });
});
describe("foldObservations — replay folds OBSERVATIONS, never re-runs (B-0964 §0 correctness)", () => {
    it("replaying [Started, Succeeded] reconstructs the executed world — with NO executor", async () => {
        const world = w([item("B-1"), item("B-2")]);
        const sink = fakeObservationSink();
        const r = await executeDoItem(world, item("B-1"), sink, fakeExecutor(okRun), opts);
        if (!r.ok)
            throw new Error("expected ok");
        // foldObservations takes only (initial, observations) — structurally cannot call an executor.
        const replayed = foldObservations(world, sink.appended);
        expect(replayed).toEqual(r.world); // the log reconstructs the executed state
        expect(replayed.backlog.map((i) => i.id)).toEqual(["B-2"]);
    });
    it("replaying a failed run leaves the item in the backlog", () => {
        const world = w([item("B-1")]);
        const observations = [
            { kind: "ActionExecutionStarted", item: item("B-1"), tier: "fake", gated: false },
            { kind: "ActionExecutionFailed", item: item("B-1"), reason: "x" },
        ];
        expect(foldObservations(world, observations).backlog.map((i) => i.id)).toEqual(["B-1"]);
    });
    it("applyObservation(Succeeded) is IDENTICAL to simulate(do_item) — the single reducer, no drift", () => {
        const world = w([item("B-1"), item("B-2")]);
        const viaObservation = applyObservation(world, { kind: "ActionExecutionSucceeded", item: item("B-1") });
        const viaSimulate = simulate(world, { kind: "do_item", item: item("B-1") });
        expect(viaObservation).toEqual(viaSimulate);
    });
});
