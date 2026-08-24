#!/usr/bin/env bun
// shape-occupancy-skeleton.ts — the perceptual quotient extended from GLYPHS to the VECTOR
// SHAPE CATALOG, and measured at more than one coarseness.
//
// WHY THIS FILE EXISTS
// --------------------
// `visual-skeleton.ts` models the quotient for single glyphs, by table lookup on Unicode's
// normative names. That construction cannot reach `db/shapes/golden/*.svg`: those marks have no
// codepoint and no name to decompose. The only check the catalog had was TIER 0 of
// `audit-visual-confusability.ts` — SHA-256 byte identity — which is the weakest check that can
// be written. It fires only when two shapes are the SAME FILE. One differing coordinate and it
// is silent, for any pair, however identical they look.
//
// `docs/design/2026-08-19-confusable-shapes-*.md` §12.3 left that gap open on purpose and filed
// it (`081M0DN91SH087G0R003NKKCTB`). This file closes the MEASUREMENT half of it.
//
// THE CONSTRUCTION
// ----------------
// 19 of 23 goldens are pure `<polyline>`, so an exact rasteriser is ~40 lines and needs no
// dependency. Stroke centrelines are walked into a GxG occupancy grid normalised to the
// viewBox, then low-passed by a separable box blur of radius r. `r` IS the quotient parameter:
// r = 0 is exact geometry (what a machine comparing renders sees); larger r is a coarser look.
//
// Similarity is the MEAN-CENTRED correlation, not raw cosine. This correction is load-bearing:
// blurred line art is mostly a bright blob in the middle of the frame, so raw cosine gives
// every pair a floor near 0.6 and ranks nothing. Centring removes that DC component. With it,
// the median catalog pair sits at r = 0.155 and the flagged pairs are genuine outliers.
//
// WHAT THE SWEEP BUYS — the reason this reports a CURVE and not a number
// ---------------------------------------------------------------------
// A single coarseness cannot express the finding. Two pairs in the live catalog:
//
//     crossing ~ lightcone    r=0: 0.132   r=8: 0.879     <- diverges with coarseness
//     braid    ~ plait-move   r=0: 0.680   r=8: 0.778     <- high everywhere
//
// Those are different defects. The first is invisible to an exact comparison and severe to a
// glance; the second is severe to both. A guard reporting only one column would either miss the
// first or be unable to tell them apart. So the quantity that matters is the SUPREMUM over the
// declared quotient family, and the SLOPE is the diagnostic that says which reader is at risk.
//
// REGISTER — read before quoting any number here
// ----------------------------------------------
// `unmetered`, and specifically: the correlation values are exact and reproducible (given the
// files, they are arithmetic), but the claim that a given value CORRESPONDS TO HUMAN CONFUSION
// is a model with no measured threshold behind it. No forced-choice trial has been run. Read a
// high value as "these two were not separated by a channel we have evidence survives a glance",
// never as an error rate.
//
// KNOWN LIMITS, stated because a guard that hides them is worse than none:
//   - Centrelines only; stroke WIDTH is ignored. This makes drawn gaps read as WIDER than they
//     render, so the metric UNDER-states the confusability of gap-separated pairs — the
//     conservative direction is the wrong way round for exactly the `crossing` case below.
//   - Colour is ignored entirely. That is deliberate and matches the criterion ("a distinction
//     carried only by hue is not a distinction"), not an oversight.
//   - The 4 `quantum-circuit-*.svg` goldens use <path>/<rect>/<text> and are REPORTED AS
//     UNAUDITED rather than silently skipped.
//   - A box blur is not a model of the human contrast sensitivity function. It is a declared
//     low-pass, chosen because it is auditable in 6 lines.

export interface Poly {
  readonly pts: readonly (readonly [number, number])[];
}
export interface ShapeDoc {
  readonly w: number;
  readonly h: number;
  readonly polys: readonly Poly[];
  /** Elements present that this parser cannot rasterise. Non-empty => coverage is partial. */
  readonly unparsed: readonly string[];
}

const RASTERISABLE = /<(path|rect|circle|ellipse|polygon|line|text)\b/g;

export function parseSvg(src: string): ShapeDoc {
  const vb = /viewBox="([\d.\-\s]+)"/.exec(src);
  const parts = vb?.[1] ? vb[1].trim().split(/\s+/).map(Number) : [0, 0, 100, 100];
  const w = parts[2] || 100;
  const h = parts[3] || 100;
  const polys: Poly[] = [];
  for (const m of src.matchAll(/<polyline[^>]*points="([^"]+)"/g)) {
    const nums = (m[1] ?? "")
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter((n) => Number.isFinite(n));
    const pts: [number, number][] = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i]!, nums[i + 1]!]);
    if (pts.length >= 2) polys.push({ pts });
  }
  const unparsed = [...new Set([...src.matchAll(RASTERISABLE)].map((m) => m[1]!))];
  return { w, h, polys, unparsed };
}

/** Grid dimensions with SQUARE CELLS in viewBox units (all goldens are 640x320 -> 64x32). */
export function gridDims(doc: ShapeDoc, GW: number): { gw: number; gh: number } {
  return { gw: GW, gh: Math.max(1, Math.round((GW * doc.h) / doc.w)) };
}

