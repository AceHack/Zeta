/**
 * src/Core.TypeScript/observe/golden-vectors.test.ts — the conformance fixture is in sync + the
 * reference fold/replay reproduce it. The committed golden-vectors.json is the
 * cross-language spec (081KSXN940008QG0R0033T2BQT); these tests keep it honest on the TS side. The
 * F#/C#/Rust impls will run the SAME fixture and assert the same expected states.
 */

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { fold, replay, type NextAction } from "./observe";
import {
  GOLDEN_INITIAL,
  GOLDEN_EVENTS,
  generateGoldenVectors,
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
    expect(fold(GOLDEN_INITIAL, GOLDEN_EVENTS)).toEqual(committed.expectedFinalState);
  });

  it("the reference replay reproduces expectedReplayStates (one per event)", () => {
    const states = replay(GOLDEN_INITIAL, GOLDEN_EVENTS);
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
