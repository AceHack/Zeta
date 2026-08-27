/**
 * metrics.test.ts — falsifiers for the scoreboard itself.
 *
 * WHY THIS FILE MATTERS MORE THAN THE MODEL TESTS. Every claim the study makes
 * is a number produced in metrics.ts. A model that is subtly wrong produces a
 * number that is subtly wrong; a *metric* that is subtly wrong produces a
 * number that is confidently wrong about every model at once, and there is
 * nothing downstream that can catch it. So the checks here are hand-worked
 * against arithmetic done on paper (shown in comments so a reader can redo it)
 * rather than against whatever the implementation happens to emit.
 *
 * The load-bearing block is "the chance correction is real". `metrics.ts`
 * claims ARI is used *because* raw agreement inflates with the number of
 * clusters — that is the coincidence-of-counts failure named in
 * `.claude/rules/numerology-vs-number-theory.md`. That claim is checked here,
 * not asserted: an arbitrary partition is built with many clusters, the RAW
 * Rand index is computed alongside, and the test demands that the raw score
 * rises while ARI does not. If ARI ever started rewarding k, this fails.
 *
 * Entropy discipline (#13 noninterference): every "random" partition below is
 * drawn from `mulberry32` with a literal seed. `Math.random()` would make a
 * failure here unreproducible, which is the same as making it unfixable.
 */

import { describe, expect, test } from 'bun:test';

import {
  adjustedRandIndex,
  classificationReport,
  mcnemar,
  normalizedMutualInfo,
  wilsonInterval,
} from './metrics.ts';
import { mulberry32 } from './rng.ts';

/**
 * The UNADJUSTED Rand index (Rand 1971), implemented here and nowhere in the
 * source. It exists purely as the control for the chance-correction tests: it
 * is the thing ARI is supposed to be better than, so having it lets the test
 * demonstrate the improvement instead of taking the docstring's word for it.
 *
 *   RI = (agreements + disagreements) / C(n,2)
 *      = (C(n,2) + 2*sum_ij C(n_ij,2) - sum_i C(a_i,2) - sum_j C(b_j,2)) / C(n,2)
 */
function rawRandIndex(a: readonly (string | number)[], b: readonly (string | number)[]): number {
  const comb2 = (n: number): number => (n * (n - 1)) / 2;
  const cont = new Map<string, number>();
  const ra = new Map<string | number, number>();
  const rb = new Map<string | number, number>();
  for (let i = 0; i < a.length; i++) {
    const k = `${String(a[i])} ${String(b[i])}`;
    cont.set(k, (cont.get(k) ?? 0) + 1);
    ra.set(a[i]!, (ra.get(a[i]!) ?? 0) + 1);
    rb.set(b[i]!, (rb.get(b[i]!) ?? 0) + 1);
  }
  let sumIj = 0;
  for (const v of cont.values()) sumIj += comb2(v);
  let sumA = 0;
  for (const v of ra.values()) sumA += comb2(v);
  let sumB = 0;
  for (const v of rb.values()) sumB += comb2(v);
  const total = comb2(a.length);
  return (total + 2 * sumIj - sumA - sumB) / total;
}

/** Deterministic arbitrary partition of `n` items into `k` groups. */
function arbitraryPartition(n: number, k: number, seed: number): number[] {
  const rng = mulberry32(seed);
  return Array.from({ length: n }, () => rng.int(k));
}

// ─── adjustedRandIndex ──────────────────────────────────────────────────────

