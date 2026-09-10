import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { e8Roots, gossetEdges } from "./clifford-e8-coxeter-projection.ts";
import { embed3d } from "./clifford-e8-eigenlayer-tessellation.ts";
import { triangleFaces } from "./clifford-e8-face-lattice.ts";
import {
  buildEdgeLines,
  buildScene,
  deriveLevelNumerators,
  embeddingRadius,
  EXPECTED_LEVEL_COUNT,
  levelBrightness,
  levelIndexTable,
  normalisedPoints,
  POSITION_STRIDE,
  VERTICES_PER_FACE,
} from "./clifford-e8-browser-scene.ts";
import { cosineToNumber, intensityHistogram, lightFromRootIndex, shadeFaces } from "./clifford-e8-shading.ts";

const ROOTS = e8Roots();
const FACES = triangleFaces(ROOTS);
const POINTS = embed3d(ROOTS);
const SCENE = buildScene(0, ROOTS, FACES);

/** Rung 6's measured census, restated here so the buffer is judged against the substrate. */
const MEASURED_TWO_SIDED_CENSUS: ReadonlyArray<readonly [number, number]> = [
  [0, 11592],
  [4, 24192],
  [8, 15120],
  [12, 8064],
  [16, 1512],
];

describe("clifford-e8 browser scene — the buffers, judged against the substrate", () => {
  // ── FALSIFIER 1: SHAPE ────────────────────────────────────────────────────
  it("emits unindexed triangles at the derived face count", () => {
    expect(SCENE.faceCount).toBe(60480);
    expect(SCENE.faceCount).toBe(FACES.length);
    expect(SCENE.pointCount).toBe(240);
    expect(SCENE.positions.length).toBe(SCENE.faceCount * VERTICES_PER_FACE * POSITION_STRIDE);
    expect(SCENE.levels.length).toBe(SCENE.faceCount * VERTICES_PER_FACE);
  });

  // ── FALSIFIER 2: THE FIVE LEVELS ARE DERIVED, NOT DECLARED ────────────────
  it("derives exactly five two-sided levels and agrees with rung 6's census", () => {
    expect(SCENE.levelNumerators).toEqual([0, 4, 8, 12, 16]);
    expect(SCENE.levelNumerators.length).toBe(EXPECTED_LEVEL_COUNT);
    expect(SCENE.denominatorSquared).toBe(384);
    const census = [...intensityHistogram(shadeFaces(lightFromRootIndex(0, ROOTS), FACES, ROOTS)).entries()];
    expect(census).toEqual(MEASURED_TWO_SIDED_CENSUS.map((e) => [e[0], e[1]] as [number, number]));
    // The buffer's own histogram must be that census, in level order. This is the assertion
    // that would fail if the `?? 0` fallback in `buildScene` ever fired: a missed lookup
    // would credit level 0 and leave another level short.
    expect(SCENE.histogram).toEqual(MEASURED_TWO_SIDED_CENSUS.map((e) => e[1]));
    expect(SCENE.histogram.reduce((a, b) => a + b, 0)).toBe(SCENE.faceCount);
  });

  // ── FALSIFIER 3: TOTALITY OF THE LEVEL TABLE OVER ALL 181,440 VERTICES ────
  it("emits no level index outside the derived palette", () => {
    let max = -1;
    for (const level of SCENE.levels) if (level > max) max = level;
    expect(max).toBe(EXPECTED_LEVEL_COUNT - 1);
    for (const level of SCENE.levels) expect(level).toBeLessThan(SCENE.levelNumerators.length);
    const table = levelIndexTable([0, 4, 8, 12, 16]);
    expect([...table]).toEqual([0, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 4]);
  });

  // ── FALSIFIER 4: THE LEVEL IS PER-FACE, CONSTANT ACROSS ITS THREE VERTICES ─
  it("gives all three vertices of a triangle the same level", () => {
    for (let f = 0; f < SCENE.faceCount; f++) {
      const a = SCENE.levels[f * 3];
      expect(SCENE.levels[f * 3 + 1]).toBe(a);
      expect(SCENE.levels[f * 3 + 2]).toBe(a);
    }
  });

  // ── FALSIFIER 5: EVERY POSITION IS THE SUBSTRATE'S OWN EMBEDDING ──────────
  it("places all 181,440 vertices exactly where embed3d puts their root", () => {
    const radius = embeddingRadius(POINTS);
    let checked = 0;
    let worst = 0;
    for (let f = 0; f < SCENE.faceCount; f++) {
      const face = FACES[f];
      if (face === undefined) throw new Error("face list shorter than the scene");
      for (const [k, vertex] of face.entries()) {
        const p = POINTS[vertex];
        if (p === undefined) throw new Error("embedding shorter than the root list");
        const base = (f * VERTICES_PER_FACE + k) * POSITION_STRIDE;
        const dx = Math.abs((SCENE.positions[base] ?? 0) - Math.fround(p.x / radius));
        const dy = Math.abs((SCENE.positions[base + 1] ?? 0) - Math.fround(p.y / radius));
        const dz = Math.abs((SCENE.positions[base + 2] ?? 0) - Math.fround(p.z / radius));
        worst = Math.max(worst, dx, dy, dz);
        checked++;
      }
    }
    expect(checked).toBe(181440);
    // Exact: both sides are the same `Math.fround` of the same double.
    expect(worst).toBe(0);
  });

  // ── FALSIFIER 6: THE SCALE IS MEASURED, AND THE BALL IS UNIT ──────────────
  it("normalises by the measured max radius and touches the unit sphere", () => {
    expect(SCENE.radius).toBe(embeddingRadius(POINTS));
    expect(SCENE.radius).toBeGreaterThan(2.5);
    let maxNorm = 0;
    for (let i = 0; i < SCENE.positions.length; i += POSITION_STRIDE) {
      const x = SCENE.positions[i] ?? 0;
      const y = SCENE.positions[i + 1] ?? 0;
      const z = SCENE.positions[i + 2] ?? 0;
      maxNorm = Math.max(maxNorm, Math.sqrt(x * x + y * y + z * z));
    }
    expect(maxNorm).toBeGreaterThan(0.999);
    expect(maxNorm).toBeLessThanOrEqual(1.0000001);
    // Control: an unnormalised builder would have left the radius at ~2.55.
    expect(maxNorm).toBeLessThan(1.5);
    const { xyz, radius } = normalisedPoints(POINTS);
    expect(radius).toBe(SCENE.radius);
    expect(xyz.length).toBe(240 * POSITION_STRIDE);
  });

  // ── FALSIFIER 7: THE LIGHT GAUGE, AT THE BUFFER LEVEL ─────────────────────
  it("changes the picture and not the census when the light root changes", () => {
    let differing = 0;
    for (const rootIndex of [1, 7, 113, 239]) {
      const other = buildScene(rootIndex, ROOTS, FACES);
      // Rung 6's theorem: the Weyl group is transitive on roots, so the census is invariant.
      expect(other.levelNumerators).toEqual(SCENE.levelNumerators);
      expect(other.histogram).toEqual(SCENE.histogram);
      expect(other.positions).toEqual(SCENE.positions);
      // Control against a vacuous invariance: the per-face assignment MUST differ, or the
      // light is not reaching the buffer at all and the test above proves nothing.
      let changed = 0;
      for (let i = 0; i < other.levels.length; i++) if (other.levels[i] !== SCENE.levels[i]) changed++;
      expect(changed).toBeGreaterThan(1000);
      differing++;
    }
    expect(differing).toBe(4);
  });

  // ── FALSIFIER 8: THE PALETTE CROSSES THE IRRATIONAL BOUNDARY, ONCE PER LEVEL ─
  it("takes brightness from the substrate's single sqrt site", () => {
    const expected = SCENE.levelNumerators.map((numerator) =>
      cosineToNumber({ numerator, denominatorSquared: SCENE.denominatorSquared }),
    );
    expect([...SCENE.brightness]).toEqual(expected.map((v) => Math.fround(v)));
    expect(expected[0]).toBe(0);
    // 16 / sqrt(384) = 16 / (8 sqrt 6) = 2 / sqrt 6.
    expect(expected[4]).toBeCloseTo(2 / Math.sqrt(6), 15);
    expect(levelBrightness([16], 384)[0]).toBeCloseTo(0.816496580927726, 15);
  });

  // ── FALSIFIER 9: THE DERIVATION IS NOT A RESTATEMENT ──────────────────────
  it("derives the level list from a shaded set rather than from a constant", () => {
    const synthetic = shadeFaces(lightFromRootIndex(0, ROOTS), FACES.slice(0, 3), ROOTS);
    const levels = deriveLevelNumerators(synthetic);
    // A three-face slice cannot contain all five levels, so a hardcoded list would show up
    // here immediately. This is the mutant-catcher for `deriveLevelNumerators`.
    expect(levels.length).toBeLessThan(EXPECTED_LEVEL_COUNT);
    expect(levels.length).toBeGreaterThan(0);
    for (const l of levels) expect(SCENE.levelNumerators).toContain(l);
  });

  // ── FALSIFIER 10: THE 1-SKELETON PATH ─────────────────────────────────────
  it("builds the edge line list from the derived Gosset edges", () => {
    const edges = gossetEdges(ROOTS);
    expect(edges.length).toBe(6720);
    const lines = buildEdgeLines(edges, ROOTS);
    expect(lines.edgeCount).toBe(6720);
    expect(lines.positions.length).toBe(6720 * 2 * POSITION_STRIDE);
    expect(lines.radius).toBe(SCENE.radius);
    const { xyz } = normalisedPoints(POINTS);
    const first = edges[0];
    if (first === undefined) throw new Error("no edges");
    expect(lines.positions[0]).toBe(xyz[first.a * POSITION_STRIDE]);
    expect(lines.positions[3]).toBe(xyz[first.b * POSITION_STRIDE]);
  });

  // ── FALSIFIER 11: DST (§7) AND NONINTERFERENCE (§13) ──────────────────────
  it("replays identically and reaches for no ambient entropy", () => {
    const path = new URL("./clifford-e8-browser-scene.ts", import.meta.url).pathname;
    const source = readFileSync(path, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(source).not.toContain("Math.random(");
    expect(source).not.toContain("Date.now(");
    expect(source).not.toContain("performance.now(");
    expect(source).not.toContain("process.env");
    // The whole point of the module: it must not carry its own copy of the shading model.
    expect(source).not.toContain("faceNormal8d");
    expect(source).not.toContain("FACE_NORMAL_NORM_SQUARED");
    expect(source).toContain("shadeFaces(light, faces, roots)");
    // Control: the stripper did not eat the file.
    expect(source).toContain("export function buildScene");
    expect(source.length).toBeGreaterThan(2000);

    const again = buildScene(0, ROOTS, FACES);
    expect(again.positions).toEqual(SCENE.positions);
    expect(again.levels).toEqual(SCENE.levels);
    expect(again.histogram).toEqual(SCENE.histogram);
  });
});
