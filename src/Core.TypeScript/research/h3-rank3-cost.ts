/**
 * h3-rank3-cost.ts — WHAT THE RANK-3 OBJECT COSTS, ON THE SAME METERS AS RUNGS 7 AND 8.
 *
 * Aaron 2026-09-09, deciding the graphics direction:
 *
 * > *"for the graphics i think the least computational one is the better one … in case it's
 * > not clear we don't need to be in 8d if it does not buy us some advantage."*
 *
 * "Least computational" is a claim that has to be measured against something, so every number
 * here is produced by **the code rungs 7 and 8 already used**, imported rather than restated:
 *
 * | quantity | function reused | rung 7/8 value on 4_21 |
 * |---|---|---|
 * | overdraw ratio | `projectionCost` (`representation-layer-projection-cost.ts`) | 738 |
 * | mean triangle bbox / scene diagonal | same | 29.3% |
 * | triangle tests per ray | `buildSbvh` + `intersectOrdered` (`clifford-e8-sbvh.ts`) | 440 |
 * | frame time at 128^2 | the same traversal, same camera convention | 268 ms |
 * | brute-force tests per ray | `intersectBruteForce` (`clifford-e8-raytrace.ts`) | 60,480 |
 *
 * Restating any of those formulas here would make the comparison a comparison of two
 * measurement programs. Importing them makes it a comparison of two objects, which is the
 * question.
 *
 * ## The self-intersection question, and why it is decided rather than estimated
 *
 * Rung 8's obstacle is a theorem: a 2-complex is in general position only in dimension
 * `2k+1 = 5` (Whitney 1936), and a rank-3 map from `R^8` has a 5-dimensional kernel, so
 * **every** rank-3 projection of 4_21's 2-skeleton self-intersects. That theorem is about
 * *maps*. An H3 orbit polytope is not the image of a map — it is a convex body already in
 * `R^3`, and its boundary complex is an embedded 2-sphere by Steinitz. So the question does
 * not arise, and `h3SelfIntersections` measures it anyway by exhaustive triangle-pair
 * intersection because a theorem that is never checked against the shipped triangles is a
 * check that did not run.
 *
 * ## Registers
 *
 * - `metered` — the geometric numbers (overdraw, bbox fraction, incidence, intersection
 *   counts, tests per ray). Pure functions of the derived geometry, seeded, replayable.
 * - `unmetered` on any other machine — wall-clock timings. A timing is a measurement of the
 *   machine it ran on, so `benchmarkTracer` returns the numbers and the CALLER names the
 *   hardware. Nothing here writes a hardware claim into the module.
 *
 * ## Anchors (Beacon)
 *
 * - **Whitney** (1936) — general position; the theorem that applies to rung 8 and not here.
 * - **Steinitz** (1922) — the boundary complex of a convex 3-polytope is a 2-sphere.
 * - **Stich, Friedrich & Dietrich**, *Spatial Splits in Bounding Volume Hierarchies*, HPG
 *   2009 — the SBVH rung 8 built and this module reuses unchanged.
 * - **Möller & Trumbore** (1997) — the ray/triangle test inside `intersectTriangle`.
 */

import {
  H3_SOLIDS,
  h3Embed,
  h3Polytope,
  h3Triangulate,
  type H3Polytope,
  type H3Solid,
} from "./h3-rank3-geometry.ts";
import {
  projectionCost,
  triangleArea,
  type Point3,
  type ProjectionCost,
} from "./representation-layer-projection-cost.ts";
import { buildSbvh } from "./clifford-e8-sbvh.ts";
import { orderedStack, intersectOrdered } from "./clifford-e8-sbvh.ts";
import {
  intersectBruteForce,
  pixelRay,
  DEFAULT_HALF_WIDTH,
  type Camera,
  type Ray,
} from "./clifford-e8-raytrace.ts";

/**
 * The identity rank-3 "projection".
 *
 * H3 geometry is already in `R^3`, so the projection that `projectionCost` applies is the
 * identity — which is exactly the point being measured. Passing the identity rather than
 * writing a second cost function keeps the overdraw definition bit-for-bit the one rung 7
 * quoted its 738 from.
 */
export const IDENTITY_PROJECTION = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
] as const;

/** Vertices as plain float triples, in orbit order — the form `projectionCost` consumes. */
export function h3Positions(polytope: H3Polytope): number[][] {
  return polytope.points.map((p) => [...h3Embed(p)]);
}

/**
 * Overdraw and primitive size for a solid, on rung 7's meter.
 *
 * The interpretation of the number is unchanged from rung 7: total triangle area over the
 * surface area of the unit ball containing the scaled points. **1.0 is the value a closed
 * convex surface should approach when its area matches the ball it fills** — a sphere is
 * exactly 1 by construction of the normalisation, and a polyhedron inscribed in that ball
 * has *less* area than the ball, so a value below 1 is expected and is not an error.
 */
