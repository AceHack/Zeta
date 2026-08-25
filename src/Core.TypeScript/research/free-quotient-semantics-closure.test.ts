// Falsifiers for docs/research/2026-08-25-is-semantics-a-quotient-of-syntax-*.md.
// Every number below is computed exhaustively over a finite sweep. Nothing is fitted.

import { describe, expect, it } from "bun:test";
import {
  allFreeWSets,
  allStringsUpTo,
  catalanBySelfConvolution,
  congruenceCounterexamples,
  consolidate,
  contextFold,
  depth,
  factorise,
  findSection,
  freeFold,
  HAMMING_8_4_GENERATORS,
  isCongruenceForBinaryOp,
  isDoublyEven,
  isSelfDual,
  leafCount,
  minDistance,
  reconcile,
  span,
  splitFold,
  treeKey,
  treesWithLeaves,
  vertexQuotient,
  wsetKey,
  yieldOf,
  type Tree,
} from "./free-quotient-semantics-closure.ts";

describe("1. the yield map: semantics is a QUOTIENT only when there is no junk", () => {
  const N = 7;
  const trees = Array.from({ length: N }, (_, i) => treesWithLeaves(i + 1)).flat();

  it("ambiguity IS the kernel, and the fibre sizes are Catalan by the grammar's own recurrence", () => {
    for (let n = 1; n <= N; n++) {
      expect(treesWithLeaves(n).length).toBe(catalanBySelfConvolution(n - 1));
    }
    // The excluding invariant, not the count: Motzkin opens 1,1,2 identically and
    // diverges at n=4. The self-convolution is what identifies Catalan, and it is
    // literally the production S -> S S read as an operation.
    expect([1, 2, 3, 4, 5, 6].map((n) => catalanBySelfConvolution(n))).toEqual([1, 2, 5, 14, 42, 132]);
  });

  it("the yield map has junk: L is a proper subset of Sigma*, so semantics is NOT a quotient here", () => {
    const strings = allStringsUpTo(N, ["a", "b"]);
    const f = factorise(trees, strings, yieldOf, (s) => s);
    expect(f.surjective).toBe(false);
    expect(f.isQuotient).toBe(false);
    expect(f.junk).toBeGreaterThan(0);
    expect(f.hasSection).toBe(false); // no homoiconicity: most strings name no syntax
    expect(f.maxFibre).toBe(catalanBySelfConvolution(N - 1)); // the SPPF of "a"^N
    expect(f.bitsErased).toBeCloseTo(Math.log2(catalanBySelfConvolution(N - 1)), 12);
  });

  it("restrict the codomain to the LANGUAGE and it becomes a quotient, with a section", () => {
    const inLanguage = [...new Set(trees.map(yieldOf))];
    const f = factorise(trees, inLanguage, yieldOf, (s) => s);
    expect(f.surjective).toBe(true);
    expect(f.isQuotient).toBe(true);
    expect(f.junk).toBe(0);
    expect(f.hasSection).toBe(true);
    expect(f.isIso).toBe(false); // quotient, not iso: the kernel is still nontrivial
    const q = findSection(trees, yieldOf, (s) => s);
    for (const s of inLanguage) expect(yieldOf(q.get(s) as Tree)).toBe(s);
  });
});

describe("2. WSet.consolidate IS the quotient map onto WeightedSet", () => {
  const sets = [0, 1, 2, 3].map((n) => allFreeWSets(n, ["x", "y"], [-1, 0, 1])).flat();

  it("consolidate is idempotent (canonical form) and its relation is a congruence", () => {
    for (const s of sets) expect(wsetKey(consolidate(consolidate(s)))).toBe(wsetKey(consolidate(s)));
    expect(congruenceCounterexamples(sets)).toBe(0);
  });

  it("it is surjective onto its own canonical forms (no junk) and non-injective (confusion)", () => {
    const canonical = sets.map(consolidate);
    const f = factorise(sets, canonical, consolidate, wsetKey);
    expect(f.isQuotient).toBe(true);
    expect(f.junk).toBe(0);
    expect(f.hasSection).toBe(true); // the canonical form IS the section: homoiconic
    expect(f.injective).toBe(false);
    expect(f.maxFibre).toBeGreaterThan(1);
    expect(f.bitsErased).toBeGreaterThan(0);
  });
});

describe("3. the natural-parameter embedding is the OPPOSITE defect: split mono with junk", () => {
  // h : Gaussian(nu, tau) -> WeightedSet over {nu, tau}. Injective, hence homoiconic.
  // But the MODEL is the proper half-space tau > 0, so the carrier has junk.
  const grid: [number, number][] = [];
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) grid.push([a, b]);
  const h = ([nu, tau]: [number, number]) => consolidate([["nu", nu], ["tau", tau]]);

  it("injective: zero bits erased (a section exists in the OTHER direction)", () => {
    const f = factorise(grid, grid.map(h), h, wsetKey);
    expect(f.injective).toBe(true);
    expect(f.bitsErased).toBe(0);
  });

  it("but the proper model does not cover the carrier: junk > 0, so it is not a quotient", () => {
    const proper = grid.filter(([, tau]) => tau > 0);
    const f = factorise(proper, grid.map(h), h, wsetKey);
    expect(f.surjective).toBe(false);
    expect(f.isQuotient).toBe(false);
    expect(f.junk).toBeGreaterThan(0);
  });
});

