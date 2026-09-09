/**
 * clifford-e8-raytrace.ts — RUNG 7b: NEAREST-HIT IS THE OCCLUSION RUNG 6 REFUSED TO FAKE.
 *
 * Rung 6 shipped a lit surface and then declined, in writing, to draw it *solid*:
 *
 * > *"What it is NOT: a closed solid. Every edge carries 27 faces (measured), so ... the
 * > materials are two-sided."*
 *
 * That refusal was correct and it left a real hole. A painter's algorithm sorts **whole
 * primitives** by depth and paints back-to-front, which is only valid when no two primitives
 * interpenetrate and no cycle exists in the depth order. On the projected 2-skeleton of an
 * 8-polytope both conditions fail loudly: 60,480 triangles crowd into a 3-dimensional image
 * of an 8-dimensional object, so they cross each other constantly, and 27 faces meet on
 * every edge. Any per-primitive sort therefore produces a *plausible* picture that is wrong
 * in a way the viewer cannot see — the worst available failure.
 *
 * **Ray tracing is not a nicety here; it is the principled repair.** Nearest-hit is decided
 * **per ray**, at a point, so interpenetration and depth cycles simply do not arise: two
 * triangles that cross have different nearest surfaces at different pixels and the method
 * says so. The same is true of a z-buffer, which is why the GPU path in the sibling page is
 * also honest — a z-buffer is per-fragment nearest-hit with the sampling fixed to the pixel
 * grid. What is *not* honest is a sort. So the ladder's occlusion answer is:
 *
 * > **per-primitive ordering: undefined here. per-sample nearest-hit: exact.**
 *
 * ## What is derived and what is authored
 *
 * - **The camera direction is a root.** Same gauge argument as rung 6's light: E8's root
 *   system is the only distinguished finite set of directions this substrate owns, so the
 *   view is `embed3d` of a chosen root and *which* root is a gauge.
 * - **The shading is not recomputed.** A hit returns a triangle index; the level came out of
 *   `shadeFaces` in 8-dimensional integer arithmetic before any ray existed. The tracer
 *   performs **no lighting arithmetic whatsoever** — it answers "which triangle" and looks
 *   the answer up. That is the same property that makes the fragment shader trivial.
 * - **Authored, and named as such:** the image plane's field of view, the leaf size, and the
 *   split rule. These are performance parameters of an intersection structure, not claims
 *   about the polytope, and none of them can change which triangle is nearest.
 *
 * ## Registers
 *
 * - `metered` — nearest-hit agreement with brute force over seeded random rays; the BVH
 *   containment and partition invariants; two-sidedness; byte-identical replay.
 * - `metered` — the timings in `docs/research/2026-09-09-rung-7-*`, on named hardware.
 * - `unmetered` — anything about *other* hardware. A number measured on one machine is a
 *   measurement of that machine.
 *
 * ## Prior art (Beacon)
 *
 * - **Möller & Trumbore**, *Fast, Minimum Storage Ray/Triangle Intersection*, Journal of
 *   Graphics Tools 2(1), 1997 — the triangle test, used here in its **two-sided** form
 *   (no back-face cull), which this geometry forces rather than merely permits.
 * - **Kay & Kajiya**, *Ray Tracing Complex Scenes*, SIGGRAPH 1986 — the slab test.
 * - **Williams, Barrus, Morley & Shirley**, *An Efficient and Robust Ray-Box Intersection
 *   Algorithm*, Journal of Graphics Tools 10(1), 2005 — the reciprocal-direction slab form
 *   used below, including its handling of the zero-component case through IEEE infinities.
 * - **Wald, Boulos & Shirley**, *Ray Tracing Deformable Scenes using Dynamic BVHs*, ACM TOG
 *   26(1), 2007 — the BVH-over-triangles design; the median split here is the simplest
 *   member of that family, and the surface-area heuristic (Goldsmith & Salmon 1987;
 *   MacDonald & Booth 1990) is the named next step, not something claimed here.
 * - **Pharr, Jakob & Humphreys**, *Physically Based Rendering* 4th ed. — the reference text
 *   for both structures.
 */

