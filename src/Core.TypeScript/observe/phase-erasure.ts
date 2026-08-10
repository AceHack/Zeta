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
/**
 * Ceiling on a single recovery span.
 *
 * `targetPhase` reaches these functions from attacker-controlled input (a peer's event
 * file). Unbounded, `recoverForward` allocates one object per phase in the gap and
 * `verifyPhase` ticks once per phase — so a claimed phase of 1e12 is remote heap and CPU
 * exhaustion with a single small message (Kira, 2026-08-10, P1).
 *
 * Refusing beyond the ceiling is correct rather than merely safe: a gap this large is
 * not a recoverable erasure, it is a different problem, and silently grinding through it
 * would answer a question nobody should be asking.
 */
export const MAX_RECOVERY_SPAN = 100_000;

export function recoverForward(
  anchor: PhaseState,
  targetPhase: number,
  maxSpan: number = MAX_RECOVERY_SPAN,
): PhaseState[] {
  if (!Number.isSafeInteger(targetPhase) || !Number.isSafeInteger(anchor.phase)) {
    throw new RangeError("recoverForward: phases must be safe integers");
  }
  if (targetPhase - anchor.phase > maxSpan) {
    throw new RangeError(
      `recoverForward: span ${targetPhase - anchor.phase} exceeds MAX_RECOVERY_SPAN (${maxSpan}); ` +
        "a gap this large is not a recoverable erasure",
    );
  }
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
 *
 * ## TWO DECLARED LIMITS — read before relying on this (2026-08-10)
 *
 * **1. It has NO production callers.** Every call site repo-wide is a test. In
 * particular the resume path in `run-loop-real.ts` reads a persisted `phase.derived`
 * off disk and seeds the clock with it *without* verifying. So this function does not
 * currently protect anything; treating its existence as evidence that phase seeds are
 * authenticated in production is exactly wrong (Kira, 2026-08-10, P1).
 *
 * **2. Its precondition does not hold for resumed clocks.** It checks
 * `seed == f^phase(COMMON_SEED)`, which is only true for a clock that ticked from the
 * common seed unbroken. Resume is *chain-continuation* from the last persisted seed, so
 * a legitimately resumed clock can fail this check. Wiring it into the resume path
 * as-is would reject honest state — which is why that wiring is a design decision, not
 * a bug fix, and is deliberately NOT done here.
 *
 * The bound below is applied regardless, because an uncapped loop over
 * attacker-supplied `claimed.phase` is remote CPU exhaustion whether or not anything
 * calls it today.
 */
export function verifyPhase(claimed: PhaseState, maxSpan: number = MAX_RECOVERY_SPAN): boolean {
  if (!Number.isSafeInteger(claimed.phase) || claimed.phase < 0) return false;
  if (claimed.phase > maxSpan) {
    throw new RangeError(
      `verifyPhase: claimed phase ${claimed.phase} exceeds MAX_RECOVERY_SPAN (${maxSpan})`,
    );
  }
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
