/**
 * tools/observe/observe.test.ts — the controller's decision table.
 *
 * Three layers:
 *  - the pure `observe()` decision table over a World (exact assertions);
 *  - the operator-channel priority (operator OUTRANKS backlog; presence-gated);
 *  - the v1 `observeWithLlm` chooser, graded against `observe()` as the
 *    reference oracle using a MOCK backend (deterministic, no ollama). This is
 *    the always-green CI shield for the chooser LOGIC — per the shield rule,
 *    coverage must not depend on a live ollama. The live qwen2.5:0.5b run is a
 *    watchable DEMO (`bun observe.ts`), not a skippable test.
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

describe("observe — backlog controller (no operator channel wired)", () => {
  it("do_item: a ready, unambiguous item is picked", () => {
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

  it("free_time: nothing ready, decomposable, or grammar-extending", () => {
    expect(observe(w([item("B-4", false, false)])).kind).toBe("free_time");
  });

  it("free_time: empty backlog", () => {
    expect(observe(w([])).kind).toBe("free_time");
  });

  it("invariant: an exit is always reachable (free_time when no work; edit_grammar on a signal)", () => {
    const exits = new Set(["free_time", "edit_grammar"]);
    expect(exits.has(observe(w([item("B-idle", false, false)])).kind)).toBe(true);
    expect(exits.has(observe(w([])).kind)).toBe(true);
    expect(observe(w([item("B-x", false, false, true)])).kind).toBe("edit_grammar");
  });

  it("priority order is do > decompose > edit_grammar > free_time", () => {
    const all = observe(w([item("B-edit", false, false, true), item("B-amb", false, true), item("B-ready", true, false)]));
    expect(all.kind).toBe("do_item");
    const noReady = observe(w([item("B-edit", false, false, true), item("B-amb", false, true)]));
    expect(noReady.kind).toBe("decompose");
    const onlyEdit = observe(w([item("B-edit", false, false, true), item("B-idle", false, false)]));
    expect(onlyEdit.kind).toBe("edit_grammar");
  });
});

describe("observe — operator channel OUTRANKS the backlog (presence-gated)", () => {
  // A ready item the backlog controller would normally pick — used to prove the
  // operator preempts it.
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

  it("a wired-but-quiet operator falls through to the backlog (no false preemption)", () => {
    const a = observe(w(readyBacklog, op(false, false)));
    expect(a.kind).toBe("do_item");
    if (a.kind === "do_item") expect(a.item.id).toBe("B-ready");
  });

  it("an absent operator channel behaves exactly like the backlog controller (background agent)", () => {
    expect(observe(w(readyBacklog)).kind).toBe("do_item");
    expect(observe(w([item("B-amb", false, true)])).kind).toBe("decompose");
    expect(observe(w([])).kind).toBe("free_time");
  });

  it("operator preempts even decompose / edit_grammar / free_time states", () => {
    expect(observe(w([item("B-amb", false, true)], op(true, false))).kind).toBe("respond_to_operator");
    expect(observe(w([item("B-x", false, false, true)], op(true, false))).kind).toBe("respond_to_operator");
    expect(observe(w([], op(false, true))).kind).toBe("preserve_ferry");
  });
});

describe("observeWithLlm — chooser graded vs the pure oracle (mock backend = CI shield)", () => {
  // Representative scenarios reused as the grading oracle — including operator states.
  const scenarios: ReadonlyArray<World> = [
    w([item("B-ready", true, false), item("B-amb", false, true)]), // do wins
    w([item("B-amb", false, true)]), // decompose
    w([item("B-x", false, false, true)]), // edit_grammar
    w([item("B-idle", false, false)]), // free_time
    w([]), // empty → free_time
    w([item("B-ready", true, false)], op(true, false)), // respond_to_operator
    w([item("B-ready", true, false)], op(true, true)), // preserve_ferry
    w([item("B-ready", true, false)], op(false, false)), // quiet operator → do
  ];

  it("buildMenu ALWAYS includes both exits (edit_grammar + free_time) for any world", () => {
    for (const world of scenarios) {
      const kinds = buildMenu(world).map((a) => a.kind);
      expect(kinds).toContain("edit_grammar");
      expect(kinds).toContain("free_time");
    }
  });

  it("buildMenu is oracle-ordered: menu[0] == observe() — so fallback-to-0 degrades toward correct", () => {
    for (const world of scenarios) {
      expect(buildMenu(world)[0]?.kind).toBe(observe(world).kind);
    }
  });

  it("operator actions lead the menu when the channel is wired + signalling", () => {
    expect(buildMenu(w([item("B-ready", true, false)], op(true, true)))[0]?.kind).toBe("preserve_ferry");
    expect(buildMenu(w([item("B-ready", true, false)], op(true, false)))[0]?.kind).toBe("respond_to_operator");
  });

  it("maps the model's chosen index to the menu entry (order-agnostic)", async () => {
    const world = w([item("B-ready", true, false), item("B-amb", false, true)]);
    const menu = buildMenu(world);
    for (const [i, entry] of menu.entries()) {
      const chosen = await observeWithLlm(world, mock(String(i)));
      expect(chosen.kind).toBe(entry.kind);
    }
    const kinds = menu.map((a) => a.kind);
    expect(kinds).toContain("edit_grammar");
    expect(kinds).toContain("free_time");
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