import { e8Roots, type Root } from "./clifford-e8-coxeter-projection.ts";
import { embed3d } from "./clifford-e8-eigenlayer-tessellation.ts";

/** Floats per vertex. */
const STRIDE = 3;

/** Floats per triangle: three vertices. */
const TRIANGLE_FLOATS = 9;

/** Maximum triangles in a leaf. An authored performance parameter; cannot change a hit. */
export const DEFAULT_LEAF_SIZE = 4;

/** Parallel-ray epsilon for the two-sided Moller-Trumbore determinant. */
export const PARALLEL_EPSILON = 1e-12;

/** The level index reported for a pixel that hits nothing. */
export const MISS = 255;

/**
 * Half-width of the image plane at unit distance: `tan(fov/2)` for a 51-degree field.
 *
 * Authored framing, and chosen to MATCH the WebGPU/WebGL2 paths in `demo/clifford-e8`, so
 * the ray-traced panel and the rasterised view are two methods on one view rather than two
 * pictures of different things. A wider field is not wrong, it just puts the object in a
 * corner: at `1.15` (a 98-degree field) only 6% of pixels hit anything, measured.
 */
export const DEFAULT_HALF_WIDTH = 0.48;

/** A ray. `direction` need not be normalised; `t` is measured in units of `direction`. */
export interface Ray {
  readonly ox: number;
  readonly oy: number;
  readonly oz: number;
  readonly dx: number;
  readonly dy: number;
  readonly dz: number;
}

/**
 * A nearest-hit result. `triangle` is `-1` on a miss and `t` is then `Infinity`.
 *
 * **The depth is unique; the triangle is not.** `embed3d` is a linear map from 8 dimensions
 * to 3, and it FOLDS: edge-adjacent faces of 4_21 can land on overlapping regions of the
 * same 3D plane, so a ray can meet two distinct triangles at bit-identical `t`. Measured on
 * the derived surface (see the sibling test): about 1% of seeded rays hit such a tie, and
 * some of those tied faces carry DIFFERENT shading levels — so the pixel's colour is
 * genuinely ambiguous, not merely its provenance.
 *
 * This is the same fact rung 6 pointed at from the other side when it declined occlusion,
 * sharpened: a 3-dimensional image of an 8-dimensional object cannot always say which face
 * you are looking at. The tracer therefore does not pretend the ambiguity away and does not
 * resolve it by traversal order either — **ties go to the lowest triangle index**, a total
 * order fixed in advance, so the answer is the same from the BVH and from the exhaustive
 * scan and the same on every replay. Order-independence bought by declaring the tie-break,
 * which is the only honest way to buy it.
 */
export interface Hit {
  readonly triangle: number;
  readonly t: number;
}

/** The miss result, shared so a caller cannot mistake one miss for another. */
export const NO_HIT: Hit = { triangle: -1, t: Number.POSITIVE_INFINITY };

/**
 * A bounding-volume hierarchy over unindexed triangles, in flat typed arrays.
 *
 * Flat rather than object-per-node so traversal touches contiguous memory — the same reason
 * the SIMD discussion in the rung 7 doc concerns *layout* before it concerns instructions.
 */
export interface Bvh {
  /** `6 * nodeCount`: `minX minY minZ maxX maxY maxZ` per node. */
  readonly bounds: Float32Array;
  /** `2 * nodeCount`: for an interior node `[leftChild, -1]`, for a leaf `[first, count]`. */
  readonly nodes: Int32Array;
  /** Permutation of triangle indices; a leaf owns `order[first .. first+count)`. */
  readonly order: Int32Array;
  readonly nodeCount: number;
  readonly triangleCount: number;
  readonly leafCount: number;
  readonly maxDepth: number;
}

/** Read one triangle's nine floats. Returns a copy so callers cannot alias the scene. */
export function triangleVertices(positions: Float32Array, triangle: number): Float32Array {
  return positions.slice(triangle * TRIANGLE_FLOATS, (triangle + 1) * TRIANGLE_FLOATS);
}

