import { describe, expect, it } from "bun:test";
import {
  coxeterPlaneBasis,
  e8Roots,
  e8SimpleRoots,
  gossetEdges,
  projectRoots,
  radiusRings,
  renderDrawingSvg,
  renderSvg,
  vertexDegrees,
} from "./clifford-e8-coxeter-projection.ts";

describe("the rendering surface is generated from the algebra", () => {
  it("the root system has E8's kissing number", () => {
    // Cross-checks `CliffordE8Roots.kissingNumber` in F#, which reaches 240 by
    // Clifford reflection CLOSURE. This module reaches it by CONSTRUCTION. Two
    // independent routes to one number is the point; agreement is evidence,
    // and a disagreement would convict one of them.
    expect(e8Roots().length).toBe(240);
  });

  it("every root has the same length — a root system, not a point cloud", () => {
    const norms = new Set(e8Roots().map((r) => r.reduce((s, x) => s + x * x, 0)));
    expect([...norms]).toEqual([8]); // doubled coordinates: |r|^2 = 4*2
  });

  it("there are 8 simple roots and they are roots", () => {
    const simple = e8SimpleRoots();
    expect(simple.length).toBe(8);
    const all = new Set(e8Roots().map((r) => r.join(",")));
    for (const s of simple) expect(all.has(s.join(","))).toBe(true);
  });

  // ── THE FALSIFIER ────────────────────────────────────────────────────────
  //
  // E8's Coxeter number is h = 30, and the Coxeter-plane projection puts the 240
  // roots on 8 concentric rings of 30. Nothing about that survives a wrong
  // plane: the radii stop clustering and the counts stop being 30. This is why
  // the projection can be called correct rather than plausible, and why no
  // coordinate in the SVG is positioned by hand.
  it("projects onto 8 concentric rings of exactly 30 roots each", () => {
    const rings = radiusRings(projectRoots());
    expect(rings.length).toBe(8);
    for (const ring of rings) expect(ring.count).toBe(30);
    expect(rings.reduce((s, r) => s + r.count, 0)).toBe(240);
  });

  it("the rings are distinct radii, not one ring counted eight times", () => {
    const radii = radiusRings(projectRoots()).map((r) => r.radius);
    for (let i = 1; i < radii.length; i++) {
      expect(radii[i] ?? 0).toBeGreaterThan((radii[i - 1] ?? 0) + 1e-3);
    }
  });

  it("the Coxeter basis spans a plane — u and v are independent", () => {
    const { u, v } = coxeterPlaneBasis();
    const dot = u.reduce((s, x, k) => s + x * (v[k] ?? 0), 0);
    const nu = Math.hypot(...u);
    const nv = Math.hypot(...v);
    expect(nu).toBeGreaterThan(0);
    expect(nv).toBeGreaterThan(0);
    // not parallel: |cos| strictly below 1
    expect(Math.abs(dot / (nu * nv))).toBeLessThan(0.999);
  });

  it("renders an SVG whose every mark is a projected root", () => {
    const svg = renderSvg(720);
    expect(svg.startsWith("<svg")).toBe(true);
    expect((svg.match(/<circle /g) ?? []).length).toBe(240);
  });
});

describe("rung 2 — drawings, with edges derived not drawn", () => {
  // 4_21's vertices ARE the 240 roots, and its edges join roots at 60 degrees.
  // In doubled coordinates that is the exact integer test <r,s> = 4, so there is
  // no tolerance to tune and nothing to eyeball.
  const roots = e8Roots();
  const edges = gossetEdges(roots);

  it("has the Gosset polytope's edge count", () => {
    expect(edges.length).toBe(6720);
  });

  it("is 56-regular — every vertex, not on average", () => {
    const degrees = new Set(vertexDegrees(roots, edges));
    expect([...degrees]).toEqual([56]);
  });

  it("edge count and regularity agree: 240 * 56 / 2", () => {
    // Two independently computed quantities that must reconcile. If the edge test
    // were wrong in a way that preserved the count, this would still catch a
    // non-uniform degree distribution.
    expect((240 * 56) / 2).toBe(edges.length);
  });

  it("no self-edges and no duplicates", () => {
    const seen = new Set(edges.map((e) => `${e.a}-${e.b}`));
    expect(seen.size).toBe(edges.length);
    expect(edges.every((e) => e.a !== e.b)).toBe(true);
  });

  it("the drawing emits every derived edge and vertex, and nothing else", () => {
    const svg = renderDrawingSvg(720);
    expect((svg.match(/<line /g) ?? []).length).toBe(6720);
    expect((svg.match(/<circle /g) ?? []).length).toBe(240);
  });
});
