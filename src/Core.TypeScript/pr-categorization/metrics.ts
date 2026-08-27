/**
 * Evaluation metrics.
 *
 * Anchors (Beacon):
 *   - Adjusted Rand Index — Hubert & Arabie, "Comparing partitions",
 *     Journal of Classification 2:193-218 (1985). The chance-corrected form of
 *     Rand (1971). Chance correction is the whole reason it is used here: a raw
 *     agreement score between a clustering and a labelling rises with the
 *     number of clusters even when the clustering is arbitrary, which is
 *     precisely the coincidence-of-counts failure the numerology rule warns
 *     about. ARI of an arbitrary partition is ~0 by construction.
 *   - Macro-F1 — reported alongside accuracy because this corpus is heavily
 *     imbalanced (largest area ~20%, smallest <1%). Accuracy alone lets a model
 *     look competent by serving the head classes and never predicting the tail.
 *
 * Register: `unmetered` — standard formulas, tested against hand-worked cases
 * in metrics.test.ts, but nothing here is a claim about the repo.
 */

export interface ClassificationReport {
  readonly n: number;
  readonly accuracy: number;
  readonly macroF1: number;
  readonly perClass: ReadonlyArray<{
    readonly label: string;
    readonly support: number;
    readonly precision: number;
    readonly recall: number;
    readonly f1: number;
  }>;
  /** `confusion[trueLabel][predLabel]` — counts, sparse. */
  readonly confusion: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

export function classificationReport(
  yTrue: readonly string[],
  yPred: readonly string[],
  labels: readonly string[],
): ClassificationReport {
  if (yTrue.length !== yPred.length) {
    throw new Error(`length mismatch: ${yTrue.length} vs ${yPred.length}`);
  }
  const tp: Record<string, number> = {};
  const fp: Record<string, number> = {};
  const fn: Record<string, number> = {};
  const support: Record<string, number> = {};
  const confusion: Record<string, Record<string, number>> = {};
  for (const l of labels) {
    tp[l] = 0; fp[l] = 0; fn[l] = 0; support[l] = 0;
    confusion[l] = {};
  }
  let correct = 0;
  for (let i = 0; i < yTrue.length; i++) {
    const t = yTrue[i]!;
    const p = yPred[i]!;
    support[t] = (support[t] ?? 0) + 1;
    confusion[t] ??= {};
    confusion[t]![p] = (confusion[t]![p] ?? 0) + 1;
    if (t === p) {
      correct++;
      tp[t] = (tp[t] ?? 0) + 1;
    } else {
      fn[t] = (fn[t] ?? 0) + 1;
      fp[p] = (fp[p] ?? 0) + 1;
    }
  }
  const perClass = labels.map((l) => {
    const precDen = (tp[l] ?? 0) + (fp[l] ?? 0);
    const recDen = (tp[l] ?? 0) + (fn[l] ?? 0);
    const precision = precDen === 0 ? 0 : (tp[l] ?? 0) / precDen;
    const recall = recDen === 0 ? 0 : (tp[l] ?? 0) / recDen;
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    return { label: l, support: support[l] ?? 0, precision, recall, f1 };
  });
  // Macro-F1 averages over classes that actually OCCUR. Averaging over absent
  // classes would score a model on labels no PR carries and silently drag the
  // number toward zero for a reason unrelated to the model.
  const present = perClass.filter((c) => c.support > 0);
  const macroF1 = present.length === 0
    ? 0
    : present.reduce((s, c) => s + c.f1, 0) / present.length;
  return {
    n: yTrue.length,
    accuracy: yTrue.length === 0 ? 0 : correct / yTrue.length,
    macroF1,
    perClass,
    confusion,
  };
}

const comb2 = (n: number): number => (n * (n - 1)) / 2;

/**
 * Adjusted Rand Index between two partitions given as parallel label arrays.
 * Returns 1 for identical partitions, ~0 for independent ones, and can go
 * negative when agreement is worse than chance.
 */
export function adjustedRandIndex(a: readonly (string | number)[], b: readonly (string | number)[]): number {
  if (a.length !== b.length) throw new Error(`length mismatch: ${a.length} vs ${b.length}`);
  const n = a.length;
  if (n === 0) return 1;
  const cont = new Map<string, number>();
  const ra = new Map<string | number, number>();
  const rb = new Map<string | number, number>();
  // NUL joins the contingency key because no label can contain one, so two
  // distinct pairs can never collide into a single cell — a space separator
  // would, the moment any label contained a space. It is written as the
  // ESCAPE `\u0000`, never as a raw byte: a literal NUL in a `.ts` file makes
  // git classify the SOURCE as binary, so `git diff` reports "Binary files
  // differ" instead of showing the change. This file was briefly in exactly
  // that state; the escape is what keeps it reviewable.
  for (let i = 0; i < n; i++) {
    const k = `${String(a[i])}\u0000${String(b[i])}`;
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
  const total = comb2(n);
  const expected = (sumA * sumB) / total;
  const max = (sumA + sumB) / 2;
  const den = max - expected;
  // Both partitions trivial (all-one-cluster): agreement is perfect and the
  // adjustment is 0/0. Defining it as 1 matches the identical-partition case.
  if (den === 0) return 1;
  return (sumIj - expected) / den;
}

/** Normalised mutual information, reported beside ARI as a second opinion. */
export function normalizedMutualInfo(
  a: readonly (string | number)[],
  b: readonly (string | number)[],
): number {
  const n = a.length;
  if (n === 0) return 1;
  const joint = new Map<string, number>();
  const pa = new Map<string | number, number>();
  const pb = new Map<string | number, number>();
  for (let i = 0; i < n; i++) {
    joint.set(`${String(a[i])}\u0000${String(b[i])}`, (joint.get(`${String(a[i])}\u0000${String(b[i])}`) ?? 0) + 1);
    pa.set(a[i]!, (pa.get(a[i]!) ?? 0) + 1);
    pb.set(b[i]!, (pb.get(b[i]!) ?? 0) + 1);
  }
  const ent = (m: Map<string | number, number>): number => {
    let h = 0;
    for (const v of m.values()) {
      const p = v / n;
      if (p > 0) h -= p * Math.log(p);
    }
    return h;
  };
  const ha = ent(pa);
  const hb = ent(pb);
  let mi = 0;
  for (const [k, v] of joint) {
    const [ka, kb] = k.split('\u0000');
    const pij = v / n;
    const pai = (pa.get(ka!) ?? pa.get(Number(ka)) ?? 0) / n;
    const pbj = (pb.get(kb!) ?? pb.get(Number(kb)) ?? 0) / n;
    if (pij > 0 && pai > 0 && pbj > 0) mi += pij * Math.log(pij / (pai * pbj));
  }
  const den = Math.sqrt(ha * hb);
  return den === 0 ? 1 : mi / den;
}

/**
 * McNemar's test on the paired disagreements between two classifiers.
 *
 * Anchors (Beacon):
 *   - Quinn McNemar, "Note on the sampling error of the difference between
 *     correlated proportions or percentages", Psychometrika 12(2):153-157 (1947).
 *   - Thomas Dietterich, "Approximate statistical tests for comparing
 *     supervised classification learning algorithms", Neural Computation
 *     10(7):1895-1923 (1998) — which recommends this exact test for comparing
 *     two classifiers evaluated on a single shared test set.
 *
 * WHY THIS AND NOT OVERLAPPING CONFIDENCE INTERVALS. Two accuracies measured on
 * the SAME test set are not independent samples: the models agree on most
 * items, and only the items where they disagree carry information about which
 * is better. Comparing marginal Wilson intervals discards that pairing and is
 * badly underpowered — it can call a real difference inconclusive because both
 * intervals are wide, when every single disagreement went one way. `b` and `c`
 * are the only cells that carry the comparison.
 *
 * Exact binomial rather than the chi-square approximation, because the
 * discordant count is sometimes small and the approximation is
 * anti-conservative there.
 */
export interface McNemarResult {
  /** A right, B wrong. */
  readonly b: number;
  /** A wrong, B right. */
  readonly c: number;
  readonly pValue: number;
  readonly favours: 'a' | 'b' | 'neither';
}

export function mcnemar(
  yTrue: readonly string[],
  predA: readonly string[],
  predB: readonly string[],
): McNemarResult {
  let b = 0;
  let c = 0;
  for (let i = 0; i < yTrue.length; i++) {
    const aOk = predA[i] === yTrue[i];
    const bOk = predB[i] === yTrue[i];
    if (aOk && !bOk) b++;
    else if (!aOk && bOk) c++;
  }
  const n = b + c;
  if (n === 0) return { b, c, pValue: 1, favours: 'neither' };
  // Exact two-sided binomial test against p = 0.5.
  const k = Math.min(b, c);
  let cum = 0;
  let logTerm = -n * Math.LN2; // log P(X = 0) = -n log 2
  for (let i = 0; i <= k; i++) {
    if (i > 0) logTerm += Math.log((n - i + 1) / i);
    cum += Math.exp(logTerm);
  }
  const pValue = Math.min(1, 2 * cum);
  return { b, c, pValue, favours: pValue >= 0.05 ? 'neither' : b > c ? 'a' : 'b' };
}

/**
 * Wilson score interval for a binomial proportion (Wilson 1927).
 *
 * Used instead of the normal approximation because several per-class cells
 * here have small support, where the normal interval is known to misbehave
 * (it can run past 0 or 1). A delta between two models that sits inside these
 * intervals is not a result, and the study says so rather than ranking on the
 * point estimate.
 */
export function wilsonInterval(successes: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 0];
  const p = successes / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const s = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - s) / d), Math.min(1, (c + s) / d)];
}
