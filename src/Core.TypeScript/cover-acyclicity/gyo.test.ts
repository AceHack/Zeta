/**
 * gyo.test.ts - forcing cases for the alpha-acyclicity criterion.
 *
 * The load-bearing test in this file is NOT "GYO says acyclic on a cover I labelled acyclic" -
 * that would only prove I can label examples. It is the BFMY biconditional, checked by running
 * both sides independently and asserting they agree:
 *
 *   gyoReduce(cover).acyclic  ===  (no pairwise-consistent instance lacks a universal relation)
 *
 * The right-hand side is computed by exhaustion over every instance on a two-value domain, by
 * code that never calls GYO. Over the 382 exhaustively-enumerated small covers they agree on
 * every one. Break either side and the suite goes red - which is what makes this a falsifier
 * rather than a restatement of a definition.
 *
 * Anchors: Beeri, Fagin, Maier & Yannakakis, JACM 30(3):479 (1983) - acyclicity <=> pairwise
 * consistency implies global consistency. Graham 1979 / Yu & Ozsoyoglu 1979 - the reduction.
 * Honeyman, Ladner & Yannakakis, IPL 10(1):14 (1980) - join consistency is NP-complete, which is
 * why the exhaustive side is explicitly bounded.
 *
 * Work item: 081M0AH5TQQ087G0R003CNFRAF
 */

import { describe, test, expect } from "bun:test";
import fc from "fast-check";
import {
  canonicalizeCover,
  gyoReduce,
  isAlphaAcyclic,
  validateCyclicCore,
  validateJoinTree,
  type Cover,
} from "./gyo";
import {
  isGloballyConsistent,
  isPairwiseConsistent,
  naturalJoin,
  searchGluingWitness,
  type Instance,
} from "./witness";

// === Named covers ===========================================================

/** The classic forcing case: a 3-cycle, the smallest cover with no local-implies-global guarantee. */
const THREE_CYCLE: Cover = [
  { name: "AB", attributes: ["A", "B"] },
  { name: "BC", attributes: ["B", "C"] },
  { name: "CA", attributes: ["C", "A"] },
];

/** A path. Acyclic, and the running-intersection property is visible by eye. */
const CHAIN: Cover = [
  { name: "AB", attributes: ["A", "B"] },
  { name: "BC", attributes: ["B", "C"] },
  { name: "CD", attributes: ["C", "D"] },
];

/** A star schema: one fact table, three dimensions. The archetypal acyclic carve. */
const STAR: Cover = [
  { name: "fact", attributes: ["k1", "k2", "k3", "measure"] },
  { name: "dim1", attributes: ["k1", "a"] },
  { name: "dim2", attributes: ["k2", "b"] },
  { name: "dim3", attributes: ["k3", "c"] },
];

/**
 * The 3-cycle PLUS the full edge {A,B,C}. Alpha-acyclic, though a proper sub-cover of it is not -
 * alpha-acyclicity is NOT hereditary. This is the difference between alpha- and beta-acyclicity,
 * and it is the case most likely to trip an implementation that "handles cycles" by looking for a
 * cycle in the intersection graph.
 */
const CYCLE_PLUS_FULL_EDGE: Cover = [
  { name: "AB", attributes: ["A", "B"] },
  { name: "BC", attributes: ["B", "C"] },
  { name: "CA", attributes: ["C", "A"] },
  { name: "ABC", attributes: ["A", "B", "C"] },
];

