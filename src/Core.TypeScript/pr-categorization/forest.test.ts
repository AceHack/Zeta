/**
 * forest.test.ts — falsifiers for the random forest.
 *
 * TWO KINDS OF CHECK LIVE HERE, and conflating them is how a model test ends
 * up proving nothing:
 *
 *   1. MECHANISM checks — binning, thresholds, determinism, error handling.
 *      These have exact expected answers and are checked exactly.
 *   2. The MODEL-LEVEL NULL — "does it learn, or does it memorise?". A forest
 *      with depth 18 can fit noise on the data it was trained on, so a
 *      training-set accuracy of 1.0 proves nothing at all. Every learning
 *      claim below is therefore measured on HELD-OUT data, and each one is
 *      paired with a shuffled-label run on the same split. The shuffled run is
 *      the falsifier: if it did NOT collapse to the majority-class rate, the
 *      high accuracy beside it would be evidence of leakage rather than of
 *      learning, and the study's numbers would be void.
 *
 * Entropy discipline (#13 noninterference): all data is generated from
 * `mulberry32` with literal seeds and all forests are trained with explicit
 * seeds. There is no `Math.random()` and no `Date.now()` in this file. A
 * flaky-looking failure here is a real failure, reproducible by re-running.
 */

import { describe, expect, test } from 'bun:test';

import {
  DEFAULT_FOREST,
  argmax,
  binMatrix,
  forestPredict,
  forestPredictProba,
  quantileThresholds,
  trainForest,
} from './forest.ts';
import { mulberry32, shuffle, type Rng } from './rng.ts';

// ─── deterministic data generators ──────────────────────────────────────────

/** Box-Muller on the seeded generator — normal noise with no ambient entropy. */
function gauss(rng: Rng): number {
  const u = Math.max(1e-12, rng.next());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next());
}

/**
 * `nClasses` isotropic Gaussian blobs strung out along the diagonal, so every
 * feature carries signal. Deliberately EASY: the point of these tests is to
 * detect a broken forest, not to measure how hard a problem it can solve, and
 * a hard problem would produce a threshold nobody could interpret.
 */
function blobs(
  n: number,
  dim: number,
  nClasses: number,
  sep: number,
  sigma: number,
  seed: number,
): { X: Float64Array[]; y: number[] } {
  const rng = mulberry32(seed);
  const X: Float64Array[] = [];
  const y: number[] = [];
  for (let i = 0; i < n; i++) {
    const c = i % nClasses;
    const v = new Float64Array(dim);
    for (let f = 0; f < dim; f++) v[f] = c * sep + gauss(rng) * sigma;
    X.push(v);
    y.push(c);
  }
  return { X, y };
}

const accuracy = (pred: readonly number[], truth: readonly number[]): number =>
  pred.length === 0 ? 0 : pred.filter((p, i) => p === truth[i]).length / pred.length;

/** The rate a model gets for free by always naming the most common label. */
const majorityRate = (y: readonly number[]): number => {
  const counts = new Map<number, number>();
  for (const v of y) counts.set(v, (counts.get(v) ?? 0) + 1);
  return Math.max(...counts.values()) / y.length;
};

// ─── quantileThresholds ─────────────────────────────────────────────────────

