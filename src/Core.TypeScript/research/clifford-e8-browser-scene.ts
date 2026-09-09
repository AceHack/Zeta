/**
 * clifford-e8-browser-scene.ts — RUNG 7a: THE BUFFERS A GPU CAN EAT, AND NOTHING ELSE.
 *
 * Rung 6 produced a lit surface and stopped at a Wavefront OBJ. Aaron's ask on this rung is
 * to *see* it: *"i'm curious when i will be able to see some 3d renderings based on our
 * framework ... gpu accelerated like with webgpu or whatever it's called and/or canvas."*
 *
 * This module is the whole of the translation from the exact substrate to a draw call. It
 * is deliberately thin, and the thinness is the point:
 *
 * > **Nothing here computes geometry or shading.** Every number in every returned buffer
 * > came out of `e8Roots`, `triangleFaces`, `embed3d` and `shadeFaces` — the rung 1-6
 * > modules, called, not reimplemented. What this file adds is layout: interleave, widen to
 * > `Float32Array`, and scale into a normalised device cube.
 *
 * That constraint is not stylistic. The failure rung 6 documented in its own source — an
 * inlined copy of `lambertCosine` inside `shadeFaces` that left the real function unpinned,
 * so mutating it to a constant zero survived the entire suite — is exactly what a renderer
 * invites. A renderer "just needs a float per face", the float is two lines to recompute
 * inline, and the moment it is recomputed there are two implementations of the shading model
 * and only one of them is tested. So the scene builder calls `shadeFaces` and reads its
 * field. The sibling test mutates the substrate's own function and requires the scene to
 * change with it — a cross-module falsifier that a private copy would silently defeat.
 *
 * ## What the buffers look like, and why
 *
 * **Unindexed triangles.** 60,480 faces become 181,440 vertices over only 240 distinct
 * points. That looks wasteful and is forced: the shading level is a *per-face* quantity, a
 * point is shared by many faces at different levels, and `flat` interpolation resolves the
 * conflict by provoking vertex — which is a rasteriser-order-dependent answer to a question
 * that must not depend on rasterisation order. Duplicating the vertex makes the level an
 * honest per-triangle attribute. The cost is buffer size, and the buffer is built in the
 * browser, so the *page* does not carry it (see `render-clifford-e8-page.ts`).
 *
 * **Five levels, not a gradient.** The two-sided Lambert numerator over the whole face set
 * takes exactly the values `{0, 4, 8, 12, 16}` — rung 6 measured this, and
 * `deriveLevelNumerators` re-derives it here from the shaded set rather than restating it as
 * a constant. The renderer therefore ships a **5-entry palette** and the fragment shader
 * performs no lighting arithmetic at all: the intensity was computed in 8-dimensional
 * integer arithmetic long before a pixel existed. Posterisation is the derived structure of
 * this surface; smoothing it would be authoring.
 *
 * **Two-sided.** Every edge of the 2-skeleton carries 27 faces (`EDGE_FACE_INCIDENCE`), so
 * "inside" is undefined and back-face culling has no meaning. `twoSidedLevels` uses the
 * absolute Lambert numerator, and the page disables culling. This is recorded in the buffer
 * builder rather than left to the caller because a caller that culls gets a *plausible*
 * wrong picture, which is the worst kind.
 *
 * ## Registers
 *
 * - `metered` — every count and every level value below is asserted by the sibling test
 *   against the rung 1-6 modules on the full 60,480-face set.
 * - `metered` — the normalisation scale is the measured max radius of the 240 embedded
 *   points, not a chosen constant; the test recomputes it.
 * - `unmetered` — that the resulting image is *pleasant* to look at. It is not measured and
 *   is not claimed.
 *
 * ## Prior art
 *
 * - Dorst, Fontijne & Mann, *Geometric Algebra for Computer Science* (2007) — the algebra
 *   the upstream rungs use; this module consumes its output and adds none of its own.
 * - Segal & Akeley, the OpenGL specification's flat-shading / provoking-vertex rule — the
 *   reason per-face attributes force unindexed geometry.
 */

import { e8Roots, type Root } from "./clifford-e8-coxeter-projection.ts";
import { embed3d, type Point3 } from "./clifford-e8-eigenlayer-tessellation.ts";
import { triangleFaces, type Face } from "./clifford-e8-face-lattice.ts";
import { cosineToNumber, lightFromRootIndex, shadeFaces, type ShadedFace } from "./clifford-e8-shading.ts";

