/**
 * representation-layer-projection-cost.ts — IS THE 738 A BAD PROJECTION, OR A THEOREM?
 *
 * Aaron 2026-09-09, on the graphics/physics representation layer:
 *
 * > *"the uncertainty preserving is good, but if we are paying for extra dimension and
 * > then projecting down that's going to be slow, i was assuming we are either using the
 * > 8d to do calculations we needed or simulate 3d in 8d without projecting down but
 * > using different dimensions to render different parts of the scene or something."*
 *
 * Rung 7 measured an overdraw ratio of **738** on the projected 2-skeleton of 4_21, a mean
 * triangle bounding box of **29.3%** of the scene diagonal, **27 faces on every edge**, and
 * ~1% of rays meeting two triangles at bit-identical depth. Those are facts. What they do
 * NOT settle is the question that decides the representation layer:
 *
 * > **Is the pathology a property of the projection we CHOSE, or of every projection there
 * > is?**
 *
 * If it is the eigenplane's fault, the repair is a better projection and the 8D substrate
 * survives untouched. If it is every projection's fault, no repair exists at the projection
 * step, and the representation layer is what has to change. That is a measurable question
 * and this module measures it, three ways:
 *
 *   1. `sweepProjections` — overdraw and vertex collisions under N seeded random rank-3
 *      projections, against the eigen-derived one the tree ships.
 *   2. `partitionSweep` — Aaron's second alternative, made falsifiable: give each PART of
 *      the scene its own 3-dimensional subspace and measure whether any part gets cheap.
 *   3. `exactMotorRoundTrip` (sibling module `representation-layer-pga-motor.ts`) — whether
 *      a PGA motor formulation removes the projection step while keeping exactness.
 *
 * ## The prediction this is trying to falsify
 *
 * Stated before running, per `toy-is-free-metered-must-be-earned.md` and the pre-declared
 * bias discipline: **I expect no projection to help**, because the 2-skeleton of 4_21 is a
 * 2-dimensional complex and a 2-complex is in general position — embedded, no self
 * intersection — only in dimension **2k+1 = 5** or higher. In R^3 a generic map of a
 * 2-complex has double curves and triple points, and that is Whitney's general-position
 * count, not a fact about E8. If the sweep instead finds a projection with overdraw near 1,
 * this prediction is refuted and the eigenplane, not the dimension, is the defect.
 *
 * Being explicit about the direction of the bias: a confirming result is convenient for the
 * argument that the engine algebra should be rank-3, which is exactly why the falsifier is
 * a sweep over projections *I did not choose* rather than an argument.
 *
 * ## Registers
 *
 * - `metered` — every number this module returns: pure functions of the derived root set,
 *   integer-seeded, no wall clock, byte-identical on replay (manifesto §7).
 * - `unmetered` — any statement about frame rate or wall-clock speed. This module measures
 *   geometry, not time, and a timing on one machine is a measurement of that machine.
 *
 * ## Prior art (Beacon)
 *
 * - **Hassler Whitney**, *Differentiable manifolds*, Annals of Mathematics 37 (1936) — the
 *   general-position/embedding count: a k-complex embeds generically in R^{2k+1}. For k=2
 *   that is R^5, which is why R^3 cannot be reached by choosing a better map. The strong
 *   embedding theorem (R^{2k}) is about smooth manifolds and does not lower this to 3 either.
 * - **H. S. M. Coxeter**, *Regular Polytopes* (3rd ed., 1973) — 4_21, its f-vector, and the
 *   Coxeter-plane (Petrie) projection the tree's rung 1 uses.
 * - **Pierre-Philippe Dechant**, *The E8 geometry from a Clifford perspective*, Advances in
 *   Applied Clifford Algebras 27 (2017) — the versor generation of the 240 roots that the
 *   whole ladder stands on.
 *
 * The overdraw definition matches rung 7's so the numbers are comparable: total projected
 * triangle area divided by the surface area of the ball that contains the projected points,
 * with the embedding scaled to unit radius.
 */

import { e8Roots, type Root } from "./clifford-e8-coxeter-projection.ts";
import { triangleFaces, type Face } from "./clifford-e8-face-lattice.ts";
import { eigenLayers } from "./clifford-e8-eigenlayer-tessellation.ts";

