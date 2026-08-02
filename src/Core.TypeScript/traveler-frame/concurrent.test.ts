import { test, expect } from "bun:test";
import { concurrent, dominates, type Frame } from "./traveler-frame";

// `concurrent` — the spacelike predicate (a ‖ b): TS parity with F# TravelerFrame.concurrent.
// Concurrency is decided by the vector-clock partial order ONLY, never wall-clock. These tests pin
// the four-cell tetrachotomy of (dominates a b, dominates b a) and the genuine-fork semantics, so a
// wrong definition (&&→||, or a dropped conjunct) fails here — mirroring the F# sabotage checks.

const f = (o: Record<string, number>): Frame => ({ ...o });
// A small spread of frames spanning equal / ordered / forked / origin cases.
const frames: Frame[] = [
  {},
  { a: 1 },
  { a: 2 },
  { b: 1 },
  { a: 1, b: 1 },
  { a: 2, b: 1 },
  { a: 1, b: 2 },
  { a: 3, c: 1 },
];

const aheadSomewhere = (x: Frame, y: Frame): boolean => {
  const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
  for (const k of keys) if ((x[k] ?? 0) > (y[k] ?? 0)) return true;
  return false;
};

test("concurrent is symmetric", () => {
  for (const a of frames) for (const b of frames) expect(concurrent(a, b)).toBe(concurrent(b, a));
});

test("concurrent is irreflexive — a frame never forks itself", () => {
  for (const a of frames) expect(concurrent(a, a)).toBe(false);
});

test("if either dominates, the pair is NOT concurrent (exclusive with the order)", () => {
  for (const a of frames)
    for (const b of frames)
      if (dominates(a, b) || dominates(b, a)) expect(concurrent(a, b)).toBe(false);
});

test("EXACTLY ONE of {equal, a▷b, b▷a, concurrent} holds (tetrachotomy)", () => {
  for (const a of frames)
    for (const b of frames) {
      const da = dominates(a, b);
      const db = dominates(b, a);
      const cells = [da && db, da && !db, db && !da, concurrent(a, b)];
      expect(cells.filter(Boolean).length).toBe(1);
      expect(concurrent(a, b)).toBe(!da && !db);
    }
});

test("concurrent ⟺ genuine fork (each ahead somewhere) — semantics, independent of dominates", () => {
  for (const a of frames)
    for (const b of frames)
      expect(concurrent(a, b)).toBe(aheadSomewhere(a, b) && aheadSomewhere(b, a));
});

test("a genuine fork is concurrent; a causal chain is not", () => {
  expect(concurrent(f({ x: 3 }), f({ y: 2 }))).toBe(true); // each ahead on its own axis
  expect(concurrent(f({ x: 3, y: 5 }), f({ y: 2 }))).toBe(false); // first dominates ⇒ signaling, not spacelike
  expect(concurrent({}, {})).toBe(false); // ⊥ ‖ ⊥ is false (mutual dominance)
  expect(concurrent({}, f({ a: 1 }))).toBe(false); // ⊥ is below everything, never a fork
});
