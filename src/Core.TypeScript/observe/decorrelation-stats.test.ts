/**
 * decorrelation-stats.test.ts — every number is recomputable without a model.
 *
 * These tests pin the honest statistics against hand-computed values so a reviewer
 * never has to run a model to check the math. They also encode Otto's correction:
 * the prompt-frame φ=0.112 sits at 32% of its ceiling, not near independence.
 */

import { describe, test, expect } from "bun:test";
import {
  phi, phiMax, phiRatio, yulesQ, cohensKappa,
  wilsonInterval, proportionDiffInterval, requiredNForDifference,
  measureHonest, detectAnswerLeak, suspectExtremeRate, mcNemar, mannWhitneyU,
  kFoldThresholdSelector, fitThreshold,
  type Table2x2,
} from "./decorrelation-stats";

const close = (x: number, y: number, eps = 1e-3) => expect(Math.abs(x - y)).toBeLessThan(eps);

describe("phi", () => {
  test("perfect positive association on equal marginals is 1", () => {
    close(phi({ a: 50, b: 0, c: 0, d: 50 }), 1);
  });
  test("independence (cells match marginal products) is 0", () => {
    // a=25,b=25,c=25,d=25: p(A)=p(B)=0.5, ad-bc=625-625=0
    close(phi({ a: 25, b: 25, c: 25, d: 25 }), 0);
  });
  test("degenerate table returns 0, never NaN", () => {
    expect(phi({ a: 100, b: 0, c: 0, d: 0 })).toBe(0);
  });
});

describe("phiMax — the ceiling Otto insisted we report", () => {
  test("equal marginals give ceiling 1", () => {
    close(phiMax({ a: 50, b: 0, c: 0, d: 50 }), 1);
  });
  test("prompt-frame marginals (p1=0.96, p2=0.74) give ceiling 0.344", () => {
    // The committed table a=72,b=24,c=2,d=2
    close(phiMax({ a: 72, b: 24, c: 2, d: 2 }), 0.344, 2e-3);
  });
  test("degenerate marginal gives ceiling 0", () => {
    expect(phiMax({ a: 96, b: 0, c: 4, d: 0 })).toBe(0);
  });
});

describe("phiRatio — the number to actually read", () => {
  test("prompt-frame φ=0.112 is 32% of its ceiling, NOT near-independent", () => {
    const t: Table2x2 = { a: 72, b: 24, c: 2, d: 2 };
    close(phi(t), 0.112, 2e-3);
    close(phiRatio(t), 0.324, 5e-3);
    // The correction in one assertion: 0.112 read as [-1,1] looks tiny; on its real
    // scale it is a third of the way to maximal association (φ_max=0.344, so the ratio
    // is ~2.9× the raw φ).
    expect(phiRatio(t) / phi(t)).toBeGreaterThan(2.5);
  });
});

describe("yulesQ — marginal-free, saturates on an empty cell", () => {
  test("prompt-frame Yule's Q is 0.5 (moderate association, not zero)", () => {
    close(yulesQ({ a: 72, b: 24, c: 2, d: 2 }), 0.5, 1e-3);
  });
  test("any empty off-diagonal cell saturates to +1", () => {
    close(yulesQ({ a: 40, b: 0, c: 30, d: 30 }), 1);
  });
});

describe("cohensKappa", () => {
  test("chance-level agreement is ~0", () => {
    close(cohensKappa({ a: 25, b: 25, c: 25, d: 25 }), 0);
  });
  test("perfect agreement is 1", () => {
    close(cohensKappa({ a: 50, b: 0, c: 0, d: 50 }), 1);
  });
});

describe("wilsonInterval — behaves at the boundary where N is small", () => {
  test("100% on N=3 has a wide interval, not a point at 1", () => {
    const iv = wilsonInterval(3, 3);
    expect(iv.point).toBe(1);
    // Otto's point: 100% on N=3 is consistent with a true rate well below 1.
    expect(iv.lo).toBeLessThan(0.5);
  });
  test("50/100 centers near 0.5 with a reasonable width", () => {
    const iv = wilsonInterval(50, 100);
    close(iv.point, 0.5);
    expect(iv.hi - iv.lo).toBeGreaterThan(0.15);
    expect(iv.hi - iv.lo).toBeLessThan(0.25);
  });
  test("N=0 returns full uncertainty", () => {
    const iv = wilsonInterval(0, 0);
    expect(iv.lo).toBe(0);
    expect(iv.hi).toBe(1);
  });
});

describe("proportionDiffInterval", () => {
  test("a 2pp difference at N=100 has a CI that straddles 0 (not resolvable)", () => {
    const iv = proportionDiffInterval(52, 100, 50, 100);
    close(iv.point, 0.02);
    expect(iv.lo).toBeLessThan(0);
    expect(iv.hi).toBeGreaterThan(0);
  });
});

