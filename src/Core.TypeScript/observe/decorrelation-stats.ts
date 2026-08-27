#!/usr/bin/env bun
/**
 * decorrelation-stats.ts — the honest statistics layer for the decorrelation program.
 *
 * This module exists because the first pass reported φ as if it lived on [−1,1] with 0
 * meaning "independent". It does not. When two binary variables have unequal marginals,
 * φ has a hard ceiling φ_max < 1 that is a pure function of the marginals — it says
 * NOTHING about the association. Reporting φ=0.112 as "nearly independent" when φ_max
 * for those marginals is 0.344 is reading 32% of the ceiling as if it were 11% of 100%.
 *
 * Everything here is pure arithmetic over a 2×2 contingency table (a,b,c,d):
 *
 *        B correct   B wrong
 *   A correct   a         b
 *   A wrong     c         d
 *
 * No model is needed to recompute any number. That is the point: raw counts in, honest
 * statistics out, so a reviewer can rerun the math on the committed generations.
 *
 * Registers (per numerology-vs-number-theory rule): every reported quantity is labelled
 * so a coincidence never silently becomes a belief.
 */

// ═══ Contingency table ══════════════════════════════════════════════════════════

export interface Table2x2 {
  /** A correct AND B correct. */
  readonly a: number;
  /** A correct AND B wrong. */
  readonly b: number;
  /** A wrong AND B correct. */
  readonly c: number;
  /** A wrong AND B wrong. */
  readonly d: number;
}

export function tableFromTrials(
  trials: readonly { aCorrect: boolean; bCorrect: boolean }[],
): Table2x2 {
  let a = 0, b = 0, c = 0, d = 0;
  for (const t of trials) {
    if (t.aCorrect && t.bCorrect) a++;
    else if (t.aCorrect && !t.bCorrect) b++;
    else if (!t.aCorrect && t.bCorrect) c++;
    else d++;
  }
  return { a, b, c, d };
}

export function tableTotal(t: Table2x2): number {
  return t.a + t.b + t.c + t.d;
}

// ═══ φ and its ceiling ══════════════════════════════════════════════════════════

/**
 * The phi coefficient (Pearson correlation for two binary variables).
 * Range depends on the marginals — see phiMax. Returns 0 for a degenerate table.
 */
export function phi(t: Table2x2): number {
  const { a, b, c, d } = t;
  const denom = Math.sqrt((a + b) * (c + d) * (a + c) * (b + d));
  if (denom === 0) return 0;
  return (a * d - b * c) / denom;
}

/**
 * φ_max — the maximum |φ| attainable GIVEN the marginals of this table.
 *
 * φ cannot reach 1 unless both variables have the same marginal split. With
 * p1 = P(A correct) and p2 = P(B correct), and (WLOG) p1 ≥ p2, the ceiling is:
 *
 *   φ_max = sqrt( (p2 (1 - p1)) / (p1 (1 - p2)) )   when p1 ≥ p2
 *
 * This is the value φ takes when the two sets are maximally nested (every B-correct
 * item is also A-correct). Reporting φ/φ_max is the honest "how correlated, on the
 * scale that is actually reachable" number.
 *
 * Ref: standard result on the marginal-dependence of the phi coefficient
 * (Guilford; Cureton). Anchored, not asserted.
 */
export function phiMax(t: Table2x2): number {
  const n = tableTotal(t);
  if (n === 0) return 0;
  const p1 = (t.a + t.b) / n; // P(A correct)
  const p2 = (t.a + t.c) / n; // P(B correct)
  const hi = Math.max(p1, p2);
  const lo = Math.min(p1, p2);
  // If either marginal is degenerate (0 or 1), φ_max is 0 (no variance to correlate).
  if (hi >= 1 || lo <= 0) return 0;
  return Math.sqrt((lo * (1 - hi)) / (hi * (1 - lo)));
}

/**
 * φ as a fraction of its own ceiling. This is the number to read as "how much of the
 * attainable association is present". 1.0 = maximally associated given marginals;
 * 0.0 = genuinely independent. Returns 0 when φ_max is 0 (undefined ceiling).
 */
export function phiRatio(t: Table2x2): number {
  const pm = phiMax(t);
  if (pm === 0) return 0;
  return phi(t) / pm;
}

