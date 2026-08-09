/**
 * empowerment-bound.test.ts — Tests for the third bound.
 *
 * EB-1..EB-3: linear-blend vacuity lemma (the proof)
 * EB-4..EB-7: empowermentBound selection
 * EB-8..EB-9: externality bound
 * EB-10: oracle parameterization (no ambient global scorer)
 */
import { describe, test, expect } from "bun:test";
import {
  linearBlendIsVacuous, empowermentBound, jointOptionGain, externalitySafe,
  type CandidateInteraction, type OracleSet,
} from "./empowerment-bound";
import type { CalibrationPosterior } from "./calibration-ledger";

function makePosterior(mu: number, sigma = 0.2236): CalibrationPosterior {
  return { zid: "test", hatId: "default", mu, sigma, settledCount: 5 };
}

const myOracles: OracleSet = { ids: ["oracle-a", "oracle-b"] };

describe("EmpowermentBound", () => {
  // EB-1: linear blend is vacuous for w=0.5, k1=1, k2=3
  test("EB-1: linear blend is vacuous (w=0.5, k1=1, k2=3)", () => {
    const p = makePosterior(0.7);
    expect(linearBlendIsVacuous(p, 0.5, 1, 3)).toBe(true);
  });

  // EB-2: linear blend is vacuous for any w ∈ (0,1)
  test("EB-2: linear blend is vacuous for any w ∈ (0,1)", () => {
    const p = makePosterior(0.6);
    for (const w of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      expect(linearBlendIsVacuous(p, w, 1, 3)).toBe(true);
    }
  });

  // EB-3: linear blend is vacuous for w=0 (pure trustBound) and w=1 (pure exploreBound)
  test("EB-3: linear blend is vacuous at w=0 and w=1", () => {
    const p = makePosterior(0.5);
    expect(linearBlendIsVacuous(p, 0, 1, 3)).toBe(true); // pure trustBound
    expect(linearBlendIsVacuous(p, 1, 1, 3)).toBe(true); // pure exploreBound
  });

  // EB-4: empowermentBound selects the interaction with highest jointOptionGain
  test("EB-4: empowermentBound selects highest-gain admissible interaction", () => {
    const self = makePosterior(0.8);
    const other = makePosterior(0.8);
    const interactions: CandidateInteraction[] = [
      { description: "low gain", deltaReachSelf: 0.1, deltaReachOther: 0.1, aggregation: "min" },
      { description: "high gain", deltaReachSelf: 0.5, deltaReachOther: 0.5, aggregation: "min" },
      { description: "medium gain", deltaReachSelf: 0.3, deltaReachOther: 0.3, aggregation: "min" },
    ];
    const result = empowermentBound(self, other, interactions, myOracles);
    expect(result).not.toBeNull();
    expect(result!.interaction.description).toBe("high gain");
    expect(result!.gain).toBe(0.5);
  });

  // EB-5: empowermentBound rejects interactions that violate the floor
  test("EB-5: empowermentBound rejects floor-violating interactions", () => {
    const self = makePosterior(0.5);
    const other = makePosterior(0.5);
    // Both interactions harm the other party significantly
    const interactions: CandidateInteraction[] = [
      { description: "harms other", deltaReachSelf: 0.5, deltaReachOther: -1.0, aggregation: "min" },
    ];
    // tauOther = 0.1 (other's floor must stay above 0.1)
    const result = empowermentBound(self, other, interactions, myOracles, 0, 0.1);
    // The interaction is inadmissible because it harms the other party
    // (otherFloor + min(0, -1.0) < 0.1)
    expect(result).toBeNull();
  });

  // EB-6: min aggregation protects the worse-off party
  test("EB-6: min aggregation protects the worse-off party", () => {
    const interaction: CandidateInteraction = {
      description: "asymmetric",
      deltaReachSelf: 0.9,
      deltaReachOther: 0.1,
      aggregation: "min",
    };
    expect(jointOptionGain(interaction)).toBe(0.1); // min protects the worse-off
  });

  // EB-7: sum aggregation (opt-in) permits sacrifice
  test("EB-7: sum aggregation permits sacrifice (opt-in only)", () => {
    const interaction: CandidateInteraction = {
      description: "sacrifice",
      deltaReachSelf: 0.9,
      deltaReachOther: -0.3,
      aggregation: "sum",
    };
    expect(jointOptionGain(interaction)).toBeCloseTo(0.6, 10); // sum: 0.9 + (-0.3)
  });

  // EB-8: externality bound: safe when third party is not harmed
  test("EB-8: externalitySafe returns true when third party is not harmed", () => {
    const thirdParty = makePosterior(0.8);
    expect(externalitySafe(thirdParty, 0.0)).toBe(true);   // no harm
    expect(externalitySafe(thirdParty, 0.1)).toBe(true);   // benefit
  });

  // EB-9: externality bound: unsafe when third party's floor is pushed below 0
  test("EB-9: externalitySafe returns false when third party's floor is violated", () => {
    const thirdParty = makePosterior(0.1); // low mu → low trustBound (near 0)
    // A large negative delta pushes the floor below 0
    expect(externalitySafe(thirdParty, -1.0)).toBe(false);
  });

  // EB-10: empowermentBound returns null for empty interaction list
  // ── 081KZKYDJ9Q: the τ / consent-inversion fix (Soraya's P0) ────────────────
  //
  // These lock behaviour the previous tests could not see. A material semantic
  // change to externalitySafe left all 10 originals green, which is itself the
  // evidence that they were self-certifying (Soraya: EB-8 asserts the vacuous
  // `delta >= 0` branch and therefore cannot fail).
  //
  // Semantics under test — the boxing-ring table:
  //   bystander (no declared τ) -> ANY harm fails; they are the audience.
  //   entered the ring (declared τ) -> harm down to their declared τ is permitted.

  test("EB-11: Soraya L4 — a bystander at floor 0.8 hit by −0.7 is NOT safe", () => {
    // The shipped version returned TRUE here (0.8 − 0.7 = 0.1 >= 0), reporting a
    // bystander pushed far below their own floor as safe. That was the consent
    // inversion: τ hardcoded to 0 reads silence as consent to maximal harm.
    expect(externalitySafe({ mu: 0.8, sigma: 0.0 } as CalibrationPosterior, -0.7)).toBe(false);
  });

  test("EB-12: Soraya L3 — a 90% reach reduction on a well-established bystander is NOT safe", () => {
    expect(externalitySafe({ mu: 0.95, sigma: 0.01 } as CalibrationPosterior, -0.9)).toBe(false);
  });

  test("EB-13: ANY harm to a bystander fails, however small (no-harm default)", () => {
    // The default τ is the party's own pre-interaction floor, so the predicate
    // reduces to harm >= 0. This is the property EB-9 gestured at but did not pin.
    expect(externalitySafe({ mu: 0.5, sigma: 0.1 } as CalibrationPosterior, -0.01)).toBe(false);
  });

  test("EB-14: zero externality is safe; benefit is safe but carries no credit", () => {
    const p = { mu: 0.5, sigma: 0.1 } as CalibrationPosterior;
    expect(externalitySafe(p, 0)).toBe(true);
    // Benefit is clamped away rather than offsetting: a claimed benefit to someone
    // not at the table is an unverified assertion, so it may not buy harm elsewhere.
    expect(externalitySafe(p, 0.5)).toBe(true);
  });

  test("EB-15: a DECLARED permissive τ permits harm — entering the ring is the only way in", () => {
    const p = { mu: 0.5, sigma: 0.1 } as CalibrationPosterior;
    // Same harm that fails for a bystander (EB-13 shape) succeeds once τ is declared.
    expect(externalitySafe(p, -0.4)).toBe(false);
    expect(externalitySafe(p, -0.4, 3, -1)).toBe(true);
  });

  test("EB-16: τ is never inferred — the permissive path requires an explicit argument", () => {
    // Guards the regression that caused this: a missing parameter silently became
    // τ = 0. If the default ever stops meaning "the party's own floor", EB-13 and
    // this test fail together rather than passing vacuously.
    const p = { mu: 0.9, sigma: 0.0 } as CalibrationPosterior;
    expect(externalitySafe(p, -0.5)).toBe(false);          // no τ declared -> refused
    expect(externalitySafe(p, -0.5, 3, 0.0)).toBe(true);   // τ = 0 declared -> permitted
  });

  test("EB-10: empowermentBound returns null for empty interaction list", () => {
    const self = makePosterior(0.8);
    const other = makePosterior(0.8);
    expect(empowermentBound(self, other, [], myOracles)).toBeNull();
  });
});
