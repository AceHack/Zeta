import { describe, expect, test } from "bun:test";
import type { DeclarerLedger, Freedom } from "./mutation-freedoms";
import {
  ESCAPE_INDEX,
  GRID_SIZE,
  OffMenuError,
  choose,
  escapeProfile,
  escapeTo,
  observeFinding,
  recordChoice,
  type Readout,
} from "./mutation-readout";

// The 4x4 controller grammar for a mutation finding. These tests pin the four properties that make
// it a MENU rather than a flag: bounded, deterministic, escapable, and recorded as a FORK.

const room = { source: "a.ts", test: "a.test.ts", mutation: "gte-to-gt" };

const freedom = (over: Partial<Freedom> = {}): Freedom => ({
  ...room,
  reason: "genuinely unconstrained",
  declaredAt: "2026-08-11T00:00:00.000Z",
  ...over,
});
const ledger = (declarer: string, freedoms: Freedom[]): DeclarerLedger => ({ declarer, freedoms });

describe("BOUNDED — an agent cannot invent a response", () => {
  test("the grid is always exactly 16 slots", () => {
    expect(observeFinding(room, "otto", []).grid.length).toBe(GRID_SIZE);
    expect(observeFinding(room, "otto", [ledger("otto", [freedom()])]).grid.length).toBe(GRID_SIZE);
  });

  test("a choice off the menu is REFUSED — the bound is structural, not advisory", () => {
    const r = observeFinding(room, "otto", []);
    expect(() => choose(r, -1)).toThrow(OffMenuError);
    expect(() => choose(r, GRID_SIZE)).toThrow(OffMenuError);
    expect(() => choose(r, 1.5)).toThrow(OffMenuError);
  });

  test("the offered actions are the closed grammar — declare, write-test, defer", () => {
    const kinds = observeFinding(room, "otto", [])
      .grid.filter((c): c is NonNullable<typeof c> => c !== undefined)
      .map((c) => c.action.kind);
    expect(kinds).toContain("declare-free");
    expect(kinds).toContain("write-test");
    expect(kinds).toContain("defer");
    expect(kinds).toContain("escape");
  });
});

describe("the menu ADAPTS to the finding — otherwise it is a flag with extra steps", () => {
  test("already declared free by me: retract is offered, declare is NOT", () => {
    const r = observeFinding(room, "otto", [ledger("otto", [freedom()])]);
    const kinds = r.grid.filter((c) => c).map((c) => c!.action.kind);
    expect(kinds).toContain("retract-mine");
    expect(kinds).not.toContain("declare-free");
  });

  test("another declarer's freedom becomes a READ cell — you are shown them before contradicting", () => {
    const r = observeFinding(room, "otto", [ledger("vera", [freedom()])]);
    const read = r.grid.find((c) => c?.action.kind === "read-declarer");
    expect(read).toBeDefined();
    expect((read!.action as { declarer: string }).declarer).toBe("vera");
  });

  test("a RETRACTED freedom does not populate a read cell — retracted is history, not a live claim", () => {
    const retracted = freedom({ retractedAt: "2026-08-12T00:00:00.000Z", retractedReason: "changed my mind" });
    const r = observeFinding(room, "otto", [ledger("vera", [retracted])]);
    expect(r.grid.find((c) => c?.action.kind === "read-declarer")).toBeUndefined();
  });
});

describe("DETERMINISTIC — the same inputs build the same menu, and say why", () => {
  test("identical inputs produce an identical grid", () => {
    const ls = [ledger("vera", [freedom()])];
    const a = observeFinding(room, "otto", ls);
    const b = observeFinding(room, "otto", ls);
    expect(JSON.stringify(a.grid)).toBe(JSON.stringify(b.grid));
    expect(a.rulesApplied).toEqual(b.rulesApplied);
  });

  test("rulesApplied records the construction, so a choice can be replayed", () => {
    const r = observeFinding(room, "otto", [ledger("vera", [freedom()])]);
    expect(r.rulesApplied.join(" ")).toContain("declarer=otto");
    expect(r.rulesApplied.join(" ")).toContain("others_declaring=vera");
    expect(r.rulesApplied.join(" ")).toContain(`escape=always@${ESCAPE_INDEX}`);
  });
});