describe('quantileThresholds', () => {
  test('few distinct values => edges sit STRICTLY BETWEEN them, so each bins alone', () => {
    // This is the property that makes a one-hot or small-integer column split
    // exactly rather than approximately. If an edge landed ON a value, two
    // distinct values would share a bin and the tree could never separate
    // them — a whole class of splits would become invisible to the model, and
    // nothing downstream would report an error.
    const values = [0, 1, 5, 0, 1, 5, 5, 1];
    const X = values.map((v) => Float64Array.from([v]));
    const edges = quantileThresholds(X, 1, 24)[0]!;

    const distinct = [...new Set(values)].sort((a, b) => a - b); // [0, 1, 5]
    expect(edges.length).toBe(distinct.length - 1);
    for (let i = 0; i < edges.length; i++) {
      expect(edges[i]).toBeGreaterThan(distinct[i]!);
      expect(edges[i]).toBeLessThan(distinct[i + 1]!);
    }
    expect(Array.from(edges)).toEqual([0.5, 3]);

    // ...and the consequence, stated as the thing that actually matters: the
    // three distinct values land in three DIFFERENT bins.
    const bins = binMatrix(X, [edges]).map((r) => r[0]!);
    const binOfValue = new Map<number, number>();
    values.forEach((v, i) => binOfValue.set(v, bins[i]!));
    expect(new Set(binOfValue.values()).size).toBe(distinct.length);
    expect(binOfValue.get(0)).toBe(0);
    expect(binOfValue.get(1)).toBe(1);
    expect(binOfValue.get(5)).toBe(2);
  });

  test('a CONSTANT feature produces zero edges and does not crash', () => {
    // A constant column has no split to offer. The honest representation is an
    // empty edge array (one bin, no cut points); the tempting alternative —
    // manufacturing `nBins-1` identical edges — would have every sample land
    // in bin 0 anyway while making the histogram scan pretend there was a
    // choice. Constant columns are common in this corpus (a one-hot for an
    // area absent from a split), so this is a live path, not a curiosity.
    const X = Array.from({ length: 30 }, () => Float64Array.from([7, 7]));
    const th = quantileThresholds(X, 2, 24);
    expect(th.length).toBe(2);
    expect(th[0]!.length).toBe(0);
    expect(th[1]!.length).toBe(0);
    // Binning a constant column is total and lands everything in bin 0.
    const binned = binMatrix(X, th);
    expect(binned.every((r) => r[0] === 0 && r[1] === 0)).toBe(true);
    // A value never seen at fit time still bins, in both directions.
    expect(binMatrix([Float64Array.from([-1e9, 1e9])], th)[0]![0]).toBe(0);
  });

  test('many distinct values => at most nBins-1 edges (the histogram approximation)', () => {
    // The stated departure from Breiman: split precision is traded for O(bins)
    // scans. Pinned here so the trade stays the one the docstring describes.
    const rng = mulberry32(31337);
    const X = Array.from({ length: 500 }, () => Float64Array.from([rng.next() * 100]));
    for (const nBins of [4, 8, 24]) {
      const edges = quantileThresholds(X, 1, nBins)[0]!;
      expect(edges.length).toBe(nBins - 1);
      // Edges are non-decreasing — a binary search over them is only valid if
      // they are sorted, and nothing in `binOf` would notice if they were not.
      for (let i = 1; i < edges.length; i++) {
        expect(edges[i]).toBeGreaterThanOrEqual(edges[i - 1]!);
      }
    }
  });

  test('is a pure function of the column — same input, byte-identical edges', () => {
    const rng = mulberry32(4242);
    const X = Array.from({ length: 200 }, () => Float64Array.from([rng.next(), rng.int(3)]));
    const a = quantileThresholds(X, 2, 12);
    const b = quantileThresholds(X, 2, 12);
    expect(a.map((t) => Array.from(t))).toEqual(b.map((t) => Array.from(t)));
  });
});

// ─── binMatrix ──────────────────────────────────────────────────────────────

describe('binMatrix', () => {
  test('is monotone in the value — a larger value never gets a smaller bin', () => {
    // Trees split on `bin <= b`, which is only a meaningful ordering test if
    // binning preserves the order of the underlying feature.
    const rng = mulberry32(2718);
    const X = Array.from({ length: 300 }, () => Float64Array.from([rng.next() * 10]));
    const th = quantileThresholds(X, 1, 8);
    const sorted = [...X].sort((a, b) => a[0]! - b[0]!);
    const bins = binMatrix(sorted, th).map((r) => r[0]);
    for (let i = 1; i < bins.length; i++) expect(bins[i]).toBeGreaterThanOrEqual(bins[i - 1]!);
  });

  test('bin indices stay within [0, edges.length]', () => {
    const X = [0, 1, 5].map((v) => Float64Array.from([v]));
    const th = quantileThresholds(X, 1, 24);
    for (const v of [-1e9, -1, 0, 0.5, 1, 3, 5, 1e9]) {
      const b = binMatrix([Float64Array.from([v])], th)[0]![0];
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(th[0]!.length);
    }
  });
});

