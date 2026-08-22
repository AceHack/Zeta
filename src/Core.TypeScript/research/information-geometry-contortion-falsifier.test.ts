import { expect, it } from "bun:test";
import {
  alphaConnection,
  amariChentsov,
  at2,
  differenceTensor,
  fisherMetric,
  flowMismatchOnFlatR2,
  foldReorderUlpGap,
  maxAbs,
  metricDerivativeNumeric,
  nonMetricity,
  observeExact,
  probabilities,
  sharpenObserveResidue,
  torsion,
} from "./information-geometry-contortion-falsifier.ts";

// A 4-outcome categorical family, reduced chart: 3 free natural coordinates.
const THETA = [0.7, -0.4, 0.25];
const P = probabilities(THETA);

// -- the geometry is real, not asserted ---------------------------------------------------------

it("closed-form Amari-Chentsov tensor matches finite differences of the Fisher metric", () => {
  const closed = amariChentsov(P);
  const numeric = metricDerivativeNumeric(THETA);
  expect(maxAbs(differenceTensor(closed, numeric))).toBeLessThan(1e-7);
});

it("the Fisher metric is positive definite, so a Levi-Civita connection genuinely exists", () => {
  const g = fisherMetric(P);
  const a = at2(g, 0, 0);
  const b = at2(g, 0, 1);
  const c = at2(g, 0, 2);
  const e = at2(g, 1, 1);
  const f = at2(g, 1, 2);
  const h = at2(g, 2, 2);
  const m2 = a * e - b * b;
  const m3 = a * (e * h - f * f) - b * (b * h - f * c) + c * (b * f - e * c);
  expect(a).toBeGreaterThan(0);
  expect(m2).toBeGreaterThan(0);
  expect(m3).toBeGreaterThan(0);
});

// -- falsifier 1: contortion is identically zero across the whole relevant family ----------------

it("every alpha-connection is torsion-free, the canonical one and our fold's own included", () => {
  for (const alpha of [-1, -0.7, 0, 0.3, 1, 2.5]) {
    expect(maxAbs(torsion(alphaConnection(P, alpha)))).toBe(0);
  }
});

it("yet the canonical reference and our fold's connection genuinely differ", () => {
  const leviCivita = alphaConnection(P, 0);
  const eConnection = alphaConnection(P, 1);
  const gap = maxAbs(differenceTensor(leviCivita, eConnection));
  expect(gap).toBeGreaterThan(0.01);
  expect(gap).toBeCloseTo(maxAbs(amariChentsov(P)) / 2, 12);
});

it("the deviation lives entirely in non-metricity, which contortion does not measure", () => {
  expect(maxAbs(nonMetricity(P, 0))).toBeLessThan(1e-15);
  expect(maxAbs(nonMetricity(P, 1))).toBeGreaterThan(0.01);
});

it("the e-connection is flat in theta, so it is not merely torsion-free but trivially so", () => {
  expect(maxAbs(alphaConnection(P, 1))).toBe(0);
});

// -- what survives: relative deviation is reference-free, absolute deviation is not --------------

it("deviation-from-reference depends on which reference you picked", () => {
  const e = alphaConnection(P, 1);
  const d1 = differenceTensor(e, alphaConnection(P, 0));
  const d2 = differenceTensor(e, alphaConnection(P, -0.7));
  expect(maxAbs(differenceTensor(d1, d2))).toBeGreaterThan(0.01);
});

it("but the difference between two executions is the same in every reference", () => {
  const e1 = alphaConnection(P, 1);
  const e2 = alphaConnection(P, -1);
  const viaR1 = differenceTensor(
    differenceTensor(e1, alphaConnection(P, 0)),
    differenceTensor(e2, alphaConnection(P, 0)),
  );
  const viaR2 = differenceTensor(
    differenceTensor(e1, alphaConnection(P, -0.7)),
    differenceTensor(e2, alphaConnection(P, -0.7)),
  );
  expect(maxAbs(differenceTensor(viaR1, viaR2))).toBeLessThan(1e-15);
  expect(maxAbs(viaR1)).toBeGreaterThan(0.01);
});

// -- order-dependence is the Lie bracket, not the torsion ---------------------------------------

it("flat R^2 has zero torsion and still has order-dependent flows", () => {
  const r = flowMismatchOnFlatR2(1.5, -2, 0.75, 0.4);
  expect(r.mismatch[0]).toBe(0);
  expect(r.mismatch[1]).toBeCloseTo(0.75 * 0.4, 12);
});

it("the exact fold commutes bit-for-bit, so there is nothing for any metric to report", () => {
  const belief = [3n, 5n, 7n, 11n];
  const l1 = [2n, 13n, 1n, 4n];
  const l2 = [9n, 1n, 6n, 5n];
  const ab = observeExact(observeExact(belief, l1), l2);
  const ba = observeExact(observeExact(belief, l2), l1);
  expect(ab).toEqual(ba);
});

it("the float fold's only reorder residue is a last-ULP rounding gap, not a geometric defect", () => {
  const gap = foldReorderUlpGap(THETA, [0.3, -1.1, 0.05], [-0.2, 0.9, 0.4]);
  expect(gap).toBeGreaterThan(0);
  expect(gap).toBeLessThan(1e-15);
});

it("where the fold does fail to commute, the residue is a multiplicity, not a geometry", () => {
  const lik = [0.3, -1.1, 0.05];
  const residue = sharpenObserveResidue(THETA, lik);
  for (const [i, r] of residue.entries()) expect(r).toBeCloseTo(lik[i] ?? 0, 12);
});
