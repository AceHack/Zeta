// shape-occupancy-skeleton.test.ts — falsifiers for the vector-catalog perceptual quotient.
//
// The discipline this file answers to: a guard that only ever passes is not a guard. Every
// claim below is shown BOTH firing on a positive and staying quiet on a control, and the
// SABOTAGE section demonstrates the one thing that justifies this file existing at all —
// that SHA-256 byte identity (TIER 0) is blind to the defect this measures.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseSvg,
  raster,
  gridDims,
  blur,
  centre,
  correlation,
  comparePair,
  QUOTIENT_RADII,
  GRID,
} from "./shape-occupancy-skeleton.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const golden = (n: string) => readFileSync(join(repoRoot, "db", "shapes", "golden", `${n}.svg`), "utf8");
function load(n: string) {
  const doc = parseSvg(golden(n));
  const { gw, gh } = gridDims(doc, GRID);
  return { grid: raster(doc, GRID), gw, gh, doc };
}
const pair = (a: string, b: string) => {
  const A = load(a),
    B = load(b);
  return comparePair(a, A.grid, b, B.grid, A.gw, A.gh);
};

describe("the metric is well-formed", () => {
  test("identity saturates at 1.0 at every radius in the family", () => {
    const A = load("crossing");
    for (const r of QUOTIENT_RADII) {
      const v = centre(blur(A.grid, A.gw, A.gh, r));
      expect(correlation(v, v)).toBeCloseTo(1, 10);
    }
  });

  test("a blank grid correlates with nothing (degenerate input does not score)", () => {
    const A = load("crossing");
    const blank = centre(new Float64Array(A.gw * A.gh));
    expect(correlation(centre(A.grid), blank)).toBeCloseTo(0, 10);
  });

  test("CONTROL: disjoint synthetic bars are anti-correlated, not merely low", () => {
    const gw = 64,
      gh = 32;
    const bar = (x0: number) => {
      const g = new Float64Array(gw * gh);
      for (let y = 4; y < 28; y++) for (let x = x0; x < x0 + 3; x++) g[y * gw + x] = 1;
      return g;
    };
    const r = correlation(centre(blur(bar(6), gw, gh, 4)), centre(blur(bar(55), gw, gh, 4)));
    expect(r).toBeLessThan(0);
  });

  test("the grid has square cells: a 640x320 viewBox rasters 64x32, not 64x64", () => {
    const { gw, gh } = gridDims(parseSvg(golden("crossing")), 64);
    expect([gw, gh]).toEqual([64, 32]);
  });

  test("coverage is reported, never silently assumed: non-polyline elements are named", () => {
    const doc = parseSvg(golden("quantum-circuit-mach-zehnder-closed"));
    expect(doc.polys.length).toBe(0);
    expect(doc.unparsed.length).toBeGreaterThan(0);
  });
});

describe("the two defect signatures are distinguishable, and both are live on main", () => {
  // GLANCE-ONLY: near-unrelated at exact geometry, near-identical to a glance. An exact
  // comparison is structurally blind to this class.
  test("crossing ~ lightcone is GLANCE-ONLY (low at r=0, high at r=4, steep slope)", () => {
    const p = pair("crossing", "lightcone");
    expect(p.curve[0]!).toBeLessThan(0.3); // a machine comparing renders sees little
    expect(p.sup).toBeGreaterThan(0.7); // a glance sees one picture
    expect(p.slope).toBeGreaterThan(0.4); // and the gap between them is the diagnostic
  });

  // BOTH-READERS: high everywhere, including at exact geometry.
  test("braid ~ plait-move is BOTH-READERS (already high at r=0, shallow slope)", () => {
    const p = pair("braid", "plait-move");
    expect(p.curve[0]!).toBeGreaterThan(0.5);
    expect(p.slope).toBeLessThan(0.4);
  });

  test("the two signatures are not the same measurement wearing two names", () => {
    const glance = pair("crossing", "lightcone");
    const both = pair("braid", "plait-move");
    // Comparable sup, opposite slope regime — sup alone could not tell them apart.
    expect(Math.abs(glance.sup - both.sup)).toBeLessThan(0.15);
    expect(glance.slope).toBeGreaterThan(both.slope + 0.4);
  });

  test("CONTROL: a genuinely distinct pair stays quiet at every radius", () => {
    const p = pair("seam", "shadow-loop");
    expect(p.sup).toBeLessThan(0.3);
  });
});

describe("SABOTAGE — why byte identity cannot replace this", () => {
  // The claim that justifies this file: TIER 0 of audit-visual-confusability.ts compares
  // SHA-256 digests. Perturb one coordinate of a shape and the digest changes completely,
  // so TIER 0 goes silent — while the picture, and therefore the confusion, is untouched.
  test("a one-coordinate edit defeats SHA-256 identity and does not move the occupancy metric", () => {
    const src = golden("crossing");
    const nudged = src.replace('points="245,65 405,265"', 'points="246,65 405,265"');
    expect(nudged).not.toBe(src); // the edit landed

    const shaBefore = createHash("sha256").update(src).digest("hex");
    const shaAfter = createHash("sha256").update(nudged).digest("hex");
    expect(shaAfter).not.toBe(shaBefore); // TIER 0: now reads as a different shape entirely

    const A = load("crossing");
    const docB = parseSvg(nudged);
    const { gw, gh } = gridDims(docB, GRID);
    const r = correlation(centre(blur(A.grid, A.gw, A.gh, 4)), centre(blur(raster(docB, GRID), gw, gh, 4)));
    expect(r).toBeGreaterThan(0.99); // the eye's answer did not change at all
  });

  test("the metric is not vacuous: it separates most of the catalog", () => {
    // If everything scored high the tool would flag nothing usefully. The median pair must sit
    // well below the flagged pairs, or the top of the ranking means nothing.
    const names = ["crossing", "lightcone", "braid", "plait-move", "seam", "shadow-loop", "spiral", "worldline"];
    const sups: number[] = [];
    for (let i = 0; i < names.length; i++)
      for (let j = i + 1; j < names.length; j++) sups.push(pair(names[i]!, names[j]!).sup);
    sups.sort((a, b) => a - b);
    const median = sups[Math.floor(sups.length / 2)]!;
    expect(median).toBeLessThan(0.5);
    expect(Math.max(...sups)).toBeGreaterThan(0.7);
  });
});
