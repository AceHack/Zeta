/**
 * Falsifiers for the delta-hyperbolicity measurement (Lumen, 2026-08-20).
 *
 * Every test here pins the implementation against a structure whose answer is known in CLOSED
 * FORM, so a transcription error in the four-point condition goes red rather than producing a
 * plausible number. The grid and cycle tests are the load-bearing ones: they are the cases a
 * wrong `quadrupleDelta` (e.g. one that used the smallest sum instead of the middle one) would
 * report as hyperbolic.
 */

import { expect, it } from "bun:test";
import {
  ALPHA_MAX,
  articulationPoints,
  balancedTree,
  bfs,
  configurationNull,
  cycle,
  degrees,
  edgeCount,
  erdosRenyiNull,
  fitPowerLaw,
  graphFromEdges,
  grid,
  largestComponent,
  quadrupleDelta,
  Rng,
  sampleDelta,
} from "./gromov-hyperbolicity.ts";

// -- the four-point condition itself -----------------------------------------------------------

it("quadrupleDelta uses the MIDDLE sum, not the smallest (the classic transcription bug)", () => {
  // Sums 10, 6, 2 -> L=10, M=6 -> delta = 2. If the smallest were used it would be 4.
  // d(x,y)+d(z,w)=10, d(x,z)+d(y,w)=6, d(x,w)+d(y,z)=2
  expect(quadrupleDelta(5, 5, 3, 3, 1, 1)).toBe(2);
});

it("quadrupleDelta is 0 when the two largest sums tie (the tree signature)", () => {
  expect(quadrupleDelta(4, 4, 4, 4, 2, 2)).toBe(0);
});

// -- calibration anchors with known answers ----------------------------------------------------

it("a tree is EXACTLY 0-hyperbolic -- no quadruple can witness anything", () => {
  const t = balancedTree(3, 5); // 364 nodes
  const r = sampleDelta(t, 200_000, 0xbeefn);
  expect(r.sampled).toBeGreaterThan(100_000);
  expect(r.deltaMaxObserved).toBe(0);
  expect(r.deltaRelative).toBe(0);
});

it("a path is 0-hyperbolic -- the tower shape is a path, not a branching tree", () => {
  // The Cayley-Dickson and Futamura 'towers' are PATHS, not branching trees. This test pins
  // only delta=0. Distortion 1 is the theorem (standard metric geometry), not instrumented.
  const edges: [string, string][] = [];
  for (let i = 0; i < 60; i++) edges.push([`${i}`, `${i + 1}`]);
  const p = graphFromEdges(edges);
  expect(sampleDelta(p, 100_000, 7n).deltaMaxObserved).toBe(0);
});

it("the k x k grid is NOT hyperbolic -- delta grows with k", () => {
  const d12 = sampleDelta(grid(12), 200_000, 1n).deltaMaxObserved;
  const d24 = sampleDelta(grid(24), 200_000, 1n).deltaMaxObserved;
  expect(d12).toBeGreaterThan(2);
  expect(d24).toBeGreaterThan(d12);
});

it("the cycle C_k has delta ~ k/4 -- flat, the other non-hyperbolic anchor", () => {
  const k = 64;
  const r = sampleDelta(cycle(k), 200_000, 3n);
  // Exact: delta_max(C_k) = floor(k/4) / 1 for the four-point condition on evenly spaced points.
  expect(r.deltaMaxObserved).toBeGreaterThanOrEqual(k / 4 - 1);
  expect(r.deltaMaxObserved).toBeLessThanOrEqual(k / 4 + 1);
});

it("deltaRelative separates the anchors even though raw delta does not compare across scales", () => {
  // A big tree and a small grid can have similar RAW delta ordering by accident; the normalised
  // form is the one that is dimensionally sound.
  expect(sampleDelta(balancedTree(2, 8), 100_000, 5n).deltaRelative).toBe(0);
  expect(sampleDelta(grid(20), 100_000, 5n).deltaRelative).toBeGreaterThan(0.3);
});

// -- graph plumbing ----------------------------------------------------------------------------

