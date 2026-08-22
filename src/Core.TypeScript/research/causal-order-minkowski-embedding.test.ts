import { expect, it } from "bun:test";
import {
  concurrencyWidth,
  embedsInMinkowski1Plus1,
  embedsInMinkowski2Plus1,
  happensBefore,
  isStandardExample,
  linearExtensions,
  standardExampleS3Clocks,
  strictOrderMatrix,
  twoDimensionalRealizer,
} from "./causal-order-minkowski-embedding.ts";

// -- the vector-clock semantics are the standard ones, not a convenient variant ------------------

it("happens-before is a strict order: irreflexive, and concurrency is symmetric", () => {
  const cs = standardExampleS3Clocks();
  for (const c of cs) expect(happensBefore(c, c)).toBe(false);
  for (const x of cs)
    for (const y of cs) {
      const bothWays = happensBefore(x, y) && happensBefore(y, x);
      expect(bothWays).toBe(false);
    }
});

it("the six-process configuration realizes EXACTLY the standard example S_3", () => {
  const rel = strictOrderMatrix(standardExampleS3Clocks());
  expect(isStandardExample(rel, 3)).toBe(true);
});

// -- the falsifier itself -----------------------------------------------------------------------

it("S_3 does NOT embed in the causal order of 1+1 Minkowski space", () => {
  const rel = strictOrderMatrix(standardExampleS3Clocks());
  // Exhaustive: every linear extension is enumerated and every pair tested.
  expect(linearExtensions(rel).length).toBe(48);
  expect(twoDimensionalRealizer(rel)).toBeNull();
  expect(embedsInMinkowski1Plus1(rel)).toBe(false);
});

it("but S_3 DOES embed in 2+1 Minkowski -- the negative is about dimension 1+1 only", () => {
  expect(embedsInMinkowski2Plus1(0.6)).toBe(true);
});

// The check above would be vacuous if it passed for every lapse, so pin that it does not.
it("the 2+1 embedding is a real constraint: it fails outside the admissible lapse window", () => {
  expect(embedsInMinkowski2Plus1(0.4)).toBe(false); // below s/2: nothing is causal
  expect(embedsInMinkowski2Plus1(0.9)).toBe(false); // above the height: everything is causal
});

// -- the method is not blind to the positive case -----------------------------------------------

it("a 2-dimensional poset IS recognized as embeddable -- the test can fail both ways", () => {
  // The 2-crown S_2: a0<b1, a1<b0. Order dimension 2.
  const n = 4;
  const rel = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i < 2 && j >= 2 && i !== j - 2));
  expect(embedsInMinkowski1Plus1(rel)).toBe(true);
  // A total order embeds trivially: it is a worldline.
  const chain = Array.from({ length: 4 }, (_, i) => Array.from({ length: 4 }, (_, j) => i < j));
  expect(embedsInMinkowski1Plus1(chain)).toBe(true);
});

// -- concurrency width: the metric-free form of the lapse ---------------------------------------

it("a chain has concurrency width exactly 1 -- no spacelike pairs for a light cone to describe", () => {
  const nodes = Array.from({ length: 6 }, (_, i) => ({
    id: `c${String(i)}`,
    parents: i === 0 ? [] : [`c${String(i - 1)}`],
  }));
  const w = concurrencyWidth(nodes);
  expect(w.elements).toBe(6);
  expect(w.longestChain).toBe(5);
  expect(w.width).toBeCloseTo(6 / 5, 10);
});

it("a fan is wider than a chain -- width discriminates, so it is not a vacuous statistic", () => {
  // root -> four independent children -> join
  const nodes = [
    { id: "root", parents: [] as string[] },
    { id: "a", parents: ["root"] },
    { id: "b", parents: ["root"] },
    { id: "c", parents: ["root"] },
    { id: "d", parents: ["root"] },
    { id: "join", parents: ["a", "b", "c", "d"] },
  ];
  const fan = concurrencyWidth(nodes);
  const chain = concurrencyWidth(
    Array.from({ length: 6 }, (_, i) => ({ id: `c${String(i)}`, parents: i === 0 ? [] : [`c${String(i - 1)}`] })),
  );
  expect(fan.longestChain).toBe(2);
  expect(fan.width).toBeGreaterThan(chain.width);
});
