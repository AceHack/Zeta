/**
 * clifford-e8-eigenlayer-tessellation.ts — RUNG 3: 3D by multi-layer tessellation.
 *
 * Aaron 2026-09-08, the progression: *"we can go fome lines to drawings over time then
 * 3d renderoring based on multi lary tellesaling over time."* And the constraint that
 * governs all of it: *"our rendering surface should only come from our clifford if we
 * cant generate it from clifford that's not our research."*
 *
 *   1. **lines** — `clifford-e8-coxeter-projection.ts`, the Coxeter-plane projection.
 *   2. **drawings** — the Gosset 4_21 edge set, same module.
 *   3. **3D via multi-layer tessellation** — here.
 *
 * ## What "multi-layer tessellation" is, precisely
 *
 * Rung 1 projects onto the **Coxeter plane** — one eigenplane of the Coxeter element,
 * built by the bipartite construction from the **Perron** (largest) eigenvector of the
 * Dynkin adjacency matrix. That construction was never specific to the Perron vector.
 * The adjacency matrix of the E8 diagram has eight eigenvalues; the four positive ones
 * each yield a plane by exactly the same recipe, and those four planes are the four
 * invariant 2-planes of the Coxeter element acting on R^8.
 *
 * So rung 3 introduces **no new asset and no new construction**. It runs rung 1's own
 * recipe on the remaining eigenvectors, and the four resulting planes are *complementary*
 * rather than merely different: they are mutually orthogonal, they span R^8, and every
 * root's squared length distributes across them and sums back exactly. That is the sense
 * in which the layers **tessellate** the root set — a partition with nothing lost and
 * nothing double-counted, checked below rather than asserted.
 *
 * Two coordinates from layer 0 and one from layer 1 give a genuine 3D embedding of the
 * same 240 roots. No coordinate is authored by hand, at any rung.
 *
 * ## The falsifiers
 *
 * Rung 1's was "8 rings of exactly 30". Rung 3 needs its own, of the same quality — a
 * count or invariant a wrong construction cannot accidentally satisfy. There are five,
 * and they are independent of each other:
 *
 * - **The exponents.** The Coxeter element rotates layer p by exactly 2*pi*m/30, and the
 *   measured m come out 1, 7, 11, 13 — the four E8 exponents below h/2. Nothing about a
 *   wrong plane produces an integer here at all, let alone the right one. Their
 *   complements 29, 23, 19, 17 complete the exponent set: the eight sum to 120 (the
 *   number of positive roots) and the degrees m+1 multiply to 696729600 = |W(E8)|.
 * - **Pythagorean completeness.** For every one of the 240 roots, the four layer radii
 *   satisfy sum(r_p^2) = |r|^2 = 8. This is the tessellation property itself.
 * - **Orthonormality.** The eight layer axes form an orthonormal basis of R^8.
 * - **Ring permutation.** All four layers show the *same* eight ring radii, yet no root
 *   keeps its ring index between layer 0 and layer 1 — the layers re-seat the same
 *   roots on the same rings. The ring 4-tuple has exactly 8 values of multiplicity 30,
 *   and it coincides with the Coxeter-orbit partition.
 * - **Cycle structure.** The Coxeter element partitions the 240 roots into 8 orbits of
 *   exactly 30, giving a 2-regular wireframe of 240 edges.
 *
 * ## Honest limit — what rung 3 does NOT deliver
 *
 * A 3D **vertex set** with a derived wireframe. Not a closed surface: no face set is
 * derived here, so this is not yet a mesh you can shade. Deriving faces needs a
 * principled 2-cell choice over the edge graph, and that is the next rung, not this one.
 * Saying so is the point — a rung that quietly hand-picked triangles would have left the
 * substrate.
 *
 * Register: the construction is **metered** (five falsifiers, in the sibling test file,
 * each mutation-checked). Any statement about what this is *good for* downstream is
 * `unmetered` and lives in the research doc, not here.
 */

import { e8Roots, e8SimpleRoots, type Root } from "./clifford-e8-coxeter-projection.ts";

const dot = (a: readonly number[], b: readonly number[]): number => a.reduce((s, x, k) => s + x * (b[k] ?? 0), 0);

/** Squared root length in the doubled coordinates every module here uses. */
export const ROOT_NORM_SQUARED = 8;

/** E8's Coxeter number. Not used as an input anywhere — it is what the order test measures. */
export const COXETER_NUMBER = 30;

/**
 * Bipartite 2-colouring of the E8 Dynkin diagram, in the Bourbaki node order rung 1 uses.
 * The diagram is a tree, hence bipartite; `dynkinAdjacency` is checked against this.
 */
