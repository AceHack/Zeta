// Which eights are the same eight — the executable half of
// docs/research/2026-08-18-which-eights-are-the-same-eight-the-mod-8-correspondence-matrix.md
//
// Every test here computes its expectation from data that does not already contain it. Checks
// that WOULD be tautologies are named in the module docstring and deliberately absent.

import { describe, expect, it } from "bun:test";

import {
  EXTENDED_HAMMING_8_4,
  SINGLY_EVEN_SELF_DUAL_8,
  adinkraMinimalDimFromCodes,
  clockSeparation,
  constructionA,
  determinant,
  directSum,
  eighthRootOfUnity,
  gaussMilgramSum,
  hurwitzRadon,
  isSumOfThreeSquares,
  legendreExcluded,
  legendreResidueTally,
  maxDoublyEvenDim,
  radonHurwitzMinimalDim,
  weightEnumeratorAtI,
  type Matrix,
} from "./mod-eight-correspondence.ts";

const A1: Matrix = [[2]];
const A2: Matrix = [
  [2, -1],
  [-1, 2],
];
const A3: Matrix = [
  [2, -1, 0],
  [-1, 2, -1],
  [0, -1, 2],
];
const D4: Matrix = [
  [2, -1, 0, 0],
  [-1, 2, -1, -1],
  [0, -1, 2, 0],
  [0, -1, 0, 2],
];
const HYPERBOLIC: Matrix = [
  [0, 1],
  [1, 0],
];
const repeatSum = (m: Matrix, k: number): Matrix => {
  let acc = m;
  for (let i = 1; i <= k - 1; i++) acc = directSum(acc, m);
  return acc;
};

describe("Construction A carries the code eight to the lattice eight", () => {
  it("the in-tree extended Hamming code produces E8", () => {
    const r = constructionA(EXTENDED_HAMMING_8_4);
    expect(r.integral).toBe(true);
    expect(Math.abs(r.gramDeterminant)).toBe(1);
    expect(r.evenDiagonal).toBe(true);
    expect(r.norm1).toBe(0);
    expect(r.norm2).toBe(240);
  });

  it("the singly-even self-dual code of the same length produces an ODD lattice", () => {
    const r = constructionA(SINGLY_EVEN_SELF_DUAL_8);
    expect(r.integral).toBe(true);
    expect(Math.abs(r.gramDeterminant)).toBe(1);
    expect(r.evenDiagonal).toBe(false);
    expect(r.norm1).toBe(16);
  });
});
describe("Gauss-Milgram recovers an ARCHIMEDEAN invariant from FINITE data", () => {
  // The discriminant form knows nothing about signs, yet its Gauss sum reads off the
  // signature mod 8. That eighth root of unity is the Weil index, whose value group is the
  // same cyclic group of order 8 as the Brauer-Wall group that Clifford periodicity lives
  // in. This is the bridge between item 1 and item 3, executed.
  const cases: [string, Matrix, number][] = [
    ["A1", A1, 1],
    ["A2", A2, 2],
    ["A3", A3, 3],
    ["A2 plus A1", directSum(A2, A1), 3],
    ["D4", D4, 4],
    ["D4 plus A1", directSum(D4, A1), 5],
    ["A1 to the 6", repeatSum(A1, 6), 6],
    ["A1 to the 7", repeatSum(A1, 7), 7],
    ["A1 to the 8", repeatSum(A1, 8), 8],
    ["D4 plus D4", directSum(D4, D4), 8],
    ["A2 to the 4", repeatSum(A2, 4), 8],
  ];

  for (const entry of cases) {
    const name = entry[0]!;
    const gram = entry[1]!;
    const sigma = entry[2]!;
    it("matches the eighth root of unity for ".concat(name), () => {
      const g = gaussMilgramSum(gram);
      const e = eighthRootOfUnity(sigma);
      expect(Math.hypot(g.re - e.re, g.im - e.im)).toBeLessThan(1e-9);
    });
  }
});
describe("the sharp form of the lattice eight is about SIGNATURE, not dimension", () => {
  // CliffordPeriodicity.admitsEvenUnimodularLattice tests dimension mod 8. That is right for
  // POSITIVE DEFINITE lattices only. The hyperbolic plane is even and unimodular in dimension
  // 2, and it exists because its SIGNATURE is 0. Stating the theorem on p minus q rather than
  // on the dimension is what makes it the same expression the Clifford clock reads.
  it("the hyperbolic plane is even and unimodular in dimension 2", () => {
    expect(Math.abs(determinant(HYPERBOLIC))).toBe(1);
    expect(HYPERBOLIC[0]![0]! % 2).toBe(0);
    expect(HYPERBOLIC[1]![1]! % 2).toBe(0);
    const g = gaussMilgramSum(HYPERBOLIC);
    const e = eighthRootOfUnity(0);
    expect(Math.hypot(g.re - e.re, g.im - e.im)).toBeLessThan(1e-9);
  });

  it("and so is its double, in dimension 4", () => {
    const uu = directSum(HYPERBOLIC, HYPERBOLIC);
    expect(Math.abs(determinant(uu))).toBe(1);
    for (let i = 0; i <= 3; i++) expect(uu[i]![i]! % 2).toBe(0);
    const g = gaussMilgramSum(uu);
    const e = eighthRootOfUnity(0);
    expect(Math.hypot(g.re - e.re, g.im - e.im)).toBeLessThan(1e-9);
  });
});

