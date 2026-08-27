/**
 * kmeans.test.ts — falsifiers for the clustering, and for the honesty of what
 * it is allowed to claim.
 *
 * The mechanical checks (does Lloyd converge, is it seeded, does it refuse
 * nonsense k) are the easy half. The half that actually protects the study is
 * the last block, "the supervised ceiling is not a clustering result".
 *
 * kmeans.ts is explicit that `majorityMap` imports supervision through the
 * back door: it lets an oracle name every cluster for free and then scores the
 * naming. That is a warning, and a warning in a docstring is exactly the kind
 * of unenforced claim this repo treats as a defect. So it is CHECKED here:
 * on data with no cluster structure at all, `majorityMap` is shown returning a
 * comfortable ~0.8 accuracy while ARI sits at ~0. Same partition, same labels,
 * two numbers that tell opposite stories — and the one that tells the true
 * story is the chance-corrected one.
 *
 * Entropy discipline (#13 noninterference): every point, label and restart in
 * this file comes from `mulberry32` with a literal seed. No `Math.random()`,
 * no clock. A failure here reproduces on re-run or it is not a failure.
 */

import { describe, expect, test } from 'bun:test';

import { DEFAULT_KMEANS, kmeans, majorityMap } from './kmeans.ts';
import { adjustedRandIndex, normalizedMutualInfo } from './metrics.ts';
import { mulberry32, type Rng } from './rng.ts';

// ─── deterministic data ─────────────────────────────────────────────────────

/** Box-Muller on the seeded generator — normal noise with no ambient entropy. */
function gauss(rng: Rng): number {
  const u = Math.max(1e-12, rng.next());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next());
}

/**
 * `nBlobs` isotropic Gaussian blobs centred on distinct coordinate axes, so
 * they are separated in every direction rather than strung along a line. With
 * `sep = 8` and `sigma = 0.7` the blobs are ~11 sigma apart: a correct
 * implementation must find them, so a failure is a failure of the algorithm
 * and never of the problem's difficulty.
 */
function blobs(
  n: number,
  dim: number,
  nBlobs: number,
  sep: number,
  sigma: number,
  seed: number,
): { X: Float64Array[]; y: number[] } {
  const rng = mulberry32(seed);
  const X: Float64Array[] = [];
  const y: number[] = [];
  for (let i = 0; i < n; i++) {
    const c = i % nBlobs;
    const v = new Float64Array(dim);
    for (let f = 0; f < dim; f++) v[f] = (f === c ? sep : 0) + gauss(rng) * sigma;
    X.push(v);
    y.push(c);
  }
  return { X, y };
}

/** A single uniform cloud: n points, ZERO cluster structure, by construction. */
function structurelessCloud(n: number, dim: number, seed: number): Float64Array[] {
  const rng = mulberry32(seed);
  return Array.from({ length: n }, () =>
    Float64Array.from({ length: dim }, () => rng.next()));
}

const sqDist = (a: Float64Array, b: Float64Array): number => {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i]! - b[i]!;
    s += d * d;
  }
  return s;
};

// ─── recovering real structure ──────────────────────────────────────────────