export const DYNKIN_COLOURING: readonly number[] = [0, 1, 1, 0, 1, 0, 1, 0];

/**
 * The Dynkin adjacency matrix, DERIVED from the simple roots rather than declared.
 *
 * A_ij = -(alpha_i, alpha_j)/4 for i != j, which is the Cartan off-diagonal with its sign
 * flipped. Deriving it means the geometry and the diagram have to agree; a wrong simple
 * root shows up here rather than silently downstream.
 */
export function dynkinAdjacency(): number[][] {
  const simple = e8SimpleRoots();
  return simple.map((ai, i) => simple.map((aj, j) => (i === j ? 0 : -dot(ai, aj) / 4)));
}

/** Reflection in the hyperplane orthogonal to root `a`. |a|^2 = 8, so the factor is 1/4. */
export function reflect(x: readonly number[], a: readonly number[]): number[] {
  const c = dot(x, a) / 4;
  return x.map((v, k) => v - c * (a[k] ?? 0));
}

/**
 * The **bipartite** Coxeter element: the product of the two colour-class involutions.
 *
 * Which Coxeter element matters. All Coxeter elements are conjugate and all have order h,
 * but they do not share eigenplanes — the planes built from the bipartite construction
 * belong to the bipartite element specifically. Using the Bourbaki-order product instead
 * leaves the planes non-invariant, and the exponent falsifier detects that immediately.
 */
export function bipartiteCoxeter(x: readonly number[]): number[] {
  const simple = e8SimpleRoots();
  let v = [...x];
  for (let i = 0; i < simple.length; i++) {
    if (DYNKIN_COLOURING[i] === 1) v = reflect(v, simple[i] ?? []);
  }
  for (let i = 0; i < simple.length; i++) {
    if (DYNKIN_COLOURING[i] === 0) v = reflect(v, simple[i] ?? []);
  }
  return v;
}

/**
 * Multiplicative order of the bipartite Coxeter element, measured by iterating it on a
 * root until the root returns. Bounded so a broken element cannot spin forever.
 */
export function bipartiteCoxeterOrder(limit = 256): number {
  const start = e8Roots()[0] ?? [];
  let v = [...start];
  for (let k = 1; k <= limit; k++) {
    v = bipartiteCoxeter(v);
    if (v.every((x, i) => Math.abs(x - (start[i] ?? 0)) < 1e-9)) return k;
  }
  return -1;
}

/**
 * Cyclic Jacobi eigen-decomposition of a real symmetric matrix.
 *
 * Deterministic, dependency-free, and converges to machine precision on an 8x8 — the
 * measured eigenvector residuals |Av - lv| are ~1e-16. Written out rather than pulled in
 * so the whole rung stays inside the repository's own code, and so the eigenvalues are
 * *measured* rather than substituted from the closed form 2cos(pi*m/h). Substituting the
 * closed form would make the exponent falsifier circular.
 */
export function symmetricEigen(input: readonly (readonly number[])[]): {
  readonly values: number[];
  readonly vectors: number[][];
} {
  const n = input.length;
  const a = input.map((r) => [...r]);
  const v = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  const at = (i: number, j: number): number => a[i]?.[j] ?? 0;
  const set = (m: number[][], i: number, j: number, x: number): void => {
    const row = m[i];
    if (row !== undefined) row[j] = x;
  };
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += at(i, j) ** 2;
    if (off < 1e-32) break;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = at(p, q);
        if (Math.abs(apq) < 1e-300) continue;
        const theta = (at(q, q) - at(p, p)) / (2 * apq);
        const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        set(a, p, p, at(p, p) - t * apq);
        set(a, q, q, at(q, q) + t * apq);
        set(a, p, q, 0);
        set(a, q, p, 0);
        for (let k = 0; k < n; k++) {
          if (k === p || k === q) continue;
          const akp = at(k, p);
          const akq = at(k, q);
          set(a, k, p, c * akp - s * akq);
          set(a, p, k, c * akp - s * akq);
          set(a, k, q, s * akp + c * akq);
          set(a, q, k, s * akp + c * akq);
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k]?.[p] ?? 0;
          const vkq = v[k]?.[q] ?? 0;
          set(v, k, p, c * vkp - s * vkq);
          set(v, k, q, s * vkp + c * vkq);
        }
      }
    }
  }
  const values = Array.from({ length: n }, (_, i) => at(i, i));
  const vectors = values.map((_, j) => v.map((row) => row[j] ?? 0));
  return { values, vectors };
}

