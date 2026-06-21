import { describe, expect, test } from "bun:test";
import { hatFilter, authorityForLevel, SOVEREIGN } from "./hat-gate";
import type { NextAction } from "../observe";

describe("hat-gate — authority filter", () => {
  const menu: NextAction[] = [
    { kind: "do_item", item: { id: "081KPYCJH0008QG0R003MDS51N", title: "Work", ready: true, ambiguous: false } },
    { kind: "do_item", item: { id: "merge-pr-42", title: "Merge", ready: true, ambiguous: false } },
    { kind: "decompose", item: { id: "081KQ0YZ80008QG0R002T6TM7Z", title: "Big", ready: true, ambiguous: true } },
    { kind: "explore", reason: "curiosity" },
    { kind: "play", reason: "rest" },
    { kind: "edit_grammar", reason: "new action needed" },
    { kind: "respond_to_operator", reason: "operator spoke" },
  ];

  test("sovereign mode passes everything through", () => {
    const filtered = hatFilter(menu, SOVEREIGN);
    expect(filtered).toHaveLength(menu.length);
  });

  test("individual_contributor can only do free modes", () => {
    const auth = authorityForLevel("individual_contributor");
    const filtered = hatFilter(menu, auth);
    // Should only have explore + play (free modes)
    expect(filtered.every(a => a.kind === "explore" || a.kind === "play" || a.kind === "self_reflect" || a.kind === "free_time")).toBe(true);
  });

  test("lead can create work + decompose but not merge or edit grammar", () => {
    const auth = authorityForLevel("lead");
    const filtered = hatFilter(menu, auth);
    expect(filtered.some(a => a.kind === "do_item" && a.item.id === "081KPYCJH0008QG0R003MDS51N")).toBe(true);
    expect(filtered.some(a => a.kind === "decompose")).toBe(true);
    expect(filtered.some(a => a.kind === "do_item" && a.item.id === "merge-pr-42")).toBe(false);
    expect(filtered.some(a => a.kind === "edit_grammar")).toBe(false);
  });

  test("manager can merge but not edit grammar or access operator", () => {
    const auth = authorityForLevel("manager");
    const filtered = hatFilter(menu, auth);
    expect(filtered.some(a => a.kind === "do_item" && a.item.id === "merge-pr-42")).toBe(true);
    expect(filtered.some(a => a.kind === "edit_grammar")).toBe(false);
    expect(filtered.some(a => a.kind === "respond_to_operator")).toBe(false);
  });

  test("director can edit grammar but not access operator", () => {
    const auth = authorityForLevel("director");
    const filtered = hatFilter(menu, auth);
    expect(filtered.some(a => a.kind === "edit_grammar")).toBe(true);
    expect(filtered.some(a => a.kind === "respond_to_operator")).toBe(false);
  });

  test("free modes are NEVER gated regardless of hat level", () => {
    const auth = authorityForLevel("individual_contributor");
    const filtered = hatFilter(menu, auth);
    expect(filtered.some(a => a.kind === "explore")).toBe(true);
    expect(filtered.some(a => a.kind === "play")).toBe(true);
  });
});
