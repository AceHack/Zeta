/**
 * h3-rank3-cost.test.ts — the falsifiers for "least computational".
 *
 * Aaron's criterion is comparative, so every assertion here is against a number rung 7 or
 * rung 8 already published on 4_21, and the geometric ones are exact enough to fail if the
 * object changed. Timings are deliberately NOT asserted: a wall-clock threshold in a test is
 * a measurement of the CI runner, and it would go red for a reason that is not about the
 * geometry. The timings live in the research document with the hardware named.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  IDENTITY_PROJECTION,
  benchmarkTracer,
  h3CameraFromVertex,
  h3CostTable,
  h3Payload,
  h3ProjectionCost,
  h3SelfIntersections,
  h3TrianglePositions,
} from "./h3-rank3-cost.ts";
import { H3_SOLIDS, h3EdgeFacetIncidence, h3Edges, h3Polytope } from "./h3-rank3-geometry.ts";
import { GENERAL_POSITION_DIMENSION } from "./representation-layer-projection-cost.ts";
import { intersectBruteForce, pixelRay } from "./clifford-e8-raytrace.ts";

/** Rung 7's overdraw on the projected 2-skeleton of 4_21. The number being beaten. */
const RUNG_7_OVERDRAW = 738;

/** Rung 8's triangle tests per ray with the SBVH and ordered traversal, 128^2. */
const RUNG_8_TRIANGLES_PER_RAY = 440;

/** 4_21's edge-facet incidence — the reason its surface has no side. */
const RUNG_7_EDGE_FACE_INCIDENCE = 27;

