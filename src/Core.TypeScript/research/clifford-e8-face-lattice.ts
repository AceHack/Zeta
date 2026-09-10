/**
 * clifford-e8-face-lattice.ts — RUNG 5: THE FACE SET, AND THE F-VECTOR AS ITS FALSIFIER.
 *
 * Aaron 2026-09-08, the progression and the constraint that governs every rung of it:
 * *"we can go fome lines to drawings over time then 3d renderoring based on multi lary
 * tellesaling over time"* and *"our rendering surface should only come from our clifford
 * if we cant generate it from clifford that's not our research."*
 *
 *   1. **lines** — `clifford-e8-coxeter-projection.ts`, the Coxeter-plane projection.
 *   2. **drawings** — the Gosset 4_21 edge set, same module, by exact integer test.
 *   3. **3D by multi-layer tessellation** — `clifford-e8-eigenlayer-tessellation.ts`.
 *   4. **filled regions, exact integers** — `clifford-e8-exact-coverage.ts`.
 *   5. **faces and normals** — here. Area needs a boundary; *shading* needs a face and a
 *      normal, and this is the rung where both stop being hand-supplied.
 *
 * ## What rung 5 adds, in one sentence
 *
 * The **2-faces** of the Gosset polytope 4_21 — derived as the triangles of the same
 * integer adjacency test rung 2 already ran — each carrying a **grade-2 blade** whose 28
 * components are exact integers, which is the normal a shaded surface consumes.
 *
 * ## Rung 4 named this rung, and named the first thing it had to fix
 *
 * `docs/research/2026-09-09-zeta-graphics-engine-derived-geometry-and-the-exact-coverage-boundary.md`
 * §10 proposed exactly this step and flagged its own weakest point: *"60,480 triangles,
 * which is **UNVERIFIED here — I have not counted them**"*. That number was quoted from
 * Coxeter, and a quoted number standing in a repository that measures things is the
 * vacuity class waiting to happen. **It is now measured: 60,480 triangles, counted from
 * the root graph.** Coxeter held. The count is in the sibling test file, not in prose.
 *
 * ## Nothing new is constructed. That is the whole design.
 *
 * Rung 3 introduced no new construction (it ran rung 1's recipe on the other
 * eigenvectors); rung 5 introduces none either. Rung 2 established that two roots are
 * joined by a 4_21 edge exactly when their inner product is 4 in the doubled coordinates
 * — an integer test with no tolerance. A 2-face is then a **triangle of that same graph**,
 * and the entire face set falls out of a relation that was already computed. No hull
 * algorithm, no discretization parameter, no vertex placed by hand.
 *
 * The honest question that leaves open is whether every triangle of the graph really is a
 * face of the polytope, and that is not assumed here — it is measured two ways below
 * (facet containment, and the Euler alternating sum).
 *
 * ## The falsifier: the f-vector, and its alternating sum
 *
 * For a convex d-polytope the **Euler–Poincaré relation** gives
 * `sum_{k=0}^{d-1} (-1)^k f_k = 1 - (-1)^d`, which for d = 8 is exactly **zero** — the
 * boundary is a 7-sphere and chi(S^7) = 0. This is a conservation law of precisely the
 * same character as Pick's residual in rung 4: three unrelated computations are forced
 * into one identity, so a wrong face set cannot quietly pass.
 *
 * It is load-bearing here in a way it would not be for a smaller object. `f2` alone could
 * be wrong in a way that looks plausible. `f0..f7` summing to zero cannot: eight counts
 * produced by two different mechanisms (clique enumeration for `f0..f6`, supporting-
 * hyperplane derivation for `f7`) have to cancel to the digit.
 *
 * ## How each entry is derived, and why two mechanisms rather than one
 *
 * **`f0` through `f6` — clique enumeration.** Every proper face of 4_21 of dimension at
 * most 6 is a simplex: the facets are 7-simplices and 7-orthoplexes, and every proper
 * face of an orthoplex is a simplex. So a (k-1)-face is exactly a k-clique of the root
 * graph, and `cliqueCounts` measures them. That the enumeration stops dead at size 8 —
 * zero 9-cliques — is itself measured rather than assumed.
 *
 * **`f7` — supporting hyperplanes, from directions the root system itself supplies.** The
 * facets are *not* all cliques (a 7-orthoplex's 14 vertices include non-adjacent pairs),
 * so the clique mechanism cannot reach them and a second derivation is required. Both
 * candidate normal families come out of the roots with no lattice theory imported:
 *
 * - **Orthogonal root pairs.** `r + s` for `<r,s> = 0`. There are 15,120 such pairs and
 *   they collapse onto a much smaller set of distinct directions — measured, not assumed.
 * - **Clique centroids.** The sum of the eight roots of each 8-clique. The stabiliser of
 *   a simplex facet permutes its vertices, so the facet normal must be invariant under
 *   that permutation, and the vertex sum is.
 *
 * - **The roots themselves.** These support a single vertex apiece, so they are the 240
 *   candidates the rank filter must REJECT. They are in the candidate set for exactly
 *   that reason: a dimension filter with nothing to reject is a check that cannot fail,
 *   and the first draft of this module had precisely that defect — found by mutation,
 *   not by reading.
 *
 * For each candidate direction `n`, `maxFace` returns the roots attaining `max <r,n>` —
 * the face that hyperplane supports, by construction. A candidate is a facet exactly when
 * that face has affine rank 7. The count audit is the falsifier: the families are
 * generated independently and the candidates must partition cleanly by rank and by
 * vertex count.
 *
 * ## The normal is a bivector, and its components are integers
 *
 * `faceBivector(a, b, c)` is the grade-2 part of `(b - a) ^ (c - a)` in Cl(8,0) — 28
 * components, one per basis blade `e_i ^ e_j`. This is the same outer product rung 4 uses
 * in one dimension fewer, where it collapses to the single blade `e1 ^ e2` and reads as a
 * signed area; here it does not collapse, and what it carries is the **oriented plane of
 * the face** — which is what a normal *is*, before a dimension-3 accident lets you write
 * it as a vector.
 *
 * Two properties make it a falsifier rather than a description, and both are exact
 * integer statements:
 *
 * - **`|B|^2 = 48`, for every face.** By the Lagrange identity `|u ^ v|^2 = |u|^2 |v|^2 -
 *   <u,v>^2`. Every 4_21 edge has squared length 8 in the doubled coordinates (two roots
 *   of norm 8 at inner product 4 give `8 + 8 - 2*4 = 8`), so each face is equilateral,
 *   `<u,v> = 4`, and `|B|^2 = 64 - 16 = 48`. **This 48 is the Gram determinant of an
 *   equilateral triangle of side sqrt(8) and nothing else** — it is not the 48 roots of
 *   D4+D4 that appear elsewhere in this repository, and reading a connection into the
 *   shared digits is the numerology failure `numerology-vs-number-theory` names. The
 *   derivation above is the reason the number is 48; the coincidence carries no content.
 * - **`B ^ B = 0`.** A bivector is a *simple blade* — it factors as a wedge of two vectors
 *   — exactly when its grade-4 wedge with itself vanishes: the Plücker relations. In 8
 *   dimensions most bivectors are not simple, so this is a real constraint and not a
 *   tautology, and it is checked on all 70 grade-4 components of every face.
 *
 * ## The 3D normal, and the gauge that is stated rather than hidden
 *
 * Rung 3 embeds the 240 roots in 3D by taking two coordinates from eigenlayer 0 and one
 * from layer 1. `faceNormals3d` pushes each face through that embedding and takes the
 * grade-2 blade of the projected triangle, dualised — in three dimensions the dual of a
 * bivector is a vector, which is the only reason "normal vector" is a usable phrase at
 * all. With a face set and a normal per face, a shaded surface is reachable and nobody
 * placed a vertex to get there.
 *
 * **Two gauges, both stated, both measured.** (1) The *sign* of a face's blade depends on
 * the order of its three vertices; the ordering used here is ascending root index, which
 * is a choice, and the plane and the magnitude are invariant under it. (2) `orientOutward`
 * offers the obvious repair — flip each normal to agree with the face centroid — and it
 * does not work for every face: some faces' 3D planes pass through the origin, leaving the
 * sign genuinely undetermined. The count of those is measured and reported rather than
 * rounded away, because a gauge that silently fails on part of its domain is worse than
 * one that admits where it stops.
 *
 * ## Honest limits
 *
 * - The 3D face set is the projected 2-skeleton of an 8-polytope, **not a closed
 *   2-manifold**. It renders as an interpenetrating shell, and no amount of normal
 *   orientation makes it a solid. Saying otherwise would be the hand-placement this
 *   ladder exists to avoid, wearing a different hat.
 * - `f7` is derived from two candidate families whose *sufficiency* is established by the
 *   Euler sum and the ridge audit, not by an independent completeness proof. A third
 *   family that produced more facets would break both checks, which is the point of
 *   having them; it is still weaker than a proof and is labelled as such.
 * - Clique enumeration is exponential in general. It is fast here because the graph is
 *   small and its cliques stop at size 8, which is measured, not assumed.
 * - No shading model, no lighting, no material. A normal is an input to those; this rung
 *   supplies the input.
 *
 * ## Register
 *
 * The construction is **metered**: the falsifiers live in the sibling test file and are
 * mutation-checked. The measured f-vector and the derived counts are there and in the
 * research doc, never asserted in prose here. Anything downstream — that this makes a
 * usable renderer, that the mesh is good for anything in particular — is **unmetered**.
 *
 * ## Anchors (Beacon), cited because they are used
 *
 * - **Thorold Gosset**, *On the Regular and Semi-Regular Figures in Space of n
 *   Dimensions* (Messenger of Mathematics, 1900) — the semiregular polytope this is.
 * - **H. S. M. Coxeter**, *Regular Polytopes* (3rd ed., Dover 1973) and *Regular and
 *   Semi-Regular Polytopes III* (Math. Z. 200, 1988) — the k_21 series, the Coxeter
 *   plane, and the published f-vector this rung checks itself against rather than copies.
 * - **Euler–Poincaré relation** for convex polytopes — Schlaefli (1852), Poincare (1893);
 *   modern statement and proof in Gruenbaum, *Convex Polytopes* (1967) §8.1.
 * - **Julius Pluecker** (1865) / **Hermann Grassmann** (1844) — the quadratic relations
 *   that decide when a bivector is a simple blade.
 * - **Dorst, Fontijne & Mann**, *Geometric Algebra for Computer Science* (Morgan
 *   Kaufmann, 2007) — the outer product as the oriented-subspace primitive, and rotors in
 *   place of matrices. Geometric algebra for graphics is decades old and is cited, not
 *   claimed.
 * - **Bron & Kerbosch**, CACM 16(9), 1973 — the reference clique-enumeration algorithm.
 *   What is implemented below is the simpler ordered-extension enumeration (each clique
 *   emitted once, extending only by higher-indexed vertices), which needs no pivoting on
 *   a graph this size; Bron-Kerbosch is named because it is the thing a reader will
 *   compare it to.
 * - **Pierre-Philippe Dechant**, *The E8 Geometry from a Clifford Perspective* (Adv. Appl.
 *   Clifford Algebras 27, 2017) — the versor construction that generates the roots rung 1
 *   projects and this rung faces.
 */