/** Walk stroke centrelines into an occupancy grid with square cells. */
export function raster(doc: ShapeDoc, GW: number): Float64Array {
  const { gw, gh } = gridDims(doc, GW);
  const g = new Float64Array(gw * gh);
  const put = (x: number, y: number) => {
    const cx = Math.min(gw - 1, Math.max(0, Math.floor((x / doc.w) * gw)));
    const cy = Math.min(gh - 1, Math.max(0, Math.floor((y / doc.h) * gh)));
    g[cy * gw + cx] = 1;
  };
  const span = Math.max(doc.w, doc.h);
  for (const p of doc.polys) {
    for (let i = 0; i + 1 < p.pts.length; i++) {
      const [x0, y0] = p.pts[i]!;
      const [x1, y1] = p.pts[i + 1]!;
      const steps = Math.max(1, Math.ceil((Math.hypot(x1 - x0, y1 - y0) / span) * GW * 4));
      for (let s = 0; s <= steps; s++) put(x0 + ((x1 - x0) * s) / steps, y0 + ((y1 - y0) * s) / steps);
    }
  }
  return g;
}

/** Separable box blur. `r` is the declared quotient parameter: 0 = exact, larger = coarser. */
export function blur(g: Float64Array, gw: number, gh: number, r: number): Float64Array {
  if (r <= 0) return g;
  let cur = g;
  for (const horizontal of [true, false]) {
    const out = new Float64Array(gw * gh);
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        let acc = 0;
        let n = 0;
        for (let d = -r; d <= r; d++) {
          const xx = x + (horizontal ? d : 0);
          const yy = y + (horizontal ? 0 : d);
          if (xx < 0 || xx >= gw || yy < 0 || yy >= gh) continue;
          acc += cur[yy * gw + xx]!;
          n++;
        }
        out[y * gw + x] = acc / n;
      }
    }
    cur = out;
  }
  return cur;
}

/** Mean-centred + L2-normalised. Centring is what removes the "all line art is a blob" floor. */
export function centre(a: Float64Array): Float64Array {
  let m = 0;
  for (const v of a) m += v;
  m /= a.length || 1;
  const o = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) o[i] = a[i]! - m;
  let s = 0;
  for (const v of o) s += v * v;
  const n = Math.sqrt(s);
  if (n === 0) return o;
  for (let i = 0; i < o.length; i++) o[i] = o[i]! / n;
  return o;
}

export function correlation(a: Float64Array, b: Float64Array): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += a[i]! * b[i]!;
  return d;
}

export function mirrorX(g: Float64Array, gw: number, gh: number): Float64Array {
  const o = new Float64Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) o[y * gw + x] = g[y * gw + (gw - 1 - x)]!;
  return o;
}

/**
 * THE DECLARED QUOTIENT FAMILY — bounded at 4 on purpose.
 *
 * `r` is a box-blur radius in grid cells on a 64-wide grid. At r = 6 the kernel spans 13 of 64
 * cells and at r = 8 it spans 17 — a quarter of the frame — at which point essentially every
 * line drawing converges on every other and the measure stops discriminating. Including those
 * radii in the supremum flagged 11 of the top 12 pairs, which is over-flagging to the point of
 * being uninformative. So the GUARD family stops at 4; radii 6 and 8 are retained separately as
 * DIAGNOSTIC only, because the SLOPE across them is what separates a glance-only defect from a
 * both-readers one. The bound is a modelling choice with no measured threshold behind it and is
 * the single most likely thing in this file to be wrong.
 */
export const QUOTIENT_RADII = [0, 1, 2, 3, 4] as const;
export const DIAGNOSTIC_RADII = [6, 8] as const;
export const GRID = 64;

export interface PairCurve {
  readonly a: string;
  readonly b: string;
  /** correlation at each radius in QUOTIENT_RADII, then DIAGNOSTIC_RADII */
  readonly curve: readonly number[];
  /** sup over the GUARD family only — the quantity a threshold should be applied to */
  readonly sup: number;
  /** correlation at the coarsest diagnostic radius minus at r=0. Large => a glance-only defect. */
  readonly slope: number;
  /** correlation against b's left-right reflection, at the radius achieving `sup` */
  readonly mirrorSup: number;
}

export function comparePair(
  a: string,
  ga: Float64Array,
  b: string,
  gb: Float64Array,
  gw: number,
  gh: number,
): PairCurve {
  const all = [...QUOTIENT_RADII, ...DIAGNOSTIC_RADII];
  const curve = all.map((r) => correlation(centre(blur(ga, gw, gh, r)), centre(blur(gb, gw, gh, r))));
  const guard = curve.slice(0, QUOTIENT_RADII.length);
  const sup = Math.max(...guard);
  const supR = QUOTIENT_RADII[guard.indexOf(sup)]!;
  const mirrorSup = correlation(centre(blur(ga, gw, gh, supR)), centre(mirrorX(blur(gb, gw, gh, supR), gw, gh)));
  return { a, b, curve, sup, slope: curve[curve.length - 1]! - curve[0]!, mirrorSup };
}
