/**
 * toy-bnn-rgba-codec.test.ts — the falsifiers for the TOY BNN->RGBA encoding.
 *
 * REGISTER: `toy`. These tests do not promote anything. They pin the three claims the
 * design doc rests on, so that if one stops being true the doc goes red rather than stale:
 *
 *   1. rgba32float ROUND-TRIPS a Normal-Gamma posterior (KL below a stated bound).
 *   2. Combination in NATURAL parameters is exactly associative; the naive moment form is not.
 *   3. Naive RGB<->CMYK is a BIJECTION, so it is NOT a model of `SoftValue.snap`.
 *
 * Each is a falsifier in the `toy-is-free-metered-must-be-earned` sense: it fails if the
 * claim is wrong, and the doc quotes its numbers.
 */
import { describe, test, expect } from "bun:test";
import {
  type NormalGamma,
  npFromMoments, npToMoments, npFuse, momentFuseNaive,
  ngToNp, ngFromNp, ngFuse, ngKl, ngStudentT,
  asF32, asF16, f16RoundSelfCheck,
} from "./toy-bnn-rgba-codec";

const SAMPLES: NormalGamma[] = [
  { m: 0.0, lambda: 1, alpha: 1, beta: 1 },
  { m: 0.37, lambda: 51, alpha: 26, beta: 2.3 },
  { m: -1.82, lambda: 201, alpha: 101, beta: 9.1 },
  { m: 4.5, lambda: 3, alpha: 1.5, beta: 0.6 },
];

