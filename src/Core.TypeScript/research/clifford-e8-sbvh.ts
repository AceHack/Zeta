/**
 * clifford-e8-sbvh.ts — RUNG 8: THE 7.6x WAS A MEASUREMENT OF OUR BVH, NOT OF CPU RAY TRACING.
 *
 * Rung 7 shipped a CPU tracer over the derived 2-skeleton and concluded, in writing:
 *
 * > *"Is it fast on a CPU? No — measured, at 0.5 fps for 128² on one core."*
 *
 * with **2,780 triangle tests per ray** and a **7.6x** speedup over exhaustive scan, and it
 * defended those numbers like this:
 *
 * > *"A 7.6x speedup from a BVH is a bad speedup, and it is not the BVH's fault. With 738x
 * > overdraw a ray genuinely meets on the order of a thousand triangles; 2,780 tests to find
 * > them is a small constant over the true answer."*
 *
 * **That defence is a category error, and this module exists because measuring it refuted it.**
 * A ray does meet ~1,586 triangles here (measured below, and rung 7's estimate was good). But
 * a *nearest-hit* query does not have to find them. It has to find the FIRST one. The number
 * of triangles at-or-before the nearest hit is **0.49 per ray** — the answer set is one
 * triangle, not a thousand. Comparing 2,780 tests against the count of *all* crossings
 * measures the wrong query. Against the query actually being asked, 2,780 is not "a small
 * constant over the true answer"; it is roughly **5,700x** the true answer.
 *
 * ## What is actually wrong, in two separable parts (both measured, §Diagnosis in the doc)
 *
 * 1. **The traversal is not front-to-back.** `intersectBvh` pushes children in a fixed order
 *    and never sorts by entry distance, so `best` stays large for most of the descent and the
 *    `t > best` prune barely fires. Replaying the *same tree* with a distance-ordered
 *    traversal costs **1,205** tests/ray instead of 2,777 — a 2.3x factor that is pure
 *    traversal policy and involves no change to the structure at all.
 *
 * 2. **The tree cannot separate the primitives.** Sum of leaf bounding-box surface areas over
 *    the root's is **2,577** (a perfect partition is 1.0), and the mean leaf box is **40.5%**
 *    of the root diagonal. That is the object-partitioning failure mode exactly: the mean
 *    triangle bounding box is 29.3% of the scene diagonal, so *no* assignment of whole
 *    triangles to boxes can produce boxes that do not overlap almost everything.
 *
 * Part 2 is what **Stich, Friedrich & Dietrich**, *Spatial Splits in Bounding Volume
 * Hierarchies*, HPG 2009, is the canonical fix for. Their diagnosis is ours verbatim: object
 * partitioning fails when primitives are large relative to the leaves they must fit in,
 * because a bounding volume around a large primitive is mostly empty and mostly shared. Their
 * repair is to stop insisting that a primitive live in exactly one leaf — a reference may be
 * **split across the plane**, with each half clipped to its side, so the boxes get tight even
 * though the triangles stay big. This module implements that, and its cheaper rival.
 *
 * ## What is authored and what is derived
 *
 * **Everything in this file is authored.** A BVH is not a claim about E8; it is an index over
 * an answer computed elsewhere. `alpha`, the bin count, the leaf size and the split rule are
 * performance parameters, and the falsifiers in the sibling test assert that **none of them
 * can change which triangle is nearest** — every structure here is checked against
 * `intersectBruteForce`, which is the meter rung 7 was right to keep.
 *
 * ## The tie-break is preserved, and spatial splits make that non-trivial
 *
 * Rung 7 measured that ~1% of rays meet two triangles at bit-identical depth and declared
 * **ties go to the lowest triangle index**. Spatial splits make the same triangle appear in
 * several leaves, so a ray can test one triangle two or three times and see the same `t`
 * twice. The declared rule survives that unchanged — `d < best || (d === best && tri < hit)`
 * is false against a triangle already chosen, so a duplicate reference is idempotent, not a
 * tie-break hazard. Falsified rather than argued: `intersectOrdered` over the SBVH returns
 * the same `(triangle, t)` as brute force on every seeded ray, and a mutant that drops the
 * tie-break is killed.
 *
 * ## Registers
 *
 * - `metered` — every tests/ray and timing figure in the rung 8 doc, on named hardware, one
 *   thread, no SIMD. The point of excluding both is that the remaining factor is algorithmic.
 * - `metered` — nearest-hit agreement with brute force; the reference-containment invariant;
 *   node bounds containing their children.
 * - `unmetered` — anything about other hardware, other languages, or a vectorised inner loop.
 *
 * ## Prior art (Beacon)
 *
 * - **Stich, Friedrich & Dietrich**, *Spatial Splits in Bounding Volume Hierarchies*, High
 *   Performance Graphics 2009 — the SBVH: chopped binning, the `alpha` overlap criterion that
 *   decides when a spatial split is worth its duplication, and reference unsplitting.
 * - **Wald**, *On fast Construction of SAH-based Bounding Volume Hierarchies*, IEEE Symposium
 *   on Interactive Ray Tracing 2007 — binned SAH construction, the object-split half here.
 * - **Goldsmith & Salmon**, *Automatic Creation of Object Hierarchies for Ray Tracing*, IEEE
 *   CG&A 1987; **MacDonald & Booth**, *Heuristics for Ray Tracing Using Space Subdivision*,
 *   The Visual Computer 1990 — the surface-area heuristic itself. Rung 7 named these as the
 *   next step and did not take it; this module takes it and reports what it was worth.
 * - **Sutherland & Hodgman**, *Reentrant Polygon Clipping*, CACM 17(1), 1974 — the polygon
 *   clip used to compute a triangle's bounds inside a bin, which is what makes a spatial
 *   split tight rather than merely legal.
 * - **Pharr, Jakob & Humphreys**, *Physically Based Rendering* 4th ed., §4.3 — the ordered
 *   front-to-back traversal with the `t > best` cutoff that fixes part 1.
 * - **Möller & Trumbore** 1997 · **Williams, Barrus, Morley & Shirley** 2005 — reused from
 *   rung 7 unchanged; this module adds no new intersection arithmetic.
 */