describe("GYO - named forcing cases", () => {
  test("the 3-cycle is CYCLIC, and its core is the whole cover", () => {
    const v = gyoReduce(THREE_CYCLE);
    expect(v.acyclic).toBe(false);
    if (v.acyclic) throw new Error("unreachable");
    expect(v.cyclicCore.map((e) => e.name).sort()).toEqual(["AB", "BC", "CA"]);
    expect(validateCyclicCore(THREE_CYCLE, v.cyclicCore)).toBe(true);
  });

  test("a chain is ACYCLIC and its join tree validates", () => {
    const v = gyoReduce(CHAIN);
    expect(v.acyclic).toBe(true);
    if (!v.acyclic) throw new Error("unreachable");
    expect(v.joinTree.edges).toHaveLength(2);
    expect(validateJoinTree(CHAIN, v.joinTree)).toEqual([]);
  });

  test("a star schema is ACYCLIC and its join tree validates", () => {
    const v = gyoReduce(STAR);
    expect(v.acyclic).toBe(true);
    if (!v.acyclic) throw new Error("unreachable");
    expect(v.joinTree.edges).toHaveLength(3);
    expect(validateJoinTree(STAR, v.joinTree)).toEqual([]);
  });

  test("alpha-acyclicity is NOT hereditary: 3-cycle + {A,B,C} is acyclic, its sub-cover is not", () => {
    expect(isAlphaAcyclic(CYCLE_PLUS_FULL_EDGE)).toBe(true);
    expect(isAlphaAcyclic(THREE_CYCLE)).toBe(false);
    const v = gyoReduce(CYCLE_PLUS_FULL_EDGE);
    if (!v.acyclic) throw new Error("unreachable");
    expect(validateJoinTree(CYCLE_PLUS_FULL_EDGE, v.joinTree)).toEqual([]);
  });

  test("a single element, and the empty cover, are acyclic", () => {
    expect(isAlphaAcyclic([{ name: "only", attributes: ["A", "B", "C"] }])).toBe(true);
    expect(isAlphaAcyclic([])).toBe(true);
  });

  test("duplicate cover-element names are REFUSED, not silently merged", () => {
    expect(() =>
      canonicalizeCover([
        { name: "dup", attributes: ["A"] },
        { name: "dup", attributes: ["B"] },
      ]),
    ).toThrow(/duplicate cover-element name/);
  });
});

// === The exhibited witness ==================================================

describe("the 3-cycle witness - locally consistent, globally inconsistent", () => {
  /**
   * The classic parity instance. Each relation says "my two attributes differ":
   *   R_AB = {(0,1),(1,0)}   R_BC = {(0,1),(1,0)}   R_CA = {(0,1),(1,0)}
   * Pairwise it is perfect: every single-attribute projection is {0,1}. Globally it is
   * impossible: A != B and B != C force A == C over two values, and R_CA forbids A == C.
   * Nothing about a merge operator can repair that - the obstruction is in the instance.
   */
  const WITNESS: Instance = {
    AB: [
      { A: 0, B: 1 },
      { A: 1, B: 0 },
    ],
    BC: [
      { B: 0, C: 1 },
      { B: 1, C: 0 },
    ],
    CA: [
      { C: 0, A: 1 },
      { C: 1, A: 0 },
    ],
  };

  test("it IS pairwise consistent", () => {
    expect(isPairwiseConsistent(THREE_CYCLE, WITNESS)).toBe(true);
  });

  test("it is NOT globally consistent - the natural join is empty", () => {
    expect(naturalJoin(THREE_CYCLE, WITNESS)).toEqual([]);
    expect(isGloballyConsistent(THREE_CYCLE, WITNESS)).toBe(false);
  });

  test("proof by exhaustion: no tuple over {A,B,C} survives all three relations", () => {
    const survivors: string[] = [];
    for (const a of [0, 1]) {
      for (const b of [0, 1]) {
        for (const c of [0, 1]) {
          if (a !== b && b !== c && c !== a) survivors.push(`${a}${b}${c}`);
        }
      }
    }
    // Three pairwise-distinct values cannot be drawn from a two-element domain.
    expect(survivors).toEqual([]);
  });

  test("the same relations over an ACYCLIC cover of the same attributes DO glue", () => {
    // Drop one edge: {A,B},{B,C} is a chain. The very same local data now has a global section.
    const chainCover: Cover = THREE_CYCLE.slice(0, 2);
    const chainInstance: Instance = { AB: WITNESS["AB"]!, BC: WITNESS["BC"]! };
    expect(isAlphaAcyclic(chainCover)).toBe(true);
    expect(isPairwiseConsistent(chainCover, chainInstance)).toBe(true);
    expect(isGloballyConsistent(chainCover, chainInstance)).toBe(true);
  });
});

// === The biconditional, checked ============================================

/** Every nonempty subset of {A,B,C}, as attribute lists. */
function subsetsOfABC(): readonly (readonly string[])[] {
  const attrs = ["A", "B", "C"];
  const out: string[][] = [];
  for (let m = 1; m < 8; m++) {
    const s: string[] = [];
    for (let b = 0; b < 3; b++) if ((m & (1 << b)) !== 0) s.push(attrs[b]!);
    out.push(s);
  }
  return out;
}

