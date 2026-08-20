import { expect, it } from "bun:test";
import {
  affineRelabel,
  applyRotor21,
  auc,
  bayesianStream,
  beliefScaleRotor,
  beliefToHyperboloid,
  chartRotate,
  fisherCloneScore,
  fisherMomentMetric,
  fisherMomentMetricNumeric,
  fisherNaturalMetric,
  flatGeometricCorrelation,
  gaussCurvatureMomentChart,
  gp21,
  halfPlaneInitialDirection,
  hyperboloidToBelief,
  hypToMv,
  klGaussian,
  meanResultant,
  mink,
  type Mv21,
  mvToHyp,
  type NatGaussian,
  raoDistance,
  raoDistanceHyperboloid,
  raoDistanceVerticalNumeric,
  rescaleUnits,
  scoreFromResultant,
  toMoment,
  triangleHolonomy,
} from "./belief-manifold-curvature-sybil.ts";

const POINTS = [
  { mu: 0, sigma: 1 },
  { mu: 2.5, sigma: 0.4 },
  { mu: -1, sigma: 3 },
  { mu: 5, sigma: 0.2 },
];

// -- the geometry is CHECKED, not cited -----------------------------------------------------------

it("Fisher metric closed form diag(1/s^2, 2/s^2) matches the KL Hessian", () => {
  for (const p of POINTS) {
    const closed = fisherMomentMetric(p);
    const numeric = fisherMomentMetricNumeric(p);
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const c = closed[i]?.[j] ?? Number.NaN;
        const n = numeric[i]?.[j] ?? Number.NaN;
        expect(Math.abs(c - n)).toBeLessThan(1e-4 * Math.max(1, Math.abs(c)));
      }
    }
  }
});

it("the Gaussian belief manifold has constant curvature -1/2 -- HYPERBOLIC, not spherical", () => {
  for (const p of POINTS) {
    expect(gaussCurvatureMomentChart(p)).toBeCloseTo(-0.5, 4);
  }
  // The sign is the entire point of this document, so it is asserted separately: a spherical
  // (categorical-simplex) embedding would give K > 0 and this must fail if anyone swaps it in.
  for (const p of POINTS) expect(gaussCurvatureMomentChart(p)).toBeLessThan(0);
});

it("Rao distance agrees across three independent routes", () => {
  for (const [s1, s2] of [
    [1, 2],
    [0.5, 4],
    [3, 3.1],
  ] as [number, number][]) {
    const p = { mu: 1.2, sigma: s1 };
    const q = { mu: 1.2, sigma: s2 };
    const closed = raoDistance(p, q);
    expect(closed).toBeCloseTo(raoDistanceVerticalNumeric(1.2, s1, s2), 6);
    expect(closed).toBeCloseTo(raoDistanceHyperboloid(p, q), 9);
    // and the exact value on a vertical geodesic
    expect(closed).toBeCloseTo(Math.SQRT2 * Math.abs(Math.log(s2 / s1)), 9);
  }
  // off the vertical geodesic the numeric-integration route does not apply, but the other two must
  expect(raoDistance({ mu: -2, sigma: 0.3 }, { mu: 5, sigma: 1.7 })).toBeCloseTo(
    raoDistanceHyperboloid({ mu: -2, sigma: 0.3 }, { mu: 5, sigma: 1.7 }),
    9,
  );
});

it("beliefs land on the unit hyperboloid <X,X> = -1", () => {
  for (const p of POINTS) {
    const X = beliefToHyperboloid(p);
    expect(mink(X, X)).toBeCloseTo(-1, 9);
    const back = hyperboloidToBelief(X);
    expect(back.mu).toBeCloseTo(p.mu, 9);
    expect(back.sigma).toBeCloseTo(p.sigma, 9);
  }
});

// -- the shipped detector, reduced to a closed form ------------------------------------------------