import { e8Roots, GOSSET_EDGE_INNER_PRODUCT, type Root } from "./clifford-e8-coxeter-projection.ts";
import { embed3d, type Point3 } from "./clifford-e8-eigenlayer-tessellation.ts";

const dot = (a: readonly number[], b: readonly number[]): number => a.reduce((s, x, k) => s + x * (b[k] ?? 0), 0);

/** Dimension of the ambient space the roots live in. */
export const AMBIENT_DIMENSION = 8;

/**
 * Squared magnitude of every 2-face's blade, in the doubled coordinates.
 *
 * Derived, not tabulated: roots have |r|^2 = 8 and adjacent roots have <r,s> = 4, so a
 * face's two edge vectors satisfy |u|^2 = |v|^2 = 8 and <u,v> = 4, and the Lagrange
 * identity gives |u ^ v|^2 = 8*8 - 4*4 = 48.
 */
export const FACE_BIVECTOR_NORM_SQUARED = 48;

// ── the root graph, as bitsets ──────────────────────────────────────────────

/** 32-bit words needed to hold one adjacency row. */
const wordsFor = (n: number): number => (n + 31) >>> 5;

/** Adjacency of the 4_21 vertex graph as a packed bitset — rung 2's integer test, packed. */
export function adjacencyBitset(roots: readonly Root[] = e8Roots()): {
  readonly words: Uint32Array;
  readonly stride: number;
  readonly size: number;
} {
  const size = roots.length;
  const stride = wordsFor(size);
  const words = new Uint32Array(size * stride);
  for (let i = 0; i < size; i++) {
    const ri = roots[i];
    if (ri === undefined) continue;
    for (let j = i + 1; j < size; j++) {
      const rj = roots[j];
      if (rj === undefined) continue;
      if (dot(ri, rj) !== GOSSET_EDGE_INNER_PRODUCT) continue;
      words[i * stride + (j >>> 5)] = (words[i * stride + (j >>> 5)] ?? 0) | (1 << (j & 31));
      words[j * stride + (i >>> 5)] = (words[j * stride + (i >>> 5)] ?? 0) | (1 << (i & 31));
    }
  }
  return { words, stride, size };
}

