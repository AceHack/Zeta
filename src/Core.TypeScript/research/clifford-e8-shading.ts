/**
 * clifford-e8-shading.ts — RUNG 6: SHADING, DERIVED, AND THE FIELD IT CLOSES OVER.
 *
 * Aaron's standing constraint on every rung of this ladder: *"our rendering surface should
 * only come from our clifford — if we cant generate it from clifford that's not our
 * research."* Rung 5 stopped one step short of a picture and said so in its own limits
 * section: *"No shading model, no lighting, no material. A normal is an input to those;
 * this rung supplies the input."* This is that step, and nothing in it is authored.
 *
 *   1. **lines** — `clifford-e8-coxeter-projection.ts`.
 *   2. **drawings** — the Gosset 4_21 edge set, same module.
 *   3. **3D by multi-layer tessellation** — `clifford-e8-eigenlayer-tessellation.ts`.
 *   4. **filled regions, exact integers** — `clifford-e8-exact-coverage.ts`.
 *   5. **faces and normals** — `clifford-e8-face-lattice.ts`.
 *   6. **shading** — here. The first rung whose output a viewer would call an image.
 *
 * ## The three things that had to be derived rather than chosen
 *
 * A shading model is a light direction, a surface normal, and a reflection law. Every
 * hand-written renderer supplies all three by hand. Here:
 *
 * - **The light is a root.** The E8 root system is the only distinguished finite set of
 *   directions this substrate has, and it is already built. `lightFromRootIndex` picks one;
 *   *which* one is a gauge, and the gauge is discharged rather than asserted — the Weyl
 *   group is transitive on roots, so the multiset of intensities over the whole face set is
 *   identical for every one of the 240 choices. That is measured, not argued.
 * - **The normal is the sum of the face's three roots.** Not a cross product, not a
 *   projection, not a flip against a centroid: for a 2-face `{a, b, c}` of 4_21 the vector
 *   `n = a + b + c` is *exactly* orthogonal to the face's plane, by a two-line integer
 *   identity. Roots have `|r|^2 = 8` and adjacent roots have `<r,s> = 4` (rung 2's test),
 *   so `<a + b + c, b - a> = 4 + 8 + 4 - 8 - 4 - 4 = 0`, and the same for `c - a`. Its
 *   squared norm is `3*8 + 6*4 = 48`, so it never vanishes. Both facts hold on all 60,480
 *   faces and are checked there.
 * - **The reflection law is the GA sandwich.** `-a v a / |a|^2` reflects in the hyperplane
 *   orthogonal to `a`; `R v R~ / (R R~)` with `R = ab` rotates. Both are implemented over a
 *   generated Cl(8,0) geometric product and cross-checked against the classical vector
 *   formulas, which is two mechanisms for one answer.
 *
 * ## Where exactness ends — the whole point of the rung
 *
 * Rung 4's discipline is that the irrational is confined to one named boundary. Here it is
 * confined to **one number**, and the shading algebra closes over the field `Q(sqrt 6)`:
 *
 * | quantity | exact form | register |
 * |---|---|---|
 * | Lambert cosine `<L,n> / (|L| |n|)` | integer `/ sqrt(384)`, and `sqrt(384) = 8 sqrt 6` | algebraic, in `Q(sqrt 6)` |
 * | plane illumination `|L ^ B|^2 / (|L|^2 |B|^2)` | integer `/ 384` | **rational** |
 * | specular cosine `<mirror(L), V> / (|L| |V|)` | integer `/ 384` | **rational** |
 *
 * The specular cosine is rational and the Lambert cosine is not, for a reason worth stating
 * because it is the mathematical content of the boundary: the specular term pairs two
 * *roots*, whose norms multiply to `sqrt 8 * sqrt 8 = 8`, a rational; the Lambert term pairs
 * a root with a *face normal*, and `sqrt 8 * sqrt 48 = 8 sqrt 6` is not. So `sqrt 6` is the
 * single irrational this rung admits, it enters through `|n| = 4 sqrt 6` alone, and
 * `cosineToNumber` is the only function that evaluates it. Every operation a renderer
 * performs *before* display — comparing two faces' brightness, sorting, bucketing,
 * histogramming — is exact integer arithmetic on the numerators, and `compareCosines` is
 * that comparison. A test asserts the module contains exactly one `Math.sqrt(` call site
 * and that it is inside `cosineToNumber`.
 *
 * **The intensity never passes through the projection.** This is the structural claim of the
 * rung. Rung 3's embedding into 3D is built from eigenvectors and is irrational at every
 * coordinate; rungs 4 and 5 both had to name it as their float boundary. Shading here is
 * computed in the 8-dimensional integer coordinates and is only then *attached* to the
 * projected triangle. The projection places pixels; it never touches a brightness.
 *
 * ## Consequence, measured: the image is posterised by construction
 *
 * Because `<L,n>` is an integer and both norms are fixed, the Lambert numerator over the
 * whole surface takes exactly **nine** values, `{-16,-12,-8,-4,0,4,8,12,16}`, so a two-sided
 * shading of all 60,480 faces has exactly **five** brightness levels. Nobody chose a
 * quantisation step. `renderLitObj` therefore emits five materials rather than 60,480,
 * which is not a compression trick — it is the exact structure of the shading.
 *
 * The brightest face attains `<L,n> = 16`, i.e. `cos = 16 / (8 sqrt 6) = sqrt(2/3)`, never
 * 1: no face of 4_21 faces a root head-on. That is measured. **No meaning is read into the
 * digits** — `sqrt(2/3)` here is the value of one dot product over one pair of norms and is
 * claimed to be nothing else (`numerology-vs-number-theory`).
 *
 * ## Rung 5's two stated limits, handled rather than inherited
 *
 * **(1) The 768 faces whose 3D plane contains the origin.** Rung 5 measured them and flagged
 * them rather than guessing a sign. The obvious repair — push the 8D outward normal through
 * the embedding and take its sign — **does not work, and the reason is an exact identity
 * rather than bad luck**: `embed3d` is linear, so the projection of `n = a + b + c` is
 * exactly three times the projected face's centroid, which makes the "import the 8D
 * orientation" test *literally the same test* rung 5 already ran. It fails on the same 768.
 * That negative result is measured here rather than worked around.
 *
 * The actual handling is that this rung does not need a 3D orientation at all. The 8D
 * normal is defined and non-degenerate on **all 60,480** faces (0 undetermined, against
 * 768 in 3D), so every face — the 768 included — receives an exact finite intensity, and a
 * test asserts precisely that for that identified subset.
 *
 * **(2) Interpenetration.** Rung 5: the projected 2-skeleton *"is not a closed 2-manifold …
 * no amount of normal orientation makes it a solid."* That was prose; here it is a number.
 * Every one of the 6,720 edges of 4_21 carries **exactly 27** incident 2-faces
 * (`3 * 60480 / 6720 = 27`, and the per-edge minimum and maximum are both 27, measured). A
 * surface whose every edge has 27 sides has no inside, so a one-sided front-face model is
 * not merely awkward — it is undefined. **Two-sided shading is forced by measurement, not
 * chosen for convenience**, and `shadeFaces` uses `|<L,n>|`.
 *
 * ## The depth convention, stated and checkable
 *
 * > **Order-independent, two-sided, no occlusion.** A face's shaded value is a pure function
 * > of `(face, light)` and of nothing else — not of the other faces, not of their order, not
 * > of a depth buffer. Any rasterisation order therefore produces the same per-face value.
 *
 * That is checkable and is checked: shading a permuted face list returns identical values
 * per face. Occlusion is the thing this convention buys out of, and it is named rather than
 * hidden — the interpenetrating shell renders as translucent-with-correct-shading, and a
 * consumer that wants hidden-surface removal must supply its own, because a painter's-
 * algorithm depth sort is *wrong* on interpenetrating geometry and would be a silent lie.
 *
 * ## Register
 *
 * The construction is **metered**: every count in this file is measured in the sibling test
 * and mutation-checked. That this is a *good-looking* image, or useful for anything in
 * particular, is **unmetered** and is not claimed. The correspondence between the Lambert
 * cosine here and physical radiometry is **toy** — Lambert's law is being used as a
 * definition of a shading value, not as a measurement of reflected light.
 *
 * ## Anchors (Beacon), cited because they are used
 *
 * - **Leo Dorst, Daniel Fontijne & Stephen Mann**, *Geometric Algebra for Computer Science*
 *   (Morgan Kaufmann, 2007) — the versor sandwich `-a v a^-1` for reflection and `R v R~`
 *   for rotation, the left contraction / outer-product split of `L B`, and the rejection as
 *   the object that "normal vector" abbreviates. GA for graphics is decades old; it is cited,
 *   not claimed.
 * - **David Hestenes & Garret Sobczyk**, *Clifford Algebra to Geometric Calculus* (Reidel,
 *   1984) — the grade decomposition and the reversion antiautomorphism used by `reverse`.
 * - **Johann Heinrich Lambert**, *Photometria* (1760) — the cosine law the Lambert term is
 *   named for. Used as the definition of a shading value; no radiometric claim is made.
 * - **Bui Tuong Phong**, *Illumination for Computer Generated Pictures* (CACM 18(6), 1975) —
 *   named for the boundary this rung declines to cross: the mirror direction below is derived,
 *   the specular *exponent* is a material parameter an author supplies, so none is shipped.
 * - **H. S. M. Coxeter**, *Regular Polytopes* (3rd ed., Dover 1973) — 4_21 and its f-vector,
 *   the external comparison for the 6,720 and 60,480 this rung divides.
 * - **Thorold Gosset** (1900) — the semiregular polytope being shaded.
 * - **Pierre-Philippe Dechant**, *The E8 Geometry from a Clifford Perspective* (Adv. Appl.
 *   Clifford Algebras 27, 2017) — the versor route from which the roots come.
 * - **Hermann Grassmann** (1844) — the outer product; the `sqrt 6` boundary is a statement
 *   about the norm of a Grassmann-derived normal and nothing deeper.
 *
 * Prior art searched, and the honest result: geometric-algebra shading and GA rotor
 * pipelines are well established (Dorst/Fontijne/Mann ch. 7 and 13, and the ganja.js and
 * clifford-python ecosystems), and E8/4_21 visualisations are common. What is not claimed is
 * novelty of GA shading. What this file does claim, and only this, is that **for this
 * particular polytope the shading numerator is an integer and the model closes over
 * `Q(sqrt 6)`** — a statement about 4_21's arithmetic, checked here, not a general result.
 */

