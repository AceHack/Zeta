/**
 * k-means clustering — UNSUPERVISED, and therefore NOT A CLASSIFIER.
 *
 * Anchors (Beacon):
 *   - Stuart Lloyd, "Least squares quantization in PCM", Bell Labs tech memo
 *     1957, published IEEE Trans. Inf. Theory 28(2):129-137 (1982) — the
 *     assign/update iteration this file implements.
 *   - J. MacQueen, "Some methods for classification and analysis of
 *     multivariate observations", 5th Berkeley Symposium (1967) — the name and
 *     the online variant.
 *   - Arthur & Vassilvitskii, "k-means++: the advantages of careful seeding",
 *     SODA 2007 — the D^2 seeding used below, which is what keeps the result
 *     from depending on a lucky initial draw.
 *
 * WHAT THIS CAN AND CANNOT TELL YOU. k-means returns a partition; the area
 * taxonomy is a labelling. A partition is not a labelling, and no amount of
 * agreement makes it one — the clusters have no names, and the fact that
 * `k = |areas|` produces `k` groups is a coincidence of counts, not an
 * identification (see `.claude/rules/numerology-vs-number-theory.md`). So this
 * module reports ONLY chance-corrected agreement (ARI / NMI) against the
 * measured areas, and the study never presents a cluster as a predicted area.
 *
 * To speak of "accuracy" at all one must first map clusters to labels, which
 * imports supervision through the back door; `majorityMap` below does exactly
 * that and is labelled as the cheat it is.
 *
 * Register: `unmetered`.
 */

import { mulberry32, type Rng } from './rng.ts';

export interface KMeansOptions {
  readonly k: number;
  readonly maxIter: number;
  readonly seed: number;
  readonly tol: number;
  /** Restarts; the lowest-inertia run wins, as is standard. */
  readonly nInit: number;
}

export const DEFAULT_KMEANS: KMeansOptions = {
  k: 16,
  maxIter: 60,
  seed: 20260827,
  tol: 1e-6,
  nInit: 4,
};

export interface KMeansResult {
  readonly assignments: number[];
  readonly centroids: Float64Array[];
  readonly inertia: number;
  readonly iterations: number;
  readonly options: KMeansOptions;
}

const sqDist = (a: Float64Array, b: Float64Array): number => {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i]! - b[i]!;
    s += d * d;
  }
  return s;
};

/** k-means++ D^2 seeding (Arthur & Vassilvitskii 2007). */
function seedPlusPlus(X: readonly Float64Array[], k: number, rng: Rng): Float64Array[] {
  const centroids: Float64Array[] = [Float64Array.from(X[rng.int(X.length)]!)];
  const d2 = new Float64Array(X.length).fill(Infinity);
  while (centroids.length < k) {
    const last = centroids[centroids.length - 1]!;
    let total = 0;
    for (let i = 0; i < X.length; i++) {
      const d = sqDist(X[i]!, last);
      if (d < d2[i]!) d2[i] = d;
      total += d2[i]!;
    }
    if (total <= 0) {
      // All points already coincide with a centroid: no D^2 mass left to
      // sample. Duplicating an existing centre keeps k stable and leaves the
      // empty cluster to be handled by the reseed below.
      centroids.push(Float64Array.from(centroids[rng.int(centroids.length)]!));
      continue;
    }
    let target = rng.next() * total;
    let pick = X.length - 1;
    for (let i = 0; i < X.length; i++) {
      target -= d2[i]!;
      if (target <= 0) {
        pick = i;
        break;
      }
    }
    centroids.push(Float64Array.from(X[pick]!));
  }
  return centroids;
}

function lloyd(X: readonly Float64Array[], opts: KMeansOptions, rng: Rng): KMeansResult {
  const n = X.length;
  const dim = X[0]!.length;
  let centroids = seedPlusPlus(X, opts.k, rng);
  const assign = new Array<number>(n).fill(-1);
  let inertia = Infinity;
  let iter = 0;

  for (; iter < opts.maxIter; iter++) {
    let moved = 0;
    let newInertia = 0;
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < opts.k; c++) {
        const d = sqDist(X[i]!, centroids[c]!);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (assign[i] !== best) moved++;
      assign[i] = best;
      newInertia += bestD;
    }
    const sums = Array.from({ length: opts.k }, () => new Float64Array(dim));
    const counts = new Int32Array(opts.k);
    for (let i = 0; i < n; i++) {
      const c = assign[i]!;
      counts[c]!++;
      const s = sums[c]!;
      for (let f = 0; f < dim; f++) s[f]! += X[i]![f]!;
    }
    const next: Float64Array[] = [];
    for (let c = 0; c < opts.k; c++) {
      if (counts[c]! === 0) {
        // An empty cluster has no mean. Reseeding it at a random point keeps k
        // honest; silently dropping it would report k clusters while fitting
        // fewer, which is the vacuity class in a metric.
        next.push(Float64Array.from(X[rng.int(n)]!));
      } else {
        const s = sums[c]!;
        for (let f = 0; f < dim; f++) s[f]! /= counts[c]!;
        next.push(s);
      }
    }
    const shift = centroids.reduce((m, c, i) => Math.max(m, sqDist(c, next[i]!)), 0);
    centroids = next;
    const improved = inertia - newInertia;
    inertia = newInertia;
    if (moved === 0 || (shift < opts.tol && Math.abs(improved) < opts.tol)) {
      iter++;
      break;
    }
  }
  return { assignments: assign, centroids, inertia, iterations: iter, options: opts };
}

export function kmeans(X: readonly Float64Array[], opts: KMeansOptions = DEFAULT_KMEANS): KMeansResult {
  if (X.length === 0) throw new Error('kmeans: empty input');
  if (opts.k < 1 || opts.k > X.length) throw new Error(`kmeans: k=${opts.k} out of range for n=${X.length}`);
  let best: KMeansResult | null = null;
  for (let r = 0; r < opts.nInit; r++) {
    const res = lloyd(X, opts, mulberry32(opts.seed + r * 104729));
    if (best === null || res.inertia < best.inertia) best = res;
  }
  return best!;
}

/**
 * Label each cluster by the majority TRUE label inside it, then score.
 *
 * THIS IS SUPERVISION, and the resulting number is not a clustering result: it
 * is an upper bound on what the partition could achieve if an oracle named
 * every cluster for free. Reported only to make that ceiling explicit; ARI is
 * the honest number.
 */
export function majorityMap(
  assignments: readonly number[],
  yTrue: readonly number[],
  k: number,
  nClasses: number,
): { map: number[]; accuracy: number } {
  const tally = Array.from({ length: k }, () => new Float64Array(nClasses));
  for (let i = 0; i < assignments.length; i++) tally[assignments[i]!]![yTrue[i]!]!++;
  const map = tally.map((t) => {
    let bi = 0;
    for (let c = 1; c < nClasses; c++) if (t[c]! > t[bi]!) bi = c;
    return bi;
  });
  let correct = 0;
  for (let i = 0; i < assignments.length; i++) if (map[assignments[i]!] === yTrue[i]) correct++;
  return { map, accuracy: assignments.length === 0 ? 0 : correct / assignments.length };
}