export function h3ProjectionCost(polytope: H3Polytope): ProjectionCost {
  const triangles = h3Triangulate(polytope.points, polytope.facets);
  return projectionCost(
    IDENTITY_PROJECTION as unknown as Parameters<typeof projectionCost>[0],
    h3Positions(polytope),
    triangles,
  );
}

/**
 * Triangle positions as the flat `Float32Array` the BVH and the tracer both consume,
 * **scaled so the farthest vertex sits on the unit sphere**.
 *
 * That is rung 7's `toUnitBall` convention, and it is applied here for the same reason the
 * overdraw ratio needs it: `cameraFromRoot`'s framing parameters (`distance = 3`,
 * `halfWidth = 0.48`) are calibrated against a unit-radius object, so a solid left at its
 * natural `Z[phi]` scale would be framed differently from 4_21 and its tests-per-ray would
 * not be comparable to rung 8's 440. The scale factor is a float and lives here, on the
 * readout side of `h3Embed`; nothing exact is touched.
 */
export function h3TrianglePositions(polytope: H3Polytope): Float32Array {
  const triangles = h3Triangulate(polytope.points, polytope.facets);
  const positions = new Float32Array(triangles.length * 9);
  const raw = polytope.points.map(h3Embed);
  let radius = 0;
  for (const p of raw) radius = Math.max(radius, Math.hypot(p[0], p[1], p[2]));
  const scale = radius === 0 ? 1 : 1 / radius;
  const xyz = raw.map((p) => [p[0] * scale, p[1] * scale, p[2] * scale] as [number, number, number]);
  for (let t = 0; t < triangles.length; t++) {
    const tri = triangles[t] as readonly [number, number, number];
    for (let c = 0; c < 3; c++) {
      const p = xyz[tri[c] as number] as [number, number, number];
      positions[t * 9 + c * 3] = p[0];
      positions[t * 9 + c * 3 + 1] = p[1];
      positions[t * 9 + c * 3 + 2] = p[2];
    }
  }
  return positions;
}

// ── self-intersection, measured exhaustively ────────────────────────────────

/** What the exhaustive triangle-pair scan found. */
export interface SelfIntersectionResult {
  /** Triangles scanned. */
  readonly triangles: number;
  /** Pairs tested: `n(n-1)/2`, every one of them. */
  readonly pairsTested: number;
  /** Pairs sharing no vertex that nonetheless intersect. Zero is the embedded case. */
  readonly improperIntersections: number;
  /** Pairs sharing exactly one vertex or one edge — legal in any triangulated surface. */
  readonly adjacentPairs: number;
}

/** Below this the segment/triangle determinant is treated as parallel. Authored, named. */
export const INTERSECTION_EPSILON = 1e-9;

/**
 * Exhaustive pairwise triangle intersection — the ABSOLUTE reference.
 *
 * No BVH, no acceleration, no early-out heuristic beyond exact adjacency: every one of the
 * `n(n-1)/2` pairs is tested. Rung 8's own lesson is that a relative comparison between two
 * paths that share a component can agree while both are wrong, so the check that the surface
 * does not self-intersect must not be run through the same BVH whose quality is in question.
 *
 * The test is the standard one: two triangles that share no vertex intersect iff some edge of
 * one crosses the interior of the other, so six segment/triangle tests decide each pair.
 * Coplanar overlap without an edge crossing is not detectable this way and is named here as
 * the known gap; on a convex polytope's boundary two coplanar facets are the same facet, so
 * the gap cannot fire — a claim that is itself checked, by the facet derivation being a
 * supporting-plane argmax with a single facet per direction.
 */
export function h3SelfIntersections(positions: Float32Array): SelfIntersectionResult {
  const triangles = positions.length / 9;
  let improper = 0;
  let adjacent = 0;
  let pairs = 0;

  const vertexKey = (t: number, c: number): string => {
    const b = t * 9 + c * 3;
    return `${positions[b]},${positions[b + 1]},${positions[b + 2]}`;
  };

  for (let i = 0; i < triangles; i++)
    for (let j = i + 1; j < triangles; j++) {
      pairs++;
      const keysI = [vertexKey(i, 0), vertexKey(i, 1), vertexKey(i, 2)];
      const keysJ = [vertexKey(j, 0), vertexKey(j, 1), vertexKey(j, 2)];
      const shared = keysI.filter((k) => keysJ.includes(k)).length;
      if (shared > 0) {
        adjacent++;
        continue;
      }
      if (trianglesCross(positions, i, j) || trianglesCross(positions, j, i)) improper++;
    }

  return { triangles, pairsTested: pairs, improperIntersections: improper, adjacentPairs: adjacent };
}