import { e8Roots, type Root } from "./clifford-e8-coxeter-projection.ts";
import { eigenLayers, embed3d } from "./clifford-e8-eigenlayer-tessellation.ts";
import { faceBivector, triangleFaces, type Face } from "./clifford-e8-face-lattice.ts";

// ── exact scalars the whole rung is built on ────────────────────────────────

/** Dimension of the Clifford algebra's generating space. */
export const CLIFFORD_DIMENSION = 8;

/** Number of basis blades of Cl(8,0): one per subset of the 8 generators. */
export const MULTIVECTOR_LENGTH = 1 << CLIFFORD_DIMENSION;

/** `|r|^2` for every E8 root in the doubled integer coordinates. */
export const ROOT_NORM_SQUARED = 8;

/**
 * `|a + b + c|^2` for every 2-face of 4_21.
 *
 * Derived: `3 * 8 + 6 * 4 = 48`, from `|r|^2 = 8` and the adjacency inner product 4.
 */
export const FACE_NORMAL_NORM_SQUARED = 48;

/**
 * `|L|^2 |n|^2 = 8 * 48`. Every cosine in this module is an integer over `sqrt` of this.
 *
 * `sqrt(384) = 8 sqrt 6` — the single irrational the shading model admits.
 */
export const LAMBERT_DENOMINATOR_SQUARED = ROOT_NORM_SQUARED * FACE_NORMAL_NORM_SQUARED;

