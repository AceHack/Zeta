/**
 * study-protocol.test.ts — falsifiers for D6's deterministic core:
 * counterbalancing is balanced, the answer key is deterministic and discards
 * the unanswerable, the tally never invents trials, and the placebo field is
 * replayable and decoupled (a pure function of the cycle alone).
 */
import { describe, expect, test } from "bun:test";
import {
  STUDY_CONDITIONS,
  actualDirection,
  conditionFor,
  placeboAttention,
  summarizeTally,
  tallyTrials,
  type StudyTrial,
} from "./study-protocol";

describe("counterbalancing (Latin square)", () => {
  test("every block of four holds every condition exactly once", () => {
    for (let block = 0; block < 8; block++) {
      const seen = new Set(
        Array.from({ length: 4 }, (_, i) => conditionFor(block * 4 + i)),
      );
      expect(seen.size).toBe(4);
    }
  });

  test("across four blocks every condition visits every position", () => {
    for (let pos = 0; pos < 4; pos++) {
      const seen = new Set(
        Array.from({ length: 4 }, (_, block) => conditionFor(block * 4 + pos)),
      );
      expect(seen.size).toBe(STUDY_CONDITIONS.length);
    }
  });

  test("deterministic — same index, same condition", () => {
    for (let i = 0; i < 20; i++) expect(conditionFor(i)).toBe(conditionFor(i));
  });
});

describe("the answer key", () => {
  test("dominant axis wins; ties break horizontal; stillness discards", () => {
    expect(actualDirection(5, 2)).toBe("right");
    expect(actualDirection(-5, 2)).toBe("left");
    expect(actualDirection(1, 6)).toBe("down");
    expect(actualDirection(1, -6)).toBe("up");
    expect(actualDirection(3, 3)).toBe("right"); // stated tie-break
    expect(actualDirection(0.4, -0.4)).toBeNull(); // held still → discard
    expect(actualDirection(0, 0)).toBeNull();
  });
});

describe("the tally", () => {
  test("scores per condition, reports discards, never hides a trial", () => {
    const trials: StudyTrial[] = [
      { condition: "full", guess: "right", actual: "right" },
      { condition: "full", guess: "left", actual: "right" },
      { condition: "none", guess: "up", actual: "up" },
      { condition: "placebo", guess: "down", actual: null }, // held still
      { condition: "arrow-only", guess: "left", actual: "left" },
    ];
    const t = tallyTrials(trials);
    expect(t.byCondition.full).toEqual({ n: 2, correct: 1 });
    expect(t.byCondition.none).toEqual({ n: 1, correct: 1 });
    expect(t.byCondition.placebo).toEqual({ n: 0, correct: 0 });
    expect(t.byCondition["arrow-only"]).toEqual({ n: 1, correct: 1 });
    expect(t.discarded).toBe(1);
    expect(t.total).toBe(5);
    // n across conditions + discarded must equal total — no silent loss.
    const counted =
      t.byCondition.full.n +
      t.byCondition.none.n +
      t.byCondition.placebo.n +
      t.byCondition["arrow-only"].n +
      t.discarded;
    expect(counted).toBe(t.total);
    expect(summarizeTally(t)).toBe("full 1/2 · none 1/1 · placebo 0/0 · arrow 1/1 · 1 held still");
  });
});

describe("the placebo field", () => {
  test("replayable: same cycle → byte-identical field", () => {
    expect(placeboAttention(500)).toEqual(placeboAttention(500));
  });

  test("decoupled from everything but the cycle, and it does drift", () => {
    const a = placeboAttention(0);
    const b = placeboAttention(240); // ten epochs later
    expect(a).not.toEqual(b);
  });

  test("holds within an epoch (settle-and-move, not flicker)", () => {
    expect(placeboAttention(48)).toEqual(placeboAttention(48 + 23));
  });

  test("shape parity with a live field: 32 tiles in [0,1], K attended, fixation attended", () => {
    const f = placeboAttention(1000);
    expect(f.variance.length).toBe(32);
    for (const v of f.variance) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(f.attended.length).toBe(8);
    expect(f.attended).toContain(f.fixation);
  });
});