/** Whether any edge of triangle `a` pierces the interior of triangle `b`. */
function trianglesCross(positions: Float32Array, a: number, b: number): boolean {
  const v = (t: number, c: number): [number, number, number] => {
    const base = t * 9 + c * 3;
    return [positions[base] ?? 0, positions[base + 1] ?? 0, positions[base + 2] ?? 0];
  };
  for (let e = 0; e < 3; e++) {
    const p = v(a, e);
    const q = v(a, (e + 1) % 3);
    const ray: Ray = { ox: p[0], oy: p[1], oz: p[2], dx: q[0] - p[0], dy: q[1] - p[1], dz: q[2] - p[2] };
    const t = segmentHitsTriangle(positions, b, ray);
    if (t > INTERSECTION_EPSILON && t < 1 - INTERSECTION_EPSILON) return true;
  }
  return false;
}

/** Möller–Trumbore, restricted to a segment: the parameter `t` if it hits, else `-1`. */
function segmentHitsTriangle(positions: Float32Array, triangle: number, ray: Ray): number {
  const b = triangle * 9;
  const ax = positions[b] ?? 0;
  const ay = positions[b + 1] ?? 0;
  const az = positions[b + 2] ?? 0;
  const e1x = (positions[b + 3] ?? 0) - ax;
  const e1y = (positions[b + 4] ?? 0) - ay;
  const e1z = (positions[b + 5] ?? 0) - az;
  const e2x = (positions[b + 6] ?? 0) - ax;
  const e2y = (positions[b + 7] ?? 0) - ay;
  const e2z = (positions[b + 8] ?? 0) - az;
  const px = ray.dy * e2z - ray.dz * e2y;
  const py = ray.dz * e2x - ray.dx * e2z;
  const pz = ray.dx * e2y - ray.dy * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < INTERSECTION_EPSILON) return -1;
  const inv = 1 / det;
  const tx = ray.ox - ax;
  const ty = ray.oy - ay;
  const tz = ray.oz - az;
  const u = (tx * px + ty * py + tz * pz) * inv;
  if (u < 0 || u > 1) return -1;
  const qx = ty * e1z - tz * e1y;
  const qy = tz * e1x - tx * e1z;
  const qz = tx * e1y - ty * e1x;
  const w = (ray.dx * qx + ray.dy * qy + ray.dz * qz) * inv;
  if (w < 0 || u + w > 1) return -1;
  return (e2x * qx + e2y * qy + e2z * qz) * inv;
}

// ── the tracer benchmark, on rung 8's path ──────────────────────────────────