import {
  intersectTriangle,
  type Bvh,
  type Hit,
  type Ray,
  type TraversalStats,
  NO_HIT,
} from "./clifford-e8-raytrace.ts";

/** Floats per triangle: three vertices of three floats. */
const TRIANGLE_FLOATS = 9;

/** Coordinates per vertex. */
const STRIDE = 3;

/** Default SAH bins per axis. Wald 2007 measures 8–32 as the useful range. */
export const DEFAULT_BIN_COUNT = 16;

/**
 * Stich et al.'s `alpha`: try a spatial split only when the object split's two children
 * overlap by more than `alpha` of the root's surface area. Their paper's value is 1e-5.
 */
export const DEFAULT_ALPHA = 1e-5;

/** Traversal cost relative to a triangle test, for the SAH. */
export const TRAVERSAL_COST = 1;

/** Triangle-test cost, for the SAH. */
export const INTERSECT_COST = 1;

/**
 * A hierarchy that may hold the same triangle in several leaves.
 *
 * Structurally a rung-7 `Bvh` plus two counts, so `intersectBvh` consumes it unchanged and
 * the two traversals can be compared over one structure. `order` is a list of **references**,
 * not a permutation: `referenceCount >= triangleCount`, with equality exactly when no spatial
 * split was taken.
 */
export interface SplitBvh extends Bvh {
  /** Entries in `order`. Exceeds `triangleCount` by the number of duplications. */
  readonly referenceCount: number;
  /** How many spatial splits the build chose over the best object split. */
  readonly spatialSplits: number;
  /** How many object splits the build chose. */
  readonly objectSplits: number;
}

/** Build parameters. All authored; none can change a nearest hit. */
export interface SbvhOptions {
  /** Maximum references in a leaf. */
  readonly leafSize?: number;
  /** SAH bins per axis. */
  readonly binCount?: number;
  /** Overlap threshold for attempting a spatial split; `0` attempts always. */
  readonly alpha?: number;
  /** `false` builds a pure binned-SAH object-split BVH — the rival this is measured against. */
  readonly spatialSplits?: boolean;
  /** Hard ceiling on `referenceCount / triangleCount`, so duplication cannot run away. */
  readonly maxReferenceFactor?: number;
  /**
   * Depth at which the build stops splitting and emits a leaf whatever the SAH says.
   *
   * Not cosmetic. A spatial split can *fail to make progress* — a reference that straddles
   * the plane lands on both sides, so a node of `n` references can produce children of `n`
   * and 1 — and recursing on that repeats forever with a slightly narrower box each time.
   * Measured before this cap existed: depth **553** and an 11-second build on the derived
   * scene. The cap and the no-progress guard below are what make the structure buildable.
   */
  readonly maxDepth?: number;
}

const DEFAULTS = {
  leafSize: 4,
  binCount: DEFAULT_BIN_COUNT,
  alpha: DEFAULT_ALPHA,
  spatialSplits: true,
  maxReferenceFactor: 3,
  maxDepth: 48,
} as const;

// ── bounds helpers ───────────────────────────────────────────────────────────

/** An axis-aligned box as six numbers: `minX minY minZ maxX maxY maxZ`. */
type Box = Float64Array;

