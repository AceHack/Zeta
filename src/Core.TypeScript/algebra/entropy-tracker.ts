/**
 * src/Core.TypeScript/algebra/entropy-tracker.ts — Two-ledger Maxwell-Demon entropy counter.
 *
 * Tracks the thermodynamic cost of computation per the Landauer/Bennett model:
 * - Ledger A (state): bits of uncertainty in the quantum/soft state (support)
 * - Ledger B (heat): bits irreversibly discharged to the environment (Landauer)
 *
 * The Adj functor IS the gate between ledgers:
 * - Adj ops (soft observations): stay in Ledger A (reversible, zero heat)
 * - non-Adj ops (measurements/commits): discharge from A to B (irreversible, heat paid)
 *
 * Bennett: reversible ops have net = 0 (no heat for Adj operations)
 * Landauer: erasure costs >= kT.ln2 per bit (the floor for non-Adj operations)
 *
 * This is the injected effect (§13 metered door) — NOT an ambient mutable.
 * Same discipline as cost-counter.ts.
 *
 * ## What this module is, and is not (audited 2026-08-13)
 *
 * It is an **accounting ledger**: it counts bits in normalized units. It is **not a physical
 * meter**: there is no joule, no temperature, and no instrument anywhere in it, and no quantity
 * here has ever been measured against the world. A claim resting on this tracker is strictly
 * weaker than one resting on a measurement, and treating the two as interchangeable is the
 * physics-as-metaphor failure the metering test exists to catch
 * (`.claude/rules/anchor-to-human-prior-art.md`).
 *
 * ## Why there is no Landauer *check* here, and what replaced it (2026-08-13, Soraya)
 *
 * `measure(k)` pays exactly `k` bits of heat, and the floor in normalized units is exactly
 * `k x 1`. So heat and floor are the same number by construction and **no comparison between
 * them can ever fail**. The previous `verifyLandauer` performed that comparison and returned
 * `holds: true` forever — a check occupying the slot where a real one would go. The honest fix
 * is not a stricter comparison (there is nothing to compare) but a **narrower claim**: this
 * module reports accounting identities plus a small set of invariants that genuinely can be
 * false. `verifyLandauer` is gone; `auditEntropyLedger` replaces it and reports each fact under
 * its own name, with no aggregate boolean — the aggregate is where the vacuity hid.
 *
 * Three vacuities were measured before the change (all reproducible on the pre-change file):
 *
 * 1. `verifyLandauer().holds` compared `entropy_heat` against `entropy_heat` — `x >= x`.
 * 2. `second_law_satisfied` tested `entropy_state + entropy_heat >= 0`. That sum is changed by
 *    **no operation except `branch` (+1)** — `measure(k)` moves `k` from one ledger to the
 *    other and leaves the sum alone, for every `k` including negative and oversized ones. An
 *    exhaustive sweep of every operation sequence up to length 5 over the full alphabet
 *    (including `measure(-3)` and `measure(9999)`) produced the value `false` **zero times**.
 *    The field was the literal `true` wearing a physics name. It now reports heat monotonicity
 *    (delta-B >= 0), which the same sweep does falsify.
 * 3. Consequently `holds` reduced to `entropy_heat >= 0` — the only falsifiable thing in it.
 *
 * ## Precondition: erasing bits that were never admitted is ALLOWED, and reported
 *
 * `measure(k)` does not require that `k` bits were previously admitted via `branch()`, and it
 * is **deliberately not guarded**, because the guard would break shipped callers that do
 * exactly this:
 *
 * - `physics-traits.ts` `createNonAdjMap.put/delete` calls `measure(...)` with no preceding
 *   `branch()` — three ordinary operations drive `entropy_state` negative. Still true as of
 *   2026-08-14; only the bit count changed (it is derived now, not the literal `1`).
 * - `observe/event-sink-folder.ts` **no longer does this.** It called `entropy.measure(1)` per
 *   append and stamped the resulting negative `entropy_state` into durable event envelopes. The
 *   append is an append-only G-Set write — injective, so nothing is erased — and the charge is
 *   now a derived `0`. The bits it used to erase without admitting were never destroyed by it;
 *   the collapse it was charging for happens in the chooser, upstream, and is now supplied
 *   explicitly via `decisionCandidates` when a caller knows the menu size.
 *
 * Those callers erase uncertainty drawn from an ambient possibility space this tracker never
 * saw. That is a §13 noninterference gap on the **caller** side (entropy entering through an
 * undeclared door), not an arithmetic bug here, and rejecting it would turn a reporting problem
 * into an outage. So the deficit is **named and reported** —
 * `auditEntropyLedger().unadmittedErasureBits` — and the caller oracle decides whether a
 * mid-stream tracker is legitimate or a modelling defect. `key-erasure-meter.ts` is the guarded
 * path for callers that want admission enforced.
 *
 * ## The input was asserted too, and now is not (2026-08-14)
 *
 * Repairing `verifyLandauer` fixed the **instrument**; `measure(bitsErased)` still took its bit
 * count on trust, and every shipped caller handed it a constant. A sound meter with an asserted
 * input is the same defect one layer in. The number is now derived from the operation —
 * `erasure-derivation.ts`, `bits = log2(largest fibre)`, the same rule
 * `WSet.ErasureClassification.Laws.Tests.fs` uses on the F# side — and two of the shipped charges
 * turned out to be pointed at **bijections** (`FerryQueue.dequeue`, `FerryQueue.flush`), where a
 * Landauer meter must read zero for every input forever. This tracker's `permutation()` is the
 * correct door for those, and they use it now.
 *
 * `measure(k)` with `k < 0` un-pays heat, which no caller has a legitimate reason to do (every
 * shipped call site passes a derived figure). It is likewise accepted rather
 * than thrown — the house rule is Result-over-exception and this is a `void` counter — but it
 * is the one thing that falsifies `second_law_satisfied`, so it can no longer pass silently.
 *
 * ## `unmeasured` — the third door, added 2026-08-19 (Soraya)
 *
 * Until now this tracker had exactly two ways to record an operation: `measure(k)` (pay `k`) and
 * `permutation()` (pay nothing, because the operation is a bijection). There was **no way to say
 * "the cost of this one is unknown"** — so a caller facing an unswept operation had to pick
 * between charging an invented number and charging nothing, and charging nothing is the
 * closed-ledger free lunch this module's own header calls a demon.
 *
 * `unmeasured(reason)` is that missing door. It moves no bits, and it is deliberately **not** a
 * silent no-op: it records a hole, and `auditEntropyLedger` reports `chargeComplete: false`
 * forever after. `readHeat` returns the bit total **together with** whether it is the whole cost,
 * so no caller can obtain the number without learning that it is a lower bound.
 *
 * Why a hole and not an upper bound: there is no upper bound to state without inventing a
 * coefficient, and an invented coefficient is the toy-presented-as-metered failure. Landauer's is
 * a **floor**, so "at least this much, plus N operations of unknown cost" is the true statement.
 * This is the TypeScript twin of `src/Core/ErasureCharge.fs` `Reading.LowerBound`.
 *
 * Anchors: Landauer 1961 (Irreversibility and Heat Generation in the Computing Process);
 * Bennett 1973 (Logical Reversibility of Computation); Schmiedl and Seifert 2007 (finite-time
 * thermodynamics, the L^2/tau excess).
 */

