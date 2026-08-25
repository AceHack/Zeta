// Rank 16 — the discriminating test. Executable half of
// docs/research/2026-08-25-rank-16-is-where-the-e8-routes-disagree-*.md
//
// Every test here has a CONTROL that could have come out the other way, and several of the
// controls are the point rather than the decoration: the theta test is written so that a
// discriminating theta series would FAIL it.

import { describe, expect, it } from "bun:test";

import {
  CODE_D16_PLUS,
  CODE_E8_PLUS_E8,
  DYNKIN_E8,
  DYNKIN_E8_PLUS_E8,
  E8_CODE,
  GRAM_A2,
  GRAM_D4,
  GRAM_Z2,
  adjacency,
  automorphismOrder,
  barnesWall16,
  centreDensity16,
  classifyTypeII,
  codeFacts,
  componentRepresentatives,
  constructionAMinimalVectors,
  dynkinA,
  dynkinD,
  factorial,
  findSimpleSystem,
  gramDeterminant,
  gramDirectSum,
  gramKissing,
  perronFrobeniusRatios,
  rootSystemComponents,
  thetaSeries,
  typeIILabelledCount,
  versorClosure,
} from "./rank-sixteen-lattice-routes.ts";

const rootsE8E8 = constructionAMinimalVectors(CODE_E8_PLUS_E8, 16);
const rootsD16 = constructionAMinimalVectors(CODE_D16_PLUS, 16);

describe("the two Type II codes of length 16 exist and are what they claim", () => {
  it("both are doubly-even self-dual [16,8] codes", () => {
    for (const basis of [CODE_E8_PLUS_E8, CODE_D16_PLUS]) {
      const f = codeFacts(basis, 16);
      expect(f.dimension).toBe(8);
      expect(f.doublyEven).toBe(true);
      expect(f.selfDual).toBe(true);
    }
  });

  it("the brief's parenthetical was wrong: a self-dual code has k = n/2, so [16,5] is impossible", () => {
    // A [16,5] code cannot be self-dual; RM(1,4) IS [16,5,8] and is only self-ORTHOGONAL.
    expect(codeFacts(CODE_D16_PLUS, 16).dimension).toBe(8);
    expect(codeFacts(CODE_D16_PLUS, 16).weightEnumerator[8]).not.toBe(0);
  });

  it("GLEASON: both have the SAME weight enumerator, so it discriminates nothing", () => {
    const a = codeFacts(CODE_E8_PLUS_E8, 16).weightEnumerator;
    const b = codeFacts(CODE_D16_PLUS, 16).weightEnumerator;
    expect(a).toEqual(b);
    expect(a[0]).toBe(1);
    expect(a[4]).toBe(28);
    expect(a[8]).toBe(198);
    // CONTROL: the length-8 code has a DIFFERENT enumerator, so the equality above is a fact
    // about length 16 and not an artefact of the function always returning the same thing.
    expect(codeFacts(E8_CODE, 8).weightEnumerator).not.toEqual(a);
  });

  it("a code-level invariant DOES separate them: the span of the weight-4 codewords", () => {
    expect(codeFacts(CODE_E8_PLUS_E8, 16).tetradSpanDimension).toBe(8);
    expect(codeFacts(CODE_D16_PLUS, 16).tetradSpanDimension).toBe(7);
    expect(codeFacts(CODE_E8_PLUS_E8, 16).tetradComponents).toEqual([8, 8]);
    expect(codeFacts(CODE_D16_PLUS, 16).tetradComponents).toEqual([16]);
    // both have the same NUMBER of tetrads -- the count is not the identification
    expect(codeFacts(CODE_E8_PLUS_E8, 16).tetradCount).toBe(codeFacts(CODE_D16_PLUS, 16).tetradCount);
  });
});

describe("the classification: exactly one class at length 8, exactly two at length 16", () => {
  it("length 8 is a uniqueness sink -- exhaustive classification finds ONE class", () => {
    const classes = classifyTypeII(8);
    expect(classes.length).toBe(1);
    expect(automorphismOrder(8, classes[0]!)).toBe(1344n); // AGL(3,2)
    // the labelled count follows, and validates the mass formula used at length 16
    expect(factorial(8) / 1344n).toBe(typeIILabelledCount(8));
  });

  it("length 16: the two computed class sizes SUM EXACTLY to the labelled count", () => {
    const autA = automorphismOrder(16, CODE_E8_PLUS_E8);
    const autB = automorphismOrder(16, CODE_D16_PLUS);
    expect(autA).toBe(3612672n); // |Aut(e8)| wr S2 = 2 * 1344^2
    expect(autA).toBe(2n * 1344n * 1344n);
    expect(autB).toBe(5160960n);
    const mass = factorial(16) / autA + factorial(16) / autB;
    expect(mass).toBe(typeIILabelledCount(16));
    expect(mass).toBe(9845550n);
    // CONTROL: dropping either class leaves the mass SHORT, so this could have failed.
    expect(factorial(16) / autA).not.toBe(typeIILabelledCount(16));
  }, 30000);
});