/**
 * Keep only bits for vertices strictly greater than `v`, so each clique is emitted once.
 *
 * Mutation note, recorded because a survivor that is NOT a gap should say so: changing
 * `bit + 1` to `bit` here survives every falsifier, and that is correct rather than a
 * hole. The mask is always applied to a set already intersected with `v`'s own adjacency
 * row, and no vertex is adjacent to itself, so bit `v` is clear before the mask sees it.
 * The lower-WORD cut on the line below is not equivalent, and dropping it is killed.
 */
const above = (v: number, word: number, mask: number): number => {
  const wv = v >>> 5;
  if (word < wv) return 0;
  if (word > wv) return mask >>> 0;
  const bit = v & 31;
  return bit === 31 ? 0 : (mask & ((0xffffffff << (bit + 1)) >>> 0)) >>> 0;
};

/**
 * Number of cliques of each size, up to `maxSize`.
 *
 * Index k holds the count of k-cliques; index 0 is the empty clique. Because every proper
 * face of 4_21 below the facets is a simplex, `cliqueCounts()[k]` is `f_{k-1}` for
 * k = 1..7 — and `cliqueCounts()[9]` being zero is what says the enumeration is complete
 * rather than truncated.
 */
export function cliqueCounts(maxSize = 10, roots: readonly Root[] = e8Roots()): number[] {
  const { words, stride, size } = adjacencyBitset(roots);
  const counts = new Array<number>(maxSize + 1).fill(0);
  counts[0] = 1;
  if (maxSize >= 1) counts[1] = size;
  const cand = new Uint32Array((maxSize + 2) * stride);

  const expand = (depth: number, held: number): void => {
    const base = depth * stride;
    for (let w = 0; w < stride; w++) {
      let bits = cand[base + w] ?? 0;
      while (bits !== 0) {
        const low = bits & -bits;
        const v = (w << 5) + (31 - Math.clz32(low >>> 0));
        bits = (bits ^ low) >>> 0;
        if (held + 1 <= maxSize) counts[held + 1] = (counts[held + 1] ?? 0) + 1;
        if (held + 1 >= maxSize) continue;
        const next = (depth + 1) * stride;
        let any = 0;
        for (let k = 0; k < stride; k++) {
          const m = above(v, k, ((cand[base + k] ?? 0) & (words[v * stride + k] ?? 0)) >>> 0);
          cand[next + k] = m;
          any |= m;
        }
        if (any !== 0) expand(depth + 1, held + 1);
      }
    }
  };

  for (let v = 0; v < size; v++) {
    let any = 0;
    for (let k = 0; k < stride; k++) {
      const m = above(v, k, words[v * stride + k] ?? 0);
      cand[k] = m;
      any |= m;
    }
    if (any !== 0 && maxSize >= 2) expand(0, 1);
  }
  return counts;
}