describe('adjustedRandIndex', () => {
  test('identical partitions score exactly 1', () => {
    // The upper bound has to be exact, not approximate: the study reports ARI
    // as a fraction of achievable agreement, and a top end of 0.98 would make
    // every reported number quietly relative to nothing.
    const p = [0, 0, 1, 1, 2, 2, 2, 3];
    expect(adjustedRandIndex(p, p)).toBe(1);
    // Label NAMES are irrelevant — a partition is a set of blocks, not an
    // assignment. Renaming every cluster must not move the score at all.
    const renamed = p.map((c) => `cluster-${(c + 7) % 4}`);
    expect(adjustedRandIndex(p, renamed)).toBeCloseTo(1, 12);
  });

  test('the hand-worked case: 6 points, computed on paper', () => {
    // a = [0,0,0,1,1,1]   b = [0,0,1,1,2,2]
    //
    // contingency        b=0  b=1  b=2   | row
    //   a=0                2    1    0   |  3
    //   a=1                0    1    2   |  3
    //   col                2    2    2
    //
    //   sum_ij C(n_ij,2) = C(2,2)+C(1,2)+C(1,2)+C(2,2) = 1+0+0+1 = 2
    //   sum_i  C(a_i,2)  = C(3,2)+C(3,2)               = 3+3     = 6
    //   sum_j  C(b_j,2)  = 3 * C(2,2)                            = 3
    //   C(n,2)           = C(6,2)                                = 15
    //   expected         = 6*3/15                                = 1.2
    //   max              = (6+3)/2                               = 4.5
    //   ARI              = (2 - 1.2) / (4.5 - 1.2) = 0.8/3.3     = 0.242424...
    expect(adjustedRandIndex([0, 0, 0, 1, 1, 1], [0, 0, 1, 1, 2, 2])).toBeCloseTo(0.8 / 3.3, 12);
  });

  test('independent partitions score ~0 — this is the whole point of the adjustment', () => {
    // Two partitions drawn independently from a seeded generator share nothing
    // but chance. A metric that returned a comfortable-looking 0.4 here would
    // make every clustering in the study look like a discovery.
    const n = 2000;
    const a = arbitraryPartition(n, 4, 0x5eed01);
    const b = arbitraryPartition(n, 5, 0x5eed02);
    const ari = adjustedRandIndex(a, b);
    expect(Math.abs(ari)).toBeLessThan(0.02);
    // The unadjusted index, on the SAME pair, is nowhere near zero — that gap
    // is exactly what the chance correction buys.
    expect(rawRandIndex(a, b)).toBeGreaterThan(0.5);
  });

  test('can go NEGATIVE when agreement is worse than chance', () => {
    // A metric floored at 0 cannot distinguish "no relationship" from
    // "systematically anti-correlated", and the second is a real finding.
    const a = [0, 0, 0, 0, 1, 1, 1, 1];
    const b = [0, 1, 0, 1, 0, 1, 0, 1];
    expect(adjustedRandIndex(a, b)).toBeLessThan(0);
  });

  test('THE NUMEROLOGY GUARD: ARI does not rise just because k rises', () => {
    // `.claude/rules/numerology-vs-number-theory.md` — a coincidence of counts
    // is not an identification. Splitting a dataset into more and more
    // arbitrary groups drives raw pairwise agreement toward 1 for a reason that
    // has nothing to do with structure: almost every pair ends up separated in
    // both partitions, and "separated in both" counts as agreement.
    //
    // So the test is comparative, and it must show BOTH halves: the raw score
    // must visibly inflate (otherwise the guard is guarding nothing) while ARI
    // must stay pinned at chance.
    const n = 1200;
    const truth = Array.from({ length: n }, (_, i) => i % 5); // 5 balanced classes

    const fewClusters = arbitraryPartition(n, 5, 0xc0ffee);
    const manyClusters = arbitraryPartition(n, 60, 0xc0ffef);

    const ariFew = adjustedRandIndex(truth, fewClusters);
    const ariMany = adjustedRandIndex(truth, manyClusters);
    const rawFew = rawRandIndex(truth, fewClusters);
    const rawMany = rawRandIndex(truth, manyClusters);

    // Both arbitrary partitions are equally uninformative, and ARI says so.
    expect(Math.abs(ariFew)).toBeLessThan(0.02);
    expect(Math.abs(ariMany)).toBeLessThan(0.02);

    // The raw index, meanwhile, is meaningfully HIGHER for the 60-cluster
    // partition purely because k went up. Anyone quoting this number would
    // have "improved" their clustering by shredding it.
    expect(rawMany).toBeGreaterThan(rawFew + 0.05);
    expect(rawMany).toBeGreaterThan(0.75);
  });

  test('degenerate inputs are defined, not accidental', () => {
    // Both partitions trivial => the adjustment is 0/0; the source defines it
    // as 1 to match the identical-partition case, and that choice is pinned
    // here so it cannot drift into NaN unnoticed.
    expect(adjustedRandIndex([0, 0, 0], [0, 0, 0])).toBe(1);
    expect(adjustedRandIndex([], [])).toBe(1);
    expect(Number.isNaN(adjustedRandIndex(['x', 'x'], ['y', 'y']))).toBe(false);
    expect(() => adjustedRandIndex([1, 2, 3], [1, 2])).toThrow(/length mismatch/);
  });
});