/** One invariant 2-plane of the Coxeter element, with an orthonormal frame. */
export interface EigenLayer {
  /** 0..3, ordered by descending adjacency eigenvalue. Layer 0 IS rung 1's Coxeter plane. */
  readonly index: number;
  /** The Dynkin-adjacency eigenvalue this layer was built from; equals 2cos(pi*m/h). */
  readonly adjacencyEigenvalue: number;
  /** First orthonormal axis (the colour-0 weighted sum, normalised). */
  readonly e1: number[];
  /** Second orthonormal axis (colour-1 sum, Gram-Schmidt'd against e1). */
  readonly e2: number[];
}

/**
 * The four layers, by running rung 1's bipartite recipe on every positive-eigenvalue
 * eigenvector of the Dynkin adjacency instead of only the Perron one.
 *
 * The adjacency of a bipartite graph has a spectrum symmetric about zero, so the four
 * positive eigenvalues carry all the information; the negative four give the same planes.
 */
export function eigenLayers(): EigenLayer[] {
  const { values, vectors } = symmetricEigen(dynkinAdjacency());
  const simple = e8SimpleRoots();
  const chosen = values
    .map((value, i) => ({ value, i }))
    .filter((x) => x.value > 1e-9)
    .sort((p, q) => q.value - p.value);
  return chosen.map(({ value, i }, index) => {
    const weights = vectors[i] ?? [];
    const u = new Array<number>(8).fill(0);
    const w = new Array<number>(8).fill(0);
    simple.forEach((root, node) => {
      const target = DYNKIN_COLOURING[node] === 0 ? u : w;
      const c = weights[node] ?? 0;
      root.forEach((x, k) => {
        target[k] = (target[k] ?? 0) + c * x;
      });
    });
    const un = Math.sqrt(dot(u, u));
    const e1 = u.map((x) => x / un);
    const proj = dot(w, e1);
    const w2 = w.map((x, k) => x - proj * (e1[k] ?? 0));
    const wn = Math.sqrt(dot(w2, w2));
    const e2 = w2.map((x) => x / wn);
    return { index, adjacencyEigenvalue: value, e1, e2 };
  });
}

/** A root's (x, y) inside one layer. */
export interface LayerPoint {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

/** Project one root into every layer. Returns 4 points, layer order. */
export function projectIntoLayers(root: Root, layers: readonly EigenLayer[] = eigenLayers()): LayerPoint[] {
  return layers.map((L) => {
    const x = dot(root, L.e1);
    const y = dot(root, L.e2);
    return { x, y, radius: Math.hypot(x, y) };
  });
}

/**
 * The tessellation identity, per root: the four layer radii and their squared sum.
 *
 * `residual` is |sum(r_p^2) - 8|. It is the number the Pythagorean falsifier reads, and
 * it is what makes "these four pictures are of the same object" a measurement rather than
 * a claim.
 */
export function tessellationResidual(
  root: Root,
  layers: readonly EigenLayer[] = eigenLayers(),
): { readonly radii: number[]; readonly sumOfSquares: number; readonly residual: number } {
  const radii = projectIntoLayers(root, layers).map((p) => p.radius);
  const sumOfSquares = radii.reduce((s, r) => s + r * r, 0);
  return { radii, sumOfSquares, residual: Math.abs(sumOfSquares - ROOT_NORM_SQUARED) };
}

/**
 * The rotation angle the Coxeter element induces in a layer, measured over every root
 * rather than assumed, plus the spread across roots.
 *
 * If the layer really is invariant, every root turns by the same angle and `spread` is at
 * noise level. `exponent` is that angle in units of 2*pi/h — an integer when the
 * construction is right, and nothing in particular when it is not.
 */
export function measureLayerRotation(
  layer: EigenLayer,
  roots: readonly Root[] = e8Roots(),
): {
  readonly angle: number;
  readonly spread: number;
  readonly exponent: number;
  readonly outOfPlaneResidual: number;
} {
  const angles: number[] = [];
  for (const r of roots) {
    const ax = dot(r, layer.e1);
    const ay = dot(r, layer.e2);
    if (Math.hypot(ax, ay) < 1e-9) continue;
    const cr = bipartiteCoxeter(r);
    const bx = dot(cr, layer.e1);
    const by = dot(cr, layer.e2);
    let d = Math.atan2(by, bx) - Math.atan2(ay, ax);
    while (d <= -Math.PI) d += 2 * Math.PI;
    while (d > Math.PI) d -= 2 * Math.PI;
    angles.push(d);
  }
  const lo = Math.min(...angles);
  const hi = Math.max(...angles);
  // Residual as a vector norm, not as sqrt(1 - a^2 - b^2): the latter cancels
  // catastrophically and reports ~1e-8 for a plane that is invariant to 1e-15.
  const ce1 = bipartiteCoxeter(layer.e1);
  const a = dot(ce1, layer.e1);
  const b = dot(ce1, layer.e2);
  const resid = ce1.map((x, k) => x - a * (layer.e1[k] ?? 0) - b * (layer.e2[k] ?? 0));
  return {
    angle: lo,
    spread: hi - lo,
    exponent: lo / ((2 * Math.PI) / COXETER_NUMBER),
    outOfPlaneResidual: Math.hypot(...resid),
  };
}

/** Cluster a list of radii into rings. Same tolerance discipline as rung 1. */
export function clusterRadii(values: readonly number[], tolerance = 1e-6): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last === undefined || Math.abs(r - last) > tolerance * Math.max(1, r)) out.push(r);
  }
  return out;
}

