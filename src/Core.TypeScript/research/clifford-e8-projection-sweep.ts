/**
 * clifford-e8-projection-sweep.ts — RUNG 8b: IS THE 738 A PROPERTY OF THE OBJECT, OR OF THE MAP?
 *
 * Rung 7 measured that the derived 2-skeleton, embedded in 3D by `embed3d`, has an **overdraw
 * ratio of 738** and a **mean triangle bounding box 29.3% of the scene diagonal** — the two
 * numbers that make a bounding-volume hierarchy nearly useless over it. The obvious question,
 * and the one this module exists to answer, is whether those numbers describe **4_21** or
 * merely describe **`embed3d`**.
 *
 * It is a real question, because `embed3d` is one map among many. It takes `(x, y)` from
 * eigenlayer 0 and `z` from eigenlayer 1's first axis, and rung 3 says outright that *which*
 * axis becomes z is a gauge. The four eigenlayers supply **eight** orthonormal axes of R^8, so
 * there are C(8,3) = **56** eigenlayer-derived 3-frames, and beyond them the whole Stiefel
 * manifold of orthonormal 3-frames in R^8.
 *
 * ## The answer is NO, and it is a clean negative result
 *
 * Over all 56 eigenlayer triples the overdraw ranges **598.2 to 834.3** — a total spread of
 * **1.39x** — and over 60 seeded random orthonormal frames, **598.0 to 732.0**. The shipped
 * `embed3d` sits at 737.6, rank 33 of 56: unremarkable, neither the best nor the worst. The
 * mean-bounding-box fraction is even flatter: **26.0% to 29.3% across every frame measured**.
 *
 * **So the pathology is intrinsic to the object.** The best 3D embedding available buys a
 * factor of 1.23 on overdraw and essentially nothing on primitive size, which is not the
 * two-orders-of-magnitude change a BVH would need. There is no projection to go find.
 *
 * The three frames that tie for the minimum are worth naming, because their "win" is not one:
 * each collapses **6,912 faces to zero area** (a degenerate projection), so they score lower
 * on total area by *losing* a ninth of the surface rather than by spreading it.
 *
 * ## Why the spread is so small — the structural reason, not a coincidence
 *
 * This is concentration of measure, and it is the expected behaviour rather than a surprise.
 * The overdraw is an average over **60,480 faces** of a quantity (projected area) that depends
 * on the frame through a smooth, bounded function on the Stiefel manifold V_3(R^8). Lévy's
 * lemma says such an average concentrates sharply about its mean as the dimension grows, so in
 * 8 dimensions with 60,480 samples, *all* orthonormal 3-frames look nearly alike to it. The
 * shipped map is not badly chosen; there is nothing to choose.
 *
 * ## Two premises this module also checks, and one of them is false
 *
 * A natural reading of the rung 7 numbers is that **both** the interpenetration and the
 * oversized triangles come from flattening 8 dimensions into 3. Measured:
 *
 * - **The oversized, mutually overlapping triangles: yes, projection-induced.** They are what
 *   a linear map onto a 3-space does to a 2-skeleton spread over a 7-sphere.
 * - **The 27 faces on every edge: NO — that is an 8-dimensional combinatorial fact.**
 *   `edgeFaceIncidence` runs on the face list with no coordinates and no projection anywhere in
 *   it, and reports min 27, max 27 over all 6,720 edges. Every edge of 4_21 lies in 27 of its
 *   2-faces *in R^8*. A manifold edge carries 2; the 2-skeleton of an 8-polytope is not a
 *   2-manifold and was never going to be. No embedding can change that number, because no
 *   embedding is involved in producing it.
 *
 * ## What linearity buys and what it costs
 *
 * Rung 5 measured that `embed3d` is **linear**, so `proj(a + b + c) = 3 x proj(centroid)`.
 *
 * - **It buys the subdivision rival its legitimacy.** Midpoint subdivision commutes with a
 *   linear map, so subdividing the projected triangles and projecting subdivided 8D faces give
 *   the same surface. That is why `subdivideTriangles` is a re-indexing of the same geometry
 *   rather than an approximation of it — the only discrepancy is float32 rounding of the
 *   midpoints, measured separately.
 * - **It costs the overlap, unavoidably.** A linear map R^8 -> R^3 has a **5-dimensional
 *   kernel**, and any two points differing by a kernel vector land on the same pixel. The
 *   overlap is not an unlucky choice of map; it is what "linear projection to 3D" means. An
 *   embedding that unfolded the surface would have to be non-linear, and would then no longer
 *   be a projection of the polytope.
 *
 * One thing the projection does **not** do, contrary to what "it folds" might suggest: it does
 * not collapse faces onto each other wholesale. All **60,480 face centroids remain distinct in
 * 3D** (measured). The crowding is overlap of extended triangles, not coincidence of positions.
 *
 * ## Registers
 *
 * - `metered` — every number above; each is produced by a function in this file and pinned by
 *   a falsifier in the sibling test.
 * - `unmetered` — the concentration-of-measure explanation. It is the standard reason an
 *   average over many samples of a smooth function on a high-dimensional homogeneous space
 *   varies little, and it predicts the observed flatness; it is not itself measured here.
 *
 * ## Prior art (Beacon)
 *
 * - **Lévy's lemma / concentration on the sphere**, and **Milman's** development of it — an
 *   average of a Lipschitz function over a high-dimensional sphere or Stiefel manifold
 *   concentrates about its mean. The reason 56 frames and 60 random frames agree to 1.39x.
 * - **Cauchy's surface-area formula** (1841) — the mean projected area of a convex body is a
 *   fixed fraction of its surface area, independent of direction. The same averaging that
 *   makes overdraw frame-insensitive.
 * - **Coxeter**, *Regular Polytopes* — 4_21 and its face lattice; the source of the 2-skeleton
 *   whose edge-face incidence is measured here without reference to any embedding.
 * - **Stich, Friedrich & Dietrich**, HPG 2009 — the sibling module's fix, and the reason the
 *   size of the primitives is the quantity this sweep measures.
 */

