import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { e8Roots } from "./clifford-e8-coxeter-projection.ts";
import { triangleFaces } from "./clifford-e8-face-lattice.ts";
import { buildScene } from "./clifford-e8-browser-scene.ts";
import {
  buildBvh,
  cameraFromRoot,
  intersectBruteForce,
  intersectBvh,
  intersectTriangle,
  MISS,
  pixelRay,
  seededRays,
  type Bvh,
  type Ray,
  type TraversalStats,
} from "./clifford-e8-raytrace.ts";
import {
  buildSbvh,
  bvhQuality,
  chopTriangleBounds,
  DEFAULT_ALPHA,
  intersectOrdered,
  orderedStack,
  subdivideTriangles,
} from "./clifford-e8-sbvh.ts";

const ROOTS = e8Roots();
const FACES = triangleFaces(ROOTS);
const SCENE = buildScene(0, ROOTS, FACES);
const P = SCENE.positions;

const MEDIAN = buildBvh(P);
const SAH = buildSbvh(P, { spatialSplits: false });
const SBVH = buildSbvh(P, { spatialSplits: true });

/** A small, hand-written scene: two axis-aligned triangles at known depths. */
function toyScene(): Float32Array {
  return Float32Array.from([
    // z = 1, a unit right triangle in the xy plane
    0, 0, 1, 1, 0, 1, 0, 1, 1,
    // z = 2, the same triangle further away
    0, 0, 2, 1, 0, 2, 0, 1, 2,
    // z = 3, offset in x so a ray down the z axis misses it
    5, 5, 3, 6, 5, 3, 5, 6, 3,
  ]);
}

describe("chopTriangleBounds — the operation that makes a spatial split tight", () => {
  const toy = toyScene();
  const out = new Float64Array(6);
  const wide = Float64Array.from([-9, -9, -9, 9, 9, 9]);

  it("clips a triangle's bounds to a slab, tighter than the triangle's own box", () => {
    // Triangle 0 spans x in [0,1]. Chop to x in [0, 0.25].
    expect(chopTriangleBounds(toy, 0, 0, 0, 0.25, wide, 0, out, 0)).toBe(true);
    expect(out[3]).toBeCloseTo(0.25, 12);
    // The chop is a POLYGON clip, so y shrinks too: at x <= 0.25 the hypotenuse y = 1 - x
    // never drops below 0.75, and the clipped piece cannot reach y = 1 anywhere x > 0.
    expect(out[4]).toBeCloseTo(1, 12);
    expect(out[1]).toBeCloseTo(0, 12);
    // A box-only clip would have kept x in [0, 0.25] and y in [0, 1] as well, so this
    // assertion alone does not separate the two. The next one does.
  });

  it("clips the FAR side to a genuinely smaller y extent than a box clip would", () => {
    // x in [0.75, 1]. The triangle there is the sliver near the vertex (1,0), so y <= 0.25.
    // A box clip would report y in [0, 1] — three times too large.
    expect(chopTriangleBounds(toy, 0, 0, 0.75, 1, wide, 0, out, 0)).toBe(true);
    expect(out[4]).toBeLessThan(0.2500001);
    expect(out[4]).toBeGreaterThan(0.2499999);
  });

  it("returns false for a slab the triangle does not reach", () => {
    expect(chopTriangleBounds(toy, 0, 0, 5, 6, wide, 0, out, 0)).toBe(false);
  });

  it("intersects with the reference box, so an earlier split's extent cannot come back", () => {
    // Reference already narrowed to y <= 0.5; chopping on x must not restore y up to 1.
    const narrowed = Float64Array.from([-9, -9, -9, 9, 0.5, 9]);
    expect(chopTriangleBounds(toy, 0, 0, 0, 0.25, narrowed, 0, out, 0)).toBe(true);
    expect(out[4]).toBeLessThanOrEqual(0.5);
  });
});