// ─── The Two-Ledger Model ────────────────────────────────────────────────

export interface EntropyState {
  /** Ledger A: bits of uncertainty currently in the state (support = 2^entropy_state).
   *  May go negative — see the precondition note in the module header. */
  entropy_state: number;
  /** Ledger B: bits irreversibly discharged to environment (cumulative heat) */
  entropy_heat: number;
  /** Soft observations performed (Adj, free, reversible peek) */
  soft_observations: number;
  /** Hard measurements performed (non-Adj, Landauer cost, branch erasure) */
  hard_measurements: number;
  /**
   * The second law, in the only form this model can falsify: **heat never decreased**
   * (delta-B >= 0 across every operation since the last `reset`). Sticky — once false it stays
   * false, because the property being tracked is irreversibility.
   *
   * This is NOT the old `entropy_state + entropy_heat >= 0` test, which no operation could
   * falsify (module header, vacuity 2). Only `measure(k < 0)` can make this false, and no
   * shipped caller passes a negative bit count, so the stricter form does not fire spuriously —
   * a check that fails spuriously gets disabled, which is the other half of the same defect
   * class.
   */
  second_law_satisfied: boolean;
  /** Cumulative bits admitted to Ledger A via `branch()`. Monotone. */
  bits_admitted: number;
  /** Cumulative bits presented to `measure()`, summed as given (negatives included). */
  bits_erased: number;
  /**
   * Invocations of operations whose erasure nobody has measured. **These are not zero-cost
   * operations** — they are operations of unknown cost, and counting them is what keeps the
   * heat figure honest as a lower bound rather than a total.
   */
  unmeasured_operations: number;
  /** The distinct written reasons behind those invocations. A set: the same hole is one hole. */
  unmeasured_reasons: readonly string[];
}

