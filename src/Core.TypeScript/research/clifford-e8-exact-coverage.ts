/**
 * clifford-e8-exact-coverage.ts — RUNG 4: FILLED REGIONS, ON AN EXACT INTEGER LATTICE.
 *
 * Aaron 2026-09-08, the progression and the constraint that governs all of it:
 * *"we can go fome lines to drawings over time then 3d renderoring based on multi lary
 * tellesaling over time"* and *"our rendering surface should only come from our clifford
 * if we cant generate it from clifford that's not our research."*
 *
 *   1. **lines** — `clifford-e8-coxeter-projection.ts`, the Coxeter-plane projection.
 *   2. **drawings** — the Gosset 4_21 edge set, same module.
 *   3. **3D by multi-layer tessellation** — `clifford-e8-eigenlayer-tessellation.ts`.
 *   4. **filled regions** — here. A drawing has strokes; a render has *area*, and area
 *      is where a renderer starts being a renderer.
 *
 * ## What rung 4 adds, in one sentence
 *
 * A **coverage measure**: which sample points a derived region occupies, computed in
 * exact integer arithmetic, with the irrational confined to a single declared snap.
 *
 * ## The regions are derived, and the derivation is asserted rather than described
 *
 * Rung 1 measured eight rings of exactly thirty roots on the Coxeter plane. Rung 3
 * measured that those rings ARE the eight orbits of the bipartite Coxeter element, and
 * that the element rotates the plane by exactly 2*pi/30. Two consequences, both already
 * measured upstream and both used here:
 *
 * - each ring's thirty points sit at **equal angular spacing** 2*pi/30 on a common
 *   radius, so their convex hull is a regular 30-gon and *sorting by angle* is the whole
 *   of the "hull" step — no hull algorithm, no choice;
 * - each ring is exactly **one Coxeter orbit**, so every vertex of every polygon here
 *   carries a root index back to `e8Roots()`, and the test asserts that index set equals
 *   an orbit. That assertion is Aaron's constraint made mechanical: a hand-placed vertex
 *   has no root index and fails.
 *
 * ## Tension 1 — floats versus the proof lineage. Where the boundary sits.
 *
 * `no-binary-in-proof-lineage` wants verification artifacts exact and diffable;
 * simulation and projection want floats. `src/Core/Tsirelson.fs` is the in-tree
 * precedent: it locks S^2 = 8 in integer arithmetic so *the irrational appears only at
 * readout*. A renderer inverts the direction of travel, so the boundary must be stated
 * the other way round:
 *
 * > **The irrational appears only at INTAKE.** One snap — `Math.round(coordinate *
 * > scale)` — converts the eigen-derived float projection into lattice integers, and
 * > every operation downstream of it is integer-exact with no tolerance anywhere.
 *
 * The snap is the *only* lossy step in the rung, it happens once, it is a pure function
 * of (root set, scale), and it is auditable as a diff. What it costs is stated rather
 * than hidden: rounding perturbs each vertex by at most half a lattice unit, which can
 * destroy convexity when the polygon's sagitta is smaller than that. So the scale is
 * guarded (`MIN_LATTICE_SCALE`) and the guard REFUSES rather than degrades. Measured, the
 * smallest ring first loses convexity at scale 64 — it survives 128, 256 and 384 — and
 * the floor is set at 512 for margin rather than at the observed edge.
 *
 * "Exact integer" is also a bounded claim, and the bound is enforced rather than hoped
 * for. IEEE-754 doubles represent integers exactly up to 2^53; every product formed here
 * is a difference of coordinates times a difference of coordinates, so bounding
 * coordinates by `EXACT_COORD_BOUND = 2^20` bounds every intermediate by roughly 2^44.
 * `assertExactLattice` refuses input outside the bound instead of silently leaving the
 * exact regime — an unenforced precision claim is the vacuity class.
 *
 * ## Tension 2 — DST determinism (manifesto §7), and what it costs
 *
 * Every function here is a pure function of its arguments over integers. There is no
 * seed because there is no randomness to seed: the geometry is derived, the snap is
 * deterministic rounding, and the coverage rule is a total order on edge directions. So
 * replay is byte-identical by construction rather than by discipline.
 *
 * The cost is real and worth naming. Exactness forbids the ordinary graphics shortcuts:
 * no floating-point edge stepping, no incremental error accumulation, no
 * fast-inverse-anything, and no early-out that depends on a tolerance. The row-span
 * solver below pays for exactness with an integer division per edge per row where a
 * float rasterizer would use one add. That is the bill, and rung 4 pays it because a
 * renderer whose output is evidence has to be reproducible before it is fast.
 *
 * ## Tension 3 — scale-free (§1) and noninterference (§13)
 *
 * No ambient clock, no ambient RNG, no filesystem, no environment read: the module's
 * only imports are the two rungs below it, and its only inputs are its arguments. The
 * test greps this source (comments stripped, call-form matched) for the ambient-entropy
 * call forms, because a claim of noninterference that nothing checks is the same vacuity
 * class as an unenforced precision bound. Scale-free: the row-span solver is the same
 * code path for a 30-gon and for a triangle, and `latticePointCount` has no special case
 * for either.
 *
 * ## The Clifford framing, stated at its true strength and no higher
 *
 * The coverage test below is `outerProduct(a, b, c)`, the coefficient of the grade-2
 * blade e1^e2 in (b - a) ^ (c - a) — the bivector whose magnitude is twice the triangle's
 * area and whose SIGN is the orientation. Coverage is the sign of a bivector; area is its
 * magnitude; the shoelace sum is the sum of those blades over a boundary. That is a
 * statement about what these operations *are*, not a re-skin: the same outer product is
 * what `CliffordE8Roots.fs` uses to generate the vertices being covered.
 *
 * **Prior art, honestly split.** Geometric algebra for graphics is decades old and is
 * cited, not claimed: Dorst, Fontijne & Mann, *Geometric Algebra for Computer Science*
 * (Morgan Kaufmann, 2007) — the conformal model, rotors in place of quaternions and
 * matrices. Edge-function rasterization is Pineda, *A Parallel Algorithm for Polygon
 * Rasterization* (SIGGRAPH 1988). The lattice identity is Pick (1899). What a search did
 * NOT turn up is the combination: a coverage measure kept in exact integers over geometry
 * that is admissible *only* because it was generated by the algebra. That is a negative
 * search result, recorded as such in the research doc, not a novelty claim.
 *
 * ## Register
 *
 * The construction is **metered**: four independent falsifiers in the sibling test file,
 * each mutation-checked. The measured numbers are in that file and in the research doc.
 * Anything about what this is good for downstream — a fluid solver's volume weights, a
 * shaded surface — is **unmetered** and lives in the doc, not here.
 *
 * ## Honest limits
 *
 * This is 2D coverage of derived planar regions. It is not a shaded 3D surface: rung 3
 * derives a 3D vertex set and a wireframe but no face set, so there is still no closed
 * mesh to cover. It is not anti-aliased — a lattice point is in or out, which is exactly
 * what makes the count an integer and the law exact; a coverage *fraction* is a different
 * and harder object. And no physical solver is implemented here at all.
 */

