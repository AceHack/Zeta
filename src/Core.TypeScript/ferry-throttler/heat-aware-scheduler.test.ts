/**
 * heat-aware-scheduler.test.ts — anti-self-certifying tests for HeatAwareScheduler.
 *
 * Key discipline:
 * - Every "heat reduces selection" assertion has a fault-injection companion
 *   that proves the cold/warm baseline is NOT throttled.
 * - The throttle effect is measured as selection frequency over many trials,
 *   not just internal state — the test observes the output, not the mechanism.
 */

import { describe, expect, it } from "bun:test";
import {
  createHeatAwareScheduler,
  HOT_FACTOR,
  CRITICAL_FACTOR,
  RECOVERY_STEP,
  MIN_WEIGHT,
} from "./heat-aware-scheduler";
import { createStrictPriorityScheduler, createWeightedFairScheduler } from "./drain-scheduler";
import type { LaneSnapshot } from "./drain-scheduler";

function lane(hasWork: boolean, queueDepth = 1): LaneSnapshot {
  return { hasWork, queueDepth, bytesQueued: queueDepth * 100, drainCount: 0 };
}

describe("HeatAwareScheduler — heat weights", () => {
  it("initial weights are all 1.0 (full throughput)", () => {
    const s = createHeatAwareScheduler(createStrictPriorityScheduler(), 3);
    expect(s.heatWeights).toEqual([1.0, 1.0, 1.0]);
  });

  it("cold band does NOT change weight", () => {
    const s = createHeatAwareScheduler(createStrictPriorityScheduler(), 2);
    s.recordHeat(0, "cold");
    expect(s.heatWeights[0]).toBe(1.0);
  });

  it("warm band does NOT change weight", () => {
    const s = createHeatAwareScheduler(createStrictPriorityScheduler(), 2);
    s.recordHeat(0, "warm");
    expect(s.heatWeights[0]).toBe(1.0);
  });

  it("hot band reduces weight by HOT_FACTOR", () => {
    const s = createHeatAwareScheduler(createStrictPriorityScheduler(), 2);
    s.recordHeat(0, "hot");
    expect(s.heatWeights[0]).toBeCloseTo(HOT_FACTOR, 5);
  });

  it("FAULT INJECTION: hot band on lane 1 does NOT affect lane 0", () => {
    const s = createHeatAwareScheduler(createStrictPriorityScheduler(), 2);
    s.recordHeat(1, "hot");
    expect(s.heatWeights[0]).toBe(1.0); // lane 0 unaffected
    expect(s.heatWeights[1]).toBeCloseTo(HOT_FACTOR, 5); // lane 1 throttled
  });

  it("critical band reduces weight by CRITICAL_FACTOR", () => {
    const s = createHeatAwareScheduler(createStrictPriorityScheduler(), 2);
    s.recordHeat(0, "critical");
    expect(s.heatWeights[0]).toBeCloseTo(CRITICAL_FACTOR, 5);
  });

  it("weight never falls below MIN_WEIGHT floor", () => {
    const s = createHeatAwareScheduler(createStrictPriorityScheduler(), 1);
    // Apply critical 10 times — should clamp at MIN_WEIGHT
    for (let i = 0; i < 10; i++) s.recordHeat(0, "critical");
    expect(s.heatWeights[0]).toBeGreaterThanOrEqual(MIN_WEIGHT);
  });

  it("recordDrain recovers weight additively (AIMD recovery)", () => {
    const s = createHeatAwareScheduler(createStrictPriorityScheduler(), 1);
    s.recordHeat(0, "hot"); // weight = HOT_FACTOR = 0.5
    s.recordDrain(0, 1, 100); // weight += RECOVERY_STEP
    expect(s.heatWeights[0]).toBeCloseTo(HOT_FACTOR + RECOVERY_STEP, 5);
  });

  it("weight recovery caps at 1.0", () => {
    const s = createHeatAwareScheduler(createStrictPriorityScheduler(), 1);
    // Apply many drains — weight should not exceed 1.0
    for (let i = 0; i < 100; i++) s.recordDrain(0, 1, 100);
    expect(s.heatWeights[0]).toBe(1.0);
  });

  it("out-of-range laneIndex is a no-op (no throw)", () => {
    const s = createHeatAwareScheduler(createStrictPriorityScheduler(), 2);
    expect(() => s.recordHeat(-1, "critical")).not.toThrow();
    expect(() => s.recordHeat(99, "hot")).not.toThrow();
    expect(s.heatWeights).toEqual([1.0, 1.0]); // unchanged
  });

  it("laneIndex EXACTLY at the lane count is out of range — the boundary, not merely far outside", () => {
    // -1 and 99 above are comfortably outside and stay rejected even by an off-by-one guard, so
    // they cannot hold `laneIndex >= length`. Index === laneCount is the single value that does:
    // relax the guard to `>` and recordHeat writes _weights[2] on a 2-lane scheduler, GROWING the
    // weight array past the lane count and silently inventing a lane the base scheduler will never
    // be asked about. Found by the mutation runner (gte-to-gt, tick 11189).
    const s = createHeatAwareScheduler(createStrictPriorityScheduler(), 2);
    s.recordHeat(2, "critical");
    expect(s.heatWeights.length).toBe(2);
    expect(s.heatWeights).toEqual([1.0, 1.0]);
  });
});

