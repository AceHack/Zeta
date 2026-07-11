/**
 * phase-clock.ts — Time as a 4th traveler (the phase generator).
 *
 * Time is not ambient infrastructure — it's a PARTICIPANT with its own state,
 * its own standing register, and its own heartbeat (the phase advance). In
 * deterministic simulation (DST), time's "motive" is the test harness. Across
 * planets, each locality observes time's phase independently.
 *
 * WHY DETERMINISTIC AGREED TIME MATTERS (the Maxwell's demon connection):
 * The demon's measurement problem: it needs to know "fast vs slow RIGHT NOW."
 * Without a shared, consistent notion of "now," each agent sorts against its
 * own local clock and the system drifts. Agreed deterministic time solves this:
 * - The demon's sort decisions are REPRODUCIBLE (verify after the fact from the log)
 * - The CPT fixed point (0) is the agreed timestamp (not abstract)
 * - Landauer cost is paid ONCE at the clock tick (not separately per agent)
 * - T-reversal is reconstructible from the append-only log (fold in reverse)
 * - The approximation IS sufficient: CPT doesn't need exact, just consistent
 *   within the bounded clock skew (HLC convergence guarantees this)
 *
 * Design anchors:
 * - CockroachDB HLC (hybrid logical clock: physical + logical counter)
 * - TimeWarp (Jeff Dean's time-warp time, virtual time in simulation)
 * - IScheduler (the injected time source — time IS a generator function)
 * - Lamport logical clocks (causal ordering, not total ordering)
 * - Relativity: no global wall-clock across planets (lightcone delay)
 *
 * The phase clock provides:
 * 1. A monotone phase counter (logical tick — the "time heartbeat")
 * 2. A seed derivation (deterministic from the common seed S=4)
 * 3. Causal ordering (phase1 < phase2 means phase1 happened-before phase2)
 * 4. HLC semantics: max(local_phase, observed_phase) + 1 on each event
 *    (handles clock skew between planets without wall-clock)
 *
 * Time's standing register:
 * - currentPhase: the latest phase this node has observed/generated
 * - seed: the generator state (deterministic, reproducible)
 * - lastAdvanceReason: why time advanced ("heartbeat", "observed-peer", "manual")
 *
 * Composes with:
 * - src/Core.TypeScript/observe/event-sink-folder.ts (events carry phase)
 * - src/Core.TypeScript/observe/self-claims.ts (deadlines are phases, not wall-clock)
 * - src/Core.TypeScript/observe/attestation-event.ts (windows are phase ranges)
 * - src/Core.TLA/specs/PredictiveLookahead.tla (tick = phase advance)
 * - The NonRegisterCollapse proof (time has a standing register that survives merge)
 */

// ═══ The Phase Clock (Time's Standing Register) ════════════════════════════════

export interface PhaseState {
  /** The current logical phase (monotone counter). */
  readonly phase: number;
  /** The seed state for deterministic derivation. */
  readonly seed: number;
  /** Why the phase last advanced. */
  readonly lastAdvanceReason: "heartbeat" | "observed-peer" | "manual" | "init";
  /** The wall-clock at last advance (human readability only — NOT the semantics). */
  readonly wallClockAt: string;
}

export interface PhaseClock {
  /** Current state (time's standing register). */
  readonly state: PhaseState;
  /** Advance the phase by one tick (time's heartbeat). */
  tick(reason?: "heartbeat" | "manual"): PhaseState;
  /** Observe a peer's phase — advance to max(local, peer) + 1 if peer is ahead.
   *  This is the HLC merge: handles cross-planet clock skew without wall-clock. */
  observe(peerPhase: number): PhaseState;
  /** Derive a deterministic value from the current phase + seed (for reproducibility). */
  derive(): number;
}

/**
 * The common seed (S=4, per the ADR). All agents derive the same phase sequence
 * from this seed. The seed is a Lamport logical clock — correlation via
 * Reichenbach common cause (the shared seed), not wall-clock simultaneity.
 */
export const COMMON_SEED = 4;

/**
 * Create a phase clock. This IS time's traveler state for one node.
 *
 * Multi-planet: each node has its own PhaseClock. They converge via `observe()`
 * — when you hear a peer's phase, you advance to max(yours, theirs) + 1.
 * This guarantees causal ordering without global time.
 *
 * In DST (deterministic simulation): the clock only advances when the test
 * harness calls `tick()` — time's motive is controlled by the test.
 */
export function createPhaseClock(initialSeed: number = COMMON_SEED): PhaseClock {
  let phase = 0;
  let seed = initialSeed;
  let lastAdvanceReason: PhaseState["lastAdvanceReason"] = "init";
  let wallClockAt = new Date().toISOString();

  // Simple deterministic PRNG (xorshift32) for seed derivation
  function xorshift(s: number): number {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return s >>> 0; // ensure unsigned 32-bit
  }

  function advance(reason: PhaseState["lastAdvanceReason"]): PhaseState {
    phase += 1;
    seed = xorshift(seed);
    lastAdvanceReason = reason;
    wallClockAt = new Date().toISOString();
    return { phase, seed, lastAdvanceReason, wallClockAt };
  }

  return {
    get state(): PhaseState {
      return { phase, seed, lastAdvanceReason, wallClockAt };
    },

    tick(reason: "heartbeat" | "manual" = "heartbeat"): PhaseState {
      return advance(reason);
    },

    observe(peerPhase: number): PhaseState {
      if (peerPhase >= phase) {
        // Peer is ahead or equal — jump to their phase + 1
        // This is the HLC "max + 1" rule: ensures causal ordering
        phase = peerPhase;
        return advance("observed-peer");
      }
      // We're already ahead — no advance needed (but still record the observation)
      return { phase, seed, lastAdvanceReason, wallClockAt };
    },

    derive(): number {
      return seed;
    },
  };
}

// ═══ Phase-Stamped Event Envelope ══════════════════════════════════════════════

/**
 * The phase stamp to add to every event envelope.
 * This replaces wall-clock `at` as the SEMANTIC time coordinate.
 * `at` stays for human readability; `phase` is what the math operates on.
 */
export interface PhaseStamp {
  /** The logical phase at which this event was produced. */
  readonly phase: number;
  /** The seed-derived value at this phase (for deterministic replay). */
  readonly derived: number;
}

/**
 * Stamp an event with the current phase. Call this before appending to the sink.
 */
export function stampPhase(clock: PhaseClock): PhaseStamp {
  const state = clock.state;
  return { phase: state.phase, derived: clock.derive() };
}

// ═══ Causal Ordering ═══════════════════════════════════════════════════════════

/**
 * Causal comparison: did event A happen-before event B?
 * In phase semantics: A.phase < B.phase ⟹ A happened-before B.
 * A.phase == B.phase ⟹ concurrent (neither happened-before the other).
 */
export function happenedBefore(a: PhaseStamp, b: PhaseStamp): boolean {
  return a.phase < b.phase;
}

/**
 * Are two events concurrent (neither happened-before the other)?
 * Same phase = same logical moment. Both are valid attestors of that phase.
 */
export function concurrent(a: PhaseStamp, b: PhaseStamp): boolean {
  return a.phase === b.phase;
}

/**
 * Merge two phase stamps (take the max — the HLC principle).
 * Used when combining information from two sources.
 */
export function mergePhase(a: PhaseStamp, b: PhaseStamp): PhaseStamp {
  return a.phase >= b.phase ? a : b;
}
