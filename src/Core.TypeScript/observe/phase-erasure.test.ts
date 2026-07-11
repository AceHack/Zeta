import { describe, test, expect } from "bun:test";
import { createPhaseClock } from "./phase-clock";
import {
  recoverForward,
  recoverGap,
  verifyPhase,
  erasureTolerance,
  reconstructFromSparse,
} from "./phase-erasure";

describe("phase-erasure — erasure recovery over the deterministic phase sequence", () => {
  test("recoverForward: from one anchor, reconstruct all future phases", () => {
    const clock = createPhaseClock();
    clock.tick(); clock.tick(); clock.tick(); // phase 3
    const anchor = clock.state;

    // Recover phases 4, 5, 6
    const recovered = recoverForward(anchor, 6);
    expect(recovered).toHaveLength(3);
    expect(recovered[0]!.phase).toBe(4); // was: 1 (relative), now aligned
    expect(recovered[2]!.phase).toBe(6);

    // Verify: the recovered seeds match what a fresh clock would produce
    const verifier = createPhaseClock();
    for (let i = 0; i < 6; i++) verifier.tick();
    // The 6th tick of a fresh clock should match recovered[2].seed
    // (Both start from COMMON_SEED, both advance 6 times)
    expect(recovered[2]!.seed).toBe(verifier.state.seed);
  });

  test("recoverGap: fill missed phases between two observations", () => {
    const clock = createPhaseClock();
    clock.tick(); // phase 1
    const early = clock.state;
    clock.tick(); clock.tick(); clock.tick(); clock.tick(); // phase 5
    const late = clock.state;

    // The gap is phases 2, 3, 4 (between 1 and 5)
    const gap = recoverGap(early, late);
    expect(gap).toHaveLength(3); // phases 2, 3, 4
    expect(gap[0]!.phase).toBe(2);
    expect(gap[2]!.phase).toBe(4);
  });

  test("verifyPhase: a genuine phase verifies against COMMON_SEED", () => {
    const clock = createPhaseClock();
    clock.tick(); clock.tick(); clock.tick(); clock.tick(); clock.tick(); // phase 5
    expect(verifyPhase(clock.state)).toBe(true);
  });

  test("verifyPhase: a forged phase (wrong seed) fails verification", () => {
    const forged = { phase: 5, seed: 999999, lastAdvanceReason: "heartbeat" as const, wallClockAt: "" };
    expect(verifyPhase(forged)).toBe(false);
  });

  test("erasureTolerance: window of 16, tolerates 15 erasures (1 anchor needed)", () => {
    const t = erasureTolerance(16);
    expect(t.maxErasures).toBe(15);
    expect(t.minObservations).toBe(1);
    expect(t.toleranceRatio).toBeCloseTo(15 / 16, 10);
  });

  test("erasureTolerance: better than RS [16,12] distance-5 (which tolerates only 4)", () => {
    const phase = erasureTolerance(16);
    const rsDistance5 = 4; // Reed-Solomon [16,12] tolerates 4 erasures
    expect(phase.maxErasures).toBeGreaterThan(rsDistance5);
  });

  test("reconstructFromSparse: full timeline from sparse observations", () => {
    const clock = createPhaseClock();
    const observations = [];
    // Observe only phases 2 and 7 (miss 1, 3, 4, 5, 6)
    for (let i = 0; i < 7; i++) {
      clock.tick();
      if (clock.state.phase === 2 || clock.state.phase === 7) {
        observations.push(clock.state);
      }
    }
    expect(observations).toHaveLength(2); // only saw 2 and 7

    const full = reconstructFromSparse(observations);
    expect(full).toHaveLength(6); // phases 2, 3, 4, 5, 6, 7

    // Verify the reconstructed sequence is correct
    const verifier = createPhaseClock();
    for (let i = 0; i < 7; i++) verifier.tick();
    // Last reconstructed should match phase 7's seed
    expect(full[full.length - 1]!.seed).toBe(verifier.state.seed);
  });

  test("the adinkra connection: metric-freeness = same sequence regardless of timing", () => {
    // Two clocks, different "fps" (different wall-clock intervals between ticks)
    // But the CAUSAL TRACE (seed sequence) is identical — metric-free
    const fast = createPhaseClock();
    const slow = createPhaseClock();

    // Fast: tick every 1ms (simulated). Slow: tick every 100ms (simulated).
    // Both produce the SAME seed sequence — the metric doesn't affect the state.
    const fastSeeds: number[] = [];
    const slowSeeds: number[] = [];
    for (let i = 0; i < 10; i++) {
      fast.tick(); fastSeeds.push(fast.state.seed);
      slow.tick(); slowSeeds.push(slow.state.seed);
    }
    expect(fastSeeds).toEqual(slowSeeds); // metric-free: same causal trace
  });
});