// ─── normalizedMutualInfo ───────────────────────────────────────────────────

describe('normalizedMutualInfo — the second opinion beside ARI', () => {
  test('identical partitions score 1, renaming is free', () => {
    const p = [0, 0, 1, 1, 2, 2, 2];
    expect(normalizedMutualInfo(p, p)).toBeCloseTo(1, 12);
    expect(normalizedMutualInfo(p, p.map((c) => `k${c}`))).toBeCloseTo(1, 12);
  });

  test('independent partitions score ~0', () => {
    const n = 2000;
    const a = arbitraryPartition(n, 4, 0xbeef01);
    const b = arbitraryPartition(n, 4, 0xbeef02);
    expect(Math.abs(normalizedMutualInfo(a, b))).toBeLessThan(0.02);
  });

  test('a refinement of a partition keeps full information about it', () => {
    // NMI is symmetric-normalised, so a strict refinement does NOT score 1 —
    // but it must score high, because knowing the refinement determines the
    // coarse partition exactly. This is the property that makes NMI worth
    // reporting alongside ARI: they disagree about refinements, on purpose.
    const coarse = [0, 0, 0, 0, 1, 1, 1, 1];
    const fine = [0, 0, 1, 1, 2, 2, 3, 3];
    const nmi = normalizedMutualInfo(coarse, fine);
    expect(nmi).toBeGreaterThan(0.6);
    expect(nmi).toBeLessThan(1);
    // ...and ARI penalises the same refinement much harder.
    expect(adjustedRandIndex(coarse, fine)).toBeLessThan(nmi);
  });

  test('degenerate inputs are defined', () => {
    expect(normalizedMutualInfo([], [])).toBe(1);
    // A constant partition has zero entropy; the source returns 1 rather than
    // NaN. Pinned so a future "simplification" cannot silently emit NaN into
    // the study's tables.
    expect(normalizedMutualInfo([0, 0, 0], [1, 2, 3])).toBe(1);
  });
});

// ─── mcnemar ────────────────────────────────────────────────────────────────

/** Build (yTrue, predA, predB) with exactly `b` A-only-right and `c` B-only-right. */
function pairedPreds(b: number, c: number, agree: number): {
  yTrue: string[]; predA: string[]; predB: string[];
} {
  const yTrue: string[] = [];
  const predA: string[] = [];
  const predB: string[] = [];
  for (let i = 0; i < b; i++) { yTrue.push('T'); predA.push('T'); predB.push('F'); }
  for (let i = 0; i < c; i++) { yTrue.push('T'); predA.push('F'); predB.push('T'); }
  // Concordant items: both right. They carry NO information about which model
  // is better, which is the whole reason McNemar looks only at b and c.
  for (let i = 0; i < agree; i++) { yTrue.push('T'); predA.push('T'); predB.push('T'); }
  return { yTrue, predA, predB };
}