it("CliffordAntiSybil's score is exactly rho^2 exp(-(1-rho^2)/2) in the resultant length", () => {
  for (let trial = 0; trial < 6; trial++) {
    const A = bayesianStream({ steps: 14, trueMean: 0.5, obsSd: 1, priorTau: 1, seed: 100 + trial });
    const B = bayesianStream({ steps: 14, trueMean: -0.3, obsSd: 1.4, priorTau: 1, seed: 900 + trial });
    const angles: number[] = [];
    for (let i = 0; i + 1 < Math.min(A.length, B.length); i++) {
      const a0 = A[i] as NatGaussian;
      const a1 = A[i + 1] as NatGaussian;
      const b0 = B[i] as NatGaussian;
      const b1 = B[i + 1] as NatGaussian;
      const da = [a1.nu - a0.nu, a1.tau - a0.tau];
      const db = [b1.nu - b0.nu, b1.tau - b0.tau];
      angles.push(
        Math.atan2(
          (da[0] as number) * (db[1] as number) - (da[1] as number) * (db[0] as number),
          (da[0] as number) * (db[0] as number) + (da[1] as number) * (db[1] as number),
        ),
      );
    }
    expect(flatGeometricCorrelation(A, B)).toBeCloseTo(scoreFromResultant(meanResultant(angles)), 12);
  }
});

// -- THE HEADLINE FALSIFIER ------------------------------------------------------------------------

it("the flat detector's verdict is a function of the MEASUREMENT UNIT; the Fisher one is not", () => {
  const A = bayesianStream({ steps: 20, trueMean: 0.7, obsSd: 1, priorTau: 1, seed: 11 });
  const B = bayesianStream({ steps: 20, trueMean: 0.7, obsSd: 1, priorTau: 1, seed: 12 });
  const ks = [0.01, 0.1, 1, 10, 100];
  const flat = ks.map((k) => flatGeometricCorrelation(rescaleUnits(A, k), rescaleUnits(B, k)));
  const fisher = ks.map((k) => fisherCloneScore(rescaleUnits(A, k), rescaleUnits(B, k)));

  // Same two agents, same beliefs, only the unit of the believed quantity changes. The flat score
  // sweeps essentially the whole range -- "certainly clones" to "certainly independent".
  expect(Math.max(...flat) - Math.min(...flat)).toBeGreaterThan(0.9);
  expect(Math.max(...flat)).toBeGreaterThan(0.99);
  expect(Math.min(...flat)).toBeLessThan(0.01);

  // The Fisher-Rao score does not move at all across five decades of unit change.
  const f0 = fisher[0] as number;
  for (const f of fisher) expect(Math.abs(f - f0)).toBeLessThan(1e-9);
});

it("both detectors are sound on an EXACT clone under any unit -- the flat one fails on the middle, not the extremes", () => {
  const A = bayesianStream({ steps: 20, trueMean: 0.7, obsSd: 1, priorTau: 1, seed: 11 });
  for (const k of [0.01, 1, 100]) {
    expect(flatGeometricCorrelation(rescaleUnits(A, k), rescaleUnits(A, k))).toBeCloseTo(1, 9);
    expect(fisherCloneScore(rescaleUnits(A, k), rescaleUnits(A, k))).toBeCloseTo(1, 9);
  }
});

it("the flat detector MISSES the real mask and CATCHES the impossible one; the Fisher one reverses both", () => {
  const A = bayesianStream({ steps: 20, trueMean: 0.7, obsSd: 1, priorTau: 1, seed: 11 });

  // REAL adversary move: relabel the believed quantity, x -> 3x + 5. Same agent, same information.
  const masked = affineRelabel(A, 3, 5);
  expect(flatGeometricCorrelation(A, masked)).toBeLessThan(0.9); // missed at a 0.9 threshold
  expect(fisherCloneScore(A, masked)).toBeCloseTo(1, 9); // caught, and exactly -- it is an isometry

  // IMPOSSIBLE move: rotate the (nu, tau) chart 90 degrees. No operation on a belief does this;
  // it mixes the precision-mean axis into the precision axis and drives precision NEGATIVE, i.e.
  // off the manifold of beliefs entirely (an improper EP message, not an agent's posterior).
  const rotated = chartRotate(A, Math.PI / 2);
  expect(flatGeometricCorrelation(A, rotated)).toBeCloseTo(1, 6); // flagged as a certain clone
  expect(rotated.some((g) => g.tau < 0)).toBe(true); // ... and it is not a belief stream at all
});