it("graphFromEdges drops self-loops and duplicates so the degree sequence is honest", () => {
  const g = graphFromEdges([
    ["a", "b"],
    ["b", "a"],
    ["a", "a"],
  ]);
  expect(g.n).toBe(2);
  expect(edgeCount(g)).toBe(1);
  expect(degrees(g)).toEqual([1, 1]);
});

it("bfs returns -1 for unreachable nodes rather than silently reporting 0", () => {
  const g = graphFromEdges([
    ["a", "b"],
    ["c", "d"],
  ]);
  const d = bfs(g, 0);
  expect(d[1]).toBe(1);
  expect(d[2]).toBe(-1);
});

it("largestComponent keeps only the biggest piece and preserves its edges", () => {
  const g = graphFromEdges([
    ["a", "b"],
    ["b", "c"],
    ["x", "y"],
  ]);
  const lcc = largestComponent(g);
  expect(lcc.n).toBe(3);
  expect(edgeCount(lcc)).toBe(2);
});

// -- null models -------------------------------------------------------------------------------

it("configurationNull preserves the degree sequence EXACTLY (that is its whole job)", () => {
  const g = balancedTree(3, 4);
  const before = degrees(g).sort((a, b) => a - b);
  const nullG = configurationNull(g, 42n);
  const after = degrees(nullG).sort((a, b) => a - b);
  expect(after).toEqual(before);
});

it("configurationNull actually rewires -- a null that returns the input would be vacuous", () => {
  const g = grid(10);
  const nullG = configurationNull(g, 9n);
  // Same n and m, but the grid's delta should collapse once the lattice structure is destroyed.
  expect(nullG.n).toBe(g.n);
  expect(edgeCount(nullG)).toBe(edgeCount(g));
  const dGrid = sampleDelta(largestComponent(g), 100_000, 11n).deltaRelative;
  const dNull = sampleDelta(largestComponent(nullG), 100_000, 11n).deltaRelative;
  expect(dNull).toBeLessThan(dGrid);
});

it("erdosRenyiNull hits the requested edge count", () => {
  const g = erdosRenyiNull(200, 400, 17n);
  expect(g.n).toBe(200);
  expect(edgeCount(g)).toBe(400);
});

// -- determinism (DST) -------------------------------------------------------------------------

it("the same seed replays the same measurement, byte for byte", () => {
  const g = grid(15);
  const a = sampleDelta(g, 50_000, 0x5eedn);
  const b = sampleDelta(g, 50_000, 0x5eedn);
  expect(a).toEqual(b);
});

it("Rng is a deterministic stream and different seeds diverge", () => {
  const a = new Rng(1n);
  const b = new Rng(1n);
  const c = new Rng(2n);
  const sa = [a.next(), a.next(), a.next()];
  expect([b.next(), b.next(), b.next()]).toEqual(sa);
  expect([c.next(), c.next(), c.next()]).not.toEqual(sa);
});

// -- power-law fit -----------------------------------------------------------------------------

it("fitPowerLaw recovers alpha on synthetic Zipf data within its own stated error bar", () => {
  // Inverse-transform sample from a discrete power law with alpha = 2.5, xmin = 1.
  const rng = new Rng(0xa11cen);
  const alphaTrue = 2.5;
  const data: number[] = [];
  for (let i = 0; i < 5000; i++) {
    const u = rng.nextFloat();
    data.push(Math.max(1, Math.round((1 - u) ** (-1 / (alphaTrue - 1)) - 0.5)));
  }
  const fit = fitPowerLaw(data);
  expect(fit).not.toBeNull();
  expect(Math.abs(fit!.alpha - alphaTrue)).toBeLessThan(0.25);
});

it("fitPowerLaw reports a LARGE KS distance on data that is not a power law -- the CSN point", () => {
  // Poisson-ish degrees: a fitted alpha will always exist; the KS distance is what refuses it.
  const rng = new Rng(0xdeadn);
  const data: number[] = [];
  for (let i = 0; i < 3000; i++) {
    let k = 0;
    let p = 1;
    const lam = 8;
    const limit = Math.exp(-lam);
    do {
      k++;
      p *= rng.nextFloat();
    } while (p > limit);
    data.push(k);
  }
  const poisson = fitPowerLaw(data)!;
  const zipf: number[] = [];
  for (let i = 0; i < 3000; i++) zipf.push(Math.max(1, Math.round((1 - rng.nextFloat()) ** (-1 / 1.5) - 0.5)));
  const power = fitPowerLaw(zipf)!;
  expect(poisson.ks).toBeGreaterThan(power.ks);
});

