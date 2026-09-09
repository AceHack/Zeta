/**
 * Falsifiers for `unscented-projection.ts`.
 *
 * The suite is arranged so that the NEGATIVE result carries the same evidentiary weight
 * as a positive one. `F2` is the load-bearing test: it runs the Unscented Transform and
 * EWA linearisation against Zeta's REAL 8D→2D Coxeter-plane projection on the REAL 240 E8
 * roots and asserts they agree to machine precision — i.e. that adopting 3DGUT's headline
 * contribution would change nothing about the projection Zeta actually ships.
 *
 * `F4` is the control: a mutant that must SURVIVE. Every other assertion here is checked
 * against a deliberate mutation in the accompanying research document; a test that no
 * mutant can kill is not a falsifier
 * (`.claude/rules/toy-is-free-metered-must-be-earned.md`).
 */

import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_UT_PARAMS,
  affineProjection,
  cholesky,
  ewaProject,
  fisheyeProjection,
  klDivergence2,
  maxAbsDiff,
  maxAbsDiffVec,
  monteCarloProject,
  mulberry32,
  numericalJacobian,
  pinholeProjection,
  sigmaPoints,
  utProject,
  type Gaussian,
  type Matrix,
  type Vec,
} from './unscented-projection';
import { e8Roots, coxeterPlaneBasis } from './clifford-e8-coxeter-projection';

/** Deterministic symmetric positive-definite matrix of size `n`, from a seed. */
function spd(n: number, seed: number): number[][] {
  const rng = mulberry32(seed);
  const a: number[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => rng() * 2 - 1));
  // A Aᵀ + n I is symmetric and strictly diagonally dominant ⇒ positive-definite.
  const m: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let k = 0; k < n; k++) s += (a[i]?.[k] ?? 0) * (a[j]?.[k] ?? 0);
      (m[i] as number[])[j] = s + (i === j ? n : 0);
    }
  }
  return m;
}

describe('UT machinery — construction is correct before anything is concluded from it', () => {
  test('cholesky reconstructs the matrix, and refuses a non-PSD one', () => {
    const m = spd(5, 11);
    const l = cholesky(m);
    expect(l).not.toBeNull();
    const rebuilt = m.map((_, i) => m.map((__, j) => {
      let s = 0;
      for (let k = 0; k < 5; k++) s += (l?.[i]?.[k] ?? 0) * (l?.[j]?.[k] ?? 0);
      return s;
    }));
    expect(maxAbsDiff(m, rebuilt)).toBeLessThan(1e-10);

    // Negative-definite input must be REFUSED, not silently turned into NaN.
    expect(cholesky([[-1, 0], [0, -1]])).toBeNull();
  });

  test('mean weights sum to 1, and the sigma set has exactly 2N+1 points', () => {
    for (const n of [2, 3, 8]) {
      const set = sigmaPoints({ mean: new Array<number>(n).fill(0), cov: spd(n, 7 + n) });
      expect(set).not.toBeNull();
      expect(set?.points.length).toBe(2 * n + 1);
      const sum = (set?.meanWeights ?? []).reduce((s, w) => s + w, 0);
      expect(Math.abs(sum - 1)).toBeLessThan(1e-12);
    }
  });

  test('the identity projection recovers the source moments exactly', () => {
    const g: Gaussian = { mean: [1, -2, 0.5], cov: spd(3, 23) };
    const out = utProject(g, (x) => x);
    expect(out).not.toBeNull();
    expect(maxAbsDiffVec(g.mean, out?.mean ?? [])).toBeLessThan(1e-12);
    expect(maxAbsDiff(g.cov, out?.cov ?? [])).toBeLessThan(1e-10);
  });
});

