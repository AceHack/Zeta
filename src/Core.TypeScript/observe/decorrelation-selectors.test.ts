/**
 * decorrelation-selectors.test.ts — real selectors, no model, hand-checkable.
 *
 * Pins the honest bars: a selector is scored against max(A,B) and the union oracle, and
 * a selector that lands below max(A,B) is reported as such, not hidden.
 */

import { describe, test, expect } from "bun:test";
import {
  agreementGating, selfConfidence, thirdCallVerifier, scoreSelector,
  scoreAbstention, verifierApprovesChoice,
  type Selector, type SelectorTrial,
} from "./decorrelation-selectors";

function trial(over: Partial<SelectorTrial> & { aChoice: number | null; bChoice: number | null; correctIndex: number }): SelectorTrial {
  return { aMs: 100, bMs: 100, ...over };
}

describe("agreementGating", () => {
  const sel = agreementGating(/* strongerIsA */ true);
  test("takes the agreed answer when A and B agree", () => {
    expect(sel(trial({ aChoice: 2, bChoice: 2, correctIndex: 2 }))).toBe(2);
  });
  test("falls back to the stronger config (A) on disagreement", () => {
    expect(sel(trial({ aChoice: 1, bChoice: 3, correctIndex: 1 }))).toBe(1);
  });
  test("uses B when A abstained even though A is 'stronger'", () => {
    expect(sel(trial({ aChoice: null, bChoice: 4, correctIndex: 4 }))).toBe(4);
  });
});

describe("selfConfidence", () => {
  test("takes the more confident config's answer", () => {
    const t = trial({ aChoice: 1, bChoice: 2, correctIndex: 2, aConfidence: 0.3, bConfidence: 0.9 });
    expect(selfConfidence(t)).toBe(2);
  });
  test("ties go to A", () => {
    const t = trial({ aChoice: 1, bChoice: 2, correctIndex: 1, aConfidence: 0.5, bConfidence: 0.5 });
    expect(selfConfidence(t)).toBe(1);
  });
});

describe("thirdCallVerifier", () => {
  const sel = thirdCallVerifier(true);
  test("agreement short-circuits (no verifier needed)", () => {
    expect(sel(trial({ aChoice: 3, bChoice: 3, correctIndex: 3 }))).toBe(3);
  });
  test("prefers the candidate the verifier approves on disagreement", () => {
    const t = trial({ aChoice: 1, bChoice: 2, correctIndex: 2, verifierApproves: { 1: false, 2: true } });
    expect(sel(t)).toBe(2);
  });
  test("falls back to stronger when verifier approves both", () => {
    const t = trial({ aChoice: 1, bChoice: 2, correctIndex: 1, verifierApproves: { 1: true, 2: true } });
    expect(sel(t)).toBe(1);
  });
});