describe('kmeans recovers structure that is actually there', () => {
  test('three well-separated blobs at k=3 => ARI ~ 1 against the true blob ids', () => {
    // ARI, not accuracy: k-means returns a PARTITION and the blob ids are a
    // LABELLING, and the source is emphatic that those are different kinds of
    // object. ARI is the only comparison that is meaningful between them, and
    // it is chance-corrected so a near-1 score cannot be bought with k.
    const { X, y } = blobs(300, 3, 3, 8, 0.7, 2026);
    const r = kmeans(X, { ...DEFAULT_KMEANS, k: 3 });
    expect(adjustedRandIndex(r.assignments, y)).toBeGreaterThan(0.98);
    expect(normalizedMutualInfo(r.assignments, y)).toBeGreaterThan(0.95);
    // All three clusters are actually populated — a partition that used two
    // could still score respectably and would not have found the structure.
    expect(new Set(r.assignments).size).toBe(3);
    expect(r.assignments.length).toBe(X.length);
  });

  test('the returned centroids ARE the nearest centroid of their members', () => {
    // The result object carries assignments, centroids and inertia separately;
    // if they ever described different states of the loop, every downstream
    // reading of the result would be quietly incoherent. Checked rather than
    // assumed, because nothing in the API forces them to agree.
    const { X } = blobs(300, 3, 3, 8, 0.7, 2026);
    for (const k of [2, 3, 6]) {
      const r = kmeans(X, { ...DEFAULT_KMEANS, k, nInit: 8 });
      let recomputed = 0;
      for (let i = 0; i < X.length; i++) {
        let best = 0;
        let bd = Infinity;
        for (let c = 0; c < k; c++) {
          const d = sqDist(X[i]!, r.centroids[c]!);
          if (d < bd) { bd = d; best = c; }
        }
        expect(r.assignments[i]).toBe(best);
        recomputed += sqDist(X[i]!, r.centroids[r.assignments[i]!]!);
      }
      // ...and the reported inertia is that same sum, not a different one.
      expect(recomputed).toBeCloseTo(r.inertia, 6);
    }
  });

  test('inertia does not RISE as k rises (k=2 vs k=6 on the same data)', () => {
    // A monotone objective in k is what makes an elbow plot readable at all.
    // Lloyd is only locally optimal, so this is a property of the restart
    // policy as much as of the algorithm — which is why it is worth a test:
    // if `nInit` stopped taking the lowest-inertia run, this could invert.
    const { X } = blobs(400, 4, 4, 8, 0.7, 31415);
    const k2 = kmeans(X, { ...DEFAULT_KMEANS, k: 2, nInit: 8 });
    const k6 = kmeans(X, { ...DEFAULT_KMEANS, k: 6, nInit: 8 });
    expect(k6.inertia).toBeLessThanOrEqual(k2.inertia);
    // On genuinely clustered data the drop is large, not marginal.
    expect(k6.inertia).toBeLessThan(k2.inertia * 0.5);
    expect(k2.inertia).toBeGreaterThan(0);
  });

  test('k = n drives inertia to exactly 0 — every point is its own centre', () => {
    // The degenerate top end of the elbow, and the reason inertia alone can
    // never choose k: it is minimised by the partition that explains nothing.
    const { X } = blobs(12, 3, 3, 8, 0.7, 6180);
    const r = kmeans(X, { ...DEFAULT_KMEANS, k: X.length, nInit: 2 });
    expect(r.inertia).toBeCloseTo(0, 12);
    expect(new Set(r.assignments).size).toBe(X.length);
  });
});

// ─── argument handling ──────────────────────────────────────────────────────

describe('kmeans argument handling — refusals are part of the contract', () => {
  test('k = 1 puts every point in one cluster', () => {
    const { X } = blobs(120, 3, 3, 8, 0.7, 1618);
    const r = kmeans(X, { ...DEFAULT_KMEANS, k: 1 });
    expect(new Set(r.assignments)).toEqual(new Set([0]));
    expect(r.assignments.length).toBe(X.length);
    expect(r.centroids.length).toBe(1);
    // The single centroid is the global mean.
    const dim = X[0]!.length;
    for (let f = 0; f < dim; f++) {
      const mean = X.reduce((s, x) => s + x[f]!, 0) / X.length;
      expect(r.centroids[0]![f]).toBeCloseTo(mean, 8);
    }
  });

  test('k > n THROWS rather than inventing clusters with no members', () => {
    // There is no partition of n items into more than n non-empty blocks. A
    // silently-clamped k would report a number of clusters the data cannot
    // support, and the reseeding path would fill them with duplicates.
    const { X } = blobs(20, 3, 2, 8, 0.7, 271);
    expect(() => kmeans(X, { ...DEFAULT_KMEANS, k: 21 })).toThrow(/out of range/);
    expect(() => kmeans(X, { ...DEFAULT_KMEANS, k: 21 })).toThrow(/k=21/);
    // k = n is the boundary and IS allowed.
    expect(() => kmeans(X, { ...DEFAULT_KMEANS, k: 20, nInit: 1 })).not.toThrow();
  });

  test('k < 1 THROWS', () => {
    const { X } = blobs(20, 3, 2, 8, 0.7, 271);
    expect(() => kmeans(X, { ...DEFAULT_KMEANS, k: 0 })).toThrow(/out of range/);
    expect(() => kmeans(X, { ...DEFAULT_KMEANS, k: -3 })).toThrow(/out of range/);
  });

  test('empty input THROWS rather than returning an empty partition', () => {
    // An empty result would flow downstream and score ARI = 1 (the source
    // defines the empty case that way), which is a perfect result reported for
    // a run that clustered nothing — the vacuity class, end to end.
    expect(() => kmeans([])).toThrow(/empty input/);
    expect(() => kmeans([], { ...DEFAULT_KMEANS, k: 1 })).toThrow(/kmeans/);
  });
});

// ─── empty-cluster reseeding ────────────────────────────────────────────────

