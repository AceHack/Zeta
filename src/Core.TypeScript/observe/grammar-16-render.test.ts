/**
 * Tests for the Option-A render: free modes collapse under slot 14 as a sub-menu;
 * the 16 top-level directions stay fixed. Verifies the projection + the Option-A
 * invariant (no dedicated top-level free-mode slots) + leadSlot.
 */
import { describe, expect, it } from "bun:test";
import type { BacklogItem, NextAction, OperatorChannel, World } from "./observe";
import { GRAMMAR_16_V0, SLOT } from "./grammar-16";
import { renderGrammar16, leadSlot, type RenderedMenuSlot } from "./grammar-16-render";
import { defaultNodeSession } from "./first-session";

const item = (over: Partial<BacklogItem> = {}): BacklogItem => ({
  id: "081KPYCJH0008QG0R003MDS51N",
  title: "an item",
  ready: false,
  ambiguous: false,
  ...over,
});

const op = (over: Partial<OperatorChannel> = {}): OperatorChannel => ({
  pendingMessage: false,
  pendingFerry: false,
  ...over,
});

const EMPTY: World = { backlog: [] };
const READY: World = { backlog: [item({ id: "081KQ0YZ80008QG0R00264RY8Z", title: "ready one", ready: true })] };
const AMBIGUOUS: World = { backlog: [item({ id: "081KQ0YZ80008QG0R000T0AJXS", title: "fuzzy one", ambiguous: true })] };
const OPERATOR_SPOKE: World = { backlog: [], operator: op({ pendingMessage: true }) };
const FREE_PERSISTED: World = { backlog: [item({ ready: true })], mode: "play" };

const slotOf = (slots: readonly RenderedMenuSlot[], i: number) => slots.find((s) => s.index === i)!;
const FREE_KINDS = new Set<NextAction["kind"]>(["explore", "play", "self_reflect", "free_time"]);

describe("renderGrammar16 — shape", () => {
  it("returns exactly the 16 fixed slots in order", () => {
    const r = renderGrammar16(EMPTY);
    expect(r).toHaveLength(16);
    expect(r.map((s) => s.index)).toEqual(GRAMMAR_16_V0.map((s) => s.index));
    expect(r.map((s) => s.controllerInput)).toEqual(GRAMMAR_16_V0.map((s) => s.controllerInput));
  });

  it("availability values are the canonical Tri ({s})", () => {
    for (const s of renderGrammar16(READY)) {
      expect(["T", "F", "N"]).toContain(s.availability.s);
    }
  });
});

describe("renderGrammar16 — slot 14 free-mode sub-menu (Option A)", () => {
  it("slot 14 is always T with the 4 free modes as a sub-menu — empty backlog", () => {
    const s14 = slotOf(renderGrammar16(EMPTY), SLOT.FREE_TIME);
    expect(s14.availability.s).toBe("T");
    expect(new Set(s14.subMenu?.map((a) => a.kind))).toEqual(FREE_KINDS);
  });

  it("slot 14 stays T + full sub-menu even with work present (freedom-always-in-menu)", () => {
    const s14 = slotOf(renderGrammar16(READY), SLOT.FREE_TIME);
    expect(s14.availability.s).toBe("T");
    expect(s14.subMenu).toHaveLength(4);
  });

  it("sub-menu order is CANONICAL + STABLE — a persisted mode does not reshuffle it (Copilot #6277)", () => {
    const CANON: NextAction["kind"][] = ["explore", "play", "self_reflect", "free_time"];
    // default + with `play` persisted (which leads buildMenu) must both be canonical order
    for (const w of [EMPTY, READY, FREE_PERSISTED /* mode: "play" */]) {
      const s14 = slotOf(renderGrammar16(w), SLOT.FREE_TIME);
      expect(s14.subMenu?.map((a) => a.kind)).toEqual(CANON);
    }
  });

  it("slot 14 stays T + full sub-menu even when the operator spoke (NCI: never gated)", () => {
    const s14 = slotOf(renderGrammar16(OPERATOR_SPOKE), SLOT.FREE_TIME);
    expect(s14.availability.s).toBe("T");
    expect(new Set(s14.subMenu?.map((a) => a.kind))).toEqual(FREE_KINDS);
  });

  it("OPTION A INVARIANT: free modes appear ONLY in slot 14's sub-menu, never as a top-level slot", () => {
    const r = renderGrammar16(READY);
    for (const s of r) {
      if (s.index === SLOT.FREE_TIME) continue;
      // no other top-level slot carries a free-mode sub-menu
      expect(s.subMenu === undefined || s.subMenu.every((a) => !FREE_KINDS.has(a.kind))).toBe(true);
    }
  });
});

