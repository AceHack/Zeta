/**
 * h3-rank3-geometry.ts — PHASE 0: THE GENERATOR READ AT RANK 3, AND THE LIGHT MEASURED.
 *
 * The roadmap
 * (`docs/research/2026-09-09-graphics-physics-engine-roadmap-read-the-generator-at-rank-3.md`)
 * proposes reading Dechant's `H3 -> H4 -> E8` chain at the **bottom** rather than squashing
 * from the top, and names the one thing that decides whether that is possible:
 *
 * > *"the H3 result is measured for the **ring**, not the **light**. `Z[phi]` closure, the
 * > single norm class and the rank-3-no-projection facts are run. **Exact shading over an H3
 * > orbit polytope is `toy` and unrun.** If Phase 0 proceeds, that is the first thing to
 * > falsify — before the byte-lock, not after, because a golden document that locks an
 * > inexact shading model locks the wrong thing."*
 *
 * This module runs it. Everything below is derived from `h3Roots()` and the group those
 * roots generate; the only authored numbers in the file are the two lights in the sibling
 * measurement, and both are named as gauge choices.
 *
 * ## What rung 6 established for E8, and what has to survive the descent
 *
 * Rung 6's exact shading rests on three facts about 4_21, and each has an H3 analogue that
 * is **measured here rather than assumed**:
 *
 * | E8 / 4_21 (rung 6) | H3 (this module) | measured? |
 * |---|---|---|
 * | roots are integers, `\|r\|^2 = 8` | roots are in `Z[phi]`, `\|r\|^2 = 4` | yes — PR #17168 |
 * | face normal `n = a + b + c`, the sum of the face's roots | facet normal `n = sum of the facet's vertices` | **yes, here** |
 * | `n` is exactly orthogonal to the face plane | same, on every facet of every H3 orbit polytope | **yes, here** |
 * | `\|n\|^2 = 48`, one value | `\|n\|^2` is one value **per facet type** | **yes, here** |
 * | irrationality confined to one named `sqrt 6` | confined to one named `sqrt 3` **on triangular facets** | **yes, here** |
 * | 27 facets per edge — no side, no occlusion | **2** facets per edge — a closed convex solid | **yes, here** |
 *
 * The last row is the one that changes what kind of object the renderer has. 4_21's projected
 * 2-skeleton has 27 faces on every edge, so it has no inside and two-sided shading is *forced*.
 * Every H3 orbit polytope is a convex 3-polytope whose boundary is an embedded 2-sphere, so
 * it has an inside, an outward normal, and occlusion — and **no projection is involved
 * anywhere**, so Whitney's general-position theorem has nothing to say about it.
 *
 * ## The vertex-sum normal is a theorem, not a coincidence
 *
 * For an orbit polytope of a finite reflection group, a facet's vertex set is a single orbit
 * of that facet's stabiliser subgroup. The stabiliser fixes the facet's axis and acts on the
 * facet's own plane with no nonzero fixed vector (it contains a rotation of order >= 3), so
 * the sum of the facet's vertices — which the stabiliser fixes — must lie **on the axis**.
 * That is why `n = a + b + c` worked for 4_21's triangles and why the same construction works
 * here for triangles, pentagons, squares, hexagons and decagons alike. The module checks it on
 * every facet of every solid rather than resting on the argument.
 *
 * ## Where the irrational is
 *
 * The Lambert cosine is `<L, n> / (|L| |n|)`. The numerator is in `Z[phi]` for any light in
 * `Z[phi]^3` — exactly as E8's numerator is in `Z` for any integral light — so the whole of
 * the brightness ORDERING is exact ring arithmetic and never touches a float. What decides
 * the field is the denominator, and `h3NormalRadical` measures it: it factors `|n|^2` as
 * `c^2 * d` with `c` in `Z[phi]` and `d` a square-free rational integer, so `|n| = c sqrt d`
 * and `d` is the single irrational the model admits. Measured, `d = 3` on every triangular
 * facet of every solid here — the exact analogue of rung 6's `sqrt 6`.
 *
 * ## Register
 *
 * - `metered` — every count, incidence, norm and level census this module returns. Exact
 *   `bigint` arithmetic in `Z[phi]`; no floating point except in `h3Embed`, which is the one
 *   named readout boundary and is asserted to be the module's only `Math.sqrt` call site.
 * - `unmetered` — that any of these solids is a *useful* or *good-looking* scene. Not claimed.
 * - The Lambert law is used as the **definition** of a shading value, not as a measurement of
 *   reflected light; that correspondence stays `toy`, exactly as rung 6 says.
 *
 * ## Anchors (Beacon), cited because they are used
 *
 * - **Pierre-Philippe Dechant**, *Rank-3 root systems induce root systems of rank 4 via a new
 *   Clifford spinor construction*, J. Phys. Conf. Ser. 597 (2015) 012027, and *The birth of E8
 *   out of the (Clifford) algebra of the icosahedron*, Proc. R. Soc. A 472 (2016) 20150504 —
 *   the chain this module reads at its bottom rung.
 * - **H. S. M. Coxeter**, *Regular Polytopes* (3rd ed., Dover 1973) — H3, the Wythoff
 *   construction, and the f-vectors the derivations below are compared against.
 * - **W. A. Wythoff** (1918) — the kaleidoscopic construction: a seed point in the fundamental
 *   domain, and its orbit under the group, is the polytope. The seeds here are the
 *   fundamental weights, derived from the simple roots by cross product.
 * - **Hassler Whitney**, *Differentiable manifolds*, Ann. of Math. 37 (1936) — general
 *   position, and therefore the theorem that does **not** apply here because there is no
 *   projection.
 * - **Ernst Steinitz** (1922) — the boundary complex of a convex 3-polytope is a
 *   3-connected planar graph, hence an embedded 2-sphere. That is the reason the
 *   self-intersection question has a negative answer by construction; it is measured anyway.
 * - **Johann Heinrich Lambert**, *Photometria* (1760) — the cosine law, used as a definition.
 * - **Leo Dorst, Daniel Fontijne & Stephen Mann**, *Geometric Algebra for Computer Science*
 *   (2007) — the versor sandwich `-a v a / |a|^2` that `h3Reflect` is the vector form of.
 */