function emptyBox(): Box {
  return Float64Array.from([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
}

function boxIsEmpty(b: Box, at = 0): boolean {
  return b[at]! > b[at + 3]! || b[at + 1]! > b[at + 4]! || b[at + 2]! > b[at + 5]!;
}

function boxSurfaceArea(b: ArrayLike<number>, at = 0): number {
  const dx = b[at + 3]! - b[at]!;
  const dy = b[at + 4]! - b[at + 1]!;
  const dz = b[at + 5]! - b[at + 2]!;
  if (dx < 0 || dy < 0 || dz < 0) return 0;
  return 2 * (dx * dy + dy * dz + dz * dx);
}

function growBox(target: Float64Array, at: number, source: ArrayLike<number>, from: number): void {
  for (let k = 0; k < 3; k++) {
    if (source[from + k]! < target[at + k]!) target[at + k] = source[from + k]!;
    if (source[from + 3 + k]! > target[at + 3 + k]!) target[at + 3 + k] = source[from + 3 + k]!;
  }
}

function resetBox(target: Float64Array, at: number): void {
  target[at] = Infinity;
  target[at + 1] = Infinity;
  target[at + 2] = Infinity;
  target[at + 3] = -Infinity;
  target[at + 4] = -Infinity;
  target[at + 5] = -Infinity;
}

/**
 * The bounding box of one triangle clipped to the slab `lo <= x[axis] <= hi`, intersected
 * with an existing reference box.
 *
 * Sutherland–Hodgman against two parallel planes. This is the operation that makes a spatial
 * split *tight*: clipping the reference's BOX to the slab would keep the full extent of the
 * triangle on the other two axes, and the resulting child boxes would overlap as badly as the
 * object split they were meant to beat. Clipping the POLYGON does not.
 *
 * Returns `false` and leaves `out` untouched when the clipped polygon is empty.
 */
/**
 * Clip scratch, hoisted to module scope.
 *
 * The chopped-binning pass calls this function `count * bins * 3` times per node — 2.9
 * million times at the root of the derived scene alone — and two `Float64Array(24)`
 * allocations per call dominated the build (measured: 5.3 s of an 11 s build). The function
 * is not reentrant as a result, which is stated rather than assumed: it is called only from
 * the single-threaded build below, and never recursively.
 */
const clipPolygon = new Float64Array(8 * 3);
const clipNext = new Float64Array(8 * 3);

export function chopTriangleBounds(
  positions: Float32Array,
  triangle: number,
  axis: number,
  lo: number,
  hi: number,
  refBox: ArrayLike<number>,
  refAt: number,
  out: Float64Array,
  outAt: number,
): boolean {
  // Six vertices is the maximum a triangle can have after two parallel-plane clips.
  const poly = clipPolygon;
  const next = clipNext;
  const base = triangle * TRIANGLE_FLOATS;
  for (let i = 0; i < 9; i++) poly[i] = positions[base + i]!;
  let count = 3;

  // Clip against `x[axis] >= lo`, then `x[axis] <= hi`.
  for (let pass = 0; pass < 2; pass++) {
    const plane = pass === 0 ? lo : hi;
    const keepAbove = pass === 0;
    let m = 0;
    for (let i = 0; i < count; i++) {
      const a = i * 3;
      const b = ((i + 1) % count) * 3;
      const va = poly[a + axis]!;
      const vb = poly[b + axis]!;
      const inA = keepAbove ? va >= plane : va <= plane;
      const inB = keepAbove ? vb >= plane : vb <= plane;
      if (inA) {
        next[m * 3] = poly[a]!;
        next[m * 3 + 1] = poly[a + 1]!;
        next[m * 3 + 2] = poly[a + 2]!;
        m++;
      }
      if (inA !== inB) {
        const denominator = vb - va;
        // `inA !== inB` puts `plane` strictly between `va` and `vb`, so `denominator` is
        // non-zero by construction; the guard is here because a NaN coordinate would make
        // both comparisons false and is a defect worth crashing on rather than smoothing.
        const s = denominator === 0 ? 0 : (plane - va) / denominator;
        for (let k = 0; k < 3; k++) next[m * 3 + k] = poly[a + k]! + s * (poly[b + k]! - poly[a + k]!);
        next[m * 3 + axis] = plane;
        m++;
      }
    }
    count = m;
    poly.set(next.subarray(0, m * 3));
    if (count === 0) return false;
  }

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < count; i++) {
    const x = poly[i * 3]!, y = poly[i * 3 + 1]!, z = poly[i * 3 + 2]!;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }
  // Intersect with the reference's own box: a reference is already a piece of a triangle, and
  // the chop must not resurrect extent an earlier split removed.
  minX = Math.max(minX, refBox[refAt]!);
  minY = Math.max(minY, refBox[refAt + 1]!);
  minZ = Math.max(minZ, refBox[refAt + 2]!);
  maxX = Math.min(maxX, refBox[refAt + 3]!);
  maxY = Math.min(maxY, refBox[refAt + 4]!);
  maxZ = Math.min(maxZ, refBox[refAt + 5]!);
  if (minX > maxX || minY > maxY || minZ > maxZ) return false;
  out[outAt] = minX;
  out[outAt + 1] = minY;
  out[outAt + 2] = minZ;
  out[outAt + 3] = maxX;
  out[outAt + 4] = maxY;
  out[outAt + 5] = maxZ;
  return true;
}

// ── the build ────────────────────────────────────────────────────────────────

/** A growable reference list: triangle index plus a clipped box. */
interface References {
  tri: Int32Array;
  box: Float64Array;
  count: number;
}

function ensureCapacity(refs: References, needed: number): void {
  if (needed <= refs.tri.length) return;
  let capacity = refs.tri.length * 2;
  while (capacity < needed) capacity *= 2;
  const tri = new Int32Array(capacity);
  tri.set(refs.tri);
  const box = new Float64Array(capacity * 6);
  box.set(refs.box);
  refs.tri = tri;
  refs.box = box;
}

/**
 * Build a bounding-volume hierarchy over unindexed triangles, with binned-SAH object splits
 * and (by default) Stich et al. spatial splits.
 *
 * With `spatialSplits: false` this is exactly the binned-SAH BVH rung 7 named and declined to
 * build, which makes the two settings a controlled comparison rather than two programs.
 */
export function buildSbvh(positions: Float32Array, options: SbvhOptions = {}): SplitBvh {
  const leafSize = options.leafSize ?? DEFAULTS.leafSize;
  const binCount = options.binCount ?? DEFAULTS.binCount;
  const alpha = options.alpha ?? DEFAULTS.alpha;
  const wantSpatial = options.spatialSplits ?? DEFAULTS.spatialSplits;
  const maxReferenceFactor = options.maxReferenceFactor ?? DEFAULTS.maxReferenceFactor;
  const depthCap = options.maxDepth ?? DEFAULTS.maxDepth;

  const triangleCount = Math.floor(positions.length / TRIANGLE_FLOATS);
  if (triangleCount === 0) {
    return {
      bounds: new Float32Array(0),
      nodes: new Int32Array(0),
      order: new Int32Array(0),
      nodeCount: 0,
      triangleCount: 0,
      leafCount: 0,
      maxDepth: 0,
      referenceCount: 0,
      spatialSplits: 0,
      objectSplits: 0,
    };
  }

  const maxReferences = Math.ceil(triangleCount * maxReferenceFactor);
  const refs: References = {
    tri: new Int32Array(Math.min(maxReferences, triangleCount * 2)),
    box: new Float64Array(Math.min(maxReferences, triangleCount * 2) * 6),
    count: triangleCount,
  };
  for (let t = 0; t < triangleCount; t++) {
    refs.tri[t] = t;
    const base = t * TRIANGLE_FLOATS;
    for (let k = 0; k < 3; k++) {
      let lo = Infinity;
      let hi = -Infinity;
      for (let v = 0; v < 3; v++) {
        const x = positions[base + v * STRIDE + k]!;
        if (x < lo) lo = x;
        if (x > hi) hi = x;
      }
      refs.box[t * 6 + k] = lo;
      refs.box[t * 6 + 3 + k] = hi;
    }
  }

  const rootBox = emptyBox();
  for (let i = 0; i < refs.count; i++) growBox(rootBox, 0, refs.box, i * 6);
  const rootArea = boxSurfaceArea(rootBox);

  // Node storage grows with the reference count, not the triangle count.
  let capacity = Math.max(4, 4 * triangleCount);
  let bounds = new Float32Array(capacity * 6);
  let nodes = new Int32Array(capacity * 2);
  let nodeCount = 0;
  let leafCount = 0;
  let maxDepth = 0;
  let spatialSplits = 0;
  let objectSplits = 0;

  const growNodes = (): void => {
    capacity *= 2;
    const nb = new Float32Array(capacity * 6);
    nb.set(bounds);
    bounds = nb;
    const nn = new Int32Array(capacity * 2);
    nn.set(nodes);
    nodes = nn;
  };

  // Scratch reused across bin passes: `binCount` boxes plus entry/exit counters.
  const binBox = new Float64Array(binCount * 6);
  const binCountsIn = new Int32Array(binCount);
  const binCountsOut = new Int32Array(binCount);
  const sweepCount = new Int32Array(binCount);
  const sweepArea = new Float64Array(binCount);
  const chopped = new Float64Array(6);
  /** The winning object-split axis's binning: `[lo, scale]`, so the partition below can
   * reproduce exactly the candidate the cost model scored. */
  const bestAxisBinning = new Float64Array(2);

  /**
   * Partition `refs.order[first .. first+count)` in place. Returns the pivot, or `-1` when no
   * split beat leaving the range as a leaf.
   *
   * `refs` is used as the working array directly: the build is depth-first and each recursion
   * owns a contiguous, disjoint range, so an in-place partition is safe — except for spatial
   * splits, which append duplicates at the range's end and shift nothing outside it.
   */
  const buildRange = (first: number, count: number, nodeBox: Float64Array, depth: number): number => {
    if (nodeCount + 2 >= capacity) growNodes();
    const node = nodeCount++;
    if (depth > maxDepth) maxDepth = depth;
    for (let k = 0; k < 6; k++) bounds[node * 6 + k] = nodeBox[k]!;

    const makeLeaf = (): number => {
      nodes[node * 2] = first;
      nodes[node * 2 + 1] = count;
      leafCount++;
      return node;
    };
    if (count <= leafSize || depth >= depthCap) return makeLeaf();

    const nodeArea = boxSurfaceArea(nodeBox);
    const leafCost = INTERSECT_COST * count;

    // ── best OBJECT split, binned SAH over reference-box centroids (Wald 2007) ──
    let bestAxis = -1;
    let bestBin = -1;
    let bestCost = leafCost;
    let bestLeft = emptyBox();
    let bestRight = emptyBox();
    let bestLeftCount = 0;

    for (let axis = 0; axis < 3; axis++) {
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = first; i < first + count; i++) {
        const c = 0.5 * (refs.box[i * 6 + axis]! + refs.box[i * 6 + 3 + axis]!);
        if (c < lo) lo = c;
        if (c > hi) hi = c;
      }
      if (!(hi > lo)) continue;
      const scale = binCount / (hi - lo);
      binCountsIn.fill(0);
      for (let b = 0; b < binCount; b++) resetBox(binBox, b * 6);
      for (let i = first; i < first + count; i++) {
        const c = 0.5 * (refs.box[i * 6 + axis]! + refs.box[i * 6 + 3 + axis]!);
        let b = Math.floor((c - lo) * scale);
        if (b < 0) b = 0;
        if (b >= binCount) b = binCount - 1;
        binCountsIn[b] = binCountsIn[b]! + 1;
        growBox(binBox, b * 6, refs.box, i * 6);
      }
      // Right-to-left sweep, then left-to-right, so each candidate plane is O(1).
      let running = 0;
      const suffixArea = sweepArea;
      const suffixCount = sweepCount;
      const acc = emptyBox();
      for (let b = binCount - 1; b >= 1; b--) {
        growBox(acc, 0, binBox, b * 6);
        running += binCountsIn[b]!;
        suffixArea[b] = boxSurfaceArea(acc);
        suffixCount[b] = running;
      }
      resetBox(acc, 0);
      let leftCount = 0;
      for (let b = 0; b < binCount - 1; b++) {
        growBox(acc, 0, binBox, b * 6);
        leftCount += binCountsIn[b]!;
        const rightCount = suffixCount[b + 1]!;
        if (leftCount === 0 || rightCount === 0) continue;
        const cost =
          TRAVERSAL_COST +
          (INTERSECT_COST * (boxSurfaceArea(acc) * leftCount + suffixArea[b + 1]! * rightCount)) / nodeArea;
        if (cost < bestCost) {
          bestCost = cost;
          bestAxis = axis;
          bestBin = b;
          bestLeftCount = leftCount;
          bestLeft = Float64Array.from(acc);
          // Recompute the right box exactly rather than carrying 16 suffix boxes.
          const rb = emptyBox();
          for (let q = b + 1; q < binCount; q++) growBox(rb, 0, binBox, q * 6);
          bestRight = rb;
        }
      }
      // Remember the axis's binning so the partition below can reproduce it.
      if (bestAxis === axis) {
        bestAxisBinning[0] = lo;
        bestAxisBinning[1] = scale;
      }
    }

    // ── best SPATIAL split, chopped binning (Stich et al. 2009) ──
    let spatialAxis = -1;
    let spatialBin = -1;
    let spatialCost = Infinity;
    let spatialLo = 0;
    let spatialScale = 0;

    const overlapArea = (): number => {
      if (bestAxis < 0) return Infinity;
      const o = emptyBox();
      for (let k = 0; k < 3; k++) {
        o[k] = Math.max(bestLeft[k]!, bestRight[k]!);
        o[k + 3] = Math.min(bestLeft[k + 3]!, bestRight[k + 3]!);
      }
      return boxIsEmpty(o) ? 0 : boxSurfaceArea(o);
    };

    const roomLeft = maxReferences - refs.count;
    if (wantSpatial && roomLeft > count && overlapArea() > alpha * rootArea) {
      for (let axis = 0; axis < 3; axis++) {
        const lo = nodeBox[axis]!;
        const hi = nodeBox[axis + 3]!;
        if (!(hi > lo)) continue;
        const scale = binCount / (hi - lo);
        binCountsIn.fill(0);
        binCountsOut.fill(0);
        for (let b = 0; b < binCount; b++) resetBox(binBox, b * 6);
        for (let i = first; i < first + count; i++) {
          let b0 = Math.floor((refs.box[i * 6 + axis]! - lo) * scale);
          let b1 = Math.floor((refs.box[i * 6 + 3 + axis]! - lo) * scale);
          if (b0 < 0) b0 = 0;
          if (b1 >= binCount) b1 = binCount - 1;
          if (b1 < b0) b1 = b0;
          binCountsIn[b0] = binCountsIn[b0]! + 1;
          binCountsOut[b1] = binCountsOut[b1]! + 1;
          for (let b = b0; b <= b1; b++) {
            const bl = lo + b / scale;
            const bh = lo + (b + 1) / scale;
            if (chopTriangleBounds(positions, refs.tri[i]!, axis, bl, bh, refs.box, i * 6, chopped, 0)) {
              growBox(binBox, b * 6, chopped, 0);
            }
          }
        }
        const acc = emptyBox();
        let running = 0;
        for (let b = binCount - 1; b >= 1; b--) {
          growBox(acc, 0, binBox, b * 6);
          running += binCountsOut[b]!;
          sweepArea[b] = boxSurfaceArea(acc);
          sweepCount[b] = running;
        }
        resetBox(acc, 0);
        let entering = 0;
        for (let b = 0; b < binCount - 1; b++) {
          growBox(acc, 0, binBox, b * 6);
          entering += binCountsIn[b]!;
          const rightCount = sweepCount[b + 1]!;
          if (entering === 0 || rightCount === 0) continue;
          if (entering + rightCount > count + roomLeft) continue;
          const cost =
            TRAVERSAL_COST +
            (INTERSECT_COST * (boxSurfaceArea(acc) * entering + sweepArea[b + 1]! * rightCount)) / nodeArea;
          if (cost < spatialCost) {
            spatialCost = cost;
            spatialAxis = axis;
            spatialBin = b;
            spatialLo = lo;
            spatialScale = scale;
          }
        }
      }
    }

    let useSpatial = spatialAxis >= 0 && spatialCost < bestCost;
    if (!useSpatial && bestAxis < 0) return makeLeaf();

    let pivot: number;
    const leftBox = emptyBox();
    const rightBox = emptyBox();
    let leftCount = 0;
    let rightCount = 0;
    let rightFirst = 0;

    // Two passes: classify, then emit. A reference straddling the plane is chopped into two
    // clipped references — this is the duplication the SBVH trades memory for. Classification
    // is done BEFORE the choice is final, because its outcome can retract the choice.
    const leftTri: number[] = [];
    const leftBoxOut: number[] = [];
    const rightTri: number[] = [];
    const rightBoxOut: number[] = [];

    if (useSpatial) {
      const plane = spatialLo + (spatialBin + 1) / spatialScale;
      const axis = spatialAxis;
      const out = new Float64Array(6);
      for (let i = first; i < first + count; i++) {
        const t = refs.tri[i]!;
        const rlo = refs.box[i * 6 + axis]!;
        const rhi = refs.box[i * 6 + 3 + axis]!;
        if (rhi <= plane) {
          leftTri.push(t);
          for (let k = 0; k < 6; k++) leftBoxOut.push(refs.box[i * 6 + k]!);
        } else if (rlo >= plane) {
          rightTri.push(t);
          for (let k = 0; k < 6; k++) rightBoxOut.push(refs.box[i * 6 + k]!);
        } else {
          if (chopTriangleBounds(positions, t, axis, -Infinity, plane, refs.box, i * 6, out, 0)) {
            leftTri.push(t);
            for (let k = 0; k < 6; k++) leftBoxOut.push(out[k]!);
          }
          if (chopTriangleBounds(positions, t, axis, plane, Infinity, refs.box, i * 6, out, 0)) {
            rightTri.push(t);
            for (let k = 0; k < 6; k++) rightBoxOut.push(out[k]!);
          }
        }
      }
      leftCount = leftTri.length;
      rightCount = rightTri.length;
      // No-progress guard. A spatial split that hands EVERY reference to one side has
      // partitioned nothing and would recurse on an identical set inside a slightly smaller
      // box — the mechanism behind the depth-553, 11-second build this replaced.
      //
      // **It falls back to the OBJECT split, never to a leaf.** The first version of this
      // guard returned `makeLeaf()`, which turned every no-progress spatial candidate into a
      // leaf of hundreds of references: measured 4,190 leaves, 2,897 triangle tests per ray —
      // *worse than the median-split baseline it was built to beat*. A guard against one bad
      // outcome must not abandon the good alternative that was already computed.
      if (leftCount === 0 || rightCount === 0 || (leftCount >= count && rightCount >= count)) {
        useSpatial = false;
      }
    }

    if (useSpatial) {
      spatialSplits++;
      const total = leftCount + rightCount;
      const extra = total - count;
      // Move everything after this range up by `extra` so the widened range stays contiguous.
      ensureCapacity(refs, refs.count + extra);
      const tailFrom = first + count;
      const tailLength = refs.count - tailFrom;
      if (extra > 0 && tailLength > 0) {
        refs.tri.copyWithin(tailFrom + extra, tailFrom, refs.count);
        refs.box.copyWithin((tailFrom + extra) * 6, tailFrom * 6, refs.count * 6);
      }
      refs.count += extra;
      for (let i = 0; i < leftCount; i++) {
        refs.tri[first + i] = leftTri[i]!;
        for (let k = 0; k < 6; k++) refs.box[(first + i) * 6 + k] = leftBoxOut[i * 6 + k]!;
      }
      for (let i = 0; i < rightCount; i++) {
        refs.tri[first + leftCount + i] = rightTri[i]!;
        for (let k = 0; k < 6; k++) refs.box[(first + leftCount + i) * 6 + k] = rightBoxOut[i * 6 + k]!;
      }
      pivot = first + leftCount;
      rightFirst = pivot;
      for (let i = first; i < pivot; i++) growBox(leftBox, 0, refs.box, i * 6);
      for (let i = pivot; i < pivot + rightCount; i++) growBox(rightBox, 0, refs.box, i * 6);
      count = total;
    } else {
      objectSplits++;
      const axis = bestAxis;
      const lo = bestAxisBinning[0]!;
      const scale = bestAxisBinning[1]!;
      let lower = first;
      let upper = first + count - 1;
      const swap = (a: number, b: number): void => {
        const t = refs.tri[a]!;
        refs.tri[a] = refs.tri[b]!;
        refs.tri[b] = t;
        for (let k = 0; k < 6; k++) {
          const v = refs.box[a * 6 + k]!;
          refs.box[a * 6 + k] = refs.box[b * 6 + k]!;
          refs.box[b * 6 + k] = v;
        }
      };
      while (lower <= upper) {
        const c = 0.5 * (refs.box[lower * 6 + axis]! + refs.box[lower * 6 + 3 + axis]!);
        let b = Math.floor((c - lo) * scale);
        if (b < 0) b = 0;
        if (b >= binCount) b = binCount - 1;
        if (b <= bestBin) lower++;
        else {
          swap(lower, upper);
          upper--;
        }
      }
      leftCount = lower - first;
      rightCount = count - leftCount;
      // The in-place partition must reproduce the binning pass that costed this candidate.
      // A disagreement means the split taken is not the split evaluated, which would make
      // the SAH number a fiction; the sibling test asserts the fallback never fires on the
      // derived scene, so it is a real guard rather than dead code.
      if (leftCount === 0 || rightCount === 0 || leftCount !== bestLeftCount) return makeLeaf();
      pivot = lower;
      rightFirst = pivot;
      for (let i = first; i < pivot; i++) growBox(leftBox, 0, refs.box, i * 6);
      for (let i = pivot; i < first + count; i++) growBox(rightBox, 0, refs.box, i * 6);
    }

    // A spatial split inside the LEFT subtree appends references into `refs` and shifts
    // everything after it up, so the right child's start recorded above goes stale by
    // exactly the number of references that subtree added. Measured rather than assumed:
    // insertions only ever happen inside the range being built, so the delta in `refs.count`
    // across the left recursion IS that shift.
    const beforeLeft = refs.count;
    buildRange(first, leftCount, leftBox, depth + 1);
    const shift = refs.count - beforeLeft;
    const right = buildRange(rightFirst + shift, rightCount, rightBox, depth + 1);
    nodes[node * 2] = right;
    nodes[node * 2 + 1] = -1;
    return node;
  };

  buildRange(0, refs.count, rootBox, 0);

  return {
    bounds: bounds.slice(0, nodeCount * 6),
    nodes: nodes.slice(0, nodeCount * 2),
    order: refs.tri.slice(0, refs.count),
    nodeCount,
    triangleCount,
    leafCount,
    maxDepth,
    referenceCount: refs.count,
    spatialSplits,
    objectSplits,
  };
}

