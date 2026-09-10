/**
 * h3-rank3-geometry.test.ts — the falsifiers for Phase 0.
 *
 * The gating question the roadmap named is *"does shading stay exact over an H3 orbit
 * polytope?"*, and it is answered by §THE LIGHT below rather than by prose. Everything else
 * here exists so that answer is worth having: a facet derivation checked against an
 * exhaustive absolute reference, an f-vector checked against Coxeter, and an incidence count
 * that would refuse to be 2 if the surface had no side.
 *
 * Comparison discipline, from rung 7's surviving mutant: **a relative comparison between two
 * paths that share a component is not a falsifier.** So `h3FacetsByWeightOrbits` is judged by
 * `h3FacetsExhaustive`, which shares only the vertex list, and never by a second accelerated
 * path.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  CONVEX_EDGE_FACET_INCIDENCE,
  H3_INTEGRAL_LIGHT,
  H3_SOLIDS,
  PHI_NUMERIC,
  SIMPLE_INNER_PRODUCT_FIVE,
  SIMPLE_INNER_PRODUCT_THREE,
  exactIntegerSqrt,
  h3CosineSquared,
  h3Edges,
  h3Embed,
  h3FacetCycle,
  h3FacetsExhaustive,
  h3FundamentalWeights,
  h3LambertNumerator,
  h3NormalRadical,
  h3Orbit,
  h3Polytope,
  h3RootLight,
  h3Roots,
  h3ShadeFacets,
  h3ShadingField,
  h3SimpleRoots,
  h3Triangulate,
  squareFreePart,
  zCompare,
  zCross,
  zDot,
  zint,
  zIsZero,
  zSign,
  zSqrt,
  zVecCompare,
  zVecIsZero,
  zVecKey,
  zVecSub,
  type H3Solid,
  type VecZphi,
  type Zphi,
} from "./h3-rank3-geometry.ts";

const PHI: Zphi = [0n, 1n];
const numeric = (x: Zphi): number => Number(x[0]) + Number(x[1]) * PHI_NUMERIC;

/**
 * Coxeter's f-vectors for the four H3 orbit polytopes — the EXTERNAL figures.
 *
 * These are not derived here; they are the published combinatorics of the icosahedron, the
 * dodecahedron, the icosidodecahedron and the truncated icosidodecahedron (*Regular
 * Polytopes*, 3rd ed.). Checking the derivation against them is what makes the derivation a
 * measurement rather than a definition — a construction compared only to itself proves that
 * it is self-consistent and nothing else.
 */
const COXETER_F_VECTORS: Record<H3Solid, readonly [number, number, number]> = {
  icosahedron: [12, 30, 20],
  dodecahedron: [20, 30, 12],
  icosidodecahedron: [30, 60, 32],
  truncatedIcosidodecahedron: [120, 180, 62],
};

/** Coxeter's facet-size census for each: which polygons, and how many. */
const COXETER_FACET_SIZES: Record<H3Solid, ReadonlyArray<readonly [number, number]>> = {
  icosahedron: [[3, 20]],
  dodecahedron: [[5, 12]],
  icosidodecahedron: [
    [3, 20],
    [5, 12],
  ],
  truncatedIcosidodecahedron: [
    [4, 30],
    [6, 20],
    [10, 12],
  ],
};