// ─── The Entropy Tracker (Injected Effect) ──────────────────────────────

export interface EntropyTracker {
  readonly state: EntropyState;
  /** Record a branch (Hadamard-like): +1 bit of uncertainty. Support doubles. */
  branch(): void;
  /** Record a soft observation (Adj): read without destroying. Zero heat. */
  observe(): void;
  /**
   * Record a hard measurement (non-Adj): collapse, erase branches. Pay Landauer.
   *
   * Precondition (documented, NOT enforced): `bitsErased >= 0`, and the bits were admitted via
   * `branch()`. Neither is checked — violations are reported by `auditEntropyLedger` instead of
   * rejected here. See the module header for why, and for the shipped callers that rely on it.
   */
  measure(bitsErased: number): void;
  /** Record a permutation (mul/xorshr/join): no entropy change. */
  permutation(): void;
  /**
   * Record an operation whose erasure has **no admissible measurement**.
   *
   * Moves no bits — because inventing a number is worse than admitting a hole — but it is NOT
   * the same as `permutation()`, which asserts a *measured* bijection. After any call to this,
   * `auditEntropyLedger().chargeComplete` is `false` and `readHeat()` returns a lower bound.
   * `reason` must be non-empty; a hole with no written reason is refused and recorded as such.
   */
  unmeasured(reason: string): void;
  /** Reset the tracker. Re-baselines the heat-monotonicity watch. */
  reset(): void;
}

export function createEntropyTracker(): EntropyTracker {
  const state: EntropyState = {
    entropy_state: 0,
    entropy_heat: 0,
    soft_observations: 0,
    hard_measurements: 0,
    second_law_satisfied: true,
    bits_admitted: 0,
    bits_erased: 0,
    unmeasured_operations: 0,
    unmeasured_reasons: [],
  };

  // The heat level at the previous observation point. The second law is checked as a DELTA,
  // not as a level, because a level test on this model is unfalsifiable (module header, 2).
  let previous_heat = state.entropy_heat;

  function checkSecondLaw(): void {
    // Irreversibility: heat is paid, never refunded. Sticky once violated.
    if (state.entropy_heat < previous_heat) state.second_law_satisfied = false;
    previous_heat = state.entropy_heat;
  }

  return {
    get state() { return { ...state }; },

    branch() {
      // Hadamard: +1 bit uncertainty. Support doubles. Reversible (no heat).
      state.entropy_state += 1;
      state.bits_admitted += 1;
      checkSecondLaw();
    },

    observe() {
      // Adj operation: read without destroying. Free (Bennett).
      state.soft_observations += 1;
      // No entropy change — observation without commitment.
      checkSecondLaw();
    },

    measure(bitsErased: number) {
      // Non-Adj: collapse branches. Entropy transfers from state to heat.
      // Landauer: each erased bit costs >= kT.ln2 of heat.
      state.entropy_state -= bitsErased;
      state.entropy_heat += bitsErased; // transferred, not destroyed (conservation)
      state.bits_erased += bitsErased;
      state.hard_measurements += 1;
      checkSecondLaw();
    },

    permutation() {
      // Permutation (mul, xorshr, join): bijective, no entropy change.
      // Support unchanged. No heat.
      checkSecondLaw();
    },

    unmeasured(reason: string) {
      // No bits move. The point is the RECORD, not the arithmetic: a ledger that cannot
      // represent "unknown" reports unknown as zero, and zero is a claim.
      state.unmeasured_operations += 1;
      const written = reason.trim().length > 0 ? reason : "(no reason written — itself a defect)";
      if (!state.unmeasured_reasons.includes(written)) {
        state.unmeasured_reasons = [...state.unmeasured_reasons, written];
      }
      checkSecondLaw();
    },

    reset() {
      state.entropy_state = 0;
      state.entropy_heat = 0;
      state.soft_observations = 0;
      state.hard_measurements = 0;
      state.second_law_satisfied = true;
      state.bits_admitted = 0;
      state.bits_erased = 0;
      state.unmeasured_operations = 0;
      state.unmeasured_reasons = [];
      previous_heat = 0;
    },
  };
}

