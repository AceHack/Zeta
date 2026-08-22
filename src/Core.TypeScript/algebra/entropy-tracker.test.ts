import { describe, test, expect } from "bun:test";
import {
  createEntropyTracker, verifyLandauer, accountFerryCommit,
  LANDAUER_FLOOR_PER_BIT,
} from "./entropy-tracker";

describe("entropy-tracker — two-ledger Maxwell's Demon model", () => {
  test("initial state: zero entropy, second law satisfied", () => {
    const t = createEntropyTracker();
    expect(t.state.entropy_state).toBe(0);
    expect(t.state.entropy_heat).toBe(0);
    expect(t.state.second_law_satisfied).toBe(true);
  });

  test("branch: +1 bit uncertainty (Hadamard)", () => {
    const t = createEntropyTracker();
    t.branch();
    expect(t.state.entropy_state).toBe(1);
    expect(t.state.entropy_heat).toBe(0); // no heat for reversible op
    t.branch();
    expect(t.state.entropy_state).toBe(2); // two branches = 2 bits
  });

  test("observe (Adj): zero heat, just counts", () => {
    const t = createEntropyTracker();
    t.branch(); // create some uncertainty
    t.observe();
    t.observe();
    expect(t.state.soft_observations).toBe(2);
    expect(t.state.entropy_heat).toBe(0); // Adj = free (Bennett)
    expect(t.state.entropy_state).toBe(1); // unchanged
  });

  test("measure (non-Adj): entropy transfers from state to heat", () => {
    const t = createEntropyTracker();
    t.branch(); // +1 bit
    t.branch(); // +1 bit (total: 2 bits uncertainty)
    t.measure(1); // collapse 1 bit
    expect(t.state.entropy_state).toBe(1); // lost 1 bit from state
    expect(t.state.entropy_heat).toBe(1); // gained 1 bit in heat (Landauer)
    expect(t.state.hard_measurements).toBe(1);
  });

  test("second law: total entropy never decreases", () => {
    const t = createEntropyTracker();
    t.branch(); // +1
    t.branch(); // +2
    t.measure(2); // transfer both to heat
    // total = 0 (state) + 2 (heat) = 2 ≥ 0 (initial)
    expect(t.state.second_law_satisfied).toBe(true);
    expect(t.state.entropy_state + t.state.entropy_heat).toBe(2);
  });

  test("permutation: zero entropy change", () => {
    const t = createEntropyTracker();
    t.branch(); // +1
    t.permutation(); // mul/xorshr — bijective
    t.permutation();
    expect(t.state.entropy_state).toBe(1); // unchanged
    expect(t.state.entropy_heat).toBe(0); // no heat
  });

  test("Landauer verification: heat ≥ floor", () => {
    const t = createEntropyTracker();
    t.branch();
    t.branch();
    t.measure(2);
    const v = verifyLandauer(t);
    expect(v.holds).toBe(true);
    expect(v.bitsErased).toBe(2);
    expect(v.heatPaid).toBe(2);
    expect(v.floor).toBe(2 * LANDAUER_FLOOR_PER_BIT);
  });

  test("full cycle: branch → observe → measure (demon reads then erases)", () => {
    const t = createEntropyTracker();
    // The demon accumulates information (free)
    t.branch(); // +1 bit uncertainty
    t.branch(); // +1 bit (support = 4 states)
    t.observe(); // read for free (Adj)
    t.observe(); // read again (still free)
    expect(t.state.soft_observations).toBe(2);
    expect(t.state.entropy_heat).toBe(0); // still no heat

    // The demon commits (pay Landauer)
    t.measure(2); // erase both bits
    expect(t.state.entropy_state).toBe(0); // fully collapsed
    expect(t.state.entropy_heat).toBe(2); // 2 bits of heat paid
    expect(t.state.second_law_satisfied).toBe(true);
  });
});

describe("entropy-tracker — ferry commit accounting", () => {
  test("ferry commit: Landauer floor + finite-time excess", () => {
    const account = accountFerryCommit(10, 100); // 10 bits, 100 time units
    expect(account.batchBits).toBe(10);
    expect(account.landauerFloor).toBe(10); // 10 × 1 kT·ln2
    expect(account.finiteTimeExcess).toBe(0.01); // L²/τ = 1/100
    expect(account.totalHeat).toBe(10.01); // floor + excess
  });

  test("predictive advantage: larger τ = less excess", () => {
    const fast = accountFerryCommit(10, 1);    // rushed commit (τ=1)
    const slow = accountFerryCommit(10, 1000); // predicted commit (τ=1000)

    // Same floor (Landauer doesn't amortize)
    expect(fast.landauerFloor).toBe(slow.landauerFloor);

    // But excess is MUCH less for predicted (larger τ)
    expect(slow.finiteTimeExcess).toBeLessThan(fast.finiteTimeExcess);
    expect(slow.totalHeat).toBeLessThan(fast.totalHeat);
  });

  test("infinite erasure window = zero excess (quasi-static limit)", () => {
    const quasiStatic = accountFerryCommit(10, Infinity);
    expect(quasiStatic.finiteTimeExcess).toBe(0); // L²/∞ = 0
    expect(quasiStatic.totalHeat).toBe(10); // just the floor
  });

  test("zero erasure window = infinite excess (maximally irreversible)", () => {
    const instant = accountFerryCommit(10, 0);
    expect(instant.finiteTimeExcess).toBe(Infinity);
    expect(instant.totalHeat).toBe(Infinity);
  });
});