describe("Z[phi] exact ordering", () => {
  test("zSign decides the mixed-sign case by integers, not by a float", () => {
    // 1 - phi is negative (phi > 1); 2 - phi is positive. Both have mixed p/q signs, which is
    // the branch that a naive same-sign shortcut would get wrong.
    expect(zSign([1n, -1n])).toBe(-1);
    expect(zSign([2n, -1n])).toBe(1);
    expect(zSign([-1n, 1n])).toBe(1); // 1/phi = phi - 1 > 0
    expect(zSign([-2n, 1n])).toBe(-1); // phi - 2 < 0
    expect(zSign([0n, 0n])).toBe(0);
  });

  test("zSign agrees with the numeric ordering on every small element", () => {
    // The float is the CONTROL, not the oracle: it is here to catch a sign convention that is
    // internally consistent and still wrong. Values are kept small so no float rounds.
    for (let a = -6n; a <= 6n; a++)
      for (let b = -6n; b <= 6n; b++) {
        const x: Zphi = [a, b];
        const v = numeric(x);
        if (Math.abs(v) < 1e-9) expect(zSign(x)).toBe(0);
        else expect(zSign(x)).toBe(v > 0 ? 1 : -1);
      }
  });

  test("the mixed-sign branch has NO equality case — p^2 = 5q^2 forces p = q = 0", () => {
    // The reason `zSign` returns a strict two-way answer after the same-sign shortcuts, and
    // the reason a `left === right ? 0` branch was removed: it was unreachable. Checked over a
    // window rather than argued, because unreachable code that looks like a case is exactly
    // what mutation testing found here.
    let hits = 0;
    for (let p = -200n; p <= 200n; p++)
      for (let q = -200n; q <= 200n; q++)
        if (p * p === 5n * q * q) {
          expect(p).toBe(0n);
          expect(q).toBe(0n);
          hits++;
        }
    expect(hits).toBe(1);
  });

  test("zCompare is a total order consistent with numeric comparison", () => {
    const values: Zphi[] = [];
    for (let a = -3n; a <= 3n; a++) for (let b = -3n; b <= 3n; b++) values.push([a, b]);
    for (const x of values)
      for (const y of values) {
        const c = zCompare(x, y);
        const d = numeric(x) - numeric(y);
        if (Math.abs(d) < 1e-9) expect(c).toBe(0);
        else expect(c).toBe(d > 0 ? 1 : -1);
      }
  });
});

describe("exact square roots in Z[phi]", () => {
  test("zSqrt round-trips every square and refuses every non-square in a bounded window", () => {
    let squares = 0;
    let refusals = 0;
    for (let a = -4n; a <= 4n; a++)
      for (let b = -4n; b <= 4n; b++) {
        const s: Zphi = [a, b];
        const sq: Zphi = [a * a + b * b, 2n * a * b + b * b];
        const root = zSqrt(sq);
        expect(root).not.toBeNull();
        // Whichever of +-s the search found, squaring it must return the input.
        const r = root as Zphi;
        expect([r[0] * r[0] + r[1] * r[1], 2n * r[0] * r[1] + r[1] * r[1]]).toEqual([sq[0], sq[1]]);
        expect(zSign(r)).toBeGreaterThanOrEqual(0);
        // And it is s or -s, never some third element that happens to square correctly.
        expect(zCompare(r, s) === 0 || zCompare(r, [-s[0], -s[1]]) === 0).toBe(true);
        squares++;
      }
    // A window of values that are NOT squares. The refusal is the falsifier: a zSqrt that
    // returned something for everything would pass every round-trip above and be useless.
    for (const notSquare of [
      [2n, 0n],
      [3n, 0n],
      [6n, 0n],
      [7n, 1n],
      [11n, 3n],
      [60n, 80n],
    ] as Zphi[]) {
      expect(zSqrt(notSquare)).toBeNull();
      refusals++;
    }
    expect(squares).toBe(81);
    expect(refusals).toBe(6);
  });

  test("sqrt 5 IS in the ring — 2 phi - 1 — which is why the refusal list above excludes it", () => {
    // Recorded because the first draft of that list asserted `zSqrt([5, 0]) === null` and the
    // implementation refuted it. `5 = (2 phi - 1)^2` is the ramification of 5 in `Z[phi]`, and
    // it is why a radicand of 5 can never survive `h3NormalRadical`: a factor of 5 is absorbed
    // into the coefficient instead of being left under a root.
    expect(zSqrt([5n, 0n])).toEqual([-1n, 2n]);
    expect(numeric([-1n, 2n])).toBeCloseTo(Math.sqrt(5), 12);
  });

  test("exactIntegerSqrt refuses non-squares and accepts squares", () => {
    expect(exactIntegerSqrt(0n)).toBe(0n);
    expect(exactIntegerSqrt(144n)).toBe(12n);
    expect(exactIntegerSqrt(145n)).toBeNull();
    expect(exactIntegerSqrt(-1n)).toBeNull();
    expect(exactIntegerSqrt(10n ** 20n)).toBe(10n ** 10n);
  });

  test("squareFreePart strips exactly the square factors", () => {
    expect(squareFreePart(1n)).toBe(1n);
    expect(squareFreePart(12n)).toBe(3n); // 4 * 3
    expect(squareFreePart(48n)).toBe(3n); // 16 * 3
    expect(squareFreePart(9n)).toBe(1n);
    expect(squareFreePart(30n)).toBe(30n);
  });
});

