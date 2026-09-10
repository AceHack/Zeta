import { describe, expect, it } from "bun:test";
import { coxeterPlaneBasis, e8Roots, projectRoots } from "./clifford-e8-coxeter-projection.ts";
import {
  bipartiteCoxeter,
  bipartiteCoxeterOrder,
  COXETER_NUMBER,
  coxeterOrbits,
  dynkinAdjacency,
  eigenLayers,
  embed3d,
  measureLayerRotation,
  orbitCycleEdges,
  renderObj,
  ringStructure,
  symmetricEigen,
  tessellationResidual,
} from "./clifford-e8-eigenlayer-tessellation.ts";

/** The four E8 exponents below h/2. The other four are their complements mod h. */
const LOW_EXPONENTS = [1, 7, 11, 13];
/** Their complements: 30 - m. Together these eight are the full exponent set. */
const ALL_EXPONENTS = [...LOW_EXPONENTS, ...LOW_EXPONENTS.map((m) => COXETER_NUMBER - m)];

describe("rung 3 — the layer construction is the same recipe rung 1 already used", () => {
  it("derives the Dynkin diagram from the simple roots rather than declaring it", () => {
    // The adjacency is computed from root inner products. If a simple root were wrong,
    // the diagram would not come out as E8's tree and this would fail here rather than
    // producing a plausible-looking wrong picture downstream.
    const a = dynkinAdjacency();
    const entries = a.flat();
    expect(new Set(entries.map((x) => Math.round(x)))).toEqual(new Set([0, 1]));
    for (const x of entries) expect(Math.abs(x - Math.round(x))).toBeLessThan(1e-12);
    // A tree on 8 nodes has 7 edges.
    expect(entries.reduce((s, x) => s + x, 0) / 2).toBeCloseTo(7, 9);
    // Symmetric.
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) expect(a[i]?.[j]).toBeCloseTo(a[j]?.[i] ?? 0, 12);
    // Degree sequence of the E8 diagram: one trivalent node, two leaves at the short
    // branches plus one at the long end, the rest of degree 2.
    const degrees = a.map((row) => row.reduce((s, x) => s + x, 0)).sort((p, q) => p - q);
    expect(degrees.map((d) => Math.round(d))).toEqual([1, 1, 1, 2, 2, 2, 2, 3]);
  });

  it("the Jacobi eigensolver actually solves the eigenproblem", () => {
    // Guards the measurement itself. Everything below reads eigenvectors; if the solver
    // were wrong, the exponent falsifier would be measuring the solver's bug.
    const a = dynkinAdjacency();
    const { values, vectors } = symmetricEigen(a);
    expect(values.length).toBe(8);
    values.forEach((lambda, j) => {
      const v = vectors[j] ?? [];
      const av = a.map((row) => row.reduce((s, x, k) => s + x * (v[k] ?? 0), 0));
      const residual = Math.hypot(...av.map((x, k) => x - lambda * (v[k] ?? 0)));
      expect(residual).toBeLessThan(1e-12);
    });
  });

  it("the Coxeter element has order exactly h = 30", () => {
    expect(bipartiteCoxeterOrder()).toBe(COXETER_NUMBER);
  });

  it("the Coxeter element permutes the root system", () => {
    const roots = e8Roots();
    const key = (r: readonly number[]): string => r.map((x) => Math.round(x)).join(",");
    const all = new Set(roots.map(key));
    const images = new Set<string>();
    for (const r of roots) {
      const image = bipartiteCoxeter(r);
      for (const x of image) expect(Math.abs(x - Math.round(x))).toBeLessThan(1e-9);
      expect(all.has(key(image))).toBe(true);
      images.add(key(image));
    }
    expect(images.size).toBe(240);
  });

  it("there are exactly four layers, layer 0 being rung 1's Coxeter plane", () => {
    const layers = eigenLayers();
    expect(layers.length).toBe(4);
    // Descending, and strictly so — no accidental repeat of one plane.
    for (let i = 1; i < layers.length; i++) {
      expect(layers[i]?.adjacencyEigenvalue ?? 0).toBeLessThan((layers[i - 1]?.adjacencyEigenvalue ?? 0) - 1e-6);
    }
    // Layer 0's eigenvalue is the Perron one rung 1 uses.
    expect(layers[0]?.adjacencyEigenvalue ?? 0).toBeCloseTo(2 * Math.cos(Math.PI / 30), 9);
  });

  it("layer 0 IS rung 1's Coxeter plane — two eigensolvers, one plane", () => {
    // The module docstring claims rung 3 runs rung 1's own recipe, so layer 0 must BE
    // rung 1's plane rather than merely resemble it. Matching the eigenvalue is not
    // that claim; this is. And the two arrive by different routes — rung 1 by power
    // iteration, rung 3 by Jacobi — so agreement is a genuine cross-check and a
    // disagreement would convict one of them.
    const layer0 = eigenLayers()[0];
    if (layer0 === undefined) throw new Error("no layer 0");
    const dot = (a: readonly number[], b: readonly number[]): number => a.reduce((s, x, k) => s + x * (b[k] ?? 0), 0);

    // Rung 1's basis, orthonormalised exactly as rung 1 orthonormalises it.
    const { u, v } = coxeterPlaneBasis();
    const a1 = u.map((x) => x / Math.sqrt(dot(u, u)));
    const proj = dot(v, a1);
    const w = v.map((x, k) => x - proj * (a1[k] ?? 0));
    const a2 = w.map((x) => x / Math.sqrt(dot(w, w)));

    // Each of rung 1's axes lies inside layer 0: zero out-of-plane residual.
    for (const axis of [a1, a2]) {
      const c1 = dot(axis, layer0.e1);
      const c2 = dot(axis, layer0.e2);
      const residual = axis.map((x, k) => x - c1 * (layer0.e1[k] ?? 0) - c2 * (layer0.e2[k] ?? 0));
      expect(Math.hypot(...residual)).toBeLessThan(1e-9);
    }

    // And every root lands at the same radius under both — the picture is identical,
    // not merely a rotation of a similar one.
    const rung1 = projectRoots();
    e8Roots().forEach((r, i) => {
      const radius = Math.hypot(dot(r, layer0.e1), dot(r, layer0.e2));
      expect(Math.abs(radius - (rung1[i]?.radius ?? -1))).toBeLessThan(1e-9);
    });
  });

  // ── FALSIFIER 1: THE EXPONENTS ───────────────────────────────────────────
  //
  // The Coxeter element turns layer p by exactly 2*pi*m/30. The measured m are the four
  // E8 exponents below h/2 — 1, 7, 11, 13 — and every one of the 240 roots turns by the
  // SAME angle, which is what makes the layer invariant rather than merely nearby.
  //
  // A wrong plane does not produce a near-integer m at all. A wrong Coxeter element (the
  // Bourbaki-order product instead of the bipartite one) leaves the planes non-invariant
  // and the per-root spread blows up from ~1e-14 to order 1 radian.
  it("rotates each layer by exactly 2*pi*m/h with m the E8 exponents", () => {
    const layers = eigenLayers();
    const measured = layers.map((L) => measureLayerRotation(L));
    for (const m of measured) {
      expect(m.spread).toBeLessThan(1e-9); // every root turns by the same angle
      expect(m.outOfPlaneResidual).toBeLessThan(1e-9); // the plane is invariant
      expect(Math.abs(m.exponent - Math.round(m.exponent))).toBeLessThan(1e-9);
    }
    expect(measured.map((m) => Math.round(m.exponent))).toEqual(LOW_EXPONENTS);
  });

  it("the measured exponents reproduce two independent E8 invariants", () => {
    const low = eigenLayers().map((L) => Math.round(measureLayerRotation(L).exponent));
    const exponents = [...low, ...low.map((m) => COXETER_NUMBER - m)];
    expect([...exponents].sort((a, b) => a - b)).toEqual([...ALL_EXPONENTS].sort((a, b) => a - b));
    // The exponents sum to the number of positive roots.
    expect(exponents.reduce((s, m) => s + m, 0)).toBe(120);
    // The degrees m+1 multiply to the order of the Weyl group.
    expect(exponents.reduce((p, m) => p * (m + 1), 1)).toBe(696729600);
  });

  // ── FALSIFIER 2: PYTHAGOREAN COMPLETENESS ────────────────────────────────
  //
  // This is the tessellation property itself: the four layers partition each root's
  // squared length with nothing lost and nothing double-counted. Four planes that were
  // merely *different* would not do this; only four MUTUALLY ORTHOGONAL planes spanning
  // R^8 do. Drop the Gram-Schmidt, reuse one eigenvector twice, or take a wrong
  // colouring, and the sum stops being 8.
  it("the four layer radii square-sum to the root norm, for every root", () => {
    const layers = eigenLayers();
    let worst = 0;
    for (const r of e8Roots()) worst = Math.max(worst, tessellationResidual(r, layers).residual);
    expect(worst).toBeLessThan(1e-9);
  });

  // ── FALSIFIER 3: ORTHONORMALITY ──────────────────────────────────────────
  it("the eight layer axes are an orthonormal basis of R^8", () => {
    const basis = eigenLayers().flatMap((L) => [L.e1, L.e2]);
    expect(basis.length).toBe(8);
    let worst = 0;
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const d = (basis[i] ?? []).reduce((s, x, k) => s + x * (basis[j]?.[k] ?? 0), 0);
        worst = Math.max(worst, Math.abs(d - (i === j ? 1 : 0)));
      }
    }
    expect(worst).toBeLessThan(1e-9);
  });

  // ── FALSIFIER 4: THE RING PERMUTATION ────────────────────────────────────
  //
  // Every layer shows rung 1's eight rings of thirty — and the same eight RADII. What
  // changes between layers is which root sits on which ring: no root keeps its ring index
  // from layer 0 to layer 1. So the layers are one object re-seated, which is why
  // "tessellation" is the right word and "four different pictures" is not.
  it("every layer has rung 1's eight rings of exactly thirty", () => {
    const roots = e8Roots();
    const structure = ringStructure(roots);
    expect(structure.length).toBe(4);
    for (const layer of structure) {
      expect(layer.radii.length).toBe(8);
      const counts = new Map<number, number>();
      for (const ring of layer.ringOf) counts.set(ring, (counts.get(ring) ?? 0) + 1);
      expect([...counts.values()]).toEqual([30, 30, 30, 30, 30, 30, 30, 30]);
    }
  });

  it("all four layers share the same eight ring radii", () => {
    const structure = ringStructure();
    const first = structure[0]?.radii ?? [];
    for (const layer of structure) {
      layer.radii.forEach((r, i) => expect(Math.abs(r - (first[i] ?? 0))).toBeLessThan(1e-9));
    }
  });

  it("but no root keeps its ring index between layer 0 and layer 1", () => {
    const structure = ringStructure();
    const a = structure[0]?.ringOf ?? [];
    const b = structure[1]?.ringOf ?? [];
    const fixed = a.filter((ring, i) => ring === b[i]).length;
    expect(fixed).toBe(0);
  });

  it("the ring 4-tuple has exactly 8 classes of 30 — the Coxeter orbits", () => {
    const roots = e8Roots();
    const structure = ringStructure(roots);
    const tuple = roots.map((_, i) => structure.map((L) => L.ringOf[i]).join("-"));
    const counts = new Map<string, number>();
    for (const t of tuple) counts.set(t, (counts.get(t) ?? 0) + 1);
    expect(counts.size).toBe(8);
    expect([...new Set(counts.values())]).toEqual([30]);
    // And the classes coincide with the orbits: one tuple per orbit.
    for (const orbit of coxeterOrbits(roots)) {
      expect(new Set(orbit.map((i) => tuple[i])).size).toBe(1);
    }
  });

  // ── FALSIFIER 5: THE CYCLE STRUCTURE ─────────────────────────────────────
  it("the Coxeter element cuts the roots into 8 orbits of exactly 30", () => {
    const orbits = coxeterOrbits();
    expect(orbits.length).toBe(8);
    expect([...new Set(orbits.map((o) => o.length))]).toEqual([30]);
    expect(orbits.reduce((s, o) => s + o.length, 0)).toBe(240);
    expect(new Set(orbits.flat()).size).toBe(240);
  });

  it("the wireframe is 240 edges, every vertex of degree exactly 2", () => {
    const edges = orbitCycleEdges();
    expect(edges.length).toBe(240);
    const degree = new Array<number>(240).fill(0);
    for (const [a, b] of edges) {
      degree[a] = (degree[a] ?? 0) + 1;
      degree[b] = (degree[b] ?? 0) + 1;
    }
    expect([...new Set(degree)]).toEqual([2]);
    // No self-loops: the Coxeter element fixes no root.
    for (const [a, b] of edges) expect(a).not.toBe(b);
  });

  it("every edge joins a root to its own Coxeter image", () => {
    // Counting edges and degrees is NOT enough, and mutation testing proved it: joining
    // every second orbit member also yields 240 edges of uniform degree 2 — while
    // splitting each 30-cycle into two 15-cycles, a different figure entirely. This
    // asserts the defining property rather than a consequence of it.
    const roots = e8Roots();
    for (const [a, b] of orbitCycleEdges(roots)) {
      const image = bipartiteCoxeter(roots[a] ?? []);
      const target = roots[b] ?? [];
      image.forEach((x, k) => expect(Math.abs(x - (target[k] ?? 0))).toBeLessThan(1e-9));
    }
  });

  it("the wireframe has exactly 8 components of 30 — whole cycles, not half ones", () => {
    const edges = orbitCycleEdges();
    const parent = Array.from({ length: 240 }, (_, i) => i);
    const find = (x: number): number => {
      let r = x;
      while ((parent[r] ?? r) !== r) r = parent[r] ?? r;
      return r;
    };
    for (const [a, b] of edges) {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent[ra] = rb;
    }
    const sizes = new Map<number, number>();
    for (let i = 0; i < 240; i++) {
      const root = find(i);
      sizes.set(root, (sizes.get(root) ?? 0) + 1);
    }
    expect(sizes.size).toBe(8);
    expect([...new Set(sizes.values())]).toEqual([30]);
  });
});