/**
 * Build the BVH by recursive median split on the widest centroid axis.
 *
 * Median split, not SAH. The honest reason is that a median split is *sufficient to answer
 * the question asked* — is CPU nearest-hit over this surface fast enough to look at — and a
 * surface-area heuristic would improve the constant without changing that answer. Naming the
 * better structure and not implementing it is the accurate register; implementing it and
 * calling the difference a discovery would not be.
 */
export function buildBvh(positions: Float32Array, leafSize = DEFAULT_LEAF_SIZE): Bvh {
  const triangleCount = Math.floor(positions.length / TRIANGLE_FLOATS);
  const centroids = new Float32Array(triangleCount * STRIDE);
  for (let t = 0; t < triangleCount; t++) {
    const base = t * TRIANGLE_FLOATS;
    for (let axis = 0; axis < STRIDE; axis++) {
      const a = positions[base + axis] ?? 0;
      const b = positions[base + STRIDE + axis] ?? 0;
      const c = positions[base + 2 * STRIDE + axis] ?? 0;
      centroids[t * STRIDE + axis] = (a + b + c) / 3;
    }
  }

  const order = new Int32Array(triangleCount);
  for (let t = 0; t < triangleCount; t++) order[t] = t;

  // A node is at most one per triangle plus one per interior split; 2n is the standard
  // bound for a binary tree whose leaves hold at least one primitive each.
  const capacity = Math.max(1, 2 * triangleCount);
  const bounds = new Float32Array(capacity * 6);
  const nodes = new Int32Array(capacity * 2);
  let nodeCount = 0;
  let leafCount = 0;
  let maxDepth = 0;

  const boundsOf = (first: number, count: number, node: number): void => {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    for (let i = first; i < first + count; i++) {
      const base = (order[i] ?? 0) * TRIANGLE_FLOATS;
      for (let v = 0; v < STRIDE; v++) {
        const x = positions[base + v * STRIDE] ?? 0;
        const y = positions[base + v * STRIDE + 1] ?? 0;
        const z = positions[base + v * STRIDE + 2] ?? 0;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (z < minZ) minZ = z;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (z > maxZ) maxZ = z;
      }
    }
    bounds[node * 6] = minX;
    bounds[node * 6 + 1] = minY;
    bounds[node * 6 + 2] = minZ;
    bounds[node * 6 + 3] = maxX;
    bounds[node * 6 + 4] = maxY;
    bounds[node * 6 + 5] = maxZ;
  };

  const build = (first: number, count: number, depth: number): number => {
    const node = nodeCount++;
    if (depth > maxDepth) maxDepth = depth;
    boundsOf(first, count, node);
    if (count <= leafSize) {
      nodes[node * 2] = first;
      nodes[node * 2 + 1] = count;
      leafCount++;
      return node;
    }
    // Widest centroid axis of this node's own triangles.
    let axis = 0;
    let widest = -1;
    for (let a = 0; a < STRIDE; a++) {
      let lo = Number.POSITIVE_INFINITY;
      let hi = Number.NEGATIVE_INFINITY;
      for (let i = first; i < first + count; i++) {
        const c = centroids[(order[i] ?? 0) * STRIDE + a] ?? 0;
        if (c < lo) lo = c;
        if (c > hi) hi = c;
      }
      if (hi - lo > widest) {
        widest = hi - lo;
        axis = a;
      }
    }
    const slice = Array.from(order.subarray(first, first + count));
    slice.sort((p, q) => (centroids[p * STRIDE + axis] ?? 0) - (centroids[q * STRIDE + axis] ?? 0));
    order.set(slice, first);
    const half = count >> 1;
    build(first, half, depth + 1);
    const right = build(first + half, count - half, depth + 1);
    nodes[node * 2] = right;
    nodes[node * 2 + 1] = -1;
    return node;
  };

  if (triangleCount > 0) build(0, triangleCount, 0);

  return {
    bounds: bounds.slice(0, nodeCount * 6),
    nodes: nodes.slice(0, nodeCount * 2),
    order,
    nodeCount,
    triangleCount,
    leafCount,
    maxDepth,
  };
}