/** Every clique of exactly `size` vertices, as ascending index tuples. */
export function cliquesOfSize(size: number, roots: readonly Root[] = e8Roots()): number[][] {
  const { words, stride, size: n } = adjacencyBitset(roots);
  const out: number[][] = [];
  const held: number[] = [];
  const cand = new Uint32Array((size + 2) * stride);

  const expand = (depth: number): void => {
    const base = depth * stride;
    for (let w = 0; w < stride; w++) {
      let bits = cand[base + w] ?? 0;
      while (bits !== 0) {
        const low = bits & -bits;
        const v = (w << 5) + (31 - Math.clz32(low >>> 0));
        bits = (bits ^ low) >>> 0;
        held.push(v);
        if (held.length === size) {
          out.push([...held]);
        } else {
          const next = (depth + 1) * stride;
          let any = 0;
          for (let k = 0; k < stride; k++) {
            const m = above(v, k, ((cand[base + k] ?? 0) & (words[v * stride + k] ?? 0)) >>> 0);
            cand[next + k] = m;
            any |= m;
          }
          if (any !== 0) expand(depth + 1);
        }
        held.pop();
      }
    }
  };

  if (size <= 0) return [];
  for (let v = 0; v < n; v++) {
    held.push(v);
    if (size === 1) {
      out.push([...held]);
    } else {
      let any = 0;
      for (let k = 0; k < stride; k++) {
        const m = above(v, k, words[v * stride + k] ?? 0);
        cand[k] = m;
        any |= m;
      }
      if (any !== 0) expand(0);
    }
    held.pop();
  }
  return out;
}