/** `|B|^2` for every face bivector, from rung 5's Lagrange identity `8*8 - 4*4`. */
export const FACE_BIVECTOR_NORM_SQUARED = 48;

/** Incident 2-faces per 4_21 edge: `3 * f2 / f1 = 3 * 60480 / 6720`. Not 2 — see the header. */
export const EDGE_FACE_INCIDENCE = 27;

/** `-0` is not `0` under exact equality, and exactness here is checked by equality. */
const canon = (x: number): number => (x === 0 ? 0 : x);

const dot = (a: readonly number[], b: readonly number[]): number => a.reduce((s, x, k) => s + x * (b[k] ?? 0), 0);

// ── the generated Clifford algebra ──────────────────────────────────────────
//
// `only-the-irreducible-is-primitive`: nothing here is a multiplication table. The blade
// index IS a subset bitmask, and the product's sign is generated by counting the
// transpositions that sort the concatenated generator list. That single rule generates all
// 65,536 basis products.

/** Population count — the grade of a blade is the size of its generator subset. */
export function bladeGrade(mask: number): number {
  let y = mask - ((mask >>> 1) & 0x55555555);
  y = (y & 0x33333333) + ((y >>> 2) & 0x33333333);
  y = (y + (y >>> 4)) & 0x0f0f0f0f;
  return Math.imul(y, 0x01010101) >>> 24;
}

/**
 * Sign of `e_A e_B` in Cl(n,0): `(-1)^t` where `t` counts the transpositions needed to
 * interleave B's generators into A's. All generators square to `+1`, so the metric
 * contributes no further sign and the shared generators simply cancel.
 */
export function reorderSign(a: number, b: number): number {
  let carry = a >>> 1;
  let swaps = 0;
  while (carry !== 0) {
    swaps += bladeGrade(carry & b);
    carry >>>= 1;
  }
  return (swaps & 1) === 1 ? -1 : 1;
}

/** A multivector of Cl(8,0): 256 coefficients, indexed by generator-subset bitmask. */
export type Multivector = readonly number[];

/** The zero multivector. */
export function zeroMultivector(): number[] {
  return new Array<number>(MULTIVECTOR_LENGTH).fill(0);
}

/**
 * The geometric product, exact on integers.
 *
 * Sparse in the left and right operands, because the elements this rung multiplies are
 * vectors (8 terms) and bivectors (28), never dense.
 */
export function geometricProduct(x: Multivector, y: Multivector): number[] {
  const out = zeroMultivector();
  for (let a = 0; a < MULTIVECTOR_LENGTH; a++) {
    const xa = x[a] ?? 0;
    if (xa === 0) continue;
    for (let b = 0; b < MULTIVECTOR_LENGTH; b++) {
      const yb = y[b] ?? 0;
      if (yb === 0) continue;
      out[a ^ b] = (out[a ^ b] ?? 0) + reorderSign(a, b) * xa * yb;
    }
  }
  return out.map(canon);
}

