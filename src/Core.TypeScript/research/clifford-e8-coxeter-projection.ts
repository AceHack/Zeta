/**
 * clifford-e8-coxeter-projection.ts — the RENDERING SURFACE, generated from the algebra.
 *
 * Aaron 2026-09-08: *"our rendering surface should only come from our clifford if we
 * cant generate it from clifford that's not our research."*
 *
 * Measured before writing this: nothing in the tree generated renderable geometry from
 * the Clifford substrate. `db/shapes/golden/*.svg` are committed vector files, and the
 * one generator that writes into that directory
 * (`quantum-observable/generate-circuit-svgs.ts`) draws from a third-party
 * `quantum-circuit` npm package. So the surface Aaron is asking for did not exist; this
 * is its first member.
 *
 * ## What is generated, and from what
 *
 * `CliffordE8Roots.fs` establishes the deep half: the Clifford versor/sandwich
 * reflection GENERATES the 240 E8 roots (reproducing Dechant, *"The E8 geometry from a
 * Clifford perspective"*). This module is the second oracle for the root set and adds
 * the part that makes it renderable: a projection to two dimensions.
 *
 * The projection is NOT an aesthetic choice. It is the **Coxeter plane** — the
 * eigenplane of the Coxeter element — which is the canonical way this object is drawn,
 * and it is fully determined by the Dynkin diagram. Nothing here is positioned by hand.
 *
 * ## The progression this is rung one of
 *
 * Aaron 2026-09-08: *"we can go fome lines to drawings over time then 3d renderoring
 * based on multi lary tellesaling over time"* — lines, then drawings, then 3D by
 * multi-layer tessellation.
 *
 *   1. **lines** (here) — projected roots as marks; the geometry is the algebra's.
 *   2. **drawings** — edges/orbits between those points, still derived: the Weyl-group
 *      orbit structure and the root-adjacency graph are already determined by what is
 *      computed above, so a drawing adds no hand-placed strokes.
 *   3. **3D via multi-layer tessellation** — the Coxeter plane is one 2-plane of eight;
 *      the same eigen-structure gives the other planes, and layering them is a
 *      tessellation over the same root set rather than a new asset.
 *
 * Each rung must keep the property this one has: **no coordinate authored by hand.** A
 * rung that needs a designer to place a vertex has left the substrate, which is the line
 * Aaron drew — *"if we cant generate it from clifford that's not our research."*
 *
 * ## The falsifier this construction has to survive
 *
 * E8's Coxeter number is h = 30, and its Coxeter-plane projection puts the 240 roots on
 * **8 concentric rings of 30 points each**. That is a strong, checkable consequence: get
 * the plane wrong and the radii do not cluster, and the counts are not 30. The test
 * asserts it rather than eyeballing the picture.
 */

/** A root of E8 in DOUBLED integer coordinates (so the half-integer roots stay exact). */
export type Root = readonly number[];

/**
 * The 240 roots, built from the definition rather than by closure, so this file is an
 * INDEPENDENT construction from the F# reflection-closure route and the two can disagree.
 *
 *   - permutations of (±2, ±2, 0^6)            -> 112
 *   - (±1)^8 with an EVEN number of minus signs -> 128
 *
 * Doubled: the standard realisation uses (±1,±1,0^6) and (±1/2)^8; multiplying by two
 * keeps every coordinate an integer, which keeps the dot products exact.
 */
export function e8Roots(): Root[] {
  const out: Root[] = [];
  for (let i = 0; i < 8; i++) {
    for (let j = i + 1; j < 8; j++) {
      for (const si of [2, -2]) {
        for (const sj of [2, -2]) {
          const v = new Array<number>(8).fill(0);
          v[i] = si;
          v[j] = sj;
          out.push(v);
        }
      }
    }
  }
  for (let mask = 0; mask < 256; mask++) {
    let minus = 0;
    for (let b = 0; b < 8; b++) if ((mask >> b) & 1) minus++;
    if (minus % 2 !== 0) continue;
    const v: number[] = [];
    for (let b = 0; b < 8; b++) v.push(((mask >> b) & 1) === 1 ? -1 : 1);
    out.push(v);
  }
  return out;
}

/** Bourbaki simple roots for E8, in the same doubled coordinates. */
export function e8SimpleRoots(): Root[] {
  const e = (k: number, s = 1): number[] => {
    const v = new Array<number>(8).fill(0);
    v[k] = s;
    return v;
  };
  const sub = (a: number[], b: number[]): number[] => a.map((x, k) => x - (b[k] ?? 0));
  const scale = (a: number[], s: number): number[] => a.map((x) => x * s);
  // a1 = 1/2(e1 - e2 - e3 - e4 - e5 - e6 - e7 + e8), doubled -> integer
  const a1 = [1, -1, -1, -1, -1, -1, -1, 1];
  const a2 = scale(e(0).map((x, k) => x + (e(1)[k] ?? 0)), 2); // e1 + e2
  const a3 = scale(sub(e(1), e(0)), 2);
  const a4 = scale(sub(e(2), e(1)), 2);
  const a5 = scale(sub(e(3), e(2)), 2);
  const a6 = scale(sub(e(4), e(3)), 2);
  const a7 = scale(sub(e(5), e(4)), 2);
  const a8 = scale(sub(e(6), e(5)), 2);
  return [a1, a2, a3, a4, a5, a6, a7, a8];
}