import { e8Roots, type Root } from "./clifford-e8-coxeter-projection.ts";
import { eigenLayers } from "./clifford-e8-eigenlayer-tessellation.ts";
import { triangleFaces, type Face } from "./clifford-e8-face-lattice.ts";

/** Orthonormal axes contributed by the four eigenlayers: `e1` and `e2` of each. */
export const AXES_PER_LAYER = 2;

/** Total eigenlayer axes: four layers, two axes each — an orthonormal basis of R^8. */
export const EIGENLAYER_AXIS_COUNT = 8;

/** Frame `embed3d` actually uses: layer 0's two axes and layer 1's first. */
export const SHIPPED_FRAME: readonly [number, number, number] = [0, 1, 2];

/** Area below which a projected triangle counts as collapsed by the map. */
export const DEGENERATE_AREA = 1e-7;

function dot(a: readonly number[], b: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}

/**
 * The eight eigenlayer axes in layer-then-axis order: `L0a L0b L1a L1b L2a L2b L3a L3b`.
 *
 * These are orthonormal *as a set of eight*, not merely within each layer: the layers are
 * eigenspaces of a symmetric matrix for distinct eigenvalues, so they are mutually orthogonal,
 * and `eigenLayers` Gram-Schmidts `e2` against `e1` inside each. The sibling test measures the
 * full 8x8 Gram matrix rather than taking that argument on trust.
 */
export function eigenlayerAxes(): number[][] {
  return eigenLayers().flatMap((layer) => [layer.e1, layer.e2]);
}

/** Human-readable name for axis `i`, e.g. `L1b`. */
export function axisName(index: number): string {
  return `L${Math.floor(index / AXES_PER_LAYER)}${index % AXES_PER_LAYER === 0 ? "a" : "b"}`;
}

/** Every unordered triple of the eight axes: C(8,3) = 56 candidate 3-frames. */
export function eigenlayerFrames(): Array<readonly [number, number, number]> {
  const out: Array<readonly [number, number, number]> = [];
  for (let i = 0; i < EIGENLAYER_AXIS_COUNT; i++)
    for (let j = i + 1; j < EIGENLAYER_AXIS_COUNT; j++)
      for (let k = j + 1; k < EIGENLAYER_AXIS_COUNT; k++) out.push([i, j, k]);
  return out;
}

/**
 * A seeded random orthonormal 3-frame in R^8, by Gram-Schmidt on Gaussian vectors.
 *
 * §13 noninterference for an experiment: the frames that judge the shipped embedding must be
 * reproducible, so the generator is a seed rather than `Math.random`. Box-Muller over xorshift32.
 */
export function randomOrthonormalFrame(seed: number): number[][] {
  let state = seed >>> 0 || 1;
  const next = (): number => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
  const gauss = (): number => Math.sqrt(-2 * Math.log(next() + 1e-12)) * Math.cos(2 * Math.PI * next());
  const frame: number[][] = [];
  for (let f = 0; f < 3; f++) {
    let v = Array.from({ length: EIGENLAYER_AXIS_COUNT }, () => gauss());
    for (const u of frame) {
      const d = dot(v, u);
      v = v.map((x, i) => x - d * u[i]!);
    }
    const n = Math.sqrt(dot(v, v));
    frame.push(v.map((x) => x / n));
  }
  return frame;
}

/**
 * Project the roots through an orthonormal 3-frame and emit unindexed triangle positions,
 * scaled so the farthest point sits on the unit sphere.
 *
 * The normalisation is what makes overdraw comparable between frames: a frame that shrinks the
 * object would otherwise score a lower total area for no structural reason, and one that
 * stretches it would score higher. Fixing the containing ball fixes the denominator.
 */