/** Every cover of 2 or 3 nonempty subsets of {A,B,C}. */
function allSmallCovers(): readonly Cover[] {
  const subsets = subsetsOfABC();
  const covers: Cover[] = [];
  for (const si of subsets) {
    for (const sj of subsets) {
      covers.push([
        { name: "r0", attributes: si },
        { name: "r1", attributes: sj },
      ]);
      for (const sk of subsets) {
        covers.push([
          { name: "r0", attributes: si },
          { name: "r1", attributes: sj },
          { name: "r2", attributes: sk },
        ]);
      }
    }
  }
  return covers;
}

/**
 * The exhaustive semantic verdict for every small cover, computed ONCE (it is the expensive part:
 * every instance over a two-value domain, for every cover in the family).
 */
const SEMANTIC: readonly { readonly cover: Cover; readonly glues: boolean }[] = (() => {
  const out: { cover: Cover; glues: boolean }[] = [];
  for (const cover of allSmallCovers()) {
    const search = searchGluingWitness(cover, [0, 1], 500_000);
    if (search.kind === "refused") continue;
    out.push({ cover, glues: search.kind === "no-witness" });
  }
  return out;
})();

describe("BFMY biconditional - GYO agrees with exhaustive semantic search", () => {
  test("over every small cover, the syntactic and semantic verdicts agree", () => {
    const disagreements: string[] = [];
    for (const { cover, glues } of SEMANTIC) {
      if (gyoReduce(cover).acyclic !== glues) {
        disagreements.push(JSON.stringify(cover.map((e) => e.attributes)));
      }
    }
    expect(disagreements).toEqual([]);
    // Pinned so a future change that quietly shrinks the search cannot pass by checking nothing.
    expect(SEMANTIC.length).toBe(382);
    expect(allSmallCovers().length - SEMANTIC.length).toBe(10); // refused as too large to exhaust
    // And both outcomes really occur - otherwise the agreement above would be trivial.
    expect(SEMANTIC.filter((s) => s.glues).length).toBeGreaterThan(0);
    expect(SEMANTIC.filter((s) => !s.glues).length).toBeGreaterThan(0);
  });

  test("SABOTAGE CONTROL: an oracle that always answers 'acyclic' FAILS that check", () => {
    // If the agreement test above could pass with a broken decision procedure, it would prove
    // nothing. It cannot: here is the cheapest possible wrong procedure, and it disagrees.
    const alwaysAcyclic = (_cover: Cover): boolean => true;
    const disagreements = SEMANTIC.filter((s) => alwaysAcyclic(s.cover) !== s.glues).length;
    expect(disagreements).toBeGreaterThan(0);
  });

  test("SABOTAGE CONTROL: an oracle that always answers 'cyclic' also FAILS", () => {
    const alwaysCyclic = (_cover: Cover): boolean => false;
    const disagreements = SEMANTIC.filter((s) => alwaysCyclic(s.cover) !== s.glues).length;
    expect(disagreements).toBeGreaterThan(0);
  });

  test("every certificate validates, on both branches, over every small cover", () => {
    let acyclicSeen = 0;
    let cyclicSeen = 0;
    for (const cover of allSmallCovers()) {
      const v = gyoReduce(cover);
      if (v.acyclic) {
        acyclicSeen++;
        expect(validateJoinTree(cover, v.joinTree)).toEqual([]);
      } else {
        cyclicSeen++;
        expect(validateCyclicCore(cover, v.cyclicCore)).toBe(true);
      }
    }
    // Both branches are genuinely exercised - a certificate check that only ever sees one side
    // is half a check.
    expect(acyclicSeen).toBeGreaterThan(0);
    expect(cyclicSeen).toBeGreaterThan(0);
  });
});

// === Properties =============================================================

const attributeAlphabet = ["A", "B", "C", "D"];

const arbCover = fc
  .array(
    fc
      .subarray(attributeAlphabet, { minLength: 1 })
      .map((attrs) => attrs as readonly string[]),
    { minLength: 1, maxLength: 5 },
  )
  .map((edges) => edges.map((attributes, i) => ({ name: `e${i}`, attributes })) as Cover);