it("Fisher-Rao separates clone from independent where the flat detector does not", () => {
  const flatPos: number[] = [];
  const flatNeg: number[] = [];
  const fisherPos: number[] = [];
  const fisherNeg: number[] = [];
  for (let i = 0; i < 60; i++) {
    const base = bayesianStream({
      steps: 18,
      trueMean: (i % 7) - 3,
      obsSd: 0.5 + (i % 5) * 0.4,
      priorTau: 0.7,
      seed: 1000 + i,
    });
    const other = bayesianStream({
      steps: 18,
      trueMean: (i % 5) - 2,
      obsSd: 0.6 + (i % 3) * 0.5,
      priorTau: 0.9,
      seed: 50000 + i,
    });
    const k = Math.exp(((i % 11) - 5) * 0.5);
    flatPos.push(flatGeometricCorrelation(rescaleUnits(base, k), rescaleUnits(affineRelabel(base, 2.3, -4), k)));
    fisherPos.push(fisherCloneScore(rescaleUnits(base, k), rescaleUnits(affineRelabel(base, 2.3, -4), k)));
    flatNeg.push(flatGeometricCorrelation(rescaleUnits(base, k), rescaleUnits(other, k)));
    fisherNeg.push(fisherCloneScore(rescaleUnits(base, k), rescaleUnits(other, k)));
  }
  // The Fisher TPR is a THEOREM (the mask is an isometry, turn angles are isometry invariants), so
  // the measured content is the FPR: independent agents must not accidentally match.
  expect(auc(fisherPos, fisherNeg)).toBe(1);
  expect(Math.max(...fisherNeg)).toBeLessThan(0.9);
  // The flat detector's AUC is materially worse, and it is worse in the way that matters: at a
  // usable threshold it lets real clones through.
  expect(auc(flatPos, flatNeg)).toBeLessThan(0.9);
  expect(flatPos.filter((v) => v > 0.9).length / flatPos.length).toBeLessThan(0.7);
});

// -- the two-term error budget ---------------------------------------------------------------------

it("the CHART error does NOT vanish as the step size goes to zero (so flat is not a local approximation)", () => {
  const g = { nu: 5, tau: 2 };
  const p = toMoment(g);
  const gapAt = (eps: number): number => {
    const mk = (th: number): NatGaussian => ({
      nu: g.nu + eps * Math.cos(th),
      tau: g.tau + eps * Math.sin(th),
    });
    const u = mk(0);
    const v = mk(Math.PI / 4);
    const flat = Math.PI / 4; // by construction, in the (nu, tau) chart
    const du = halfPlaneInitialDirection(p, toMoment(u));
    const dv = halfPlaneInitialDirection(p, toMoment(v));
    const fr = Math.abs(Math.atan2(du[0] * dv[1] - du[1] * dv[0], du[0] * dv[0] + du[1] * dv[1]));
    return Math.abs(fr - flat);
  };
  const g1 = gapAt(1e-2);
  const g2 = gapAt(1e-6);
  // It converges -- to a LIMIT well over a radian, not to zero.
  expect(Math.abs(g1 - g2)).toBeLessThan(0.01);
  expect(g2).toBeGreaterThan(2.0);
});