import {
  h3Reflect,
  h3Roots,
  zAdd,
  zDot,
  zint,
  zMul,
  zSub,
  type VecZphi,
  type Zphi,
} from "./representation-layer-rank3-exactness.ts";

export type { VecZphi, Zphi };
export { h3Roots, zAdd, zDot, zint, zMul, zSub };

// ── exact ordering in Z[phi] ────────────────────────────────────────────────

/**
 * The sign of `a + b*phi`, decided by integers alone.
 *
 * `a + b*phi = (2a + b)/2 + (b/2) sqrt 5`, so with `p = 2a + b` and `q = b` the question is
 * the sign of `p + q sqrt 5`. Same-sign `p` and `q` settle it outright; mixed signs settle it
 * by comparing `p^2` against `5 q^2`, which is a `bigint` comparison. **No float, no epsilon**
 * — an ordering decided by a tolerance is an ordering that can disagree between oracles.
 */
export function zSign(x: Zphi): number {
  const p = 2n * x[0] + x[1];
  const q = x[1];
  if (p === 0n && q === 0n) return 0;
  if (p >= 0n && q >= 0n) return 1;
  if (p <= 0n && q <= 0n) return -1;
  // Mixed signs. `p^2 = 5 q^2` has no solution in integers except `p = q = 0` — that is
  // exactly the irrationality of `sqrt 5` — and `p = q = 0` was already returned above. So
  // there is NO equality case to handle here, and a `left === right ? 0` branch would be
  // unreachable code wearing the shape of a case. Found by mutation: flipping `>` to `>=`
  // left every test green, because the two differ only on a value that cannot occur.
  const left = p * p;
  const right = 5n * q * q;
  return p > 0n ? (left > right ? 1 : -1) : right > left ? 1 : -1;
}

/** Exact three-way comparison in `Z[phi]`. */
export function zCompare(a: Zphi, b: Zphi): number {
  return zSign(zSub(a, b));
}

/** Whether an element of `Z[phi]` is zero. */
export function zIsZero(x: Zphi): boolean {
  return x[0] === 0n && x[1] === 0n;
}

/** Negation in `Z[phi]`. */
export function zNegate(x: Zphi): Zphi {
  return [-x[0], -x[1]];
}

/** Absolute value in `Z[phi]`, under the real ordering `zSign` decides. */
export function zAbs(x: Zphi): Zphi {
  return zSign(x) < 0 ? zNegate(x) : x;
}

// ── exact vector algebra over Z[phi] ────────────────────────────────────────

/** Componentwise sum. */
export function zVecAdd(a: VecZphi, b: VecZphi): VecZphi {
  return a.map((c, i) => zAdd(c, b[i] ?? zint(0n)));
}

/** Componentwise difference. */
export function zVecSub(a: VecZphi, b: VecZphi): VecZphi {
  return a.map((c, i) => zSub(c, b[i] ?? zint(0n)));
}

/** Scalar multiple. */
export function zVecScale(k: Zphi, a: VecZphi): VecZphi {
  return a.map((c) => zMul(k, c));
}

/** The zero vector of `Z[phi]^3`. */
export function zVecZero(): VecZphi {
  return [zint(0n), zint(0n), zint(0n)];
}

/**
 * The exact cross product in `Z[phi]^3` — the object rank 8 does not have.
 *
 * Rung 6 had to derive its face normal as a *root sum* because there is no cross product in
 * `R^8`. At rank 3 both exist, so the vertex-sum normal can be cross-checked against the
 * plane normal on every facet. Two mechanisms for one answer, which is the point.
 */
