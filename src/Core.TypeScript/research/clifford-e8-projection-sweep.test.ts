import { describe, expect, it } from "bun:test";
import { e8Roots } from "./clifford-e8-coxeter-projection.ts";
import { triangleFaces } from "./clifford-e8-face-lattice.ts";
import { edgeFaceIncidence, EDGE_FACE_INCIDENCE } from "./clifford-e8-shading.ts";
import { embed3d, eigenLayers } from "./clifford-e8-eigenlayer-tessellation.ts";
import { buildScene } from "./clifford-e8-browser-scene.ts";
import {
  axisName,
  eigenlayerAxes,
  eigenlayerFrames,
  EIGENLAYER_AXIS_COUNT,
  measureProjection,
  projectFaces,
  randomOrthonormalFrame,
  SHIPPED_FRAME,
  spread,
  sweepEigenlayerFrames,
  sweepRandomFrames,
} from "./clifford-e8-projection-sweep.ts";

const ROOTS = e8Roots();
const FACES = triangleFaces(ROOTS);
const AXES = eigenlayerAxes();
const SWEEP = sweepEigenlayerFrames(ROOTS, FACES);

function dot(a: readonly number[], b: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}

describe("the eight eigenlayer axes are an orthonormal basis of R^8", () => {
  it("has eight of them", () => {
    expect(AXES.length).toBe(EIGENLAYER_AXIS_COUNT);
    expect(eigenLayers().length).toBe(4);
  });

  it("the full 8x8 Gram matrix is the identity — mutual orthogonality is MEASURED", () => {
    // The claim "different eigenlayers are orthogonal because their eigenvalues differ" is
    // true and is exactly the sort of claim that goes unchecked. Checked.
    let worstOffDiagonal = 0;
    let worstDiagonal = 0;
    for (let i = 0; i < AXES.length; i++) {
      for (let j = 0; j < AXES.length; j++) {
        const g = dot(AXES[i]!, AXES[j]!);
        if (i === j) worstDiagonal = Math.max(worstDiagonal, Math.abs(g - 1));
        else worstOffDiagonal = Math.max(worstOffDiagonal, Math.abs(g));
      }
    }
    expect(worstDiagonal).toBeLessThan(1e-9);
    expect(worstOffDiagonal).toBeLessThan(1e-9);
  });

  it("names them layer-then-axis", () => {
    expect(axisName(0)).toBe("L0a");
    expect(axisName(3)).toBe("L1b");
    expect(axisName(7)).toBe("L3b");
  });

  it("SHIPPED_FRAME really is what embed3d uses", () => {
    // Not asserted from the docstring: projected through the named frame, the positions must
    // equal `embed3d`'s own output up to the unit-ball normalisation.
    const viaFrame = projectFaces([AXES[SHIPPED_FRAME[0]]!, AXES[SHIPPED_FRAME[1]]!, AXES[SHIPPED_FRAME[2]]!], ROOTS, FACES);
    const points = embed3d(ROOTS);
    let radius = 0;
    for (const p of points) radius = Math.max(radius, Math.hypot(p.x, p.y, p.z));
    let worst = 0;
    for (const [f, face] of FACES.entries()) {
      for (let v = 0; v < 3; v++) {
        const p = points[face[v]!]!;
        worst = Math.max(
          worst,
          Math.abs(viaFrame[f * 9 + v * 3]! - p.x / radius),
          Math.abs(viaFrame[f * 9 + v * 3 + 1]! - p.y / radius),
          Math.abs(viaFrame[f * 9 + v * 3 + 2]! - p.z / radius),
        );
      }
    }
    expect(worst).toBeLessThan(1e-6);
  });
});