/** A 2-face: three root indices, ascending. THE deliverable of this rung. */
export type Face = readonly [number, number, number];

/** The 2-faces of 4_21 — triangles of the root graph, derived from rung 2's integer test. */
export function triangleFaces(roots: readonly Root[] = e8Roots()): Face[] {
  return cliquesOfSize(3, roots).map((c) => [c[0] ?? 0, c[1] ?? 0, c[2] ?? 0] as const);
}

// ── the blade ───────────────────────────────────────────────────────────────

/** The 28 grade-2 basis blades e_i ^ e_j of Cl(8,0), in ascending (i, j) order. */
export const BIVECTOR_BASIS: ReadonlyArray<readonly [number, number]> = (() => {
  const out: Array<readonly [number, number]> = [];
  for (let i = 0; i < AMBIENT_DIMENSION; i++) for (let j = i + 1; j < AMBIENT_DIMENSION; j++) out.push([i, j] as const);
  return out;
})();

/** The 70 grade-4 basis blades, used only to check that a bivector is a simple blade. */
const QUADRUPLES: ReadonlyArray<readonly [number, number, number, number]> = (() => {
  const out: Array<readonly [number, number, number, number]> = [];
  for (let a = 0; a < AMBIENT_DIMENSION; a++)
    for (let b = a + 1; b < AMBIENT_DIMENSION; b++)
      for (let c = b + 1; c < AMBIENT_DIMENSION; c++)
        for (let d = c + 1; d < AMBIENT_DIMENSION; d++) out.push([a, b, c, d] as const);
  return out;
})();

const BIVECTOR_INDEX: ReadonlyMap<number, number> = (() => {
  const m = new Map<number, number>();
  BIVECTOR_BASIS.forEach(([i, j], k) => m.set(i * AMBIENT_DIMENSION + j, k));
  return m;
})();

/** Component of a bivector on the blade e_i ^ e_j, for i &lt; j. */
export function bivectorComponent(bivector: readonly number[], i: number, j: number): number {
  return bivector[BIVECTOR_INDEX.get(i * AMBIENT_DIMENSION + j) ?? -1] ?? 0;
}

/**
 * The grade-2 blade (b - a) ^ (c - a) in Cl(8,0), 28 exact-integer components.
 *
 * The same outer product rung 4 uses; in two dimensions it has one component and reads as
 * a signed area, and here it does not collapse, so what it carries is the oriented plane
 * of the face. Integers in, integers out — the roots are integer vectors in the doubled
 * coordinates, so nothing here leaves the exact regime.
 */
export function faceBivector(a: Root, b: Root, c: Root): number[] {
  const u = b.map((x, k) => x - (a[k] ?? 0));
  const v = c.map((x, k) => x - (a[k] ?? 0));
  return BIVECTOR_BASIS.map(([i, j]) => (u[i] ?? 0) * (v[j] ?? 0) - (u[j] ?? 0) * (v[i] ?? 0));
}