export function zCross(a: VecZphi, b: VecZphi): VecZphi {
  const [a0, a1, a2] = [a[0] ?? zint(0n), a[1] ?? zint(0n), a[2] ?? zint(0n)];
  const [b0, b1, b2] = [b[0] ?? zint(0n), b[1] ?? zint(0n), b[2] ?? zint(0n)];
  return [
    zSub(zMul(a1, b2), zMul(a2, b1)),
    zSub(zMul(a2, b0), zMul(a0, b2)),
    zSub(zMul(a0, b1), zMul(a1, b0)),
  ];
}

/** Whether every component is zero. */
export function zVecIsZero(a: VecZphi): boolean {
  return a.every(zIsZero);
}

/**
 * A total order on `Z[phi]^3` that both oracles can reproduce: lexicographic on the raw
 * integer pairs, never on a rendered string.
 *
 * A string sort would depend on the collation the runtime happens to use, which is exactly
 * the divergence `.claude/rules/culture-invariant-by-default.md` records between the oracles.
 */
export function zVecCompare(a: VecZphi, b: VecZphi): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? zint(0n);
    const y = b[i] ?? zint(0n);
    if (x[0] !== y[0]) return x[0] < y[0] ? -1 : 1;
    if (x[1] !== y[1]) return x[1] < y[1] ? -1 : 1;
  }
  return 0;
}

/** Canonical key for set membership, from the raw integers. */
export function zVecKey(a: VecZphi): string {
  return a.map((c) => `${c[0]},${c[1]}`).join("|");
}

// ── exact square roots in Z[phi], and the radical of a norm ─────────────────

/** Integer square root of a non-negative `bigint`; `null` when the argument is not a square. */
export function exactIntegerSqrt(n: bigint): bigint | null {
  if (n < 0n) return null;
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x * x === n ? x : null;
}

/**
 * The square root of `x` in `Z[phi]`, or `null` when it has none.
 *
 * `(p + q phi)^2 = (p^2 + q^2) + (2pq + q^2) phi`, so a root exists only if `p^2 + q^2 = a`,
 * which bounds `|p|` and `|q|` by `isqrt(a)` and makes the search finite and exact. **No
 * float is used to guess a candidate** — a float-seeded search would be a second
 * implementation that the F# oracle would have to reproduce bit for bit, and it does not
 * need to exist.
 *
 * Both `s` and `-s` are roots, so the POSITIVE one is returned — under `zSign`, the real
 * ordering, not under the sign of a coefficient. Without that the answer would depend on the
 * order the search happened to visit candidates, and two oracles could return `2 phi` and
 * `-2 phi` for the same input, both right, with the byte-lock failing anyway.
 */
export function zSqrt(x: Zphi): Zphi | null {
  const [a, b] = x;
  if (a < 0n) return null;
  const bound = bigintSqrtFloor(a);
  for (let q = -bound; q <= bound; q++) {
    const remainder = a - q * q;
    const p = exactIntegerSqrt(remainder);
    if (p === null) continue;
    for (const signed of p === 0n ? [0n] : [p, -p]) {
      if (2n * signed * q + q * q === b) {
        const root: Zphi = [signed, q];
        return zSign(root) < 0 ? zNegate(root) : root;
      }
    }
  }
  return null;
}

