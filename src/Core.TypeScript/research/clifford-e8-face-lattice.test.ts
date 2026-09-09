import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { e8Roots } from "./clifford-e8-coxeter-projection.ts";
import {
  adjacencyBitset,
  affineRank,
  AMBIENT_DIMENSION,
  BIVECTOR_BASIS,
  bivectorNormSquared,
  bivectorSelfWedge,
  cliqueCentroidDirections,
  cliqueCounts,
  cliquesOfSize,
  deriveFaceCandidates,
  deriveFacets,
  eulerAlternatingSum,
  FACE_BIVECTOR_NORM_SQUARED,
  faceBivector,
  faceNormals3d,
  fVector,
  isSimpleBlade,
  isSupporting,
  maxFace,
  orthogonalPairDirections,
  renderShadedObj,
  triangleFaces,
} from "./clifford-e8-face-lattice.ts";

const ROOTS = e8Roots();
const FACES = triangleFaces(ROOTS);
const FACETS = deriveFacets(ROOTS);
const CLIQUES = cliqueCounts(10, ROOTS);

/**
 * The measured f-vector. Every entry was counted by this module; none was copied from a
 * table. Coxeter's published values are the external comparison, not the source.
 */
const MEASURED_F_VECTOR = [240, 6720, 60480, 241920, 483840, 483840, 207360, 19440] as const;

/** Facet census, measured: 7-simplices and 7-orthoplexes by vertex count. */
const MEASURED_SIMPLEX_FACETS = 17280;
const MEASURED_ORTHOPLEX_FACETS = 2160;

/** Faces whose 3D plane contains the origin, so the outward gauge cannot fix their sign. */
const MEASURED_ORIENTATION_UNDETERMINED = 768;

// Small bitset helpers, used by the link-chain falsifier so it counts independently of
// the module's own clique enumeration rather than re-running it.
const { words, stride, size } = adjacencyBitset(ROOTS);
const row = (v: number): Uint32Array => words.subarray(v * stride, v * stride + stride);
const popcount = (x: number): number => {
  let y = x - ((x >>> 1) & 0x55555555);
  y = (y & 0x33333333) + ((y >>> 2) & 0x33333333);
  y = (y + (y >>> 4)) & 0x0f0f0f0f;
  return Math.imul(y, 0x01010101) >>> 24;
};
const commonNeighbours = (vs: readonly number[]): number => {
  let total = 0;
  for (let w = 0; w < stride; w++) {
    let m = 0xffffffff;
    for (const v of vs) m &= row(v)[w] ?? 0;
    total += popcount(m >>> 0);
  }
  return total;
};