// ─── Landauer Cost Contract ──────────────────────────────────────────────

/**
 * The Landauer floor: minimum heat per erased bit, in units of kT.ln2.
 *
 * It is `1` because the units are normalized to kT.ln2 — which is exactly why this module
 * cannot verify the Landauer bound. Multiplying the bit count by 1 reproduces the bit count,
 * so heat-vs-floor is `x >= x`. To compare against a physical quantity you need a joule figure
 * and an instrument; see `key-erasure-meter.ts`, which keeps `LedgerBits`,
 * `LandauerFloorJoules` and `MeasuredDissipation` in three disjoint types for this reason.
 */
export const LANDAUER_FLOOR_PER_BIT = 1; // 1 x kT.ln2 per bit (normalized units)

/**
 * The result of auditing the entropy ledger.
 *
 * Deliberately has **no aggregate `holds` boolean**. The predecessor (`verifyLandauer`) had
 * one, and it read `true` forever because two of its three conjuncts could not be false; the
 * aggregate is what let that hide. Every field below is either an identity that is labelled as
 * an identity, or an invariant with a test that makes it false.
 */
export interface EntropyLedgerAudit {
  // ── Accounting identities: facts about the ledger, not checks on it ──
  /** Cumulative bits admitted via `branch()`. */
  readonly bitsAdmitted: number;
  /** Cumulative bits presented to `measure()`. */
  readonly bitsErased: number;
  /** Ledger B: cumulative heat. Equals `bitsErased` by construction — `measure` pays 1:1. */
  readonly heatPaid: number;
  /**
   * `bitsErased x LANDAUER_FLOOR_PER_BIT`. In normalized units this is **identically
   * `heatPaid`**, so comparing the two verifies nothing. Reported so a reader sees the
   * tautology rather than a `true` that conceals it.
   */
  readonly landauerFloorBits: number;
  /** `max(0, bitsErased - bitsAdmitted)` — bits erased that this tracker never admitted. */
  readonly unadmittedErasureBits: number;

  // ── Invariants: each of these can be false, and a test in the suite makes it so ──
  /** Heat never decreased (irreversibility). False after any `measure(k < 0)`. */
  readonly heatMonotone: boolean;
  /** Ledger B is non-negative. False after a net-negative measurement history. */
  readonly heatNonNegative: boolean;
  /**
   * Every erased bit was admitted first. **Reported, not enforced** — `createNonAdjMap` and
   * `event-sink-folder` make this false in normal operation by design (module header).
   */
  readonly erasuresFullyAdmitted: boolean;