describe('F1 — THE AFFINE THEOREM: on a linear projection the UT is exactly EWA', () => {
  test('UT, EWA and the analytic pushforward all coincide for a random affine 8→3 map', () => {
    const rng = mulberry32(99);
    const a: number[][] = Array.from({ length: 3 }, () => Array.from({ length: 8 }, () => rng() * 2 - 1));
    const b: Vec = [0.3, -1.1, 2.0];
    const project = affineProjection(a, b);
    const g: Gaussian = { mean: Array.from({ length: 8 }, () => rng() * 2 - 1), cov: spd(8, 31) };

    const ut = utProject(g, project);
    // For an affine map the Jacobian is A everywhere; no approximation is involved.
    const ewa = ewaProject(g, project, a);
    expect(ut).not.toBeNull();

    // Analytic truth: mean = A μ + b, cov = A Σ Aᵀ.
    const truthCov: number[][] = Array.from({ length: 3 }, () => new Array<number>(3).fill(0));
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        let s = 0;
        for (let p = 0; p < 8; p++) {
          for (let q = 0; q < 8; q++) s += (a[i]?.[p] ?? 0) * (g.cov[p]?.[q] ?? 0) * (a[j]?.[q] ?? 0);
        }
        (truthCov[i] as number[])[j] = s;
      }
    }

    expect(maxAbsDiffVec(ut?.mean ?? [], ewa.mean)).toBeLessThan(1e-10);
    expect(maxAbsDiff(ut?.cov ?? [], ewa.cov)).toBeLessThan(1e-9);
    expect(maxAbsDiff(ut?.cov ?? [], truthCov)).toBeLessThan(1e-9);
  });
});

describe('F2 — THE TRANSFER VERDICT: on Zeta shipped 8D→2D Coxeter projection, UT buys nothing', () => {
  test('UT equals EWA on the real E8 root system, to machine precision', () => {
    // The projection Zeta actually renders with: two dot products against an
    // orthonormal Coxeter-plane frame. Reconstructed here exactly as
    // `projectRoots` does it, so this measures the shipped map and not a stand-in.
    const { u, v } = coxeterPlaneBasis();
    const dot = (p: Vec, q: Vec): number => p.reduce((s, x, i) => s + x * (q[i] ?? 0), 0);
    const un = Math.sqrt(dot(u, u));
    const e1 = u.map((x) => x / un);
    const proj = dot(v, e1);
    const w = v.map((x, k) => x - proj * (e1[k] ?? 0));
    const wn = Math.sqrt(dot(w, w));
    const e2 = w.map((x) => x / wn);

    const coxeter = affineProjection([e1, e2], [0, 0]);
    const jacobian: Matrix = [e1, e2]; // exact: the map is linear

    const roots = e8Roots();
    expect(roots.length).toBe(240);

    let worstMean = 0;
    let worstCov = 0;
    // One Gaussian per root, anisotropic, centred on the root — the particle a
    // splatting representation would carry.
    roots.forEach((r, i) => {
      const g: Gaussian = { mean: r, cov: spd(8, 1000 + i) };
      const ut = utProject(g, coxeter);
      const ewa = ewaProject(g, coxeter, jacobian);
      expect(ut).not.toBeNull();
      worstMean = Math.max(worstMean, maxAbsDiffVec(ut?.mean ?? [], ewa.mean));
      worstCov = Math.max(worstCov, maxAbsDiff(ut?.cov ?? [], ewa.cov));
    });

    // If this ever fails, the projection stopped being linear — which would be the
    // ONLY circumstance under which 3DGUT's contribution becomes relevant to Zeta.
    expect(worstMean).toBeLessThan(1e-9);
    expect(worstCov).toBeLessThan(1e-8);
  });

  test('the equivalence holds for EVERY UT parameterisation — it cannot be tuned away', () => {
    // STRENGTHENED IN RESPONSE TO A SURVIVING MUTANT. Mutant M4 shifted `lambda` by
    // +0.5 and the suite passed. That mutant is EQUIVALENT rather than escaped: the
    // scaled UT is a family parameterised by (alpha, beta, kappa), every member is a
    // legitimate UT, and affine-exactness holds for all of them. Pinning one tuning
    // would have been over-fitting the test to an arbitrary choice.
    //
    // The right response is to promote the finding instead of guarding the constant:
    // the negative result is not "UT matches EWA at 3DGUT's settings", it is
    // "UT matches EWA at EVERY setting" — so no amount of tuning can make the
    // Unscented Transform outperform linearisation on a linear projection.
    const { u, v } = coxeterPlaneBasis();
    const dot = (p: Vec, q: Vec): number => p.reduce((s, x, i) => s + x * (q[i] ?? 0), 0);
    const un = Math.sqrt(dot(u, u));
    const e1 = u.map((x) => x / un);
    const proj = dot(v, e1);
    const w = v.map((x, k) => x - proj * (e1[k] ?? 0));
    const wn = Math.sqrt(dot(w, w));
    const e2 = w.map((x) => x / wn);
    const coxeter = affineProjection([e1, e2], [0, 0]);
    const jacobian: Matrix = [e1, e2];

    const settings = [
      { alpha: 1.0, beta: 2.0, kappa: 0.0 }, // 3DGUT's own
      { alpha: 0.5, beta: 2.0, kappa: 0.0 },
      { alpha: 1.0, beta: 0.0, kappa: 3.0 },
      { alpha: 0.1, beta: 5.0, kappa: 1.0 },
    ];
    const roots = e8Roots().slice(0, 24);
    for (const params of settings) {
      let worst = 0;
      roots.forEach((r, i) => {
        const g: Gaussian = { mean: r, cov: spd(8, 2000 + i) };
        const ut = utProject(g, coxeter, params);
        const ewa = ewaProject(g, coxeter, jacobian);
        expect(ut).not.toBeNull();
        worst = Math.max(worst, maxAbsDiff(ut?.cov ?? [], ewa.cov));
      });
      expect(worst).toBeLessThan(1e-8);
    }
  });
});

