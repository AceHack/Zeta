/**
 * src/Core.TypeScript/observe/golden-vectors.test.ts — the conformance fixture is in sync + the
 * reference fold/replay reproduce it. The committed golden-vectors.json is the
 * cross-language spec (081KSXN940008QG0R0033T2BQT); these tests keep it honest on the TS side. The
 * F#/C#/Rust impls will run the SAME fixture and assert the same expected states.
 */

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { fold, replay, simulate, type NextAction, type World } from "./observe";
import {
  GOLDEN_INITIAL,
  GOLDEN_EVENTS,
  generateGoldenVectors,
  toTreatyWorld,
  TREATY_WORLD_FIELDS,
  GOLDEN_VECTORS_PATH,
  type GoldenVectors,
} from "./golden-vectors";

describe("golden-vectors — cross-language conformance fixture (081KSXN940008QG0R0033T2BQT)", () => {
  const committed = JSON.parse(readFileSync(GOLDEN_VECTORS_PATH, "utf8")) as GoldenVectors;
  const generated = generateGoldenVectors();

  it("committed golden-vectors.json is in sync with the generator (regen is deterministic / DST)", () => {
    expect(committed).toEqual(generated);
  });

  it("the reference fold reproduces expectedFinalState", () => {
    expect(toTreatyWorld(fold(GOLDEN_INITIAL, GOLDEN_EVENTS))).toEqual(committed.expectedFinalState);
  });

  it("the reference replay reproduces expectedReplayStates (one per event)", () => {
    const states = replay(GOLDEN_INITIAL, GOLDEN_EVENTS).map(toTreatyWorld);
    expect(states).toEqual([...committed.expectedReplayStates]); // spread: readonly[] → []
    expect(states.length).toBe(GOLDEN_EVENTS.length);
  });

  it("the scenario exercises ALL nine NextAction kinds (full-algebra coverage)", () => {
    const kinds = new Set(GOLDEN_EVENTS.map((e) => e.kind));
    const all: NextAction["kind"][] = [
      "preserve_ferry",
      "respond_to_operator",
      "do_item",
      "decompose",
      "edit_grammar",
      "explore",
      "play",
      "self_reflect",
      "free_time",
    ];
    for (const k of all) expect(kinds.has(k)).toBe(true);
  });

  it("the scenario drains the backlog + clears the operator + ends in a free mode (sanity)", () => {
    expect(committed.expectedFinalState.backlog.length).toBe(0);
    expect(committed.expectedFinalState.operator).toEqual({ pendingMessage: false, pendingFerry: false });
    expect(committed.expectedFinalState.mode).toBe("free_time");
  });
});

// ─── the treaty BOUNDARY — what may and may not enter the cross-language lock ──
//
// The fixture is the contract F#/C#/Rust read. Those oracles parse `backlog`,
// `operator`, `mode` and IGNORE every other key — so a field added to the TS
// `World` and folded into the vectors would put them out of conformance with
// NOTHING going red. (Lived instance: `World.history`, added by the Z-Set
// Time-Travel commit, landed in the folded state; the three oracles kept passing
// because their parsers never look at it.) These tests are the alarm that was
// missing: the treaty is a declared surface, and drift across it must fail here.

describe("golden-vectors — the treaty boundary is explicit and does not drift", () => {
  const committedRaw = JSON.parse(readFileSync(GOLDEN_VECTORS_PATH, "utf8")) as {
    initialWorld: Record<string, unknown>;
    expectedFinalState: Record<string, unknown>;
    expectedReplayStates: Record<string, unknown>[];
  };

  const worldObjects = [
    committedRaw.initialWorld,
    committedRaw.expectedFinalState,
    ...committedRaw.expectedReplayStates,
  ];

  it("every world in the committed fixture carries ONLY treaty fields", () => {
    expect(worldObjects.length).toBeGreaterThan(0);
    for (const w of worldObjects) {
      const extra = Object.keys(w).filter((k) => !(TREATY_WORLD_FIELDS as readonly string[]).includes(k));
      expect(extra).toEqual([]);
    }
  });

  it("the treaty surface is exactly what the other three oracles parse (backlog, operator, mode)", () => {
    // Locked as data, not prose: changing this list is the deliberate act of
    // changing the contract, and it must be accompanied by an F#/C#/Rust change.
    expect([...TREATY_WORLD_FIELDS]).toEqual(["backlog", "operator", "mode"]);
  });

  it("the projection CARRIES every treaty field it is given (it is not vacuously empty)", () => {
    const full: World = {
      backlog: [{ id: "X", title: "X", ready: true, ambiguous: false }],
      operator: { pendingMessage: true, pendingFerry: false },
      mode: "play",
      history: [{ type: "retract_time", item: null }],
      cartography: { scopeLevel: 3, timeOffset: -1 },
    };
    expect(toTreatyWorld(full)).toEqual({
      backlog: [{ id: "X", title: "X", ready: true, ambiguous: false }],
      operator: { pendingMessage: true, pendingFerry: false },
      mode: "play",
    });
  });

  it("absent optionals stay ABSENT (the shape the other oracles' parsers expect)", () => {
    const bare = toTreatyWorld({ backlog: [] });
    expect(Object.keys(bare)).toEqual(["backlog"]);
  });

  // The property the whole design buys: local bookkeeping is invisible to the
  // treaty. Seed a DIFFERENT ledger into the initial world and the projected
  // fold/replay must be byte-for-byte the same contract.
  it("local (non-treaty) state cannot move the conformance-folded result", () => {
    const seeded: World = {
      ...GOLDEN_INITIAL,
      history: [{ type: "do_item", item: { id: "LOCAL", title: "local", ready: true, ambiguous: false } }],
      cartography: { scopeLevel: 7, timeOffset: 7 },
    };
    expect(toTreatyWorld(fold(seeded, GOLDEN_EVENTS))).toEqual(toTreatyWorld(fold(GOLDEN_INITIAL, GOLDEN_EVENTS)));
    expect(replay(seeded, GOLDEN_EVENTS).map(toTreatyWorld)).toEqual(
      replay(GOLDEN_INITIAL, GOLDEN_EVENTS).map(toTreatyWorld),
    );
  });

  // …and the guard above is NOT vacuous: the ledger really is written by the fold,
  // so "the projection hides it" is a claim with something behind it.
  it("the ledger IS populated by the fold (so excluding it is a real exclusion)", () => {
    const folded = fold(GOLDEN_INITIAL, GOLDEN_EVENTS);
    const doItemCount = GOLDEN_EVENTS.filter((e) => e.kind === "do_item").length;
    expect(doItemCount).toBeGreaterThan(0);
    expect(folded.history?.length).toBe(doItemCount);
    expect(folded.history?.every((h) => h.type === "do_item")).toBe(true);
  });

  // §5 memory preservation / Z-set discipline, stated as a test at the ledger:
  // a retraction APPENDS the −1; it never destroys the +1.
  it("retraction appends to the ledger and never pops it (Z-set, §5)", () => {
    const item = { id: "A", title: "A", ready: true, ambiguous: false };
    const done = simulate({ backlog: [item] }, { kind: "do_item", item });
    const retracted = simulate(done, { kind: "retract_time", reason: "undo" });
    expect(done.history?.length).toBe(1);
    expect(retracted.history?.length).toBe(2);
    expect(retracted.history?.[0]).toEqual({ type: "do_item", item });
    expect(retracted.history?.[1]).toEqual({ type: "retract_time", item });
  });
});