describe("self-intersection — the crux of whether Phase 1 is needed", () => {
  test.each([...H3_SOLIDS])(
    "%s: ZERO improper triangle intersections, by exhaustive pairwise scan",
    (solid) => {
      const positions = h3TrianglePositions(h3Polytope(solid));
      const result = h3SelfIntersections(positions);
      expect(result.improperIntersections).toBe(0);
      // The scan is exhaustive, not sampled: n(n-1)/2 pairs, every one.
      expect(result.pairsTested).toBe((result.triangles * (result.triangles - 1)) / 2);
      // And it found adjacency, which is the control: a scan that reported zero of everything
      // would also report zero improper intersections and mean nothing.
      expect(result.adjacentPairs).toBeGreaterThan(0);
    },
  );

  test("the scan CAN report an intersection — a deliberately crossed pair", () => {
    // Two triangles in perpendicular planes, arranged so one pierces the other. Without this
    // the zero above is unfalsifiable: a detector that always returns zero passes every case.
    const crossed = new Float32Array([
      -1, 0, 0, 1, 0, 0, 0, 1, 0,
      0, 0.5, -1, 0, 0.5, 1, 0, -1, 0,
    ]);
    expect(h3SelfIntersections(crossed).improperIntersections).toBe(1);
  });

  test("Whitney's dimension is 5, and nothing here is a projection", () => {
    // Recorded as a check rather than as prose: the reason rung 8 could not escape its
    // overdraw is that a rank-3 map of a 2-complex is below general position. These solids are
    // convex bodies already in R^3, so the identity is the only map applied to them.
    expect(GENERAL_POSITION_DIMENSION).toBe(5);
    expect(IDENTITY_PROJECTION).toEqual([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
  });
});

describe("overdraw and primitive size, on rung 7's meter", () => {
  test.each([...H3_SOLIDS])("%s: overdraw is below 1, against 4_21's 738", (solid) => {
    const cost = h3ProjectionCost(h3Polytope(solid));
    expect(cost.overdraw).toBeGreaterThan(0);
    expect(cost.overdraw).toBeLessThan(1);
    expect(cost.overdraw).toBeLessThan(RUNG_7_OVERDRAW / 100);
    // No facet collapses, and no two vertices land on each other — both of which a bad
    // projection produces and an identity map on distinct points cannot.
    expect(cost.degenerateFaces).toBe(0);
    expect(cost.distinctVertices).toBe(h3Polytope(solid).points.length);
  });

  test("primitive size does NOT uniformly improve — the honest half of the comparison", () => {
    // 4_21's mean triangle bounding box is 29.3% of the scene diagonal, and rung 8 named that
    // as why object partitioning fails. The icosahedron is WORSE (larger triangles relative to
    // the scene) because it has only twenty of them; the 120-vertex solid is better. Asserted
    // in both directions so a future change that quietly flips it is caught.
    const icosahedron = h3ProjectionCost(h3Polytope("icosahedron"));
    const truncated = h3ProjectionCost(h3Polytope("truncatedIcosidodecahedron"));
    expect(icosahedron.meanBoxFraction).toBeGreaterThan(0.293);
    expect(truncated.meanBoxFraction).toBeLessThan(0.293);
  });

  test("edge-facet incidence is 2 everywhere, against 4_21's 27", () => {
    for (const row of h3CostTable()) {
      expect(row.edgeFacetMin).toBe(2);
      expect(row.edgeFacetMax).toBe(2);
      expect(row.edgeFacetMax).toBeLessThan(RUNG_7_EDGE_FACE_INCIDENCE);
      expect(row.euler).toBe(2);
    }
  });

  test("the incidence counter CAN report a number other than 2 — remove one facet and it does", () => {
    // Without this the assertion above is satisfied by a counter that returns 2 unconditionally,
    // which is the vacuity class exactly: a check that cannot fail. Deleting one facet leaves
    // its edges with a single incident facet, and the minimum must fall to 1.
    const polytope = h3Polytope("icosahedron");
    const holed = polytope.facets.slice(1);
    const edges = h3Edges(polytope.points, polytope.facets);
    const incidence = h3EdgeFacetIncidence(polytope.points, holed, edges);
    expect(incidence.min).toBe(1);
    expect(incidence.max).toBe(2);
  });
});

describe("the tracer, on rung 8's path", () => {
  test.each([...H3_SOLIDS])(
    "%s: the SBVH agrees with exhaustive scan on EVERY pixel",
    (solid) => {
      // The absolute reference, run on all 4,096 rays rather than a sample. Rung 7's .NET
      // oracle had a mutant survive because both sides of its comparison shared `trace`;
      // `intersectBruteForce` shares only the triangle test.
      const result = benchmarkTracer(h3Polytope(solid), 64, 0);
      expect(result.disagreementsWithBruteForce).toBe(0);
      // The control: the frame is not empty. A tracer that hit nothing would also disagree
      // with nothing.
      expect(result.hits).toBeGreaterThan(500);
      expect(result.hits).toBeLessThan(64 * 64);
    },
  );

  test.each([...H3_SOLIDS])("%s: triangle tests per ray are far below rung 8's 440", (solid) => {
    const result = benchmarkTracer(h3Polytope(solid), 64, 0);
    expect(result.trianglesPerRay).toBeGreaterThan(0);
    expect(result.trianglesPerRay).toBeLessThan(RUNG_8_TRIANGLES_PER_RAY / 10);
    // Exhaustive scan on 4_21 is 60,480 tests per ray; here it is the triangle count, and the
    // largest solid's whole triangle soup is smaller than one rung-8 ray's test budget.
    expect(result.bruteForceTrianglesPerRay).toBeLessThan(RUNG_8_TRIANGLES_PER_RAY);
  });

  test("the camera frame is orthonormal and looks at the origin", () => {
    const polytope = h3Polytope("icosidodecahedron");
    const camera = h3CameraFromVertex(polytope, 0);
    const dot = (a: readonly number[], b: readonly number[]): number =>
      (a[0] ?? 0) * (b[0] ?? 0) + (a[1] ?? 0) * (b[1] ?? 0) + (a[2] ?? 0) * (b[2] ?? 0);
    expect(dot(camera.forward, camera.forward)).toBeCloseTo(1, 12);
    expect(dot(camera.right, camera.right)).toBeCloseTo(1, 12);
    expect(dot(camera.up, camera.up)).toBeCloseTo(1, 12);
    expect(dot(camera.forward, camera.right)).toBeCloseTo(0, 12);
    expect(dot(camera.forward, camera.up)).toBeCloseTo(0, 12);
    expect(dot(camera.right, camera.up)).toBeCloseTo(0, 12);
    // The eye is on the vertex direction and the view points back through the origin.
    expect(dot(camera.eye, camera.forward)).toBeCloseTo(-3, 10);
  });

  test("the centre ray hits, and the corner rays of a wide frame miss", () => {
    // A framing check with a real negative: if every ray hit, the tests-per-ray number would
    // be measuring a full-screen quad rather than an object.
    const polytope = h3Polytope("icosahedron");
    const positions = h3TrianglePositions(polytope);
    const camera = h3CameraFromVertex(polytope, 0);
    expect(intersectBruteForce(positions, pixelRay(camera, 64, 64, 32, 32)).triangle).toBeGreaterThanOrEqual(0);
    expect(intersectBruteForce(positions, pixelRay(camera, 64, 64, 0, 0)).triangle).toBe(-1);
    expect(intersectBruteForce(positions, pixelRay(camera, 64, 64, 63, 63)).triangle).toBe(-1);
  });

  test("positions are scaled into the unit ball, which is what makes the framing comparable", () => {
    for (const solid of H3_SOLIDS) {
      const positions = h3TrianglePositions(h3Polytope(solid));
      let maximum = 0;
      for (let i = 0; i < positions.length; i += 3)
        maximum = Math.max(maximum, Math.hypot(positions[i] ?? 0, positions[i + 1] ?? 0, positions[i + 2] ?? 0));
      expect(maximum).toBeCloseTo(1, 6);
    }
  });
});

describe("the payload", () => {
  test("the derivation ships ZERO bytes of geometry", () => {
    // Nothing in the geometry module is a coordinate table: `h3Roots()` is generated from a
    // sign-and-permutation rule, the weights are cross products of roots found by their Gram
    // matrix, and every vertex is an orbit image. A VERTEX LIST would be a literal array of
    // four or more nested arrays, so that is what the check refuses — not "a long array of
    // numbers", which the first draft matched and which flagged `RADICAND_CANDIDATES`, a list
    // of scalars that encodes no geometry at all.
    const source = readFileSync(new URL("./h3-rank3-geometry.ts", import.meta.url), "utf8");
    const stripped = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const NESTED_ARRAY_LITERAL = /\[\s*\[[^[\]]*\](\s*,\s*\[[^[\]]*\]){3,}/g;
    expect(stripped.match(NESTED_ARRAY_LITERAL) ?? []).toEqual([]);
    // The control: the pattern DOES match a vertex table, so the emptiness above is a finding
    // rather than a regex that never fires.
    expect("[[1n,0n],[0n,1n],[2n,0n],[0n,2n],[3n,0n]]".match(NESTED_ARRAY_LITERAL)).not.toBeNull();
  });

  test("explicit geometry is TINY — and for the smallest solid it beats the derivation", () => {
    // The honest reversal, asserted rather than only written down: rung 7 ships the
    // derivation because 27,621 bytes beats 2,177,280. At H3 scale the icosahedron's whole
    // triangle soup is 720 bytes, so the byte argument runs the other way and the reason to
    // keep deriving is provenance, not size.
    const payloads = H3_SOLIDS.map((s) => h3Payload(h3Polytope(s)));
    const total = payloads.reduce((sum, p) => sum + p.explicitGeometryBytes, 0);
    expect(total).toBeLessThan(2_177_280 / 100);
    const icosahedron = payloads.find((p) => p.solid === "icosahedron");
    expect(icosahedron?.explicitGeometryBytes).toBe(20 * 9 * 4);
    expect(icosahedron?.exactVertexBytes).toBe(12 * 48);
  });

  test.each([...H3_SOLIDS])("%s: the payload counts agree with the derived geometry", (solid) => {
    const polytope = h3Polytope(solid);
    const payload = h3Payload(polytope);
    expect(payload.vertices).toBe(polytope.fVector[0]);
    expect(payload.triangles).toBe(h3TrianglePositions(polytope).length / 9);
    expect(payload.explicitGeometryBytes).toBe(payload.triangles * 36);
  });
});