describe("the sweep — is 738 a property of the object or of embed3d?", () => {
  it("enumerates all C(8,3) = 56 frames, each a distinct triple", () => {
    const frames = eigenlayerFrames();
    expect(frames.length).toBe(56);
    expect(new Set(frames.map((f) => f.join(","))).size).toBe(56);
    for (const [i, j, k] of frames) expect(i < j && j < k).toBe(true);
  });

  it("reproduces rung 7's 738 for the shipped frame", () => {
    const shipped = SWEEP.find((r) => r.frame.join(",") === SHIPPED_FRAME.join(","))!;
    expect(shipped.measurement.overdraw).toBeGreaterThan(730);
    expect(shipped.measurement.overdraw).toBeLessThan(745);
    expect(shipped.measurement.meanBboxFraction).toBeGreaterThan(0.28);
    expect(shipped.measurement.meanBboxFraction).toBeLessThan(0.30);
  });

  it("THE NEGATIVE RESULT: no eigenlayer frame escapes the pathology", () => {
    const overdraw = spread(SWEEP.map((r) => r.measurement.overdraw));
    // Every frame is in the high hundreds. A BVH would need this near 1.
    expect(overdraw.min).toBeGreaterThan(500);
    // And the whole family spans well under a factor of two.
    expect(overdraw.ratio).toBeLessThan(1.5);
    const bbox = spread(SWEEP.map((r) => r.measurement.meanBboxFraction));
    // The primitive-size number, which is the one a BVH actually cares about, is flatter still.
    expect(bbox.min).toBeGreaterThan(0.25);
    expect(bbox.max).toBeLessThan(0.31);
  });

  it("the shipped frame is unremarkable — neither the best nor the worst", () => {
    const sorted = [...SWEEP].sort((a, b) => a.measurement.overdraw - b.measurement.overdraw);
    const rank = sorted.findIndex((r) => r.frame.join(",") === SHIPPED_FRAME.join(","));
    expect(rank).toBeGreaterThan(4);
    expect(rank).toBeLessThan(51);
  });

  it("the frames that score LOWEST do so by collapsing faces, not by spreading them", () => {
    const sorted = [...SWEEP].sort((a, b) => a.measurement.overdraw - b.measurement.overdraw);
    const best = sorted[0]!;
    // Their apparent win is degeneracy: a ninth of the surface projects to zero area.
    expect(best.measurement.degenerateFaces).toBeGreaterThan(FACES.length / 20);
    // The shipped frame collapses nothing.
    const shipped = SWEEP.find((r) => r.frame.join(",") === SHIPPED_FRAME.join(","))!;
    expect(shipped.measurement.degenerateFaces).toBe(0);
  });

  it("random orthonormal frames land in the same narrow band — concentration, not luck", () => {
    const random = sweepRandomFrames(12, 0x1234567, ROOTS, FACES);
    const overdraw = spread(random.map((m) => m.overdraw));
    expect(overdraw.min).toBeGreaterThan(500);
    expect(overdraw.max).toBeLessThan(900);
    expect(overdraw.ratio).toBeLessThan(1.5);
  });

  it("the random frames really are orthonormal, and really are different from each other", () => {
    const a = randomOrthonormalFrame(1);
    const b = randomOrthonormalFrame(2);
    for (const frame of [a, b]) {
      expect(frame.length).toBe(3);
      for (let i = 0; i < 3; i++) {
        expect(dot(frame[i]!, frame[i]!)).toBeCloseTo(1, 10);
        for (let j = i + 1; j < 3; j++) expect(Math.abs(dot(frame[i]!, frame[j]!))).toBeLessThan(1e-10);
      }
    }
    // A generator that ignored its seed would make the sweep a single sample repeated.
    expect(Math.abs(dot(a[0]!, b[0]!))).toBeLessThan(0.999);
  });

  it("is seeded — the same seed gives byte-identical frames", () => {
    expect(randomOrthonormalFrame(99)).toEqual(randomOrthonormalFrame(99));
  });
});