/** Squared magnitude of a bivector: the sum of its squared components. Exact on integers. */
export function bivectorNormSquared(bivector: readonly number[]): number {
  return bivector.reduce((s, x) => s + x * x, 0);
}

/**
 * The grade-4 part of B ^ B — the Pluecker relations. All 70 components vanish exactly
 * when B is a simple blade, i.e. when it really is the plane of some parallelogram.
 *
 * In 8 dimensions the generic bivector is NOT simple, so this is a constraint with teeth.
 */
export function bivectorSelfWedge(bivector: readonly number[]): number[] {
  return QUADRUPLES.map(([a, b, c, d]) => {
    const ab = bivectorComponent(bivector, a, b);
    const cd = bivectorComponent(bivector, c, d);
    const ac = bivectorComponent(bivector, a, c);
    const bd = bivectorComponent(bivector, b, d);
    const ad = bivectorComponent(bivector, a, d);
    const bc = bivectorComponent(bivector, b, c);
    return 2 * (ab * cd - ac * bd + ad * bc);
  });
}

/** Is this bivector a simple blade? Exact integer predicate, no tolerance. */
export function isSimpleBlade(bivector: readonly number[]): boolean {
  return bivectorSelfWedge(bivector).every((x) => x === 0);
}

// ── facets, by supporting hyperplane ────────────────────────────────────────

/** A facet: the roots a supporting hyperplane touches, plus the direction that found it. */
export interface Facet {
  /** Root indices on the hyperplane, ascending. */
  readonly vertices: readonly number[];
  /** The direction whose maximum this face attains. Integer vector. */
  readonly normal: readonly number[];
  /** Affine dimension of the face. A facet of an 8-polytope has 7. */
  readonly rank: number;
}

/** Roots attaining `max <r, normal>` — the face that hyperplane supports, by construction. */
export function maxFace(normal: readonly number[], roots: readonly Root[] = e8Roots()): number[] {
  let best = Number.NEGATIVE_INFINITY;
  const values = roots.map((r) => dot(r, normal));
  for (const v of values) if (v > best) best = v;
  const out: number[] = [];
  values.forEach((v, i) => {
    if (v === best) out.push(i);
  });
  return out;
}

/** Affine rank of a set of root indices: the rank of their difference vectors. */
export function affineRank(indices: readonly number[], roots: readonly Root[] = e8Roots()): number {
  const first = indices[0];
  if (first === undefined) return -1;
  const base = roots[first];
  if (base === undefined) return -1;
  const rows = indices.slice(1).map((i) => (roots[i] ?? []).map((x, k) => x - (base[k] ?? 0)));
  let rank = 0;
  for (let col = 0; col < AMBIENT_DIMENSION && rank < rows.length; col++) {
    let pivot = -1;
    for (let r = rank; r < rows.length; r++) {
      if (Math.abs(rows[r]?.[col] ?? 0) > 1e-9) {
        pivot = r;
        break;
      }
    }
    if (pivot < 0) continue;
    const tmp = rows[rank];
    const swap = rows[pivot];
    if (tmp === undefined || swap === undefined) continue;
    rows[rank] = swap;
    rows[pivot] = tmp;
    const pivotRow = rows[rank];
    if (pivotRow === undefined) continue;
    const pv = pivotRow[col] ?? 0;
    for (let r = rank + 1; r < rows.length; r++) {
      const row = rows[r];
      if (row === undefined) continue;
      const f = (row[col] ?? 0) / pv;
      if (f === 0) continue;
      for (let k = 0; k < AMBIENT_DIMENSION; k++) row[k] = (row[k] ?? 0) - f * (pivotRow[k] ?? 0);
    }
    rank++;
  }
  return rank;
}

/**
 * Candidate facet directions from **orthogonal root pairs**: r + s where <r, s> = 0.
 *
 * A 7-orthoplex facet's vertices come in pairs whose midpoint is the facet centroid, so
 * each such pair sums to a multiple of the facet normal. Deduplicated by exact integer
 * coordinates — how far 15,120 pairs collapse is measured in the test, not claimed here.
 */
