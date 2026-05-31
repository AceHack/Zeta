/**
 * tools/observe/observe.test.ts — the 4-button controller's decision table.
 *
 * Pure function, so these are exact assertions (no LLM yet). When the
 * LLM-driven `observeWithLlm` lands, these scenarios become the reference
 * oracle it's graded against (declarative testing — see the design discussion).
 */

import { describe, expect, it } from "bun:test";
import { observe, type BacklogItem } from "./observe";

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