export function projectFaces(
  frame: readonly (readonly number[])[],
  roots: readonly Root[] = e8Roots(),
  faces: readonly Face[] = triangleFaces(roots),
): Float32Array {
  const points = roots.map((r) => frame.map((axis) => dot(r, axis)));
  let radius = 0;
  for (const p of points) {
    const d = Math.hypot(p[0]!, p[1]!, p[2]!);
    if (d > radius) radius = d;
  }
  const out = new Float32Array(faces.length * 9);
  for (const [f, face] of faces.entries()) {
    for (let v = 0; v < 3; v++) {
      const p = points[face[v]!]!;
      out[f * 9 + v * 3] = p[0]! / radius;
      out[f * 9 + v * 3 + 1] = p[1]! / radius;
      out[f * 9 + v * 3 + 2] = p[2]! / radius;
    }
  }
  return out;
}

/** What a projection costs a spatial index, measured from its triangle positions alone. */
export interface ProjectionMeasurement {
  /** Summed area of every projected triangle. */
  readonly totalArea: number;
  /** `totalArea` over the unit ball's surface area — how many layers a chord crosses. */
  readonly overdraw: number;
  /** Mean triangle bounding-box diagonal as a fraction of the whole scene's diagonal. */
  readonly meanBboxFraction: number;
  /** Triangles the map collapsed to (near) zero area. */
  readonly degenerateFaces: number;
  readonly sceneDiagonal: number;
}

/** Measure a projected scene. Reads positions only, so every frame is judged identically. */
export function measureProjection(positions: Float32Array): ProjectionMeasurement {
  const n = Math.floor(positions.length / 9);
  let totalArea = 0;
  let bboxSum = 0;
  let degenerateFaces = 0;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let t = 0; t < n; t++) {
    const b = t * 9;
    const ax = positions[b]!, ay = positions[b + 1]!, az = positions[b + 2]!;
    const bx = positions[b + 3]!, by = positions[b + 4]!, bz = positions[b + 5]!;
    const cx = positions[b + 6]!, cy = positions[b + 7]!, cz = positions[b + 8]!;
    const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    const area = 0.5 * Math.hypot(nx, ny, nz);
    totalArea += area;
    if (area < DEGENERATE_AREA) degenerateFaces++;
    const lox = Math.min(ax, bx, cx), loy = Math.min(ay, by, cy), loz = Math.min(az, bz, cz);
    const hix = Math.max(ax, bx, cx), hiy = Math.max(ay, by, cy), hiz = Math.max(az, bz, cz);
    bboxSum += Math.hypot(hix - lox, hiy - loy, hiz - loz);
    if (lox < minX) minX = lox;
    if (loy < minY) minY = loy;
    if (loz < minZ) minZ = loz;
    if (hix > maxX) maxX = hix;
    if (hiy > maxY) maxY = hiy;
    if (hiz > maxZ) maxZ = hiz;
  }
  const sceneDiagonal = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ);
  return {
    totalArea,
    // The scene is normalised into the unit ball, so the denominator is that ball's area.
    overdraw: totalArea / (4 * Math.PI),
    meanBboxFraction: n === 0 ? 0 : bboxSum / n / sceneDiagonal,
    degenerateFaces,
    sceneDiagonal,
  };
}

/** One row of the sweep. */
export interface FrameRow {
  readonly frame: readonly [number, number, number];
  readonly name: string;
  readonly measurement: ProjectionMeasurement;
}

/** Measure all 56 eigenlayer-axis triples. */
export function sweepEigenlayerFrames(
  roots: readonly Root[] = e8Roots(),
  faces: readonly Face[] = triangleFaces(roots),
): FrameRow[] {
  const axes = eigenlayerAxes();
  return eigenlayerFrames().map((frame) => ({
    frame,
    name: frame.map(axisName).join("+"),
    measurement: measureProjection(projectFaces([axes[frame[0]]!, axes[frame[1]]!, axes[frame[2]]!], roots, faces)),
  }));
}

/** Measure `count` seeded random orthonormal 3-frames. */
export function sweepRandomFrames(
  count: number,
  seed = 0x1234567,
  roots: readonly Root[] = e8Roots(),
  faces: readonly Face[] = triangleFaces(roots),
): ProjectionMeasurement[] {
  const out: ProjectionMeasurement[] = [];
  for (let i = 0; i < count; i++) {
    // Advance the seed per trial rather than reseeding from a clock: replayable, and the
    // trials stay independent because xorshift32's stream is long relative to 3 x 8 draws.
    out.push(measureProjection(projectFaces(randomOrthonormalFrame(seed + i * 2654435761), roots, faces)));
  }
  return out;
}

/** Min / median / max of a numeric sample, for reporting a sweep in one line. */
export function spread(values: readonly number[]): { min: number; median: number; max: number; ratio: number } {
  if (values.length === 0) return { min: 0, median: 0, max: 0, ratio: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0]!;
  const max = sorted[sorted.length - 1]!;
  return { min, median: sorted[Math.floor(sorted.length / 2)]!, max, ratio: min === 0 ? Infinity : max / min };
}
