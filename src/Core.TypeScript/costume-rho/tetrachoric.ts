#!/usr/bin/env bun
/**
 * tetrachoric.ts — the tetrachoric correlation of two binary error indicators.
 *
 * WHY NOT PHI. `SocietyUsefulWork.simulateHeterogeneous` (src/Core/SocietyUsefulWork.fs:69-73) states
 * the generative model the Condorcet result was proven under, verbatim:
 *
 *     V_ij = sqrt(rho) * X_j + sqrt(1 - rho) * eps_ij     X_j ~ N(0,1) shared per-item latent
 *     agent i discovers fact j iff V_ij < probit(c_i)
 *
 * That is a one-factor Gaussian copula, so rho IS the latent-Gaussian correlation — which is what the
 * tetrachoric coefficient estimates and what the phi coefficient does NOT. Phi attenuates toward zero
 * whenever the marginals are skewed, and competence is never 0.5, so phi reports a LOWER rho-hat than
 * truth — biasing every verdict toward "the society clears the bar." Using phi here would be a
 * measurement design that can only confirm the bet. `validate.ts` demonstrates both facts on synthetic
 * draws from the model above rather than asserting them.
 *
 * Anchors (Beacon): Pearson 1900 (tetrachoric correlation); Olsson 1979 (ML estimation of the
 * polychoric/tetrachoric coefficient); Divgi 1979 (the two-step conditional-ML form used here);
 * Drezner & Wesolowsky 1990 (bivariate-normal orthant quadrature).
 */

// ── Normal CDF / quantile ────────────────────────────────────────────────────────────────────────

/**
 * Phi, via Hart's (1968) rational approximation — |err| ~ 1e-15.
 *
 * The Numerical-Recipes `erfcc` this replaced has fractional error ~1.2e-7, which was NOT enough:
 * validate.ts check A caught it failing the rho=0 factorisation identity at 9e-9 absolute. Recording
 * the swap rather than quietly loosening the tolerance — the check did its job.
 */
export function normalCdf(x: number): number {
  const z = Math.abs(x);
  let c: number;
  if (z > 37) c = 0;
  else {
    const e = Math.exp((-z * z) / 2);
    if (z < 7.07106781186547) {
      let b = 3.52624965998911e-2 * z + 0.700383064443688;
      b = b * z + 6.37396220353165;
      b = b * z + 33.912866078383;
      b = b * z + 112.079291497871;
      b = b * z + 221.213596169931;
      b = b * z + 220.206867912376;
      let d = 8.83883476483184e-2 * z + 1.75566716318264;
      d = d * z + 16.064177579207;
      d = d * z + 86.7807322029461;
      d = d * z + 296.564248779674;
      d = d * z + 637.333633378831;
      d = d * z + 793.826512519948;
      d = d * z + 440.413735824752;
      c = (e * b) / d;
    } else {
      let b = z + 0.65;
      b = z + 4 / b;
      b = z + 3 / b;
      b = z + 2 / b;
      b = z + 1 / b;
      c = e / (b * 2.506628274631);
    }
  }
  return x > 0 ? 1 - c : c;
}