describe("what is intrinsic and what is projection-induced", () => {
  it("27 faces on every edge is an 8D COMBINATORIAL fact — no projection is involved", () => {
    // `edgeFaceIncidence` takes the face list and nothing else: no coordinates, no embedding,
    // no eigenlayers. So the number cannot be an artifact of any 3D map.
    const incidence = edgeFaceIncidence(FACES);
    expect(incidence.min).toBe(EDGE_FACE_INCIDENCE);
    expect(incidence.max).toBe(EDGE_FACE_INCIDENCE);
    expect(incidence.edges).toBe(6720);
  });

  it("the projection does NOT collapse faces onto each other — all 60,480 centroids stay distinct", () => {
    const points = embed3d(ROOTS);
    const seen = new Set<string>();
    for (const face of FACES) {
      const a = points[face[0]!]!, b = points[face[1]!]!, c = points[face[2]!]!;
      seen.add(
        `${((a.x + b.x + c.x) / 3).toFixed(9)},${((a.y + b.y + c.y) / 3).toFixed(9)},${((a.z + b.z + c.z) / 3).toFixed(9)}`,
      );
    }
    // The crowding is overlap of large triangles, not coincidence of position. Saying "the
    // projection folds" without this measurement would have implied the latter.
    expect(seen.size).toBe(FACES.length);
  });

  it("embed3d is LINEAR, which is what makes midpoint subdivision exact in exact arithmetic", () => {
    // Rung 5's claim, re-checked here because the subdivision rival in the sibling module
    // depends on it: proj is linear, so proj(midpoint) = midpoint(proj).
    const points = embed3d(ROOTS);
    const l0 = eigenLayers()[0]!;
    const l1 = eigenLayers()[1]!;
    let worst = 0;
    for (let i = 0; i < 40; i++) {
      const a = ROOTS[i]!;
      const b = ROOTS[(i * 7 + 13) % ROOTS.length]!;
      const mid = a.map((x, k) => (x + b[k]!) / 2);
      const projectedMid = { x: dot(mid, l0.e1), y: dot(mid, l0.e2), z: dot(mid, l1.e1) };
      const pa = points[i]!;
      const pb = points[(i * 7 + 13) % ROOTS.length]!;
      worst = Math.max(
        worst,
        Math.abs(projectedMid.x - (pa.x + pb.x) / 2),
        Math.abs(projectedMid.y - (pa.y + pb.y) / 2),
        Math.abs(projectedMid.z - (pa.z + pb.z) / 2),
      );
    }
    expect(worst).toBeLessThan(1e-12);
  });

  it("CONTROL: measureProjection returns the ANALYTIC answer on a scene computed by hand", () => {
    // If `measureProjection` reported a constant, every assertion above would be vacuous. So
    // it is checked against a scene whose area and boxes are known without it: two right
    // triangles of unit legs, area 1/2 each, spanning a 1x1x1 box.
    const hand = Float32Array.from([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 0, 1, 1]);
    const m = measureProjection(hand);
    expect(m.totalArea).toBeCloseTo(1, 10);
    expect(m.overdraw).toBeCloseTo(1 / (4 * Math.PI), 10);
    expect(m.sceneDiagonal).toBeCloseTo(Math.sqrt(3), 6);
    // Each triangle's own box is 1x1x0, diagonal sqrt(2), so the fraction is sqrt(2)/sqrt(3).
    expect(m.meanBboxFraction).toBeCloseTo(Math.SQRT2 / Math.sqrt(3), 6);
    expect(m.degenerateFaces).toBe(0);
  });

  it("CONTROL: it discriminates between frames — the 56 do not all score the same", () => {
    const overdraw = spread(SWEEP.map((r) => r.measurement.overdraw));
    expect(overdraw.max - overdraw.min).toBeGreaterThan(100);
  });

  it("a SQUASHED frame scores LOWER, not higher — so overdraw is not a quality score", () => {
    // Recorded because it is counter-intuitive, and because it explains the "lowest scorers
    // collapse faces" result above. Flattening the third axis destroys triangle AREA faster
    // than it shrinks the containing ball, so a near-2D map reports a BETTER overdraw while
    // showing strictly less of the object. Overdraw compares projections that keep the
    // surface; on its own it rewards throwing the surface away.
    //
    // Note it does this WITHOUT tripping the degenerate-face counter — the areas shrink by a
    // large factor and still sit above `DEGENERATE_AREA`. A first draft of this test asserted
    // degeneracy here and was wrong; the two mechanisms are separate, and the collapse
    // mechanism is checked on the real minimisers above.
    const squashed = [AXES[0]!, AXES[1]!, AXES[0]!.map((x, i) => 0.999 * x + 0.001 * AXES[2]![i]!)];
    const flat = measureProjection(projectFaces(squashed, ROOTS, FACES));
    const shipped = SWEEP.find((r) => r.frame.join(",") === SHIPPED_FRAME.join(","))!;
    expect(flat.overdraw).toBeLessThan(shipped.measurement.overdraw / 2);
    expect(flat.totalArea).toBeLessThan(shipped.measurement.totalArea / 2);
  });

  it("CONTROL: the unit-ball normalisation makes overdraw scale-invariant", () => {
    // Doubling the frame's length must not change the answer, or the sweep would be
    // comparing scales rather than shapes.
    const doubled = SHIPPED_FRAME.map((i) => AXES[i]!.map((x) => 2 * x));
    const a = measureProjection(projectFaces(SHIPPED_FRAME.map((i) => AXES[i]!), ROOTS, FACES));
    const b = measureProjection(projectFaces(doubled, ROOTS, FACES));
    expect(b.overdraw).toBeCloseTo(a.overdraw, 3);
  });
});

describe("the sweep's numbers connect to the shipped scene", () => {
  it("the scene the tracer renders has the shipped frame's overdraw", () => {
    const scene = buildScene(0, ROOTS, FACES);
    const measured = measureProjection(scene.positions);
    const shipped = SWEEP.find((r) => r.frame.join(",") === SHIPPED_FRAME.join(","))!;
    // Same object, two independent paths to it: `buildScene` normalises by `embeddingRadius`
    // and this module by its own max-radius pass. Agreement is a cross-check, not a tautology.
    expect(measured.overdraw).toBeCloseTo(shipped.measurement.overdraw, 0);
    expect(measured.meanBboxFraction).toBeCloseTo(shipped.measurement.meanBboxFraction, 3);
  });
});