// ─── learning ───────────────────────────────────────────────────────────────

describe('trainForest / forestPredict — learning behaviour', () => {
  test('learns a separable 2-class problem to high HELD-OUT accuracy', () => {
    const { X, y } = blobs(400, 4, 2, 4, 1.2, 1234);
    const split = 200;
    const f = trainForest(X.slice(0, split), y.slice(0, split), 2);
    const acc = accuracy(forestPredict(f, X.slice(split)), y.slice(split));
    expect(acc).toBeGreaterThan(0.9);
    // Well above the free rate, which is what "learns" has to mean.
    expect(acc).toBeGreaterThan(majorityRate(y.slice(split)) + 0.3);
  });

  test('learns a separable 3-class problem to high HELD-OUT accuracy', () => {
    // Three classes is the case that catches a binary-only bug — a forest that
    // silently collapsed to one-vs-rest would still pass the 2-class test.
    const { X, y } = blobs(600, 4, 3, 4, 1.2, 777);
    const split = 300;
    const f = trainForest(X.slice(0, split), y.slice(0, split), 3);
    const pred = forestPredict(f, X.slice(split));
    expect(accuracy(pred, y.slice(split))).toBeGreaterThan(0.9);
    // All three labels are actually USED. A model that never emits one class
    // can still score well on a balanced problem by luck of the split; this is
    // the check that it did not.
    expect(new Set(pred).size).toBe(3);
  });

  test('MUTATION PROBE / THE MODEL-LEVEL NULL: shuffled labels collapse to the majority rate', () => {
    // The mutant here is the DATA, not the code: destroy the label-feature
    // relationship and keep everything else identical. If accuracy did not
    // fall to the free rate, the high number in the test above would be
    // measuring leakage (or memorisation surviving the split), not learning.
    //
    // Balanced 2-class => the majority rate is 0.5, so the collapse is
    // unmistakable rather than a matter of interpretation.
    const { X, y } = blobs(400, 4, 2, 4, 1.2, 1234);
    const yShuffled = shuffle([...y], mulberry32(0xd15ea5e));
    const split = 200;

    const real = trainForest(X.slice(0, split), y.slice(0, split), 2);
    const nulled = trainForest(X.slice(0, split), yShuffled.slice(0, split), 2);

    const realAcc = accuracy(forestPredict(real, X.slice(split)), y.slice(split));
    const nullAcc = accuracy(forestPredict(nulled, X.slice(split)), yShuffled.slice(split));
    const free = majorityRate(yShuffled.slice(split));

    expect(realAcc).toBeGreaterThan(0.9);
    expect(nullAcc).toBeLessThan(free + 0.12);
    expect(realAcc - nullAcc).toBeGreaterThan(0.35);
  });

  test('the same null holds on an IMBALANCED problem, where the free rate is high', () => {
    // The balanced case above could be passed by a broken model that always
    // guessed one class. Here the free rate is ~0.8, so "collapses to the
    // majority rate" is a real ceiling and not a coin flip — and it shows why
    // accuracy alone is not a result on this corpus.
    const rng = mulberry32(555);
    const X: Float64Array[] = [];
    const y: number[] = [];
    for (let i = 0; i < 500; i++) {
      const c = i % 5 === 0 ? 1 : 0; // 20% minority
      const v = new Float64Array(3);
      for (let f = 0; f < 3; f++) v[f] = c * 5 + gauss(rng) * 1.0;
      X.push(v);
      y.push(c);
    }
    const yShuffled = shuffle([...y], mulberry32(0xabcdef));
    const split = 250;
    const free = majorityRate(yShuffled.slice(split));
    expect(free).toBeGreaterThan(0.7); // the ceiling really is high here

    const real = trainForest(X.slice(0, split), y.slice(0, split), 2);
    const nulled = trainForest(X.slice(0, split), yShuffled.slice(0, split), 2);
    const realAcc = accuracy(forestPredict(real, X.slice(split)), y.slice(split));
    const nullAcc = accuracy(forestPredict(nulled, X.slice(split)), yShuffled.slice(split));

    expect(realAcc).toBeGreaterThan(0.9);
    expect(nullAcc).toBeLessThan(free + 0.05);
  });

  test('a constant feature column does not break training', () => {
    // Zero-edge thresholds reach `nBinsMax` and the histogram scan; if the
    // `Math.max(2, ...)` floor were removed this would throw or loop zero
    // times and silently produce a stump.
    const { X, y } = blobs(200, 3, 2, 4, 1.0, 606);
    const padded = X.map((r) => Float64Array.from([...r, 1, 1]));
    const f = trainForest(padded, y, 2);
    expect(accuracy(forestPredict(f, padded), y)).toBeGreaterThan(0.9);
  });

  test('an empty training set THROWS rather than returning a vacuous model', () => {
    // A forest of empty trees would predict something for every input and
    // report an accuracy — a check that cannot fail, wearing a model's
    // clothes. Refusing is the only honest option.
    expect(() => trainForest([], [], 2)).toThrow(/empty training set/);
    expect(() => trainForest([], [], 2, DEFAULT_FOREST)).toThrow(/trainForest/);
  });
});

