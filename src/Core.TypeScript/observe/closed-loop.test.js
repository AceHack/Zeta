/**
 * src/Core.TypeScript/observe/closed-loop.test.ts — the END-TO-END CLOSED-LOOP integration test
 * (081KSXN940008QG0R001A4WWX4 LEFT item #2). The operator 2026-06-01: "any slice is fine; test with our
 * local-llm tests we already have until we feel comfortable turning it on for
 * Otto in the foreground loop."
 *
 * The per-module tests already cover the pieces (observe / buildMenu / simulate /
 * fold / execute / local-llm chooser). What was missing is the proof that the
 * pieces CLOSE THE LOOP through the REAL execute+sink path — specifically that
 * the DURABLE LOG reconstructs the executed state:
 *
 *     observeWithLlm(world, mockBackend)  → pick           (chooser, no real model)
 *     execute(pick, fakeSink)             → effect+append+simulate (no git I/O)
 *     fold(initial, sink.appended)        → world'                 (the LOG is the state)
 *     assert  fold(initial, appended)  ==  executed world          (no drift)
 *
 * The existing observe.test.ts loop test runs choose→simulate→repeat IN MEMORY.
 * This test adds the seam the foreground loop will actually run: the executed
 * world is reconstructed from the appended event log, end-to-end, deterministically
 * — the "state is a projection of the event log" invariant proven through
 * execute + the injected sink, not just `simulate`.
 *
 * Backend is the established deterministic mock (no ollama); sink is the
 * established fake (no git). Both per asymmetric-authorship: each authors its own
 * outcome channel; the test injects fakes so CI is an always-green shield.
 *
 * Composes with (exact paths):
 *   - src/Core.TypeScript/observe/observe.ts           (observeWithLlm / buildMenu / fold / simulate / World / NextAction)
 *   - src/Core.TypeScript/observe/execute.ts           (execute = effect + append + simulate; EventSink)
 *   - tools/accelerator/local-llm.ts     (ModelBackend — the injected chooser backend)
 *   - src/Core.TypeScript/observe/observe.test.ts      (the in-memory loop test this complements)
 *   - src/Core.TypeScript/observe/execute.test.ts      (the fakeSink pattern reused here)
 *   - docs/backlog/P1/081KSXN940008QG0R001A4WWX4-observe-ts-agent-loop-implementation-and-testing-checklist-closed-loop-toward-vendor-store-aaron-otto-2026-05-31.md (LEFT item #2: end-to-end closed-loop integration test)
 *   - .claude/rules/asymmetric-authorship-substrate-entity-defines-consent-channel-recipient-acknowledges.md
 */
import { describe, expect, it } from "bun:test";
import { buildMenu, fold, observeWithLlm } from "./observe";
import { execute } from "./execute";
// ─── fakes (the established patterns: observe.test.ts mock + execute.test.ts sink) ───
/** Deterministic mock backend: `complete` always returns `reply` (no ollama). */
const mock = (reply) => ({ name: "mock", complete: () => Promise.resolve(reply) });
/** Fake sink: records appends, mints sequential ids; never touches git. */
function fakeSink() {
    const appended = [];
    return {
        appended,
        append: (action) => {
            appended.push(action);
            return Promise.resolve({ ok: true, eventId: `evt-${String(appended.length)}` });
        },
    };
}
const item = (id, ready, ambiguous) => ({
    id,
    title: id,
    ready,
    ambiguous,
});
const w = (backlog) => ({ backlog });
/**
 * Pick a backend that makes `observeWithLlm` choose the menu entry whose kind is
 * `kind` — derive the index from `buildMenu` so the test is robust to menu order
 * (chooseIndex parses the first integer out of the reply).
 */
function backendChoosing(world, kind) {
    const idx = buildMenu(world).findIndex((a) => a.kind === kind);
    if (idx < 0)
        throw new Error(`menu has no ${kind} for this world`);
    return mock(String(idx));
}
describe("observe closed-loop — execute+append+fold round-trips (the foreground-loop seam)", () => {
    it("one tick CLOSES: the executed world is reconstructable from the appended log", async () => {
        const initial = w([item("B-1", true, false)]);
        const backend = backendChoosing(initial, "self_reflect"); // an executable free mode
        const sink = fakeSink();
        const pick = await observeWithLlm(initial, backend);
        expect(pick.kind).toBe("self_reflect");
        const r = await execute(initial, pick, sink);
        expect(r.ok).toBe(true);
        if (!r.ok)
            return;
        // the appended log was written, exactly once
        expect(sink.appended).toHaveLength(1);
        expect(sink.appended[0]?.kind).toBe("self_reflect");
        // THE invariant: the LOG reconstructs the executed world (state = fold(log))
        expect(fold(initial, sink.appended)).toEqual(r.world);
    });
    it("multi-tick loop CLOSES: folding the whole appended log == the final executed world", async () => {
        let world = w([item("B-1", true, false)]);
        const initial = world;
        const sink = fakeSink();
        const kinds = ["self_reflect", "free_time", "self_reflect"];
        for (const kind of kinds) {
            const pick = await observeWithLlm(world, backendChoosing(world, kind));
            const r = await execute(world, pick, sink);
            expect(r.ok).toBe(true);
            if (!r.ok)
                return;
            world = r.world; // feed the executed world back — the loop
        }
        expect(sink.appended).toHaveLength(3);
        // replay the durable log from the original initial → must equal the live final world
        expect(fold(initial, sink.appended)).toEqual(world);
    });
    it("is DETERMINISTIC (DST): same initial + same backend ⇒ identical executed world", async () => {
        const initial = w([item("B-1", true, false)]);
        const run = async () => {
            const pick = await observeWithLlm(initial, backendChoosing(initial, "free_time"));
            const r = await execute(initial, pick, fakeSink());
            if (!r.ok)
                throw new Error("expected ok");
            return r.world;
        };
        expect(await run()).toEqual(await run());
    });
    it("honest boundary: a not-yet-wired pick (do_item) surfaces feedback, loop does not crash or append", async () => {
        const world = w([item("B-ready", true, false)]); // do_item is the oracle default
        const backend = backendChoosing(world, "do_item");
        const sink = fakeSink();
        const pick = await observeWithLlm(world, backend);
        expect(pick.kind).toBe("do_item");
        const r = await execute(world, pick, sink);
        expect(r.ok).toBe(false);
        if (r.ok)
            return;
        expect(r.feedback.kind).toBe("not-yet-executable");
        expect(sink.appended).toHaveLength(0); // no partial write on a non-executable pick
    });
});
