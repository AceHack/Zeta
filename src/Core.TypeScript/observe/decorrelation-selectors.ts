#!/usr/bin/env bun
/**
 * decorrelation-selectors.ts — turning the oracle into a system (Otto's W4).
 *
 * `unionUpperBound` (A OR B correct) is an ORACLE: it assumes a perfect selector that
 * always picks the correct member when either is right. No such selector exists. A real
 * system must DECIDE which answer to take using only information it actually has at
 * decision time — never the ground truth. This module implements the real selectors and
 * measures their accuracy against two honest bars:
 *
 *   - max(A, B): the best single config. A selector BELOW this is worse than just always
 *     using the stronger model. That outcome is EXPECTED for weak selectors and MUST be
 *     reported, not hidden.
 *   - unionUpperBound: the oracle ceiling. The gap between a real selector and the union
 *     is the "selection tax" — how much the lack of an oracle costs.
 *
 * A selector earns its 2× energy only if it beats max(A,B) by more than the noise floor,
 * at an N with the power to resolve it.
 *
 * ## The selectors (each uses ONLY decision-time information)
 *
 *   agreement-gating: if A and B agree, take it; if they disagree, fall back to the
 *     designated stronger config. Uses: the two answers. Not ground truth.
 *   self-confidence:  take whichever config reported higher confidence (e.g. logprob or
 *     a self-rated score). Uses: the two answers + their confidences.
 *   third-call-verifier: on disagreement, a third config (the verifier) breaks the tie
 *     by checking each candidate. Uses: the two answers + a third model call (3× energy).
 *
 * Every selector is a PURE function of per-item observations, so the whole comparison is
 * recomputable from the committed trial records without a model.
 */

import { wilsonInterval, type Interval } from "./decorrelation-stats";

// ═══ Per-item observation (what a selector may see) ════════════════════════════

export interface SelectorTrial {
  /** Config A's chosen answer index (or null if it failed to answer). */
  readonly aChoice: number | null;
  /** Config B's chosen answer index. */
  readonly bChoice: number | null;
  /** The ground-truth correct index. NEVER visible to a selector — only for scoring. */
  readonly correctIndex: number;
  /** A's self-reported confidence in [0,1], if available. */
  readonly aConfidence?: number;
  /** B's self-reported confidence in [0,1], if available. */
  readonly bConfidence?: number;
  /**
   * Third-config verdict on each candidate, if a verifier was run. Maps candidate index
   * → "approve" | "reject". Only present for the third-call-verifier selector.
   */
  readonly verifierApproves?: { readonly [choice: number]: boolean };
  /** Latency of A, B, and (if run) the verifier — for a future energy denominator. */
  readonly aMs: number;
  readonly bMs: number;
  readonly verifierMs?: number;
}

export type Selector = (t: SelectorTrial) => number | null;

// ═══ The selectors ═════════════════════════════════════════════════════════════

/**
 * Agreement-gating: agree → take it; disagree → take the designated stronger config.
 * `strongerIsA` says which config is the fallback (measured beforehand, not per-item).
 */
export function agreementGating(strongerIsA: boolean): Selector {
  return (t) => {
    if (t.aChoice !== null && t.aChoice === t.bChoice) return t.aChoice;
    // Disagreement (or one abstained): fall back to the stronger config's answer.
    const fallback = strongerIsA ? t.aChoice : t.bChoice;
    if (fallback !== null) return fallback;
    return strongerIsA ? t.bChoice : t.aChoice; // last resort if stronger abstained
  };
}

/** Self-confidence: take whichever config reported the higher confidence. */
export const selfConfidence: Selector = (t) => {
  const ca = t.aConfidence ?? 0;
  const cb = t.bConfidence ?? 0;
  if (t.aChoice === null) return t.bChoice;
  if (t.bChoice === null) return t.aChoice;
  return ca >= cb ? t.aChoice : t.bChoice;
};

/**
 * Third-call-verifier: if A and B agree, take it. On disagreement, consult the verifier
 * verdicts: prefer the candidate the verifier approves. If it approves both or neither,
 * fall back to the stronger config.
 */
export function thirdCallVerifier(strongerIsA: boolean): Selector {
  return (t) => {
    if (t.aChoice !== null && t.aChoice === t.bChoice) return t.aChoice;
    const va = t.aChoice !== null ? t.verifierApproves?.[t.aChoice] : undefined;
    const vb = t.bChoice !== null ? t.verifierApproves?.[t.bChoice] : undefined;
    if (va === true && vb !== true) return t.aChoice;
    if (vb === true && va !== true) return t.bChoice;
    // Verifier approved both or neither: fall back to the stronger config.
    return strongerIsA ? t.aChoice : t.bChoice;
  };
}

// ═══ Scoring ═══════════════════════════════════════════════════════════════════

export interface SelectorResult {
  readonly name: string;
  readonly n: number;
  /** The selector's accuracy with 95% Wilson CI. */
  readonly accuracy: Interval;
  /** accuracy(A). */
  readonly accuracyA: Interval;
  /** accuracy(B). */
  readonly accuracyB: Interval;
  /** max(accA, accB) — the bar the selector must clear to earn a second call. */
  readonly bestSingle: number;
  /** The oracle union — A OR B correct. */
  readonly unionUpperBound: Interval;
  /** accuracy − bestSingle: >0 means the selector earns its cost (before energy). */
  readonly liftOverBest: number;
  /** unionUpperBound − accuracy: the "selection tax" (cost of no oracle). */
  readonly selectionTax: number;
  /** Mean total latency (A + B + verifier if used), recorded — not yet energy. */
  readonly meanMs: number;
  readonly verdict:
    | "beats-best-single"      // liftOverBest CI excludes 0
    | "matches-best-single"    // indistinguishable from just using the stronger model
    | "below-best-single";     // worse than the stronger model alone (expected for weak selectors)
}

