/**
 * phase-erasure.ts — Erasure recovery over the phase clock sequence.
 *
 * The phase clock's xorshift is a LINEAR RECURRENCE over GF(2). Any linear
 * recurrence over a finite field defines a cyclic code whose minimum distance
 * tells you how many phases can be missed and still reconstructed.
 *
 * Connection to AdinkraClock.fs:
 * - AdinkraClock: Q² = ∂_τ (one round-trip = one clock tick, intrinsic to the graph)
 * - Phase clock: xorshift step = one Q move through GF(2) (one field transition)
 * - Both: the causal trace is metric-free (invariant under fps/clock rescale)
 * - Both: the tick count is computable without a scheduler (layer B)
 *
 * Erasure recovery works because:
 * 1. The xorshift sequence is DETERMINISTIC from any known state
 * 2. Given any ONE observed phase + its seed, ALL subsequent phases are derivable
 * 3. Given any TWO observed phases, the GAP between them is computable
 * 4. Missed phases are exactly the gap — fill forward from the earlier observation
 *
 * This is SIMPLER than Reed-Solomon (we don't need the full RS decoding machinery)
 * because the "code" here is a deterministic sequence from a seed — any single
 * observation anchors the entire future. The "distance" is effectively infinite:
 * you can recover from ANY number of erasures given ONE anchor point.
 *
 * The practical limit: if you miss ALL phases (no anchor), you can't recover.
 * But one observation of any phase in the sequence is sufficient to reconstruct
 * everything forward and verify everything backward (the xorshift is invertible).
 *
 * Composes with:
 *   - src/Core.TypeScript/observe/phase-clock.ts (the sequence generator)
 *   - src/Core/AdinkraClock.fs (the same structure in F#, metric-freeness proven)
 *   - src/Core.Lean4/ImaginaryStack/ErasureDistance.lean (the full RS proof)
 */

import { createPhaseClock, COMMON_SEED, type PhaseState } from "./phase-clock";

// ═══ Forward Recovery: fill gaps from a known anchor ════════════════════════════

/**
 * Given an observed phase state (an anchor), recover all phases from that
 * point forward up to `targetPhase`. Returns the full sequence including
 * the phases that were missed.
 *
 * This works because xorshift is deterministic: from any (phase, seed) pair,
 * the entire future is computable. One observation = infinite forward recovery.
 */
export function recoverForward(anchor: PhaseState, targetPhase: number): PhaseState[] {
  // Start a clock seeded with the anchor's seed — this produces the correct
  // subsequent seeds. We label phases starting from anchor.phase + 1.
  const clock = createPhaseClock(anchor.seed);
  const recovered: PhaseState[] = [];
  for (let p = anchor.phase + 1; p <= targetPhase; p++) {
    clock.tick("heartbeat");
    recovered.push({ ...clock.state, phase: p });
  }
  return recovered;
}

/**
 * Given two observed phases (not necessarily consecutive), compute the
 * gap between them and recover the missed phases in between.
 */
export function recoverGap(earlier: PhaseState, later: PhaseState): PhaseState[] {
  if (later.phase <= earlier.phase) return []; // no gap (or backwards)
  return recoverForward(earlier, later.phase - 1);
}

// ═══ Backward Verification: verify a claimed phase against the seed ═════════════

/**
 * Verify: does a claimed phase state match the expected sequence?
 * Given the common seed and a claimed (phase, seed) pair, verify that
 * running the xorshift `phase` times from COMMON_SEED produces the claimed seed.
 *
 * This is the backward verification: you don't need to have observed every
 * intermediate phase — just verify the endpoint against the known start.
 */
export function verifyPhase(claimed: PhaseState): boolean {
  const clock = createPhaseClock(COMMON_SEED);
  for (let i = 0; i < claimed.phase; i++) {
    clock.tick("heartbeat");
  }
  return clock.state.seed === claimed.seed;
}

// ═══ Erasure Tolerance Metric ═══════════════════════════════════════════════════

/**
 * Compute the erasure tolerance of the phase sequence:
 * given a window of N phases, how many can be missed while still being
 * able to reconstruct the full window?
 *
 * Answer: N-1 (you only need ONE observation to recover all others).
 * This is because the sequence is fully deterministic from any anchor.
 *
 * Compared to Reed-Solomon [16,12] (distance 5, tolerates 4 erasures):
 * the phase clock's tolerance is BETTER — it tolerates N-1 erasures in
 * a window of N, because one anchor reconstructs everything.
 *
 * The trade-off: RS works with INDEPENDENT symbols; our sequence has
 * DEPENDENCIES (each phase determines the next). The "code" is maximally
 * redundant — every symbol encodes the entire future.
 */
export function erasureTolerance(windowSize: number): {
  windowSize: number;
  maxErasures: number;
  minObservations: number;
  toleranceRatio: number;
} {
  return {
    windowSize,
    maxErasures: windowSize - 1, // N-1 (one anchor needed)
    minObservations: 1,           // just one is enough
    toleranceRatio: (windowSize - 1) / windowSize, // approaches 1 as N grows
  };
}

// ═══ Practical: from sparse observations, reconstruct full history ═══════════════

/**
 * Given a sparse set of observed phases (with gaps), reconstruct the full
 * sequence by filling forward from each anchor.
 *
 * Returns the complete timeline from the earliest observation to the latest.
 */
export function reconstructFromSparse(observations: readonly PhaseState[]): PhaseState[] {
  if (observations.length === 0) return [];

  // Sort by phase number
  const sorted = [...observations].sort((a, b) => a.phase - b.phase);
  const earliest = sorted[0]!;
  const latest = sorted[sorted.length - 1]!;

  // Fill from the earliest observation forward to the latest
  const full: PhaseState[] = [earliest];
  const clock = createPhaseClock(earliest.seed);

  for (let p = earliest.phase + 1; p <= latest.phase; p++) {
    clock.tick("heartbeat");
    full.push({ ...clock.state, phase: p });
  }

  return full;
}
