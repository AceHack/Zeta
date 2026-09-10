import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { e8Roots, projectRoots } from "./clifford-e8-coxeter-projection.ts";
import {
  assertExactLattice,
  boundaryLatticePoints,
  claimsBoundary,
  coxeterOrbitIndexSets,
  EXACT_COORD_BOUND,
  fanPartitionReport,
  fanTriangles,
  isConvexCcw,
  latticePointCount,
  type Lattice2,
  MIN_LATTICE_SCALE,
  outerProduct,
  pickResidual,
  PROOF_LATTICE_SCALE,
  renderCoverageSpans,
  renderFilledSvg,
  ringPolygons,
  rowSpan,
  snap,
  twiceArea,
} from "./clifford-e8-exact-coverage.ts";

/**
 * Measured at `PROOF_LATTICE_SCALE`, ring 0 outward. Written down so a construction that
 * silently changes shape fails loudly instead of quietly producing different pretty
 * numbers. Every entry was measured, none was predicted.
 */
const MEASURED = [
  { twiceArea: 23757568, boundary: 972, interior: 11878299, coverage: 11878784 },
  { twiceArea: 62199212, boundary: 1716, interior: 31098749, coverage: 31099606 },
  { twiceArea: 93991952, boundary: 1668, interior: 46995143, coverage: 46995976 },
  { twiceArea: 137406320, boundary: 2044, interior: 68702139, coverage: 68703160 },
  { twiceArea: 207639628, boundary: 2604, interior: 103818513, coverage: 103819814 },
  { twiceArea: 246076388, boundary: 2676, interior: 123036857, coverage: 123038194 },
  { twiceArea: 359703540, boundary: 3260, interior: 179850141, coverage: 179851770 },
  { twiceArea: 543567036, boundary: 3944, interior: 271781547, coverage: 271783518 },
] as const;

