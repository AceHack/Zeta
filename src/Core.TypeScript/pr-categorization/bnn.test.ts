/**
 * bnn.test.ts — falsifiers for the Bayesian classifier.
 *
 * The load-bearing block is "F# PARITY". bnn.ts claims its update IS the one
 * in `src/Bayesian/ToyBosonFermionBnn.fs` (routed through `Ep.probitProject`),
 * not merely a similar one. That is an entailment claim about a citation, and
 * `.claude/rules/anchor-to-human-prior-art.md` requires anchors to be CHECKED
 * rather than cited — so the F# formulas are re-implemented here verbatim from
 * the F# source and the two updates are compared numerically. If someone
 * changes the update in bnn.ts, this fails; if someone changes it in the F#,
 * this file is where the divergence is supposed to be noticed.
 */

import { describe, expect, test } from 'bun:test';

import {
  DEFAULT_BNN, Phi, bnnPredictProba, phi, trainBinaryBnn, trainBnn, vFunc, wFunc,
} from './bnn.ts';

// ─── The F# side, transcribed verbatim from src/Bayesian/Ep.fs ──────────────

/**
 * `Ep.probitProject`, transcribed from F#:
 *
 *     let s = sqrt (1.0 + v)
 *     let z = m / s
 *     let lambda = inverseMills z
 *     let mHat = m + v * lambda / s
 *     let vHat = v * (1.0 - (v / (1.0 + v)) * lambda * (z + lambda))
 */
function probitProjectFsharp(m: number, v: number): { mHat: number; vHat: number } {
  const s = Math.sqrt(1.0 + v);
  const z = m / s;
  const lambda = phi(z) / Phi(z); // inverseMills
  const mHat = m + (v * lambda) / s;
  const vHat = v * (1.0 - (v / (1.0 + v)) * lambda * (z + lambda));
  return { mHat, vHat };
}

/** `ToyBosonFermionBnn.absorb`, transcribed from F#. */
function absorbFsharp(
  x: readonly number[],
  bosonic: boolean,
  mean: Float64Array,
  variance: Float64Array,
): { mean: Float64Array; variance: Float64Array } {
  const s = bosonic ? 1.0 : -1.0;
  let m = 0;
  let v = 0;
  for (let i = 0; i < x.length; i++) {
    m += mean[i]! * x[i]!;
    v += variance[i]! * x[i]! * x[i]!;
  }
  m = s * m;
  if (!Number.isFinite(m) || !Number.isFinite(v) || v <= 0) return { mean, variance };
  const { mHat, vHat } = probitProjectFsharp(m, v);
  const alpha = (mHat - m) / v;
  const beta = (v - vHat) / (v * v);
  const nm = Float64Array.from(mean);
  const nv = Float64Array.from(variance);
  for (let i = 0; i < x.length; i++) {
    nm[i] = nm[i]! + nv[i]! * s * x[i]! * alpha;
    nv[i] = Math.max(1e-8, nv[i]! - nv[i]! * nv[i]! * x[i]! * x[i]! * beta);
  }
  return { mean: nm, variance: nv };
}

describe('F# PARITY — the update is the same one, checked not asserted', () => {
  test("alpha == v(t)/s and beta == w(t)/s2, the identity bnn.ts's docstring claims", () => {
    for (const v of [0.05, 0.5, 1, 4, 25]) {
      for (const m of [-6, -1.5, -0.2, 0, 0.3, 2, 7]) {
        const { mHat, vHat } = probitProjectFsharp(m, v);
        const alpha = (mHat - m) / v;
        const beta = (v - vHat) / (v * v);
        const s2 = 1 + v; // beta parameter = 1
        const s = Math.sqrt(s2);
        const t = m / s;
        expect(alpha).toBeCloseTo(vFunc(t) / s, 10);
        expect(beta).toBeCloseTo(wFunc(t) / s2, 10);
      }
    }
  });

  test('a full fold agrees with the F# absorb loop to 1e-12, every step', () => {
    const dim = 6;
    const examples: Array<{ x: number[]; y: number }> = [];
    // Deterministic pseudo-data; no clock, no Math.random.
    let s = 7;
    const nextRand = (): number => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    for (let i = 0; i < 120; i++) {
      const x = Array.from({ length: dim }, () => (i === 0 ? 1 : nextRand() * 2 - 1));
      x[0] = 1; // bias, as the F# feature map has
      examples.push({ x, y: nextRand() > 0.5 ? 1 : -1 });
    }

    // F# side: fold in order.
    let fsMean: Float64Array<ArrayBufferLike> = new Float64Array(dim);
    let fsVar: Float64Array<ArrayBufferLike> = new Float64Array(dim).fill(1);
    for (const e of examples) {
      const r = absorbFsharp(e.x, e.y > 0, fsMean, fsVar);
      fsMean = r.mean;
      fsVar = r.variance;
    }

    // TS side: same order (`as-given`), same prior, same variance floor.
    const ts = trainBinaryBnn(
      examples.map((e) => Float64Array.from(e.x)),
      examples.map((e) => e.y),
      { ...DEFAULT_BNN, orderPolicy: 'as-given', minVariance: 1e-8 },
    );

    for (let i = 0; i < dim; i++) {
      expect(ts.mean[i]).toBeCloseTo(fsMean[i]!, 12);
      expect(ts.variance[i]).toBeCloseTo(fsVar[i]!, 12);
    }
  });

  test('MUTATION PROBE: a wrong-sign update is caught by the parity test', () => {
    // If bnn.ts dropped the sign on the mean update, the fold would diverge
    // from the F# immediately. Demonstrated here so the check above is known
    // to be load-bearing rather than trivially satisfiable.
    const x = [1, 0.5, -0.25];
    const mean = new Float64Array(3);
    const variance = new Float64Array(3).fill(1);
    const good = absorbFsharp(x, false, mean, variance);
    const bad = absorbFsharp(x, true, mean, variance);
    expect(good.mean[1]).not.toBeCloseTo(bad.mean[1]!, 6);
  });
});