describe("rung 3 — the 3D artifact", () => {
  it("embeds 240 distinct points in 3D", () => {
    const pts = embed3d();
    expect(pts.length).toBe(240);
    let min = Infinity;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i];
        const b = pts[j];
        if (a === undefined || b === undefined) continue;
        min = Math.min(min, Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z));
      }
    }
    // Measured 0.1981; asserted well clear of zero so a degenerate embedding (all points
    // collapsed onto one plane, or two layers accidentally equal) cannot pass.
    expect(min).toBeGreaterThan(0.1);
  });

  it("the embedding is genuinely three-dimensional, not a plane in disguise", () => {
    // Per-axis spread is NOT this test, and mutation testing showed why: taking z from
    // layer 0's first axis makes z a copy of x, so all 240 points lie in the plane
    // z - x = 0, every per-axis spread is still large, and every point is still
    // distinct. The rank of the covariance is what distinguishes a solid from a tilted
    // sheet, so the covariance spectrum is what gets asserted.
    //
    // And the measurement came back sharper than the property being tested: the
    // covariance is EXACTLY the identity, all three eigenvalues 1.000000000. That is
    // not luck. Any three orthonormal directions e satisfy sum over roots of (r.e)^2 =
    // 240*8/8 = 240, so dividing by the 240 roots gives 1 along every axis and 0
    // between them — E8's root system is isotropic (a spherical 2-design). So the
    // assertion is equality with I, not merely non-degeneracy; the coplanar mutant
    // gives the spectrum (2, 1, 0) and dies on the first eigenvalue it reaches.
    const pts = embed3d();
    const n = pts.length;
    const mean = ["x", "y", "z"].map(
      (k) => pts.reduce((s, p) => s + (p as unknown as Record<string, number>)[k]!, 0) / n,
    );
    const at = (p: (typeof pts)[number], i: number): number =>
      (p as unknown as Record<string, number>)[["x", "y", "z"][i]!]! - mean[i]!;
    const cov = [0, 1, 2].map((i) => [0, 1, 2].map((j) => pts.reduce((s, p) => s + at(p, i) * at(p, j), 0) / n));
    const { values } = symmetricEigen(cov);
    for (const lambda of values) expect(Math.abs(lambda - 1)).toBeLessThan(1e-9);
  });

  it("the z axis is symmetric about zero — the root system is centrally symmetric", () => {
    const z = embed3d().map((p) => p.z);
    expect(Math.abs(Math.max(...z) + Math.min(...z))).toBeLessThan(1e-9);
    // -r is a root whenever r is, so every height is matched by its negative.
    const sorted = [...z].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      const lo = sorted[i] ?? 0;
      const hi = sorted[sorted.length - 1 - i] ?? 0;
      expect(Math.abs(lo + hi)).toBeLessThan(1e-9);
    }
  });

  it("emits an OBJ whose every vertex and line is derived", () => {
    const obj = renderObj();
    const vs = (obj.match(/^v /gm) ?? []).length;
    const ls = (obj.match(/^l /gm) ?? []).length;
    expect(vs).toBe(240);
    expect(ls).toBe(240);
    // Wavefront indices are 1-based and must all be in range.
    for (const line of obj.split("\n")) {
      if (!line.startsWith("l ")) continue;
      const [, a, b] = line.split(" ");
      for (const idx of [Number(a), Number(b)]) {
        expect(idx).toBeGreaterThanOrEqual(1);
        expect(idx).toBeLessThanOrEqual(240);
      }
    }
  });
});