/**
 * Two-sided Moller-Trumbore. Returns the ray parameter `t`, or `Infinity` for no hit.
 *
 * **Two-sided is not a setting here.** A one-sided test would silently drop roughly half the
 * 2-skeleton, and there is no "correct" winding to prefer: the derived face list is a set of
 * 3-cliques with no orientation, and rung 6 measured 27 faces on every edge, so there is no
 * inside for a normal to point away from. The determinant's *sign* is therefore discarded
 * and only its magnitude gates the test.
 */
export function intersectTriangle(positions: Float32Array, triangle: number, ray: Ray): number {
  const base = triangle * TRIANGLE_FLOATS;
  const ax = positions[base] ?? 0;
  const ay = positions[base + 1] ?? 0;
  const az = positions[base + 2] ?? 0;
  const e1x = (positions[base + 3] ?? 0) - ax;
  const e1y = (positions[base + 4] ?? 0) - ay;
  const e1z = (positions[base + 5] ?? 0) - az;
  const e2x = (positions[base + 6] ?? 0) - ax;
  const e2y = (positions[base + 7] ?? 0) - ay;
  const e2z = (positions[base + 8] ?? 0) - az;

  const px = ray.dy * e2z - ray.dz * e2y;
  const py = ray.dz * e2x - ray.dx * e2z;
  const pz = ray.dx * e2y - ray.dy * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (det > -PARALLEL_EPSILON && det < PARALLEL_EPSILON) return Number.POSITIVE_INFINITY;

  const inv = 1 / det;
  const tx = ray.ox - ax;
  const ty = ray.oy - ay;
  const tz = ray.oz - az;
  const u = (tx * px + ty * py + tz * pz) * inv;
  if (u < 0 || u > 1) return Number.POSITIVE_INFINITY;

  const qx = ty * e1z - tz * e1y;
  const qy = tz * e1x - tx * e1z;
  const qz = tx * e1y - ty * e1x;
  const v = (ray.dx * qx + ray.dy * qy + ray.dz * qz) * inv;
  if (v < 0 || u + v > 1) return Number.POSITIVE_INFINITY;

  const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return t > 0 ? t : Number.POSITIVE_INFINITY;
}

/**
 * Nearest hit by exhaustive scan. The reference the BVH is judged against.
 *
 * Kept, exported and tested rather than deleted: an acceleration structure with no
 * independent oracle is an optimisation nobody can falsify. This is the second meter.
 */
export function intersectBruteForce(positions: Float32Array, ray: Ray): Hit {
  const triangleCount = Math.floor(positions.length / TRIANGLE_FLOATS);
  let best = Number.POSITIVE_INFINITY;
  let hit = -1;
  for (let t = 0; t < triangleCount; t++) {
    const d = intersectTriangle(positions, t, ray);
    if (d < best || (d === best && t < hit)) {
      best = d;
      hit = t;
    }
  }
  return hit < 0 ? NO_HIT : { triangle: hit, t: best };
}

/**
 * Slab test in the Williams et al. reciprocal form, returning the entry distance or
 * `Infinity`. A zero direction component yields an IEEE infinity here, which is the
 * behaviour that paper's algorithm relies on rather than a case it special-cases.
 */