export function scoreSelector(name: string, selector: Selector, trials: readonly SelectorTrial[]): SelectorResult {
  const n = trials.length;
  let correct = 0, aCorrect = 0, bCorrect = 0, union = 0, msSum = 0;
  for (const t of trials) {
    const pick = selector(t);
    if (pick !== null && pick === t.correctIndex) correct++;
    const aOk = t.aChoice === t.correctIndex;
    const bOk = t.bChoice === t.correctIndex;
    if (aOk) aCorrect++;
    if (bOk) bCorrect++;
    if (aOk || bOk) union++;
    msSum += t.aMs + t.bMs + (t.verifierMs ?? 0);
  }
  const accuracy = wilsonInterval(correct, n);
  const accuracyA = wilsonInterval(aCorrect, n);
  const accuracyB = wilsonInterval(bCorrect, n);
  const bestSingle = Math.max(accuracyA.point, accuracyB.point);
  const unionUpperBound = wilsonInterval(union, n);
  const liftOverBest = accuracy.point - bestSingle;
  const selectionTax = unionUpperBound.point - accuracy.point;

  // Verdict from the CI of the accuracy vs the best-single point.
  let verdict: SelectorResult["verdict"];
  if (accuracy.lo > bestSingle) verdict = "beats-best-single";
  else if (accuracy.hi < bestSingle) verdict = "below-best-single";
  else verdict = "matches-best-single";

  return {
    name, n, accuracy, accuracyA, accuracyB, bestSingle, unionUpperBound,
    liftOverBest, selectionTax, meanMs: n > 0 ? msSum / n : 0, verdict,
  };
}

// ═══ Abstention (selective prediction) ════════════════════════════════════════

export interface CoverageRisk {
  readonly n: number;
  /** Fraction of items the policy answered (did not abstain). */
  readonly coverage: number;
  /** Accuracy on the answered items only (95% Wilson CI). */
  readonly accuracyOnAnswered: Interval;
  /** Accuracy if forced to answer every item (the must-answer baseline). */
  readonly accuracyForced: Interval;
  /** Count abstained. */
  readonly abstained: number;
}

/**
 * Abstention policy: answer with `chosen(t)` iff `approve(t)` is true, else abstain.
 * Measures the coverage–risk curve — the payoff of verification is here, not in accuracy.
 *
 * The must-answer baseline uses `chosen(t)` on every item (no abstention), so the two
 * numbers are directly comparable: does abstaining on the rejected items raise accuracy
 * on the ones we keep?
 */
export function scoreAbstention(
  chosen: Selector,
  approve: (t: SelectorTrial) => boolean,
  trials: readonly SelectorTrial[],
): CoverageRisk {
  const n = trials.length;
  let answered = 0, answeredCorrect = 0, forcedCorrect = 0;
  for (const t of trials) {
    const pick = chosen(t);
    if (pick !== null && pick === t.correctIndex) forcedCorrect++;
    if (approve(t)) {
      answered++;
      if (pick !== null && pick === t.correctIndex) answeredCorrect++;
    }
  }
  return {
    n,
    coverage: n > 0 ? answered / n : 0,
    accuracyOnAnswered: wilsonInterval(answeredCorrect, answered),
    accuracyForced: wilsonInterval(forcedCorrect, n),
    abstained: n - answered,
  };
}

/** A ready-made approve predicate: the verifier approves the chosen candidate. */
export function verifierApprovesChoice(chosen: Selector): (t: SelectorTrial) => boolean {
  return (t) => {
    const pick = chosen(t);
    return pick !== null && t.verifierApproves?.[pick] === true;
  };
}

export function formatSelectorResult(r: SelectorResult): string {
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const ci = (iv: Interval) => `${pct(iv.point)} [${pct(iv.lo)}, ${pct(iv.hi)}]`;
  return [
    `Selector: ${r.name}  N=${r.n}`,
    `  accuracy = ${ci(r.accuracy)}`,
    `  best single = ${pct(r.bestSingle)}  (A=${ci(r.accuracyA)}, B=${ci(r.accuracyB)})`,
    `  union upper bound (oracle) = ${ci(r.unionUpperBound)}`,
    `  lift over best = ${(r.liftOverBest * 100).toFixed(1)}pp   selection tax = ${(r.selectionTax * 100).toFixed(1)}pp`,
    `  mean latency = ${r.meanMs.toFixed(0)}ms/item (recorded; energy NOT derived)`,
    `  Verdict: ${r.verdict}`,
  ].join("\n");
}

if (import.meta.main) {
  console.log("Decorrelation Selectors (W4) — the oracle becomes a system.");
  console.log("Selectors: agreement-gating, self-confidence, third-call-verifier.");
  console.log("Each is scored against max(A,B) and the union oracle, with 95% CIs.");
  console.log("A selector below max(A,B) is EXPECTED for weak signals and is reported, not hidden.");
}