/** Reversion: `(-1)^(k(k-1)/2)` on grade k. The antiautomorphism the sandwich needs. */
export function reverse(x: Multivector): number[] {
  return x.map((v, i) => {
    const k = bladeGrade(i);
    return canon(((k * (k - 1)) / 2) % 2 === 1 ? -v : v);
  });
}

/** The grade-k part of a multivector; every other coefficient zeroed. */
export function gradePart(x: Multivector, grade: number): number[] {
  return x.map((v, i) => (bladeGrade(i) === grade ? canon(v) : 0));
}

/** The grades actually present in a multivector, ascending. Used by the falsifiers. */
export function gradesPresent(x: Multivector): number[] {
  const seen = new Set<number>();
  x.forEach((v, i) => {
    if (v !== 0) seen.add(bladeGrade(i));
  });
  return [...seen].sort((p, q) => p - q);
}

/** Lift an 8-vector into Cl(8,0). */
export function vectorMultivector(v: readonly number[]): number[] {
  const out = zeroMultivector();
  for (let i = 0; i < CLIFFORD_DIMENSION; i++) out[1 << i] = canon(v[i] ?? 0);
  return out;
}

/** Drop a multivector's grade-1 part back to an 8-vector. */
export function multivectorVector(x: Multivector): number[] {
  const out = new Array<number>(CLIFFORD_DIMENSION).fill(0);
  for (let i = 0; i < CLIFFORD_DIMENSION; i++) out[i] = canon(x[1 << i] ?? 0);
  return out;
}

/** The 28 grade-2 basis blades in rung 5's ascending `(i, j)` order, as bitmasks. */
export const BIVECTOR_MASKS: readonly number[] = (() => {
  const out: number[] = [];
  for (let i = 0; i < CLIFFORD_DIMENSION; i++)
    for (let j = i + 1; j < CLIFFORD_DIMENSION; j++) out.push((1 << i) | (1 << j));
  return out;
})();

/** The 56 grade-3 basis blades, ascending. */
export const TRIVECTOR_INDICES: ReadonlyArray<readonly [number, number, number]> = (() => {
  const out: Array<readonly [number, number, number]> = [];
  for (let i = 0; i < CLIFFORD_DIMENSION; i++)
    for (let j = i + 1; j < CLIFFORD_DIMENSION; j++)
      for (let k = j + 1; k < CLIFFORD_DIMENSION; k++) out.push([i, j, k] as const);
  return out;
})();

/** Lift rung 5's 28-component bivector into Cl(8,0). */
export function bivectorMultivector(bivector: readonly number[]): number[] {
  const out = zeroMultivector();
  BIVECTOR_MASKS.forEach((mask, k) => {
    out[mask] = canon(bivector[k] ?? 0);
  });
  return out;
}

// ── versors: reflection and rotation, exact ─────────────────────────────────

/** An exact rational vector: `components[i] / denominator`. Never evaluated to a float here. */
export interface ExactVector {
  readonly components: readonly number[];
  readonly denominator: number;
}

/**
 * Reflection in the hyperplane orthogonal to `axis`: `-a v a / |a|^2` (Dorst/Fontijne/Mann).
 *
 * Computed through the generated geometric product, so it is the sandwich itself rather
 * than the classical formula wearing its name. The sibling test checks the two agree on
 * every root pair, which is two mechanisms for one answer.
 */
export function reflectInHyperplane(v: readonly number[], axis: readonly number[]): ExactVector {
  const a = vectorMultivector(axis);
  const sandwich = geometricProduct(geometricProduct(a, vectorMultivector(v)), a);
  return { components: multivectorVector(sandwich).map((x) => canon(-x)), denominator: dot(axis, axis) };
}

/**
 * The same reflection, as an exact integer vector, for the case that is exact: a root
 * reflected in a root is a root. Throws rather than rounding if the division is not exact,
 * because a silent rounding here is the whole class of defect this ladder exists to avoid.
 */
export function reflectRootExact(v: readonly number[], axis: readonly number[]): number[] {
  const { components, denominator } = reflectInHyperplane(v, axis);
  return components.map((x) => {
    if (x % denominator !== 0) throw new Error(`reflection is not integral: ${x} / ${denominator}`);
    return canon(x / denominator);
  });
}

/** A versor and the scalar `V V~` its sandwich must be divided by. */
export interface Versor {
  readonly versor: Multivector;
  readonly normSquared: number;
}

/**
 * The rotor `R = a b` from two root directions. `R R~ = |a|^2 |b|^2 = 64` for roots, so the
 * sandwich stays in exact integers divided by a known constant.
 */