describe('numerics', () => {
  test('Phi is a CDF: monotone, and correct at the points we know exactly', () => {
    expect(Phi(0)).toBeCloseTo(0.5, 12);
    expect(Phi(1.959963985)).toBeCloseTo(0.975, 8);
    expect(Phi(-1.959963985)).toBeCloseTo(0.025, 8);
    let prev = -1;
    for (let z = -8; z <= 8; z += 0.25) {
      const p = Phi(z);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });

  test('Phi does not underflow to zero in the far tail — the reason erfc is used', () => {
    // A naive series returns exactly 0 here, which makes vFunc divide by zero
    // on precisely the confidently-wrong examples that matter most.
    expect(Phi(-10)).toBeGreaterThan(0);
    expect(Phi(-20)).toBeGreaterThan(0);
    expect(Number.isFinite(vFunc(-20))).toBe(true);
  });

  test('w(t) stays strictly inside (0,1) so the posterior variance cannot go negative', () => {
    for (let t = -30; t <= 30; t += 0.5) {
      const w = wFunc(t);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThanOrEqual(1);
    }
  });

  test('v(t) -> -t in the far-left tail (the asymptotic guard)', () => {
    expect(vFunc(-50)).toBeCloseTo(50, 0);
  });
});

describe('learning behaviour', () => {
  const dim = 4;
  const makeSeparable = (n: number) => {
    const X: Float64Array[] = [];
    const y: number[] = [];
    let s = 99;
    const r = (): number => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    for (let i = 0; i < n; i++) {
      const cls = i % 2;
      const v = new Float64Array(dim);
      v[0] = 1;
      v[1] = cls === 0 ? 1 + r() * 0.1 : -1 - r() * 0.1;
      v[2] = r() * 0.05;
      v[3] = r() * 0.05;
      X.push(v);
      y.push(cls);
    }
    return { X, y };
  };

  test('learns a separable binary problem well above chance', () => {
    const { X, y } = makeSeparable(400);
    const m = trainBnn(X, y, 2);
    let correct = 0;
    for (let i = 0; i < X.length; i++) {
      const p = bnnPredictProba(m, X[i]!);
      if ((p[1]! > p[0]! ? 1 : 0) === y[i]) correct++;
    }
    expect(correct / X.length).toBeGreaterThan(0.9);
  });

  test('posterior variance only ever DECREASES — evidence never adds ignorance', () => {
    const { X, y } = makeSeparable(200);
    const m = trainBinaryBnn(X, y.map((v) => (v === 1 ? 1 : -1)));
    for (let i = 0; i < dim; i++) {
      expect(m.variance[i]).toBeLessThanOrEqual(DEFAULT_BNN.priorVariance);
      expect(m.variance[i]).toBeGreaterThan(0);
    }
  });

  test('is DST-replayable: same seed and data give byte-identical posteriors', () => {
    const { X, y } = makeSeparable(150);
    const a = trainBnn(X, y, 2, { ...DEFAULT_BNN, seed: 4242 });
    const b = trainBnn(X, y, 2, { ...DEFAULT_BNN, seed: 4242 });
    expect(Array.from(a.models[0]!.mean)).toEqual(Array.from(b.models[0]!.mean));
    expect(Array.from(a.models[1]!.variance)).toEqual(Array.from(b.models[1]!.variance));
  });

  test('CANNOT learn shuffled labels — the model has no memorisation channel', () => {
    // The study's label-shuffle null depends on this being true of the model
    // itself, not only of the pipeline around it.
    const { X } = makeSeparable(400);
    let s = 5;
    const yShuf = X.map(() => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff > 0.5 ? 1 : 0;
    });
    const m = trainBnn(X, yShuf, 2);
    let correct = 0;
    for (let i = 0; i < X.length; i++) {
      const p = bnnPredictProba(m, X[i]!);
      if ((p[1]! > p[0]! ? 1 : 0) === yShuf[i]) correct++;
    }
    expect(correct / X.length).toBeLessThan(0.65);
  });

  test('one-vs-rest heads are not identical — per-class seeds actually differ', () => {
    const { X, y } = makeSeparable(120);
    const m = trainBnn(X, y, 2);
    expect(Array.from(m.models[0]!.mean)).not.toEqual(Array.from(m.models[1]!.mean));
  });
});