// ── ordered traversal ────────────────────────────────────────────────────────

/** Reusable traversal scratch, so a render loop allocates nothing per ray. */
export interface OrderedStack {
  readonly node: Int32Array;
  readonly dist: Float64Array;
}

/** Allocate a traversal stack deep enough for `bvh`. */
export function orderedStack(bvh: Bvh): OrderedStack {
  const depth = 2 * (bvh.maxDepth + 2) + 8;
  return { node: new Int32Array(depth), dist: new Float64Array(depth) };
}

/** Entry distance of a node's box, or `Infinity` when the ray misses or enters beyond `limit`. */
function boxEntry(bounds: Float32Array, node: number, ray: Ray, limit: number): number {
  const ix = 1 / ray.dx;
  const iy = 1 / ray.dy;
  const iz = 1 / ray.dz;
  const b = node * 6;
  let t0 = (bounds[b]! - ray.ox) * ix;
  let t1 = (bounds[b + 3]! - ray.ox) * ix;
  let lo = Math.min(t0, t1);
  let hi = Math.max(t0, t1);
  t0 = (bounds[b + 1]! - ray.oy) * iy;
  t1 = (bounds[b + 4]! - ray.oy) * iy;
  lo = Math.max(lo, Math.min(t0, t1));
  hi = Math.min(hi, Math.max(t0, t1));
  t0 = (bounds[b + 2]! - ray.oz) * iz;
  t1 = (bounds[b + 5]! - ray.oz) * iz;
  lo = Math.max(lo, Math.min(t0, t1));
  hi = Math.min(hi, Math.max(t0, t1));
  const entry = Math.max(lo, 0);
  if (hi < entry || entry > limit) return Number.POSITIVE_INFINITY;
  return entry;
}