describe('F3 — THE BOUNDARY: the UT earns its cost only under real nonlinearity', () => {
  /** Score both methods against a deterministic Monte-Carlo reference. */
  function scores(project: (p: Vec) => Vec, g: Gaussian, seed: number): { ut: number; ewa: number } {
    const reference = monteCarloProject(g, project, 200000, seed);
    if (reference === null) throw new Error('reference failed');
    const ut = utProject(g, project);
    // EWA gets the exact numerical Jacobian OF THE MAP UNDER TEST — the strongest
    // possible baseline, stronger than the mismatched Jacobian 3DGUT compares against.
    const ewa = ewaProject(g, project, numericalJacobian(project, g.mean));
    const kUt = klDivergence2(reference, ut as Gaussian);
    const kEwa = klDivergence2(reference, ewa);
    if (kUt === null || kEwa === null) throw new Error('KL undefined');
    return { ut: kUt, ewa: kEwa };
  }

  test('pinhole: UT and EWA are comparable — reproducing 3DGUT own "consistent" finding', () => {
    const g: Gaussian = {
      mean: [0.4, 0.25, 4.0],
      cov: [
        [0.05, 0.01, 0.0],
        [0.01, 0.04, 0.0],
        [0.0, 0.0, 0.05],
      ],
    };
    const s = scores(pinholeProjection(500), g, 4242);
    // Neither is dramatically better; the ratio stays within one order of magnitude.
    // A gigantic UT win here would contradict the paper and mean this harness is wrong.
    expect(s.ut).toBeLessThan(s.ewa * 10);
    expect(s.ewa).toBeLessThan(s.ut * 10);
  });

  test('fisheye at wide angle: the UT is strictly closer to the Monte-Carlo truth', () => {
    // Off-axis and wide: the regime where the equidistant model bends hardest.
    const g: Gaussian = {
      mean: [1.6, 1.2, 1.0],
      cov: [
        [0.10, 0.02, 0.01],
        [0.02, 0.09, 0.0],
        [0.01, 0.0, 0.10],
      ],
    };
    const s = scores(fisheyeProjection(300), g, 909090);
    expect(s.ut).toBeLessThan(s.ewa);
  });
});

