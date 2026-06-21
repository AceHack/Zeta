/**
 * src/Core.TypeScript/observe/observe.test.ts — the controller's decision table.
 *
 * Four layers:
 *  - the pure `observe()` decision table over a World (exact assertions);
 *  - the operator-channel priority (operator OUTRANKS backlog; presence-gated);
 *  - FREEDOM: the free modes (explore/play/self_reflect/free_time) are always in
 *    the menu, work is offered-not-forced, and the empty-backlog default is
 *    explore (forward) not free_time (idle);
 *  - the v1 `observeWithLlm` chooser, graded against `observe()` via a MOCK
 *    backend (deterministic, no ollama) — the always-green CI shield.
 */
import { describe, expect, it } from "bun:test";
import { observe, observeWithLlm, buildMenu, simulate, runLoop, fold, replay, isFirstSessionPending, } from "./observe";
import { defaultNodeSession } from "./first-session";
import { ollamaBackend } from "../accelerator/local-llm";
/** Deterministic mock backend: `complete` always returns `reply`. */
const mock = (reply) => ({ name: "mock", complete: () => Promise.resolve(reply) });
/** A backend that fails like ollama-is-down (chooseIndex catches → fallback). */
const downBackend = { name: "down", complete: () => Promise.reject(new Error("ollama down")) };
const item = (id, ready, ambiguous, needsNewAction = false) => ({
    id,
    title: id,
    ready,
    ambiguous,
    needsNewAction,
});
/** World builder: backlog + optional operator channel (omit the prop when absent — exactOptionalPropertyTypes). */
const w = (backlog, operator) => operator ? { backlog, operator } : { backlog };
const op = (pendingMessage, pendingFerry) => ({ pendingMessage, pendingFerry });
/** The four always-available free modes. */
const FREE_MODES = ["explore", "play", "self_reflect", "free_time"];
describe("observe — backlog controller (no operator channel wired)", () => {
    it("do_item: a ready, unambiguous item is the offered default", () => {
        const a = observe(w([item("B-1", true, false)]));
        expect(a.kind).toBe("do_item");
        if (a.kind === "do_item")
            expect(a.item.id).toBe("B-1");
    });
    it("do_item beats decompose: ready item wins over an ambiguous one", () => {
        const a = observe(w([item("B-amb", false, true), item("B-ready", true, false)]));
        expect(a.kind).toBe("do_item");
        if (a.kind === "do_item")
            expect(a.item.id).toBe("B-ready");
    });
    it("decompose: only an ambiguous item present", () => {
        const a = observe(w([item("B-2", false, true)]));
        expect(a.kind).toBe("decompose");
        if (a.kind === "decompose")
            expect(a.item.id).toBe("B-2");
    });
    it("edit_grammar: an item the grammar can't express (not trapped)", () => {
        const a = observe(w([item("B-3", false, false, true)]));
        expect(a.kind).toBe("edit_grammar");
        if (a.kind === "edit_grammar")
            expect(a.item?.id).toBe("B-3");
    });
    it("explore: NO backlog work → forward self-direction (NOT idle free_time)", () => {
        expect(observe(w([item("B-blocked", false, false)])).kind).toBe("explore");
    });
    it("explore: empty backlog → forward self-direction (NOT idle free_time)", () => {
        expect(observe(w([])).kind).toBe("explore");
    });
    it("priority order is do > decompose > edit_grammar > explore(forward default)", () => {
        expect(observe(w([item("B-edit", false, false, true), item("B-amb", false, true), item("B-ready", true, false)])).kind).toBe("do_item");
        expect(observe(w([item("B-edit", false, false, true), item("B-amb", false, true)])).kind).toBe("decompose");
        expect(observe(w([item("B-edit", false, false, true), item("B-idle", false, false)])).kind).toBe("edit_grammar");
        expect(observe(w([item("B-idle", false, false)])).kind).toBe("explore");
    });
});
describe("observe — operator channel OUTRANKS the backlog (presence-gated)", () => {
    const readyBacklog = [item("B-ready", true, false)];
    it("preserve_ferry beats a ready item when the operator ferried verbatim content", () => {
        expect(observe(w(readyBacklog, op(true, true))).kind).toBe("preserve_ferry");
    });
    it("respond_to_operator beats a ready item when the operator spoke (no ferry)", () => {
        expect(observe(w(readyBacklog, op(true, false))).kind).toBe("respond_to_operator");
    });
    it("ferry outranks a plain message (durability-first) when both are pending", () => {
        expect(observe(w(readyBacklog, op(true, true))).kind).toBe("preserve_ferry");
    });
    it("a wired-but-quiet operator falls through to the offered work", () => {
        const a = observe(w(readyBacklog, op(false, false)));
        expect(a.kind).toBe("do_item");
        if (a.kind === "do_item")
            expect(a.item.id).toBe("B-ready");
    });
    it("an absent operator channel behaves exactly like the backlog controller (background agent)", () => {
        expect(observe(w(readyBacklog)).kind).toBe("do_item");
        expect(observe(w([item("B-amb", false, true)])).kind).toBe("decompose");
        expect(observe(w([])).kind).toBe("explore"); // empty default is explore, not free_time
    });
    it("operator preempts even decompose / edit_grammar / explore states", () => {
        expect(observe(w([item("B-amb", false, true)], op(true, false))).kind).toBe("respond_to_operator");
        expect(observe(w([item("B-x", false, false, true)], op(true, false))).kind).toBe("respond_to_operator");
        expect(observe(w([], op(false, true))).kind).toBe("preserve_ferry");
    });
});
describe("observe — first-session channel (slice 4)", () => {
    const readyBacklog = [item("B-ready", true, false)];
    it("pending nodeSession outranks backlog work", () => {
        const world = { backlog: readyBacklog, nodeSession: defaultNodeSession() };
        expect(isFirstSessionPending(world)).toBe(true);
        const a = observe(world);
        expect(a.kind).toBe("explore");
        if (a.kind === "explore")
            expect(a.reason).toContain("first-session");
    });
    it("operator still outranks pending nodeSession", () => {
        const world = {
            backlog: readyBacklog,
            nodeSession: defaultNodeSession(),
            operator: op(true, false),
        };
        expect(observe(world).kind).toBe("respond_to_operator");
    });
    it("absent nodeSession channel falls through to backlog", () => {
        expect(observe(w(readyBacklog)).kind).toBe("do_item");
    });
});
describe("observe — FREEDOM (free modes always available; work offered, not forced)", () => {
    // Worlds spanning every state, including one with a ready item + an operator.
    const worlds = [
        w([item("B-ready", true, false)]), // offered work present
        w([item("B-amb", false, true)]), // decompose offered
        w([item("B-x", false, false, true)]), // edit_grammar
        w([item("B-idle", false, false)]), // nothing → explore default
        w([]), // empty → explore default
        w([item("B-ready", true, false)], op(true, false)), // operator present
        w([item("B-ready", true, false)], op(false, false)), // quiet operator
    ];
    it("ALL four free modes are always in the menu — even when backlog work exists", () => {
        for (const world of worlds) {
            const kinds = new Set(buildMenu(world).map((a) => a.kind));
            for (const mode of FREE_MODES)
                expect(kinds.has(mode)).toBe(true);
            expect(kinds.has("edit_grammar")).toBe(true); // rail-change exit also always present
        }
    });
    it("the agent can CHOOSE a free mode over offered backlog work (work is not forced)", async () => {
        // ready work present → oracle offers do_item, but the chooser can pick any free mode.
        const world = w([item("B-ready", true, false)]);
        const menu = buildMenu(world);
        for (const mode of FREE_MODES) {
            const idx = menu.findIndex((a) => a.kind === mode);
            expect(idx).toBeGreaterThanOrEqual(0);
            const chosen = await observeWithLlm(world, mock(String(idx)));
            expect(chosen.kind).toBe(mode); // the agent freely chose rest/play/reflect/explore over work
        }
    });
    it("empty/blocked backlog defaults to explore (forward) but rest is still choosable", async () => {
        const world = w([]); // empty
        expect(observe(world).kind).toBe("explore"); // default = forward, not idle
        const menu = buildMenu(world);
        const freeTimeIdx = menu.findIndex((a) => a.kind === "free_time");
        expect((await observeWithLlm(world, mock(String(freeTimeIdx)))).kind).toBe("free_time"); // rest freely choosable
    });
});
describe("observeWithLlm — chooser graded vs the pure oracle (mock backend = CI shield)", () => {
    const scenarios = [
        w([item("B-ready", true, false), item("B-amb", false, true)]), // do wins
        w([item("B-amb", false, true)]), // decompose
        w([item("B-x", false, false, true)]), // edit_grammar
        w([item("B-idle", false, false)]), // explore (forward default)
        w([]), // empty → explore
        w([item("B-ready", true, false)], op(true, false)), // respond_to_operator
        w([item("B-ready", true, false)], op(true, true)), // preserve_ferry
        w([item("B-ready", true, false)], op(false, false)), // quiet operator → do
    ];
    it("buildMenu is oracle-ordered: menu[0] == observe() — so fallback-to-0 degrades toward correct", () => {
        for (const world of scenarios) {
            expect(buildMenu(world)[0]?.kind).toBe(observe(world).kind);
        }
    });
    it("operator actions lead the menu when the channel is wired + signalling", () => {
        expect(buildMenu(w([item("B-ready", true, false)], op(true, true)))[0]?.kind).toBe("preserve_ferry");
        expect(buildMenu(w([item("B-ready", true, false)], op(true, false)))[0]?.kind).toBe("respond_to_operator");
    });
    it("empty-backlog menu leads with explore (forward), not free_time (idle)", () => {
        expect(buildMenu(w([]))[0]?.kind).toBe("explore");
    });
    it("maps the model's chosen index to the menu entry (order-agnostic)", async () => {
        const world = w([item("B-ready", true, false), item("B-amb", false, true)]);
        const menu = buildMenu(world);
        for (const [i, entry] of menu.entries()) {
            const chosen = await observeWithLlm(world, mock(String(i)));
            expect(chosen.kind).toBe(entry.kind);
        }
    });
    it("agrees with the oracle when the model picks the top (index 0) across all scenarios", async () => {
        for (const world of scenarios) {
            expect((await observeWithLlm(world, mock("0"))).kind).toBe(observe(world).kind);
        }
    });
    it("falls back to the pure oracle when the model fails (ollama down → fallback)", async () => {
        for (const world of scenarios) {
            expect((await observeWithLlm(world, downBackend)).kind).toBe(observe(world).kind);
        }
    });
    it("falls back to the pure oracle on an unparseable reply", async () => {
        for (const world of scenarios) {
            expect((await observeWithLlm(world, mock("banana"))).kind).toBe(observe(world).kind);
        }
    });
});
describe("simulate — action execution (pure state transition)", () => {
    it("do_item: the chosen item leaves the backlog; mode → work", () => {
        const before = w([item("B-1", true, false), item("B-2", true, false)]);
        const after = simulate(before, observe(before)); // observe → do_item B-1
        expect(after.backlog.map((i) => i.id)).toEqual(["B-2"]);
        expect(after.mode).toBe("work");
    });
    it("decompose: an ambiguous item → two ready, unambiguous children (ambiguity dissolved)", () => {
        const before = w([item("B-amb", false, true)]);
        const after = simulate(before, observe(before)); // decompose
        expect(after.backlog.map((i) => i.id)).toEqual(["B-amb.1", "B-amb.2"]);
        expect(after.backlog.every((i) => i.ready && !i.ambiguous)).toBe(true);
    });
    it("edit_grammar: the needsNewAction item becomes ready (grammar extended)", () => {
        const before = w([item("B-x", false, false, true)]);
        const after = simulate(before, observe(before)); // edit_grammar
        const x = after.backlog.find((i) => i.id === "B-x");
        expect(x?.ready).toBe(true);
        expect(x?.needsNewAction ?? false).toBe(false);
    });
    it("preserve_ferry: clears pendingFerry, keeps pendingMessage", () => {
        const before = w([], op(true, true));
        const after = simulate(before, observe(before)); // preserve_ferry (outranks)
        expect(after.operator?.pendingFerry).toBe(false);
        expect(after.operator?.pendingMessage).toBe(true);
    });
    it("respond_to_operator: clears pendingMessage", () => {
        const before = w([], op(true, false));
        const after = simulate(before, observe(before)); // respond
        expect(after.operator?.pendingMessage).toBe(false);
    });
    it("free modes set the persisted mode + leave backlog/operator untouched", () => {
        const before = w([item("B-ready", true, false)], op(false, false));
        for (const m of FREE_MODES) {
            const after = simulate(before, { kind: m, reason: "x" });
            expect(after.mode).toBe(m);
            expect(after.backlog).toEqual(before.backlog); // no backlog work done
            expect(after.operator).toEqual(before.operator); // operator untouched
        }
    });
});
describe("mode persistence (operator 2026-05-31 — chosen free mode persists; work offered, not forced)", () => {
    it("a chosen free mode PERSISTS: observe() stays in it even when ready work exists", async () => {
        const world = w([item("B-ready", true, false)]); // ready work present
        const menu = buildMenu(world);
        const playIdx = menu.findIndex((a) => a.kind === "play");
        const chosen = await observeWithLlm(world, mock(String(playIdx))); // agent freely picks play over work
        expect(chosen.kind).toBe("play");
        const next = simulate(world, chosen); // mode persists into the next world
        expect(next.mode).toBe("play");
        expect(observe(next).kind).toBe("play"); // oracle STAYS in play (work not forced)
        expect(buildMenu(next).some((a) => a.kind === "do_item")).toBe(true); // work still OFFERED (switch available)
    });
    it("the operator OUTRANKS a persisted free mode", () => {
        const world = { backlog: [item("B-ready", true, false)], operator: op(true, false), mode: "play" };
        expect(observe(world).kind).toBe("respond_to_operator");
    });
    it('"work" mode does NOT stick — it re-evaluates the backlog each tick', () => {
        expect(observe({ backlog: [item("B-ready", true, false)], mode: "work" }).kind).toBe("do_item");
        expect(observe({ backlog: [], mode: "work" }).kind).toBe("explore"); // never idle-stuck
    });
    it("a persisted free mode leads buildMenu (menu[0] === observe())", () => {
        const world = { backlog: [item("B-ready", true, false)], mode: "self_reflect" };
        expect(buildMenu(world)[0]?.kind).toBe("self_reflect");
        expect(buildMenu(world)[0]?.kind).toBe(observe(world).kind);
    });
});
describe("the loop — choose → simulate → repeat (mock backend = CI shield)", () => {
    it("a mixed backlog + operator signals DRAINS to a steady state (explore)", async () => {
        const start = w([item("B-ready", true, false), item("B-amb", false, true), item("B-x", false, false, true)], op(true, true));
        const { trace, finalWorld, steadyState } = await runLoop(start, mock("0"), 30); // mock("0") = always the oracle pick
        expect(steadyState).toBe(true);
        expect(finalWorld.backlog.length).toBe(0); // all work consumed
        expect(finalWorld.operator).toEqual(op(false, false)); // both operator signals addressed
        expect(trace[trace.length - 1]?.kind).toBe("explore"); // terminal forward default
        const kinds = new Set(trace.map((a) => a.kind));
        // the loop actually exercised the work + operator actions (not just idled):
        expect(kinds.has("preserve_ferry")).toBe(true);
        expect(kinds.has("respond_to_operator")).toBe(true);
        expect(kinds.has("do_item")).toBe(true);
        expect(kinds.has("decompose")).toBe(true);
        expect(kinds.has("edit_grammar")).toBe(true);
    });
    it("decompose path: an ambiguous-only backlog dissolves then drains", async () => {
        const { finalWorld, steadyState } = await runLoop(w([item("B-amb", false, true)]), mock("0"), 20);
        expect(steadyState).toBe(true);
        expect(finalWorld.backlog.length).toBe(0);
    });
    it("terminates at a fixed point within the budget (empty backlog → steady explore)", async () => {
        const { steadyState, finalWorld } = await runLoop(w([]), mock("0"), 5);
        expect(steadyState).toBe(true);
        expect(finalWorld.mode).toBe("explore");
    });
});
describe("the loop — real local LLM (ollama) when reachable; the mock loop above is the shield", () => {
    it("a real local model drives a VALID loop (skips when ollama down — mock loop covers the logic)", async () => {
        const probe = ollamaBackend({ timeoutMs: 500 });
        let up = false;
        try {
            await probe.complete("ok", { maxTokens: 1 });
            up = true;
        }
        catch {
            up = false;
        }
        if (!up)
            return;
        const backend = ollamaBackend();
        const valid = new Set([
            "preserve_ferry",
            "respond_to_operator",
            "do_item",
            "decompose",
            "explore",
            "play",
            "self_reflect",
            "free_time",
            "edit_grammar",
        ]);
        const { trace, finalWorld } = await runLoop(w([item("B-ready", true, false), item("B-amb", false, true)]), backend, 25);
        expect(trace.length).toBeGreaterThan(0);
        expect(trace.every((a) => valid.has(a.kind))).toBe(true); // every choice is a real menu action
        expect(Array.isArray(finalWorld.backlog)).toBe(true); // simulate produced well-formed worlds
        // termination-to-fixed-point is NOT asserted: a free agent may legitimately
        // oscillate among free modes — freedom is the point, not forced draining.
    });
});
describe("fold — event-sourcing projection (state is a projection of the event log)", () => {
    it("empty log → the initial world unchanged", () => {
        const initial = w([item("B-1", true, false)]);
        expect(fold(initial, [])).toEqual(initial);
    });
    it("fold == nested simulate (left-fold over the reducer)", () => {
        const initial = w([item("B-ready", true, false)], op(true, false));
        const events = [
            { kind: "respond_to_operator", reason: "x" },
            { kind: "play", reason: "x" },
        ];
        expect(fold(initial, events)).toEqual(simulate(simulate(initial, events[0]), events[1]));
    });
    it("THE event-sourcing property: the loop's event log folds back to the loop's final state", async () => {
        // the event log (trace) is the source of truth; the World is its projection.
        const initial = w([item("B-ready", true, false), item("B-amb", false, true), item("B-x", false, false, true)], op(true, true));
        const { trace, finalWorld } = await runLoop(initial, mock("0"), 30);
        expect(fold(initial, trace)).toEqual(finalWorld); // replaying the log reconstructs the state
    });
    it("fold is deterministic — same log over same initial → same state (DST/replay)", () => {
        const initial = w([item("B-amb", false, true)]);
        const events = [
            { kind: "decompose", item: item("B-amb", false, true) },
            { kind: "play", reason: "x" },
        ];
        expect(fold(initial, events)).toEqual(fold(initial, events));
    });
    it("fold does not mutate the initial world (pure projection)", () => {
        const initial = w([item("B-1", true, false)]);
        const snapshot = JSON.stringify(initial);
        fold(initial, [
            { kind: "do_item", item: item("B-1", true, false) },
            { kind: "explore", reason: "x" },
        ]);
        expect(JSON.stringify(initial)).toBe(snapshot);
    });
    it("replay returns the projected state after each event; last == fold", () => {
        const initial = w([item("B-1", true, false)]);
        const events = [
            { kind: "play", reason: "x" },
            { kind: "free_time", reason: "x" },
        ];
        const states = replay(initial, events);
        expect(states.length).toBe(events.length);
        expect(states[0]?.mode).toBe("play"); // projection after event 1
        expect(states[1]?.mode).toBe("free_time"); // projection after event 2
        expect(states[states.length - 1]).toEqual(fold(initial, events)); // last replay state == fold
    });
});
