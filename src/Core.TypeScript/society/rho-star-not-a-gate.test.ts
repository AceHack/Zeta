import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RHO_STAR_SUPREMUM,
  evaluateMixture,
  majorityProbability,
  rhoStarAlgebraic,
  unionGainPerValue,
} from "./rho-star-not-a-gate";

const HERE = dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(readFileSync(join(HERE, "golden-vectors-rho-star-not-a-gate.json"), "utf8")) as {
  rhoStarSupremum: string;
  ladder: { n: number; rhoStar: string }[];
  reversals: {
    label: string;
    m: number;
    lo: string;
    hi: string;
    p: string;
    rhoStar: string;
    rho: string;
    single: string;
    majority: string;
    lift: string;
    insideRhoStar: boolean;
  }[];
  unionGain: { rho: string; gain: string }[];
};

/** The fleet's measured union-coverage correlation at the commit this was written against. */
const MEASURED_FLEET_RHO = 0.6075087948288053;

describe("rho*(N) — the ladder, byte-locked", () => {
  test("every ladder row replays from the formula", () => {
    expect(golden.ladder.length).toBeGreaterThan(5);
    for (const row of golden.ladder) {
      expect(rhoStarAlgebraic(row.n).toFixed(12)).toBe(row.rhoStar);
    }
  });

  test("rho*(3) = 0 exactly — the degenerate corner, not a claim about a 3-agent fleet", () => {
    expect(rhoStarAlgebraic(3)).toBe(0);
    // N_eff >= 3 with N = 3 forces rho <= 0. The constraint is saturated at independence, so the
    // value carries no information about how correlated three agents actually are.
    expect(rhoStarAlgebraic(2)).toBe(0);

    // The `n <= 3` guard is DEFENSIVE, not behavioural: the closed form already evaluates to
    // exactly 0 at n = 3. Stated as a test because mutation testing found it -- weakening the
    // guard to `n <= 2` is an EQUIVALENT MUTANT over the integer domain (0 differences across
    // n = 0..1000), so it cannot be killed and is not counted as a surviving gap.
    expect((3 - 3) / (3 * (3 - 1))).toBe(0);
  });

  test("rho* is strictly increasing in N and bounded by 1/3", () => {
    let prev = -1;
    for (let n = 4; n <= 5000; n++) {
      const r = rhoStarAlgebraic(n);
      expect(r).toBeGreaterThan(prev);
      expect(r).toBeLessThan(RHO_STAR_SUPREMUM);
      prev = r;
    }
    expect(Number(golden.rhoStarSupremum)).toBeCloseTo(1 / 3, 12);

    // Pin the CONSTANT to the limit it claims to be, not merely to something the ladder stays
    // under. Without this, raising RHO_STAR_SUPREMUM to 1/2 survives every other assertion here.
    expect(RHO_STAR_SUPREMUM).toBe(1 / 3);
    expect(RHO_STAR_SUPREMUM).toBeCloseTo(rhoStarAlgebraic(1_000_000_000), 8);
    expect(golden.rhoStarSupremum).toBe(RHO_STAR_SUPREMUM.toFixed(12));
    // ... and it must be a genuine supremum: approached, never attained.
    expect(rhoStarAlgebraic(Number.MAX_SAFE_INTEGER)).toBeLessThan(RHO_STAR_SUPREMUM);
  });

  test("NO N reaches the fleet's measured correlation — growing the roster cannot close it", () => {
    // The intuitive repair for a correlation above the bound is "add more agents". It is
    // arithmetically unavailable: rho* has supremum 1/3 and the measurement is above it.
    expect(MEASURED_FLEET_RHO).toBeGreaterThan(RHO_STAR_SUPREMUM);
    for (const n of [4, 5, 9, 21, 101, 1001, 1_000_001, Number.MAX_SAFE_INTEGER]) {
      expect(rhoStarAlgebraic(n)).toBeLessThan(MEASURED_FLEET_RHO);
    }
  });
});