describe("the structures agree with brute force — the meter rung 7 kept", () => {
  const rays = seededRays(0x5eed, 240);

  const cases: Array<[string, Bvh, boolean]> = [
    ["median + rung 7 traversal", MEDIAN, false],
    ["median + ordered traversal", MEDIAN, true],
    ["SAH + rung 7 traversal", SAH, false],
    ["SAH + ordered traversal", SAH, true],
    ["SBVH + ordered traversal", SBVH, true],
    ["SBVH + rung 7 traversal", SBVH, false],
  ];

  for (const [label, bvh, ordered] of cases) {
    it(`${label} returns the same nearest hit as the exhaustive scan`, () => {
      const stack = orderedStack(bvh);
      const flat = new Int32Array(2 * (bvh.maxDepth + 2) + 8);
      let checked = 0;
      for (const ray of rays) {
        const truth = intersectBruteForce(P, ray);
        const got = ordered ? intersectOrdered(P, bvh, ray, undefined, stack) : intersectBvh(P, bvh, ray, undefined, flat);
        expect(got.triangle).toBe(truth.triangle);
        expect(got.t).toBe(truth.t);
        checked++;
      }
      // A vacuous pass would be 240 rays that all miss. They do not.
      expect(checked).toBe(240);
      const hits = rays.filter((r) => intersectBruteForce(P, r).triangle >= 0).length;
      expect(hits).toBeGreaterThan(40);
    });
  }
});

describe("the ordered traversal is the free 2.1x — and it is the TRAVERSAL, not the tree", () => {
  const camera = cameraFromRoot(0);
  const res = 24;
  const rays: Ray[] = [];
  for (let y = 0; y < res; y++) for (let x = 0; x < res; x++) rays.push(pixelRay(camera, res, res, x, y));

  function testsPerRay(bvh: Bvh, ordered: boolean): number {
    const stats: TraversalStats = { nodeTests: 0, triangleTests: 0 };
    const stack = orderedStack(bvh);
    const flat = new Int32Array(2 * (bvh.maxDepth + 2) + 8);
    for (const ray of rays) {
      if (ordered) intersectOrdered(P, bvh, ray, stats, stack);
      else intersectBvh(P, bvh, ray, stats, flat);
    }
    return stats.triangleTests / rays.length;
  }

  it("halves the triangle tests over the IDENTICAL median tree rung 7 shipped", () => {
    const before = testsPerRay(MEDIAN, false);
    const after = testsPerRay(MEDIAN, true);
    // Measured on an M2 Ultra at 64x64: 2,777 -> 1,319. The bound below is loose enough to
    // survive a different framing and tight enough that losing the distance cutoff fails it.
    //
    // **This assertion measures the CUTOFF, not the near/far ordering**, and saying so is the
    // point: a mutant that always descends the left child first survives this test (measured:
    // 1,600 tests/ray, still under before/1.6). The ordering is worth 1.21x on top and is
    // pinned by the hand-built scene below instead. A single number covering two mechanisms
    // is how one of them goes unfalsified.
    expect(before).toBeGreaterThan(1800);
    expect(after).toBeLessThan(before / 1.6);
  });

  it("the NEAR child is descended first — a hand-built scene where that is the whole cost", () => {
    // Two groups of eight triangles, one at z ~ 1 and one at z ~ 10, and a ray coming down
    // the z axis from z = 20. The build splits on z, so the group at z ~ 1 becomes the LEFT
    // child — and it is the FAR one for this ray. Descending near-first therefore means
    // descending RIGHT first, finding the hit at z ~ 10, and discarding the left subtree by
    // its entry distance. Descending left first tests both groups.
    const tris: number[] = [];
    for (let i = 0; i < 8; i++) {
      const z = 1 + i * 0.01;
      tris.push(-4, -4, z, 4, -4, z, 0, 4, z);
    }
    for (let i = 0; i < 8; i++) {
      const z = 10 + i * 0.01;
      tris.push(-4, -4, z, 4, -4, z, 0, 4, z);
    }
    const scene = Float32Array.from(tris);
    const bvh = buildSbvh(scene, { leafSize: 8, spatialSplits: false });
    // The premise: the build really did put the two groups in two leaves.
    expect(bvh.leafCount).toBe(2);
    const ray: Ray = { ox: 0, oy: 0, oz: 20, dx: 0, dy: 0, dz: -1 };
    const stats: TraversalStats = { nodeTests: 0, triangleTests: 0 };
    const hit = intersectOrdered(scene, bvh, ray, stats, orderedStack(bvh));
    // The near group is the one at z ~ 10.07 (the last of that group is nearest to z = 20).
    expect(hit.t).toBeCloseTo(20 - 10.07, 4);
    // Eight tests, not sixteen: the far leaf was never opened.
    expect(stats.triangleTests).toBe(8);
    // And the exhaustive scan agrees about the answer.
    expect(hit.triangle).toBe(intersectBruteForce(scene, ray).triangle);
  });

  it("rung 7's own defence is refuted: the nearest-hit answer set is ~1 triangle, not ~1000", () => {
    // Rung 7 argued 2,780 tests is "a small constant over the true answer" because a ray
    // meets ~1,000 triangles. It does. But a NEAREST-hit query's answer is the FIRST one.
    let crossings = 0;
    let atOrBeforeTheHit = 0;
    const sample = rays.filter((_, i) => i % 37 === 0);
    for (const ray of sample) {
      const nearest = intersectBruteForce(P, ray);
      for (let t = 0; t < SCENE.faceCount; t++) {
        const d = intersectTriangle(P, t, ray);
        if (d === Number.POSITIVE_INFINITY) continue;
        crossings++;
        if (d <= nearest.t) atOrBeforeTheHit++;
      }
    }
    const perRayCrossings = crossings / sample.length;
    const perRayAnswer = atOrBeforeTheHit / sample.length;
    // Rung 7's premise holds ...
    expect(perRayCrossings).toBeGreaterThan(300);
    // ... and its conclusion does not follow from it.
    expect(perRayAnswer).toBeLessThan(2);
  });
});