describe('empty-cluster reseeding survives degenerate data', () => {
  test('duplicate-heavy data with a large k does not crash and stays in range', () => {
    // The forcing case for BOTH degenerate paths in the source: `seedPlusPlus`
    // runs out of D^2 mass (every point already coincides with a centre) and
    // the Lloyd update finds clusters with zero members. 20 points at 3
    // distinct locations, k = 10.
    const dup: Float64Array[] = [];
    for (let i = 0; i < 18; i++) dup.push(Float64Array.from([1, 1, 1]));
    dup.push(Float64Array.from([5, 5, 5]));
    dup.push(Float64Array.from([9, 9, 9]));

    const k = 10;
    let r!: ReturnType<typeof kmeans>;
    expect(() => { r = kmeans(dup, { ...DEFAULT_KMEANS, k }); }).not.toThrow();

    expect(r.assignments.length).toBe(dup.length);
    for (const a of r.assignments) {
      expect(Number.isInteger(a)).toBe(true);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(k);
    }
    expect(r.centroids.length).toBe(k);
    expect(Number.isFinite(r.inertia)).toBe(true);

    // OBSERVATION, recorded rather than asserted as a requirement: the number
    // of clusters actually USED here is 3, not the requested 10. There is no
    // partition of 3 distinct locations into 10 non-degenerate blocks, so this
    // is arithmetic and not a defect — but it does mean the source's "reseeding
    // keeps k honest" comment is about avoiding a CRASH, not about guaranteeing
    // that k clusters get populated. The weaker property is what is checked.
    expect(new Set(r.assignments).size).toBeLessThanOrEqual(k);
    expect(new Set(r.assignments).size).toBeGreaterThan(0);
  });

  test('a single repeated point at k > 1 terminates', () => {
    // The extreme of the same path: seedPlusPlus can never find D^2 mass, so
    // the duplicate-centroid branch runs on every iteration of its while loop.
    // If that branch failed to push, this would hang forever rather than fail.
    const same = Array.from({ length: 8 }, () => Float64Array.from([2, 2]));
    const r = kmeans(same, { ...DEFAULT_KMEANS, k: 4, nInit: 2 });
    expect(r.assignments.length).toBe(8);
    expect(r.inertia).toBeCloseTo(0, 12);
    expect(r.centroids.length).toBe(4);
  });
});

// ─── determinism (DST, discipline #4 / manifesto §7) ────────────────────────

describe('DST — the clustering replays from its seed', () => {
  test('same seed, same data => IDENTICAL assignments, centroids and inertia', () => {
    // k-means is initialisation-sensitive by nature, so without a seed two
    // runs of the same study produce two different partitions and two
    // different ARIs. "Approximately the same clustering" is not a result.
    const { X } = blobs(300, 3, 3, 8, 0.7, 4096);
    const a = kmeans(X, { ...DEFAULT_KMEANS, k: 5, seed: 777 });
    const b = kmeans(X, { ...DEFAULT_KMEANS, k: 5, seed: 777 });
    expect(a.assignments).toEqual(b.assignments);
    expect(a.inertia).toBe(b.inertia);
    expect(a.iterations).toBe(b.iterations);
    expect(a.centroids.map((c) => Array.from(c))).toEqual(b.centroids.map((c) => Array.from(c)));
  });

  test('a different seed is still deterministic FOR THAT SEED', () => {
    // The guarantee is per-seed reproducibility. Both seeds must also solve
    // the easy problem, so the seed is a nuisance parameter rather than a
    // hidden knob someone could tune until the answer looked good.
    const { X, y } = blobs(300, 3, 3, 8, 0.7, 4096);
    for (const seed of [11, 22, 33]) {
      const p = kmeans(X, { ...DEFAULT_KMEANS, k: 3, seed });
      const q = kmeans(X, { ...DEFAULT_KMEANS, k: 3, seed });
      expect(p.assignments).toEqual(q.assignments);
      expect(adjustedRandIndex(p.assignments, y)).toBeGreaterThan(0.98);
    }
  });

  test('MUTATION PROBE: the replay test can fail — the seed really reaches the init', () => {
    // A determinism assertion is worthless if the compared object is constant.
    // On structureless data with a large k there is no attractor to converge
    // on, so different seeds land on genuinely different partitions — which is
    // precisely the behaviour an UNSEEDED implementation would show between
    // two runs of the same command, and what makes the equality assertions
    // above load-bearing rather than tautological.
    const U = structurelessCloud(300, 4, 8191);
    const s1 = kmeans(U, { ...DEFAULT_KMEANS, k: 12, seed: 1, nInit: 1 });
    const s2 = kmeans(U, { ...DEFAULT_KMEANS, k: 12, seed: 900001, nInit: 1 });
    expect(s1.assignments).toEqual(kmeans(U, { ...DEFAULT_KMEANS, k: 12, seed: 1, nInit: 1 }).assignments);
    expect(s1.assignments).not.toEqual(s2.assignments);
  });
});

// ─── majorityMap, and the honesty check ─────────────────────────────────────