describe("ESCAPE — total transition, possibly partial destination", () => {
  test("the escape is ALWAYS the last cell, at every level, with no precondition", () => {
    for (const ls of [[], [ledger("otto", [freedom()])], [ledger("vera", [freedom()])]]) {
      const r = observeFinding(room, "otto", ls);
      expect(r.grid[ESCAPE_INDEX]!.action.kind).toBe("escape");
    }
    // ... and it survives descending several levels.
    let r: Readout = observeFinding(room, "otto", []);
    for (let i = 0; i < 4; i++) r = escapeTo(r, "otto", []);
    expect(r.level).toBe(4);
    expect(r.grid[ESCAPE_INDEX]!.action.kind).toBe("escape");
  });

  test("an EMPTY slot is not an error — choosing it is how the frontier gets defined", () => {
    const r = observeFinding(room, "otto", []);
    const emptyIdx = r.grid.findIndex((c, i) => c === undefined && i < ESCAPE_INDEX);
    expect(emptyIdx).toBeGreaterThan(-1);
    const action = choose(r, emptyIdx);
    // Reachable, recorded, and an invitation — NOT a refusal.
    expect(action.kind).toBe("undefined-cell");
  });

  test("the destination may be partial — escaping does not promise a full grid", () => {
    const next = escapeTo(observeFinding(room, "otto", []), "otto", []);
    expect(next.grid.some((c) => c === undefined)).toBe(true); // partial, and that is honest
    expect(next.grid[ESCAPE_INDEX]).toBeDefined(); // but the door out is still complete
  });
});

describe("RECORDED — the entry is a FORK, not just a destination", () => {
  test("the transcript records what was OFFERED, not only what was taken", () => {
    const r = observeFinding(room, "otto", []);
    const entry = recordChoice(r, "otto", 0, choose(r, 0));
    expect(entry.offered.length).toBe(GRID_SIZE);
    expect(entry.offered.some((l) => l.includes("declare free"))).toBe(true);
    // Which is what makes an unchosen branch returnable later.
    expect(entry.offered.some((l) => l.includes("write the test"))).toBe(true);
  });

  test("identical decisions DEDUP to one content address; different ones do not", () => {
    const r = observeFinding(room, "otto", []);
    const a = recordChoice(r, "otto", 0, choose(r, 0));
    const b = recordChoice(r, "otto", 0, choose(r, 0));
    const c = recordChoice(r, "otto", 1, choose(r, 1));
    expect(a.address).toBe(b.address);
    expect(a.address).not.toBe(c.address);
  });

  test("the SAME decision by a different declarer is a different entry — the rainbow is preserved", () => {
    const r = observeFinding(room, "otto", []);
    const mine = recordChoice(r, "otto", 0, choose(r, 0));
    const theirs = recordChoice(r, "vera", 0, choose(r, 0));
    expect(mine.address).not.toBe(theirs.address);
  });
});

describe("the FRONTIER MAP — two numbers, deliberately not one", () => {
  test("escapes are split by where they LAND", () => {
    const r = observeFinding(room, "otto", []);
    const emptyIdx = r.grid.findIndex((c, i) => c === undefined && i < ESCAPE_INDEX);

    const entries = [
      recordChoice(r, "otto", ESCAPE_INDEX, choose(r, ESCAPE_INDEX)), // into a defined escape
      recordChoice(r, "otto", emptyIdx, choose(r, emptyIdx)), // into undefined space
      recordChoice(r, "otto", emptyIdx, choose(r, emptyIdx)),
    ];

    // Summing these would hide the distinction that makes the metric useful: "vocabulary too
    // narrow" and "the system is growing here" are different findings.
    expect(escapeProfile(entries)).toEqual({ intoDefined: 1, intoUndefined: 2 });
  });

  test("ordinary choices are not counted as escapes", () => {
    const r = observeFinding(room, "otto", []);
    expect(escapeProfile([recordChoice(r, "otto", 0, choose(r, 0))])).toEqual({
      intoDefined: 0,
      intoUndefined: 0,
    });
  });
});