import { e8Roots, projectRoots } from "./clifford-e8-coxeter-projection.ts";
import { coxeterOrbits, ringStructure } from "./clifford-e8-eigenlayer-tessellation.ts";

/**
 * Coordinate magnitude beyond which the exactness argument stops holding.
 *
 * Every product formed below is (coordinate difference) * (coordinate difference), so a
 * bound of 2^20 on coordinates bounds differences by 2^21 and products by 2^42, leaving
 * eleven bits of headroom under the 2^53 exact-integer ceiling of IEEE-754 doubles.
 */
export const EXACT_COORD_BOUND = 2 ** 20;

/**
 * Smallest lattice scale at which the snap is guaranteed not to destroy the geometry.
 *
 * Rounding moves each vertex by at most half a unit, so three consecutive vertices can
 * move by at most one unit relative to their chord. The 30-gon's sagitta is
 * R*(1 - cos(pi/30)) ~ 0.005478*R, and the smallest ring has R = 0.4765*scale, so the
 * sagitta at scale s is about 0.00261*s. At s = 512 that is 1.34 units, comfortably above
 * the one-unit worst case; at s = 128 it is 0.33 and convexity is measurably lost.
 */
export const MIN_LATTICE_SCALE = 512;

/** The scale the falsifiers run at. Large enough that the snap is far from the floor. */
export const PROOF_LATTICE_SCALE = 4096;

/** A point on the integer sample lattice. Both fields are integers, always. */
export interface Lattice2 {
  readonly x: number;
  readonly y: number;
}

/** A derived region: a polygon whose every vertex carries the root it came from. */
export interface DerivedPolygon {
  /** 0..7, by increasing Coxeter-plane radius — rung 1's ring index. */
  readonly ringIndex: number;
  /** Index into `e8Roots()` for each vertex, in the same order as `vertices`. */
  readonly rootIndices: readonly number[];
  /** Vertices in counter-clockwise order, on the integer lattice. */
  readonly vertices: readonly Lattice2[];
  /** The scale the snap used. Recorded so a polygon can never be read scale-free. */
  readonly scale: number;
}