describe("the H3 simple system and its weights are DERIVED", () => {
  test("the simple roots reproduce the H3 Coxeter diagram exactly", () => {
    const [a1, a2, a3] = h3SimpleRoots();
    expect(zCompare(zDot(a1, a2), SIMPLE_INNER_PRODUCT_FIVE)).toBe(0);
    expect(zCompare(zDot(a2, a3), SIMPLE_INNER_PRODUCT_THREE)).toBe(0);
    expect(zIsZero(zDot(a1, a3))).toBe(true);
    // Every simple root is a root of the system, not a convenient vector.
    const roots = new Set(h3Roots().map(zVecKey));
    for (const a of [a1, a2, a3]) expect(roots.has(zVecKey(a))).toBe(true);
  });

  test("the three simple roots GENERATE all 30 roots — the property that makes them simple", () => {
    // The Gram matrix above says the triple has the right ANGLES; this says it is a simple
    // system. A simple system generates the whole root system under its own reflections, so
    // closing three vectors and landing on exactly 30 is an independent check that shares
    // nothing with the search that found them.
    //
    // Recorded honestly: this test does NOT kill the mutant that deletes the orthogonality
    // condition from `h3SimpleRoots`, because that condition is redundant *for the order
    // `h3Roots()` happens to return* — the first triple matching the other two conditions is
    // already orthogonal. That mutant is equivalent under this input, not a surviving defect,
    // and the condition stays because it is what the Coxeter diagram says.
    const simple = h3SimpleRoots();
    const set = new Map<string, VecZphi>();
    for (const a of simple) set.set(zVecKey(a), a);
    let frontier: VecZphi[] = [...simple];
    let rounds = 0;
    while (frontier.length > 0 && rounds < 16) {
      const next: VecZphi[] = [];
      for (const x of frontier)
        for (const a of simple) {
          const half = zDot(x, a);
          if (half[0] % 2n !== 0n || half[1] % 2n !== 0n) continue;
          const h: Zphi = [half[0] / 2n, half[1] / 2n];
          const reflected = x.map((c, i) => [
            c[0] - (h[0] * (a[i] as Zphi)[0] + h[1] * (a[i] as Zphi)[1]),
            c[1] - (h[0] * (a[i] as Zphi)[1] + h[1] * (a[i] as Zphi)[0] + h[1] * (a[i] as Zphi)[1]),
          ]) as VecZphi;
          const key = zVecKey(reflected);
          if (!set.has(key)) {
            set.set(key, reflected);
            next.push(reflected);
          }
        }
      frontier = next;
      rounds++;
    }
    expect(set.size).toBe(30);
    expect(new Set(h3Roots().map(zVecKey))).toEqual(new Set(set.keys()));
  });

  test("each fundamental weight is orthogonal to the other two simple roots and to neither of its own", () => {
    const simple = h3SimpleRoots();
    const weights = h3FundamentalWeights();
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        const value = zDot(weights[i] as VecZphi, simple[j] as VecZphi);
        if (i === j) expect(zIsZero(value)).toBe(false);
        else expect(zIsZero(value)).toBe(true);
      }
  });

  test("the weights span rank 3 — no projection is involved anywhere", () => {
    const [w1, w2, w3] = h3FundamentalWeights();
    // Three vectors span R^3 iff their scalar triple product is nonzero, exactly.
    expect(zIsZero(zDot(zCross(w1, w2), w3))).toBe(false);
  });
});