describe("the two rank-16 lattices agree on every COUNT and differ in STRUCTURE", () => {
  it("both have 480 minimal vectors and rank 16 -- the count identifies nothing", () => {
    expect(rootsE8E8.length).toBe(480);
    expect(rootsD16.length).toBe(480);
    for (const roots of [rootsE8E8, rootsD16]) {
      expect(new Set(roots.map((r) => r.reduce((s, x) => s + x * x, 0))).size).toBe(1); // simply-laced
    }
  });

  it("THETA SERIES ARE IDENTICAL -- the in-tree theta route has no discriminating power here", () => {
    const a = thetaSeries(CODE_E8_PLUS_E8, 16, 12).map(String);
    const b = thetaSeries(CODE_D16_PLUS, 16, 12).map(String);
    expect(a).toEqual(b);
    expect(a[4]).toBe("480");
    expect(a[8]).toBe("61920");
    // CONTROL: the same function DOES separate lattices when they differ modularly -- at rank 8
    // the adinkra code's lattice and Z^8 have different series. So "identical" above is a
    // finding about rank 16, not a broken comparison.
    const e8 = thetaSeries(E8_CODE, 8, 8).map(String);
    const z8 = thetaSeries([1, 2, 4, 8, 16, 32, 64, 128], 8, 8).map(String);
    expect(e8).not.toEqual(z8);
  });

  it("ROOT-SYSTEM CONNECTIVITY separates them: {240,240} rank 8 each, versus {480} rank 16", () => {
    expect(rootSystemComponents(rootsE8E8, 16)).toEqual([
      { size: 240, rank: 8 },
      { size: 240, rank: 8 },
    ]);
    expect(rootSystemComponents(rootsD16, 16)).toEqual([{ size: 480, rank: 16 }]);
  });

  it("naming the competitors: 480 roots, simply-laced, irreducible, rank 16 leaves only D16", () => {
    // A_16 has 16*17 = 272 roots; E6/E7/E8 have rank <= 8; E8+E8 has 480 but is DECOMPOSABLE.
    // So the excluding invariant is irreducibility, and it is computed above, not asserted.
    expect(16 * 17).not.toBe(480);
    expect(2 * 16 * 15).toBe(480); // D_16 root count
    expect(rootSystemComponents(rootsD16, 16).length).toBe(1);
  });
});

describe("the Clifford / versor route is DIAGRAM-DRIVEN -- it selects nothing", () => {
  it("same algorithm, same dimension: the supplied Cartan matrix picks the lattice", () => {
    const a = findSimpleSystem(rootsE8E8, DYNKIN_E8_PLUS_E8, 16, componentRepresentatives(rootsE8E8));
    expect(a.found).toBe(true);
    const closureA = versorClosure(a.simple as number[][]);
    expect(closureA.length).toBe(480);
    expect(rootSystemComponents(closureA, 16).map((c) => c.size)).toEqual([240, 240]);

    const b = findSimpleSystem(rootsD16, dynkinD(16), 16, componentRepresentatives(rootsD16));
    expect(b.found).toBe(true);
    const closureB = versorClosure(b.simple as number[][]);
    expect(closureB.length).toBe(480);
    expect(rootSystemComponents(closureB, 16).map((c) => c.size)).toEqual([480]);
  }, 30000);

  it("EXHAUSTIVE: the D16+ root system contains no E8 subsystem at all", () => {
    const r = findSimpleSystem(rootsD16, DYNKIN_E8, 8, componentRepresentatives(rootsD16), 1e8);
    expect(r.exhausted).toBe(true); // a capped search would be inconclusive, not a negative
    expect(r.found).toBe(false);
    // CONTROL: the same exhaustive machinery DOES find D8 there, so "not found" is a property
    // of the ambient root system and not of the search.
    const d8 = findSimpleSystem(rootsD16, dynkinD(8), 8, componentRepresentatives(rootsD16));
    expect(d8.found).toBe(true);
  }, 60000);

  it("E8+E8 contains A8 but its components have rank 8, so no rank-9 connected diagram fits", () => {
    expect(findSimpleSystem(rootsE8E8, dynkinA(8), 8, componentRepresentatives(rootsE8E8)).found).toBe(true);
    // The A9 negative is settled structurally rather than by search: the roots fall into two
    // MUTUALLY ORTHOGONAL families (computed), so a connected diagram's simple roots all lie in
    // one family, and each family spans only rank 8 while A9 needs 9 independent vectors.
    const comps = rootSystemComponents(rootsE8E8, 16);
    expect(comps.length).toBe(2);
    expect(comps.every((c) => c.rank === 8)).toBe(true);
  }, 30000);
});