  // ── The holes: operations of UNKNOWN cost, which are not operations of zero cost ──
  /** Invocations recorded through `unmeasured()`. */
  readonly unmeasuredOperations: number;
  /** The distinct written reasons for them. */
  readonly unmeasuredReasons: readonly string[];
  /**
   * `true` iff no `unmeasured()` was ever recorded — i.e. iff `heatPaid` is the whole cost
   * rather than a lower bound. This is the field a caller must read before quoting a total.
   */
  readonly chargeComplete: boolean;
}

/**
 * The heat figure **and** whether it is complete, returned together on purpose.
 *
 * There is deliberately no `totalHeat(tracker): number` beside this: reading the number and
 * learning whether it is the whole cost are one act. Same refusal as
 * `ErasureClass.bitsErasedPpm` returning `int64 option` rather than defaulting to `0L`, and same
 * shape as `ErasureCharge.Reading` on the F# side.
 */
export interface HeatReading {
  /** Bits of heat actually charged. When `complete` is false this is a LOWER BOUND. */
  readonly bitsErased: number;
  /** `false` when at least one operation of unknown cost was recorded. */
  readonly complete: boolean;
  /** The written reasons for the unknowns. Empty iff `complete`. */
  readonly holes: readonly string[];
}

/** Read the heat total together with its completeness. See `HeatReading`. */
export function readHeat(tracker: EntropyTracker): HeatReading {
  const s = tracker.state;
  return {
    bitsErased: s.entropy_heat,
    complete: s.unmeasured_operations === 0,
    holes: s.unmeasured_reasons,
  };
}

/**
 * Audit the entropy ledger: report the accounting identities, and the invariants that can
 * actually fail.
 *
 * Replaces `verifyLandauer`, which claimed to verify the Landauer bound and could not — see the
 * module header. If you want evidence that a physical bound was respected, this function is not
 * it and cannot be made into it; go get a `MeasuredDissipation` from an instrument and use the
 * one-way test in `key-erasure-meter.ts`, which refutes an erasure claim and never confirms one.
 */
export function auditEntropyLedger(tracker: EntropyTracker): EntropyLedgerAudit {
  const s = tracker.state;
  return {
    bitsAdmitted: s.bits_admitted,
    bitsErased: s.bits_erased,
    heatPaid: s.entropy_heat,
    landauerFloorBits: s.bits_erased * LANDAUER_FLOOR_PER_BIT,
    unadmittedErasureBits: Math.max(0, s.bits_erased - s.bits_admitted),
    heatMonotone: s.second_law_satisfied,
    heatNonNegative: s.entropy_heat >= 0,
    erasuresFullyAdmitted: s.bits_erased <= s.bits_admitted,
    unmeasuredOperations: s.unmeasured_operations,
    unmeasuredReasons: s.unmeasured_reasons,
    chargeComplete: s.unmeasured_operations === 0,
  };
}

// ─── Ferry Integration Point ─────────────────────────────────────────────

/**
 * The ferry commit = the non-Adj moment.
 * Batch size B = bits erased at commit.
 * Heat = B x kT.ln2 (the Landauer floor, paid to the sink).
 *
 * Predictive advantage: knowing B and t in advance lets you stretch tau
 * (the erasure window), driving the finite-time excess L^2/tau toward 0.
 */
export interface FerryEntropyAccount {
  batchBits: number;       // B: total bits in this commit batch
  landauerFloor: number;   // B x kT.ln2 (irreducible minimum)
  erasureWindow: number;   // tau: time available for erasure (predictive = large)
  finiteTimeExcess: number; // L^2/tau: excess above floor (smaller = better)
  totalHeat: number;        // floor + excess (what is actually paid)
}

export function accountFerryCommit(
  batchBits: number,
  erasureWindow: number,
  thermodynamicLength = 1, // L^2 normalized
): FerryEntropyAccount {
  const landauerFloor = batchBits * LANDAUER_FLOOR_PER_BIT;
  const finiteTimeExcess = erasureWindow > 0 ? thermodynamicLength / erasureWindow : Infinity;
  return {
    batchBits,
    landauerFloor,
    erasureWindow,
    finiteTimeExcess,
    totalHeat: landauerFloor + finiteTimeExcess,
  };
}