describe("the four orbit polytopes", () => {
  test.each([...H3_SOLIDS])("%s: no reflection ever leaves Z[phi]", (solid) => {
    expect(h3Polytope(solid).nonIntegralReflections).toBe(0);
  });

  test.each([...H3_SOLIDS])("%s: the f-vector matches Coxeter", (solid) => {
    expect(h3Polytope(solid).fVector).toEqual(COXETER_F_VECTORS[solid]);
  });

  test.each([...H3_SOLIDS])("%s: the facet-size census matches Coxeter", (solid) => {
    expect(h3Polytope(solid).facetSizeCensus).toEqual(COXETER_FACET_SIZES[solid]);
  });

  test.each([...H3_SOLIDS])("%s: Euler characteristic is 2", (solid) => {
    expect(h3Polytope(solid).euler).toBe(2);
  });

  test.each([...H3_SOLIDS])(
    "%s: EVERY edge carries exactly 2 facets — the surface has a side, unlike 4_21's 27",
    (solid) => {
      const { incidence } = h3Polytope(solid);
      expect(incidence.min).toBe(CONVEX_EDGE_FACET_INCIDENCE);
      expect(incidence.max).toBe(CONVEX_EDGE_FACET_INCIDENCE);
      expect(incidence.edges).toBe(COXETER_F_VECTORS[solid][1]);
    },
  );

  test.each([...H3_SOLIDS])(
    "%s: the fast facet derivation reproduces the exhaustive supporting-plane reference",
    (solid) => {
      const polytope = h3Polytope(solid);
      const reference = h3FacetsExhaustive(polytope.points);
      expect(reference.length).toBe(polytope.facets.length);
      for (let i = 0; i < reference.length; i++) {
        expect((reference[i] as { vertices: readonly number[] }).vertices).toEqual(
          (polytope.facets[i] as { vertices: readonly number[] }).vertices,
        );
      }
    },
  );

  test.each([...H3_SOLIDS])("%s: derivation is deterministic — two runs are identical", (solid) => {
    const a = h3Polytope(solid);
    const b = h3Polytope(solid);
    expect(a.points.map(zVecKey)).toEqual(b.points.map(zVecKey));
    expect(a.facets.map((f) => f.vertices.join(","))).toEqual(b.facets.map((f) => f.vertices.join(",")));
  });

  test("the orbit order is a strict total order with no duplicates", () => {
    for (const solid of H3_SOLIDS) {
      const { points } = h3Polytope(solid);
      for (let i = 1; i < points.length; i++)
        expect(zVecCompare(points[i - 1] as VecZphi, points[i] as VecZphi)).toBe(-1);
    }
  });

  test("an orbit whose reflections leave the ring reports it instead of silently truncating", () => {
    // The defect this guards, measured while writing the module: a seed off the integral
    // lattice closes at a SMALLER set because every non-integral reflection is skipped, and a
    // silent skip reports a cube where a 120-vertex polytope belongs.
    const offLattice: VecZphi = [zint(1n), zint(0n), zint(0n)];
    const result = h3Orbit(offLattice);
    expect(result.nonIntegralReflections).toBeGreaterThan(0);
    expect(result.points.length).toBeLessThan(12);
  });
});

describe("the vertex-sum normal, rung 6's construction at rank 3", () => {
  test.each([...H3_SOLIDS])("%s: the vertex sum is exactly orthogonal to every facet edge", (solid) => {
    const { points, facets } = h3Polytope(solid);
    for (const facet of facets) {
      const base = points[facet.vertices[0] as number] as VecZphi;
      for (const v of facet.vertices.slice(1)) {
        const edge = zVecSub(points[v as number] as VecZphi, base);
        expect(zIsZero(zDot(facet.normal, edge))).toBe(true);
      }
    }
  });

  test.each([...H3_SOLIDS])(
    "%s: the vertex sum is parallel to the cross-product plane normal — two mechanisms, one answer",
    (solid) => {
      const { facets } = h3Polytope(solid);
      for (const facet of facets) {
        expect(zVecIsZero(zCross(facet.normal, facet.planeNormal))).toBe(true);
        // And it does not vanish, which is what makes it usable as a normal at all.
        expect(zVecIsZero(facet.normal)).toBe(false);
      }
    },
  );

  test.each([...H3_SOLIDS])("%s: |n|^2 is a single value per facet SIZE", (solid) => {
    const { facets } = h3Polytope(solid);
    const bySize = new Map<number, string>();
    for (const facet of facets) {
      const key = `${facet.normalNormSquared[0]},${facet.normalNormSquared[1]}`;
      const seen = bySize.get(facet.vertices.length);
      if (seen === undefined) bySize.set(facet.vertices.length, key);
      else expect(key).toBe(seen);
    }
    expect(bySize.size).toBe(COXETER_FACET_SIZES[solid].length);
  });

  test("the normal points OUTWARD on every facet — orientation is determined, unlike 4_21's 768", () => {
    for (const solid of H3_SOLIDS) {
      const { points, facets } = h3Polytope(solid);
      for (const facet of facets) {
        // <n, v> for any vertex of the facet must be positive: the facet's supporting plane
        // has the origin strictly on the inside.
        const v = points[facet.vertices[0] as number] as VecZphi;
        expect(zSign(zDot(facet.normal, v))).toBe(1);
      }
    }
  });

  test("the facet cycle closes and its consecutive pairs are genuine edges", () => {
    for (const solid of H3_SOLIDS) {
      const { points, facets } = h3Polytope(solid);
      const edges = new Set(h3Edges(points, facets).map((e) => `${e.a}-${e.b}`));
      for (const facet of facets) {
        const cycle = h3FacetCycle(points, facet);
        expect(new Set(cycle).size).toBe(facet.vertices.length);
        for (let i = 0; i < cycle.length; i++) {
          const u = cycle[i] as number;
          const v = cycle[(i + 1) % cycle.length] as number;
          expect(edges.has(`${Math.min(u, v)}-${Math.max(u, v)}`)).toBe(true);
        }
      }
    }
  });
});