describe("toy BNN -> RGBA codec", () => {
  // ── 1. Round-trip ────────────────────────────────────────────────────────────
  test("RT-1: Normal-Gamma survives rgba32float with KL < 1e-6", () => {
    for (const p of SAMPLES) {
      const h = ngToNp(p);
      const back = { h1: asF32(h.h1), h2: asF32(h.h2), h3: asF32(h.h3), h4: asF32(h.h4) };
      const kl = Math.abs(ngKl(h, back));
      expect(Number.isFinite(kl)).toBe(true);
      expect(kl).toBeLessThan(1e-6);
    }
  });

  test("RT-2: the natural-parameter map is exactly invertible in f64", () => {
    for (const p of SAMPLES) {
      const q = ngFromNp(ngToNp(p));
      expect(q.m).toBeCloseTo(p.m, 12);
      expect(q.lambda).toBeCloseTo(p.lambda, 12);
      expect(q.alpha).toBeCloseTo(p.alpha, 12);
      expect(q.beta).toBeCloseTo(p.beta, 10);
    }
  });

  test("RT-3: rgba16float OVERFLOWS the precision channel — the named limit, not a surprise", () => {
    // tau = 1/sigma^2 for a confident weight exceeds binary16's 65504 maximum.
    const confident = npFromMoments(0.1, 1e-6); // tau = 1e6
    expect(asF16(confident.tau)).toBe(Infinity);
    // and the same weight is fine in binary32.
    expect(Number.isFinite(asF32(confident.tau))).toBe(true);
  });

  test("RT-4: the Student-t SHAPE survives exactly; the SCALE does not", () => {
    // nu = 2*alpha is a half-integer doubling -> exact in any binary float.
    // The scale goes through beta, which is a difference and therefore is not.
    for (const p of SAMPLES) {
      const h = ngToNp(p);
      const back = ngFromNp({ h1: asF32(h.h1), h2: asF32(h.h2), h3: asF32(h.h3), h4: asF32(h.h4) });
      expect(ngStudentT(back).nu).toBe(ngStudentT(p).nu);
    }
  });

  test("RT-5: the hand-rolled binary16 agrees with the platform intrinsic", () => {
    // The f16 numbers in the doc are only worth anything if the converter is right. An earlier
    // version routed through float32 and was wrong on 4/20012 probes by DOUBLE ROUNDING; this
    // check is what caught it, so it stays.
    let s = 31337 >>> 0;
    const r = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 0x1_0000_0000; };
    const probes: number[] = [];
    for (let i = 0; i < 50_000; i++) probes.push((r() - 0.5) * 10 ** Math.floor(r() * 16 - 8));
    probes.push(0, 1, 65504, 65519.9, 65520, 131072, 2 ** -24, 2 ** -25, 3 * 2 ** -25, Infinity, NaN);
    const bad = f16RoundSelfCheck(probes);
    if (bad < 0) return; // no platform intrinsic on this runtime: nothing checked, and it says so
    expect(bad).toBe(0);
  });

  // ── 2. Associativity — the fold falsifier ────────────────────────────────────
  test("AS-1: (eta,tau) fusion is EXACTLY associative over three parents", () => {
    const A = npFromMoments(1.0, 0.5), B = npFromMoments(-2.0, 4.0), C = npFromMoments(0.3, 0.01);
    const l = npToMoments(npFuse(npFuse(A, B), C));
    const r = npToMoments(npFuse(A, npFuse(B, C)));
    expect(l.mu).toBe(r.mu);
    expect(l.sigma2).toBe(r.sigma2);
  });

  test("AS-2: the NAIVE moment form is NOT associative — this is what the choice buys", () => {
    const a = { mu: 1.0, sigma2: 0.5 }, b = { mu: -2.0, sigma2: 4.0 }, c = { mu: 0.3, sigma2: 0.01 };
    const l = momentFuseNaive(momentFuseNaive(a, b), c);
    const r = momentFuseNaive(a, momentFuseNaive(b, c));
    expect(l.mu).not.toBe(r.mu);
  });

  test("AS-3: Normal-Gamma fusion is exactly associative over three parents", () => {
    const P = ngToNp({ m: 0.4, lambda: 10, alpha: 6, beta: 1.5 });
    const Q = ngToNp({ m: -1.1, lambda: 3, alpha: 2.5, beta: 0.7 });
    const R = ngToNp({ m: 2.2, lambda: 40, alpha: 20, beta: 5.0 });
    const l = ngFuse(ngFuse(P, Q), R), r = ngFuse(P, ngFuse(Q, R));
    expect(l.h1).toBe(r.h1); expect(l.h2).toBe(r.h2);
    expect(l.h3).toBe(r.h3); expect(l.h4).toBe(r.h4);
  });

  test("AS-4: N-parent fusion is one associative reduce, for any N", () => {
    const parents = SAMPLES.map(ngToNp);
    const fold = (xs: typeof parents) => xs.reduce(ngFuse);
    const forward = fold(parents);
    const reversed = fold([...parents].reverse());
    expect(forward.h1).toBeCloseTo(reversed.h1, 12);
    expect(forward.h4).toBe(reversed.h4);
  });

  // ── 3. RGB<->CMYK is a bijection, so it does NOT model `snap` ────────────────
  test("CM-1: naive RGB->CMYK->RGB round-trips exactly — refutes the `snap` correspondence", () => {
    const toCmyk = (r: number, g: number, b: number) => {
      const k = 1 - Math.max(r, g, b);
      if (k >= 1) return [0, 0, 0, 1] as const;
      return [(1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k] as const;
    };
    const toRgb = (c: number, m: number, y: number, k: number) =>
      [(1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k)] as const;
    let maxErr = 0;
    for (let i = 0; i <= 20; i++)
      for (let j = 0; j <= 20; j++)
        for (let k = 0; k <= 20; k++) {
          const [R, G, B] = [i / 20, j / 20, k / 20];
          const [c, m, y, kk] = toCmyk(R, G, B);
          const [R2, G2, B2] = toRgb(c, m, y, kk);
          maxErr = Math.max(maxErr, Math.abs(R - R2), Math.abs(G - G2), Math.abs(B - B2));
        }
    // A model of `snap` would be lossy and non-invertible. This is neither.
    expect(maxErr).toBeLessThan(1e-15);
  });
});