describe("GYO - properties", () => {
  test("CONFLUENCE: the verdict is invariant under the order the elements are given in", () => {
    fc.assert(
      fc.property(arbCover, fc.array(fc.integer(), { minLength: 5, maxLength: 5 }), (cover, keys) => {
        const permuted = cover
          .map((e, i) => ({ e, k: keys[i % keys.length]! }))
          .sort((x, y) => x.k - y.k)
          .map(({ e }) => e);
        expect(isAlphaAcyclic(permuted)).toBe(isAlphaAcyclic(cover));
      }),
      { numRuns: 500 },
    );
  });

  test("the verdict is invariant under bijective renaming of attributes", () => {
    fc.assert(
      fc.property(arbCover, (cover) => {
        const rename = new Map(attributeAlphabet.map((a, i) => [a, `z${attributeAlphabet.length - i}`]));
        const renamed: Cover = cover.map((e) => ({
          name: e.name,
          attributes: e.attributes.map((a) => rename.get(a) ?? a),
        }));
        expect(isAlphaAcyclic(renamed)).toBe(isAlphaAcyclic(cover));
      }),
      { numRuns: 500 },
    );
  });

  test("adding the union of all attributes as one element always makes a cover acyclic", () => {
    // Every element is then contained in that one, so GYO clears it. This is the general form of
    // the CYCLE_PLUS_FULL_EDGE case - and the reason "just materialise the universal relation"
    // is a real, and expensive, escape hatch.
    fc.assert(
      fc.property(arbCover, (cover) => {
        const all = [...new Set(cover.flatMap((e) => e.attributes))];
        const withUniversal: Cover = [...cover, { name: "universal", attributes: all }];
        expect(isAlphaAcyclic(withUniversal)).toBe(true);
      }),
      { numRuns: 300 },
    );
  });

  test("whenever GYO says acyclic, the join tree it emits validates", () => {
    fc.assert(
      fc.property(arbCover, (cover) => {
        const v = gyoReduce(cover);
        if (v.acyclic) expect(validateJoinTree(cover, v.joinTree)).toEqual([]);
        else expect(validateCyclicCore(cover, v.cyclicCore)).toBe(true);
      }),
      { numRuns: 1000 },
    );
  });
});

// === Certificate validators must be able to REJECT ==========================

describe("certificate validators reject bad certificates", () => {
  test("a join tree missing an edge is rejected", () => {
    const v = gyoReduce(CHAIN);
    if (!v.acyclic) throw new Error("unreachable");
    const broken = { nodes: v.joinTree.nodes, edges: v.joinTree.edges.slice(1) };
    expect(validateJoinTree(CHAIN, broken).length).toBeGreaterThan(0);
  });

  test("a join tree violating the running-intersection property is rejected", () => {
    // AB - CD - BC : the path from AB to BC does not carry B, though both contain it.
    const cover: Cover = CHAIN;
    const bad = {
      nodes: ["AB", "BC", "CD"],
      edges: [
        { parent: "CD", child: "AB" },
        { parent: "CD", child: "BC" },
      ],
    };
    const defects = validateJoinTree(cover, bad);
    expect(defects.some((d) => d.kind === "running-intersection-violated")).toBe(true);
  });

  test("an empty cyclic core is rejected", () => {
    expect(validateCyclicCore(THREE_CYCLE, [])).toBe(false);
  });

  test("a 'cyclic core' that GYO could actually reduce is rejected", () => {
    // {A,B} and {A,B,C}: containment fires, so this is not an irreducible core.
    const notACore: Cover = [
      { name: "AB", attributes: ["A", "B"] },
      { name: "ABC", attributes: ["A", "B", "C"] },
    ];
    expect(validateCyclicCore(notACore, notACore)).toBe(false);
  });

  test("a core naming an element that is not in the cover is rejected", () => {
    expect(
      validateCyclicCore(THREE_CYCLE, [{ name: "not-in-cover", attributes: ["A", "B"] }]),
    ).toBe(false);
  });

  test("a core on which rule (E) could still fire is rejected", () => {
    // Two of the three cycle edges: A and C each occur once, so an ear removal is available and
    // this is not an irreducible core. Added to kill a surviving mutant (M10) that dropped the
    // rule-(E) fixed-point check from `validateCyclicCore` and left the suite green.
    expect(validateCyclicCore(THREE_CYCLE, THREE_CYCLE.slice(0, 2))).toBe(false);
  });

  test("REGRESSION: a core carrying the ORIGINAL attributes of an ear-stripped element is rejected", () => {
    // The bug this file caught while being written. On cover {A,B},{B,C},{A,C,D} the reduction
    // strips D (it occurs once) and then gets stuck on a 3-cycle. Reporting the core with D still
    // attached looks like a sub-cover of the input but is NOT a fixed point - rule (E) fires on it.
    const cover: Cover = [
      { name: "AB", attributes: ["A", "B"] },
      { name: "BC", attributes: ["B", "C"] },
      { name: "ACD", attributes: ["A", "C", "D"] },
    ];
    const v = gyoReduce(cover);
    expect(v.acyclic).toBe(false);
    if (v.acyclic) throw new Error("unreachable");
    // What GYO now reports: D stripped, a genuine fixed point.
    expect(v.cyclicCore.find((e) => e.name === "ACD")!.attributes).toEqual(["A", "C"]);
    expect(validateCyclicCore(cover, v.cyclicCore)).toBe(true);
    // What it used to report, and what the validator must refuse:
    expect(validateCyclicCore(cover, cover)).toBe(false);
  });

  test("a core carrying an attribute the named element does not have is rejected", () => {
    expect(
      validateCyclicCore(THREE_CYCLE, [
        { name: "AB", attributes: ["A", "B", "Z"] },
        { name: "BC", attributes: ["B", "C"] },
        { name: "CA", attributes: ["C", "A"] },
      ]),
    ).toBe(false);
  });
});