/**
 * Nearest hit by **front-to-back ordered** traversal with a `t > best` cutoff.
 *
 * The one behavioural difference from rung 7's `intersectBvh`: at an interior node both
 * children's entry distances are computed, the nearer is descended immediately and the
 * farther is stacked *with its distance*, so a stacked subtree is discarded outright when a
 * closer hit is found before it is popped. On a surface 738 layers deep that cutoff is the
 * whole game — the nearest hit is on the outer shell and everything behind it is provably
 * irrelevant the moment it is found.
 *
 * **The tie-break is preserved exactly**, and it constrains the cutoff. The discard test is
 * `dist > best`, strictly: a subtree whose box is entered at *exactly* `best` may still hold
 * a triangle at bit-identical depth with a lower index, and rung 7's declared rule says that
 * triangle wins. A `>=` there would be faster and would silently reintroduce the traversal-
 * order dependence the tie-break exists to remove.
 */
export function intersectOrdered(
  positions: Float32Array,
  bvh: Bvh,
  ray: Ray,
  stats?: TraversalStats,
  stack: OrderedStack = orderedStack(bvh),
): Hit {
  if (bvh.nodeCount === 0) return NO_HIT;
  let best = Number.POSITIVE_INFINITY;
  let hit = -1;
  let top = 0;
  let node = 0;
  if (stats !== undefined) stats.nodeTests++;
  if (boxEntry(bvh.bounds, 0, ray, best) === Number.POSITIVE_INFINITY) return NO_HIT;

  for (;;) {
    const count = bvh.nodes[node * 2 + 1]!;
    if (count < 0) {
      const left = node + 1;
      const right = bvh.nodes[node * 2]!;
      if (stats !== undefined) stats.nodeTests += 2;
      const dl = boxEntry(bvh.bounds, left, ray, best);
      const dr = boxEntry(bvh.bounds, right, ray, best);
      if (dl < Number.POSITIVE_INFINITY || dr < Number.POSITIVE_INFINITY) {
        if (dl <= dr) {
          if (dr < Number.POSITIVE_INFINITY) {
            stack.node[top] = right;
            stack.dist[top] = dr;
            top++;
          }
          node = left;
        } else {
          if (dl < Number.POSITIVE_INFINITY) {
            stack.node[top] = left;
            stack.dist[top] = dl;
            top++;
          }
          node = right;
        }
        continue;
      }
    } else {
      const first = bvh.nodes[node * 2]!;
      for (let i = first; i < first + count; i++) {
        const triangle = bvh.order[i]!;
        if (stats !== undefined) stats.triangleTests++;
        const d = intersectTriangle(positions, triangle, ray);
        // Rung 7's declared tie-break, unchanged. Under spatial splits the same triangle can
        // arrive here twice; `d === best && triangle < hit` is false against itself, so a
        // duplicate reference cannot flip an answer.
        if (d < best || (d === best && triangle < hit)) {
          best = d;
          hit = triangle;
        }
      }
    }
    // Pop the nearest still-relevant subtree. `>` and not `>=` — see the doc comment.
    for (;;) {
      if (top === 0) return hit < 0 ? NO_HIT : { triangle: hit, t: best };
      top--;
      if (stack.dist[top]! > best) continue;
      node = stack.node[top]!;
      break;
    }
  }
}