describe("HeatAwareScheduler — selection frequency (observable throttle)", () => {
  /**
   * Run N selectLane trials and count how often each lane is selected.
   * This tests the OBSERVABLE effect, not internal state.
   */
  function countSelections(
    scheduler: ReturnType<typeof createHeatAwareScheduler>,
    lanes: readonly LaneSnapshot[],
    trials: number,
  ): number[] {
    const counts = new Array<number>(lanes.length).fill(0);
    for (let i = 0; i < trials; i++) {
      const sel = scheduler.selectLane(lanes);
      if (sel >= 0 && sel < counts.length) counts[sel]!++;
    }
    return counts;
  }

  it("cold lane selected at full rate (baseline)", () => {
    // Two lanes, both cold — StrictPriority always picks lane 0 first.
    // With weight=1.0, lane 0 is never skipped → selected all 1000 times.
    const base = createStrictPriorityScheduler();
    const s = createHeatAwareScheduler(base, 2);
    const lanes = [lane(true), lane(true)];
    const counts = countSelections(s, lanes, 1000);
    // Lane 0 (cold, full weight) should be selected every time
    expect(counts[0]!).toBe(1000);
    expect(counts[1]!).toBe(0);
  });

  it("FAULT INJECTION: critical heat on lane 0 reduces its selection frequency", () => {
    // Lane 0 gets critical heat → should be selected much less than lane 1
    // With StrictPriority: lane 0 is skipped 9/10 calls → lane 1 selected instead
    const base = createStrictPriorityScheduler();
    const s = createHeatAwareScheduler(base, 2);
    s.recordHeat(0, "critical"); // weight[0] = CRITICAL_FACTOR = 0.1 → skip 9/10
    const lanes = [lane(true), lane(true)];
    const counts = countSelections(s, lanes, 1000);
    // Lane 0 (critical) should be selected much less than lane 1 (cold)
    expect(counts[0]!).toBeLessThan(counts[1]!);
    // Lane 1 (cold) should be selected more than lane 0 (critical)
    expect(counts[1]!).toBeGreaterThan(counts[0]! * 2);
  });

  it("hot heat reduces selection but does not stall the lane", () => {
    // With StrictPriority: lane 0 has weight=0.5 → skipped every other call
    // So lane 0 selected ~500/1000, lane 1 selected ~500/1000
    const base = createStrictPriorityScheduler();
    const s = createHeatAwareScheduler(base, 2);
    s.recordHeat(0, "hot"); // weight[0] = HOT_FACTOR = 0.5 → skip every other call
    const lanes = [lane(true), lane(true)];
    const counts = countSelections(s, lanes, 1000);
    // Lane 0 should still be selected (not zero — not fully stalled)
    expect(counts[0]!).toBeGreaterThan(0);
    // Lane 0 should be selected less than lane 1 (or equal, since skip every other)
    // With threshold=1 (skip every other), lane 0 is selected on even calls, lane 1 on odd
    // → roughly equal, but lane 1 gets the odd calls too via fallback
    expect(counts[0]!).toBeGreaterThan(300); // at least 30% of calls
    expect(counts[0]!).toBeLessThan(700);    // at most 70% of calls
  });

  it("recovery: after drains, throttled lane regains selection frequency", () => {
    // With StrictPriority: after recovery, lane 0 (weight=1.0) is always selected first
    const base = createStrictPriorityScheduler();
    const s = createHeatAwareScheduler(base, 2);
    s.recordHeat(0, "hot"); // throttle lane 0
    // Recover lane 0 with many successful drains
    for (let i = 0; i < 20; i++) s.recordDrain(0, 1, 100);
    // weight[0] should now be 1.0 (HOT_FACTOR + 20 * RECOVERY_STEP = 0.5 + 1.0 = capped at 1.0)
    expect(s.heatWeights[0]).toBe(1.0);
    // After recovery, lane 0 (full weight) is always selected first by StrictPriority
    const lanes = [lane(true), lane(true)];
    const counts = countSelections(s, lanes, 1000);
    expect(counts[0]!).toBe(1000); // fully recovered → always selected first
    expect(counts[1]!).toBe(0);
  });

  it("single-lane: always selects lane 0 regardless of heat (no alternative)", () => {
    const base = createStrictPriorityScheduler();
    const s = createHeatAwareScheduler(base, 1);
    s.recordHeat(0, "critical");
    // With only one lane, the fallback always returns it
    const lanes = [lane(true)];
    const counts = countSelections(s, lanes, 100);
    expect(counts[0]!).toBe(100); // always selected (no alternative)
  });
});