export function rotorFromRoots(a: readonly number[], b: readonly number[]): Versor {
  return {
    versor: geometricProduct(vectorMultivector(a), vectorMultivector(b)),
    normSquared: dot(a, a) * dot(b, b),
  };
}

/** `R v R~ / (R R~)` — the rotor sandwich, exact. */
export function applyVersor(rotor: Versor, v: readonly number[]): ExactVector {
  const sandwich = geometricProduct(geometricProduct(rotor.versor, vectorMultivector(v)), reverse(rotor.versor));
  return { components: multivectorVector(sandwich), denominator: rotor.normSquared };
}

/** The rotor sandwich where it is exact: a rotor built from roots maps roots to roots. */
export function applyVersorExact(rotor: Versor, v: readonly number[]): number[] {
  const { components, denominator } = applyVersor(rotor, v);
  return components.map((x) => {
    if (x % denominator !== 0) throw new Error(`rotor image is not integral: ${x} / ${denominator}`);
    return canon(x / denominator);
  });
}

// ── the derived surface normal ──────────────────────────────────────────────

/**
 * The outward normal of a 2-face: the SUM of its three roots.
 *
 * Exactly orthogonal to the face plane (`<a+b+c, b-a> = 0` by the integer identity in the
 * header) and of squared norm 48, so it never degenerates. Outward because 4_21 is centred
 * at the origin and its vertices lie on a sphere, which puts the origin's foot on the face
 * plane exactly at the face centroid — so the centroid direction *is* the normal direction,
 * with no flip test and no tolerance.
 */
export function faceNormal8d(face: Face, roots: readonly Root[] = e8Roots()): number[] {
  const a = roots[face[0]] ?? [];
  const b = roots[face[1]] ?? [];
  const c = roots[face[2]] ?? [];
  return a.map((x, k) => canon(x + (b[k] ?? 0) + (c[k] ?? 0)));
}

/**
 * Is this normal usable for a signed shading term?
 *
 * Total by construction and false only on the zero vector. Measured over 4_21: **true on
 * all 60,480 faces**, which is the theorem `|n|^2 = 48` restated as a runtime check. The
 * false branch is unreachable from the derived face set — deliberately, and the sibling
 * test exercises it on a synthetic input so the predicate is not a check that cannot fail.
 */
export function isOrientationDetermined(normal: readonly number[]): boolean {
  return normal.some((x) => x !== 0);
}

/** The light direction: an E8 root. Which root is a gauge; see the header's transitivity note. */
export function lightFromRootIndex(index: number, roots: readonly Root[] = e8Roots()): number[] {
  const r = roots[index];
  if (r === undefined) throw new Error(`no root at index ${index}`);
  return [...r];
}

// ── exact cosines ───────────────────────────────────────────────────────────

/** An exact algebraic cosine: the value is `numerator / sqrt(denominatorSquared)`. */
export interface ExactCosine {
  readonly numerator: number;
  readonly denominatorSquared: number;
}

/** An exact rational: the value is `numerator / denominator`. */
export interface ExactRational {
  readonly numerator: number;
  readonly denominator: number;
}

/**
 * The Lambert cosine of a face under a root light: `<L, n> / (|L| |n|)`.
 *
 * The numerator is an exact integer and the denominator is the fixed `sqrt(384) = 8 sqrt 6`.
 * Over all of 4_21 the numerator takes nine values, `{-16,...,16}` in steps of 4 — measured.
 */
export function lambertCosine(face: Face, light: readonly number[], roots: readonly Root[] = e8Roots()): ExactCosine {
  return {
    numerator: dot(light, faceNormal8d(face, roots)),
    denominatorSquared: dot(light, light) * FACE_NORMAL_NORM_SQUARED,
  };
}

/**
 * Exact comparison of two cosines with no square root taken.
 *
 * Compares `p / sqrt(P)` against `q / sqrt(Q)` by sign first and then by `p^2 Q` against
 * `q^2 P`, which is integer arithmetic. This is what lets a renderer sort, bucket and
 * threshold the whole surface without ever leaving the exact regime.
 */
export function compareCosines(a: ExactCosine, b: ExactCosine): number {
  const sa = Math.sign(a.numerator);
  const sb = Math.sign(b.numerator);
  if (sa !== sb) return sa < sb ? -1 : 1;
  const left = a.numerator * a.numerator * b.denominatorSquared;
  const right = b.numerator * b.numerator * a.denominatorSquared;
  if (left === right) return 0;
  const magnitude = left < right ? -1 : 1;
  return sa < 0 ? -magnitude : magnitude;
}

/** The exact rational `cos^2`, for callers that want a rational and not an algebraic number. */
export function cosineSquared(c: ExactCosine): ExactRational {
  return { numerator: c.numerator * c.numerator, denominator: c.denominatorSquared };
}