describe("the SBVH structure", () => {
  it("duplicates references and stays inside its budget", () => {
    expect(SBVH.referenceCount).toBeGreaterThan(SBVH.triangleCount);
    expect(SBVH.referenceCount).toBeLessThanOrEqual(SBVH.triangleCount * 3);
    expect(SBVH.spatialSplits).toBeGreaterThan(0);
  });

  it("with spatialSplits off it duplicates NOTHING — the controlled comparison", () => {
    expect(SAH.referenceCount).toBe(SAH.triangleCount);
    expect(SAH.spatialSplits).toBe(0);
  });

  it("every leaf reference names a real triangle and every triangle is reachable", () => {
    const seen = new Set<number>();
    for (let i = 0; i < SBVH.referenceCount; i++) {
      const t = SBVH.order[i]!;
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(SBVH.triangleCount);
      seen.add(t);
    }
    // A structure that lost a triangle would still agree with brute force on most rays.
    expect(seen.size).toBe(SBVH.triangleCount);
  });

  it("leaf ranges tile the reference array exactly — no gap, no overlap", () => {
    const covered = new Int32Array(SBVH.referenceCount);
    let leaves = 0;
    for (let n = 0; n < SBVH.nodeCount; n++) {
      const count = SBVH.nodes[n * 2 + 1]!;
      if (count < 0) continue;
      leaves++;
      const first = SBVH.nodes[n * 2]!;
      for (let i = first; i < first + count; i++) covered[i] = covered[i]! + 1;
    }
    expect(leaves).toBe(SBVH.leafCount);
    let uncovered = 0;
    let doubled = 0;
    for (const c of covered) {
      if (c === 0) uncovered++;
      if (c > 1) doubled++;
    }
    // This is the falsifier for the reference-shift bookkeeping: a stale right-child start
    // shows up here as an uncovered or doubly-covered slot long before it shows up as a
    // wrong pixel.
    expect(uncovered).toBe(0);
    expect(doubled).toBe(0);
  });

  it("no leaf is oversized — a rejected split must fall back to a split, never to a leaf", () => {
    // The falsifier for the defect found mid-build: when the spatial candidate fails its
    // no-progress guard, the code must fall back to the object split that was already costed.
    // An earlier version returned a leaf instead, producing leaves of hundreds of references
    // and a tracer SLOWER than the median-split baseline. Measured on the derived scene:
    // max leaf holds 26 references for the SBVH and 21 for the SAH build, against a leaf
    // size of 4 (nodes with no viable split legitimately exceed it, by a little).
    for (const [label, bvh] of [["SAH", SAH], ["SBVH", SBVH]] as const) {
      let maxLeaf = 0;
      for (let n = 0; n < bvh.nodeCount; n++) {
        const count = bvh.nodes[n * 2 + 1]!;
        if (count > maxLeaf) maxLeaf = count;
      }
      expect(`${label} ${maxLeaf <= 64}`).toBe(`${label} true`);
      // And the leaves must be numerous — a build that gave up would have few, fat ones.
      expect(bvh.leafCount).toBeGreaterThan(bvh.referenceCount / 8);
    }
  });

  it("every node's box contains its children's boxes", () => {
    function boxOf(bvh: Bvh, n: number): number[] {
      return [0, 1, 2, 3, 4, 5].map((k) => bvh.bounds[n * 6 + k]!);
    }
    let checked = 0;
    for (let n = 0; n < SBVH.nodeCount; n++) {
      if (SBVH.nodes[n * 2 + 1]! >= 0) continue;
      const parent = boxOf(SBVH, n);
      for (const child of [n + 1, SBVH.nodes[n * 2]!]) {
        const c = boxOf(SBVH, child);
        for (let k = 0; k < 3; k++) {
          expect(c[k]!).toBeGreaterThanOrEqual(parent[k]! - 1e-5);
          expect(c[k + 3]!).toBeLessThanOrEqual(parent[k + 3]! + 1e-5);
        }
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it("spatial splits buy a measurably tighter partition than object splits alone", () => {
    const sah = bvhQuality(SAH);
    const sbvh = bvhQuality(SBVH);
    // Both are catastrophic against a perfect partition of 1.0 — that is the object's fault,
    // and §Diagnosis in the rung 8 doc says so. What is measured here is that the spatial
    // split moves the number in the direction the paper predicts.
    expect(sbvh.leafAreaRatio).toBeLessThan(sah.leafAreaRatio);
    expect(sbvh.sahCost).toBeLessThan(sah.sahCost);
  });

  it("the median tree rung 7 shipped is the worst of the three by leaf-area ratio", () => {
    expect(bvhQuality(MEDIAN).leafAreaRatio).toBeGreaterThan(bvhQuality(SAH).leafAreaRatio);
    // And the absolute number is the diagnosis: a perfect partition is 1.0.
    expect(bvhQuality(MEDIAN).leafAreaRatio).toBeGreaterThan(1000);
  });

  it("alpha gates spatial splits — a huge alpha suppresses them entirely", () => {
    // A slice of the surface, because a full SBVH build is ~6 s and the suite's budget is 5.
    // The slice is 4,000 of the same triangles, so the geometry under test is unchanged.
    const slice = P.slice(0, 4000 * 9);
    const eager = buildSbvh(slice, { spatialSplits: true, alpha: 0 });
    const shy = buildSbvh(slice, { spatialSplits: true, alpha: DEFAULT_ALPHA * 1e9 });
    const off = buildSbvh(slice, { spatialSplits: false });
    expect(eager.spatialSplits).toBeGreaterThan(0);
    expect(shy.spatialSplits).toBeLessThan(eager.spatialSplits / 10);
    // A huge alpha does NOT reach zero, and the reason is stated rather than tuned away:
    // `overlapArea()` returns Infinity when no object split was found at all, so a node with
    // no viable object partition still tries a spatial one whatever alpha says. Measured: 4
    // such nodes in this slice. Only `spatialSplits: false` is the true off switch.
    expect(off.spatialSplits).toBe(0);
    expect(off.referenceCount).toBe(off.triangleCount);
  });
});

describe("the declared tie-break survives reference duplication", () => {
  it("a triangle reached through two references cannot beat itself", () => {
    // Find a ray that tests some triangle more than once under the SBVH.
    const rays = seededRays(0xd0d0, 60);
    let sawDuplicate = false;
    const stack = orderedStack(SBVH);
    for (const ray of rays) {
      const counts = new Map<number, number>();
      // Re-walk the traversal counting per-triangle visits.
      const walk = (node: number): void => {
        const count = SBVH.nodes[node * 2 + 1]!;
        const bounds = SBVH.bounds;
        const ix = 1 / ray.dx, iy = 1 / ray.dy, iz = 1 / ray.dz;
        const b = node * 6;
        let lo = Math.min((bounds[b]! - ray.ox) * ix, (bounds[b + 3]! - ray.ox) * ix);
        let hi = Math.max((bounds[b]! - ray.ox) * ix, (bounds[b + 3]! - ray.ox) * ix);
        lo = Math.max(lo, Math.min((bounds[b + 1]! - ray.oy) * iy, (bounds[b + 4]! - ray.oy) * iy));
        hi = Math.min(hi, Math.max((bounds[b + 1]! - ray.oy) * iy, (bounds[b + 4]! - ray.oy) * iy));
        lo = Math.max(lo, Math.min((bounds[b + 2]! - ray.oz) * iz, (bounds[b + 5]! - ray.oz) * iz));
        hi = Math.min(hi, Math.max((bounds[b + 2]! - ray.oz) * iz, (bounds[b + 5]! - ray.oz) * iz));
        if (hi < Math.max(lo, 0)) return;
        if (count < 0) {
          walk(node + 1);
          walk(SBVH.nodes[node * 2]!);
          return;
        }
        const first = SBVH.nodes[node * 2]!;
        for (let i = first; i < first + count; i++) {
          const t = SBVH.order[i]!;
          counts.set(t, (counts.get(t) ?? 0) + 1);
        }
      };
      walk(0);
      for (const c of counts.values()) if (c > 1) sawDuplicate = true;
      // Whatever the duplication, the answer must equal the exhaustive scan's.
      const truth = intersectBruteForce(P, ray);
      const got = intersectOrdered(P, SBVH, ray, undefined, stack);
      expect(got.triangle).toBe(truth.triangle);
      expect(got.t).toBe(truth.t);
    }
    // The premise of this test — that duplication actually happens — is itself asserted.
    expect(sawDuplicate).toBe(true);
  });

  it("the ordered traversal's cutoff is STRICT, so an exactly-tied subtree is still visited", () => {
    // Build a scene where two triangles sit at bit-identical depth, the lower-index one
    // deliberately placed so a >= cutoff would prune it.
    const tied = Float32Array.from([
      // triangle 0, z = 1
      -1, -1, 1, 1, -1, 1, 0, 1, 1,
      // triangle 1, same plane, same depth, offset so both contain the origin ray
      -1, -1, 1, 1, -1, 1, 0, 2, 1,
    ]);
    const bvh = buildSbvh(tied, { leafSize: 1 });
    const ray: Ray = { ox: 0, oy: 0, oz: -1, dx: 0, dy: 0, dz: 1 };
    const truth = intersectBruteForce(tied, ray);
    const got = intersectOrdered(tied, bvh, ray, undefined, orderedStack(bvh));
    expect(got.t).toBe(truth.t);
    expect(got.triangle).toBe(truth.triangle);
    // And the tie is real, not a coincidence of this assertion.
    expect(intersectTriangle(tied, 0, ray)).toBe(intersectTriangle(tied, 1, ray));
    expect(got.triangle).toBe(0);
  });
});

describe("subdivideTriangles — the cheaper rival, and its honest cost", () => {
  const tiny = toyScene();

  it("multiplies the triangle count by four and preserves the level per child", () => {
    const levels = Uint8Array.from([2, 2, 2, 3, 3, 3, 1, 1, 1]);
    const out = subdivideTriangles(tiny, levels, 1);
    expect(out.positions.length).toBe(tiny.length * 4);
    expect(out.levels.length).toBe(levels.length * 4);
    for (let k = 0; k < 4; k++) expect(out.levels[k * 3]).toBe(2);
    for (let k = 4; k < 8; k++) expect(out.levels[k * 3]).toBe(3);
    for (let k = 8; k < 12; k++) expect(out.levels[k * 3]).toBe(1);
  });

  it("preserves total area — the four children tile the parent", () => {
    function area(p: Float32Array): number {
      let sum = 0;
      for (let t = 0; t < p.length / 9; t++) {
        const b = t * 9;
        const e1 = [p[b + 3]! - p[b]!, p[b + 4]! - p[b + 1]!, p[b + 5]! - p[b + 2]!];
        const e2 = [p[b + 6]! - p[b]!, p[b + 7]! - p[b + 1]!, p[b + 8]! - p[b + 2]!];
        sum += 0.5 * Math.hypot(
          e1[1]! * e2[2]! - e1[2]! * e2[1]!,
          e1[2]! * e2[0]! - e1[0]! * e2[2]!,
          e1[0]! * e2[1]! - e1[1]! * e2[0]!,
        );
      }
      return sum;
    }
    const before = area(P);
    const after = area(subdivideTriangles(P, SCENE.levels, 1).positions);
    expect(after).toBeCloseTo(before, 1);
  });

  it("halves the mean primitive bounding box — the property it is bought for", () => {
    function meanBbox(p: Float32Array): number {
      let sum = 0;
      const n = p.length / 9;
      for (let t = 0; t < n; t++) {
        const b = t * 9;
        let lo = [Infinity, Infinity, Infinity];
        let hi = [-Infinity, -Infinity, -Infinity];
        for (let v = 0; v < 3; v++)
          for (let k = 0; k < 3; k++) {
            const x = p[b + v * 3 + k]!;
            if (x < lo[k]!) lo[k] = x;
            if (x > hi[k]!) hi[k] = x;
          }
        sum += Math.hypot(hi[0]! - lo[0]!, hi[1]! - lo[1]!, hi[2]! - lo[2]!);
      }
      return sum / n;
    }
    const before = meanBbox(P);
    const after = meanBbox(subdivideTriangles(P, SCENE.levels, 1).positions);
    expect(after).toBeLessThan(before * 0.55);
    expect(after).toBeGreaterThan(before * 0.45);
  });

  it("is NOT exact in float32 — and that is a property of the scene, not of subdivision", () => {
    // The children's vertices leave the parent's plane by ~1 float32 ulp, because a midpoint
    // is rounded on its way into a Float32Array. On a surface 738 layers deep that is enough
    // to change which of two near-coincident faces is nearest.
    const sub = subdivideTriangles(P, SCENE.levels, 1);
    let maxResidual = 0;
    for (let t = 0; t < 500; t++) {
      const b = t * 9;
      const a = [P[b]!, P[b + 1]!, P[b + 2]!];
      const e1 = [P[b + 3]! - a[0]!, P[b + 4]! - a[1]!, P[b + 5]! - a[2]!];
      const e2 = [P[b + 6]! - a[0]!, P[b + 7]! - a[1]!, P[b + 8]! - a[2]!];
      let n = [
        e1[1]! * e2[2]! - e1[2]! * e2[1]!,
        e1[2]! * e2[0]! - e1[0]! * e2[2]!,
        e1[0]! * e2[1]! - e1[1]! * e2[0]!,
      ];
      const len = Math.hypot(n[0]!, n[1]!, n[2]!);
      n = n.map((x) => x / len);
      for (let k = 0; k < 4; k++) {
        const cb = (t * 4 + k) * 9;
        for (let v = 0; v < 3; v++) {
          const d = Math.abs(
            (sub.positions[cb + v * 3]! - a[0]!) * n[0]! +
              (sub.positions[cb + v * 3 + 1]! - a[1]!) * n[1]! +
              (sub.positions[cb + v * 3 + 2]! - a[2]!) * n[2]!,
          );
          if (d > maxResidual) maxResidual = d;
        }
      }
    }
    // Non-zero, and at float32 ulp scale rather than at any larger scale.
    expect(maxResidual).toBeGreaterThan(0);
    expect(maxResidual).toBeLessThan(1e-6);
  });
});

describe("the SCENE is ill-conditioned, which is a different property from being deterministic", () => {
  const camera = cameraFromRoot(0);
  const res = 40;

  function render(positions: Float32Array, levels: Uint8Array): Uint8Array {
    const bvh = buildBvh(positions);
    const stack = new Int32Array(2 * (bvh.maxDepth + 2) + 8);
    const out = new Uint8Array(res * res).fill(MISS);
    for (let y = 0; y < res; y++)
      for (let x = 0; x < res; x++) {
        const h = intersectBvh(positions, bvh, pixelRay(camera, res, res, x, y), undefined, stack);
        if (h.triangle >= 0) out[y * res + x] = levels[h.triangle * 3] ?? MISS;
      }
    return out;
  }

  const base = render(P, SCENE.levels);

  it("CONTROL: re-rendering an identical buffer changes nothing", () => {
    const again = render(new Float32Array(P), SCENE.levels);
    let diff = 0;
    for (let i = 0; i < base.length; i++) if (base[i] !== again[i]) diff++;
    expect(diff).toBe(0);
  });

  it("a ONE-ULP perturbation of every coordinate changes ~2% of pixels", () => {
    const f = new Float32Array(1);
    const bits = new Int32Array(f.buffer);
    const nudged = new Float32Array(P.length);
    for (let i = 0; i < P.length; i++) {
      f[0] = P[i]!;
      if (f[0] !== 0) bits[0] = bits[0]! + (f[0]! > 0 ? 1 : -1);
      nudged[i] = f[0]!;
    }
    const after = render(nudged, SCENE.levels);
    let diff = 0;
    for (let i = 0; i < base.length; i++) if (base[i] !== after[i]) diff++;
    // Measured 2.40% at 128x128 on an M2 Ultra. The point is that it is neither 0 (the
    // tracer is not insensitive) nor large (the picture is not noise): the answer sits
    // within one ulp of a tie on a few percent of pixels, which is what a 738-layer surface
    // does to a nearest-hit query.
    expect(diff).toBeGreaterThan(base.length * 0.005);
    expect(diff).toBeLessThan(base.length * 0.1);
  });
});

describe("the module's own claims are checkable in its source", () => {
  const SOURCE = readFileSync(new URL("./clifford-e8-sbvh.ts", import.meta.url), "utf8");
  /**
   * A comment-stripped copy. A negative source assertion that reads the raw file can be
   * satisfied by the prose explaining why the thing is absent — which has now happened three
   * times in this repository, most recently in the rung 7 PR this rung extends.
   */
  const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

  it("the stripper keeps code and removes comments — the control for the assertions below", () => {
    expect(CODE).toContain("export function buildSbvh");
    expect(CODE).not.toContain("Stich, Friedrich & Dietrich");
    // And it must not have eaten the file.
    expect(CODE.length).toBeGreaterThan(SOURCE.length / 4);
  });

  it("the ordered traversal's cutoff is `>` and never `>=`", () => {
    // A `>=` here would prune an exactly-tied subtree and silently undo rung 7's tie-break.
    expect(CODE).toMatch(/stack\.dist\[top\]!\s*>\s*best/);
    expect(CODE).not.toMatch(/stack\.dist\[top\]!\s*>=\s*best/);
  });

  it("cites the paper it implements", () => {
    expect(SOURCE).toContain("Spatial Splits in Bounding Volume Hierarchies");
    expect(SOURCE).toContain("Sutherland");
  });
});