/** A camera looking at the origin from a derived vertex direction. */
export function h3CameraFromVertex(
  polytope: H3Polytope,
  vertexIndex: number,
  distance = 3,
  halfWidth = DEFAULT_HALF_WIDTH,
): Camera {
  const point = polytope.points[vertexIndex];
  if (point === undefined) throw new Error(`no vertex at index ${vertexIndex}`);
  const p = h3Embed(point);
  const length = Math.hypot(p[0], p[1], p[2]);
  const eyeDir: [number, number, number] = [p[0] / length, p[1] / length, p[2] / length];
  const forward: [number, number, number] = [-eyeDir[0], -eyeDir[1], -eyeDir[2]];
  const axis: [number, number, number] = Math.abs(forward[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const rx = forward[1] * axis[2] - forward[2] * axis[1];
  const ry = forward[2] * axis[0] - forward[0] * axis[2];
  const rz = forward[0] * axis[1] - forward[1] * axis[0];
  const rl = Math.hypot(rx, ry, rz);
  const right: [number, number, number] = [rx / rl, ry / rl, rz / rl];
  const up: [number, number, number] = [
    right[1] * forward[2] - right[2] * forward[1],
    right[2] * forward[0] - right[0] * forward[2],
    right[0] * forward[1] - right[1] * forward[0],
  ];
  return {
    eye: [eyeDir[0] * distance, eyeDir[1] * distance, eyeDir[2] * distance],
    forward,
    right,
    up,
    halfWidth,
  };
}

/** What one framed render cost. */
export interface TracerBenchmark {
  readonly triangles: number;
  readonly resolution: number;
  /** Pixels that hit the surface. */
  readonly hits: number;
  /** Triangle tests summed over every ray, divided by the ray count. */
  readonly trianglesPerRay: number;
  /** Node tests per ray. */
  readonly nodesPerRay: number;
  /** Wall-clock render milliseconds. `unmetered` unless the caller names the hardware. */
  readonly renderMilliseconds: number;
  /** Wall-clock SBVH build milliseconds. Same caveat. */
  readonly buildMilliseconds: number;
  /** Triangle tests per ray for exhaustive scan: exactly the triangle count. */
  readonly bruteForceTrianglesPerRay: number;
  /** Rays whose SBVH answer differs from the exhaustive answer. Zero is the requirement. */
  readonly disagreementsWithBruteForce: number;
}

/**
 * Render one framed view with rung 8's SBVH and ordered traversal, and check every pixel
 * against exhaustive scan.
 *
 * The brute-force cross-check is the point rather than a nicety: rung 7's .NET oracle had a
 * mutant survive because every tracer test compared one accelerated path against another and
 * both shared `trace`. `intersectBruteForce` shares nothing with the BVH but the triangle
 * test, so it is an absolute reference the fast path is obliged to reproduce — and at these
 * triangle counts it is cheap enough to run on **every** pixel rather than a sample.
 */
export function benchmarkTracer(polytope: H3Polytope, resolution = 128, vertexIndex = 0): TracerBenchmark {
  const positions = h3TrianglePositions(polytope);
  const triangles = positions.length / 9;

  const buildStart = performance.now();
  const bvh = buildSbvh(positions);
  const buildMilliseconds = performance.now() - buildStart;

  const camera = h3CameraFromVertex(polytope, vertexIndex);
  const stack = orderedStack(bvh);
  const stats = { nodeTests: 0, triangleTests: 0 };

  const renderStart = performance.now();
  let hits = 0;
  const found = new Int32Array(resolution * resolution);
  for (let y = 0; y < resolution; y++)
    for (let x = 0; x < resolution; x++) {
      const hit = intersectOrdered(positions, bvh, pixelRay(camera, resolution, resolution, x, y), stats, stack);
      found[y * resolution + x] = hit.triangle;
      if (hit.triangle >= 0) hits++;
    }
  const renderMilliseconds = performance.now() - renderStart;

  let disagreements = 0;
  for (let y = 0; y < resolution; y++)
    for (let x = 0; x < resolution; x++) {
      const reference = intersectBruteForce(positions, pixelRay(camera, resolution, resolution, x, y));
      if (reference.triangle !== found[y * resolution + x]) disagreements++;
    }

  const rays = resolution * resolution;
  return {
    triangles,
    resolution,
    hits,
    trianglesPerRay: stats.triangleTests / rays,
    nodesPerRay: stats.nodeTests / rays,
    renderMilliseconds,
    buildMilliseconds,
    bruteForceTrianglesPerRay: triangles,
    disagreementsWithBruteForce: disagreements,
  };
}

// ── the payload ─────────────────────────────────────────────────────────────

/** What a consumer would have to ship for a solid. */
export interface PayloadMeasurement {
  readonly solid: H3Solid;
  readonly vertices: number;
  readonly triangles: number;
  /** Bytes an explicit `Float32Array` triangle soup occupies: `triangles * 9 * 4`. */
  readonly explicitGeometryBytes: number;
  /** Bytes of `Z[phi]` vertex coordinates, at 8 bytes per `bigint` pair component. */
  readonly exactVertexBytes: number;
}

/** Two `bigint`s per coordinate, three coordinates, eight bytes each — the stated convention. */
export const BYTES_PER_EXACT_VERTEX = 3 * 2 * 8;

/** Measure what a solid would cost to ship as data rather than to derive. */
export function h3Payload(polytope: H3Polytope): PayloadMeasurement {
  const triangles = h3Triangulate(polytope.points, polytope.facets).length;
  return {
    solid: polytope.solid,
    vertices: polytope.points.length,
    triangles,
    explicitGeometryBytes: triangles * 9 * 4,
    exactVertexBytes: polytope.points.length * BYTES_PER_EXACT_VERTEX,
  };
}

// ── the whole family, one call ──────────────────────────────────────────────

/** Everything measured about one solid. */
export interface H3CostRow {
  readonly solid: H3Solid;
  readonly fVector: readonly [number, number, number];
  readonly euler: number;
  readonly edgeFacetMin: number;
  readonly edgeFacetMax: number;
  readonly cost: ProjectionCost;
  readonly selfIntersection: SelfIntersectionResult;
  readonly payload: PayloadMeasurement;
}

/** Geometry-only census over the whole family — no timings, so this is fully `metered`. */
export function h3CostTable(): H3CostRow[] {
  return H3_SOLIDS.map((solid) => {
    const polytope = h3Polytope(solid);
    const positions = h3TrianglePositions(polytope);
    return {
      solid,
      fVector: polytope.fVector,
      euler: polytope.euler,
      edgeFacetMin: polytope.incidence.min,
      edgeFacetMax: polytope.incidence.max,
      cost: h3ProjectionCost(polytope),
      selfIntersection: h3SelfIntersections(positions),
      payload: h3Payload(polytope),
    };
  });
}

/** Re-exported so a caller can compute a triangle's area on the same meter rung 7 used. */
export { triangleArea, type Point3 };
