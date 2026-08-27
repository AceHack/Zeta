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
  measureHonest, detectAnswerLeak, suspectExtremeRate,
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

describe("detectAnswerLeak (W12) — the falsifier that would have caught the leak", () => {
  const correct = "respond_to_operator";

  test("RED on the ACTUAL leaky verifier prompt (proves it can fail)", () => {
    const leaky =
      `You are verifying whether a proposed action is correct.\n\nRULES:\n` +
      `- If operator has a pending message, the ONLY correct action is "respond_to_operator"\n` +
      `- Operator ALWAYS outranks work items\n\nSTATE: ...\n\nPROPOSED: "do_item: task-3"\n\nIs this correct?`;
    const r = detectAnswerLeak(leaky, correct);
    expect(r.leaked).toBe(true);
  });

  test("GREEN on an equalized verifier prompt that does not name the answer", () => {
    // A rule stated abstractly, without naming the winning option string.
    const clean =
      `You are verifying whether a proposed action is correct.\n\n` +
      `Decide using the state and the proposed action only.\n\nSTATE: ...\n\nPROPOSED: "do_item: task-3"\n\nIs this correct?`;
    const r = detectAnswerLeak(clean, correct);
    expect(r.leaked).toBe(false);
  });

  test("a verifier prompt that only carries the single candidate is clean", () => {
    const candidateOnly = `PROPOSED: "do_item: task-7"\n\nIs this correct? yes/no`;
    expect(detectAnswerLeak(candidateOnly, correct).leaked).toBe(false);
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