/** Refuse anything that would leave the exact-integer regime, rather than degrade. */
export function assertExactLattice(points: readonly Lattice2[]): void {
  for (const p of points) {
    if (!Number.isInteger(p.x) || !Number.isInteger(p.y)) {
      throw new Error(`non-integer lattice coordinate (${p.x}, ${p.y})`);
    }
    if (Math.abs(p.x) > EXACT_COORD_BOUND || Math.abs(p.y) > EXACT_COORD_BOUND) {
      throw new Error(`lattice coordinate outside the exact bound ${EXACT_COORD_BOUND}: (${p.x}, ${p.y})`);
    }
  }
}

/**
 * THE SNAP — the single readout boundary of the whole rung.
 *
 * Everything above it is eigen-derived floating point; everything below it is integer.
 * It is a pure function of the root set and the scale, so it is a diff, not a run.
 */
export function snap(x: number, y: number, scale: number): Lattice2 {
  return { x: Math.round(x * scale), y: Math.round(y * scale) };
}

/**
 * The eight derived regions: each ring of the Coxeter-plane projection, as a lattice
 * polygon in counter-clockwise order, with its root provenance attached.
 *
 * The only ordering step is a sort by angle, which is exact enough to be uncontroversial
 * because rung 3 measured the thirty points of each ring to be at equal angular spacing
 * 2*pi/30 — the gaps agree to nine decimals — so no two of them compete for a position.
 */
export function ringPolygons(scale: number = PROOF_LATTICE_SCALE): DerivedPolygon[] {
  if (!Number.isInteger(scale) || scale < MIN_LATTICE_SCALE) {
    throw new Error(`lattice scale must be an integer >= ${MIN_LATTICE_SCALE}; got ${scale}`);
  }
  const roots = e8Roots();
  const projected = projectRoots(roots);
  const rings = ringStructure(roots)[0];
  if (rings === undefined) throw new Error("ringStructure() produced no layers");
  const out: DerivedPolygon[] = [];
  for (let ringIndex = 0; ringIndex < rings.radii.length; ringIndex++) {
    const members: number[] = [];
    rings.ringOf.forEach((r, i) => {
      if (r === ringIndex) members.push(i);
    });
    const ordered = members
      .map((i) => ({ i, angle: Math.atan2(projected[i]?.y ?? 0, projected[i]?.x ?? 0) }))
      .sort((p, q) => p.angle - q.angle);
    const vertices = ordered.map(({ i }) => snap(projected[i]?.x ?? 0, projected[i]?.y ?? 0, scale));
    assertExactLattice(vertices);
    out.push({ ringIndex, rootIndices: ordered.map(({ i }) => i), vertices, scale });
  }
  return out;
}

/** The Coxeter orbit each ring polygon is, as a sorted root-index list. Provenance. */
export function coxeterOrbitIndexSets(): number[][] {
  return coxeterOrbits(e8Roots()).map((orbit) => [...orbit].sort((a, b) => a - b));
}

/**
 * The grade-2 coefficient of (b - a) ^ (c - a) in Cl(2,0) — twice the signed area of the
 * triangle abc, and the sign that decides which side of ab the point c lies on.
 *
 * This single blade is the entire coverage test and the entire area measure. It is exact
 * on integers within `EXACT_COORD_BOUND`.
 */
export function outerProduct(a: Lattice2, b: Lattice2, c: Lattice2): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/** Twice the signed area of a simple polygon: the shoelace sum of boundary blades. */
export function twiceArea(vertices: readonly Lattice2[]): number {
  let acc = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    if (a === undefined || b === undefined) continue;
    acc += a.x * b.y - b.x * a.y;
  }
  return acc;
}

const gcd = (p: number, q: number): number => {
  let a = Math.abs(p);
  let b = Math.abs(q);
  while (b !== 0) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
};

/**
 * Lattice points ON the boundary, by the classical edge count: an edge from a to b
 * contains gcd(|dx|, |dy|) lattice points counting one endpoint. Independent of the
 * rasterizer, which is the point — Pick then compares two separate computations.
 */
export function boundaryLatticePoints(vertices: readonly Lattice2[]): number {
  let acc = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    if (a === undefined || b === undefined) continue;
    acc += gcd(b.x - a.x, b.y - a.y);
  }
  return acc;
}

/** Counter-clockwise and strictly convex: every consecutive blade is positive. */
export function isConvexCcw(vertices: readonly Lattice2[]): boolean {
  const n = vertices.length;
  if (n < 3) return false;
  for (let i = 0; i < n; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    const c = vertices[(i + 2) % n];
    if (a === undefined || b === undefined || c === undefined) return false;
    if (outerProduct(a, b, c) <= 0) return false;
  }
  return true;
}