describe('mcnemar — the paired test, not two intervals', () => {
  test('b == c gives p = 1 and favours neither', () => {
    // Perfectly balanced disagreement is the null hypothesis realised exactly.
    // A test that reported anything but "no evidence" here would manufacture
    // winners out of coin flips.
    const { yTrue, predA, predB } = pairedPreds(5, 5, 90);
    const r = mcnemar(yTrue, predA, predB);
    expect(r.b).toBe(5);
    expect(r.c).toBe(5);
    expect(r.pValue).toBe(1);
    expect(r.favours).toBe('neither');
  });

  test('b == c == 0 gives p = 1 — two models that never disagree are not ranked', () => {
    // The n == 0 short-circuit. Without it the exact binomial is 0/0. This is
    // the "identical models" case and the honest answer is silence.
    const yTrue = ['a', 'b', 'c', 'd'];
    const r = mcnemar(yTrue, yTrue, yTrue);
    expect(r.b).toBe(0);
    expect(r.c).toBe(0);
    expect(r.pValue).toBe(1);
    expect(r.favours).toBe('neither');
    // ...and it stays true when BOTH models are equally wrong on the same items.
    const wrong = ['z', 'z', 'z', 'z'];
    const r2 = mcnemar(yTrue, wrong, wrong);
    expect(r2.pValue).toBe(1);
    expect(r2.favours).toBe('neither');
  });

  test('a lopsided split (b=30, c=3) is a small p favouring A', () => {
    // Exact two-sided binomial, n = 33, k = min(b,c) = 3:
    //   P(X <= 3) = (C(33,0)+C(33,1)+C(33,2)+C(33,3)) / 2^33
    //             = (1 + 33 + 528 + 5456) / 8589934592
    //             = 6018 / 8589934592 ~= 7.005e-7
    //   p         = 2 * 7.005e-7 ~= 1.401e-6
    const { yTrue, predA, predB } = pairedPreds(30, 3, 500);
    const r = mcnemar(yTrue, predA, predB);
    expect(r.b).toBe(30);
    expect(r.c).toBe(3);
    expect(r.pValue).toBeCloseTo((2 * 6018) / 2 ** 33, 12);
    expect(r.pValue).toBeLessThan(0.001);
    expect(r.favours).toBe('a');
  });

  test('the mirror image favours B with the identical p-value', () => {
    // The test must be symmetric in its two arguments; an asymmetry would mean
    // the reported winner depended on argument order.
    const fwd = pairedPreds(30, 3, 500);
    const rev = pairedPreds(3, 30, 500);
    const a = mcnemar(fwd.yTrue, fwd.predA, fwd.predB);
    const b = mcnemar(rev.yTrue, rev.predA, rev.predB);
    expect(b.pValue).toBeCloseTo(a.pValue, 15);
    expect(b.favours).toBe('b');
  });

  test('the CONCORDANT items are ignored — that is the pairing, in one assertion', () => {
    // Same b and c, wildly different agreement counts. If the test were
    // secretly comparing marginal accuracies it would move; it must not.
    const few = pairedPreds(12, 3, 5);
    const many = pairedPreds(12, 3, 5000);
    const rFew = mcnemar(few.yTrue, few.predA, few.predB);
    const rMany = mcnemar(many.yTrue, many.predA, many.predB);
    expect(rMany.pValue).toBe(rFew.pValue);
  });

  test('a marginal split is NOT declared a winner at the 0.05 line', () => {
    // b=6, c=2, n=8: P(X<=2) = (1+8+28)/256 = 37/256, p = 74/256 ~= 0.289.
    const { yTrue, predA, predB } = pairedPreds(6, 2, 100);
    const r = mcnemar(yTrue, predA, predB);
    expect(r.pValue).toBeCloseTo(74 / 256, 12);
    expect(r.favours).toBe('neither');
  });
});

// ─── classificationReport ───────────────────────────────────────────────────

/**
 * The worked 3-class example, arithmetic done by hand.
 *
 *   yTrue = a a a a  b b b  c c c        (support: a=4, b=3, c=3, n=10)
 *   yPred = a a a b  b b c  c c a
 *
 *   i : true pred  outcome
 *   0 :  a    a    tp[a]
 *   1 :  a    a    tp[a]
 *   2 :  a    a    tp[a]
 *   3 :  a    b    fn[a], fp[b]
 *   4 :  b    b    tp[b]
 *   5 :  b    b    tp[b]
 *   6 :  b    c    fn[b], fp[c]
 *   7 :  c    c    tp[c]
 *   8 :  c    c    tp[c]
 *   9 :  c    a    fn[c], fp[a]
 *
 *   correct  = 3 + 2 + 2 = 7          => accuracy = 0.7
 *   a: tp=3 fp=1 fn=1 => P = 3/4 = 0.75      R = 3/4 = 0.75      F1 = 0.75
 *   b: tp=2 fp=1 fn=1 => P = 2/3            R = 2/3             F1 = 2/3
 *   c: tp=2 fp=1 fn=1 => P = 2/3            R = 2/3             F1 = 2/3
 *   macro-F1 = (0.75 + 2/3 + 2/3) / 3 = 2.083333.../3 = 0.694444...
 */
const HAND_TRUE = ['a', 'a', 'a', 'a', 'b', 'b', 'b', 'c', 'c', 'c'];
const HAND_PRED = ['a', 'a', 'a', 'b', 'b', 'b', 'c', 'c', 'c', 'a'];
const HAND_MACRO_F1 = (0.75 + 2 / 3 + 2 / 3) / 3;