describe("4. the adinkra route, priced - and it is a PER-ROUTE cost, not a substrate bound", () => {
  const gens = HAMMING_8_4_GENERATORS;
  const code = span(gens);

  it("the [8,4,4] extended Hamming code is doubly-even and self-dual, as adinkras require", () => {
    expect(code.length).toBe(16);
    expect(isDoublyEven(code)).toBe(true);
    expect(isSelfDual(code, 8)).toBe(true);
    expect(minDistance(code)).toBe(4);
  });

  it("THE FALSIFIER: fibre-side and structure-side erasure must agree at every code dimension", () => {
    // If dim C and log2(largest fibre of F_2^8 / C) ever disagreed, the identification
    // "homoiconicity deficit = dim C" would be numerology. They must be equal for k = 0..4.
    for (let k = 0; k <= 4; k++) {
      const ck = span(gens.slice(0, k));
      const vq = vertexQuotient(8, ck);
      expect(ck.length).toBe(2 ** k);
      expect(vq.fibre).toBe(2 ** k); // constant fibre: it really is a subgroup quotient
      expect(vq.vertices).toBe(2 ** (8 - k));
      expect(vq.bitsErasedFibreSide).toBe(k);
      expect(vq.bitsErasedStructureSide).toBe(k);
    }
  });

  it("k = 0 is the homoiconic (uncoded) family: full 2^8 vertices, zero bits erased, d = infinity", () => {
    const trivial = span([]);
    const vq = vertexQuotient(8, trivial);
    expect(vq.vertices).toBe(256);
    expect(vq.bitsErasedFibreSide).toBe(0);
    expect(minDistance(trivial)).toBe(Infinity); // no protection, and none needed
  });

  it("any nontrivial protection costs exactly dim C bits: the two rows coexist, they do not compete", () => {
    for (let k = 1; k <= 4; k++) {
      const ck = span(gens.slice(0, k));
      expect(minDistance(ck)).toBeLessThan(Infinity); // protection exists
      expect(vertexQuotient(8, ck).bitsErasedFibreSide).toBe(k); // and is paid for in bits
    }
  });
});

describe("5. initiality dichotomy: a context-aware fold is not a hom, until context enters the KEY", () => {
  const trees = [3, 4, 5].map((n) => treesWithLeaves(n)).flat();

  it("context-aware and context-free folds disagree - so by uniqueness, one is not a hom", () => {
    let disagreements = 0;
    for (const t of trees) {
      if (Math.abs(freeFold(t, 1, 0.5) - contextFold(t, 1, 0.5, "root")) > 1e-12) disagreements++;
    }
    expect(disagreements).toBeGreaterThan(0);
  });

  it("state-splitting absorbs it EXACTLY: the refined context-free fold reproduces every value", () => {
    const wOf = (s: "S^root" | "S^l" | "S^r") => (s === "S^l" ? 0.25 : 0.5);
    for (const t of trees) {
      expect(splitFold(t, 1, wOf, "root")).toBeCloseTo(contextFold(t, 1, 0.5, "root"), 12);
    }
  });
});

describe("6. many representations at once: plurality over one free object always reconciles", () => {
  const trees = [1, 2, 3, 4, 5, 6].map((n) => treesWithLeaves(n)).flat();
  const combine = (a: Tree, b: Tree): Tree => ({ leaf: false, l: a, r: b });
  const byLeaves = (t: Tree) => `n${leafCount(t)}`;
  const byDepth = (t: Tree) => `d${depth(t)}`;

  it("both really are congruences for the production (not merely functions)", () => {
    expect(isCongruenceForBinaryOp(trees, byLeaves, combine)).toBe(0);
    expect(isCongruenceForBinaryOp(trees, byDepth, combine)).toBe(0);
  });

  it("neither refines the other - they are genuinely different truths over the same facts", () => {
    const r = reconcile(trees, byLeaves, byDepth);
    expect(r.classesMeet).toBeGreaterThan(r.classesA);
    expect(r.classesMeet).toBeGreaterThan(r.classesB);
  });

  it("and they reconcile through their meet WITHOUT either collapsing (the span exists)", () => {
    const r = reconcile(trees, byLeaves, byDepth);
    expect(r.aFactorsThroughMeet).toBe(true);
    expect(r.bFactorsThroughMeet).toBe(true);
    expect(r.meetIsExactlyTheJoin).toBe(true);
  });

  it("the free object itself is the finest element: every quotient factors through syntax", () => {
    const r = reconcile(trees, treeKey, byDepth);
    expect(r.classesMeet).toBe(r.classesA); // treeKey is already the finest
    expect(r.bFactorsThroughMeet).toBe(true);
  });
});
