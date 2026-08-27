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
 * W12 — the leak falsifier. A verifier prompt must NOT contain the correct answer or a
 * rule that names it. If it does, the "verification" is a model reading back information
 * it was handed, not a cognitive check. Returns the offending substring, or null if
 * clean.
 *
 * This is the same class of guard as `assertNoOptionContamination` (which stops a text
 * arm from moving buttons) — pointed at a different axis: it stops the verifier prompt
 * from carrying the answer key.
 */
export function detectAnswerLeak(
  verifierPrompt: string,
  correctOptionText: string,
): { leaked: true; via: string } | { leaked: false } {
  const needle = correctOptionText.trim().toLowerCase();
  const hay = verifierPrompt.toLowerCase();
  // Direct mention of the correct option string inside the prompt (outside the single
  // candidate slot the verifier is allowed to see).
  if (needle.length >= 4 && hay.includes(needle)) {
    return { leaked: true, via: `verifier prompt names the correct option "${correctOptionText}"` };
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