describe("Gleason, searched rather than assumed", () => {
  it("a doubly-even self-dual code appears exactly at length 8 in the range 1 to 10", () => {
    const selfDualLengths: number[] = [];
    for (let n = 1; n <= 10; n++) {
      if (2 * maxDoublyEvenDim(n) === n) selfDualLengths.push(n);
    }
    expect(selfDualLengths).toEqual([8]);
  });
});
describe("the adinkra eight IS the Clifford eight, cross-computed", () => {
  // Two sequences with no shared input. The left side counts maximal doubly-even codes; the
  // right side evaluates the Hurwitz-Radon function. Agreement across the range is the
  // evidence that item 5 is item 1 restated, and any disagreement would have refuted it.
  // Capped at 10 for runtime: n = 11 takes about 2 s and n = 12 about 5 min. Both were run
  // offline and agree; the research doc records the full table to n = 12.
  it("the code route and the Clifford route give the same minimal multiplet for N up to 10", () => {
    const fromCodes: number[] = [];
    const fromClifford: number[] = [];
    for (let n = 1; n <= 10; n++) {
      fromCodes.push(adinkraMinimalDimFromCodes(n));
      fromClifford.push(radonHurwitzMinimalDim(n));
    }
    expect(fromCodes).toEqual(fromClifford);
    expect(fromClifford).toEqual([1, 2, 4, 4, 8, 8, 8, 8, 16, 32]);
  });

  it("the Hurwitz-Radon function has the published values at the powers of two", () => {
    const got = [1, 2, 4, 8, 16, 32, 64, 128, 256].map(hurwitzRadon);
    expect(got).toEqual([1, 2, 4, 8, 9, 10, 12, 16, 17]);
  });
});
describe("MacWilliams turns self-duality into the same eighth root of unity", () => {
  it("the doubly-even code gives a real positive S, forcing the phase to be 1", () => {
    const s = weightEnumeratorAtI(EXTENDED_HAMMING_8_4);
    expect(s.im).toBe(0);
    expect(s.re).toBe(16);
  });

  it("the singly-even code gives S = 0, where the identity constrains nothing", () => {
    const s = weightEnumeratorAtI(SINGLY_EVEN_SELF_DUAL_8);
    expect(s.re).toBe(0);
    expect(s.im).toBe(0);
  });
});

describe("THE CLEAN NEGATIVE: Legendre is not a mod-8 condition", () => {
  it("the criterion reproduces brute force", () => {
    let mismatches = 0;
    for (let n = 1; n <= 1500; n++) {
      const brute = isSumOfThreeSquares(n) === false;
      if (brute !== legendreExcluded(n)) mismatches++;
    }
    expect(mismatches).toBe(0);
  });
});
describe("the excluded set is not a union of residue classes mod 8", () => {
  // If Legendre eight were the periodicity eight, the excluded set would be a union of
  // residue classes, as the code and lattice conditions literally are. It is not: residue 7
  // is excluded whole, but residues 4 and 0 are excluded only in part.
  it("residue 7 is excluded whole and residues 4 and 0 are excluded only in part", () => {
    const t = legendreResidueTally(4000);
    expect(t.excluded[7]!).toBe(t.total[7]!);
    expect(t.partialResidues).toEqual([0, 4]);
    expect(t.excluded[1]!).toBe(0);
    expect(t.excluded[2]!).toBe(0);
    expect(t.excluded[3]!).toBe(0);
    expect(t.excluded[5]!).toBe(0);
    expect(t.excluded[6]!).toBe(0);
  });

  it("the named witnesses: 28 is excluded and is 4 mod 8, 112 is excluded and is 0 mod 8", () => {
    expect(legendreExcluded(28)).toBe(true);
    expect(28 % 8).toBe(4);
    expect(legendreExcluded(112)).toBe(true);
    expect(112 % 8).toBe(0);
    expect(legendreExcluded(4)).toBe(false);
    expect(legendreExcluded(8)).toBe(false);
  });
});
describe("the eight is a GRADED phenomenon, and our own module shows it", () => {
  // CliffordPeriodicity.classify returns the UNGRADED Morita type. That type takes only five
  // distinct values on the eight clock positions, so classify alone cannot witness an order-8
  // structure. Pairing it with the even subalgebra, whose class is one tick forward,
  // separates all eight. The order-8 group is the Brauer-Wall group of Z/2-graded algebras;
  // the ungraded Brauer group of the reals has order 2.
  it("the ungraded shape separates 5 of the 8 positions and the graded pair separates 8", () => {
    const sep = clockSeparation();
    expect(sep.ungraded).toBe(5);
    expect(sep.withEvenSubalgebra).toBe(8);
  });
});