// === The empty-projection convention (URA) ==================================

describe("pairwise consistency over DISJOINT elements is not vacuous", () => {
  const disjoint: Cover = [
    { name: "onlyA", attributes: ["A"] },
    { name: "onlyB", attributes: ["B"] },
  ];

  test("this cover is acyclic - so the theorem says local consistency must suffice", () => {
    expect(isAlphaAcyclic(disjoint)).toBe(true);
  });

  test("one empty, one nonempty is NOT pairwise consistent, and not globally consistent either", () => {
    // Projection onto the empty attribute set: one empty tuple vs none. If this were treated as
    // trivially consistent, the acyclic cover above would carry a locally-consistent instance with
    // no universal relation, and the BFMY biconditional would read as FALSE. Added to kill a
    // surviving mutant (M11) that skipped disjoint pairs.
    const instance: Instance = { onlyA: [{ A: 0 }], onlyB: [] };
    expect(isPairwiseConsistent(disjoint, instance)).toBe(false);
    expect(isGloballyConsistent(disjoint, instance)).toBe(false);
  });

  test("both nonempty IS consistent, and glues to the cartesian product", () => {
    const instance: Instance = { onlyA: [{ A: 0 }], onlyB: [{ B: 1 }] };
    expect(isPairwiseConsistent(disjoint, instance)).toBe(true);
    expect(isGloballyConsistent(disjoint, instance)).toBe(true);
    expect(naturalJoin(disjoint, instance)).toEqual([{ A: 0, B: 1 }]);
  });

  test("both empty is consistent", () => {
    const instance: Instance = { onlyA: [], onlyB: [] };
    expect(isPairwiseConsistent(disjoint, instance)).toBe(true);
    expect(isGloballyConsistent(disjoint, instance)).toBe(true);
  });
});

// === The search refuses rather than truncating ==============================

describe("searchGluingWitness bounds", () => {
  test("it REFUSES an oversized instance space instead of reporting 'none found'", () => {
    const big: Cover = [
      { name: "e0", attributes: ["A", "B", "C"] },
      { name: "e1", attributes: ["B", "C", "D"] },
      { name: "e2", attributes: ["A", "C", "D"] },
    ];
    const r = searchGluingWitness(big, [0, 1], 1000);
    expect(r.kind).toBe("refused");
    if (r.kind !== "refused") throw new Error("unreachable");
    expect(r.wouldSearch).toBeGreaterThan(1000);
  });

  test("the refusal threshold is where it is claimed to be", () => {
    // Three 2-attribute edges over a 2-value domain: 4 tuples each, 16 relations each, 4096
    // instances. Searchable at 4096, refused at 4095 - so the bound is real and not decorative.
    const small: Cover = THREE_CYCLE;
    expect(searchGluingWitness(small, [0, 1], 4096).kind).not.toBe("refused");
    expect(searchGluingWitness(small, [0, 1], 4095).kind).toBe("refused");
  });
});