/** Floor of the integer square root — the search bound when `a` is not itself a square. */
function bigintSqrtFloor(n: bigint): bigint {
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

/** `|n| = coefficient * sqrt(radicand)`, with `radicand` a square-free rational integer. */
export interface Radical {
  /** The rational integer under the root. `1` means `|n|` is itself in `Z[phi]`. */
  readonly radicand: bigint;
  /** The `Z[phi]` coefficient in front of the root. */
  readonly coefficient: Zphi;
}

/** Square-free rational integers searched when factoring a norm. Small, and stated. */
export const RADICAND_CANDIDATES: readonly bigint[] = [1n, 2n, 3n, 5n, 6n, 7n, 10n, 11n, 13n, 14n, 15n];

/**
 * Factor `normSquared` as `c^2 * d` with `d` square-free, so `|n| = c sqrt d`.
 *
 * This is the mechanical form of rung 6's claim that the shading model closes over
 * `Q(sqrt 6)`: there, `|n|^2 = 48 = 16 * 3`, and the norm product `sqrt 8 * sqrt 48` left
 * `8 sqrt 6`. Here the same question is asked of `Z[phi]` and answered by search rather than
 * by inspection, so a facet whose norm does **not** factor is reported as `null` instead of
 * being quietly rounded into one that does.
 */
export function h3NormalRadical(normSquared: Zphi): Radical | null {
  for (const d of RADICAND_CANDIDATES) {
    const quotient = zDivideByRationalInteger(normSquared, d);
    if (quotient === null) continue;
    const c = zSqrt(quotient);
    if (c !== null) return { radicand: d, coefficient: c };
  }
  return null;
}

/** Exact division of a `Z[phi]` element by a rational integer; `null` when it does not divide. */
export function zDivideByRationalInteger(x: Zphi, d: bigint): Zphi | null {
  if (d === 0n) return null;
  if (x[0] % d !== 0n || x[1] % d !== 0n) return null;
  return [x[0] / d, x[1] / d];
}

// ── the H3 simple system and its fundamental weights, DERIVED ───────────────

/** `<a1, a2>` for the two simple roots joined by the 5-branch: `4 cos 144deg = -2 phi`. */
export const SIMPLE_INNER_PRODUCT_FIVE: Zphi = [0n, -2n];

/** `<a2, a3>` for the two joined by the 3-branch: `4 cos 120deg = -2`. */
export const SIMPLE_INNER_PRODUCT_THREE: Zphi = [-2n, 0n];

/**
 * A simple system for H3, found by its Gram matrix rather than written down.
 *
 * The Coxeter diagram of H3 is `o --5-- o ----- o`, which fixes the three inner products
 * exactly: `<a1,a2> = 4 cos(pi - pi/5) = -2 phi`, `<a2,a3> = 4 cos(pi - pi/3) = -2`, and
 * `<a1,a3> = 0`. Those three exact `Z[phi]` values are the *definition* being searched for,
 * so the diagram is the input and the coordinates are the output — the opposite of authoring
 * a basis and asserting it is simple.
 *
 * The search is deterministic: roots are visited in `h3Roots()` order and the first triple
 * matching the Gram matrix is returned, so both oracles find the same one.
 */
export function h3SimpleRoots(): readonly [VecZphi, VecZphi, VecZphi] {
  const roots = h3Roots();
  for (const a1 of roots)
    for (const a2 of roots) {
      if (zCompare(zDot(a1, a2), SIMPLE_INNER_PRODUCT_FIVE) !== 0) continue;
      for (const a3 of roots) {
        if (zCompare(zDot(a2, a3), SIMPLE_INNER_PRODUCT_THREE) !== 0) continue;
        if (!zIsZero(zDot(a1, a3))) continue;
        return [a1, a2, a3];
      }
    }
  throw new Error("no H3 simple system found — the root set does not have the H3 Gram matrix");
}

/**
 * The three fundamental weight DIRECTIONS, as cross products of the simple roots.
 *
 * `w_i` must be orthogonal to the two simple roots other than `a_i`, which in rank 3 is
 * exactly a cross product — so the weights are *computed*, in `Z[phi]`, with no linear solve
 * and no normalisation. Each `w_i` is the point of the fundamental domain fixed by two of the
 * three mirrors, which is Wythoff's construction stated in coordinates.
 */
export function h3FundamentalWeights(): readonly [VecZphi, VecZphi, VecZphi] {
  const [a1, a2, a3] = h3SimpleRoots();
  return [zCross(a2, a3), zCross(a3, a1), zCross(a1, a2)];
}

/** The four H3 orbit polytopes this module derives. */
export type H3Solid =
  | "icosahedron"
  | "dodecahedron"
  | "icosidodecahedron"
  | "truncatedIcosidodecahedron";

/** In a fixed order, so a census over the family is reproducible. */
export const H3_SOLIDS: readonly H3Solid[] = [
  "icosahedron",
  "dodecahedron",
  "icosidodecahedron",
  "truncatedIcosidodecahedron",
];

/**
 * The Wythoff seed for each solid: a fundamental weight, or their sum for the generic point.
 *
 * Which weight yields which solid is **not** asserted here — it is a consequence of the
 * simple system the search above happens to return, and the sibling test checks the orbit
 * sizes (12 / 20 / 30 / 120) against Coxeter rather than trusting the labelling. A label that
 * disagrees with its orbit size fails.
 */
export function h3Seed(solid: H3Solid): VecZphi {
  const [w1, w2, w3] = h3FundamentalWeights();
  switch (solid) {
    case "dodecahedron":
      return w1;
    case "icosidodecahedron":
      return w2;
    case "icosahedron":
      return w3;
    case "truncatedIcosidodecahedron":
      return zVecAdd(zVecAdd(w1, w2), w3);
  }
}

// ── the orbit ───────────────────────────────────────────────────────────────

/** What closing a seed under the H3 reflections produced. */
export interface H3OrbitResult {
  /** The orbit, in the canonical `zVecCompare` order. */
  readonly points: readonly VecZphi[];
  /**
   * Reflections that would have left `Z[phi]`, counted rather than skipped.
   *
   * A silent `continue` here would truncate the orbit and report a smaller polytope as though
   * it were the whole one — measured while writing this module: an unscaled generic seed
   * closes at 8 points instead of 120 that way, and nothing complains. The count is emitted
   * into the golden document so the truncation cannot hide.
   */
  readonly nonIntegralReflections: number;
  /** Rounds to the fixed point. */
  readonly rounds: number;
}

/** Rounds after which the closure is declared non-terminating. */
export const ORBIT_ROUND_LIMIT = 64;

/**
 * Close a seed under every H3 reflection, exactly.
 *
 * `h3Reflect` returns `null` when `<x, a>` is not divisible by two in the ring, which is the
 * integrality condition that makes the whole construction exact. Those are counted, not
 * ignored.
 */
export function h3Orbit(seed: VecZphi): H3OrbitResult {
  const roots = h3Roots();
  const set = new Map<string, VecZphi>();
  set.set(zVecKey(seed), seed);
  let frontier: VecZphi[] = [seed];
  let rounds = 0;
  let nonIntegralReflections = 0;

  while (frontier.length > 0 && rounds < ORBIT_ROUND_LIMIT) {
    const next: VecZphi[] = [];
    for (const x of frontier)
      for (const a of roots) {
        const reflected = h3Reflect(x, a);
        if (reflected === null) {
          nonIntegralReflections++;
          continue;
        }
        const key = zVecKey(reflected);
        if (!set.has(key)) {
          set.set(key, reflected);
          next.push(reflected);
        }
      }
    frontier = next;
    rounds++;
  }

  const points = [...set.values()].sort(zVecCompare);
  return { points, nonIntegralReflections, rounds };
}

// ── facets ──────────────────────────────────────────────────────────────────

/** One facet of an H3 orbit polytope. */
export interface H3Facet {
  /** Vertex indices into the orbit, ascending. */
  readonly vertices: readonly number[];
  /** The vertex SUM — rung 6's normal construction, at rank 3. */
  readonly normal: VecZphi;
  /** The plane normal from a cross product of two edges — the independent second mechanism. */
  readonly planeNormal: VecZphi;
  /** `<normal, normal>`, exact. */
  readonly normalNormSquared: Zphi;
}

function facetFromVertices(points: readonly VecZphi[], vertices: readonly number[]): H3Facet {
  let normal = zVecZero();
  for (const v of vertices) normal = zVecAdd(normal, points[v] ?? zVecZero());
  const p0 = points[vertices[0] ?? 0] ?? zVecZero();
  const p1 = points[vertices[1] ?? 0] ?? zVecZero();
  const p2 = points[vertices[2] ?? 0] ?? zVecZero();
  const planeNormal = zCross(zVecSub(p1, p0), zVecSub(p2, p0));
  return { vertices, normal, planeNormal, normalNormSquared: zDot(normal, normal) };
}

function sortFacets(facets: readonly H3Facet[]): H3Facet[] {
  return [...facets].sort((a, b) => {
    for (let i = 0; i < Math.max(a.vertices.length, b.vertices.length); i++) {
      const x = a.vertices[i] ?? -1;
      const y = b.vertices[i] ?? -1;
      if (x !== y) return x - y;
    }
    return 0;
  });
}

/**
 * Facets by exhaustive supporting-plane search — the ABSOLUTE reference.
 *
 * For every triple of vertices: take the plane through them, and keep it if every other
 * vertex lies weakly on one side. That is the definition of a supporting hyperplane, run
 * with no acceleration and no heuristic, so it cannot agree with the fast path for a reason
 * they share. `O(n^4)`, which is why it is the reference and not the shipped path.
 */
export function h3FacetsExhaustive(points: readonly VecZphi[]): H3Facet[] {
  const seen = new Map<string, number[]>();
  const n = points.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let k = j + 1; k < n; k++) {
        const pi = points[i] as VecZphi;
        const normal = zCross(zVecSub(points[j] as VecZphi, pi), zVecSub(points[k] as VecZphi, pi));
        if (zVecIsZero(normal)) continue;
        const offset = zDot(normal, pi);
        let side = 0;
        const on: number[] = [];
        let supporting = true;
        for (let t = 0; t < n; t++) {
          const s = zCompare(zDot(normal, points[t] as VecZphi), offset);
          if (s === 0) {
            on.push(t);
            continue;
          }
          if (side === 0) side = s;
          else if (side !== s) {
            supporting = false;
            break;
          }
        }
        if (!supporting) continue;
        const key = on.join(",");
        if (!seen.has(key)) seen.set(key, on);
      }
  return sortFacets([...seen.values()].map((vs) => facetFromVertices(points, vs)));
}

