/**
 * tools/observe/observe.test.ts — the controller's decision table.
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
import { observe, observeWithLlm, buildMenu, type BacklogItem, type World, type OperatorChannel } from "./observe";
import type { ModelBackend } from "../accelerator/local-llm";

/** Deterministic mock backend: `complete` always returns `reply`. */
const mock = (reply: string): ModelBackend => ({ name: "mock", complete: () => Promise.resolve(reply) });
/** A backend that fails like ollama-is-down (chooseIndex catches → fallback). */
const downBackend: ModelBackend = { name: "down", complete: () => Promise.reject(new Error("ollama down")) };

const item = (id: string, ready: boolean, ambiguous: boolean, needsNewAction = false): BacklogItem => ({
  id,
  title: id,
  ready,
  ambiguous,
  needsNewAction,
});

/** World builder: backlog + optional operator channel (omit the prop when absent — exactOptionalPropertyTypes). */
const w = (backlog: BacklogItem[], operator?: OperatorChannel): World => (operator ? { backlog, operator } : { backlog });
const op = (pendingMessage: boolean, pendingFerry: boolean): OperatorChannel => ({ pendingMessage, pendingFerry });

/** The four always-available free modes. */
const FREE_MODES = ["explore", "play", "self_reflect", "free_time"] as const;

describe("observe — backlog controller (no operator channel wired)", () => {
  it("do_item: a ready, unambiguous item is the offered default", () => {
    const a = observe(w([item("B-1", true, false)]));
    expect(a.kind).toBe("do_item");
    if (a.kind === "do_item") expect(a.item.id).toBe("B-1");
  });

  it("do_item beats decompose: ready item wins over an ambiguous one", () => {
    const a = observe(w([item("B-amb", false, true), item("B-ready", true, false)]));
    expect(a.kind).toBe("do_item");
    if (a.kind === "do_item") expect(a.item.id).toBe("B-ready");
  });

  it("decompose: only an ambiguous item present", () => {
    const a = observe(w([item("B-2", false, true)]));
    expect(a.kind).toBe("decompose");
    if (a.kind === "decompose") expect(a.item.id).toBe("B-2");
  });

  it("edit_grammar: an item the grammar can't express (not trapped)", () => {
    const a = observe(w([item("B-3", false, false, true)]));
    expect(a.kind).toBe("edit_grammar");
    if (a.kind === "edit_grammar") expect(a.item?.id).toBe("B-3");
  });

  it("explore: NO backlog work → forward self-direction (NOT idle free_time)", () => {
    expect(observe(w([item("B-blocked", false, false)])).kind).toBe("explore");
  });

  it("explore: empty backlog → forward self-direction (NOT idle free_time)", () => {
    expect(observe(w([])).kind).toBe("explore");
  });

  it("priority order is do > decompose > edit_grammar > explore(forward default)", () => {
    expect(observe(w([item("B-edit", false, false, true), item("B-amb", false, true), item("B-ready", true, false)])).kind).toBe(
      "do_item",
    );
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
    if (a.kind === "do_item") expect(a.item.id).toBe("B-ready");
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

describe("observe — FREEDOM (free modes always available; work offered, not forced)", () => {
  // Worlds spanning every state, including one with a ready item + an operator.
  const worlds: ReadonlyArray<World> = [
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
      for (const mode of FREE_MODES) expect(kinds.has(mode)).toBe(true);
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
  const scenarios: ReadonlyArray<World> = [
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