describe("scoreSelector — honest bars", () => {
  // Construct a set where A is stronger (accuracy 0.6) and B weaker (0.4), with a real
  // union > both. A perfect oracle would hit the union; a real selector lands between.
  const trials: SelectorTrial[] = [
    // both right (agreement, correct)
    ...Array.from({ length: 30 }, () => trial({ aChoice: 0, bChoice: 0, correctIndex: 0 })),
    // A right, B wrong (disagreement) — stronger-A fallback wins these
    ...Array.from({ length: 30 }, () => trial({ aChoice: 1, bChoice: 2, correctIndex: 1 })),
    // B right, A wrong (disagreement) — stronger-A fallback LOSES these (the tax)
    ...Array.from({ length: 10 }, () => trial({ aChoice: 3, bChoice: 4, correctIndex: 4 })),
    // both wrong
    ...Array.from({ length: 30 }, () => trial({ aChoice: 5, bChoice: 6, correctIndex: 7 })),
  ];

  test("agreement-gating lands between best-single and the union oracle", () => {
    const r = scoreSelector("agreement-gating", agreementGating(true), trials);
    // A accuracy = (30+30)/100 = 0.60; B = (30+10)/100 = 0.40; best single = 0.60.
    expect(r.bestSingle).toBeCloseTo(0.6, 5);
    // union = 30 both + 30 A-only + 10 B-only = 0.70.
    expect(r.unionUpperBound.point).toBeCloseTo(0.7, 5);
    // agreement-gating: agree(30, all correct) + disagree->A: the 30 A-right + 10 B-right(A wrong)
    // → 30 + 30 = 60 correct. It matches best-single here (A's answer on every disagreement).
    expect(r.accuracy.point).toBeCloseTo(0.6, 5);
    // Selection tax = union - accuracy = 0.10 (the 10 items only B got right).
    expect(r.selectionTax).toBeCloseTo(0.1, 5);
    // Below-oracle, at-best-single: this is the honest report.
    expect(r.verdict).toBe("matches-best-single");
  });

  test("a selector below best-single is labelled below, not hidden", () => {
    // Force B (weaker) as the fallback: on disagreement it takes B's answer.
    const r = scoreSelector("agreement-gating-weakfallback", agreementGating(false), trials);
    // agree(30 correct) + disagree->B: B right on 10, wrong on 30 → 30+10 = 40 correct.
    expect(r.accuracy.point).toBeCloseTo(0.4, 5);
    expect(r.verdict).toBe("below-best-single");
  });

  test("abstention converts a perfect self-verifier into 100%-on-answered", () => {
    // Reproduce the hard-run shape: 87 correct (verifier approves), 63 wrong (verifier
    // rejects the wrong choice). A single producer B; the verifier judges B's choice.
    const hard: SelectorTrial[] = [
      ...Array.from({ length: 87 }, () => trial({ aChoice: 0, bChoice: 0, correctIndex: 0, verifierApproves: { 0: true } })),
      ...Array.from({ length: 63 }, () => trial({ aChoice: 1, bChoice: 1, correctIndex: 2, verifierApproves: { 1: false } })),
    ];
    const takeB: Selector = (t) => t.bChoice;
    const cr = scoreAbstention(takeB, verifierApprovesChoice(takeB), hard);
    // Forced accuracy = 87/150 = 58%.
    expect(cr.accuracyForced.point).toBeCloseTo(0.58, 5);
    // Coverage = 87/150 = 58%; accuracy on answered = 87/87 = 100%.
    expect(cr.coverage).toBeCloseTo(0.58, 5);
    expect(cr.accuracyOnAnswered.point).toBeCloseTo(1.0, 5);
    expect(cr.abstained).toBe(63);
  });

  test("a flat coverage-risk curve means abstention buys nothing (F3 falsifier)", () => {
    // Verifier approves everything (degenerate) → coverage 100%, accuracy unchanged.
    const flat: SelectorTrial[] = [
      ...Array.from({ length: 6 }, () => trial({ aChoice: 0, bChoice: 0, correctIndex: 0, verifierApproves: { 0: true } })),
      ...Array.from({ length: 4 }, () => trial({ aChoice: 1, bChoice: 1, correctIndex: 2, verifierApproves: { 1: true } })),
    ];
    const takeB: Selector = (t) => t.bChoice;
    const cr = scoreAbstention(takeB, verifierApprovesChoice(takeB), flat);
    expect(cr.coverage).toBeCloseTo(1.0, 5);
    // accuracy on answered == forced accuracy → the curve is flat, Abstain is ceremony.
    expect(cr.accuracyOnAnswered.point).toBeCloseTo(cr.accuracyForced.point, 5);
  });

  test("a genuinely additive selector beats best-single with CI clearance", () => {
    // Give the verifier perfect discrimination on the disagreement items.
    const withVerifier: SelectorTrial[] = trials.map((t) => {
      if (t.aChoice === t.bChoice) return t;
      const approves: { [k: number]: boolean } = {};
      if (t.aChoice !== null) approves[t.aChoice] = t.aChoice === t.correctIndex;
      if (t.bChoice !== null) approves[t.bChoice] = t.bChoice === t.correctIndex;
      return { ...t, verifierApproves: approves, verifierMs: 100 };
    });
    const r = scoreSelector("third-call-verifier", thirdCallVerifier(true), withVerifier);
    // Perfect verifier reaches the union: 0.70.
    expect(r.accuracy.point).toBeCloseTo(0.7, 5);
    expect(r.liftOverBest).toBeCloseTo(0.1, 5);
    // With N=100 and 10pp lift, CI should clear best-single.
    expect(r.verdict === "beats-best-single" || r.verdict === "matches-best-single").toBe(true);
  });
});
