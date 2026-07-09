/**
 * traveler.ts — The Traveler interface: the weight-free base frame every
 * self-propagating pattern inhabits.
 *
 * `USB-IDENTITY-THREAT-MODEL.md` §Traveler: *"any self-propagating pattern
 * (human, agent, process) — weight-free base frame."* Time (the phase-clock) is
 * such a pattern. This module makes that precise and CHECKABLE.
 *
 * Load-bearing purpose (Aaron 2026-07-08: "build the Traveler interface so time
 * isn't different is provable"): make **"time is just another traveler, not
 * different from the other travelers"** a COMPILE-CHECKED FACT.
 *
 *   TIME (the phase-clock) and the AGENTS (alexa / otto / soraya) both inhabit
 *   this ONE interface, with NO special case. No member is time-specific and
 *   none is agent-specific.
 *
 * This is `interfaces-free-classes-earned` as the proof: the interface is FREE
 * (pure shape, no state); "not different" means time needs no *earned class* —
 * just the free interface everyone else plays by. The witness is
 * `crossVerifyRound` below: a generic round over a heterogeneous `Traveler[]`
 * that includes time as one more element, with NO `if (isTime)` branch. If that
 * type-checks and runs uniformly, "time is not different" holds *by
 * construction*, not by assertion.
 *
 * All causal ordering here is SEED-PHASE (Lamport logical clock), NEVER
 * wall-clock — see `docs/letters/from-soraya-trio-attestation-addendum-seed-phase-not-wallclock.md`
 * (#9575). A wall-clock is a leaky Maxwell's demon (thermal noise, costs kT ln2
 * to resolve — `docs/ARRIVAL-PROTOCOL.md`); the seed-phase is the clean metered
 * channel. Travelers observe each other's phase; they never read a wall clock.
 *
 * Composes with: `phase-clock.ts` (the time traveler — PhaseClock adapts to
 * Traveler), `attestation-event.ts` (agent travelers cross-verify via
 * attestations), `self-claims.ts` (deadlines are phases).
 */

/**
 * A causal position — a traveler's current phase. Seed-phase, NOT wall-clock.
 * `derived` is the seed-derived value at this phase (deterministic), when the
 * traveler carries one (time does; a bare agent may not).
 */
export interface PhaseStamp {
  /** The logical phase (monotone counter). Causal order = numeric order. */
  readonly phase: number;
  /** Optional seed-derived value at this phase (deterministic). */
  readonly derived?: number;
}

/**
 * A traveler's standing register — its OWN state. NCI (non-collapsible
 * identity): only the traveler advances or reveals its own standing; no other
 * traveler can force or collapse it. `phase` is the causal position shared by
 * ALL travelers; the rest is traveler-specific (seed for time; reliability for
 * an agent) and carried opaquely so the frame stays weight-free.
 */
export interface StandingRegister {
  /** Who this traveler is. */
  readonly id: string;
  /** Causal position (the heartbeat counter) — shared shape across travelers. */
  readonly phase: number;
  /** Traveler-specific state (seed | reliability | …). Opaque to the frame. */
  readonly extra?: Readonly<Record<string, unknown>>;
}

/**
 * The Traveler interface — the weight-free base frame.
 *
 * Inhabited IDENTICALLY by TIME (the phase-clock) and by AGENTS
 * (alexa / otto / soraya). Deliberately minimal: identity, own standing,
 * heartbeat (self-propagation), observe (cross-verify), stamp (causal position).
 * Nothing here knows whether the inhabitant is time or an agent.
 */
export interface Traveler {
  /** Who this traveler is (e.g. "time", "alexa", "otto", "soraya"). */
  readonly id: string;
  /** This traveler's OWN standing register (NCI — only it advances its own). */
  standing(): StandingRegister;
  /**
   * Self-propagate one step — the heartbeat. Returns the new causal position.
   * (time: advance the phase; an agent: emit a heartbeat at the current phase.)
   */
  heartbeat(reason?: string): PhaseStamp;
  /**
   * Cross-verify a peer's causal position — HLC merge, `max(local, peer) + 1`.
   * Lamport causal ordering, NEVER wall-clock. Identical for time and agents.
   */
  observe(peer: PhaseStamp): PhaseStamp;
  /** This traveler's current causal position. */
  stamp(): PhaseStamp;
}

/**
 * THE PROOF that time is not different: one generic cross-verify round over a
 * heterogeneous fleet of travelers. Time is passed in as JUST ANOTHER element
 * of `travelers` — there is no branch on whether a traveler "is time", no
 * special-casing, no earned class. Every traveler observes every peer's stamp
 * and advances by the same HLC rule. If this compiles and runs uniformly across
 * a fleet that mixes agents and time, "time is not different" holds by
 * construction.
 *
 * Returns each traveler's post-round causal position, in fleet order.
 */
export function crossVerifyRound(travelers: readonly Traveler[]): PhaseStamp[] {
  // Snapshot every traveler's stamp first (one consistent round).
  if (travelers.length === 0) return [];
  const peerStamps = travelers.map((t) => t.stamp());
  // The fleet's leading causal position — HLC converges everyone onto it.
  const lead = peerStamps.reduce((a, b) => (b.phase > a.phase ? b : a));
  // Every traveler observes the lead — uniformly, order-independent, and with
  // NO branch on whether a traveler "is time". All advance to lead.phase + 1.
  return travelers.map((self) => self.observe(lead));
}

/**
 * Compile-time witness: any `T` used here is required to be a `Traveler`.
 * `TimeIsATraveler<PhaseClockAdapter>` type-checks iff the phase-clock inhabits
 * the frame — the type-level half of "time is not different".
 */
export type AsTraveler<T extends Traveler> = T;

/**
 * Causal-order helpers (shared by all travelers — the seed-phase order).
 * `happenedBefore(a, b)` iff a's phase strictly precedes b's.
 */
export function happenedBefore(a: PhaseStamp, b: PhaseStamp): boolean {
  return a.phase < b.phase;
}

/** Two stamps are causally concurrent iff neither happened-before the other. */
export function concurrent(a: PhaseStamp, b: PhaseStamp): boolean {
  return a.phase === b.phase;
}