// ── the cheaper rival: subdivide the oversized triangles ─────────────────────

/**
 * Split every triangle into four by joining edge midpoints, `times` times over.
 *
 * The rival hypothesis to a spatial-split build: if the pathology is that primitives are large
 * relative to the scene, make them small and keep the plain object-split BVH. One subdivision
 * multiplies the triangle count by 4 and halves every edge, so the mean primitive bounding box
 * halves too. It changes the *surface not at all* — midpoint subdivision of a planar triangle
 * is exact, the union of the four children is the parent, so every ray meets the same surface
 * at the same depth and the level is inherited unchanged.
 *
 * Two costs it is measured against SBVH on: memory grows 4^times in the position buffer
 * (SBVH's grows by the duplication factor, measured near 1.2x), and the triangle test count is
 * not obviously reduced, because a ray crossing a big triangle also crosses one of its
 * children. What subdivision buys is *bounding-box locality*; what it does not buy is fewer
 * true crossings.
 *
 * The level buffer is expanded to match, so a subdivided scene renders identically.
 */
export function subdivideTriangles(
  positions: Float32Array,
  levels: Uint8Array,
  times = 1,
): { readonly positions: Float32Array; readonly levels: Uint8Array } {
  let p = positions;
  let l = levels;
  for (let pass = 0; pass < times; pass++) {
    const n = Math.floor(p.length / TRIANGLE_FLOATS);
    const out = new Float32Array(n * 4 * TRIANGLE_FLOATS);
    const outLevels = new Uint8Array(n * 4 * 3);
    for (let t = 0; t < n; t++) {
      const b = t * TRIANGLE_FLOATS;
      const a0 = p[b]!, a1 = p[b + 1]!, a2 = p[b + 2]!;
      const b0 = p[b + 3]!, b1 = p[b + 4]!, b2 = p[b + 5]!;
      const c0 = p[b + 6]!, c1 = p[b + 7]!, c2 = p[b + 8]!;
      const m0 = [(a0 + b0) / 2, (a1 + b1) / 2, (a2 + b2) / 2];
      const m1 = [(b0 + c0) / 2, (b1 + c1) / 2, (b2 + c2) / 2];
      const m2 = [(c0 + a0) / 2, (c1 + a1) / 2, (c2 + a2) / 2];
      const children: number[][] = [
        [a0, a1, a2, m0[0]!, m0[1]!, m0[2]!, m2[0]!, m2[1]!, m2[2]!],
        [m0[0]!, m0[1]!, m0[2]!, b0, b1, b2, m1[0]!, m1[1]!, m1[2]!],
        [m2[0]!, m2[1]!, m2[2]!, m1[0]!, m1[1]!, m1[2]!, c0, c1, c2],
        [m0[0]!, m0[1]!, m0[2]!, m1[0]!, m1[1]!, m1[2]!, m2[0]!, m2[1]!, m2[2]!],
      ];
      const level = l[t * 3]!;
      for (const [k, child] of children.entries()) {
        const dst = (t * 4 + k) * TRIANGLE_FLOATS;
        for (let i = 0; i < 9; i++) out[dst + i] = child[i]!;
        for (let v = 0; v < 3; v++) outLevels[(t * 4 + k) * 3 + v] = level;
      }
    }
    p = out;
    l = outLevels;
  }
  return { positions: p, levels: l };
}