export function normalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/** Acklam's inverse normal CDF, refined by one Halley step. */
export function probit(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const pl = 0.02425;
  let x: number;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  } else if (p <= 1 - pl) {
    const q = p - 0.5;
    const r = q * q;
    x = ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) / (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  const e = normalCdf(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}

// ── Bivariate normal upper orthant ───────────────────────────────────────────────────────────────

// 40-node Gauss-Legendre on [-1,1] (symmetric; only the positive half is stored).
const GL_X = [
  0.038772417506051, 0.116084070675255, 0.192697580701371, 0.268152185007254, 0.341994090825758, 0.413779204371605,
  0.483075801686179, 0.549467125095128, 0.612553889667980, 0.671956684614180, 0.727318255189927, 0.778305651426519,
  0.824612230833312, 0.865959503212260, 0.902098806968874, 0.932812808278677, 0.957916819213792, 0.977259949983774,
  0.990726238699457, 0.998237709710559,
];
const GL_W = [
  0.077505947978425, 0.077039818164248, 0.076110361900626, 0.074723169057968, 0.072886582395804, 0.070611647391287,
  0.067912045815234, 0.064804013456601, 0.061306242492929, 0.057439769099392, 0.053227846983937, 0.048695807635072,
  0.043870908185673, 0.038782167974472, 0.033460195282548, 0.027937006980023, 0.022245849194167, 0.016421058381908,
  0.010498284531153, 0.004521277098533,
];

/**
 * L(h, k, rho) = P(Z1 > h, Z2 > k) for the standard bivariate normal with correlation rho.
 *
 * Genz (2004), "Numerical computation of rectangular bivariate and trivariate normal and t
 * probabilities", Statistics and Computing 14:251-260 — the `BVNU` algorithm. Two branches:
 * a sin-substitution quadrature for |r| < 0.925, and a singularity-extracting expansion for
 * |r| >= 0.925.
 *
 * WHY NOT the obvious one-dimensional conditioning integral. The naive form
 * `int_h^inf phi(x) Phi((r x - k)/sqrt(1-r^2)) dx` is what this function used first. As |r| -> 1 the
 * inner Phi becomes a step and fixed-node Gauss-Legendre cannot resolve it: validate.ts check A
 * measured a 0.010 absolute error at r = -1. That is not a corner case for THIS experiment — "personas
 * are costumes" is precisely the hypothesis that rho is near 1, so the estimator has to be accurate
 * exactly where the naive quadrature is worst. Replaced rather than tolerated.
 */
export function bvnUpper(h: number, k: number, r: number): number {
  if (!Number.isFinite(h)) return h > 0 ? 0 : 1 - normalCdf(k);
  if (!Number.isFinite(k)) return k > 0 ? 0 : 1 - normalCdf(h);
  const TWOPI = 2 * Math.PI;
  let bvn = 0;
  let hh = h;
  let kk = k;
  let hk = hh * kk;
  if (Math.abs(r) < 0.925) {
    const hs = (hh * hh + kk * kk) / 2;
    const asr = Math.asin(r);
    for (let i = 0; i < GL_X.length; i++) {
      for (const sign of [-1, 1]) {
        const sn = Math.sin((asr * (sign * GL_X[i]! + 1)) / 2);
        bvn += GL_W[i]! * Math.exp((sn * hk - hs) / (1 - sn * sn));
      }
    }
    bvn = (bvn * asr) / (2 * TWOPI) + normalCdf(-hh) * normalCdf(-kk);
  } else {
    if (r < 0) {
      kk = -kk;
      hk = -hk;
    }
    if (Math.abs(r) < 1) {
      const as2 = (1 - r) * (1 + r);
      let a = Math.sqrt(as2);
      const bs = (hh - kk) * (hh - kk);
      const c = (4 - hk) / 8;
      const d = (12 - hk) / 16;
      let asr = -(bs / as2 + hk) / 2;
      if (asr > -100) bvn = a * Math.exp(asr) * (1 - (c * (bs - as2) * (1 - (d * bs) / 5)) / 3 + (c * d * as2 * as2) / 5);
      if (-hk < 100) {
        const b = Math.sqrt(bs);
        const sp = Math.sqrt(TWOPI) * normalCdf(-b / a);
        bvn -= Math.exp(-hk / 2) * sp * b * (1 - (c * bs * (1 - (d * bs) / 5)) / 3);
      }
      a = a / 2;
      for (let i = 0; i < GL_X.length; i++) {
        for (const sign of [-1, 1]) {
          const xs = (a * (sign * GL_X[i]! + 1)) ** 2;
          const rs = Math.sqrt(1 - xs);
          asr = -(bs / xs + hk) / 2;
          if (asr > -100) {
            const sp = 1 + c * xs * (1 + d * xs);
            const ep = Math.exp((-hk * (1 - rs)) / (2 * (1 + rs))) / rs;
            bvn += a * GL_W[i]! * Math.exp(asr) * (ep - sp);
          }
        }
      }
      bvn = -bvn / TWOPI;
    }
    if (r > 0) bvn += normalCdf(-Math.max(hh, kk));
    else {
      bvn = -bvn;
      if (kk > hh) bvn += normalCdf(kk) - normalCdf(hh);
    }
  }
  return Math.max(0, Math.min(1, bvn));
}

// ── The estimator ────────────────────────────────────────────────────────────────────────────────

export interface Table2x2 {
  /** counts indexed [i-error][j-error] */
  readonly n00: number;
  readonly n01: number;
  readonly n10: number;
  readonly n11: number;
}

export function tableOf(ei: readonly number[], ej: readonly number[]): Table2x2 {
  let n00 = 0, n01 = 0, n10 = 0, n11 = 0;
  for (let t = 0; t < ei.length; t++) {
    const a = ei[t]! === 1, b = ej[t]! === 1;
    if (a && b) n11++;
    else if (a) n10++;
    else if (b) n01++;
    else n00++;
  }
  return { n00, n01, n10, n11 };
}

/** Phi (Pearson on the 0/1 indicators). Reported only as the ATTENUATED LOWER BOUND it is. */
export function phi(t: Table2x2): number {
  const { n00, n01, n10, n11 } = t;
  const num = n11 * n00 - n10 * n01;
  const den = Math.sqrt((n11 + n10) * (n01 + n00) * (n11 + n01) * (n10 + n00));
  return den === 0 ? NaN : num / den;
}

export interface TetrachoricResult {
  readonly rho: number;
  /** true iff a zero cell forced a Haldane-Anscombe 0.5 continuity correction. */
  readonly corrected: boolean;
  /** marginal error rates actually used */
  readonly pi: number;
  readonly pj: number;
  /** NaN when a marginal is degenerate (an agent that is never wrong, or always wrong). */
  readonly defined: boolean;
}

/**
 * Conditional-ML tetrachoric: thresholds are fixed from the marginals (exactly identified for a 2x2
 * table), then rho solves L(tau_i, tau_j, rho) = p11. L is strictly increasing in rho, so a bisection
 * is the exact ML solution, not a heuristic search. Contrast `CondorcetBoundary.findRhoStar`, which
 * bisects a NON-monotone predicate — see verify-rhostar.ts.
 */
export function tetrachoric(t: Table2x2): TetrachoricResult {
  let { n00, n01, n10, n11 } = t;
  const corrected = n00 === 0 || n01 === 0 || n10 === 0 || n11 === 0;
  if (corrected) {
    // Haldane-Anscombe: a zero cell sends the ML estimate to +/-1. The 0.5 correction keeps it
    // finite and is the standard, DECLARED, treatment — not silently clamping.
    n00 += 0.5; n01 += 0.5; n10 += 0.5; n11 += 0.5;
  }
  const n = n00 + n01 + n10 + n11;
  const pi = (n10 + n11) / n; // P(agent i wrong)
  const pj = (n01 + n11) / n; // P(agent j wrong)
  if (pi <= 0 || pi >= 1 || pj <= 0 || pj >= 1) {
    return { rho: NaN, corrected, pi, pj, defined: false };
  }
  const p11 = n11 / n;
  const taui = probit(1 - pi); // error indicator = 1 iff latent > tau
  const tauj = probit(1 - pj);
  let lo = -0.999999, hi = 0.999999;
  for (let it = 0; it < 200; it++) {
    const mid = 0.5 * (lo + hi);
    if (bvnUpper(taui, tauj, mid) < p11) lo = mid;
    else hi = mid;
  }
  return { rho: 0.5 * (lo + hi), corrected, pi, pj, defined: true };
}

// ── Effective sample size (Bartlett-windowed HAC) ────────────────────────────────────────────────
// Ported from AntiSybil.effectiveSampleSizeHAC / neweyWestBandwidth (src/Core/AntiSybil.fs:310-326).
// The CHSH CONCENTRATION BOUND there is NOT reusable for a correlation CI (category error: a bound on
// an S-value is not a CI for a coefficient). The effective-sample-size correction is. Take the second,
// leave the first.

export function neweyWestBandwidth(n: number): number {
  return n < 2 ? 0 : Math.max(1, Math.floor(4 * Math.pow(n / 100, 2 / 9)));
}

function lagKAutocorr(x: readonly number[], k: number): number {
  const n = x.length;
  if (k <= 0 || k >= n) return 0;
  const mean = x.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let t = 0; t < n; t++) den += (x[t]! - mean) ** 2;
  for (let t = 0; t < n - k; t++) num += (x[t]! - mean) * (x[t + k]! - mean);
  return den === 0 ? 0 : num / den;
}

export function effectiveSampleSizeHAC(series: readonly number[], bandwidth: number): number {
  const n = series.length;
  if (n < 2) return n;
  let factor = 1;
  for (let k = 1; k <= Math.min(bandwidth, n - 1); k++) {
    const w = 1 - k / (bandwidth + 1);
    factor += 2 * w * Math.max(0, lagKAutocorr(series, k));
  }
  return n / factor;
}