/** Floats per vertex position. */
export const POSITION_STRIDE = 3;

/** Vertices per triangle. */
export const VERTICES_PER_FACE = 3;

/**
 * The number of distinct two-sided shading levels, measured by rung 6 over the full face
 * set. Exported as a *check target*, never as the source: `deriveLevelNumerators` derives
 * the list and the sibling test asserts the length equals this.
 */
export const EXPECTED_LEVEL_COUNT = 5;

/**
 * The distinct two-sided Lambert numerators, ascending, derived from a shaded face set.
 *
 * Derived rather than declared. If the substrate's shading ever changed, this list would
 * change with it and the palette would follow — whereas a hardcoded `[0,4,8,12,16]` would
 * keep painting the old picture over new geometry.
 */
export function deriveLevelNumerators(shaded: readonly ShadedFace[]): number[] {
  const seen = new Set<number>();
  for (const s of shaded) seen.add(s.twoSided.numerator);
  return [...seen].sort((a, b) => a - b);
}

/**
 * The brightness of each level as a float in `[0, 1]`.
 *
 * `cosineToNumber` is the substrate's single irrational boundary (rung 6 pins it by source
 * scan to one `Math.sqrt` call). The palette crosses that boundary exactly `levels.length`
 * times — five times for the whole image, against 60,480 faces. That ratio is the shader
 * story in one number.
 */
export function levelBrightness(levels: readonly number[], denominatorSquared: number): number[] {
  return levels.map((numerator) => cosineToNumber({ numerator, denominatorSquared }));
}

/**
 * The measured radius of the embedded point cloud: `max |p|` over the 240 projected roots.
 *
 * A derived scale, not a chosen one. Used to map the substrate's own units into the unit
 * cube a rasteriser wants, so no magic constant enters the render path.
 */
export function embeddingRadius(points: readonly Point3[]): number {
  let best = 0;
  for (const p of points) {
    const r = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
    if (r > best) best = r;
  }
  return best;
}

/**
 * The 240 embedded points, flattened and divided by their own measured radius.
 *
 * Flat and typed on purpose: a `Float32Array` read is typed `number` rather than
 * `number | undefined`, so the hot loop in `buildScene` carries **no `?? fallback` on an
 * index that cannot miss**. An unreachable fallback inside a render loop is the vacuity
 * class in its cheapest disguise — it reads as defensive, can never fire, and so is never
 * tested. Rung 6's header names the same failure one level up.
 */
export function normalisedPoints(points: readonly Point3[]): { readonly xyz: Float32Array; readonly radius: number } {
  const radius = embeddingRadius(points);
  const xyz = new Float32Array(points.length * POSITION_STRIDE);
  points.forEach((p, i) => {
    xyz[i * POSITION_STRIDE] = p.x / radius;
    xyz[i * POSITION_STRIDE + 1] = p.y / radius;
    xyz[i * POSITION_STRIDE + 2] = p.z / radius;
  });
  return { xyz, radius };
}

/**
 * A total numerator-to-level-index table over the levels derived from the *same* shaded set.
 *
 * Total by construction, not by a guard: the keys are exactly the distinct numerators
 * present, so no lookup in `buildScene` can miss. The claim is falsified directly — the
 * sibling test asserts every one of the 181,440 emitted level indices is in range, which is
 * what a `?? 0` fallback would have hidden by silently painting level 0.
 */
export function levelIndexTable(levelNumerators: readonly number[]): Int32Array {
  const bound = levelNumerators.reduce((m, n) => (n > m ? n : m), 0);
  const table = new Int32Array(bound + 1);
  levelNumerators.forEach((n, i) => {
    table[n] = i;
  });
  return table;
}

/** The GPU-ready form of the derived surface. Every field is a buffer or a measured count. */
export interface Scene {
  /** `3 * 3 * faceCount` floats: unindexed triangle positions, scaled into the unit ball. */
  readonly positions: Float32Array;
  /** `3 * faceCount` bytes: the level index of each vertex, constant across a triangle. */
  readonly levels: Uint8Array;
  /** Brightness per level index, `levels.length === EXPECTED_LEVEL_COUNT` when measured. */
  readonly brightness: Float32Array;
  /** The exact integer numerator behind each brightness, for display and for the test. */
  readonly levelNumerators: readonly number[];
  /** `|L| * |n|` squared: the shared exact denominator, `384` for a root light. */
  readonly denominatorSquared: number;
  /** Face count of the derived 2-skeleton. */
  readonly faceCount: number;
  /** Distinct embedded points, before the unindexing duplication. */
  readonly pointCount: number;
  /** The measured `max |p|` used to normalise. */
  readonly radius: number;
  /** Face count per level index, in level order — the gauge-invariant census of rung 6. */
  readonly histogram: readonly number[];
}