/**
 * **THE IRRATIONAL BOUNDARY.** The only place this module evaluates a square root, and the
 * only place a shading value becomes a float.
 *
 * Everything upstream — the normal, the numerator, the comparison, the bucketing — is exact
 * integer arithmetic. Everything downstream is a pixel. A sibling test asserts by source
 * scan that `Math.sqrt(` appears exactly once in this file and inside this function.
 */
export function cosineToNumber(c: ExactCosine): number {
  return c.numerator / Math.sqrt(c.denominatorSquared);
}

// ── the light's split against a face plane ──────────────────────────────────

/** The `(i, j)` index pair of each grade-2 basis blade, matching `BIVECTOR_MASKS`. */
export const BIVECTOR_PAIRS: ReadonlyArray<readonly [number, number]> = (() => {
  const out: Array<readonly [number, number]> = [];
  for (let i = 0; i < CLIFFORD_DIMENSION; i++)
    for (let j = i + 1; j < CLIFFORD_DIMENSION; j++) out.push([i, j] as const);
  return out;
})();

/**
 * Signed component of a bivector on `e_i ^ e_j` for either ordering, as a flat 8x8 table so
 * the hot path does no searching. Generated from `BIVECTOR_PAIRS`, not tabulated by hand.
 */
const BIVECTOR_SLOT: readonly number[] = (() => {
  const out = new Array<number>(CLIFFORD_DIMENSION * CLIFFORD_DIMENSION).fill(-1);
  BIVECTOR_PAIRS.forEach(([i, j], k) => {
    out[i * CLIFFORD_DIMENSION + j] = k;
    out[j * CLIFFORD_DIMENSION + i] = k;
  });
  return out;
})();

/** `B_{ij}` with `B_{ji} = -B_{ij}`, from the flat table. */
const bivectorAt = (bivector: readonly number[], i: number, j: number): number => {
  const k = BIVECTOR_SLOT[i * CLIFFORD_DIMENSION + j] ?? -1;
  if (k < 0) return 0;
  const raw = bivector[k] ?? 0;
  return i < j ? raw : -raw;
};

/**
 * `<v _| B>` — the grade-1 part of the geometric product `v B`, direct.
 *
 * The specialised routine the hot path uses; the sibling test checks it against the full
 * generated product, which is the second mechanism.
 */
export function contractVectorBivector(v: readonly number[], bivector: readonly number[]): number[] {
  const out = new Array<number>(CLIFFORD_DIMENSION).fill(0);
  BIVECTOR_PAIRS.forEach(([i, j], k) => {
    const coefficient = bivector[k] ?? 0;
    if (coefficient === 0) return;
    // e_i (e_i ^ e_j) = e_j and e_j (e_i ^ e_j) = -e_i, with e_k^2 = +1.
    out[j] = (out[j] ?? 0) + (v[i] ?? 0) * coefficient;
    out[i] = (out[i] ?? 0) - (v[j] ?? 0) * coefficient;
  });
  return out.map(canon);
}

/** `v ^ B` — the grade-3 part of `v B`, as 56 components in `TRIVECTOR_INDICES` order. */
export function wedgeVectorBivector(v: readonly number[], bivector: readonly number[]): number[] {
  return TRIVECTOR_INDICES.map(([i, j, k]) =>
    canon(
      (v[i] ?? 0) * bivectorAt(bivector, j, k) -
        (v[j] ?? 0) * bivectorAt(bivector, i, k) +
        (v[k] ?? 0) * bivectorAt(bivector, i, j),
    ),
  );
}

/**
 * Plane illumination: `|L ^ B|^2 / (|L|^2 |B|^2)` — the fraction of the light that leaves
 * the face's plane. An exact **rational**, unlike the Lambert cosine.
 *
 * It is a genuinely different quantity from the Lambert term and not a rescaling of it: in
 * 8 dimensions a plane's orthogonal complement is 6-dimensional, so a light can be entirely
 * out of a face's plane and still perpendicular to that face's outward normal. 10,080 faces
 * measured in exactly that state. The two are related by the exact integer inequality
 * `<L,n>^2 <= |L ^ B|^2`, which the sibling test checks on every face — a cross-check
 * between two independently derived quantities.
 */
export function planeIllumination(
  face: Face,
  light: readonly number[],
  roots: readonly Root[] = e8Roots(),
): ExactRational {
  const a = roots[face[0]] ?? [];
  const b = roots[face[1]] ?? [];
  const c = roots[face[2]] ?? [];
  const bivector = faceBivector(a, b, c);
  const w = wedgeVectorBivector(light, bivector);
  return { numerator: dot(w, w), denominator: dot(light, light) * FACE_BIVECTOR_NORM_SQUARED };
}

// ── the mirror direction, and the boundary this rung declines to cross ──────

/**
 * Reflection of the light in the face's plane: `-(B L B~) / |B|^2`, keeping the component in
 * the plane and flipping the component out of it.
 *
 * The sign is derived rather than chosen: `B L B~ / |B|^2` evaluates to `L_perp - L_par`
 * (measured against an explicit Gram-Schmidt split in the sibling test), so the mirror a
 * surface performs — tangential kept, normal flipped — is its negation.
 */
