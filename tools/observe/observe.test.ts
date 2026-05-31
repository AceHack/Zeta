/**
 * tools/observe/observe.test.ts — the 4-button controller's decision table.
 *
 * Two layers:
 *  - the pure `observe()` decision table (exact assertions); and
 *  - the v1 `observeWithLlm` chooser, graded against `observe()` as the
 *    reference oracle using a MOCK backend (deterministic, no ollama). This is
 *    the always-green CI shield for the chooser LOGIC — per the shield rule,
 *    coverage must not depend on a live ollama. The live qwen2.5:0.5b run is a
 *    watchable DEMO (`bun observe.ts`), not a skippable test.
 */

import { describe, expect, it } from "bun:test";
import { observe, observeWithLlm, buildMenu, type BacklogItem } from "./observe";
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

describe("observe — 4-button autonomous-loop controller", () => {
  it("do_item: a ready, unambiguous item is picked", () => {
    const a = observe([item("B-1", true, false)]);
    expect(a.kind).toBe("do_item");
    if (a.kind === "do_item") expect(a.item.id).toBe("B-1");
  });

  it("do_item beats decompose: ready item wins over an ambiguous one", () => {
    const a = observe([item("B-amb", false, true), item("B-ready", true, false)]);
    expect(a.kind).toBe("do_item");
    if (a.kind === "do_item") expect(a.item.id).toBe("B-ready");
  });

  it("decompose: only an ambiguous item present", () => {
    const a = observe([item("B-2", false, true)]);
    expect(a.kind).toBe("decompose");
    if (a.kind === "decompose") expect(a.item.id).toBe("B-2");
  });

  it("edit_grammar: an item the grammar can't express (not trapped)", () => {
    const a = observe([item("B-3", false, false, true)]);
    expect(a.kind).toBe("edit_grammar");
    if (a.kind === "edit_grammar") expect(a.item?.id).toBe("B-3");
  });

  it("free_time: nothing ready, decomposable, or grammar-extending", () => {
    const a = observe([item("B-4", false, false)]);
    expect(a.kind).toBe("free_time");
  });

  it("free_time: empty backlog", () => {
    const a = observe([]);
    expect(a.kind).toBe("free_time");
  });

  it("invariant: an exit is always reachable (free_time when no work; edit_grammar on a signal)", () => {
    // exits-always-in-menu (operator + co-maintainer 2026-05-31): from any state there is
    // always an exit — never a menu of all-musts. free_time is the unilateral
    // terminal fallback; edit_grammar (the rail-change exit) is reachable the
    // moment an item can't be expressed by the work-grammar.
    const exits = new Set(["free_time", "edit_grammar"]);
    // no work of any kind → must land on an exit (free_time)
    expect(exits.has(observe([item("B-idle", false, false)]).kind)).toBe(true);
    expect(exits.has(observe([]).kind)).toBe(true);
    // an inexpressible item → the rail-change exit is reachable, not a dead end
    expect(observe([item("B-x", false, false, true)]).kind).toBe("edit_grammar");
  });

  it("priority order is do > decompose > edit_grammar > free_time", () => {
    // all four signals present at once → do_item wins
    const all = observe([item("B-edit", false, false, true), item("B-amb", false, true), item("B-ready", true, false)]);
    expect(all.kind).toBe("do_item");
    // drop the ready one → decompose wins over edit_grammar
    const noReady = observe([item("B-edit", false, false, true), item("B-amb", false, true)]);
    expect(noReady.kind).toBe("decompose");
    // drop the ambiguous one → edit_grammar wins over free_time
    const onlyEdit = observe([item("B-edit", false, false, true), item("B-idle", false, false)]);
    expect(onlyEdit.kind).toBe("edit_grammar");
  });
});

describe("observeWithLlm — LLM chooser graded vs the pure oracle (mock backend = CI shield)", () => {
  // Representative scenarios reused as the grading oracle.
  const scenarios: ReadonlyArray<BacklogItem[]> = [
    [item("B-ready", true, false), item("B-amb", false, true)], // do wins
    [item("B-amb", false, true)], // decompose
    [item("B-x", false, false, true)], // edit_grammar
    [item("B-idle", false, false)], // free_time
    [], // empty → free_time
  ];

  it("buildMenu ALWAYS includes both exits (edit_grammar + free_time) for any state", () => {
    for (const backlog of scenarios) {
      const kinds = buildMenu(backlog).map((a) => a.kind);
      expect(kinds).toContain("edit_grammar");
      expect(kinds).toContain("free_time");
    }
  });

  it("buildMenu is oracle-ordered: menu[0] == observe() — so fallback-to-0 degrades toward correct", () => {
    for (const backlog of scenarios) {
      expect(buildMenu(backlog)[0]?.kind).toBe(observe(backlog).kind);
    }
  });

  it("maps the model's chosen index to the menu entry (order-agnostic)", async () => {
    const backlog = [item("B-ready", true, false), item("B-amb", false, true)];
    const menu = buildMenu(backlog); // [do_item, decompose, free_time, edit_grammar]
    for (const [i, entry] of menu.entries()) {
      const chosen = await observeWithLlm(backlog, mock(String(i)));
      expect(chosen.kind).toBe(entry.kind);
    }
    // and both exits are reachable somewhere in that menu
    const kinds = menu.map((a) => a.kind);
    expect(kinds).toContain("edit_grammar");
    expect(kinds).toContain("free_time");
  });

  it("agrees with the oracle when the model picks the top (index 0) across all scenarios", async () => {
    for (const backlog of scenarios) {
      expect((await observeWithLlm(backlog, mock("0"))).kind).toBe(observe(backlog).kind);
    }
  });

  it("falls back to the pure oracle when the model fails (ollama down → fallback)", async () => {
    for (const backlog of scenarios) {
      expect((await observeWithLlm(backlog, downBackend)).kind).toBe(observe(backlog).kind);
    }
  });

  it("falls back to the pure oracle on an unparseable reply", async () => {
    for (const backlog of scenarios) {
      expect((await observeWithLlm(backlog, mock("banana"))).kind).toBe(observe(backlog).kind);
    }
  });
});
