import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { e8Roots } from "./clifford-e8-coxeter-projection.ts";
import { triangleFaces } from "./clifford-e8-face-lattice.ts";
import { buildScene } from "./clifford-e8-browser-scene.ts";
import {
  buildBvh,
  cameraFromRoot,
  DEFAULT_HALF_WIDTH,
  DEFAULT_LEAF_SIZE,
  frameToText,
  intersectBruteForce,
  intersectBvh,
  intersectTriangle,
  MISS,
  NO_HIT,
  pixelRay,
  renderFrame,
  seededRays,
  triangleVertices,
  type Ray,
} from "./clifford-e8-raytrace.ts";

const ROOTS = e8Roots();
const FACES = triangleFaces(ROOTS);
const SCENE = buildScene(0, ROOTS, FACES);
const BVH = buildBvh(SCENE.positions);

/**
 * An independent ray/triangle oracle: solve for the plane crossing first, then express the
 * hit point in the triangle's own basis by Cramer's rule on the 2x2 Gram system. Shares no
 * line of arithmetic with Moller-Trumbore, so agreement between them is evidence rather than
 * a tautology (Knight-Leveson: correlated implementations agreeing proves nothing).
 */
function intersectReference(positions: Float32Array, triangle: number, ray: Ray): number {
  const v = triangleVertices(positions, triangle);
  const a = [v[0] ?? 0, v[1] ?? 0, v[2] ?? 0];
  const e1 = [(v[3] ?? 0) - a[0]!, (v[4] ?? 0) - a[1]!, (v[5] ?? 0) - a[2]!];
  const e2 = [(v[6] ?? 0) - a[0]!, (v[7] ?? 0) - a[1]!, (v[8] ?? 0) - a[2]!];
  const n = [
    e1[1]! * e2[2]! - e1[2]! * e2[1]!,
    e1[2]! * e2[0]! - e1[0]! * e2[2]!,
    e1[0]! * e2[1]! - e1[1]! * e2[0]!,
  ];
  const denom = n[0]! * ray.dx + n[1]! * ray.dy + n[2]! * ray.dz;
  if (Math.abs(denom) < 1e-15) return Number.POSITIVE_INFINITY;
  const w0 = [a[0]! - ray.ox, a[1]! - ray.oy, a[2]! - ray.oz];
  const t = (n[0]! * w0[0]! + n[1]! * w0[1]! + n[2]! * w0[2]!) / denom;
  if (t <= 0) return Number.POSITIVE_INFINITY;
  const p = [ray.ox + t * ray.dx - a[0]!, ray.oy + t * ray.dy - a[1]!, ray.oz + t * ray.dz - a[2]!];
  const d11 = e1[0]! * e1[0]! + e1[1]! * e1[1]! + e1[2]! * e1[2]!;
  const d12 = e1[0]! * e2[0]! + e1[1]! * e2[1]! + e1[2]! * e2[2]!;
  const d22 = e2[0]! * e2[0]! + e2[1]! * e2[1]! + e2[2]! * e2[2]!;
  const p1 = p[0]! * e1[0]! + p[1]! * e1[1]! + p[2]! * e1[2]!;
  const p2 = p[0]! * e2[0]! + p[1]! * e2[1]! + p[2]! * e2[2]!;
  const det = d11 * d22 - d12 * d12;
  const u = (p1 * d22 - p2 * d12) / det;
  const w = (p2 * d11 - p1 * d12) / det;
  if (u < 0 || w < 0 || u + w > 1) return Number.POSITIVE_INFINITY;
  return t;
}