// ── quality metrics, so "better tree" is a measurement ───────────────────────

/** Structural quality of a hierarchy, independent of any ray. */
export interface BvhQuality {
  /** SAH cost with `Ct = Ci = 1`, normalised by the root's surface area. */
  readonly sahCost: number;
  /** Sum of leaf box surface areas over the root's. `1` is a perfect, disjoint partition. */
  readonly leafAreaRatio: number;
  /** Mean leaf box diagonal as a fraction of the root's diagonal. */
  readonly meanLeafDiagonalFraction: number;
  readonly leafCount: number;
  readonly nodeCount: number;
  readonly maxDepth: number;
}

/** Measure a hierarchy's shape. Reads only `bounds` and `nodes`, so both builds qualify. */
export function bvhQuality(bvh: Bvh): BvhQuality {
  if (bvh.nodeCount === 0) {
    return { sahCost: 0, leafAreaRatio: 0, meanLeafDiagonalFraction: 0, leafCount: 0, nodeCount: 0, maxDepth: 0 };
  }
  const rootArea = boxSurfaceArea(bvh.bounds, 0);
  const rootDiagonal = Math.hypot(
    bvh.bounds[3]! - bvh.bounds[0]!,
    bvh.bounds[4]! - bvh.bounds[1]!,
    bvh.bounds[5]! - bvh.bounds[2]!,
  );
  let inner = 0;
  let leaf = 0;
  let leafArea = 0;
  let diagonal = 0;
  let leaves = 0;
  for (let n = 0; n < bvh.nodeCount; n++) {
    const count = bvh.nodes[n * 2 + 1]!;
    const relative = boxSurfaceArea(bvh.bounds, n * 6) / rootArea;
    if (count < 0) inner += TRAVERSAL_COST * relative;
    else {
      leaves++;
      leaf += INTERSECT_COST * relative * count;
      leafArea += relative;
      diagonal += Math.hypot(
        bvh.bounds[n * 6 + 3]! - bvh.bounds[n * 6]!,
        bvh.bounds[n * 6 + 4]! - bvh.bounds[n * 6 + 1]!,
        bvh.bounds[n * 6 + 5]! - bvh.bounds[n * 6 + 2]!,
      );
    }
  }
  return {
    sahCost: inner + leaf,
    leafAreaRatio: leafArea,
    meanLeafDiagonalFraction: leaves === 0 ? 0 : diagonal / leaves / rootDiagonal,
    leafCount: leaves,
    nodeCount: bvh.nodeCount,
    maxDepth: bvh.maxDepth,
  };
}
