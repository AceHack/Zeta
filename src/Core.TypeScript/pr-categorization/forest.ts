/**
 * Random forest classifier.
 *
 * Anchor (Beacon): Leo Breiman, "Random Forests", Machine Learning 45(1):5-32
 * (2001) — bootstrap aggregation (Breiman 1996) plus a random feature subset at
 * every split, which is what decorrelates the trees and is the reason the
 * ensemble beats its members. Trees are CART (Breiman, Friedman, Olshen &
 * Stone, "Classification and Regression Trees", 1984) grown on the Gini
 * impurity.
 *
 * ONE DELIBERATE DEPARTURE FROM BREIMAN, STATED PLAINLY: split thresholds are
 * searched over at most `nBins` quantile bins per feature rather than over
 * every observed value. This is the histogram trick used by LightGBM (Ke et
 * al., NeurIPS 2017); it makes training O(bins) instead of O(n log n) per
 * feature per node and costs a little split precision. It is an approximation
 * of Breiman's forest, not Breiman's forest, and calling it one would be the
 * kind of unchecked-anchor claim the anchor rule forbids.
 *
 * Register: `unmetered` — a standard algorithm, exercised by forest.test.ts on
 * problems with known answers, but its numbers on this corpus are the study's
 * claim rather than this file's.
 */

import { mulberry32, type Rng } from './rng.ts';

export interface ForestOptions {
  readonly nTrees: number;
  readonly maxDepth: number;
  readonly minSamplesLeaf: number;
  /** Features considered per split. Default: round(sqrt(d)), Breiman's suggestion. */
  readonly mtry?: number;
  readonly nBins: number;
  readonly seed: number;
}

export const DEFAULT_FOREST: ForestOptions = {
  nTrees: 60,
  maxDepth: 18,
  minSamplesLeaf: 3,
  nBins: 24,
  seed: 20260827,
};

type Node =
  | { readonly kind: 'leaf'; readonly dist: Float64Array }
  | { readonly kind: 'split'; readonly feature: number; readonly bin: number; readonly left: Node; readonly right: Node };

export interface Forest {
  readonly trees: readonly Node[];
  readonly nClasses: number;
  readonly thresholds: readonly Float64Array[];
  readonly options: ForestOptions;
}

/**
 * Per-feature quantile bin edges. Features with fewer distinct values than
 * `nBins` get exactly their distinct values, so a one-hot column is split
 * exactly rather than approximately.
 */
export function quantileThresholds(
  X: readonly Float64Array[],
  dim: number,
  nBins: number,
): Float64Array[] {
  const out: Float64Array[] = [];
  const col = new Float64Array(X.length);
  for (let f = 0; f < dim; f++) {
    for (let i = 0; i < X.length; i++) col[i] = X[i]![f]!;
    const sorted = Array.from(col).sort((a, b) => a - b);
    const uniq: number[] = [];
    for (let i = 0; i < sorted.length; i++) {
      if (i === 0 || sorted[i] !== sorted[i - 1]) uniq.push(sorted[i]!);
    }
    if (uniq.length <= nBins) {
      // Edges sit BETWEEN distinct values so every value lands in its own bin.
      const edges = new Float64Array(Math.max(0, uniq.length - 1));
      for (let i = 1; i < uniq.length; i++) edges[i - 1] = (uniq[i - 1]! + uniq[i]!) / 2;
      out.push(edges);
    } else {
      const edges = new Float64Array(nBins - 1);
      for (let b = 1; b < nBins; b++) {
        edges[b - 1] = sorted[Math.min(sorted.length - 1, Math.floor((b * sorted.length) / nBins))]!;
      }
      out.push(edges);
    }
  }
  return out;
}