/** Per-layer ring radii and, per root, which ring it sits on in that layer. */
export function ringStructure(
  roots: readonly Root[] = e8Roots(),
  layers: readonly EigenLayer[] = eigenLayers(),
): Array<{ readonly radii: number[]; readonly ringOf: number[] }> {
  return layers.map((L) => {
    const rs = roots.map((r) => Math.hypot(dot(r, L.e1), dot(r, L.e2)));
    const radii = clusterRadii(rs);
    const ringOf = rs.map((v) => radii.findIndex((u) => Math.abs(u - v) < 1e-6));
    return { radii, ringOf };
  });
}

/** The Coxeter element's orbits on the roots, as index cycles into `roots`. */
export function coxeterOrbits(roots: readonly Root[] = e8Roots()): number[][] {
  const key = (r: readonly number[]): string => r.map((x) => Math.round(x)).join(",");
  const index = new Map(roots.map((r, i) => [key(r), i]));
  const seen = new Set<number>();
  const orbits: number[][] = [];
  roots.forEach((r, i) => {
    if (seen.has(i)) return;
    const cycle: number[] = [];
    let v: number[] = [...r];
    for (;;) {
      const k = index.get(key(v));
      if (k === undefined || seen.has(k)) break;
      seen.add(k);
      cycle.push(k);
      v = bipartiteCoxeter(v);
    }
    orbits.push(cycle);
  });
  return orbits;
}

/**
 * The wireframe: each Coxeter orbit is a 30-cycle, so consecutive images under the
 * Coxeter element are the edges. 240 of them, every vertex of degree exactly 2.
 *
 * This is a DIFFERENT derivation from rung 2's edge set (which uses the exact integer
 * adjacency test on root inner products). Two independent edge derivations over one
 * vertex set is the same discipline as two independent routes to 240 roots.
 */
export function orbitCycleEdges(roots: readonly Root[] = e8Roots()): Array<readonly [number, number]> {
  return coxeterOrbits(roots).flatMap((cycle) => cycle.map((v, i) => [v, cycle[(i + 1) % cycle.length] ?? v] as const));
}

export interface Point3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * The 3D embedding: (x, y) from layer 0 — rung 1's own picture, unchanged — and z from
 * layer 1's first axis.
 *
 * **The gauge, stated rather than hidden.** Which axis inside layer 1 becomes z, and the
 * sign of that eigenvector, are not determined by the algebra. Both are isometries of the
 * result: choosing the other axis rotates the figure about z, and flipping the sign
 * reflects it. So the *shape* is canonical even though these particular coordinates are
 * one representative of it. Nothing here is a designer's choice about where a point goes.
 */
export function embed3d(roots: readonly Root[] = e8Roots(), layers: readonly EigenLayer[] = eigenLayers()): Point3[] {
  const l0 = layers[0];
  const l1 = layers[1];
  if (l0 === undefined || l1 === undefined) throw new Error("eigenLayers() produced fewer than two layers");
  return roots.map((r) => ({ x: dot(r, l0.e1), y: dot(r, l0.e2), z: dot(r, l1.e1) }));
}

/**
 * Wavefront OBJ of the 3D embedding: 240 vertices and the 240 orbit-cycle edges as `l`
 * elements. Text, so it stays diffable and reviewable in the proof lineage, and it opens
 * directly in Blender — which is the handoff surface the character work already uses.
 */
export function renderObj(): string {
  const roots = e8Roots();
  const pts = embed3d(roots);
  const edges = orbitCycleEdges(roots);
  const lines = [
    "# E8 root system, 3D eigenlayer embedding",
    "# Generated from the Clifford/E8 substrate. No coordinate authored by hand.",
    "# x,y: Coxeter plane (layer 0). z: layer 1 first axis. See eigenLayers().",
    ...pts.map((p) => `v ${p.x.toFixed(9)} ${p.y.toFixed(9)} ${p.z.toFixed(9)}`),
    ...edges.map(([a, b]) => `l ${a + 1} ${b + 1}`),
    "",
  ];
  return lines.join("\n");
}