describe('majorityMap — labelled as the supervised ceiling it is', () => {
  test('names each cluster by its majority true label and scores the naming', () => {
    // Mechanical check first, on a partition that is exactly right.
    const assignments = [0, 0, 0, 1, 1, 1, 2, 2, 2];
    const yTrue = /*    */[2, 2, 2, 0, 0, 0, 1, 1, 1];
    const { map, accuracy } = majorityMap(assignments, yTrue, 3, 3);
    expect(map).toEqual([2, 0, 1]);
    expect(accuracy).toBe(1);
  });

  test('a majority inside a cluster carries the whole cluster', () => {
    // Cluster 0 is 2/3 label 0; cluster 1 is 3/3 label 1. The one minority
    // member of cluster 0 is scored wrong, so accuracy is 5/6.
    const assignments = [0, 0, 0, 1, 1, 1];
    const yTrue = /*    */[0, 0, 1, 1, 1, 1];
    const { map, accuracy } = majorityMap(assignments, yTrue, 2, 2);
    expect(map).toEqual([0, 1]);
    expect(accuracy).toBeCloseTo(5 / 6, 12);
  });

  test('an empty input scores 0, not NaN', () => {
    expect(majorityMap([], [], 3, 3).accuracy).toBe(0);
  });

  test('THE HONESTY CHECK: high majorityMap accuracy on data with NO structure', () => {
    // This is the test the whole file exists for.
    //
    // The data is a single uniform cloud — there are no clusters in it, and no
    // algorithm can find any. The labels are drawn independently of the points,
    // 80/20 imbalanced. So the TRUE answer is "the partition tells you nothing
    // about the labels", and any metric that says otherwise is lying.
    //
    //   - ARI, chance-corrected, says ~0. Correct.
    //   - majorityMap says ~0.8, because an oracle naming every cluster will
    //     name them all with the head class and inherit the base rate for free.
    //
    // Same partition, same labels. One number reports a finding that is not
    // there. That is why kmeans.ts calls majorityMap a ceiling rather than a
    // result, and why the study never presents a cluster as a predicted area.
    const n = 300;
    const U = structurelessCloud(n, 3, 31);
    const labRng = mulberry32(32);
    const yTrue = Array.from({ length: n }, () => (labRng.next() < 0.8 ? 0 : 1));

    const k = 6;
    const r = kmeans(U, { ...DEFAULT_KMEANS, k });

    const ari = adjustedRandIndex(r.assignments, yTrue);
    const { accuracy } = majorityMap(r.assignments, yTrue, k, 2);
    const baseRate = Math.max(
      yTrue.filter((v) => v === 0).length,
      yTrue.filter((v) => v === 1).length,
    ) / n;

    // The honest number knows there is nothing here.
    expect(Math.abs(ari)).toBeLessThan(0.05);
    expect(Math.abs(normalizedMutualInfo(r.assignments, yTrue))).toBeLessThan(0.1);

    // The ceiling looks like a respectable classifier.
    expect(accuracy).toBeGreaterThan(0.75);
    // ...and it is not beating the free rate by anything worth reporting,
    // which is the tell: it is the base rate wearing a model's clothes.
    expect(accuracy).toBeLessThan(baseRate + 0.06);
    expect(baseRate).toBeGreaterThan(0.75);

    // Stated as the comparison a reader would have to make. The gap is the
    // size of the mistake someone would make by quoting the wrong one.
    expect(accuracy - Math.abs(ari)).toBeGreaterThan(0.7);
  });

  test('MUTATION PROBE: majorityMap accuracy rises with k on pure noise; ARI does not', () => {
    // The sharper form of the same failure, and the reason the ceiling cannot
    // be rescued by "well, tune k". Raising k on structureless data lets the
    // oracle name ever-smaller groups, so the supervised ceiling climbs toward
    // 1 — a monotone reward for shredding the data. ARI, being chance
    // corrected, refuses to move.
    const n = 240;
    const U = structurelessCloud(n, 3, 909);
    const labRng = mulberry32(910);
    const yTrue = Array.from({ length: n }, () => (labRng.next() < 0.8 ? 0 : 1));

    const small = kmeans(U, { ...DEFAULT_KMEANS, k: 2 });
    const large = kmeans(U, { ...DEFAULT_KMEANS, k: 60 });

    const accSmall = majorityMap(small.assignments, yTrue, 2, 2).accuracy;
    const accLarge = majorityMap(large.assignments, yTrue, 60, 2).accuracy;
    const ariSmall = adjustedRandIndex(small.assignments, yTrue);
    const ariLarge = adjustedRandIndex(large.assignments, yTrue);

    // The ceiling is bought with k...
    expect(accLarge).toBeGreaterThan(accSmall);
    // ...while the honest metric stays at chance for both.
    expect(Math.abs(ariSmall)).toBeLessThan(0.05);
    expect(Math.abs(ariLarge)).toBeLessThan(0.05);
    expect(Math.abs(ariLarge)).toBeLessThan(accLarge / 4);
  });
});
