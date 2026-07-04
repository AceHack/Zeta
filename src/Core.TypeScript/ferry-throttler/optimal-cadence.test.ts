/**
 * optimal-cadence.test.ts — verify τ* = L/√α (AM-GM optimum).
 */

import { describe, test, expect } from "bun:test";
import {
  computeOptimalCadence,
  totalCostAtWindow,
  adjustPressureByReliability,
} from "./optimal-cadence";

describe("computeOptimalCadence — τ* = L/√α", () => {
  test("standard case: L²=4, α=1 → τ*=2, C*=4", () => {
    const r = computeOptimalCadence({ thermLength: 4, queuePressure: 1 });
    expect(r.optimalWindow).toBeCloseTo(2, 10);   // L/√α = √4/√1 = 2
    expect(r.minCost).toBeCloseTo(4, 10);          // 2L√α = 2*2*1 = 4
    expect(r.excessAtOptimum).toBeCloseTo(2, 10);  // L²/τ* = 4/2 = 2
    expect(r.pressureAtOptimum).toBeCloseTo(2, 10); // α·τ* = 1*2 = 2
  });

  test("AM-GM equality: excess = pressure at the optimum", () => {
    const r = computeOptimalCadence({ thermLength: 9, queuePressure: 4 });
    expect(r.excessAtOptimum).toBeCloseTo(r.pressureAtOptimum, 10);
  });

  test("higher L² → larger τ* (more excess cost → wait longer)", () => {
    const r1 = computeOptimalCadence({ thermLength: 1, queuePressure: 1 });
    const r2 = computeOptimalCadence({ thermLength: 100, queuePressure: 1 });
    expect(r2.optimalWindow).toBeGreaterThan(r1.optimalWindow);
  });

  test("higher α → smaller τ* (more pressure → commit sooner)", () => {
    const r1 = computeOptimalCadence({ thermLength: 4, queuePressure: 1 });
    const r2 = computeOptimalCadence({ thermLength: 4, queuePressure: 100 });
    expect(r2.optimalWindow).toBeLessThan(r1.optimalWindow);
  });

  test("zero pressure → infinite window (no reason to commit)", () => {
    const r = computeOptimalCadence({ thermLength: 4, queuePressure: 0 });
    expect(r.optimalWindow).toBe(Infinity);
    expect(r.minCost).toBe(0);
  });

  test("zero thermLength → zero window (commits are free)", () => {
    const r = computeOptimalCadence({ thermLength: 0, queuePressure: 5 });
    expect(r.optimalWindow).toBe(0);
    expect(r.minCost).toBe(0);
  });
});

describe("totalCostAtWindow — C(τ) = L²/τ + α·τ", () => {
  test("at τ*, cost equals the AM-GM minimum", () => {
    const params = { thermLength: 4, queuePressure: 1 };
    const r = computeOptimalCadence(params);
    const cost = totalCostAtWindow(params, r.optimalWindow);
    expect(cost).toBeCloseTo(r.minCost, 10);
  });

  test("any deviation from τ* increases cost", () => {
    const params = { thermLength: 9, queuePressure: 4 };
    const r = computeOptimalCadence(params);
    const atOptimum = totalCostAtWindow(params, r.optimalWindow);
    const tooShort = totalCostAtWindow(params, r.optimalWindow * 0.5);
    const tooLong = totalCostAtWindow(params, r.optimalWindow * 2);

    expect(tooShort).toBeGreaterThan(atOptimum);
    expect(tooLong).toBeGreaterThan(atOptimum);
  });

  test("cost is symmetric around the optimum (AM-GM property)", () => {
    const params = { thermLength: 16, queuePressure: 1 };
    const r = computeOptimalCadence(params);
    // At τ*/2 and 2τ*, the costs should be equal (AM-GM symmetry in log space)
    const halfCost = totalCostAtWindow(params, r.optimalWindow / 2);
    const doubleCost = totalCostAtWindow(params, r.optimalWindow * 2);
    expect(halfCost).toBeCloseTo(doubleCost, 10);
  });
});

describe("adjustPressureByReliability — trust modulates urgency", () => {
  test("high reliability (1.5x window) → pressure drops to 4/9 (≈0.44)", () => {
    const adjusted = adjustPressureByReliability(1.0, 1.5);
    expect(adjusted).toBeCloseTo(1.0 / (1.5 * 1.5), 10); // 1/2.25 ≈ 0.44
  });

  test("neutral reliability (1.0x) → pressure unchanged", () => {
    const adjusted = adjustPressureByReliability(5.0, 1.0);
    expect(adjusted).toBe(5.0);
  });

  test("low reliability (0.5x) → pressure quadruples", () => {
    const adjusted = adjustPressureByReliability(1.0, 0.5);
    expect(adjusted).toBeCloseTo(4.0, 10); // 1/(0.5²) = 4
  });

  test("the full pipeline: reliable agent gets larger optimal window", () => {
    const basePressure = 4;
    const thermLength = 16;

    // Reliable agent (windowMultiplier = 1.5)
    const reliablePressure = adjustPressureByReliability(basePressure, 1.5);
    const reliableCadence = computeOptimalCadence({ thermLength, queuePressure: reliablePressure });

    // Unreliable agent (windowMultiplier = 0.5)
    const unreliablePressure = adjustPressureByReliability(basePressure, 0.5);
    const unreliableCadence = computeOptimalCadence({ thermLength, queuePressure: unreliablePressure });

    // Reliable agent gets a LARGER window (more time, less pressure)
    expect(reliableCadence.optimalWindow).toBeGreaterThan(unreliableCadence.optimalWindow);
  });
});