function intersectBox(bounds: Float32Array, node: number, ray: Ray, limit: number): number {
  const ix = 1 / ray.dx;
  const iy = 1 / ray.dy;
  const iz = 1 / ray.dz;
  const b = node * 6;
  let t0 = ((bounds[b] ?? 0) - ray.ox) * ix;
  let t1 = ((bounds[b + 3] ?? 0) - ray.ox) * ix;
  let lo = Math.min(t0, t1);
  let hi = Math.max(t0, t1);
  t0 = ((bounds[b + 1] ?? 0) - ray.oy) * iy;
  t1 = ((bounds[b + 4] ?? 0) - ray.oy) * iy;
  lo = Math.max(lo, Math.min(t0, t1));
  hi = Math.min(hi, Math.max(t0, t1));
  t0 = ((bounds[b + 2] ?? 0) - ray.oz) * iz;
  t1 = ((bounds[b + 5] ?? 0) - ray.oz) * iz;
  lo = Math.max(lo, Math.min(t0, t1));
  hi = Math.min(hi, Math.max(t0, t1));
  if (hi < Math.max(lo, 0) || lo > limit) return Number.POSITIVE_INFINITY;
  return Math.max(lo, 0);
}

/** Traversal statistics, so a claim about cost is a measurement and not an impression. */
export interface TraversalStats {
  nodeTests: number;
  triangleTests: number;
}

/** Nearest hit through the BVH. Identical results to `intersectBruteForce` — falsified. */
export function intersectBvh(
  positions: Float32Array,
  bvh: Bvh,
  ray: Ray,
  stats?: TraversalStats,
  stack: Int32Array = new Int32Array(64),
): Hit {
  if (bvh.nodeCount === 0) return NO_HIT;
  let best = Number.POSITIVE_INFINITY;
  let hit = -1;
  let top = 0;
  stack[top++] = 0;
  while (top > 0) {
    const node = stack[--top] ?? 0;
    if (stats !== undefined) stats.nodeTests++;
    if (intersectBox(bvh.bounds, node, ray, best) === Number.POSITIVE_INFINITY) continue;
    const first = bvh.nodes[node * 2] ?? 0;
    const count = bvh.nodes[node * 2 + 1] ?? -1;
    if (count < 0) {
      // Interior: `first` holds the right child; the left child is always the next node
      // emitted by the depth-first build, so it needs no stored index.
      stack[top++] = node + 1;
      stack[top++] = first;
      continue;
    }
    for (let i = first; i < first + count; i++) {
      const triangle = bvh.order[i] ?? 0;
      if (stats !== undefined) stats.triangleTests++;
      const d = intersectTriangle(positions, triangle, ray);
      // The declared tie-break. Without `|| (d === best && triangle < hit)` the two methods
      // disagree on roughly 1% of rays -- not by a defect in either, but because traversal
      // order decides a genuinely tied answer. That is exactly the per-primitive ordering
      // dependence this module exists to remove.
      if (d < best || (d === best && triangle < hit)) {
        best = d;
        hit = triangle;
      }
    }
  }
  return hit < 0 ? NO_HIT : { triangle: hit, t: best };
}

// ── the camera, derived from a root ─────────────────────────────────────────

/** An orthonormal camera frame with the eye on a derived direction. */
export interface Camera {
  readonly eye: readonly [number, number, number];
  readonly forward: readonly [number, number, number];
  readonly right: readonly [number, number, number];
  readonly up: readonly [number, number, number];
  readonly halfWidth: number;
}

const norm = (v: readonly [number, number, number]): [number, number, number] => {
  const n = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  return [v[0] / n, v[1] / n, v[2] / n];
};

const cross = (
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): [number, number, number] => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * A camera whose viewing direction is the 3D embedding of an E8 root.
 *
 * The gauge argument of rung 6 applies unchanged: the roots are the substrate's only
 * distinguished finite set of directions, so picking one is a choice of frame and not a
 * choice of content. `distance` and `halfWidth` are authored framing parameters and are the
 * only authored numbers in the render path.
 */