describe("renderGrammar16 — slot 4 (the primary act)", () => {
  it("T with a do-item label when a ready item exists", () => {
    const s4 = slotOf(renderGrammar16(READY), SLOT.ACCEPT);
    expect(s4.availability.s).toBe("T");
    expect(s4.label).toContain("081KQ0YZ80008QG0R00264RY8Z");
  });

  it("decompose label when only an ambiguous item exists", () => {
    const s4 = slotOf(renderGrammar16(AMBIGUOUS), SLOT.ACCEPT);
    expect(s4.availability.s).toBe("T");
    expect(s4.label.toLowerCase()).toContain("decompose");
  });

  it("F (nothing to commit) when the backlog is empty", () => {
    const s4 = slotOf(renderGrammar16(EMPTY), SLOT.ACCEPT);
    expect(s4.availability.s).toBe("F");
  });
});

describe("renderGrammar16 — always-available slots", () => {
  it("edit-grammar (7), inspect (6), refresh (12), status (13), escalate (15) are T", () => {
    const r = renderGrammar16(EMPTY);
    for (const i of [SLOT.EDIT_GRAMMAR, SLOT.INSPECT, 12, SLOT.STATUS_GLASS_HALO, SLOT.ESCALATE]) {
      expect(slotOf(r, i).availability.s).toBe("T");
    }
  });

  it("unwired navigation/scope slots are N (held/uncertain) in v0", () => {
    const r = renderGrammar16(READY);
    for (const i of [0, 1, 2, 3, 8, 9, SLOT.UNDO_RETRACT, 11]) {
      expect(slotOf(r, i).availability.s).toBe("N");
    }
  });
});

describe("leadSlot — oracle pick -> slot (operator-priority is not a slot)", () => {
  it("ready work -> slot 4", () => {
    expect(leadSlot(READY)).toBe(SLOT.ACCEPT);
  });

  it("persisted free mode -> slot 14", () => {
    expect(leadSlot(FREE_PERSISTED)).toBe(SLOT.FREE_TIME);
  });

  it("empty backlog (explore default) -> slot 14 (free modes group)", () => {
    // observe() defaults to explore on empty backlog; explore renders under slot 14
    expect(leadSlot(EMPTY)).toBe(SLOT.FREE_TIME);
  });

  it("operator spoke -> null (operator-priority is above the menu, not a slot)", () => {
    expect(leadSlot(OPERATOR_SPOKE)).toBeNull();
  });
});

describe("renderGrammar16 — first-session overlay (slice 4)", () => {
  const PENDING: World = {
    backlog: [item({ id: "081KQB8J40008QG0R002PEP2A2", title: "ready work", ready: true })],
    nodeSession: defaultNodeSession(),
  };

  it("slot 4 carries first-session sub-menu when nodeSession pending", () => {
    const accept = slotOf(renderGrammar16(PENDING), SLOT.ACCEPT);
    expect(accept.availability.s).toBe("T");
    expect(accept.firstSessionSubMenu?.length).toBeGreaterThan(0);
    expect(accept.label).toContain("gh");
  });

  it("leadSlot highlights slot 4 while first-session pending", () => {
    expect(leadSlot(PENDING)).toBe(SLOT.ACCEPT);
  });
});