describe('classificationReport', () => {
  test('accuracy and macro-F1 match the hand computation above', () => {
    const r = classificationReport(HAND_TRUE, HAND_PRED, ['a', 'b', 'c']);
    expect(r.n).toBe(10);
    expect(r.accuracy).toBeCloseTo(0.7, 12);
    expect(r.macroF1).toBeCloseTo(HAND_MACRO_F1, 12);
    expect(r.macroF1).toBeCloseTo(0.6944444444, 9);
  });

  test('every per-class cell matches the hand computation', () => {
    const r = classificationReport(HAND_TRUE, HAND_PRED, ['a', 'b', 'c']);
    const by = Object.fromEntries(r.perClass.map((c) => [c.label, c]));
    expect(by.a).toMatchObject({ support: 4 });
    expect(by.a!.precision).toBeCloseTo(0.75, 12);
    expect(by.a!.recall).toBeCloseTo(0.75, 12);
    expect(by.a!.f1).toBeCloseTo(0.75, 12);
    for (const l of ['b', 'c']) {
      expect(by[l]!.support).toBe(3);
      expect(by[l]!.precision).toBeCloseTo(2 / 3, 12);
      expect(by[l]!.recall).toBeCloseTo(2 / 3, 12);
      expect(by[l]!.f1).toBeCloseTo(2 / 3, 12);
    }
  });

  test('macro-F1 averages ONLY over classes with support > 0', () => {
    // The corpus is heavily imbalanced and the label list is a fixed taxonomy,
    // so it routinely contains areas no PR in a given split touches. Averaging
    // over those would divide by a larger denominator and drag the score down
    // for a reason that has nothing to do with the model — the number would
    // move when the TAXONOMY changed, not when the model did.
    const withAbsent = classificationReport(HAND_TRUE, HAND_PRED, ['a', 'b', 'c', 'd', 'e']);
    expect(withAbsent.macroF1).toBeCloseTo(HAND_MACRO_F1, 12);

    // The absent classes are still REPORTED (support 0, all metrics 0) — they
    // are excluded from the average, not hidden from the reader.
    const by = Object.fromEntries(withAbsent.perClass.map((c) => [c.label, c]));
    expect(by.d).toEqual({ label: 'd', support: 0, precision: 0, recall: 0, f1: 0 });
    expect(withAbsent.perClass.length).toBe(5);

    // And the naive version — averaging over all five — is visibly different,
    // so this test is discriminating between two live options, not restating
    // the implementation.
    const naive = withAbsent.perClass.reduce((s, c) => s + c.f1, 0) / withAbsent.perClass.length;
    expect(naive).toBeCloseTo(HAND_MACRO_F1 * (3 / 5), 12);
    expect(withAbsent.macroF1).not.toBeCloseTo(naive, 3);
  });

  test('confusion counts sum to n, and each row sums to that class support', () => {
    // A confusion matrix that loses items is a confusion matrix that lies
    // about the denominator, and every rate computed from it inherits the lie.
    const r = classificationReport(HAND_TRUE, HAND_PRED, ['a', 'b', 'c']);
    let total = 0;
    for (const row of Object.values(r.confusion)) {
      for (const v of Object.values(row)) total += v;
    }
    expect(total).toBe(r.n);
    expect(total).toBe(HAND_TRUE.length);

    const by = Object.fromEntries(r.perClass.map((c) => [c.label, c]));
    for (const [trueLabel, row] of Object.entries(r.confusion)) {
      const rowSum = Object.values(row).reduce((s, v) => s + v, 0);
      expect(rowSum).toBe(by[trueLabel]!.support);
    }
    // The diagonal is exactly the correct count.
    const diag = ['a', 'b', 'c'].reduce((s, l) => s + (r.confusion[l]?.[l] ?? 0), 0);
    expect(diag).toBe(Math.round(r.accuracy * r.n));
    expect(diag).toBe(7);
  });

  test('accuracy 1 and 0 are both reachable and exact', () => {
    const perfect = classificationReport(HAND_TRUE, HAND_TRUE, ['a', 'b', 'c']);
    expect(perfect.accuracy).toBe(1);
    expect(perfect.macroF1).toBe(1);
    const allWrong = classificationReport(HAND_TRUE, HAND_TRUE.map(() => 'z'), ['a', 'b', 'c', 'z']);
    expect(allWrong.accuracy).toBe(0);
    expect(allWrong.macroF1).toBe(0);
  });

  test('a majority-class predictor scores high ACCURACY and low MACRO-F1', () => {
    // This is the exact failure the source's docstring says macro-F1 exists to
    // expose, so it is checked rather than trusted. 90 of one class, 10 split
    // across two others; predicting the head class always gives 0.9 accuracy
    // and a macro-F1 of (2*0.9*1/1.9)/3 ~= 0.316.
    const yTrue = [
      ...Array<string>(90).fill('head'),
      ...Array<string>(5).fill('mid'),
      ...Array<string>(5).fill('tail'),
    ];
    const yPred = yTrue.map(() => 'head');
    const r = classificationReport(yTrue, yPred, ['head', 'mid', 'tail']);
    expect(r.accuracy).toBeCloseTo(0.9, 12);
    expect(r.macroF1).toBeLessThan(0.35);
    expect(r.macroF1).toBeCloseTo(((2 * 0.9 * 1) / 1.9) / 3, 12);
  });

  test('length mismatch throws rather than scoring a truncated comparison', () => {
    expect(() => classificationReport(['a', 'b'], ['a'], ['a', 'b'])).toThrow(/length mismatch/);
  });

  test('an empty evaluation set reports 0, not NaN', () => {
    const r = classificationReport([], [], ['a', 'b']);
    expect(r.n).toBe(0);
    expect(r.accuracy).toBe(0);
    expect(r.macroF1).toBe(0);
    expect(Number.isNaN(r.accuracy)).toBe(false);
  });
});