export function mirrorInFacePlane(light: readonly number[], bivector: readonly number[]): ExactVector {
  const b = bivectorMultivector(bivector);
  const sandwich = geometricProduct(geometricProduct(b, vectorMultivector(light)), reverse(b));
  return {
    components: multivectorVector(sandwich).map((x) => canon(-x)),
    denominator: dot(bivector, bivector),
  };
}

/**
 * Specular cosine: `<mirror(L), V> / (|L| |V|)` for a view direction `V` that is also a root.
 *
 * **Exactly rational**, denominator `|B|^2 |L| |V| = 48 * 8 = 384`, because reflection
 * preserves norm and both `L` and `V` are roots so `|L| |V| = 8` is rational. This is the
 * cosine itself, at exponent 1.
 *
 * **No exponent is shipped.** A Phong exponent is a material parameter an author supplies,
 * and supplying one here would be exactly the hand-written lighting hack this ladder exists
 * to avoid. This is the named boundary where the substrate stops and a material begins.
 */
export function specularCosine(
  face: Face,
  light: readonly number[],
  view: readonly number[],
  roots: readonly Root[] = e8Roots(),
): ExactRational {
  const a = roots[face[0]] ?? [];
  const b = roots[face[1]] ?? [];
  const c = roots[face[2]] ?? [];
  const mirror = mirrorInFacePlane(light, faceBivector(a, b, c));
  const lightNorm = dot(light, light);
  const viewNorm = dot(view, view);
  if (lightNorm !== viewNorm) throw new Error("specularCosine expects a light and a view of equal norm");
  return { numerator: dot(mirror.components, view), denominator: mirror.denominator * lightNorm };
}

// ── the shaded surface ──────────────────────────────────────────────────────

/** One shaded face. Every field is exact; nothing here has been through the projection. */
export interface ShadedFace {
  readonly face: Face;
  /** `a + b + c`, exact integers, squared norm 48. */
  readonly normal: readonly number[];
  /** `<L, n> / sqrt(384)` — signed, so a caller can still tell the two sides apart. */
  readonly lambert: ExactCosine;
  /** `|<L, n>| / sqrt(384)` — the two-sided value, which the 27-faces-per-edge count forces. */
  readonly twoSided: ExactCosine;
  /** `|L ^ B|^2 / 384`, exact rational. */
  readonly planeIllumination: ExactRational;
  /** False when the signed term is zero: the light grazes this face's normal. */
  readonly lit: boolean;
}

/**
 * Shade the whole face set under one root light.
 *
 * A pure function of `(face, light)` per face, which is the depth convention stated in the
 * header made mechanical: no face's value depends on any other face or on the order they
 * arrive in, so any rasterisation order gives the same image. Checked by permutation.
 */
export function shadeFaces(
  light: readonly number[],
  faces: readonly Face[] = triangleFaces(),
  roots: readonly Root[] = e8Roots(),
): ShadedFace[] {
  return faces.map((face) => {
    const normal = faceNormal8d(face, roots);
    // Delegates to `lambertCosine` rather than recomputing the dot product. An inlined copy
    // here left `lambertCosine` itself unpinned by any assertion — mutating its numerator to
    // a constant 0 SURVIVED the whole suite until this call replaced the duplicate. Two
    // implementations of one quantity, only one of them tested, is where a defect hides.
    const lambert = lambertCosine(face, light, roots);
    const numerator = lambert.numerator;
    const denominatorSquared = lambert.denominatorSquared;
    return {
      face,
      normal,
      lambert,
      twoSided: { numerator: Math.abs(numerator), denominatorSquared },
      planeIllumination: planeIllumination(face, light, roots),
      lit: numerator !== 0,
    };
  });
}

/**
 * The exact histogram of two-sided Lambert numerators over a shaded face set.
 *
 * Keyed by integer, so it is an exact object a test can compare for equality — which is how
 * the light gauge is discharged: the histogram is identical for every choice of light root.
 */
export function intensityHistogram(shaded: readonly ShadedFace[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const s of shaded) out.set(s.twoSided.numerator, (out.get(s.twoSided.numerator) ?? 0) + 1);
  return new Map([...out.entries()].sort((a, b) => a[0] - b[0]));
}

// ── the topology that forces the convention ─────────────────────────────────