describe("THE LIGHT — the gating question the roadmap named", () => {
  test("the icosahedron's normal norm is exactly 12 + 12phi = 12 phi^2, so |n| = 2 phi sqrt 3", () => {
    const { facets } = h3Polytope("icosahedron");
    const n2 = (facets[0] as { normalNormSquared: Zphi }).normalNormSquared;
    expect(n2).toEqual([12n, 12n]);
    // 12 phi^2 = 12(phi + 1) = 12 + 12 phi — checked by the ring, not by the numeral.
    expect(zCompare(n2, [12n * 1n + 12n * 0n, 12n] as Zphi)).toBe(0);
    const radical = h3NormalRadical(n2);
    expect(radical).not.toBeNull();
    expect((radical as { radicand: bigint }).radicand).toBe(3n);
    expect((radical as { coefficient: Zphi }).coefficient).toEqual([0n, 2n]); // 2 phi
  });

  test("the Lambert cosine over the icosahedron closes over Q(phi, sqrt 3) — ONE named irrational", () => {
    const { facets } = h3Polytope("icosahedron");
    for (const light of [h3RootLight(0), H3_INTEGRAL_LIGHT]) {
      for (const facet of facets) {
        const field = h3ShadingField(light, facet.normal);
        expect(field.cosineRadicand).toBe(3n);
      }
    }
  });

  test("cos^2 is an EXACT ratio in Q(phi) for every facet of every solid and both lights", () => {
    for (const solid of H3_SOLIDS) {
      const { facets } = h3Polytope(solid);
      for (const light of [h3RootLight(0), H3_INTEGRAL_LIGHT]) {
        for (const facet of facets) {
          const ratio = h3CosineSquared(light, facet.normal);
          // Exactness first: it is a ratio of two ring elements, and the denominator is
          // strictly positive so the value is well defined without any tolerance.
          expect(zSign(ratio.denominator)).toBe(1);
          expect(zSign(ratio.numerator)).toBeGreaterThanOrEqual(0);
          // Control: the exact ratio must equal the float computation. The float is the
          // control, not the definition — it exists to catch an exact formula that is
          // self-consistently wrong.
          const n = h3Embed(facet.normal);
          const l = h3Embed(light);
          const dot = n[0] * l[0] + n[1] * l[1] + n[2] * l[2];
          const expected = (dot * dot) / ((n[0] ** 2 + n[1] ** 2 + n[2] ** 2) * (l[0] ** 2 + l[1] ** 2 + l[2] ** 2));
          expect(numeric(ratio.numerator) / numeric(ratio.denominator)).toBeCloseTo(expected, 10);
          // And cos^2 is a cosine squared, so it is in [0, 1].
          expect(numeric(ratio.numerator) / numeric(ratio.denominator)).toBeLessThanOrEqual(1 + 1e-12);
        }
      }
    }
  });

  test("the NEGATIVE result is stated: pentagonal and decagonal normals have no single rational radical", () => {
    // 60 + 80 phi = 5 sqrt 5 phi^3, and phi is a unit that is not a square in Z[phi], so no
    // `c^2 d` factorisation with d a square-free rational integer exists. Reported as `null`
    // rather than rounded into the nearest one that does.
    const dodecahedron = h3Polytope("dodecahedron");
    const pentagon = dodecahedron.facets[0] as { normalNormSquared: Zphi };
    expect(pentagon.normalNormSquared).toEqual([60n, 80n]);
    expect(h3NormalRadical(pentagon.normalNormSquared)).toBeNull();
    expect(h3ShadingField(h3RootLight(0), (dodecahedron.facets[0] as { normal: VecZphi }).normal).cosineRadicand).toBeNull();
  });

  test("the light gauge is discharged: every one of the 30 roots gives the same intensity multiset", () => {
    // Rung 6's transitivity argument, at rank 3. If this failed, "the light is a root" would
    // be a choice of content rather than a choice of frame.
    const { facets } = h3Polytope("icosahedron");
    const signature = (light: VecZphi): string =>
      facets
        .map((f) => h3LambertNumerator(light, f.normal))
        .map((v) => (zSign(v) < 0 ? ([-v[0], -v[1]] as Zphi) : v))
        .sort(zCompare)
        .map((v) => `${v[0]},${v[1]}`)
        .join("|");
    const reference = signature(h3RootLight(0));
    for (let i = 1; i < 30; i++) expect(signature(h3RootLight(i))).toBe(reference);
  });

  test("a NON-root integral light saturates: every facet gets its own exact level, at no cost in exactness", () => {
    for (const solid of H3_SOLIDS) {
      const { facets } = h3Polytope(solid);
      const census = h3ShadeFacets(H3_INTEGRAL_LIGHT, facets);
      expect(census.signedLevels.length).toBe(facets.length);
      expect(census.terminatorFacets).toBe(0);
      // Saturation is the ceiling: a level count above the facet count is impossible, so this
      // is the finest a flat-shaded render of this object can be.
      expect(census.signedLevels.length).toBeLessThanOrEqual(facets.length);
    }
  });

  test("a ROOT light posterises, and the counts are the measurement", () => {
    const icosahedron = h3ShadeFacets(h3RootLight(0), h3Polytope("icosahedron").facets);
    expect(icosahedron.signedLevels.length).toBe(7);
    expect(icosahedron.absoluteLevels.length).toBe(4);
    expect(icosahedron.litLevels.length).toBe(3);
    expect(icosahedron.terminatorFacets).toBe(4);
  });

  test("the integral light has a RATIONAL norm, which is why it costs no exactness", () => {
    expect(zDot(H3_INTEGRAL_LIGHT, H3_INTEGRAL_LIGHT)).toEqual([49n, 0n]);
    const radical = h3NormalRadical([49n, 0n]);
    expect(radical).not.toBeNull();
    expect((radical as { radicand: bigint }).radicand).toBe(1n);
    expect((radical as { coefficient: Zphi }).coefficient).toEqual([7n, 0n]);
  });

  test("the census counts sum to the facet count and are ordered", () => {
    for (const solid of H3_SOLIDS) {
      const { facets } = h3Polytope(solid);
      const census = h3ShadeFacets(h3RootLight(0), facets);
      expect(census.census.reduce((s, [, c]) => s + c, 0)).toBe(facets.length);
      for (let i = 1; i < census.census.length; i++)
        expect(zCompare((census.census[i - 1] as [Zphi, number])[0], (census.census[i] as [Zphi, number])[0])).toBe(-1);
    }
  });
});