/** Value -> bin index by binary search over the edges. */
function binOf(v: number, edges: Float64Array): number {
  let lo = 0;
  let hi = edges.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (v <= edges[mid]!) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

export function binMatrix(
  X: readonly Float64Array[],
  thresholds: readonly Float64Array[],
): Uint8Array[] {
  return X.map((row) => {
    const out = new Uint8Array(thresholds.length);
    for (let f = 0; f < thresholds.length; f++) out[f] = binOf(row[f]!, thresholds[f]!);
    return out;
  });
}

const giniOf = (counts: Float64Array, total: number): number => {
  if (total <= 0) return 0;
  let s = 0;
  for (let c = 0; c < counts.length; c++) {
    const p = counts[c]! / total;
    s += p * p;
  }
  return 1 - s;
};

function buildTree(
  Xb: readonly Uint8Array[],
  y: readonly number[],
  idx: Int32Array,
  depth: number,
  nClasses: number,
  nFeat: number,
  nBinsMax: number,
  opts: ForestOptions,
  mtry: number,
  rng: Rng,
): Node {
  const dist = new Float64Array(nClasses);
  for (let i = 0; i < idx.length; i++) dist[y[idx[i]!]!]!++;
  const total = idx.length;

  let nonEmpty = 0;
  for (let c = 0; c < nClasses; c++) if (dist[c]! > 0) nonEmpty++;
  if (depth >= opts.maxDepth || total < 2 * opts.minSamplesLeaf || nonEmpty <= 1) {
    for (let c = 0; c < nClasses; c++) dist[c]! /= total;
    return { kind: 'leaf', dist };
  }

  const parentGini = giniOf(dist, total);
  let bestGain = 0;
  let bestFeat = -1;
  let bestBin = -1;

  const hist = new Float64Array(nBinsMax * nClasses);
  const binTot = new Float64Array(nBinsMax);
  const leftC = new Float64Array(nClasses);

  for (let t = 0; t < mtry; t++) {
    const f = rng.int(nFeat);
    hist.fill(0);
    binTot.fill(0);
    for (let i = 0; i < idx.length; i++) {
      const r = idx[i]!;
      const b = Xb[r]![f]!;
      hist[b * nClasses + y[r]!]!++;
      binTot[b]!++;
    }
    leftC.fill(0);
    let leftN = 0;
    // Scan cut points left-to-right, maintaining the left histogram
    // incrementally: the whole point of binning is that this is O(bins).
    for (let b = 0; b < nBinsMax - 1; b++) {
      if (binTot[b] === 0) continue;
      for (let c = 0; c < nClasses; c++) leftC[c]! += hist[b * nClasses + c]!;
      leftN += binTot[b]!;
      const rightN = total - leftN;
      if (leftN < opts.minSamplesLeaf || rightN < opts.minSamplesLeaf) continue;
      let gl = 0;
      let gr = 0;
      for (let c = 0; c < nClasses; c++) {
        const pl = leftC[c]! / leftN;
        gl += pl * pl;
        const pr = (dist[c]! - leftC[c]!) / rightN;
        gr += pr * pr;
      }
      const gain = parentGini - ((leftN / total) * (1 - gl) + (rightN / total) * (1 - gr));
      if (gain > bestGain) {
        bestGain = gain;
        bestFeat = f;
        bestBin = b;
      }
    }
  }

  if (bestFeat < 0) {
    for (let c = 0; c < nClasses; c++) dist[c]! /= total;
    return { kind: 'leaf', dist };
  }

  const leftIdx: number[] = [];
  const rightIdx: number[] = [];
  for (let i = 0; i < idx.length; i++) {
    (Xb[idx[i]!]![bestFeat]! <= bestBin ? leftIdx : rightIdx).push(idx[i]!);
  }
  return {
    kind: 'split',
    feature: bestFeat,
    bin: bestBin,
    left: buildTree(Xb, y, Int32Array.from(leftIdx), depth + 1, nClasses, nFeat, nBinsMax, opts, mtry, rng),
    right: buildTree(Xb, y, Int32Array.from(rightIdx), depth + 1, nClasses, nFeat, nBinsMax, opts, mtry, rng),
  };
}

export function trainForest(
  X: readonly Float64Array[],
  y: readonly number[],
  nClasses: number,
  opts: ForestOptions = DEFAULT_FOREST,
): Forest {
  if (X.length === 0) throw new Error('trainForest: empty training set');
  const dim = X[0]!.length;
  const thresholds = quantileThresholds(X, dim, opts.nBins);
  const Xb = binMatrix(X, thresholds);
  const nBinsMax = Math.max(2, ...thresholds.map((t) => t.length + 1));
  const mtry = opts.mtry ?? Math.max(1, Math.round(Math.sqrt(dim)));
  const trees: Node[] = [];
  for (let t = 0; t < opts.nTrees; t++) {
    // Per-tree seed derived from the run seed => the whole forest replays.
    const rng = mulberry32(opts.seed + t * 7919);
    const boot = new Int32Array(X.length);
    for (let i = 0; i < X.length; i++) boot[i] = rng.int(X.length);
    trees.push(buildTree(Xb, y, boot, 0, nClasses, dim, nBinsMax, opts, mtry, rng));
  }
  return { trees, nClasses, thresholds, options: opts };
}

/** Mean of the per-tree leaf distributions — Breiman's probability estimate. */
export function forestPredictProba(f: Forest, x: Float64Array): Float64Array {
  const xb = new Uint8Array(f.thresholds.length);
  for (let i = 0; i < f.thresholds.length; i++) xb[i] = binOf(x[i]!, f.thresholds[i]!);
  const out = new Float64Array(f.nClasses);
  for (const tree of f.trees) {
    let node = tree;
    while (node.kind === 'split') node = xb[node.feature]! <= node.bin ? node.left : node.right;
    for (let c = 0; c < f.nClasses; c++) out[c]! += node.dist[c]!;
  }
  for (let c = 0; c < f.nClasses; c++) out[c]! /= f.trees.length;
  return out;
}

export function argmax(v: Float64Array): number {
  let bi = 0;
  for (let i = 1; i < v.length; i++) if (v[i]! > v[bi]!) bi = i;
  return bi;
}

export function forestPredict(f: Forest, X: readonly Float64Array[]): number[] {
  return X.map((x) => argmax(forestPredictProba(f, x)));
}