/**
 * Facets by maximising over the derived candidate normal directions — the fast path.
 *
 * Every facet of an orbit polytope of a reflection group has its axis in the orbit of one of
 * the fundamental weights, because the facet's stabiliser is a parabolic subgroup and its
 * fixed line is a weight direction. So the 62 directions `orbit(w1) u orbit(w2) u orbit(w3)`
 * are a complete candidate set, and each one's argmax over the vertices is a facet. `O(62 n)`.
 *
 * **The claim is not trusted.** `h3FacetsExhaustive` is the absolute reference this is
 * obliged to reproduce, and the sibling test compares them facet for facet on every solid.
 * A relative comparison between two accelerated paths would share the acceleration and could
 * agree while both were wrong; this pair shares nothing but the vertex list.
 */
export function h3FacetsByWeightOrbits(points: readonly VecZphi[]): H3Facet[] {
  const directions: VecZphi[] = [];
  const seenDirection = new Set<string>();
  for (const w of h3FundamentalWeights())
    for (const d of h3Orbit(w).points) {
      const key = zVecKey(d);
      if (seenDirection.has(key)) continue;
      seenDirection.add(key);
      directions.push(d);
    }

  const seen = new Map<string, number[]>();
  for (const d of directions) {
    let best: Zphi | null = null;
    for (const p of points) {
      const value = zDot(d, p);
      if (best === null || zCompare(value, best) > 0) best = value;
    }
    if (best === null) continue;
    const on: number[] = [];
    for (let t = 0; t < points.length; t++)
      if (zCompare(zDot(d, points[t] as VecZphi), best) === 0) on.push(t);
    if (on.length < 3) continue;
    const key = on.join(",");
    if (!seen.has(key)) seen.set(key, on);
  }
  return sortFacets([...seen.values()].map((vs) => facetFromVertices(points, vs)));
}