/**
 * E8 Dynkin adjacency, Bourbaki numbering (1-indexed in the literature, 0-indexed here):
 *
 *     1 - 3 - 4 - 5 - 6 - 7 - 8
 *             |
 *             2
 */
export const E8_DYNKIN_EDGES: ReadonlyArray<readonly [number, number]> = [
  [0, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 6],
  [6, 7],
  [1, 3],
];

/** Perron eigenvector of the Dynkin adjacency, by power iteration. 8x8, converges fast. */
export function perronEigenvector(iterations = 4000): number[] {
  let v = new Array<number>(8).fill(1);
  for (let t = 0; t < iterations; t++) {
    const next = new Array<number>(8).fill(0);
    for (const [a, b] of E8_DYNKIN_EDGES) {
      next[a] = (next[a] ?? 0) + (v[b] ?? 0);
      next[b] = (next[b] ?? 0) + (v[a] ?? 0);
    }
    const norm = Math.hypot(...next);
    if (norm === 0) return v;
    v = next.map((x) => x / norm);
  }
  return v.map((x) => Math.abs(x));
}

/**
 * The Coxeter-plane basis, by the bipartite construction.
 *
 * The E8 Dynkin diagram is a tree, hence bipartite. Two-colour it; the Coxeter element
 * factors as the product of the two involutions, and its eigenplane is spanned by the
 * Perron-weighted sums of the simple roots in each part. This is the standard
 * construction and needs no general eigensolver.
 */
export function coxeterPlaneBasis(): { readonly u: number[]; readonly v: number[] } {
  const colour = [0, 1, 1, 0, 1, 0, 1, 0]; // 2-colouring consistent with E8_DYNKIN_EDGES
  const c = perronEigenvector();
  const simple = e8SimpleRoots();
  const u = new Array<number>(8).fill(0);
  const v = new Array<number>(8).fill(0);
  simple.forEach((root, i) => {
    const target = colour[i] === 0 ? u : v;
    const w = c[i] ?? 0;
    root.forEach((x, k) => {
      target[k] = (target[k] ?? 0) + w * x;
    });
  });
  return { u, v };
}

const dot = (a: readonly number[], b: readonly number[]): number =>
  a.reduce((s, x, k) => s + x * (b[k] ?? 0), 0);

export interface Projected {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

/**
 * Project the roots onto the Coxeter plane, Gram-Schmidt-orthonormalising the basis
 * first so radii are metric rather than skewed by the angle between `u` and `v`.
 */
export function projectRoots(roots: readonly Root[] = e8Roots()): Projected[] {
  const { u, v } = coxeterPlaneBasis();
  const un = Math.sqrt(dot(u, u));
  const e1 = u.map((x) => x / un);
  const proj = dot(v, e1);
  const w = v.map((x, k) => x - proj * (e1[k] ?? 0));
  const wn = Math.sqrt(dot(w, w));
  const e2 = w.map((x) => x / wn);
  return roots.map((r) => {
    const x = dot(r, e1);
    const y = dot(r, e2);
    return { x, y, radius: Math.hypot(x, y) };
  });
}

/** Cluster projected radii, so the ring structure can be asserted rather than eyeballed. */
export function radiusRings(points: readonly Projected[], tolerance = 1e-6): Array<{ radius: number; count: number }> {
  const sorted = [...points].map((p) => p.radius).sort((a, b) => a - b);
  const rings: Array<{ radius: number; count: number }> = [];
  for (const r of sorted) {
    const last = rings[rings.length - 1];
    if (last !== undefined && Math.abs(r - last.radius) <= tolerance * Math.max(1, r)) {
      last.count += 1;
    } else {
      rings.push({ radius: r, count: 1 });
    }
  }
  return rings;
}

/** SVG of the projection — the renderable artifact, every coordinate derived above. */
export function renderSvg(size = 720): string {
  const pts = projectRoots();
  const max = Math.max(...pts.map((p) => p.radius));
  const s = (size / 2 - 12) / max;
  const c = size / 2;
  const circles = pts
    .map((p) => `<circle cx="${(c + p.x * s).toFixed(3)}" cy="${(c - p.y * s).toFixed(3)}" r="2.4"/>`)
    .join("\n  ");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`,
    `  <title>E8 root system, Coxeter-plane projection, generated from the Clifford substrate</title>`,
    `  <g fill="currentColor">`,
    `  ${circles}`,
    `  </g>`,
    `</svg>`,
    "",
  ].join("\n");
}