export function orthogonalPairDirections(roots: readonly Root[] = e8Roots()): number[][] {
  const seen = new Map<string, number[]>();
  for (let i = 0; i < roots.length; i++) {
    const ri = roots[i];
    if (ri === undefined) continue;
    for (let j = i + 1; j < roots.length; j++) {
      const rj = roots[j];
      if (rj === undefined) continue;
      if (dot(ri, rj) !== 0) continue;
      const sum = ri.map((x, k) => x + (rj[k] ?? 0));
      seen.set(sum.join(","), sum);
    }
  }
  return [...seen.values()];
}

/**
 * Candidate facet directions from **8-clique centroids**: the sum of a maximal clique.
 *
 * The symmetry group of a simplex facet permutes its eight vertices, so a facet normal
 * must be invariant under that permutation; the vertex sum is the invariant vector.
 */
export function cliqueCentroidDirections(roots: readonly Root[] = e8Roots()): number[][] {
  const seen = new Map<string, number[]>();
  for (const clique of cliquesOfSize(8, roots)) {
    const sum = new Array<number>(AMBIENT_DIMENSION).fill(0);
    for (const v of clique) {
      const r = roots[v];
      if (r === undefined) continue;
      r.forEach((x, k) => {
        sum[k] = (sum[k] ?? 0) + x;
      });
    }
    seen.set(sum.join(","), sum);
  }
  return [...seen.values()];
}

/**
 * Every supported face the root system's own directions reach, with its affine rank.
 *
 * THREE candidate families, and the third is here to keep the rank filter honest. A
 * single root's direction supports exactly one vertex — rank 0 — so 240 of the
 * candidates below are NOT facets, and `deriveFacets` has something real to reject.
 * Without them the filter would accept every candidate it ever saw, which is a check
 * that cannot fail wearing a dimension test. Measured 2026-09-09: the first draft of
 * this module had exactly that defect, and the mutation run found it by loosening the
 * filter to rank >= 6 and watching every test still pass.
 */
export function deriveFaceCandidates(roots: readonly Root[] = e8Roots()): Facet[] {
  const out: Facet[] = [];
  const seen = new Set<string>();
  const directions = [
    ...roots.map((r) => [...r]),
    ...orthogonalPairDirections(roots),
    ...cliqueCentroidDirections(roots),
  ];
  for (const normal of directions) {
    const vertices = maxFace(normal, roots);
    const key = vertices.join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ vertices, normal, rank: affineRank(vertices, roots) });
  }
  return out;
}

/**
 * The facets, derived: every candidate direction's supported face that has affine rank 7.
 *
 * All three candidate families come out of the root system itself. Their sufficiency is
 * established downstream by the Euler sum and the ridge audit rather than by a
 * completeness proof — see the honest limits in the header.
 */
export function deriveFacets(roots: readonly Root[] = e8Roots()): Facet[] {
  return deriveFaceCandidates(roots).filter((f) => f.rank === AMBIENT_DIMENSION - 1);
}

/** Is every root on the closed side of this facet's hyperplane? The supporting property. */
export function isSupporting(facet: Facet, roots: readonly Root[] = e8Roots()): boolean {
  const onFace = facet.vertices[0];
  if (onFace === undefined) return false;
  const level = dot(roots[onFace] ?? [], facet.normal);
  return roots.every((r) => dot(r, facet.normal) <= level);
}

// ── the f-vector ────────────────────────────────────────────────────────────

/**
 * The full f-vector `[f0 .. f7]` of 4_21, measured.
 *
 * `f0..f6` are clique counts; `f7` is the derived facet count. Two mechanisms, and the
 * alternating sum below is what forces them to agree.
 */
export function fVector(roots: readonly Root[] = e8Roots()): number[] {
  const cliques = cliqueCounts(AMBIENT_DIMENSION, roots);
  const lower = Array.from({ length: AMBIENT_DIMENSION - 1 }, (_, k) => cliques[k + 1] ?? 0);
  return [...lower, deriveFacets(roots).length];
}

/**
 * `sum_k (-1)^k f_k`. The Euler-Poincare relation makes this exactly zero for a convex
 * 8-polytope, because the boundary is a 7-sphere and chi(S^7) = 0.
 */