describe("the Cayley-Dickson doubled module: its kissing number doubles, the chain's does not", () => {
  it("the CD norm form is an orthogonal direct sum, so the doubled module is L _|_ L", () => {
    const rows: [string, number[][], number, number][] = [
      ["Z[i] = Z^2", GRAM_Z2, 1, 4],
      ["Z[i] _|_ Z[i]", gramDirectSum(GRAM_Z2, GRAM_Z2), 1, 8],
      ["Z[omega] = A2", GRAM_A2, 2, 6],
      ["A2 _|_ A2", gramDirectSum(GRAM_A2, GRAM_A2), 2, 12],
      ["D4 = Hurwitz", GRAM_D4, 2, 24],
      ["D4 _|_ D4", gramDirectSum(GRAM_D4, GRAM_D4), 2, 48],
    ];
    for (const [, gram, minNorm, expected] of rows) expect(gramKissing(gram, minNorm)).toBe(expected);
    // THE DOUBLING LAW IS x2 -- exactly, at every rung.
    expect(gramKissing(gramDirectSum(GRAM_Z2, GRAM_Z2), 1)).toBe(2 * gramKissing(GRAM_Z2, 1));
    expect(gramKissing(gramDirectSum(GRAM_A2, GRAM_A2), 2)).toBe(2 * gramKissing(GRAM_A2, 2));
    expect(gramKissing(gramDirectSum(GRAM_D4, GRAM_D4), 2)).toBe(2 * gramKissing(GRAM_D4, 2));
    // ... and the claimed chain A2 -> D4 -> E8 goes 6 -> 24 -> 240, which is x4 then x10.
    expect(gramKissing(GRAM_D4, 2)).not.toBe(2 * gramKissing(GRAM_A2, 2));
    expect(rootsE8E8.length / 2).not.toBe(2 * gramKissing(GRAM_D4, 2)); // 240 vs 48
  });

  it("A2 _|_ A2 is not even a SUBLATTICE of D4: the index would be 3/2", () => {
    const ratio = gramDeterminant(gramDirectSum(GRAM_A2, GRAM_A2)) / gramDeterminant(GRAM_D4);
    expect(ratio).toBeCloseTo(9 / 4, 10);
    expect(Number.isInteger(Math.sqrt(ratio))).toBe(false);
    // CONTROL: D4 _|_ D4 inside a unimodular rank-8 lattice DOES have integer index 4.
    expect(Math.sqrt(gramDeterminant(gramDirectSum(GRAM_D4, GRAM_D4)) / 1)).toBe(4);
  });
});

describe("the DENSITY rule and the UNIMODULAR rule coincide at 8 and diverge at 16", () => {
  it("Barnes-Wall Lambda_16 is 16x denser than either even unimodular lattice", () => {
    const bw = barnesWall16();
    expect(bw.kissing).toBe(4320); // published value, reproduced by the construction
    expect(bw.centreDensity).toBeCloseTo(1 / 16, 12);
    const evenUnimodular = centreDensity16(4, 256); // Construction A frame: min 4, covolume 256
    expect(evenUnimodular).toBeCloseTo(1 / 256, 12);
    expect(bw.centreDensity / evenUnimodular).toBeCloseTo(16, 8);
    // and it is neither of the two: different kissing number, so different lattice
    expect(bw.kissing).not.toBe(480);
  });
});

describe("which E8 the Zamolodchikov spectrum uses: the Dynkin diagram, not the lattice", () => {
  const cos = (x: number) => Math.cos(x * Math.PI);
  const m2 = 2 * cos(1 / 5);
  const ZAMOLODCHIKOV = [
    1,
    m2,
    2 * cos(1 / 30),
    2 * m2 * cos(7 / 30),
    2 * m2 * cos(2 / 15),
    2 * m2 * cos(1 / 30),
    4 * m2 * cos(1 / 5) * cos(7 / 30),
    4 * m2 * cos(1 / 5) * cos(2 / 15),
  ].sort((a, b) => a - b);

  it("the E8 mass spectrum falls out of the ADJACENCY MATRIX of the E8 Dynkin diagram", () => {
    const { ratios, eigenvalue } = perronFrobeniusRatios(adjacency(8, DYNKIN_E8));
    expect(eigenvalue).toBeCloseTo(2 * Math.cos(Math.PI / 30), 9); // Coxeter number 30
    for (let i = 0; i < 8; i++) expect(ratios[i]).toBeCloseTo(ZAMOLODCHIKOV[i]!, 9);
    expect(ratios[1]).toBeCloseTo((1 + Math.sqrt(5)) / 2, 12); // the golden ratio, m2/m1
  });

  it("D16 has the SAME Coxeter number 30 -- and a different spectrum, with no golden ratio", () => {
    const e8 = perronFrobeniusRatios(adjacency(8, DYNKIN_E8));
    const d16 = perronFrobeniusRatios(adjacency(16, dynkinD(16)));
    expect(d16.eigenvalue).toBeCloseTo(e8.eigenvalue, 9); // 2*16 - 2 = 30 = h(E8)
    const phi = (1 + Math.sqrt(5)) / 2;
    expect(d16.ratios.some((r) => Math.abs(r - phi) < 1e-6)).toBe(false);
    // So the eigenVALUE is a shared coincidence and the eigenVECTOR is the identification.
  });
});