/** Dimension of the ambient space the roots live in. */
export const AMBIENT_DIMENSION = 8;

/** Dimension we are projecting to. Three, because that is what a scene renderer consumes. */
export const TARGET_DIMENSION = 3;

/**
 * Whitney's general-position dimension for a 2-complex: `2 * 2 + 1`.
 *
 * Named as a constant because it is the number the whole verdict turns on. The 2-skeleton
 * needs FIVE dimensions to be free of self-intersection generically, and a renderer offers
 * three. Nothing in the projection step can close that gap.
 */
export const GENERAL_POSITION_DIMENSION = 5;

/** A rank-3 projection: three 8-vectors, treated as rows of a 3x8 matrix. */
export type Projection = readonly [readonly number[], readonly number[], readonly number[]];

/** A projected point. */
export interface Point3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * A deterministic 64-bit-ish PRNG (SplitMix64 reduced to doubles) so the sweep replays.
 *
 * There is no `Math.random` anywhere in this module: a projection sweep whose projections
 * differ between runs cannot be compared to a previous run, and §7 DST is not optional for
 * a number that is going to be quoted in a research document.
 */
export function splitmix32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x9e3779b9) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
    return ((z ^ (z >>> 15)) >>> 0) / 4294967296;
  };
}

/** A standard-normal sample from two uniforms (Box-Muller), so directions are isotropic. */
function gaussian(rng: () => number): number {
  const u = Math.max(rng(), Number.MIN_VALUE);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function dot(a: readonly number[], b: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] ?? 0) * (b[i] ?? 0);
  return s;
}

function normalise(v: readonly number[]): number[] {
  const n = Math.sqrt(dot(v, v));
  return v.map((x) => x / n);
}

/**
 * A uniformly random rank-3 orthonormal projection of R^8, from a seed.
 *
 * Gaussian rows then Gram-Schmidt: the resulting 3-frame is Haar-distributed on the
 * Stiefel manifold, which is what "a projection I did not choose" has to mean for the
 * sweep to be evidence rather than a second hand-picked plane.
 */
export function randomProjection(seed: number): Projection {
  const rng = splitmix32(seed);
  const rows: number[][] = [];
  for (let r = 0; r < TARGET_DIMENSION; r++) {
    let v = Array.from({ length: AMBIENT_DIMENSION }, () => gaussian(rng));
    for (const prev of rows) {
      const c = dot(v, prev);
      v = v.map((x, i) => x - c * (prev[i] ?? 0));
    }
    rows.push(normalise(v));
  }
  return [rows[0] ?? [], rows[1] ?? [], rows[2] ?? []] as Projection;
}

/**
 * The projection the tree actually ships: layer-0's two Coxeter-plane axes plus layer-1's
 * first axis, exactly as `embed3d` composes them. Re-derived here rather than imported so
 * the sweep compares like with like — same normalisation, same code path.
 */
export function eigenProjection(): Projection {
  const layers = eigenLayers();
  const l0 = layers[0];
  const l1 = layers[1];
  if (l0 === undefined || l1 === undefined) throw new Error("eigenLayers() produced fewer than two layers");
  return [normalise(l0.e1), normalise(l0.e2), normalise(l1.e1)] as Projection;
}

/** Apply a projection to every root. */
export function project(roots: readonly Root[], p: Projection): Point3[] {
  return roots.map((r) => ({ x: dot(r, p[0]), y: dot(r, p[1]), z: dot(r, p[2]) }));
}

/** Scale a point cloud so the farthest point sits on the unit sphere. Rung 7's convention. */
export function toUnitBall(points: readonly Point3[]): Point3[] {
  let max = 0;
  for (const p of points) max = Math.max(max, Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z));
  if (max === 0) return points.map(() => ({ x: 0, y: 0, z: 0 }));
  return points.map((p) => ({ x: p.x / max, y: p.y / max, z: p.z / max }));
}

/** Area of a projected triangle: half the magnitude of the cross product of its edges. */
export function triangleArea(a: Point3, b: Point3, c: Point3): number {
  const ux = b.x - a.x;
  const uy = b.y - a.y;
  const uz = b.z - a.z;
  const vx = c.x - a.x;
  const vy = c.y - a.y;
  const vz = c.z - a.z;
  const cx = uy * vz - uz * vy;
  const cy = uz * vx - ux * vz;
  const cz = ux * vy - uy * vx;
  return 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
}