export function cameraFromRoot(
  rootIndex: number,
  distance = 3,
  halfWidth = DEFAULT_HALF_WIDTH,
  roots: readonly Root[] = e8Roots(),
): Camera {
  const points = embed3d(roots);
  const p = points[rootIndex];
  if (p === undefined) throw new Error(`no root at index ${rootIndex}`);
  const eyeDir = norm([p.x, p.y, p.z]);
  const forward: [number, number, number] = [-eyeDir[0], -eyeDir[1], -eyeDir[2]];
  // Gram-Schmidt against whichever world axis is least parallel to the view, so the frame is
  // well conditioned for every root rather than for a convenient one.
  const axis: [number, number, number] =
    Math.abs(forward[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const right = norm(cross(forward, axis));
  const up = cross(right, forward);
  return {
    eye: [eyeDir[0] * distance, eyeDir[1] * distance, eyeDir[2] * distance],
    forward,
    right,
    up,
    halfWidth,
  };
}

/** The ray through pixel `(x, y)` of a `width x height` image, sampled at pixel centres. */
export function pixelRay(camera: Camera, width: number, height: number, x: number, y: number): Ray {
  const aspect = height / width;
  const sx = ((x + 0.5) / width) * 2 - 1;
  const sy = 1 - ((y + 0.5) / height) * 2;
  const u = sx * camera.halfWidth;
  const v = sy * camera.halfWidth * aspect;
  return {
    ox: camera.eye[0],
    oy: camera.eye[1],
    oz: camera.eye[2],
    dx: camera.forward[0] + camera.right[0] * u + camera.up[0] * v,
    dy: camera.forward[1] + camera.right[1] * u + camera.up[1] * v,
    dz: camera.forward[2] + camera.right[2] * u + camera.up[2] * v,
  };
}

/** A rendered frame: one level index per pixel, `MISS` where nothing was hit. */
export interface Frame {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8Array;
  readonly hits: number;
  readonly stats: TraversalStats;
}

/**
 * Render the derived surface by nearest hit.
 *
 * The tracer evaluates **no lighting**. It finds the nearest triangle and reads that
 * triangle's level out of the buffer `shadeFaces` produced. Every photometric decision in
 * this image was made in 8-dimensional integer arithmetic in rung 6.
 */
export function renderFrame(
  positions: Float32Array,
  levels: Uint8Array,
  bvh: Bvh,
  camera: Camera,
  width: number,
  height: number,
): Frame {
  const pixels = new Uint8Array(width * height).fill(MISS);
  const stats: TraversalStats = { nodeTests: 0, triangleTests: 0 };
  const stack = new Int32Array(2 * (bvh.maxDepth + 2) + 8);
  let hits = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const hit = intersectBvh(positions, bvh, pixelRay(camera, width, height, x, y), stats, stack);
      if (hit.triangle >= 0) {
        pixels[y * width + x] = levels[hit.triangle * 3] ?? MISS;
        hits++;
      }
    }
  }
  return { width, height, pixels, hits, stats };
}

/**
 * A deterministic ray source for the falsifiers: xorshift32, seeded, no ambient entropy.
 *
 * §13 noninterference stated for a test: the rays that judge the BVH must be reproducible,
 * so the generator is injected as a seed rather than drawn from `Math.random`.
 */
export function seededRays(seed: number, count: number, radius = 3): Ray[] {
  let state = seed >>> 0 || 1;
  const next = (): number => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
  const rays: Ray[] = [];
  for (let i = 0; i < count; i++) {
    const ox = (next() * 2 - 1) * radius;
    const oy = (next() * 2 - 1) * radius;
    const oz = (next() * 2 - 1) * radius;
    // Aim back through a random point in the unit cube so a useful fraction of rays hit.
    const tx = next() * 2 - 1;
    const ty = next() * 2 - 1;
    const tz = next() * 2 - 1;
    rays.push({ ox, oy, oz, dx: tx - ox, dy: ty - oy, dz: tz - oz });
  }
  return rays;
}

/** A frame rendered to text: one character per pixel, densest for the brightest level. */
export function frameToText(frame: Frame, ramp = " .:-=+*#%@"): string {
  const rows: string[] = [];
  for (let y = 0; y < frame.height; y++) {
    let row = "";
    for (let x = 0; x < frame.width; x++) {
      const level = frame.pixels[y * frame.width + x] ?? MISS;
      row += level === MISS ? " " : (ramp[Math.min(ramp.length - 1, level * 2 + 1)] ?? "?");
    }
    rows.push(row);
  }
  return rows.join("\n");
}