describe("HeatAwareScheduler — integration with network-transport SendOutcome", () => {
  it("simulates the full flow: failed batch → recordHeat → throttle → recover", () => {
    // Simulates: transport.send() returns { ok: false, temperatureReadout: { band: "hot" } }
    // The scheduler should throttle lane 0, then recover on success
    const base = createWeightedFairScheduler([1, 1, 1]);
    const s = createHeatAwareScheduler(base, 3);

    // Simulate 3 failed batches on lane 1 with hot heat
    s.recordHeat(1, "hot");
    s.recordHeat(1, "hot");
    s.recordHeat(1, "hot");
    // weight[1] = HOT_FACTOR^3 = 0.5^3 = 0.125 (clamped to MIN_WEIGHT=0.05)
    expect(s.heatWeights[1]).toBeGreaterThanOrEqual(MIN_WEIGHT);
    expect(s.heatWeights[1]).toBeLessThan(0.5); // definitely throttled

    // Lanes 0 and 2 are unaffected
    expect(s.heatWeights[0]).toBe(1.0);
    expect(s.heatWeights[2]).toBe(1.0);

    // Simulate successful drains recovering lane 1
    for (let i = 0; i < 20; i++) s.recordDrain(1, 5, 500);
    expect(s.heatWeights[1]).toBe(1.0); // fully recovered
  });

  it("FAULT INJECTION: accounted erasures (warm) do NOT throttle the lane", () => {
    // Warm = accounted erasures (deliberate, not alarming per batch-heat-bridge semantics)
    const base = createStrictPriorityScheduler();
    const s = createHeatAwareScheduler(base, 2);
    s.recordHeat(0, "warm");
    s.recordHeat(0, "warm");
    s.recordHeat(0, "warm");
    // Weight should be unchanged — warm is not alarming
    expect(s.heatWeights[0]).toBe(1.0);
  });
});