// ─── probabilities ──────────────────────────────────────────────────────────

describe('forestPredictProba', () => {
  test('probabilities are in [0,1] and sum to 1, on every row of a 3-class fit', () => {
    // Breiman's estimate is the MEAN of the per-tree leaf distributions, so
    // this is a real invariant of the averaging, not a normalisation applied
    // at the end. If a leaf ever failed to normalise its counts, the sum would
    // drift off 1 and `argmax` would still return a plausible-looking label.
    const { X, y } = blobs(450, 4, 3, 4, 1.2, 909);
    const f = trainForest(X, y, 3);
    for (const x of X) {
      const p = forestPredictProba(f, x);
      expect(p.length).toBe(3);
      let s = 0;
      for (const v of p) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
        expect(Number.isFinite(v)).toBe(true);
        s += v;
      }
      expect(s).toBeCloseTo(1, 10);
    }
  });

  test('holds on far-out-of-distribution inputs too', () => {
    // Extrapolation is where a normalisation bug would surface first, and the
    // study feeds this model rows it never saw at fit time.
    const { X, y } = blobs(300, 4, 2, 4, 1.2, 1010);
    const f = trainForest(X, y, 2);
    for (const v of [-1e9, -50, 0, 50, 1e9]) {
      const p = forestPredictProba(f, Float64Array.from([v, v, v, v]));
      let s = 0;
      for (const q of p) {
        expect(q).toBeGreaterThanOrEqual(0);
        expect(q).toBeLessThanOrEqual(1);
        s += q;
      }
      expect(s).toBeCloseTo(1, 10);
    }
  });

  test('forestPredict IS argmax of forestPredictProba — no second decision rule', () => {
    // Two code paths that could disagree about the answer are two models.
    const { X, y } = blobs(300, 4, 3, 4, 1.2, 1111);
    const f = trainForest(X, y, 3);
    const pred = forestPredict(f, X);
    X.forEach((x, i) => expect(pred[i]).toBe(argmax(forestPredictProba(f, x))));
  });

  test('argmax breaks ties toward the FIRST index, deterministically', () => {
    // A tie broken randomly would make the whole pipeline non-replayable for a
    // reason no seed could control.
    expect(argmax(Float64Array.from([0.5, 0.5, 0]))).toBe(0);
    expect(argmax(Float64Array.from([0, 0, 0]))).toBe(0);
    expect(argmax(Float64Array.from([0.1, 0.9, 0.9]))).toBe(1);
  });
});