// ═══ Marginal-free association ══════════════════════════════════════════════════

/**
 * Yule's Q — a marginal-free measure of association on [−1, 1].
 *
 * Q = (ad − bc) / (ad + bc)
 *
 * Unlike φ, Q reaches ±1 whenever ANY cell is 0, independent of the marginals. It
 * answers "is the association complete?" rather than "how strong on a marginal-bound
 * scale?". Both are reported because they fail differently: φ_ratio is sensitive to
 * cell sizes, Q saturates on a single empty cell. Disagreement between them is itself
 * information.
 *
 * Ref: Yule (1900). Anchored.
 */
export function yulesQ(t: Table2x2): number {
  const { a, b, c, d } = t;
  const denom = a * d + b * c;
  if (denom === 0) return 0;
  return (a * d - b * c) / denom;
}

/**
 * Cohen's κ — agreement corrected for chance. Measures whether A and B agree on
 * correct/wrong classification more than chance predicts, accounting for marginals.
 */
export function cohensKappa(t: Table2x2): number {
  const n = tableTotal(t);
  if (n === 0) return 0;
  const po = (t.a + t.d) / n; // observed agreement
  const pYesA = (t.a + t.b) / n, pYesB = (t.a + t.c) / n;
  const pe = pYesA * pYesB + (1 - pYesA) * (1 - pYesB); // chance agreement
  if (pe >= 1) return 0;
  return (po - pe) / (1 - pe);
}

// ═══ Confidence intervals ═══════════════════════════════════════════════════════

export interface Interval {
  readonly point: number;
  readonly lo: number;
  readonly hi: number;
}

/**
 * Wilson score interval for a binomial proportion. Preferred over the normal
 * approximation because it behaves at the boundaries (p near 0 or 1) and for small N —
 * exactly the regime where "100% on N=3" is meaningless. z=1.96 for 95%.
 */
export function wilsonInterval(successes: number, n: number, z = 1.96): Interval {
  if (n === 0) return { point: 0, lo: 0, hi: 1 };
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / denom;
  return { point: p, lo: Math.max(0, center - half), hi: Math.min(1, center + half) };
}

/**
 * 95% CI for the DIFFERENCE of two independent proportions (Wald with continuity is
 * avoided; this is the standard normal-approx on the difference, adequate once each
 * arm's N is past the power threshold — see requiredNForDifference).
 */