/** Per-edge incident-face counts over the derived face set: `min`, `max`, and the edge count. */
export function edgeFaceIncidence(faces: readonly Face[] = triangleFaces()): {
  readonly edges: number;
  readonly min: number;
  readonly max: number;
} {
  const counts = new Map<number, number>();
  // A `Face` is ascending by construction (rung 5 emits `cliquesOfSize(3)` sorted), so all
  // three pairs below are already ordered and the key needs no min/max. That invariant is
  // asserted in the sibling test rather than defended by a branch nothing could ever take —
  // an unreachable normalisation is a check that cannot fail.
  for (const [a, b, c] of faces) {
    for (const [p, q] of [
      [a, b],
      [a, c],
      [b, c],
    ] as const) {
      const k = p * 1024 + q;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  for (const v of counts.values()) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { edges: counts.size, min, max };
}

// ── the artefact ────────────────────────────────────────────────────────────

/**
 * The 3D image plane's own account of why it cannot fix rung 5's 768.
 *
 * `embed3d` is linear, so the projection of `n = a + b + c` is exactly three times the
 * projected centroid — which makes "orient the 3D normal by importing the 8D one" the same
 * test rung 5 already ran. Returns the per-face residual so the identity is measured rather
 * than asserted.
 */
export function projectedNormalIsTripleCentroid(
  faces: readonly Face[] = triangleFaces(),
  roots: readonly Root[] = e8Roots(),
): { readonly checked: number; readonly maxResidual: number } {
  const layers = eigenLayers();
  const points = embed3d(roots, layers);
  const origin = { x: 0, y: 0, z: 0 };
  let maxResidual = 0;
  let checked = 0;
  const normals = faces.map((face) => faceNormal8d(face, roots));
  const projectedNormals = embed3d(normals, layers);
  for (let index = 0; index < faces.length; index++) {
    const face = faces[index] ?? ([0, 0, 0] as const);
    const a = points[face[0]] ?? origin;
    const b = points[face[1]] ?? origin;
    const c = points[face[2]] ?? origin;
    const projected = projectedNormals[index] ?? origin;
    const residual = Math.max(
      Math.abs(projected.x - (a.x + b.x + c.x)),
      Math.abs(projected.y - (a.y + b.y + c.y)),
      Math.abs(projected.z - (a.z + b.z + c.z)),
    );
    if (residual > maxResidual) maxResidual = residual;
    checked++;
  }
  return { checked, maxResidual };
}

/**
 * Wavefront OBJ plus its MTL, lit by a derived root light.
 *
 * **Five materials, because the shading has five levels.** The Lambert numerator is an
 * integer taking `{0, 4, 8, 12, 16}` two-sided, so the surface partitions into exactly five
 * `usemtl` groups over the same 240 vertices — not a quantisation choice, the exact
 * structure of the derived shading. Text, so it stays diffable in the proof lineage per
 * `no-binary-in-proof-lineage`, and it opens in Blender, which is rung 3's handoff surface.
 *
 * What it is NOT: a closed solid. Every edge carries 27 faces (measured), so the header says
 * so and the materials are two-sided.
 */
export function renderLitObj(
  light: readonly number[],
  roots: readonly Root[] = e8Roots(),
): { readonly obj: string; readonly mtl: string } {
  const faces = triangleFaces(roots);
  const shaded = shadeFaces(light, faces, roots);
  const points = embed3d(roots);
  const levels = [...new Set(shaded.map((s) => s.twoSided.numerator))].sort((a, b) => a - b);
  const byLevel = new Map<number, ShadedFace[]>(levels.map((l) => [l, []]));
  for (const s of shaded) byLevel.get(s.twoSided.numerator)?.push(s);

  const mtl = levels
    .flatMap((level) => {
      const value = cosineToNumber({
        numerator: level,
        denominatorSquared: shaded[0]?.lambert.denominatorSquared ?? 1,
      });
      const channel = value.toFixed(6);
      return [
        `newmtl lambert_${level}`,
        `# exact: ${level} / sqrt(${shaded[0]?.lambert.denominatorSquared ?? 0})`,
        `Kd ${channel} ${channel} ${channel}`,
        "Ka 0.000000 0.000000 0.000000",
        "",
      ];
    })
    .join("\n");

  const lines: string[] = [
    "# Gosset 4_21, 2-skeleton, lit by a derived E8-root light.",
    "# Generated from the Clifford/E8 substrate. No coordinate and no brightness authored.",
    "# Vertices: eigenlayer embedding (rung 3). Faces: triangles of rung 2's integer test.",
    "# Normal per face: the SUM of its three roots, exactly orthogonal to the face plane.",
    "# Shading computed in 8D exact integers; the projection places pixels, never brightness.",
    `# Two-sided: every edge carries ${EDGE_FACE_INCIDENCE} faces, so there is no inside.`,
    "# NOT a closed manifold - the projected 2-skeleton of an 8-polytope.",
    "mtllib clifford-e8-lit.mtl",
    ...points.map((p) => `v ${p.x.toFixed(9)} ${p.y.toFixed(9)} ${p.z.toFixed(9)}`),
  ];
  for (const level of levels) {
    lines.push(`usemtl lambert_${level}`);
    for (const s of byLevel.get(level) ?? []) lines.push(`f ${s.face[0] + 1} ${s.face[1] + 1} ${s.face[2] + 1}`);
  }
  lines.push("");
  return { obj: lines.join("\n"), mtl };
}