// ─── wilsonInterval ─────────────────────────────────────────────────────────

describe('wilsonInterval', () => {
  test('contains the point estimate, for every count from 0 to n', () => {
    // An interval that excludes its own point estimate is not an interval; it
    // is an arithmetic bug that still prints two plausible numbers.
    for (const n of [1, 5, 20, 137, 1000]) {
      for (const k of [0, 1, Math.floor(n / 3), Math.floor(n / 2), n - 1, n]) {
        if (k < 0 || k > n) continue;
        const [lo, hi] = wilsonInterval(k, n);
        const p = k / n;
        expect(lo).toBeLessThanOrEqual(p + 1e-12);
        expect(hi).toBeGreaterThanOrEqual(p - 1e-12);
        expect(lo).toBeLessThanOrEqual(hi);
      }
    }
  });

  test('bounds stay inside [0,1] even at the boundary counts', () => {
    // This is precisely where the normal approximation fails: it runs past 0
    // and past 1, printing an impossible proportion. Wilson does not, and the
    // boundary cases are where several per-class cells of this corpus live.
    for (const n of [1, 3, 10, 250]) {
      for (const k of [0, n]) {
        const [lo, hi] = wilsonInterval(k, n);
        expect(lo).toBeGreaterThanOrEqual(0);
        expect(hi).toBeLessThanOrEqual(1);
      }
    }
    // At k = 0 the lower bound is exactly 0 and the interval is still WIDE —
    // "we saw no successes in 3 tries" is not "the rate is 0".
    const [lo0, hi0] = wilsonInterval(0, 3);
    expect(lo0).toBe(0);
    expect(hi0).toBeGreaterThan(0.4);
    // At k = n the upper bound is exactly 1 and the lower bound is not.
    const [loN, hiN] = wilsonInterval(3, 3);
    expect(hiN).toBe(1);
    expect(loN).toBeLessThan(0.5);
  });

  test('n = 0 is handled rather than dividing by zero', () => {
    // A class with no support must not emit NaN into a results table, where it
    // would render as a blank cell and read as "fine".
    const [lo, hi] = wilsonInterval(0, 0);
    expect(lo).toBe(0);
    expect(hi).toBe(0);
    expect(Number.isNaN(lo)).toBe(false);
    expect(Number.isNaN(hi)).toBe(false);
  });

  test('the interval NARROWS as n grows at a fixed rate', () => {
    // More evidence must buy more precision, monotonically. If it did not, the
    // study's "this delta is inside the intervals" refusals would be arbitrary.
    let prevWidth = Infinity;
    for (const n of [10, 50, 200, 1000, 5000]) {
      const [lo, hi] = wilsonInterval(Math.round(0.7 * n), n);
      const width = hi - lo;
      expect(width).toBeLessThan(prevWidth);
      prevWidth = width;
    }
    expect(prevWidth).toBeLessThan(0.03);
  });

  test('the hand-checkable case: 7 of 10 at z = 1.96', () => {
    // p = 0.7, d = 1 + 1.96^2/10 = 1.38416
    // c = 0.7 + 1.96^2/20 = 0.89208
    // s = 1.96 * sqrt(0.21/10 + 1.96^2/400) = 1.96 * sqrt(0.0306040) = 0.3428954...
    const z = 1.96;
    const p = 0.7;
    const n = 10;
    const d = 1 + (z * z) / n;
    const c = p + (z * z) / (2 * n);
    const s = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
    const [lo, hi] = wilsonInterval(7, 10);
    expect(lo).toBeCloseTo((c - s) / d, 12);
    expect(hi).toBeCloseTo((c + s) / d, 12);
    expect(lo).toBeCloseTo(0.3968, 4);
    expect(hi).toBeCloseTo(0.8922, 4);
  });
});