describe('F5 — beta IS live for a nonlinear projection (the complement of F4)', () => {
  // ADDED IN RESPONSE TO A SURVIVING MUTANT, and recorded as such rather than quietly
  // folded in. Mutant M2 replaced `covWeights` with `meanWeights` in `utProject`'s
  // covariance recombination and the whole suite still passed: the two weight vectors
  // differ ONLY at index 0, that difference is exactly the beta term, and nothing yet
  // asserted beta had an effect anywhere. F4 pins that beta is inert for AFFINE maps;
  // without this complement, "inert everywhere" was indistinguishable from "correct",
  // which is the vacuity class.
  //
  // Under a nonlinear projection the centre sigma point maps to g(mu), which does NOT
  // coincide with the recombined mean, so its deviation is non-zero and the centre
  // covariance weight genuinely acts. Changing beta must therefore change the answer.
  test('changing beta moves the fisheye covariance — so the covariance weights are really used', () => {
    const g: Gaussian = {
      mean: [1.6, 1.2, 1.0],
      cov: [
        [0.10, 0.02, 0.01],
        [0.02, 0.09, 0.0],
        [0.01, 0.0, 0.10],
      ],
    };
    const project = fisheyeProjection(300);
    const withBeta2 = utProject(g, project, DEFAULT_UT_PARAMS);
    const withBeta0 = utProject(g, project, { ...DEFAULT_UT_PARAMS, beta: 0.0 });
    expect(withBeta2).not.toBeNull();
    expect(withBeta0).not.toBeNull();

    // A real, non-trivial separation — not merely "different in the last bit".
    expect(maxAbsDiff(withBeta2?.cov ?? [], withBeta0?.cov ?? [])).toBeGreaterThan(1e-6);

    // And the means must be IDENTICAL: beta enters the covariance weights only. This is
    // the second half of the guard — a mutant routing beta into the mean would otherwise
    // pass the assertion above.
    expect(maxAbsDiffVec(withBeta2?.mean ?? [], withBeta0?.mean ?? [])).toBeLessThan(1e-15);
  });
});

describe('F4 — CONTROL: a mutant that must SURVIVE', () => {
  test('beta is inert for an affine projection, so perturbing it changes nothing', () => {
    // This documents a real property rather than guarding one: because the centre
    // sigma point maps exactly onto the recombined mean under an affine map, its
    // beta-weighted outer product is multiplied by a zero deviation. Any beta gives
    // the same answer. A "guard" on beta for affine maps would therefore be vacuous,
    // and this test exists to say so explicitly instead of leaving the gap unnamed.
    const rng = mulberry32(5);
    const a: number[][] = Array.from({ length: 2 }, () => Array.from({ length: 4 }, () => rng() * 2 - 1));
    const project = affineProjection(a, [0, 0]);
    const g: Gaussian = { mean: [0.1, 0.2, 0.3, 0.4], cov: spd(4, 61) };

    const withBeta2 = utProject(g, project, DEFAULT_UT_PARAMS);
    const withBeta99 = utProject(g, project, { ...DEFAULT_UT_PARAMS, beta: 99.0 });
    expect(maxAbsDiff(withBeta2?.cov ?? [], withBeta99?.cov ?? [])).toBeLessThan(1e-12);
  });
});

describe('determinism — the Monte-Carlo arbiter must replay (manifesto §7)', () => {
  test('same seed, byte-identical reference moments', () => {
    const g: Gaussian = { mean: [0.5, 0.5, 3.0], cov: spd(3, 77) };
    const p = pinholeProjection(400);
    const a = monteCarloProject(g, p, 5000, 314159);
    const b = monteCarloProject(g, p, 5000, 314159);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