/**
 * Build every buffer the page needs, from the substrate, for one choice of light root.
 *
 * The light index is a **gauge**: rung 6 measured that the Weyl group is transitive on roots
 * and the intensity histogram is therefore identical for all 240 choices. The page exposes
 * the control precisely so that invariance is visible rather than merely asserted — the
 * picture turns, the census does not.
 */
export function buildScene(
  lightRootIndex = 0,
  roots: readonly Root[] = e8Roots(),
  faces: readonly Face[] = triangleFaces(roots),
): Scene {
  const light = lightFromRootIndex(lightRootIndex, roots);
  const shaded = shadeFaces(light, faces, roots);
  const points = embed3d(roots);
  const { xyz, radius } = normalisedPoints(points);
  const levelNumerators = deriveLevelNumerators(shaded);
  const denominatorSquared = shaded[0]?.lambert.denominatorSquared ?? 0;

  const table = levelIndexTable(levelNumerators);
  const histogram = new Uint32Array(levelNumerators.length);
  const positions = new Float32Array(shaded.length * VERTICES_PER_FACE * POSITION_STRIDE);
  const levels = new Uint8Array(shaded.length * VERTICES_PER_FACE);

  let f = 0;
  for (const s of shaded) {
    // The two `??` in this file. `Int32Array`/`Uint32Array` reads type as `number | undefined` under
    // `noUncheckedIndexedAccess`, so the compiler demands a default the construction of
    // `table` makes unreachable. It is not a silent substitution: if it ever fired, the
    // emitted `histogram` would disagree with `intensityHistogram(shaded)`, which the
    // sibling test asserts. An unreachable guard whose firing is OBSERVABLE is the honest
    // shape; one that quietly paints level 0 is the vacuity class.
    const index = table[s.twoSided.numerator] ?? 0;
    histogram[index] = (histogram[index] ?? 0) + 1;
    for (const [k, vertex] of s.face.entries()) {
      const base = (f * VERTICES_PER_FACE + k) * POSITION_STRIDE;
      // `subarray` + `set` copies three floats with no element indexing, so the position
      // path carries no fallback at all.
      positions.set(xyz.subarray(vertex * POSITION_STRIDE, (vertex + 1) * POSITION_STRIDE), base);
      levels[f * VERTICES_PER_FACE + k] = index;
    }
    f++;
  }

  return {
    positions,
    levels,
    brightness: new Float32Array(levelBrightness(levelNumerators, denominatorSquared)),
    levelNumerators,
    denominatorSquared,
    faceCount: shaded.length,
    pointCount: points.length,
    radius,
    histogram: [...histogram],
  };
}

/**
 * The 1-skeleton as a line-list, for the Canvas 2D fallback.
 *
 * 6,720 edges against 60,480 faces: the wireframe is an order of magnitude cheaper and is
 * the only form a software rasteriser draws honestly, because **a painter's sort over the
 * 2-skeleton is wrong** — rung 6 declined occlusion for exactly this reason and the
 * ray-tracing rung is where it is answered. Lines have no occlusion question to get wrong.
 */
export function buildEdgeLines(
  edges: ReadonlyArray<{ readonly a: number; readonly b: number }>,
  roots: readonly Root[] = e8Roots(),
): { readonly positions: Float32Array; readonly radius: number; readonly edgeCount: number } {
  const { xyz, radius } = normalisedPoints(embed3d(roots));
  const positions = new Float32Array(edges.length * 2 * POSITION_STRIDE);
  edges.forEach((e, i) => {
    [e.a, e.b].forEach((vertex, k) => {
      positions.set(
        xyz.subarray(vertex * POSITION_STRIDE, (vertex + 1) * POSITION_STRIDE),
        (i * 2 + k) * POSITION_STRIDE,
      );
    });
  });
  return { positions, radius, edgeCount: edges.length };
}