// ── edges, incidence, and the f-vector ──────────────────────────────────────

/** An undirected edge, by ascending vertex index. */
export interface H3Edge {
  readonly a: number;
  readonly b: number;
}

/**
 * Edges derived from the facets: consecutive vertices around each facet's convex cycle.
 *
 * The cycle itself is derived rather than assumed — the facet's vertices are ordered by the
 * angle they subtend about the facet centroid, which at rank 3 is decided by an exact sign
 * test on cross products and needs no trigonometry.
 */
export function h3Edges(points: readonly VecZphi[], facets: readonly H3Facet[]): H3Edge[] {
  const seen = new Set<string>();
  const edges: H3Edge[] = [];
  for (const facet of facets) {
    const cycle = h3FacetCycle(points, facet);
    for (let i = 0; i < cycle.length; i++) {
      const u = cycle[i] as number;
      const v = cycle[(i + 1) % cycle.length] as number;
      const a = Math.min(u, v);
      const b = Math.max(u, v);
      const key = `${a}-${b}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ a, b });
    }
  }
  return edges.sort((x, y) => x.a - y.a || x.b - y.b);
}

/**
 * The facet's vertices in convex cyclic order, exactly.
 *
 * Two vertices `u`, `v` of a convex polygon in a plane with normal `n` satisfy: `v` follows
 * `u` in the cycle iff every other vertex is on the same side of the line `u -> v`. That is
 * `sign(<n, (v - u) x (w - u)>)`, one exact `Z[phi]` sign per candidate, so the cycle is a
 * gift-wrap with no angles and no floats.
 */
export function h3FacetCycle(points: readonly VecZphi[], facet: H3Facet): number[] {
  const vs = facet.vertices;
  if (vs.length <= 3) return [...vs];
  const normal = facet.normal;
  const cycle: number[] = [vs[0] as number];
  const used = new Set<number>(cycle);
  while (cycle.length < vs.length) {
    const u = cycle[cycle.length - 1] as number;
    let chosen = -1;
    for (const v of vs) {
      if (used.has(v)) continue;
      let ok = true;
      for (const w of vs) {
        if (w === u || w === v) continue;
        const cross = zCross(
          zVecSub(points[v] as VecZphi, points[u] as VecZphi),
          zVecSub(points[w] as VecZphi, points[u] as VecZphi),
        );
        if (zSign(zDot(normal, cross)) < 0) {
          ok = false;
          break;
        }
      }
      if (ok) {
        chosen = v;
        break;
      }
    }
    if (chosen < 0) throw new Error("facet cycle did not close — the facet is not convex");
    cycle.push(chosen);
    used.add(chosen);
  }
  return cycle;
}

/** Facets incident to each edge: the number that decides whether the surface has a side. */
export interface EdgeFacetIncidence {
  readonly edges: number;
  readonly min: number;
  readonly max: number;
}

/** 4_21's projected 2-skeleton measured 27. A convex 3-polytope must measure 2. */
export const CONVEX_EDGE_FACET_INCIDENCE = 2;

/** Count facets per edge. */
export function h3EdgeFacetIncidence(
  points: readonly VecZphi[],
  facets: readonly H3Facet[],
  edges: readonly H3Edge[],
): EdgeFacetIncidence {
  const counts = new Map<string, number>();
  for (const e of edges) counts.set(`${e.a}-${e.b}`, 0);
  for (const facet of facets) {
    const cycle = h3FacetCycle(points, facet);
    for (let i = 0; i < cycle.length; i++) {
      const u = cycle[i] as number;
      const v = cycle[(i + 1) % cycle.length] as number;
      const key = `${Math.min(u, v)}-${Math.max(u, v)}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  for (const c of counts.values()) {
    min = Math.min(min, c);
    max = Math.max(max, c);
  }
  return { edges: edges.length, min: counts.size === 0 ? 0 : min, max };
}

// ── the polytope ────────────────────────────────────────────────────────────

/** A derived H3 orbit polytope and everything measured about it. */
export interface H3Polytope {
  readonly solid: H3Solid;
  readonly seed: VecZphi;
  readonly points: readonly VecZphi[];
  readonly facets: readonly H3Facet[];
  readonly edges: readonly H3Edge[];
  readonly incidence: EdgeFacetIncidence;
  /** `[vertices, edges, facets]`. */
  readonly fVector: readonly [number, number, number];
  /** `V - E + F`. Two for every convex 3-polytope. */
  readonly euler: number;
  /** Facet sizes and how many facets carry each, ascending by size. */
  readonly facetSizeCensus: ReadonlyArray<readonly [number, number]>;
  /** Reflections that would have left the ring; zero is the requirement. */
  readonly nonIntegralReflections: number;
}

/** Derive a solid end to end. */
export function h3Polytope(solid: H3Solid): H3Polytope {
  const seed = h3Seed(solid);
  const orbit = h3Orbit(seed);
  const facets = h3FacetsByWeightOrbits(orbit.points);
  const edges = h3Edges(orbit.points, facets);
  const incidence = h3EdgeFacetIncidence(orbit.points, facets, edges);
  const sizes = new Map<number, number>();
  for (const f of facets) sizes.set(f.vertices.length, (sizes.get(f.vertices.length) ?? 0) + 1);
  return {
    solid,
    seed,
    points: orbit.points,
    facets,
    edges,
    incidence,
    fVector: [orbit.points.length, edges.length, facets.length],
    euler: orbit.points.length - edges.length + facets.length,
    facetSizeCensus: [...sizes.entries()].sort((a, b) => a[0] - b[0]),
    nonIntegralReflections: orbit.nonIntegralReflections,
  };
}

/**
 * Fan-triangulate every facet from its first cyclic vertex.
 *
 * A fan is exact and canonical on a convex polygon — it introduces no new vertices, so the
 * triangulated surface is the same point set and the same boundary. Triangles are what a
 * ray tracer and a rasteriser both consume.
 */
export function h3Triangulate(
  points: readonly VecZphi[],
  facets: readonly H3Facet[],
): Array<readonly [number, number, number]> {
  const out: Array<readonly [number, number, number]> = [];
  for (const facet of facets) {
    const cycle = h3FacetCycle(points, facet);
    for (let i = 1; i + 1 < cycle.length; i++)
      out.push([cycle[0] as number, cycle[i] as number, cycle[i + 1] as number]);
  }
  return out;
}

// ── exact shading ───────────────────────────────────────────────────────────

/** An exact ratio in `Q(phi)`: the value is `numerator / denominator`. */
export interface ExactRatioZphi {
  readonly numerator: Zphi;
  readonly denominator: Zphi;
}

/**
 * The Lambert NUMERATOR `<L, n>` — an element of `Z[phi]` for any light in `Z[phi]^3`.
 *
 * This is the whole of the brightness ordering. Comparing, sorting, bucketing and
 * histogramming faces is `zCompare` on these values, and none of it touches a float — the
 * same property rung 6 has over `Z`, one ring up.
 */
export function h3LambertNumerator(light: VecZphi, normal: VecZphi): Zphi {
  return zDot(light, normal);
}

/**
 * The exact `cos^2` of the Lambert angle, as a ratio in `Q(phi)`.
 *
 * `cos^2 = <L,n>^2 / (|L|^2 |n|^2)`, and all three quantities are in `Z[phi]`. So `cos^2` is
 * exactly representable *whatever* the light and *whatever* the facet — the field question
 * below is about `cos` itself, not about `cos^2`.
 */
export function h3CosineSquared(light: VecZphi, normal: VecZphi): ExactRatioZphi {
  const numerator = zDot(light, normal);
  return {
    numerator: zMul(numerator, numerator),
    denominator: zMul(zDot(light, light), zDot(normal, normal)),
  };
}

/** How the shading over one facet type closes. */
export interface ShadingField {
  /** `|n|^2`, exact. */
  readonly normalNormSquared: Zphi;
  /** `|L|^2`, exact. */
  readonly lightNormSquared: Zphi;
  /** `|n| = coefficient sqrt(radicand)`, or `null` when the norm did not factor. */
  readonly normalRadical: Radical | null;
  /** `|L| = coefficient sqrt(radicand)`, or `null`. */
  readonly lightRadical: Radical | null;
  /**
   * The square-free rational integer under the single root the COSINE admits, or `null` when
   * either norm failed to factor. `radicand = 1` would mean the cosine is in `Q(phi)` outright.
   */
  readonly cosineRadicand: bigint | null;
}

/** Measure the field the Lambert cosine closes over for one facet type and one light. */
export function h3ShadingField(light: VecZphi, normal: VecZphi): ShadingField {
  const normalNormSquared = zDot(normal, normal);
  const lightNormSquared = zDot(light, light);
  const normalRadical = h3NormalRadical(normalNormSquared);
  const lightRadical = h3NormalRadical(lightNormSquared);
  let cosineRadicand: bigint | null = null;
  if (normalRadical !== null && lightRadical !== null) {
    cosineRadicand = squareFreePart(normalRadical.radicand * lightRadical.radicand);
  }
  return { normalNormSquared, lightNormSquared, normalRadical, lightRadical, cosineRadicand };
}

/** The square-free part of a positive `bigint`: divide out every square factor. */
export function squareFreePart(n: bigint): bigint {
  let rest = n;
  let out = 1n;
  for (let p = 2n; p * p <= rest; p++) {
    let exponent = 0;
    while (rest % p === 0n) {
      rest /= p;
      exponent++;
    }
    if (exponent % 2 === 1) out *= p;
  }
  return out * rest;
}

/** How a light shades a solid. */
export interface H3ShadingCensus {
  /** Distinct signed `<L, n>` values, ascending — the ONE-SIDED level set. */
  readonly signedLevels: readonly Zphi[];
  /** Distinct `|<L, n>|` values, ascending — the TWO-SIDED level set. */
  readonly absoluteLevels: readonly Zphi[];
  /** Distinct values that are strictly positive: the facets an outward-lit render shows. */
  readonly litLevels: readonly Zphi[];
  /** Signed value and how many facets carry it, ascending. */
  readonly census: ReadonlyArray<readonly [Zphi, number]>;
  /** Facets whose `<L, n>` is exactly zero — the terminator. */
  readonly terminatorFacets: number;
}

/** Census the brightness levels a light produces over a facet list. */
export function h3ShadeFacets(light: VecZphi, facets: readonly H3Facet[]): H3ShadingCensus {
  const counts = new Map<string, { value: Zphi; count: number }>();
  for (const facet of facets) {
    const value = h3LambertNumerator(light, facet.normal);
    const key = `${value[0]},${value[1]}`;
    const entry = counts.get(key);
    if (entry === undefined) counts.set(key, { value, count: 1 });
    else entry.count++;
  }
  const census = [...counts.values()].sort((a, b) => zCompare(a.value, b.value));
  const signedLevels = census.map((c) => c.value);
  const absolute = new Map<string, Zphi>();
  for (const value of signedLevels) {
    const a = zAbs(value);
    absolute.set(`${a[0]},${a[1]}`, a);
  }
  return {
    signedLevels,
    absoluteLevels: [...absolute.values()].sort(zCompare),
    litLevels: signedLevels.filter((v) => zSign(v) > 0),
    census: census.map((c) => [c.value, c.count] as const),
    terminatorFacets: census.find((c) => zIsZero(c.value))?.count ?? 0,
  };
}

/**
 * A light that is an H3 root — the gauge rung 6 uses, restated at rank 3.
 *
 * Which root is a choice of frame and not a choice of content, exactly as in rung 6: the H3
 * Weyl group is transitive on the 30 roots, so the multiset of intensities over a full orbit
 * polytope is the same for every one of them. The sibling test measures that rather than
 * arguing it.
 */
export function h3RootLight(index: number): VecZphi {
  const roots = h3Roots();
  const root = roots[index % roots.length];
  if (root === undefined) throw new Error(`no H3 root at index ${index}`);
  return root;
}

/**
 * A light that is INTEGRAL but not a root, with a rational norm.
 *
 * `(2, 3, 6)` has `|L|^2 = 49`, so `|L| = 7` is rational and the light contributes **no new
 * irrational at all** — the cosine's field is whatever the normal's radical alone makes it.
 * That is the rank-3 form of rung 7's finding that a non-root integral light buys levels at
 * no cost in exactness. Any Pythagorean quadruple would do; this one is a gauge choice and
 * is named as one.
 *
 * **No meaning is read into `|L|^2 = 49` matching rung 7's 49 levels.** They are different
 * quantities that happen to share a digit string, which is the definition of numerology
 * (`.claude/rules/numerology-vs-number-theory.md`).
 */
export const H3_INTEGRAL_LIGHT: VecZphi = [zint(2n), zint(3n), zint(6n)];

// ── the one readout boundary ────────────────────────────────────────────────

/** `phi = (1 + sqrt 5) / 2`, evaluated once. The module's ONLY irrational. */
export const PHI_NUMERIC: number = (1 + Math.sqrt(5)) / 2;

/**
 * Evaluate a `Z[phi]` vector as three floats — the single named boundary of the module.
 *
 * Everything above this line is exact. This function is where the geometry becomes something
 * a rasteriser or a BVH can consume, and it is the only place `sqrt 5` is evaluated. A test
 * asserts the module contains exactly one `Math.sqrt(` call site and that it is this one.
 *
 * Contrast rung 3's `embed3d`, which is irrational at *every* coordinate because it is built
 * from eigenvectors: there the float boundary is the projection itself. Here there is no
 * projection — the geometry is already in `R^3` — so the boundary is a single field
 * evaluation applied to exact coordinates.
 */
export function h3Embed(v: VecZphi): [number, number, number] {
  const at = (i: number): number => {
    const c = v[i] ?? zint(0n);
    return Number(c[0]) + Number(c[1]) * PHI_NUMERIC;
  };
  return [at(0), at(1), at(2)];
}

/** Every vertex of a solid as floats, in orbit order. */
export function h3EmbedAll(points: readonly VecZphi[]): Array<[number, number, number]> {
  return points.map(h3Embed);
}