describe("clifford-e8 ray tracing — nearest hit is the occlusion rung 6 declined", () => {
  // ── FALSIFIER 1: THE BVH PARTITIONS THE TRIANGLES, EXACTLY ONCE EACH ──────
  it("assigns every triangle to exactly one leaf", () => {
    expect(BVH.triangleCount).toBe(60480);
    const seen = new Uint8Array(BVH.triangleCount);
    for (const t of BVH.order) seen[t] = (seen[t] ?? 0) + 1;
    for (const count of seen) expect(count).toBe(1);

    let covered = 0;
    let leaves = 0;
    for (let node = 0; node < BVH.nodeCount; node++) {
      const count = BVH.nodes[node * 2 + 1] ?? -1;
      if (count < 0) continue;
      leaves++;
      covered += count;
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThanOrEqual(DEFAULT_LEAF_SIZE);
    }
    expect(covered).toBe(BVH.triangleCount);
    expect(leaves).toBe(BVH.leafCount);
    // A binary tree with L leaves has 2L-1 nodes; a mis-wired build breaks this identity.
    expect(BVH.nodeCount).toBe(2 * BVH.leafCount - 1);
  });

  // ── FALSIFIER 2: EVERY NODE'S BOX CONTAINS WHAT IT CLAIMS ─────────────────
  it("bounds every node over its own triangles and over its children", () => {
    const boxOfTriangles = (first: number, count: number): number[] => {
      const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      for (let i = first; i < first + count; i++) {
        const v = triangleVertices(SCENE.positions, BVH.order[i] ?? 0);
        for (let k = 0; k < 3; k++)
          for (let a = 0; a < 3; a++) {
            const c = v[k * 3 + a] ?? 0;
            if (c < (b[a] ?? 0)) b[a] = c;
            if (c > (b[a + 3] ?? 0)) b[a + 3] = c;
          }
      }
      return b;
    };
    // Leaves: the box is exactly the tight box of the triangles it owns.
    let checkedLeaves = 0;
    for (let node = 0; node < BVH.nodeCount; node++) {
      const count = BVH.nodes[node * 2 + 1] ?? -1;
      if (count < 0) continue;
      const tight = boxOfTriangles(BVH.nodes[node * 2] ?? 0, count);
      for (let a = 0; a < 6; a++) expect(BVH.bounds[node * 6 + a]).toBe(Math.fround(tight[a] ?? 0));
      checkedLeaves++;
    }
    expect(checkedLeaves).toBe(BVH.leafCount);

    // Interiors: the parent's box contains both children's boxes.
    let checkedInteriors = 0;
    for (let node = 0; node < BVH.nodeCount; node++) {
      const right = BVH.nodes[node * 2] ?? 0;
      if ((BVH.nodes[node * 2 + 1] ?? -1) >= 0) continue;
      for (const child of [node + 1, right]) {
        for (let a = 0; a < 3; a++) {
          expect(BVH.bounds[node * 6 + a] ?? 0).toBeLessThanOrEqual(BVH.bounds[child * 6 + a] ?? 0);
          expect(BVH.bounds[node * 6 + a + 3] ?? 0).toBeGreaterThanOrEqual(BVH.bounds[child * 6 + a + 3] ?? 0);
        }
      }
      checkedInteriors++;
    }
    expect(checkedInteriors).toBe(BVH.leafCount - 1);
  });

  // ── FALSIFIER 3: THE ACCELERATED ANSWER IS THE EXHAUSTIVE ANSWER ──────────
  it("returns the same nearest hit as brute force over seeded rays", () => {
    const rays = seededRays(0x5eed, 220);
    let hits = 0;
    let misses = 0;
    for (const ray of rays) {
      const brute = intersectBruteForce(SCENE.positions, ray);
      const fast = intersectBvh(SCENE.positions, BVH, ray);
      expect(fast.triangle).toBe(brute.triangle);
      expect(fast.t).toBe(brute.t);
      if (brute.triangle >= 0) hits++;
      else misses++;
    }
    // Controls. Agreement on an all-miss ray set would be vacuous, and so would agreement on
    // a set that never exercises the empty-stack path.
    expect(hits).toBeGreaterThan(60);
    expect(misses).toBeGreaterThan(5);
    expect(hits + misses).toBe(220);
  });

  // ── FALSIFIER 4: THE FOLD IS REAL, AND THE TIE-BREAK IS DECLARED ─────────
  it("measures the projection's exact-depth ties and resolves them by index", () => {
    const rays = seededRays(0x5eed, 220);
    let tied = 0;
    let tiedWithDifferentLevels = 0;
    for (const ray of rays) {
      const nearest = intersectBvh(SCENE.positions, BVH, ray);
      if (nearest.triangle < 0) continue;
      const atSameDepth: number[] = [];
      for (let t = 0; t < BVH.triangleCount; t++) {
        if (intersectTriangle(SCENE.positions, t, ray) === nearest.t) atSameDepth.push(t);
      }
      expect(atSameDepth.length).toBeGreaterThan(0);
      // The declared rule: the winner is the lowest index among the tied set.
      expect(nearest.triangle).toBe(Math.min(...atSameDepth));
      if (atSameDepth.length > 1) {
        tied++;
        const levels = new Set(atSameDepth.map((t) => SCENE.levels[t * 3]));
        if (levels.size > 1) tiedWithDifferentLevels++;
      }
    }
    // MEASURED, not assumed: `embed3d` folds 8 dimensions onto 3, so edge-adjacent faces
    // overlap and a ray meets both at bit-identical depth. A zero here would mean the fold
    // never bites and the tie-break is a rule with no cases — the vacuity class.
    expect(tied).toBeGreaterThan(0);
    expect(tied).toBeLessThan(rays.length / 4);
    // And the sharp half: a tie whose members disagree about brightness. This is the
    // ambiguity rung 6 declined to paper over, now located exactly.
    expect(tiedWithDifferentLevels).toBeGreaterThan(0);
  });

  // ── FALSIFIER 5: TWO INDEPENDENT TRIANGLE TESTS AGREE ─────────────────────
  it("agrees with a Cramer-rule oracle that shares no arithmetic", () => {
    const rays = seededRays(0xc0ffee, 40);
    let compared = 0;
    let agreed = 0;
    for (const ray of rays) {
      const brute = intersectBruteForce(SCENE.positions, ray);
      if (brute.triangle < 0) continue;
      // Compare on the winner and on a spread of other triangles, hits and misses alike.
      for (const triangle of [brute.triangle, 0, 1, 7, 999, 30000, 60479]) {
        const mt = intersectTriangle(SCENE.positions, triangle, ray);
        const ref = intersectReference(SCENE.positions, triangle, ray);
        compared++;
        if (Number.isFinite(mt) && Number.isFinite(ref)) {
          expect(Math.abs(mt - ref)).toBeLessThan(1e-9);
          agreed++;
        } else {
          expect(Number.isFinite(mt)).toBe(Number.isFinite(ref));
        }
      }
      expect(intersectTriangle(SCENE.positions, brute.triangle, ray)).toBe(brute.t);
    }
    expect(compared).toBeGreaterThan(100);
    // Control: the comparison must include real hits, or it only compares two ways of
    // returning Infinity.
    expect(agreed).toBeGreaterThan(20);
  });

  // ── FALSIFIER 6: TWO-SIDED, WHICH THIS GEOMETRY FORCES ────────────────────
  it("hits a triangle from both sides", () => {
    const v = triangleVertices(SCENE.positions, 0);
    const centre = [0, 1, 2].map((a) => (((v[a] ?? 0) + (v[a + 3] ?? 0) + (v[a + 6] ?? 0)) / 3));
    const e1 = [0, 1, 2].map((a) => (v[a + 3] ?? 0) - (v[a] ?? 0));
    const e2 = [0, 1, 2].map((a) => (v[a + 6] ?? 0) - (v[a] ?? 0));
    const n = [
      e1[1]! * e2[2]! - e1[2]! * e2[1]!,
      e1[2]! * e2[0]! - e1[0]! * e2[2]!,
      e1[0]! * e2[1]! - e1[1]! * e2[0]!,
    ];
    const front: Ray = {
      ox: centre[0]! + n[0]!,
      oy: centre[1]! + n[1]!,
      oz: centre[2]! + n[2]!,
      dx: -n[0]!,
      dy: -n[1]!,
      dz: -n[2]!,
    };
    const back: Ray = {
      ox: centre[0]! - n[0]!,
      oy: centre[1]! - n[1]!,
      oz: centre[2]! - n[2]!,
      dx: n[0]!,
      dy: n[1]!,
      dz: n[2]!,
    };
    // A back-face-culling implementation passes the first and fails the second, which is
    // exactly the defect that would silently delete half of a surface with no inside.
    expect(intersectTriangle(SCENE.positions, 0, front)).toBeCloseTo(1, 6);
    expect(intersectTriangle(SCENE.positions, 0, back)).toBeCloseTo(1, 6);
  });

  // ── FALSIFIER 7: THE FRAME IS AN IMAGE, NOT A BLANK ───────────────────────
  it("renders a deterministic frame that uses more than one derived level", () => {
    const camera = cameraFromRoot(0, 3, DEFAULT_HALF_WIDTH, ROOTS);
    const frame = renderFrame(SCENE.positions, SCENE.levels, BVH, camera, 48, 48);
    expect(frame.pixels.length).toBe(48 * 48);
    expect(frame.hits).toBeGreaterThan(400);
    expect(frame.hits).toBeLessThan(48 * 48);
    const used = new Set<number>([...frame.pixels]);
    used.delete(MISS);
    // Control against the vacuity that would make every other assertion here meaningless:
    // an image of one flat colour, or an image of nothing.
    expect(used.size).toBeGreaterThan(2);
    for (const level of used) expect(level).toBeLessThan(SCENE.levelNumerators.length);
    // The tracer must report levels the substrate produced, never invent one.
    const again = renderFrame(SCENE.positions, SCENE.levels, BVH, camera, 48, 48);
    expect(again.pixels).toEqual(frame.pixels);
    expect(again.stats).toEqual(frame.stats);
    const text = frameToText(frame);
    expect(text.split("\n").length).toBe(48);
    expect(text.trim().length).toBeGreaterThan(50);
  });

  // ── FALSIFIER 8: NEAREST MEANS NEAREST ────────────────────────────────────
  it("returns the minimum t over every triangle the ray meets", () => {
    const rays = seededRays(0xbeef, 24);
    let checkedRays = 0;
    let multiHitRays = 0;
    for (const ray of rays) {
      const fast = intersectBvh(SCENE.positions, BVH, ray);
      if (fast.triangle < 0) continue;
      let crossings = 0;
      let best = Number.POSITIVE_INFINITY;
      for (let t = 0; t < BVH.triangleCount; t++) {
        const d = intersectTriangle(SCENE.positions, t, ray);
        if (Number.isFinite(d)) crossings++;
        if (d < best) best = d;
      }
      expect(fast.t).toBe(best);
      checkedRays++;
      // The whole reason a painter's sort is wrong here: a ray crosses many layers.
      if (crossings > 1) multiHitRays++;
    }
    expect(checkedRays).toBeGreaterThan(5);
    expect(multiHitRays).toBe(checkedRays);
  });

  // ── FALSIFIER 9: THE CAMERA FRAME IS ORTHONORMAL FOR ALL 240 ROOTS ────────
  it("builds a well-conditioned frame from every root, and takes both axis branches", () => {
    let nearPole = 0;
    for (let index = 0; index < ROOTS.length; index++) {
      const c = cameraFromRoot(index, 3, DEFAULT_HALF_WIDTH, ROOTS);
      const dot = (a: readonly number[], b: readonly number[]): number =>
        (a[0] ?? 0) * (b[0] ?? 0) + (a[1] ?? 0) * (b[1] ?? 0) + (a[2] ?? 0) * (b[2] ?? 0);
      expect(dot(c.forward, c.forward)).toBeCloseTo(1, 12);
      expect(dot(c.right, c.right)).toBeCloseTo(1, 12);
      expect(dot(c.up, c.up)).toBeCloseTo(1, 12);
      expect(dot(c.forward, c.right)).toBeCloseTo(0, 12);
      expect(dot(c.forward, c.up)).toBeCloseTo(0, 12);
      expect(dot(c.right, c.up)).toBeCloseTo(0, 12);
      if (Math.abs(c.forward[1]) >= 0.9) nearPole++;
    }
    // Measured: the fallback axis is REACHED — some roots embed straight up the y axis, so
    // the branch is not a guard that can never fire.
    expect(nearPole).toBeGreaterThan(0);
    expect(nearPole).toBeLessThan(ROOTS.length);
    expect(() => cameraFromRoot(240, 3, DEFAULT_HALF_WIDTH, ROOTS)).toThrow("no root at index 240");
  });

  // ── FALSIFIER 10: THE IMAGE PLANE ──────────────────────────────────────────
  it("aims the centre pixel down the forward axis and the corners outward", () => {
    const camera = cameraFromRoot(3, 3, DEFAULT_HALF_WIDTH, ROOTS);
    const centre = pixelRay(camera, 64, 64, 32, 32);
    // Pixel centres straddle the axis on an even grid, so the centre ray is off by half a
    // pixel by construction rather than by accident.
    const dot =
      centre.dx * camera.forward[0] + centre.dy * camera.forward[1] + centre.dz * camera.forward[2];
    expect(dot).toBeCloseTo(1, 6);
    const corner = pixelRay(camera, 64, 64, 0, 0);
    const cornerDot =
      corner.dx * camera.forward[0] + corner.dy * camera.forward[1] + corner.dz * camera.forward[2];
    expect(cornerDot).toBeCloseTo(1, 6);
    const spread = Math.hypot(corner.dx - centre.dx, corner.dy - centre.dy, corner.dz - centre.dz);
    expect(spread).toBeGreaterThan(0.6);
    expect(NO_HIT.triangle).toBe(-1);
    expect(NO_HIT.t).toBe(Number.POSITIVE_INFINITY);
  });

  // ── FALSIFIER 11: DEGENERATE INPUT, AND THE EMPTY SCENE ───────────────────
  it("returns a miss on an empty scene rather than a wrong hit", () => {
    const empty = buildBvh(new Float32Array(0));
    expect(empty.nodeCount).toBe(0);
    expect(empty.triangleCount).toBe(0);
    expect(intersectBvh(new Float32Array(0), empty, seededRays(1, 1)[0] as Ray)).toEqual(NO_HIT);
    expect(intersectBruteForce(new Float32Array(0), seededRays(1, 1)[0] as Ray)).toEqual(NO_HIT);
    // A ray in the plane of a triangle must not register a hit.
    const v = triangleVertices(SCENE.positions, 5);
    const inPlane: Ray = {
      ox: v[0] ?? 0,
      oy: v[1] ?? 0,
      oz: v[2] ?? 0,
      dx: (v[3] ?? 0) - (v[0] ?? 0),
      dy: (v[4] ?? 0) - (v[1] ?? 0),
      dz: (v[5] ?? 0) - (v[2] ?? 0),
    };
    expect(intersectTriangle(SCENE.positions, 5, inPlane)).toBe(Number.POSITIVE_INFINITY);
  });

  // ── FALSIFIER 12: DST (§7) AND NONINTERFERENCE (§13) ──────────────────────
  it("draws its rays from a seed and no ambient entropy", () => {
    const path = new URL("./clifford-e8-raytrace.ts", import.meta.url).pathname;
    const source = readFileSync(path, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(source).not.toContain("Math.random(");
    expect(source).not.toContain("Date.now(");
    expect(source).not.toContain("performance.now(");
    expect(source).not.toContain("process.env");
    // The tracer must not recompute lighting: it looks a level up, it does not shade.
    expect(source).not.toContain("lambertCosine");
    expect(source).not.toContain("shadeFaces");
    expect(source).toContain("export function intersectTriangle");
    expect(source.length).toBeGreaterThan(3000);
    expect(seededRays(7, 5)).toEqual(seededRays(7, 5));
    expect(seededRays(7, 5)).not.toEqual(seededRays(8, 5));
    // A zero seed must still produce a usable stream rather than a constant one.
    const zero = seededRays(0, 4);
    expect(new Set(zero.map((r) => r.ox)).size).toBe(4);
    const rebuilt = buildBvh(SCENE.positions);
    expect(rebuilt.order).toEqual(BVH.order);
    expect(rebuilt.bounds).toEqual(BVH.bounds);
  });
});