/** What one projection costs. */
export interface ProjectionCost {
  /** Total projected area of every face, in unit-ball units. */
  readonly totalArea: number;
  /** Surface area of the containing unit ball: 4*pi. The denominator rung 7 used. */
  readonly ballArea: number;
  /** `totalArea / ballArea` — rung 7's overdraw ratio, comparable to its 738. */
  readonly overdraw: number;
  /** Distinct projected vertex positions, out of 240. Below 240 the 0-skeleton has folded. */
  readonly distinctVertices: number;
  /** Faces whose projected area is below `DEGENERATE_AREA` — collapsed to a line or point. */
  readonly degenerateFaces: number;
  /** Mean projected triangle bounding-box diagonal as a fraction of the scene diagonal. */
  readonly meanBoxFraction: number;
}

/** Below this projected area a face has collapsed. Authored threshold, named as such. */
export const DEGENERATE_AREA = 1e-9;

/** Distance below which two projected vertices are treated as one. Authored, named. */
export const VERTEX_MERGE_EPSILON = 1e-9;

/**
 * Measure what a single rank-3 projection costs on the derived 2-skeleton.
 *
 * Pure: same roots and same projection give byte-identical output, every time.
 */
export function projectionCost(p: Projection, roots: readonly Root[] = e8Roots(), faces?: readonly Face[]): ProjectionCost {
  const pts = toUnitBall(project(roots, p));
  const tris = faces ?? triangleFaces(roots);

  let total = 0;
  let degenerate = 0;
  let boxSum = 0;
  for (const [i, j, k] of tris) {
    const a = pts[i];
    const b = pts[j];
    const c = pts[k];
    if (a === undefined || b === undefined || c === undefined) continue;
    const area = triangleArea(a, b, c);
    total += area;
    if (area < DEGENERATE_AREA) degenerate++;
    const dx = Math.max(a.x, b.x, c.x) - Math.min(a.x, b.x, c.x);
    const dy = Math.max(a.y, b.y, c.y) - Math.min(a.y, b.y, c.y);
    const dz = Math.max(a.z, b.z, c.z) - Math.min(a.z, b.z, c.z);
    boxSum += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // Scene diagonal of the unit-ball cloud, measured the same way rung 7's 3.084 was: the
  // diagonal of the axis-aligned bounding box of every projected point.
  let lox = Infinity;
  let loy = Infinity;
  let loz = Infinity;
  let hix = -Infinity;
  let hiy = -Infinity;
  let hiz = -Infinity;
  for (const q of pts) {
    lox = Math.min(lox, q.x);
    loy = Math.min(loy, q.y);
    loz = Math.min(loz, q.z);
    hix = Math.max(hix, q.x);
    hiy = Math.max(hiy, q.y);
    hiz = Math.max(hiz, q.z);
  }
  const sceneDiagonal = Math.sqrt((hix - lox) ** 2 + (hiy - loy) ** 2 + (hiz - loz) ** 2);

  // Distinct vertices: a bucketed sweep is enough at 240 points and stays deterministic.
  const seen: Point3[] = [];
  for (const q of pts) {
    let found = false;
    for (const s of seen) {
      if (Math.abs(s.x - q.x) < VERTEX_MERGE_EPSILON && Math.abs(s.y - q.y) < VERTEX_MERGE_EPSILON && Math.abs(s.z - q.z) < VERTEX_MERGE_EPSILON) {
        found = true;
        break;
      }
    }
    if (!found) seen.push(q);
  }

  const ballArea = 4 * Math.PI;
  return {
    totalArea: total,
    ballArea,
    overdraw: total / ballArea,
    distinctVertices: seen.length,
    degenerateFaces: degenerate,
    meanBoxFraction: tris.length === 0 ? 0 : boxSum / tris.length / sceneDiagonal,
  };
}

/** The result of sweeping many projections. */
export interface ProjectionSweep {
  readonly eigen: ProjectionCost;
  readonly samples: readonly ProjectionCost[];
  readonly minOverdraw: number;
  readonly maxOverdraw: number;
  readonly medianOverdraw: number;
  /**
   * The best overdraw any projection in the sweep achieved, including the eigen one.
   *
   * This is the number that decides the question. A renderer wants this near 1. If the
   * minimum over many independent random projections is still in the hundreds, then no
   * choice of projection is the repair and the dimension is the defect.
   */
  readonly bestOverdrawAnywhere: number;
}

/**
 * Sweep `count` seeded random projections plus the shipped eigen projection.
 *
 * `count` defaults low because the face set is 60,480 triangles and each projection is a
 * full pass; the test raises it. The seeds are `seed0 + i`, so a sweep is reproducible from
 * two integers.
 */
export function sweepProjections(count = 16, seed0 = 1, roots: readonly Root[] = e8Roots()): ProjectionSweep {
  const faces = triangleFaces(roots);
  const eigen = projectionCost(eigenProjection(), roots, faces);
  const samples: ProjectionCost[] = [];
  for (let i = 0; i < count; i++) samples.push(projectionCost(randomProjection(seed0 + i), roots, faces));

  const overdraws = samples.map((s) => s.overdraw).sort((a, b) => a - b);
  const mid = overdraws[Math.floor(overdraws.length / 2)] ?? 0;
  return {
    eigen,
    samples,
    minOverdraw: overdraws[0] ?? 0,
    maxOverdraw: overdraws[overdraws.length - 1] ?? 0,
    medianOverdraw: mid,
    bestOverdrawAnywhere: Math.min(eigen.overdraw, overdraws[0] ?? Infinity),
  };
}

// ── Aaron's second alternative, made falsifiable ─────────────────────────────

/**
 * The result of giving each PART of the scene its own 3-dimensional subspace.
 *
 * Aaron 2026-09-09: *"simulate 3d in 8d without projecting down but using different
 * dimensions to render different parts of the scene or something."*
 *
 * The idea is real and this is the honest test of it. Partition the faces into `parts`
 * groups, give each group its own seeded random projection, and measure each group's
 * overdraw under its OWN projection. If a group's overdraw falls to near 1, the idea works
 * for that group and the remaining problem is compositing. If it stays high, the idea does
 * not rescue the surface even in the best case, because the obstruction is inside each part
 * rather than between parts.
 */
export interface PartitionSweep {
  readonly parts: number;
  /** Faces per part. */
  readonly sizes: readonly number[];
  /** Each part's overdraw under its own best-of-`tries` projection. */
  readonly perPartBestOverdraw: readonly number[];
  /** The same parts measured under one shared projection, for the control. */
  readonly perPartSharedOverdraw: readonly number[];
  /** Sum of the per-part best overdraws — what the whole scene costs if parts never mix. */
  readonly summedBestOverdraw: number;
}

/**
 * Partition the faces by index into `parts` contiguous groups and give each its own
 * projection, picked as the best of `tries` seeded random ones.
 *
 * Index-contiguous grouping is a deliberate choice and a weak one: it is not a spatially
 * coherent partition, so it is a LOWER bound on how well a smart partition could do only
 * in the sense that a smarter partition might do better. What it can establish is the
 * negative — if even shrinking a part to a few hundred faces leaves overdraw far above 1,
 * the obstruction is not the partition.
 */
export function partitionSweep(parts = 8, tries = 4, seed0 = 1000, roots: readonly Root[] = e8Roots()): PartitionSweep {
  const faces = triangleFaces(roots);
  const per = Math.ceil(faces.length / parts);
  const shared = eigenProjection();

  const sizes: number[] = [];
  const best: number[] = [];
  const sharedCost: number[] = [];

  for (let g = 0; g < parts; g++) {
    const slice = faces.slice(g * per, (g + 1) * per);
    sizes.push(slice.length);
    if (slice.length === 0) {
      best.push(0);
      sharedCost.push(0);
      continue;
    }
    sharedCost.push(projectionCost(shared, roots, slice).overdraw);
    let b = Infinity;
    for (let t = 0; t < tries; t++) b = Math.min(b, projectionCost(randomProjection(seed0 + g * 100 + t), roots, slice).overdraw);
    best.push(b);
  }

  return {
    parts,
    sizes,
    perPartBestOverdraw: best,
    perPartSharedOverdraw: sharedCost,
    summedBestOverdraw: best.reduce((s, x) => s + x, 0),
  };
}