describe("requiredNForDifference — the power calculation (W3)", () => {
  test("resolving a 2pp difference near p=0.5 needs ~9800 per arm", () => {
    const n = requiredNForDifference(0.5, 0.52);
    expect(n).toBeGreaterThan(9000);
    expect(n).toBeLessThan(11000);
  });
  test("a 10pp difference needs far fewer (~400)", () => {
    const n = requiredNForDifference(0.5, 0.6);
    expect(n).toBeGreaterThan(300);
    expect(n).toBeLessThan(500);
  });
  test("zero difference is unresolvable (Infinity)", () => {
    expect(requiredNForDifference(0.5, 0.5)).toBe(Infinity);
  });
});

describe("kFoldThresholdSelector (Otto's in-sample-optimism guard)", () => {
  test("a genuinely predictive signal keeps its lift out-of-sample", () => {
    // signal>0 <=> B correct, signal<0 <=> A correct — cleanly separable, fold-independent
    // (constant +1/-1 so any train fold recovers the same threshold near 0).
    const items = Array.from({ length: 200 }, (_, i) => {
      const bWins = i % 2 === 0;
      return { signal: bWins ? 1 : -1, bCorrect: bWins, aCorrect: !bWins };
    });
    const r = kFoldThresholdSelector(items, 5);
    expect(r.oosLift).toBeGreaterThan(0.3); // huge, real separation survives OOS
    expect(r.optimism).toBeLessThan(0.05);
  });

  test("a PURE-NOISE signal shows ~0 OOS lift even if in-sample looks positive", () => {
    // signal is random noise, uncorrelated with which config is right. A fitted threshold
    // will find spurious in-sample gain; k-fold must strip it back toward best-single.
    let s = 12345;
    const rng = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    const items = Array.from({ length: 300 }, () => {
      const bWins = rng() < 0.4; // B correct 40%, A 60% (A is best-single)
      return { signal: rng() - 0.5, bCorrect: bWins, aCorrect: !bWins };
    });
    const r = kFoldThresholdSelector(items, 5);
    // In-sample fitting can invent a small edge; OOS should not clear best-single meaningfully.
    expect(r.oosLift).toBeLessThan(0.03);
    // The optimism (in-sample minus OOS) is the noise the fit absorbed — it should be > 0.
    expect(r.optimism).toBeGreaterThanOrEqual(0);
  });

  test("fitThreshold picks the accuracy-maximizing cut", () => {
    const items = [
      { signal: -2, bCorrect: false, aCorrect: true },
      { signal: -1, bCorrect: false, aCorrect: true },
      { signal: 1, bCorrect: true, aCorrect: false },
      { signal: 2, bCorrect: true, aCorrect: false },
    ];
    const tau = fitThreshold(items);
    // Any τ in [-1, 1) gives 100% (pick A below, B above). The fit returns one such.
    expect(thresholdAccuracyProbe(items, tau)).toBe(1);
  });
});

// local probe mirroring the module's private thresholdAccuracy for the test above
function thresholdAccuracyProbe(items: { signal: number; bCorrect: boolean; aCorrect: boolean }[], tau: number): number {
  let c = 0;
  for (const it of items) {
    const pickB = it.signal > tau;
    if ((pickB && it.bCorrect) || (!pickB && it.aCorrect)) c++;
  }
  return c / items.length;
}

describe("mannWhitneyU (H3 — does a signal separate two groups?)", () => {
  test("cleanly separated groups reject with a large effect", () => {
    const lo = Array.from({ length: 25 }, (_, i) => i);        // 0..24
    const hi = Array.from({ length: 25 }, (_, i) => i + 100);  // 100..124
    const r = mannWhitneyU(hi, lo);
    expect(r.rejects).toBe(true);
    expect(Math.abs(r.rankBiserial)).toBeGreaterThan(0.9);
  });

  test("identical distributions do NOT reject (the not-addressable case)", () => {
    const a = Array.from({ length: 30 }, (_, i) => i % 5);
    const b = Array.from({ length: 30 }, (_, i) => i % 5);
    const r = mannWhitneyU(a, b);
    expect(r.rejects).toBe(false);
    expect(Math.abs(r.rankBiserial)).toBeLessThan(0.15);
  });

  test("empty group is handled without NaN", () => {
    const r = mannWhitneyU([], [1, 2, 3]);
    expect(r.rejects).toBe(false);
    expect(Number.isFinite(r.z)).toBe(true);
  });
});