/**
 * The exclusive fill rule, as a half-plane on edge DIRECTIONS.
 *
 * A sample point lying exactly on an edge must be claimed by exactly one of the two
 * regions sharing that edge. The two see the edge with opposite direction, so any
 * predicate P with P(d) XOR P(-d) settles it for every nonzero d. This is the
 * conventional top-left rule stated as what it actually is: pick an open half-plane of
 * directions, plus one of the two directions on its boundary line.
 *
 * Get this wrong and the failure is the oldest rasterizer bug there is — cracks along
 * shared edges if the rule is too strict, double coverage if it is too generous. The
 * partition falsifier is exactly a test for both.
 */
export function claimsBoundary(dx: number, dy: number): boolean {
  return dy > 0 || (dy === 0 && dx < 0);
}

/** `coverage` applies the exclusive fill rule; `interior` demands strict insideness. */
export type CoverageRule = "coverage" | "interior";

/** Integer floor division, correct for negative numerators. */
const floorDiv = (n: number, d: number): number => Math.floor(n / d);
/** Integer ceiling division, correct for negative numerators. */
const ceilDiv = (n: number, d: number): number => -Math.floor(-n / d);

/** Inclusive lattice interval of x for one scanline. */
export interface RowSpan {
  readonly lo: number;
  readonly hi: number;
}

/**
 * The exact scanline span of a convex polygon at integer row `y`.
 *
 * For edge a->b with d = b - a, the blade at p expands to A*x + B*y + C with A = -d.y,
 * B = d.x, C = d.y*a.x - d.x*a.y. Each edge is therefore one integer linear inequality in
 * x, resolved by integer floor/ceil division. No float appears, no tolerance appears, and
 * the answer is the same on every machine.
 *
 * This is also where exactness buys its keep over the usual incremental rasterizer: there
 * is no accumulated stepping error to bound, because nothing is accumulated.
 */
export function rowSpan(vertices: readonly Lattice2[], y: number, rule: CoverageRule): RowSpan | null {
  let lo = Number.NEGATIVE_INFINITY;
  let hi = Number.POSITIVE_INFINITY;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    if (a === undefined || b === undefined) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const A = -dy;
    const B = dx;
    const C = dy * a.x - dx * a.y;
    const K = B * y + C;
    if (!Number.isSafeInteger(K)) throw new Error(`row-span intermediate left the exact integer range: ${K}`);
    const inclusive = rule === "coverage" && claimsBoundary(dx, dy);
    if (A === 0) {
      if (inclusive ? K < 0 : K <= 0) return null;
      continue;
    }
    if (A > 0) {
      const bound = inclusive ? ceilDiv(-K, A) : floorDiv(-K, A) + 1;
      if (bound > lo) lo = bound;
    } else {
      const positive = -A;
      const bound = inclusive ? floorDiv(K, positive) : ceilDiv(K, positive) - 1;
      if (bound < hi) hi = bound;
    }
  }
  if (lo > hi || !Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  return { lo, hi };
}

/** Inclusive row range a polygon can possibly occupy. */
export function rowRange(vertices: readonly Lattice2[]): { readonly first: number; readonly last: number } {
  const ys = vertices.map((p) => p.y);
  return { first: Math.min(...ys), last: Math.max(...ys) };
}

/** Number of lattice points the region occupies under `rule`. Exact integer. */
export function latticePointCount(vertices: readonly Lattice2[], rule: CoverageRule): number {
  const { first, last } = rowRange(vertices);
  let total = 0;
  for (let y = first; y <= last; y++) {
    const span = rowSpan(vertices, y, rule);
    if (span !== null) total += span.hi - span.lo + 1;
  }
  return total;
}

/**
 * Pick's residual: 2A - (2I + B - 2), which Pick's theorem (1899) says is exactly zero
 * for any simple lattice polygon.
 *
 * The three quantities come from three unrelated computations — the shoelace blade sum,
 * the rasterizer's own strict-interior classification, and a gcd count over edges — so
 * this is a check against an external theorem rather than a program compared with itself.
 */
export function pickResidual(vertices: readonly Lattice2[]): number {
  const interior = latticePointCount(vertices, "interior");
  return twiceArea(vertices) - (2 * interior + boundaryLatticePoints(vertices) - 2);
}

/**
 * Fan triangulation of a convex polygon from one vertex.
 *
 * **The gauge, stated rather than hidden** — exactly as rung 3 stated its z-axis gauge.
 * Which vertex is the apex is not determined by the algebra. It is not supposed to
 * matter, and "it does not matter" is a falsifier rather than a claim: all thirty
 * apexes are checked to produce the identical partition of the identical point set.
 */