describe("reason 1 — rho is NOT a sufficient statistic for the verdict", () => {
  test("every published mixture row replays exactly", () => {
    for (const r of golden.reversals) {
      const v = evaluateMixture({ m: r.m, lo: Number(r.lo), hi: Number(r.hi), p: Number(r.p) });
      expect(v.rho.toFixed(12)).toBe(r.rho);
      expect(v.single.toFixed(12)).toBe(r.single);
      expect(v.majority.toFixed(12)).toBe(r.majority);
      expect(v.lift.toFixed(12)).toBe(r.lift);
      expect(v.insideRhoStar).toBe(r.insideRhoStar);
    }
  });

  test("THE FALSIFIER: reversal happens INSIDE the region rho* declares safe", () => {
    const inside = golden.reversals.filter((r) => r.insideRhoStar);
    // At least the m=9 reproducing row and the m=15/m=51 published rows.
    expect(inside.length).toBeGreaterThanOrEqual(3);
    for (const r of inside) {
      const v = evaluateMixture({ m: r.m, lo: Number(r.lo), hi: Number(r.hi), p: Number(r.p) });
      // Correlation is under the bound ...
      expect(v.rho).toBeLessThan(rhoStarAlgebraic(r.m));
      // ... a single voter is better than a coin ...
      expect(v.single).toBeGreaterThan(0.5);
      // ... and the majority is nonetheless WORSE than one of its own members.
      expect(v.lift).toBeLessThan(0);
    }
  });

  test("the m=9 headline row does NOT reproduce at its published 3-decimal precision", () => {
    // Owned correction. Cited in three module headers as "rho = 0.2495, inside the published safe
    // rho*(9) = 0.25". At theta_hi = 0.999 the mixture computes to rho > rho*(9) — marginally
    // OUTSIDE. The finding is unaffected: theta_hi = 0.998 reverses with rho strictly inside.
    const published = golden.reversals.find((r) => r.label === "m9-published")!;
    const reproducing = golden.reversals.find((r) => r.label === "m9-reproducing")!;

    expect(Number(published.rho)).toBeGreaterThan(rhoStarAlgebraic(9));
    expect(published.insideRhoStar).toBe(false);

    expect(Number(reproducing.rho)).toBeLessThan(rhoStarAlgebraic(9));
    expect(reproducing.insideRhoStar).toBe(true);
    expect(Number(reproducing.lift)).toBeLessThan(-0.1);

    // Both carry essentially the same reversal magnitude, which is why the rounding hid it.
    expect(Math.abs(Number(published.lift) - Number(reproducing.lift))).toBeLessThan(0.001);
  });

  test("two mixtures with the SAME m and near-identical rho land on OPPOSITE sides", () => {
    // This is the sufficiency failure stated directly: rho does not determine the verdict.
    const m = 9;
    const reversing = evaluateMixture({ m, lo: 0.375, hi: 0.998, p: 0.201 });
    // A homogeneous-competence mixture tuned to the same rho, but sitting above theta = 1/2.
    let matched: ReturnType<typeof evaluateMixture> | null = null;
    for (let lo = 0.5; lo <= 0.95; lo += 0.0005) {
      for (let hi = 0.95; hi <= 1; hi += 0.0005) {
        for (let p = 0.05; p <= 0.95; p += 0.005) {
          const v = evaluateMixture({ m, lo, hi, p });
          if (Math.abs(v.rho - reversing.rho) < 0.002 && v.lift > 0) {
            matched = v;
            break;
          }
        }
        if (matched) break;
      }
      if (matched) break;
    }
    expect(matched).not.toBeNull();
    expect(Math.abs(matched!.rho - reversing.rho)).toBeLessThan(0.002);
    expect(reversing.lift).toBeLessThan(0);
    expect(matched!.lift).toBeGreaterThan(0);
  });

  test("majorityProbability beats theta exactly when theta > 1/2 (the de Finetti criterion)", () => {
    for (const m of [3, 5, 9, 15]) {
      expect(majorityProbability(m, 0.5)).toBeCloseTo(0.5, 10);
      for (const t of [0.55, 0.7, 0.9]) expect(majorityProbability(m, t)).toBeGreaterThan(t);
      for (const t of [0.1, 0.3, 0.45]) expect(majorityProbability(m, t)).toBeLessThan(t);
    }
  });
});

describe("reason 2 — the union regime has no rho* at all", () => {
  test("every union-gain vector replays", () => {
    for (const row of golden.unionGain) {
      expect(unionGainPerValue(3, 0.4, Number(row.rho)).toFixed(12)).toBe(row.gain);
    }
  });

  test("THE FALSIFIER: union gain is strictly positive for every rho < 1, so no threshold exists", () => {
    for (let rho = 0; rho < 1; rho += 0.0005) {
      for (const n of [2, 3, 4, 9]) {
        for (const c of [0.05, 0.4, 0.9]) {
          expect(unionGainPerValue(n, c, rho)).toBeGreaterThan(0);
        }
      }
    }
    // It touches zero only in the fully-degenerate limit, and never goes negative.
    expect(unionGainPerValue(3, 0.4, 1)).toBeCloseTo(0, 12);
  });

  test("at the fleet's measured rho the union society still gains", () => {
    // The measured 0.60 is a real loss of plurality -- but in the UNION regime it is attenuation,
    // not reversal. Reporting it as "the ensemble is worse than an individual" would be a
    // category error about which aggregation rule is in play.
    const gain = unionGainPerValue(3, 0.4, MEASURED_FLEET_RHO);
    expect(gain).toBeGreaterThan(0);
    expect(gain).toBeLessThan(unionGainPerValue(3, 0.4, 0));
  });
});