describe("rung 5 — the face set is derived, and the f-vector is what falsifies it", () => {
  // ── FALSIFIER 1: THE NUMBER RUNG 4 COULD NOT CHECK ───────────────────────
  //
  // The rung-4 doc quoted 60,480 triangles from Coxeter and said outright that it had
  // not counted them. A quoted number sitting unchecked in a repository that measures
  // things is the vacuity class with a fuse on it. This counts them from the root graph.
  it("counts 60,480 triangles — the number rung 4 quoted and could not verify", () => {
    expect(FACES.length).toBe(60480);
    expect(CLIQUES[3]).toBe(60480);
    // And the face set really is the triangle set: every face is three mutually adjacent
    // roots, ascending, distinct. A triple with a non-edge in it must not be here.
    const inner = (a: number, b: number): number =>
      (ROOTS[a] ?? []).reduce((s, x, k) => s + x * ((ROOTS[b] ?? [])[k] ?? 0), 0);
    for (const [a, b, c] of FACES.slice(0, 2000)) {
      expect(a).toBeLessThan(b);
      expect(b).toBeLessThan(c);
      expect(inner(a, b)).toBe(4);
      expect(inner(b, c)).toBe(4);
      expect(inner(a, c)).toBe(4);
    }
    const keys = new Set(FACES.map((f) => f.join(",")));
    expect(keys.size).toBe(60480);
  });

  // ── FALSIFIER 2: THE F-VECTOR AND ITS ALTERNATING SUM ────────────────────
  //
  // The load-bearing check. Eight counts, produced by two unrelated mechanisms — clique
  // enumeration for f0..f6, supporting-hyperplane derivation for f7 — are forced by the
  // Euler-Poincare relation to cancel exactly. chi(S^7) = 0, so the sum is 0, not 2.
  it("measures the f-vector, and its alternating sum is exactly zero", () => {
    const f = fVector(ROOTS);
    expect(f).toEqual([...MEASURED_F_VECTOR]);
    expect(eulerAlternatingSum(f)).toBe(0);
    // The check has teeth only if it is tight. Perturb any single entry by one and it
    // must break — otherwise the sum is a coincidence of large numbers, not a law.
    for (let k = 0; k < f.length; k++) {
      const bumped = [...f];
      bumped[k] = (bumped[k] ?? 0) + 1;
      expect(eulerAlternatingSum(bumped)).not.toBe(0);
    }
    // A d-polytope's alternating sum is 1 - (-1)^d, so an odd-dimensional analogue would
    // give 2. Asserting the value rather than "is falsy" is what makes 0 informative.
    expect(eulerAlternatingSum([1, 0])).toBe(1);
  });

  // ── FALSIFIER 3: THE CLIQUE MECHANISM IS COMPLETE ────────────────────────
  //
  // f0..f6 are clique counts only because every proper face below the facets is a
  // simplex. If the graph had 9-cliques the identification would be wrong somewhere, so
  // the enumeration is run past where it should stop and the stop is measured.
  it("the clique ladder stops dead at size 8", () => {
    expect(CLIQUES.slice(1, 9)).toEqual([...MEASURED_F_VECTOR.slice(0, 7), MEASURED_SIMPLEX_FACETS]);
    expect(CLIQUES[9]).toBe(0);
    expect(CLIQUES[10]).toBe(0);
    // The enumerator emits each clique once, so cliquesOfSize agrees with the counter.
    expect(cliquesOfSize(3, ROOTS).length).toBe(CLIQUES[3] ?? -1);
    expect(cliquesOfSize(8, ROOTS).length).toBe(CLIQUES[8] ?? -1);
  });

  // ── FALSIFIER 4: THE FACETS, AND THE RIDGE AUDIT ─────────────────────────
  //
  // f7 comes from a different mechanism than f0..f6, so it gets its own falsifier. Every
  // derived facet must actually support the polytope (no root strictly beyond its
  // hyperplane) and have affine rank 7. The census splits into exactly two kinds, and the
  // ridge count audits: every 6-face lies in exactly two facets, so 2*f6 must equal the
  // total 6-face count summed over facets — 8 per 7-simplex, 2^7 per 7-orthoplex.
  it("derives 19,440 facets in two kinds, and the ridge incidence audits exactly", () => {
    expect(FACETS.length).toBe(19440);
    const bySize = new Map<number, number>();
    for (const facet of FACETS) {
      expect(facet.rank).toBe(AMBIENT_DIMENSION - 1);
      bySize.set(facet.vertices.length, (bySize.get(facet.vertices.length) ?? 0) + 1);
    }
    expect(bySize.get(8)).toBe(MEASURED_SIMPLEX_FACETS);
    expect(bySize.get(14)).toBe(MEASURED_ORTHOPLEX_FACETS);
    expect(bySize.size).toBe(2);
    for (const facet of FACETS) expect(isSupporting(facet, ROOTS)).toBe(true);
    const ridgesFromFacets = MEASURED_SIMPLEX_FACETS * 8 + MEASURED_ORTHOPLEX_FACETS * 2 ** 7;
    expect(2 * (CLIQUES[7] ?? 0)).toBe(ridgesFromFacets);
    // The candidate families are independent and none is redundant.
    expect(orthogonalPairDirections(ROOTS).length).toBe(MEASURED_ORTHOPLEX_FACETS);
    expect(cliqueCentroidDirections(ROOTS).length).toBe(MEASURED_SIMPLEX_FACETS);
    // THE RANK FILTER MUST ACTUALLY REJECT SOMETHING. A dimension test that accepts
    // every candidate it is ever handed is a check that cannot fail; this module's
    // first draft had exactly that defect and a mutation run is what found it. The 240
    // root directions each support a single vertex, so the filter has real work to do.
    const candidates = deriveFaceCandidates(ROOTS);
    const byRank = new Map<number, number>();
    for (const c of candidates) byRank.set(c.rank, (byRank.get(c.rank) ?? 0) + 1);
    expect([...byRank.entries()].sort((a, b) => a[0] - b[0])).toEqual([
      [0, 240],
      [7, 19440],
    ]);
    expect(candidates.length - FACETS.length).toBe(240);
    expect(affineRank(maxFace(ROOTS[0] ?? [], ROOTS), ROOTS)).toBe(0);
  });

  // ── FALSIFIER 5: THE BLADE ───────────────────────────────────────────────
  //
  // The normal is a grade-2 blade, and two exact-integer properties make that a
  // measurement rather than a re-skin. |B|^2 = 48 by the Lagrange identity on an
  // equilateral triangle of side sqrt(8); and B ^ B = 0, the Pluecker condition, which in
  // 8 dimensions the generic bivector fails.
  it("every face's bivector is an integer simple blade of squared magnitude 48", () => {
    expect(BIVECTOR_BASIS.length).toBe(28);
    for (const [a, b, c] of FACES) {
      const B = faceBivector(ROOTS[a] ?? [], ROOTS[b] ?? [], ROOTS[c] ?? []);
      expect(B.length).toBe(28);
      expect(B.every((x) => Number.isInteger(x))).toBe(true);
      expect(bivectorNormSquared(B)).toBe(FACE_BIVECTOR_NORM_SQUARED);
      expect(bivectorSelfWedge(B).every((x) => x === 0)).toBe(true);
    }
    // Control — the blade predicate must be capable of saying no. e0^e1 + e2^e3 is the
    // canonical non-simple bivector in dimension >= 4; if this passed, the check above
    // would be measuring nothing.
    const notSimple = BIVECTOR_BASIS.map(([i, j]) => ((i === 0 && j === 1) || (i === 2 && j === 3) ? 1 : 0));
    expect(isSimpleBlade(notSimple)).toBe(false);
    expect(isSimpleBlade(BIVECTOR_BASIS.map(([i, j]) => (i === 0 && j === 1 ? 1 : 0)))).toBe(true);
  });

  // ── FALSIFIER 6: PROVENANCE — AARON'S CONSTRAINT, MECHANICAL ─────────────
  //
  // "our rendering surface should only come from our clifford." Every face vertex is an
  // index into the derived root set, and every face is contained in derived facets — 26
  // of them, split 16 simplex and 10 orthoplex, which is the 5-demicube face figure of
  // the Gosset k_21 series. A hand-placed triangle has no root index and lies in nothing.
  it("every face is contained in exactly 26 derived facets, split 16 + 10", () => {
    const facetsOfVertex: number[][] = Array.from({ length: ROOTS.length }, () => []);
    FACETS.forEach((facet, i) => {
      for (const v of facet.vertices) facetsOfVertex[v]?.push(i);
    });
    const split = new Map<string, number>();
    for (const [a, b, c] of FACES) {
      const inA = new Set(facetsOfVertex[a] ?? []);
      const inB = new Set(facetsOfVertex[b] ?? []);
      let simplex = 0;
      let orthoplex = 0;
      for (const i of facetsOfVertex[c] ?? []) {
        if (!inA.has(i) || !inB.has(i)) continue;
        if ((FACETS[i]?.vertices.length ?? 0) === 8) simplex++;
        else orthoplex++;
      }
      const key = `${simplex}+${orthoplex}`;
      split.set(key, (split.get(key) ?? 0) + 1);
    }
    expect([...split.entries()]).toEqual([["16+10", 60480]]);
    // Every root index a face carries is in range, and all 240 roots are used.
    const used = new Set<number>();
    for (const f of FACES) for (const v of f) used.add(v);
    expect(used.size).toBe(240);
  });

  // ── FALSIFIER 7: THE GOSSET k_21 FIGURE CHAIN ────────────────────────────
  //
  // Independent of the counts above: the link of a k-clique in the root graph must be
  // constant, and the constants are the vertex counts of the k_21 series descending from
  // 4_21 — 3_21 (56), 2_21 (27), 1_21 (16), 0_21 (10). A wrong adjacency test breaks the
  // constancy before it breaks any total, so this fails earlier and louder.
  it("the vertex, edge, triangle and tetrahedron figures are 56, 27, 16 and 10", () => {
    const degrees = new Set(Array.from({ length: size }, (_, v) => commonNeighbours([v])));
    expect([...degrees]).toEqual([56]);
    const edgeLinks = new Set<number>();
    for (const [a, b] of cliquesOfSize(2, ROOTS)) edgeLinks.add(commonNeighbours([a ?? 0, b ?? 0]));
    expect([...edgeLinks]).toEqual([27]);
    const faceLinks = new Set<number>();
    for (const [a, b, c] of FACES) faceLinks.add(commonNeighbours([a, b, c]));
    expect([...faceLinks]).toEqual([16]);
    const cellLinks = new Set<number>();
    for (const q of cliquesOfSize(4, ROOTS)) cellLinks.add(commonNeighbours(q));
    expect([...cellLinks]).toEqual([10]);
    // The chain has to reproduce the counts the other mechanism measured, or one of them
    // is wrong: f2 = f1 * 27 / 3 and f3 = f2 * 16 / 4.
    expect(((MEASURED_F_VECTOR[1] * 27) / 3) | 0).toBe(MEASURED_F_VECTOR[2]);
    expect(((MEASURED_F_VECTOR[2] * 16) / 4) | 0).toBe(MEASURED_F_VECTOR[3]);
  });

  // ── FALSIFIER 8: THE NORMALS, AND THE GAUGE THAT ADMITS WHERE IT STOPS ───
  //
  // A shaded surface needs a non-degenerate normal per face. Every one of the 60,480
  // faces has one under rung 3's embedding — measured, not hoped for. The outward gauge
  // then fixes the sign for all but a measured 768 whose plane contains the origin, and
  // those are flagged rather than guessed.
  it("derives a non-degenerate 3D normal for every face and reports the gauge's limit", () => {
    const normals = faceNormals3d(FACES, ROOTS);
    expect(normals.length).toBe(60480);
    let undetermined = 0;
    let outward = 0;
    for (const n of normals) {
      expect(Math.hypot(n.normal.x, n.normal.y, n.normal.z)).toBeGreaterThan(1e-9);
      if (n.orientationUndetermined) undetermined++;
    }
    expect(undetermined).toBe(MEASURED_ORIENTATION_UNDETERMINED);
    // Where the gauge does apply it must actually have applied: the oriented normal
    // agrees with the face centroid. Checked against the un-oriented run, so a no-op
    // `orientOutward` cannot pass.
    const raw = faceNormals3d(FACES, ROOTS, false);
    let flipped = 0;
    normals.forEach((n, i) => {
      const r = raw[i];
      if (r === undefined) return;
      if (n.normal.x !== r.normal.x || n.normal.y !== r.normal.y || n.normal.z !== r.normal.z) flipped++;
      if (!n.orientationUndetermined) outward++;
    });
    expect(outward).toBe(60480 - MEASURED_ORIENTATION_UNDETERMINED);
    expect(flipped).toBeGreaterThan(0);
    expect(flipped).toBeLessThan(outward);
  });

  // ── FALSIFIER 9: THE SHADABLE ARTIFACT ───────────────────────────────────
  it("emits an OBJ with one derived normal per derived face", () => {
    const obj = renderShadedObj(ROOTS);
    const lines = obj.split("\n");
    expect(lines.filter((l) => l.startsWith("v ")).length).toBe(240);
    expect(lines.filter((l) => l.startsWith("vn ")).length).toBe(60480);
    expect(lines.filter((l) => l.startsWith("f ")).length).toBe(60480);
    // Every face element references three of the 240 vertices and its own normal.
    const face = lines.find((l) => l.startsWith("f "));
    expect(face).toMatch(/^f \d+\/\/1 \d+\/\/1 \d+\/\/1$/);
    // Honest about what it is not: the header says so, because a reader will otherwise
    // assume a closed solid.
    expect(obj).toContain("NOT a closed manifold");
  });

  // ── FALSIFIER 10: NONINTERFERENCE (§13) ──────────────────────────────────
  //
  // Comments are stripped before the scan and the CALL form is matched, because prose
  // about not reaching for a clock has satisfied guards of this shape before.
  it("the module reaches for no ambient entropy", () => {
    const path = new URL("./clifford-e8-face-lattice.ts", import.meta.url).pathname;
    const source = readFileSync(path, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(source).not.toContain("Math.random(");
    expect(source).not.toContain("Date.now(");
    expect(source).not.toContain("new Date(");
    expect(source).not.toContain("performance.now(");
    expect(source).not.toContain("process.env");
    // Control: the stripper must not have eaten the file. `Math.hypot(` is the 3D normal
    // magnitude and has to survive.
    expect(source).toContain("Math.hypot(");
    expect(source.length).toBeGreaterThan(2000);
  });

  // ── FALSIFIER 11: DST (§7) ───────────────────────────────────────────────
  it("replays identically — no seed, because there is no randomness to seed", () => {
    expect(triangleFaces(ROOTS)).toEqual(FACES);
    expect(fVector(ROOTS)).toEqual(fVector(ROOTS));
    expect(renderShadedObj(ROOTS)).toBe(renderShadedObj(ROOTS));
  });
});