it("the CURVATURE error DOES vanish, linearly in D_KL -- so curvature was never the problem", () => {
  const p = { mu: 0, sigma: 1 };
  const defectAt = (s: number): { kl: number; defect: number } => {
    const q = { mu: s, sigma: 1 };
    const r = { mu: 0, sigma: Math.exp(s) };
    const kl = Math.max(klGaussian(p, q), klGaussian(p, r), klGaussian(q, r));
    return { kl, defect: triangleHolonomy(p, q, r).defect };
  };
  const a = defectAt(0.125);
  const b = defectAt(0.0625);
  // halving the scale quarters the KL and quarters the holonomy: linear in D_KL, second order in
  // the step. The ratio defect/KL is bounded and small.
  expect(a.defect / a.kl).toBeLessThan(0.35);
  expect(b.defect / b.kl).toBeLessThan(0.35);
  expect(a.defect).toBeGreaterThan(b.defect * 3);
  // Gauss-Bonnet sign: negative curvature means the angle sum is BELOW pi, defect positive.
  expect(a.defect).toBeGreaterThan(0);
  expect(triangleHolonomy(p, { mu: 1, sigma: 1 }, { mu: 0, sigma: 2 }).angleSum).toBeLessThan(Math.PI);
});

it("the flat chart is conformally correct at EXACTLY one belief, N(0, 2) -- a measure-zero set", () => {
  const deviation = (g: NatGaussian): number => {
    const gf = fisherNaturalMetric(g);
    const a = gf[0]?.[0] ?? 0;
    const b = gf[0]?.[1] ?? 0;
    const d = gf[1]?.[1] ?? 0;
    return Math.abs(b) / Math.sqrt(a * d) + Math.abs(a - d) / (a + d);
  };
  // nu = 0 and tau = 1/2, i.e. mu = 0 and sigma = sqrt(2)
  expect(deviation({ nu: 0, tau: 0.5 })).toBeLessThan(1e-12);
  expect(toMoment({ nu: 0, tau: 0.5 }).sigma).toBeCloseTo(Math.SQRT2, 12);
  // every neighbour is non-conformal, so it is an isolated point and not a curve
  for (const g of [
    { nu: 0.05, tau: 0.5 },
    { nu: -0.05, tau: 0.5 },
    { nu: 0, tau: 0.55 },
    { nu: 0, tau: 0.45 },
  ]) {
    expect(deviation(g)).toBeGreaterThan(1e-3);
  }
});

// -- the algebra is IDENTIFIED by invariants, not by a dimension count -----------------------------

const e = (i: number): Mv21 => {
  const a = [0, 0, 0, 0, 0, 0, 0, 0];
  a[i] = 1;
  return a as unknown as Mv21;
};

it("Cl(2,1) is identified by invariants that EXCLUDE Cl(3,0), not by both being 8-dimensional", () => {
  // 1. mixed signature: one timelike generator
  expect(gp21(e(1), e(1))[0]).toBe(1);
  expect(gp21(e(2), e(2))[0]).toBe(1);
  expect(gp21(e(4), e(4))[0]).toBe(-1);
  // 2. BOTH rotation and boost generators exist. In Cl(3,0) every bivector squares to -1.
  expect(gp21(e(3), e(3))[0]).toBe(-1); // e12: rotation
  expect(gp21(e(5), e(5))[0]).toBe(1); // e13: BOOST -- impossible in Cl(3,0)
  // 3. the even subalgebra has zero divisors, so it is M_2(R), not the quaternions Cl+(3,0)
  const u: Mv21 = [1, 0, 0, 0, 0, 1, 0, 0];
  const v: Mv21 = [1, 0, 0, 0, 0, -1, 0, 0];
  expect(gp21(u, v).every((c) => c === 0)).toBe(true);
});

it("the boost rotor IS the belief-rescaling isometry, exactly", () => {
  for (const [p, a] of [
    [{ mu: 0, sigma: 1 }, 2],
    [{ mu: 0, sigma: 0.4 }, 0.3],
    [{ mu: 2.5, sigma: 1.3 }, 0.17],
    [{ mu: -1.5, sigma: 2.2 }, 5],
  ] as [{ mu: number; sigma: number }, number][]) {
    const moved = hyperboloidToBelief(mvToHyp(applyRotor21(beliefScaleRotor(a), hypToMv(beliefToHyperboloid(p)))));
    expect(moved.mu).toBeCloseTo(a * p.mu, 9);
    expect(moved.sigma).toBeCloseTo(Math.abs(a) * p.sigma, 9);
  }
});