/**
 * MUTATION PROBES.
 *
 * `.claude/rules/toy-is-free-metered-must-be-earned.md`: a test that survives a
 * broken implementation is not a falsifier. Each probe below re-implements the
 * specific defect the corresponding test is meant to catch and shows the
 * defective version producing a DIFFERENT answer — so the assertions above are
 * demonstrated to be load-bearing rather than assumed to be.
 */
describe('mutation probes — the tests above can actually fail', () => {
  test('an UNADJUSTED Rand index would be caught by the chance-correction tests', () => {
    // The mutant is `rawRandIndex` itself, which is what ARI would collapse to
    // if the `expected` term were dropped.
    const n = 1200;
    const truth = Array.from({ length: n }, (_, i) => i % 5);
    const many = arbitraryPartition(n, 60, 0xc0ffef);
    expect(Math.abs(adjustedRandIndex(truth, many))).toBeLessThan(0.02);
    expect(rawRandIndex(truth, many)).toBeGreaterThan(0.75);
    // A reader handed only the raw number would report a strong result from
    // pure noise. That is the failure the whole metric exists to prevent.
  });

  test('a macro-F1 that averaged over ABSENT classes would be caught', () => {
    const r = classificationReport(HAND_TRUE, HAND_PRED, ['a', 'b', 'c', 'd', 'e']);
    const mutant = r.perClass.reduce((s, c) => s + c.f1, 0) / r.perClass.length;
    expect(r.macroF1).toBeCloseTo(HAND_MACRO_F1, 12);
    expect(mutant).toBeCloseTo(HAND_MACRO_F1 * 0.6, 12);
    expect(Math.abs(r.macroF1 - mutant)).toBeGreaterThan(0.2);
  });

  test('a McNemar built on MARGINAL accuracies would be caught by the pairing test', () => {
    // The mutant compares accuracy counts instead of the discordant cells.
    // Adding 5000 items both models get right leaves b and c untouched but
    // moves both marginals to ~1.0 — so a marginal test would change its
    // answer while the real one does not.
    const few = pairedPreds(12, 3, 5);
    const many = pairedPreds(12, 3, 5000);
    const marginalAcc = (yTrue: string[], pred: string[]): number =>
      pred.filter((p, i) => p === yTrue[i]).length / yTrue.length;
    const deltaFew = marginalAcc(few.yTrue, few.predA) - marginalAcc(few.yTrue, few.predB);
    const deltaMany = marginalAcc(many.yTrue, many.predA) - marginalAcc(many.yTrue, many.predB);
    expect(Math.abs(deltaFew - deltaMany)).toBeGreaterThan(0.4); // the mutant moves
    expect(mcnemar(many.yTrue, many.predA, many.predB).pValue)
      .toBe(mcnemar(few.yTrue, few.predA, few.predB).pValue); // the real one does not
  });

  test('a normal-approximation interval would be caught by the [0,1] bound test', () => {
    // The mutant: p +/- z*sqrt(p(1-p)/n). At k = n it collapses to the single
    // point 1.0 (zero width, "we are certain"), and at k = 0 to the point 0.0.
    const naive = (k: number, n: number): [number, number] => {
      const p = k / n;
      const s = 1.96 * Math.sqrt((p * (1 - p)) / n);
      return [p - s, p + s];
    };
    const [nLo, nHi] = naive(3, 3);
    expect(nHi - nLo).toBe(0); // the mutant claims certainty from three trials
    const [wLo, wHi] = wilsonInterval(3, 3);
    expect(wHi - wLo).toBeGreaterThan(0.4); // Wilson does not
    expect(wLo).toBeLessThan(0.5);
    // And the mutant's lower bound at k=1,n=2 style small counts escapes [0,1]
    // in the other direction once p is near the edge with a wider z.
    const [eLo] = naive(1, 20);
    expect(eLo).toBeLessThan(0); // impossible proportion, printed with a straight face
    expect(wilsonInterval(1, 20)[0]).toBeGreaterThanOrEqual(0);
  });
});