describe("triangulation and the readout boundary", () => {
  test.each([...H3_SOLIDS])("%s: fan triangulation adds no vertices and covers every facet", (solid) => {
    const { points, facets } = h3Polytope(solid);
    const triangles = h3Triangulate(points, facets);
    const expected = facets.reduce((s, f) => s + f.vertices.length - 2, 0);
    expect(triangles.length).toBe(expected);
    for (const [a, b, c] of triangles) {
      expect(a).toBeLessThan(points.length);
      expect(b).toBeLessThan(points.length);
      expect(c).toBeLessThan(points.length);
      expect(new Set([a, b, c]).size).toBe(3);
    }
  });

  test("the module contains exactly ONE Math.sqrt call site, and it is the readout", () => {
    // The source is read COMMENT-STRIPPED. Counting on raw source is a defect this repository
    // has hit repeatedly: the docstring above `h3Embed` names `Math.sqrt(` twice, so the raw
    // count is three and the assertion would be satisfied by prose rather than by code.
    const raw = readFileSync(new URL("./h3-rank3-geometry.ts", import.meta.url), "utf8");
    const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const sites = stripped.match(/Math\.sqrt\(/g) ?? [];
    expect(sites.length).toBe(1);
    expect(stripped).toContain("PHI_NUMERIC: number = (1 + Math.sqrt(5)) / 2");
    // The control: the raw source has MORE, which is exactly why the strip is load-bearing.
    expect((raw.match(/Math\.sqrt\(/g) ?? []).length).toBeGreaterThan(sites.length);
  });

  test("h3Embed evaluates the ring correctly", () => {
    expect(h3Embed([zint(1n), PHI, [1n, 1n]])).toEqual([1, PHI_NUMERIC, 1 + PHI_NUMERIC]);
    // phi^2 = phi + 1, checked at the readout as well as in the ring.
    expect(PHI_NUMERIC * PHI_NUMERIC).toBeCloseTo(PHI_NUMERIC + 1, 12);
  });
});