// ─── determinism (DST, discipline #4 / manifesto §7) ────────────────────────

describe('DST — the forest replays from its seed', () => {
  test('same seed, same data => IDENTICAL predictions and identical probabilities', () => {
    // Not "similar". A study whose numbers move between runs cannot be checked
    // by anyone, including its author, and every claim built on it is an
    // assertion rather than a measurement.
    const { X, y } = blobs(400, 4, 3, 4, 1.2, 24680);
    const a = trainForest(X, y, 3, { ...DEFAULT_FOREST, seed: 4242 });
    const b = trainForest(X, y, 3, { ...DEFAULT_FOREST, seed: 4242 });
    expect(forestPredict(a, X)).toEqual(forestPredict(b, X));
    for (const x of X.slice(0, 40)) {
      expect(Array.from(forestPredictProba(a, x)))
        .toEqual(Array.from(forestPredictProba(b, x)));
    }
    // The learned structure itself, not just its output, is reproduced.
    expect(JSON.stringify(a.trees)).toBe(JSON.stringify(b.trees));
    expect(a.thresholds.map((t) => Array.from(t)))
      .toEqual(b.thresholds.map((t) => Array.from(t)));
  });

  test('a DIFFERENT seed is still deterministic for that seed', () => {
    // The guarantee is per-seed reproducibility, which is a stronger and more
    // useful statement than "seeds differ". Both properties are checked: each
    // seed replays exactly, and both seeds solve the problem — so the seed is
    // a nuisance parameter, not a hidden tuning knob.
    const { X, y } = blobs(400, 4, 3, 4, 1.2, 13579);
    const s1a = trainForest(X, y, 3, { ...DEFAULT_FOREST, seed: 1 });
    const s1b = trainForest(X, y, 3, { ...DEFAULT_FOREST, seed: 1 });
    const s2a = trainForest(X, y, 3, { ...DEFAULT_FOREST, seed: 2 });
    const s2b = trainForest(X, y, 3, { ...DEFAULT_FOREST, seed: 2 });

    expect(forestPredict(s1a, X)).toEqual(forestPredict(s1b, X));
    expect(forestPredict(s2a, X)).toEqual(forestPredict(s2b, X));
    expect(accuracy(forestPredict(s1a, X), y)).toBeGreaterThan(0.9);
    expect(accuracy(forestPredict(s2a, X), y)).toBeGreaterThan(0.9);

    // The seed reaches the bootstrap and the feature subsampling, so the two
    // forests are genuinely different objects even though both are correct.
    expect(JSON.stringify(s1a.trees)).not.toBe(JSON.stringify(s2a.trees));
  });

  test('MUTATION PROBE: the replay test can fail — the seed really reaches the trees', () => {
    // A determinism test is worthless if the thing it compares is constant. If
    // the seed never reached the bootstrap or the feature subsampling, the
    // "same seed => identical" assertions above would pass trivially, and they
    // would keep passing after someone swapped in an ambient generator.
    //
    // So the probe is the converse: two DIFFERENT seeds must produce genuinely
    // different forests. That difference is exactly what an unseeded model
    // would exhibit between two runs of the same command — which is what makes
    // the equality assertions above load-bearing rather than tautological.
    const { X, y } = blobs(200, 3, 2, 4, 1.2, 8642);
    const draw = (seed: number): number[] => {
      const rng = mulberry32(seed);
      return Array.from({ length: 40 }, () => rng.int(X.length));
    };
    expect(draw(99)).toEqual(draw(99));
    expect(draw(99)).not.toEqual(draw(100));

    const f1 = trainForest(X, y, 2, { ...DEFAULT_FOREST, seed: 5 });
    const f2 = trainForest(X, y, 2, { ...DEFAULT_FOREST, seed: 6 });
    // No clock is consulted anywhere in this file: the only entropy that
    // reaches a forest arrives through an explicit integer seed.
    expect(JSON.stringify(f1.trees)).not.toBe(JSON.stringify(f2.trees));
  });
});