describe("mcNemar (paired) — the analysis Otto asked for", () => {
  function build(a: number, b: number, c: number, d: number) {
    const out: { aCorrect: boolean; bCorrect: boolean }[] = [];
    for (let i = 0; i < a; i++) out.push({ aCorrect: true, bCorrect: true });
    for (let i = 0; i < b; i++) out.push({ aCorrect: true, bCorrect: false });
    for (let i = 0; i < c; i++) out.push({ aCorrect: false, bCorrect: true });
    for (let i = 0; i < d; i++) out.push({ aCorrect: false, bCorrect: false });
    return out;
  }

  test("symmetric discordant split (b≈c) is NOT resolved — the trades-equal falsifier", () => {
    const r = mcNemar(build(300, 20, 20, 60));
    expect(r.b).toBe(20);
    expect(r.c).toBe(20);
    close(r.accuracyDiff, 0);
    expect(r.resolved).toBe(false);
    expect(r.symmetric).toBe(true);
  });

  test("a strong directional split resolves with CI excluding zero", () => {
    // b=40 (A right, B wrong), c=5 (B right, A wrong), over n=400.
    const r = mcNemar(build(300, 40, 5, 55));
    close(r.accuracyDiff, (40 - 5) / 400, 1e-9);
    expect(r.diffLo).toBeGreaterThan(0);
    expect(r.resolved).toBe(true);
    expect(r.symmetric).toBe(false);
  });

  test("paired CI is narrower than the unpaired two-proportion CI on the same counts", () => {
    const b = 30, c = 10, n = 400;
    const r = mcNemar(build(300, b, c, n - 300 - b - c));
    const pairedWidth = r.diffHi - r.diffLo;
    // Unpaired difference CI on the same marginals:
    const sA = 300 + b, sB = 300 + c;
    const unpaired = proportionDiffInterval(sA, n, sB, n);
    const unpairedWidth = unpaired.hi - unpaired.lo;
    expect(pairedWidth).toBeLessThan(unpairedWidth);
  });
});

describe("detectAnswerLeak (W12) — the falsifier, scoped to the instruction region", () => {
  const correct = "respond_to_operator";

  test("RED on the ACTUAL leaky verifier RULES region (proves it can fail)", () => {
    // The instruction/rules region names the correct option — the real leak.
    const leakyRules =
      `You are verifying whether a proposed action is correct.\n\nRULES:\n` +
      `- If operator has a pending message, the ONLY correct action is "respond_to_operator"\n` +
      `- Operator ALWAYS outranks work items`;
    expect(detectAnswerLeak(leakyRules, correct).leaked).toBe(true);
  });

  test("GREEN on an equalized instruction that does not name the answer", () => {
    const clean =
      `You are verifying whether a proposed action is correct.\n\n` +
      `Decide using the state and the proposed action only.`;
    expect(detectAnswerLeak(clean, correct).leaked).toBe(false);
  });

  test("a PRODUCER's options menu is NOT a leak (the correct option is the choice set)", () => {
    // This is the case that false-fired the whole-prompt version. The instruction region
    // (excluding the options block) does not name the answer, so it is clean — even though
    // the options block obviously contains `respond_to_operator`.
    const producerInstruction = `Choose ONE action. Reply ONLY the number. Operator outranks everything.`;
    expect(detectAnswerLeak(producerInstruction, correct).leaked).toBe(false);
  });

  test("the clause-swap instruction is also clean (no answer named)", () => {
    const clauseSwap = `Operator outranks everything. Choose ONE action; reply ONLY the number.`;
    expect(detectAnswerLeak(clauseSwap, correct).leaked).toBe(false);
  });
});

describe("suspectExtremeRate (W13) — a perfect classifier is a defect signal", () => {
  test("100% on a nontrivial sample is flagged SUSPECT", () => {
    expect(suspectExtremeRate("self-catch", 63, 63)).toContain("SUSPECT");
    expect(suspectExtremeRate("approve-correct", 87, 87)).toContain("100%");
  });
  test("0% is flagged as degenerate", () => {
    expect(suspectExtremeRate("true-negative", 0, 40)).toContain("SUSPECT");
  });
  test("a normal rate is not flagged", () => {
    expect(suspectExtremeRate("acc", 87, 150)).toBeNull();
  });
  test("tiny samples are not flagged (100% on N=3 is handled by CIs, not this)", () => {
    expect(suspectExtremeRate("acc", 3, 3)).toBeNull();
  });
});

describe("measureHonest — the full bundle on the real prompt-frame table", () => {
  const trials = tableFromTrialsToArray({ a: 72, b: 24, c: 2, d: 2 });
  const m = measureHonest(trials);

  test("reproduces the committed φ=0.112", () => close(m.phi, 0.112, 2e-3));
  test("reports φ_max and the ratio", () => {
    close(m.phiMax, 0.344, 2e-3);
    close(m.phiRatio, 0.324, 5e-3);
  });
  test("unionUpperBound is labelled as an oracle above best-single", () => {
    expect(m.unionUpperBound.point).toBeGreaterThanOrEqual(m.bestSingle);
  });
  test("best single is the bar (0.96 here), not the union", () => {
    close(m.bestSingle, 0.96);
    // The union (98%) is a 2pp oracle gain — inside the noise floor per the power test.
    expect(m.unionUpperBound.point - m.bestSingle).toBeLessThan(0.03);
  });
});

// Helper: expand a 2x2 table into a trial array (mirrors the demo in the module).
function tableFromTrialsToArray(t: Table2x2): { aCorrect: boolean; bCorrect: boolean }[] {
  const out: { aCorrect: boolean; bCorrect: boolean }[] = [];
  for (let i = 0; i < t.a; i++) out.push({ aCorrect: true, bCorrect: true });
  for (let i = 0; i < t.b; i++) out.push({ aCorrect: true, bCorrect: false });
  for (let i = 0; i < t.c; i++) out.push({ aCorrect: false, bCorrect: true });
  for (let i = 0; i < t.d; i++) out.push({ aCorrect: false, bCorrect: false });
  return out;
}