export function fanTriangles(vertices: readonly Lattice2[], apex: number): Lattice2[][] {
  const n = vertices.length;
  const out: Lattice2[][] = [];
  for (let k = 1; k <= n - 2; k++) {
    const a = vertices[apex % n];
    const b = vertices[(apex + k) % n];
    const c = vertices[(apex + k + 1) % n];
    if (a === undefined || b === undefined || c === undefined) continue;
    out.push([a, b, c]);
  }
  return out;
}

/** What the partition falsifier measures. Every field must be zero except `covered`. */
export interface PartitionReport {
  /** Lattice points covered by the triangles, counted with multiplicity. */
  readonly covered: number;
  /** Lattice points covered by the undivided polygon. Must equal `covered`. */
  readonly whole: number;
  /** Rows where two triangle spans overlap — double coverage. */
  readonly overlaps: number;
  /** Rows where the triangle spans leave a hole or miss an end — a crack. */
  readonly cracks: number;
}

/**
 * Does the fan triangulation partition the polygon's covered point set exactly?
 *
 * Overlap and crack are counted separately because they are opposite failures and a
 * total-only check can hide one behind the other.
 */
export function fanPartitionReport(vertices: readonly Lattice2[], apex: number): PartitionReport {
  const triangles = fanTriangles(vertices, apex);
  const { first, last } = rowRange(vertices);
  let covered = 0;
  let whole = 0;
  let overlaps = 0;
  let cracks = 0;
  for (let y = first; y <= last; y++) {
    const outer = rowSpan(vertices, y, "coverage");
    const parts = triangles
      .map((t) => rowSpan(t, y, "coverage"))
      .filter((s): s is RowSpan => s !== null)
      .sort((p, q) => p.lo - q.lo);
    let rowCovered = 0;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const previous = parts[i - 1];
      if (part === undefined) continue;
      rowCovered += part.hi - part.lo + 1;
      if (previous !== undefined && part.lo <= previous.hi) overlaps++;
      if (previous !== undefined && part.lo > previous.hi + 1) cracks++;
    }
    covered += rowCovered;
    if (outer === null) {
      if (rowCovered !== 0) overlaps++;
      continue;
    }
    whole += outer.hi - outer.lo + 1;
    const lowest = parts[0];
    const highest = parts[parts.length - 1];
    if (lowest === undefined || highest === undefined || lowest.lo !== outer.lo || highest.hi !== outer.hi) cracks++;
  }
  return { covered, whole, overlaps, cracks };
}

/**
 * The rasterizer's own output as text: one `y lo hi` triple per occupied row.
 *
 * Run-length rather than a pixel dump, so the coverage of a figure whose bounding box has
 * hundreds of millions of lattice points is still a few thousand diffable lines. Text in
 * the proof lineage, per `no-binary-in-proof-lineage`.
 */
export function renderCoverageSpans(vertices: readonly Lattice2[]): string {
  const { first, last } = rowRange(vertices);
  const lines: string[] = ["# exact coverage spans: y lo hi (inclusive), exclusive fill rule"];
  for (let y = first; y <= last; y++) {
    const span = rowSpan(vertices, y, "coverage");
    if (span !== null) lines.push(`${y} ${span.lo} ${span.hi}`);
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * The viewable artifact: the eight derived rings as filled polygons.
 *
 * Honest about what it is — the SVG's *filling* is done by the viewer, so this picture is
 * the thing to look at, while `renderCoverageSpans` is the thing that was measured. Both
 * read the same derived vertices.
 */
export function renderFilledSvg(scale: number = MIN_LATTICE_SCALE, size = 720): string {
  const polygons = ringPolygons(scale);
  const extent = Math.max(...polygons.flatMap((p) => p.vertices.map((v) => Math.max(Math.abs(v.x), Math.abs(v.y)))));
  const k = (size / 2 - 8) / extent;
  const centre = size / 2;
  const shapes = polygons
    .map((p) => {
      const points = p.vertices
        .map((v) => `${(centre + v.x * k).toFixed(2)},${(centre - v.y * k).toFixed(2)}`)
        .join(" ");
      return `<polygon points="${points}"/>`;
    })
    .join("\n    ");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`,
    `  <title>E8 Coxeter-plane rings as filled regions - every vertex a snapped root</title>`,
    `  <g fill="currentColor" fill-rule="evenodd" fill-opacity="0.5">`,
    `    ${shapes}`,
    `  </g>`,
    `</svg>`,
    "",
  ].join("\n");
}