// -- regression: the runaway refinement bound (found 2026-08-20 by a calibration anchor) --------
//
// The refinement loop originally read `a <= bestAlpha + 0.01` while its body assigned to
// `bestAlpha`. On a tail with no variation the likelihood increases monotonically in alpha, so
// the bound advanced every iteration and the loop ran to float saturation: the balanced-tree
// anchor reported alpha = 112.25 from a grid capped at 6.0. The bug was invisible on real data
// and only surfaced because an anchor with a KNOWN-degenerate degree distribution was in the
// same table. That is what the anchors are for.

it("fitPowerLaw never returns an alpha above its own search grid", () => {
  const g = balancedTree(3, 6);
  const fit = fitPowerLaw(degrees(g).filter((d) => d > 0));
  expect(fit).not.toBeNull();
  expect(fit!.alpha).toBeLessThanOrEqual(ALPHA_MAX);
});

it("fitPowerLaw REFUSES a degenerate tail rather than reporting a perfect fit", () => {
  // 400 copies of one value: alpha -> infinity and KS -> 0, i.e. a fit that cannot fail.
  const degenerate = new Array(400).fill(7);
  const fit = fitPowerLaw(degenerate);
  expect(fit).toBeNull();
});

it("a regular graph gets a LARGE KS -- the fitter refuses it instead of inventing an exponent", () => {
  const c = cycle(300); // every degree is exactly 2
  const fit = fitPowerLaw(degrees(c));
  // Either refused outright, or fitted with a KS so large the fit is meaningless.
  expect(fit === null || fit.ks > 0.15).toBe(true);
});

// -- articulation points (the exact oracle/hub discriminator) -----------------------------------

it("articulationPoints finds the cut vertex of a path and of a bowtie", () => {
  // a - b - c : b is the only cut vertex.
  const path = graphFromEdges([
    ["a", "b"],
    ["b", "c"],
  ]);
  expect(articulationPoints(path).map((i) => path.labels![i])).toEqual(["b"]);
  // Two triangles sharing one vertex: the shared vertex is the cut, nothing else is.
  const bowtie = graphFromEdges([
    ["a", "b"],
    ["b", "c"],
    ["c", "a"],
    ["c", "d"],
    ["d", "e"],
    ["e", "c"],
  ]);
  expect(articulationPoints(bowtie).map((i) => bowtie.labels![i])).toEqual(["c"]);
});

it("a cycle has NO articulation points -- everything is routable-around", () => {
  expect(articulationPoints(cycle(50))).toEqual([]);
});

it("every internal node of a tree is a cut vertex, leaves are not", () => {
  const t = balancedTree(2, 3); // 15 nodes: 1 root + 6 internal + 8 leaves
  const cuts = articulationPoints(t);
  // 7 non-leaf nodes are cuts; the 8 leaves are not.
  expect(cuts.length).toBe(7);
});

it("articulationPoints survives a 13k-deep path without blowing the stack", () => {
  // The commit DAG is this shape. A recursive DFS crashes here; the measurement must not.
  const edges: [string, string][] = [];
  for (let i = 0; i < 13_000; i++) edges.push([`${i}`, `${i + 1}`]);
  const deep = graphFromEdges(edges);
  expect(articulationPoints(deep).length).toBe(12_999);
});

it("a high-degree hub with a redundant path is NOT a cut vertex -- degree is not the discriminator", () => {
  // h is adjacent to everything (degree 5) but a-b-c-d-e also forms a cycle around it.
  const edges: [string, string][] = [
    ["h", "a"],
    ["h", "b"],
    ["h", "c"],
    ["h", "d"],
    ["h", "e"],
    ["a", "b"],
    ["b", "c"],
    ["c", "d"],
    ["d", "e"],
    ["e", "a"],
  ];
  const g = graphFromEdges(edges);
  expect(articulationPoints(g)).toEqual([]);
});