describe("rung 4 — the regions are derived, and the derivation is checkable", () => {
  // ── FALSIFIER 1: PROVENANCE ──────────────────────────────────────────────
  //
  // Aaron's constraint — "our rendering surface should only come from our clifford" —
  // as a test rather than as a promise. Every vertex of every filled region carries the
  // index of the E8 root it is the snapped projection of, the eight index sets are
  // exactly the eight Coxeter orbits, and together they account for all 240 roots. A
  // hand-placed vertex has no root index and cannot pass this; a vertex borrowed from
  // the wrong ring breaks the orbit match.
  it("every vertex is a snapped root, and every ring is exactly one Coxeter orbit", () => {
    const polygons = ringPolygons();
    const orbits = coxeterOrbitIndexSets().map((o) => o.join(","));
    expect(polygons.length).toBe(8);
    const seen = new Set<number>();
    for (const polygon of polygons) {
      expect(polygon.vertices.length).toBe(30);
      expect(polygon.rootIndices.length).toBe(30);
      const key = [...polygon.rootIndices].sort((a, b) => a - b).join(",");
      expect(orbits).toContain(key);
      for (const i of polygon.rootIndices) seen.add(i);
      // And the vertex really is that root's projection, snapped — not merely near it.
      const projected = projectRoots(e8Roots());
      polygon.rootIndices.forEach((rootIndex, k) => {
        const p = projected[rootIndex];
        if (p === undefined) throw new Error("missing projection");
        expect(polygon.vertices[k]).toEqual(snap(p.x, p.y, polygon.scale));
      });
    }
    expect(seen.size).toBe(240);
  });

  it("the polygons are convex and counter-clockwise, which the span solver relies on", () => {
    for (const polygon of ringPolygons()) expect(isConvexCcw(polygon.vertices)).toBe(true);
    // Reversing the winding must be detected: convexity here means CCW convexity, and a
    // clockwise polygon would silently invert every coverage test downstream.
    const reversed = [...(ringPolygons()[0]?.vertices ?? [])].reverse();
    expect(isConvexCcw(reversed)).toBe(false);
  });

  // ── FALSIFIER 2: PICK'S THEOREM ──────────────────────────────────────────
  //
  // 2A = 2I + B - 2, exactly, with no tolerance. The three quantities come from three
  // unrelated computations — the shoelace blade sum, the rasterizer's own strict-interior
  // classification, and a gcd count over edges — so this checks the rasterizer against an
  // external theorem (Pick, 1899) rather than against itself. An off-by-one fill rule, a
  // wrong floor/ceil division, or a lost boundary point moves the residual off zero.
  it("Pick's residual is exactly zero for all eight derived regions", () => {
    const polygons = ringPolygons();
    polygons.forEach((polygon, i) => {
      const expected = MEASURED[i];
      if (expected === undefined) throw new Error("missing measurement");
      expect(twiceArea(polygon.vertices)).toBe(expected.twiceArea);
      expect(boundaryLatticePoints(polygon.vertices)).toBe(expected.boundary);
      expect(latticePointCount(polygon.vertices, "interior")).toBe(expected.interior);
      expect(pickResidual(polygon.vertices)).toBe(0);
    });
  });

  it("Pick's residual is exactly zero for all 224 fan triangles too", () => {
    // The polygons are large and smooth, so they are the easy case. The fan triangles
    // are long and thin and include the degenerate-looking slivers next to the apex,
    // which is where an integer-division sign error actually shows up.
    let triangles = 0;
    for (const polygon of ringPolygons()) {
      for (const triangle of fanTriangles(polygon.vertices, 0)) {
        expect(pickResidual(triangle)).toBe(0);
        triangles++;
      }
    }
    expect(triangles).toBe(8 * 28);
  });

  // ── FALSIFIER 3: THE PARTITION ───────────────────────────────────────────
  //
  // The oldest rasterizer bug there is, in both directions at once: a fill rule that is
  // too generous double-covers every shared edge, and one that is too strict leaves a
  // crack along it. Splitting each region into a fan and demanding that the pieces
  // partition the whole — same total, no overlapping span, no gap, endpoints flush —
  // catches both, and catches them separately so neither can hide behind the other.
  //
  // The apex is a gauge, exactly as rung 3's z-axis was. "It does not matter" is
  // asserted rather than assumed: all thirty apexes of all eight regions, 240 distinct
  // triangulations, must produce the identical count of the identical point set.
  it("every fan triangulation partitions its region exactly, for all 240 apex choices", () => {
    const polygons = ringPolygons();
    polygons.forEach((polygon, i) => {
      const expected = MEASURED[i];
      if (expected === undefined) throw new Error("missing measurement");
      const totals = new Set<number>();
      for (let apex = 0; apex < polygon.vertices.length; apex++) {
        const report = fanPartitionReport(polygon.vertices, apex);
        expect(report.overlaps).toBe(0);
        expect(report.cracks).toBe(0);
        expect(report.covered).toBe(report.whole);
        totals.add(report.covered);
      }
      expect([...totals]).toEqual([expected.coverage]);
    });
  }, 30_000);

  // ── FALSIFIER 4: THE FILL RULE IS EXCLUSIVE BY CONSTRUCTION ──────────────
  //
  // The partition above is a consequence; this is the property it is a consequence OF.
  // Two regions sharing an edge see it with opposite direction, so the rule settles the
  // shared points if and only if exactly one of every direction pair satisfies it.
  // Loosening it to `dy >= 0` makes both sides claim the horizontal case; tightening it
  // to drop the `dy === 0` clause makes neither.
  it("exactly one of every direction pair claims its boundary", () => {
    let pairs = 0;
    for (let dx = -40; dx <= 40; dx++) {
      for (let dy = -40; dy <= 40; dy++) {
        if (dx === 0 && dy === 0) continue;
        expect(claimsBoundary(dx, dy)).not.toBe(claimsBoundary(-dx, -dy));
        pairs++;
      }
    }
    expect(pairs).toBe(81 * 81 - 1);
  });

  // ── FALSIFIER 5: THE EXACTNESS GUARDS REFUSE ─────────────────────────────
  //
  // An unenforced precision claim is the vacuity class, so the bound and the scale floor
  // are tested by their refusals rather than by their prose.
  it("refuses coordinates that would leave the exact-integer regime", () => {
    expect(() => assertExactLattice([{ x: 1, y: 2 }])).not.toThrow();
    expect(() => assertExactLattice([{ x: 1.5, y: 2 }])).toThrow(/non-integer/);
    expect(() => assertExactLattice([{ x: EXACT_COORD_BOUND + 1, y: 0 }])).toThrow(/exact bound/);
    expect(() => assertExactLattice([{ x: 0, y: -EXACT_COORD_BOUND - 1 }])).toThrow(/exact bound/);
  });

  it("refuses a lattice scale below the floor the snap needs", () => {
    expect(() => ringPolygons(MIN_LATTICE_SCALE - 1)).toThrow(/lattice scale/);
    expect(() => ringPolygons(64)).toThrow(/lattice scale/);
    expect(() => ringPolygons(1024.5)).toThrow(/lattice scale/);
    expect(() => ringPolygons(MIN_LATTICE_SCALE)).not.toThrow();
  });

  it("the floor is not decorative — below it the snap destroys convexity", () => {
    // The refusal above only matters if something actually breaks underneath it. Snapping
    // by hand at scale 64 (bypassing the guard) puts the smallest ring out of convex
    // position; at 128 and above it recovers. Measured, not assumed.
    const projected = projectRoots(e8Roots());
    const smallest = ringPolygons(MIN_LATTICE_SCALE)[0];
    if (smallest === undefined) throw new Error("no ring 0");
    const at = (scale: number): Lattice2[] =>
      smallest.rootIndices.map((i) => snap(projected[i]?.x ?? 0, projected[i]?.y ?? 0, scale));
    expect(isConvexCcw(at(64))).toBe(false);
    expect(isConvexCcw(at(128))).toBe(true);
    expect(isConvexCcw(at(MIN_LATTICE_SCALE))).toBe(true);
  });

  // ── FALSIFIER 6: NONINTERFERENCE (§13) ───────────────────────────────────
  //
  // Entropy and influence enter only through declared channels, so the module may not
  // reach for an ambient clock, an ambient RNG, or the environment. Comments are stripped
  // before the scan and the CALL form is matched, because prose about not using a clock
  // has satisfied guards of this shape before.
  it("the module reaches for no ambient entropy", () => {
    const path = new URL("./clifford-e8-exact-coverage.ts", import.meta.url).pathname;
    const source = readFileSync(path, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(source).not.toContain("Math.random(");
    expect(source).not.toContain("Date.now(");
    expect(source).not.toContain("new Date(");
    expect(source).not.toContain("performance.now(");
    expect(source).not.toContain("process.env");
    // Control: the stripper must not have eaten the file. `Math.round(` is the snap, and
    // it is the one call that has to survive.
    expect(source).toContain("Math.round(");
    expect(source.length).toBeGreaterThan(2000);
  });

  // ── FALSIFIER 7: DST — REPLAY AND TRANSLATION ────────────────────────────
  //
  // Byte-identical replay is the cheap half. The half with teeth is translation
  // invariance at the far end of the exact range: coverage is a function of edge
  // directions and lattice offsets only, so shifting a region by a million units must not
  // move a single point. A float pipeline loses this exactly there.
  it("replays byte-identically and is exactly translation-invariant", () => {
    expect(ringPolygons()).toEqual(ringPolygons());
    const largest = ringPolygons()[7];
    if (largest === undefined) throw new Error("no ring 7");
    expect(renderCoverageSpans(largest.vertices)).toBe(renderCoverageSpans(largest.vertices));
    const base = latticePointCount(largest.vertices, "coverage");
    expect(base).toBe(271783518);
    for (const shift of [1, 12345, 1038576]) {
      const moved = largest.vertices.map((p) => ({ x: p.x + shift, y: p.y - shift }));
      assertExactLattice(moved);
      expect(latticePointCount(moved, "coverage")).toBe(base);
      const row = rowSpan(largest.vertices, 0, "coverage");
      const movedRow = rowSpan(moved, -shift, "coverage");
      if (row === null || movedRow === null) throw new Error("empty row at y = 0");
      expect(movedRow.lo - row.lo).toBe(shift);
      expect(movedRow.hi - row.hi).toBe(shift);
    }
  });

  // ── FALSIFIER 8: THE COINCIDENCE, WITH ITS SCOPE ─────────────────────────
  //
  // Measured: the exclusive fill rule lights exactly `A` lattice points on each of the
  // eight regions — coverage equals area, as integers, on the nose. That is a striking
  // number and it is recorded as a MEASUREMENT, not promoted to a law, because the same
  // test exhibits a counterexample: the unit triangle has 2A = 1 and coverage 0. So the
  // identity is a property of these figures (Pick, plus an even boundary count), not of
  // lattice polygons in general. Numerology vs number theory, kept honest in the file
  // that would otherwise be tempted.
  it("coverage equals area on the eight regions — and NOT in general", () => {
    ringPolygons().forEach((polygon, i) => {
      const expected = MEASURED[i];
      if (expected === undefined) throw new Error("missing measurement");
      const coverage = latticePointCount(polygon.vertices, "coverage");
      expect(coverage).toBe(expected.coverage);
      expect(2 * coverage).toBe(expected.twiceArea);
      expect(expected.boundary % 2).toBe(0);
    });
    const unitTriangle: Lattice2[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ];
    expect(outerProduct(unitTriangle[0]!, unitTriangle[1]!, unitTriangle[2]!)).toBe(1);
    expect(twiceArea(unitTriangle)).toBe(1);
    expect(pickResidual(unitTriangle)).toBe(0);
    expect(latticePointCount(unitTriangle, "coverage")).toBe(0);
  });
});

describe("rung 4 — the artifacts", () => {
  it("emits a filled SVG with one polygon per derived ring", () => {
    const svg = renderFilledSvg();
    expect((svg.match(/<polygon /g) ?? []).length).toBe(8);
    // 8 rings * 30 vertices, each written as "x,y".
    expect((svg.match(/-?\d+\.\d\d,-?\d+\.\d\d/g) ?? []).length).toBe(240);
    expect(svg).toContain('fill-rule="evenodd"');
  });

  // The first draft of this test predicted one row per scanline in the vertex range and
  // was wrong by one, which is the whole reason the rule's asymmetry is asserted here
  // rather than assumed. Measured: the bottom extreme scanline is NEVER lit, because its
  // edges run rightward or downward and the exclusive rule hands them to the neighbour
  // below; the top extreme is lit exactly when the extremum is a horizontal edge (claimed
  // by the `dy === 0 && dx < 0` clause) rather than a single vertex. Rings 0, 1, 4 and 7
  // have such a top edge; rings 2, 3, 5 and 6 do not.
  it("emits coverage spans as text, and the fill rule's asymmetry is visible in them", () => {
    ringPolygons().forEach((polygon, i) => {
      const expected = MEASURED[i];
      if (expected === undefined) throw new Error("missing measurement");
      const text = renderCoverageSpans(polygon.vertices);
      const rows = text.split("\n").filter((line) => line !== "" && !line.startsWith("#"));
      const ys = polygon.vertices.map((p) => p.y);
      const first = Math.min(...ys);
      const last = Math.max(...ys);
      const present = new Set<number>();
      let total = 0;
      for (const row of rows) {
        const [y, lo, hi] = row.split(" ").map(Number);
        if (y === undefined || lo === undefined || hi === undefined) throw new Error(`bad row ${row}`);
        expect(Number.isInteger(y) && Number.isInteger(lo) && Number.isInteger(hi)).toBe(true);
        expect(hi).toBeGreaterThanOrEqual(lo);
        present.add(y);
        total += hi - lo + 1;
      }
      // No holes anywhere in the interior of the range: a missing row there is a crack.
      for (let y = first + 1; y < last; y++) expect(present.has(y)).toBe(true);
      // The bottom extreme is always excluded.
      expect(present.has(first)).toBe(false);
      // The top extreme is included exactly when a horizontal edge sits on it.
      const hasTopEdge = polygon.vertices.some((a, k) => {
        const b = polygon.vertices[(k + 1) % polygon.vertices.length];
        return b !== undefined && a.y === last && b.y === last;
      });
      expect(present.has(last)).toBe(hasTopEdge);
      // The text artifact and the counted coverage are the same measurement.
      expect(total).toBe(expected.coverage);
    });
  });

  it("the proof scale is well inside the exact bound", () => {
    expect(PROOF_LATTICE_SCALE).toBeGreaterThanOrEqual(MIN_LATTICE_SCALE);
    for (const polygon of ringPolygons()) assertExactLattice(polygon.vertices);
  });
});