export function eulerAlternatingSum(f: readonly number[]): number {
  return f.reduce((s, x, k) => s + (k % 2 === 0 ? x : -x), 0);
}

// ── normals for shading ─────────────────────────────────────────────────────

/** A face's 3D normal under rung 3's eigenlayer embedding, plus whether its sign is fixed. */
export interface FaceNormal3 {
  readonly face: Face;
  /** Dual of the projected face's grade-2 blade. Not normalised — magnitude is 2 * area. */
  readonly normal: Point3;
  /**
   * True when the face's 3D plane passes through the origin, so `orientOutward` has no
   * centroid side to agree with and the sign stays at the index-order gauge.
   */
  readonly orientationUndetermined: boolean;
}

const CENTROID_SIDE_TOLERANCE = 1e-9;

/**
 * Per-face 3D normals from the rung-3 embedding.
 *
 * `orientOutward` flips each normal to point away from the origin, which is a repair for
 * the index-order sign gauge, not a claim about a solid: the projected 2-skeleton is not a
 * closed manifold. Faces whose plane contains the origin are flagged rather than guessed.
 */
export function faceNormals3d(
  faces: readonly Face[] = triangleFaces(),
  roots: readonly Root[] = e8Roots(),
  orientOutward = true,
): FaceNormal3[] {
  const points = embed3d(roots);
  return faces.map((face) => {
    const a = points[face[0]] ?? { x: 0, y: 0, z: 0 };
    const b = points[face[1]] ?? { x: 0, y: 0, z: 0 };
    const c = points[face[2]] ?? { x: 0, y: 0, z: 0 };
    const ux = b.x - a.x;
    const uy = b.y - a.y;
    const uz = b.z - a.z;
    const vx = c.x - a.x;
    const vy = c.y - a.y;
    const vz = c.z - a.z;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const cx = (a.x + b.x + c.x) / 3;
    const cy = (a.y + b.y + c.y) / 3;
    const cz = (a.z + b.z + c.z) / 3;
    const side = nx * cx + ny * cy + nz * cz;
    const scale = Math.hypot(nx, ny, nz) * Math.hypot(cx, cy, cz);
    const undetermined = scale === 0 || Math.abs(side) / scale < CENTROID_SIDE_TOLERANCE;
    if (orientOutward && !undetermined && side < 0) {
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }
    return { face, normal: { x: nx, y: ny, z: nz }, orientationUndetermined: undetermined };
  });
}

/**
 * Wavefront OBJ of the shadable surface: 240 derived vertices, one derived normal per
 * face, and the 2-faces as `f v//vn` elements.
 *
 * Text, so it stays diffable in the proof lineage per `no-binary-in-proof-lineage`, and it
 * opens directly in Blender — the handoff surface rung 3 already uses. What it is NOT: a
 * closed solid. It is the projected 2-skeleton of an 8-polytope and it interpenetrates.
 */
export function renderShadedObj(roots: readonly Root[] = e8Roots()): string {
  const faces = triangleFaces(roots);
  const normals = faceNormals3d(faces, roots);
  const points = embed3d(roots);
  const lines: string[] = [
    "# Gosset 4_21, 2-skeleton with derived per-face normals",
    "# Generated from the Clifford/E8 substrate. No coordinate authored by hand.",
    "# Vertices: eigenlayer embedding (rung 3). Faces: triangles of the integer",
    "# adjacency test (rung 2). Normals: grade-2 blade of each face, dualised.",
    "# NOT a closed manifold - the projected 2-skeleton of an 8-polytope.",
    ...points.map((p) => `v ${p.x.toFixed(9)} ${p.y.toFixed(9)} ${p.z.toFixed(9)}`),
    ...normals.map((n) => `vn ${n.normal.x.toFixed(9)} ${n.normal.y.toFixed(9)} ${n.normal.z.toFixed(9)}`),
    ...faces.map((f, i) => `f ${f[0] + 1}//${i + 1} ${f[1] + 1}//${i + 1} ${f[2] + 1}//${i + 1}`),
    "",
  ];
  return lines.join("\n");
}