export function proportionDiffInterval(
  s1: number, n1: number, s2: number, n2: number, z = 1.96,
): Interval {
  if (n1 === 0 || n2 === 0) return { point: 0, lo: -1, hi: 1 };
  const p1 = s1 / n1, p2 = s2 / n2;
  const diff = p1 - p2;
  const se = Math.sqrt((p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2);
  return { point: diff, lo: diff - z * se, hi: diff + z * se };
}

// ═══ McNemar (paired) ══════════════════════════════════════════════════════════

export interface McNemarResult {
  /** Discordant pairs: A correct & B wrong (b) and A wrong & B correct (c). */
  readonly b: number;
  readonly c: number;
  /** The paired accuracy difference p(A) − p(B) = (b − c) / n. */
  readonly accuracyDiff: number;
  /** 95% CI on the paired difference of proportions (b−c)/n, discordant-pair based. */
  readonly diffLo: number;
  readonly diffHi: number;
  /** Continuity-corrected McNemar chi-square on the discordant pairs. */
  readonly chiSquare: number;
  /** Whether the CI on the difference excludes zero (a resolved directional effect). */
  readonly resolved: boolean;
  /** Whether the discordant split is symmetric (b≈c) — the "trades equal" falsifier. */
  readonly symmetric: boolean;
}

/**
 * McNemar's test for two paired binary classifiers over the SAME items. This is the
 * correct analysis when both configs answer every item (canonical vs clause-swap on the
 * same scenarios): it uses ONLY the discordant pairs (b, c) and removes the between-item
 * variance an unpaired two-proportion interval carries.
 *
 * The 95% CI on the paired difference uses the standard error for (b−c)/n derived from the
 * discordant counts: SE = sqrt(b + c − (b−c)²/n) / n (the exact paired-proportion SE).
 *
 * Ref: McNemar (1947); Fleiss for the paired-proportion CI. Anchored.
 */
export function mcNemar(
  trials: readonly { aCorrect: boolean; bCorrect: boolean }[], z = 1.96,
): McNemarResult {
  const t = tableFromTrials(trials);
  const n = tableTotal(t);
  const b = t.b, c = t.c;
  const accuracyDiff = n > 0 ? (b - c) / n : 0;
  // Paired SE for the difference of correlated proportions.
  const se = n > 0 ? Math.sqrt(Math.max(0, b + c - ((b - c) * (b - c)) / n)) / n : 0;
  const diffLo = accuracyDiff - z * se;
  const diffHi = accuracyDiff + z * se;
  // Continuity-corrected McNemar statistic.
  const chiSquare = (b + c) > 0 ? ((Math.abs(b - c) - 1) ** 2) / (b + c) : 0;
  const resolved = diffLo > 0 || diffHi < 0;
  // Symmetric when neither discordant cell dominates (the b≈c "trades equal" falsifier):
  // the CI on the difference straddles zero AND the counts are close.
  const symmetric = !resolved;
  return { b, c, accuracyDiff, diffLo, diffHi, chiSquare, resolved, symmetric };
}

// ═══ Power ══════════════════════════════════════════════════════════════════════

/**
 * Approximate N per arm needed to detect a difference `delta` between two proportions
 * at the given power (default 80%) and significance (default 95% two-sided).
 *
 *   N ≈ (z_α/2 + z_β)² · (p1(1−p1) + p2(1−p2)) / delta²
 *
 * The headline use: N=100 cannot resolve a 2-item (0.02) difference. Plugging p≈0.5,
 * delta=0.02 gives N in the tens of thousands — which is why the earlier "gain of 2
 * items" was noise, not signal.
 */
export function requiredNForDifference(
  p1: number, p2: number, power = 0.8,
): number {
  const delta = Math.abs(p1 - p2);
  if (delta === 0) return Infinity;
  const zAlpha = 1.959963985; // two-sided 95% (alpha=0.05, the only supported level)
  const zBeta = power >= 0.8 ? 0.841621234 : 0.674489750; // 80% or 75% fallback
  const variance = p1 * (1 - p1) + p2 * (1 - p2);
  return Math.ceil(((zAlpha + zBeta) ** 2 * variance) / (delta * delta));
}

// ═══ Leak detection (W12/W13) — a perfect classifier is a defect signal ════════

/**
 * W12 — the leak falsifier. A prompt's INSTRUCTION region must NOT name the correct
 * answer or state a rule that names it. If it does, a "verification" or a "search" is a
 * model reading back information it was handed, not a cognitive act. Returns the offending
 * substring, or null if clean.
 *
 * CRITICAL scoping (learned the hard way): the correct option legitimately appears in a
 * PRODUCER's options menu — that is the choice set, not a leak. The leak is the answer
 * named in the INSTRUCTION/RULES text, outside the choice set. So this checks a caller-
 * supplied `instructionRegion`, NOT the whole prompt. The caller passes the instruction/
 * rules portion with the options block excluded. Passing the whole prompt (options
 * included) would false-positive on every producer, which is why the earlier whole-prompt
 * version fired on the canonical producer.
 *
 * This is the same class of guard as `assertNoOptionContamination` (which stops a text arm
 * from moving buttons) — pointed at a different axis: it stops the instruction from
 * carrying the answer key.
 *
 * THE NARROWING SEQUENCE, stated so the fix is not mistaken for coverage (Otto's W12
 * follow-up): the first version checked the WHOLE prompt, fired on the canonical producer
 * (the options menu legitimately contains the correct option), was then narrowed to the
 * instruction region, and the arm went green. That sequence — narrow, then green — is
 * exactly how a guard gets quietly defeated, so the defense is the control test: this
 * function is proven RED on the real leaky RULES region AND GREEN on a producer menu
 * (see the tests). The narrowing is only trustworthy because the RED-on-real control still
 * fails.
 *
 * WHAT THE NARROWED DETECTOR CAN NO LONGER SEE (the blind spot, named): it only catches a
 * VERBATIM occurrence of the correct option STRING inside the instruction region. It does
 * NOT catch:
 *   - a paraphrase or synonym of the answer ("reply to the operator" vs "respond_to_operator"),
 *   - a positional tell ("the correct action is usually near the top"),
 *   - a rule that uniquely determines the answer without naming it ("pick the only
 *     communication action"), or
 *   - leakage in the STATE/context text rather than the instruction.
 * It is a substring tripwire for the one leak that actually bit, not a proof of no leak. A
 * clean result means "the obvious answer-key leak is absent," never "this comparison is
 * information-fair." Fairness still requires reading both prompts.
 */
export function detectAnswerLeak(
  instructionRegion: string,
  correctOptionText: string,
): { leaked: true; via: string } | { leaked: false } {
  const needle = correctOptionText.trim().toLowerCase();
  const hay = instructionRegion.toLowerCase();
  if (needle.length >= 4 && hay.includes(needle)) {
    return { leaked: true, via: `instruction/rules names the correct option "${correctOptionText}"` };
  }
  return { leaked: false };
}

/**
 * W13 — treat a perfect (or empty) classifier as SUSPECT, not a celebration. A 100% or 0%
 * rate on a nontrivial sample is far more often a leak, a degenerate always-yes/always-no
 * model, or a mislabelled set than a genuine perfect discriminator. Returns a warning
 * string when a rate is suspiciously extreme, else null.
 */
export function suspectExtremeRate(
  label: string, successes: number, n: number, minN = 20,
): string | null {
  if (n < minN) return null;
  if (successes === n) return `SUSPECT: ${label} is 100% (${n}/${n}) — treat as a leak/degenerate until proven otherwise`;
  if (successes === 0) return `SUSPECT: ${label} is 0% (0/${n}) — treat as degenerate (e.g. always-no) until proven otherwise`;
  return null;
}

// ═══ Mann–Whitney U (does a signal separate two groups?) ═══════════════════════

export interface MannWhitneyResult {
  readonly u: number;
  readonly n1: number;
  readonly n2: number;
  /** Normal-approximation z (tie-corrected), for the two-sided test. */
  readonly z: number;
  /** Rank-biserial correlation = effect size in [−1, 1]. */
  readonly rankBiserial: number;
  /** Whether the two-sided test rejects at α=0.05 (|z| > 1.96). */
  readonly rejects: boolean;
}

/**
 * Mann–Whitney U (Wilcoxon rank-sum), normal approximation with tie correction.
 * Tests whether two independent samples come from distributions with different location —
 * here, whether a signal (confidence, length, …) DIFFERS between the items config B wins
 * and the items config A wins. If it does not, no selector on that signal can separate
 * them, and the headroom is unaddressable by that signal.
 *
 * Ref: Mann & Whitney (1947). Anchored. Normal approx is adequate for n ≥ ~20 per group.
 */
export function mannWhitneyU(
  group1: readonly number[], group2: readonly number[],
): MannWhitneyResult {
  const n1 = group1.length, n2 = group2.length;
  if (n1 === 0 || n2 === 0) return { u: 0, n1, n2, z: 0, rankBiserial: 0, rejects: false };
  // Pool and rank (average ranks for ties).
  const pooled = [...group1.map((v) => ({ v, g: 1 })), ...group2.map((v) => ({ v, g: 2 }))]
    .sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(pooled.length);
  let i = 0;
  const tieGroups: number[] = [];
  while (i < pooled.length) {
    let j = i;
    while (j < pooled.length && pooled[j]!.v === pooled[i]!.v) j++;
    const avgRank = (i + 1 + j) / 2; // average of ranks i+1..j (1-based)
    for (let k = i; k < j; k++) ranks[k] = avgRank;
    if (j - i > 1) tieGroups.push(j - i);
    i = j;
  }
  let r1 = 0;
  for (let k = 0; k < pooled.length; k++) if (pooled[k]!.g === 1) r1 += ranks[k]!;
  const u1 = r1 - (n1 * (n1 + 1)) / 2;
  const u = Math.min(u1, n1 * n2 - u1);
  const mu = (n1 * n2) / 2;
  const N = n1 + n2;
  const tieTerm = tieGroups.reduce((s, t) => s + (t ** 3 - t), 0);
  const sigma = Math.sqrt((n1 * n2 / 12) * ((N + 1) - tieTerm / (N * (N - 1))));
  const z = sigma > 0 ? (u1 - mu) / sigma : 0;
  const rankBiserial = 1 - (2 * u) / (n1 * n2);
  return { u, n1, n2, z, rankBiserial, rejects: Math.abs(z) > 1.96 };
}

// ═══ Out-of-sample threshold selection (guards against in-sample optimism) ═════

export interface ThresholdItem {
  /** The signal value the selector thresholds on (e.g. confB − confA). */
  readonly signal: number;
  /** Was config B correct on this item? (the config chosen when signal > threshold) */
  readonly bCorrect: boolean;
  /** Was config A correct? (chosen when signal ≤ threshold) */
  readonly aCorrect: boolean;
}

/** Accuracy of "pick B iff signal > τ, else A" on a set of items. */
function thresholdAccuracy(items: readonly ThresholdItem[], tau: number): number {
  if (items.length === 0) return 0;
  let c = 0;
  for (const it of items) {
    const pickB = it.signal > tau;
    if ((pickB && it.bCorrect) || (!pickB && it.aCorrect)) c++;
  }
  return c / items.length;
}

/** The τ that maximizes accuracy on `train` (candidate τ's are the observed signal values). */
export function fitThreshold(train: readonly ThresholdItem[]): number {
  // Candidate thresholds: just below each distinct signal value, plus ±∞ endpoints.
  const cands = [-Infinity, ...train.map((t) => t.signal)];
  let bestTau = -Infinity, bestAcc = -1;
  for (const tau of cands) {
    const acc = thresholdAccuracy(train, tau);
    if (acc > bestAcc) { bestAcc = acc; bestTau = tau; }
  }
  return bestTau;
}

export interface KFoldResult {
  readonly k: number;
  /** Pooled out-of-sample accuracy: each item scored by a threshold fit WITHOUT it. */
  readonly oosAccuracy: number;
  /** In-sample accuracy: threshold fit on ALL data (the optimistic number). */
  readonly inSampleAccuracy: number;
  /** best-single accuracy (max of always-A, always-B). */
  readonly bestSingle: number;
  /** oos − bestSingle: the honest lift. */
  readonly oosLift: number;
  /** in-sample − oos: the optimism the split removed. */
  readonly optimism: number;
  /** Per-item OOS correctness, in input order — for a McNemar vs best-single. */
  readonly oosCorrect: readonly boolean[];
}

/**
 * K-fold cross-validation of a threshold selector (Otto's fix for in-sample optimism).
 * Deterministic fold assignment by index (i % k), so it is reproducible. The threshold is
 * fit on the other k−1 folds and applied to the held-out fold, so no item's score depends
 * on a threshold that saw it. Reports the OOS lift AND the optimism (in-sample − OOS) that
 * the split removed, because naming the optimism is the point.
 */
export function kFoldThresholdSelector(
  items: readonly ThresholdItem[], k = 5,
): KFoldResult {
  const n = items.length;
  const oosCorrect = new Array<boolean>(n);
  for (let fold = 0; fold < k; fold++) {
    const train: ThresholdItem[] = [];
    const testIdx: number[] = [];
    for (let i = 0; i < n; i++) {
      if (i % k === fold) testIdx.push(i);
      else train.push(items[i]!);
    }
    const tau = fitThreshold(train);
    for (const i of testIdx) {
      const it = items[i]!;
      const pickB = it.signal > tau;
      oosCorrect[i] = (pickB && it.bCorrect) || (!pickB && it.aCorrect);
    }
  }
  const oosAccuracy = oosCorrect.filter(Boolean).length / n;
  const tauAll = fitThreshold(items);
  const inSampleAccuracy = thresholdAccuracy(items, tauAll);
  const accA = items.filter((t) => t.aCorrect).length / n;
  const accB = items.filter((t) => t.bCorrect).length / n;
  const bestSingle = Math.max(accA, accB);
  return {
    k, oosAccuracy, inSampleAccuracy, bestSingle,
    oosLift: oosAccuracy - bestSingle,
    optimism: inSampleAccuracy - oosAccuracy,
    oosCorrect,
  };
}

// ═══ The honest bundle ══════════════════════════════════════════════════════════

export interface HonestMeasurement {
  readonly table: Table2x2;
  readonly n: number;
  /** Raw φ — NOT to be read as a [−1,1] correlation without φ_max beside it. */
  readonly phi: number;
  /** The ceiling φ can reach given these marginals. */
  readonly phiMax: number;
  /** φ / φ_max — the number to actually read. */
  readonly phiRatio: number;
  /** Marginal-free association, saturates on any empty cell. */
  readonly yulesQ: number;
  /** Chance-corrected agreement. */
  readonly kappa: number;
  /** Accuracy of A with 95% Wilson CI. */
  readonly accuracyA: Interval;
  /** Accuracy of B with 95% Wilson CI. */
  readonly accuracyB: Interval;
  /**
   * UNION UPPER BOUND: fraction where A OR B is correct. This is an ORACLE — it assumes
   * a perfect selector that always picks the correct member when either is right. It is
   * NOT an achievable system accuracy. Named to prevent the earlier "pipelineAccuracy"
   * confusion. A real selector (agreement-gating, confidence) will land BELOW this and
   * may land below max(A,B); both outcomes must be reported honestly.
   */
  readonly unionUpperBound: Interval;
  /** max(accuracy A, accuracy B) — the bar any real ensemble must clear to earn its cost. */
  readonly bestSingle: number;
}

export function measureHonest(
  trials: readonly { aCorrect: boolean; bCorrect: boolean }[],
): HonestMeasurement {
  const table = tableFromTrials(trials);
  const n = tableTotal(table);
  const sA = table.a + table.b;
  const sB = table.a + table.c;
  const union = table.a + table.b + table.c; // A or B correct
  const accuracyA = wilsonInterval(sA, n);
  const accuracyB = wilsonInterval(sB, n);
  return {
    table, n,
    phi: phi(table),
    phiMax: phiMax(table),
    phiRatio: phiRatio(table),
    yulesQ: yulesQ(table),
    kappa: cohensKappa(table),
    accuracyA,
    accuracyB,
    unionUpperBound: wilsonInterval(union, n),
    bestSingle: Math.max(accuracyA.point, accuracyB.point),
  };
}

export function formatHonest(m: HonestMeasurement): string {
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const ci = (iv: Interval) => `${pct(iv.point)} [${pct(iv.lo)}, ${pct(iv.hi)}]`;
  return [
    `N=${m.n}   table(a=${m.table.a} b=${m.table.b} c=${m.table.c} d=${m.table.d})`,
    `  φ=${m.phi.toFixed(3)}  φ_max=${m.phiMax.toFixed(3)}  φ/φ_max=${m.phiRatio.toFixed(3)}  (read the ratio, not φ)`,
    `  Yule's Q=${m.yulesQ.toFixed(3)}  κ=${m.kappa.toFixed(3)}  (marginal-free)`,
    `  acc A = ${ci(m.accuracyA)}`,
    `  acc B = ${ci(m.accuracyB)}`,
    `  best single = ${pct(m.bestSingle)}`,
    `  UNION UPPER BOUND (oracle, not a system) = ${ci(m.unionUpperBound)}`,
  ].join("\n");
}

if (import.meta.main) {
  // Recompute the earlier prompt-frame result honestly, from the committed table.
  // The committed run (#15647) recorded accA=0.96, accB=0.74, agreement=0.74, φ=0.11168 over
  // N=100. Solving those marginals for the exact 2×2 gives a=72, b=24, c=2, d=2 (φ=0.1117,
  // reproducing the recorded value). This is the real table, not a reconstruction.
  const demo: Table2x2 = { a: 72, b: 24, c: 2, d: 2 };
  const m = measureHonest(
    Array.from({ length: demo.a }, () => ({ aCorrect: true, bCorrect: true }))
      .concat(Array.from({ length: demo.b }, () => ({ aCorrect: true, bCorrect: false })))
      .concat(Array.from({ length: demo.c }, () => ({ aCorrect: false, bCorrect: true })))
      .concat(Array.from({ length: demo.d }, () => ({ aCorrect: false, bCorrect: false }))),
  );
  console.log("Honest re-reading of the prompt-frame result (#15647):");
  console.log(formatHonest(m));
  console.log(`\nφ was reported as 0.112 "nearly independent". φ/φ_max = ${m.phiRatio.toFixed(3)}.`);
  console.log(`Required N to resolve a 2pp difference at 80% power: ${requiredNForDifference(0.5, 0.52)}`);
}
