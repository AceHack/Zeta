/**
 * src/Core.TypeScript/algebra/entropy-tracker.ts — Two-ledger Maxwell's Demon entropy counter.
 *
 * Tracks the thermodynamic cost of computation per the Landauer/Bennett model:
 * - Ledger A (state): bits of uncertainty in the quantum/soft state (support)
 * - Ledger B (heat): bits irreversibly discharged to the environment (Landauer)
 *
 * The Adj functor IS the gate between ledgers:
 * - Adj ops (soft observations): stay in Ledger A (reversible, zero heat)
 * - non-Adj ops (measurements/commits): discharge from A to B (irreversible, heat paid)
 *
 * The second law: net = ΔA + ΔB ≥ 0 (entropy never decreases in a closed system)
 * Bennett: reversible ops have net = 0 (no heat for Adj operations)
 * Landauer: erasure costs ≥ kT·ln2 per bit (the floor for non-Adj operations)
 *
 * This is the injected effect (§13 metered door) — NOT an ambient mutable.
 * Same discipline as cost-counter.ts.
 *
 * ## What this module is, and is not (audited 2026-08-13)
 *
 * It is an **accounting ledger**: it counts bits against a floor in normalized units. It is
 * **not a physical meter**: there is no joule, no temperature, and no instrument anywhere in it,
 * and no quantity here has ever been measured against the world. A claim resting on this tracker
 * is strictly weaker than one resting on a measurement, and treating the two as interchangeable
 * is the physics-as-metaphor failure the metering test exists to catch
 * (`.claude/rules/anchor-to-human-prior-art.md`).
 *
 * Three consequences of the current design, recorded rather than silently fixed, because callers
 * are relying on the present behaviour:
 *
 * 1. **`verifyLandauer` cannot fail on the Landauer bound.** `bitsErased`, `heatPaid` and `floor`
 *    are all the same field (`entropy_heat`), so `heatPaid >= floor` is `x >= x` — true by
 *    construction. What `holds` actually reports is `entropy_heat >= 0 && second_law_satisfied`,
 *    i.e. a non-negative-argument check. The name promises more than the arithmetic delivers.
 * 2. **`measure(n)` accepts bits that were never admitted.** `measure(1_000_000)` on a fresh
 *    tracker succeeds, leaving `entropy_state = -1_000_000`, and `second_law_satisfied` stays
 *    `true` because the check is on the *sum*. Erasing what you never held is currently legal.
 * 3. **`measure(n)` accepts negative `n`**, which un-pays heat and drives `entropy_heat` negative.
 *
 * `key-erasure-meter.ts` is the guarded path built over this one: it admits key material before it
 * can be erased (so 2 cannot happen on that path), rejects non-positive bit counts (so 3 cannot),
 * and keeps ledger bits, the derived `kT ln 2` bound, and an instrument measurement in three
 * disjoint types so 1 cannot be mistaken for a physical verification.
 */

// ─── The Two-Ledger Model ────────────────────────────────────────────────

export interface EntropyState {
  /** Ledger A: bits of uncertainty currently in the state (support = 2^entropy_state) */
  entropy_state: number;
  /** Ledger B: bits irreversibly discharged to environment (cumulative heat) */
  entropy_heat: number;
  /** Soft observations performed (Adj, free, reversible peek) */
  soft_observations: number;
  /** Hard measurements performed (non-Adj, Landauer cost, branch erasure) */
  hard_measurements: number;
  /** Second law check: entropy_state + entropy_heat ≥ initial (always holds) */
  second_law_satisfied: boolean;
}

// ─── The Entropy Tracker (Injected Effect) ──────────────────────────────

export interface EntropyTracker {
  readonly state: EntropyState;
  /** Record a branch (Hadamard-like): +1 bit of uncertainty. Support doubles. */
  branch(): void;
  /** Record a soft observation (Adj): read without destroying. Zero heat. */
  observe(): void;
  /** Record a hard measurement (non-Adj): collapse, erase branches. Pay Landauer. */
  measure(bitsErased: number): void;
  /** Record a permutation (mul/xorshr/join): no entropy change. */
  permutation(): void;
  /** Reset the tracker. */
  reset(): void;
}

export function createEntropyTracker(): EntropyTracker {
  const state: EntropyState = {
    entropy_state: 0,
    entropy_heat: 0,
    soft_observations: 0,
    hard_measurements: 0,
    second_law_satisfied: true,
  };

  const initial_total = 0; // total entropy at creation

  function checkSecondLaw(): void {
    // Second law: total entropy (state + heat) never decreases
    state.second_law_satisfied = (state.entropy_state + state.entropy_heat) >= initial_total;
  }

  return {
    get state() { return { ...state }; },

    branch() {
      // Hadamard: +1 bit uncertainty. Support doubles. Reversible (no heat).
      state.entropy_state += 1;
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
      // Landauer: each erased bit costs ≥ kT·ln2 of heat.
      state.entropy_state -= bitsErased;
      state.entropy_heat += bitsErased; // transferred, not destroyed (conservation)
      state.hard_measurements += 1;
      checkSecondLaw();
    },

    permutation() {
      // Permutation (mul, xorshr, join): bijective, no entropy change.
      // Support unchanged. No heat.
      checkSecondLaw();
    },

    reset() {
      state.entropy_state = 0;
      state.entropy_heat = 0;
      state.soft_observations = 0;
      state.hard_measurements = 0;
      state.second_law_satisfied = true;
    },
  };
}

// ─── Landauer Cost Contract ──────────────────────────────────────────────

/** The Landauer floor: minimum heat per erased bit (in units of kT·ln2). */
export const LANDAUER_FLOOR_PER_BIT = 1; // 1 × kT·ln2 per bit (normalized units)

/**
 * Report the heat paid against the Landauer floor.
 *
 * **Read `holds` narrowly.** In normalized units the floor IS the heat (both are `entropy_heat`),
 * so the comparison this name suggests is a tautology; `holds` is really "heat is non-negative and
 * the second law survived". It is an accounting self-consistency check, not a verification that
 * any physical bound was respected — nothing here measures energy. See the module header.
 */
export function verifyLandauer(tracker: EntropyTracker): {
  holds: boolean;
  bitsErased: number;
  heatPaid: number;
  floor: number;
} {
  const s = tracker.state;
  const floor = s.entropy_heat * LANDAUER_FLOOR_PER_BIT; // in normalized units, heat = floor
  return {
    holds: s.entropy_heat >= 0 && s.second_law_satisfied,
    bitsErased: s.entropy_heat,
    heatPaid: s.entropy_heat,
    floor,
  };
}

// ─── Ferry Integration Point ─────────────────────────────────────────────

/**
 * The ferry commit = the non-Adj moment.
 * Batch size B = bits erased at commit.
 * Heat = B × kT·ln2 (the Landauer floor, paid to the sink).
 *
 * Predictive advantage: knowing B and t in advance lets you stretch τ
 * (the erasure window), driving the finite-time excess L²/τ toward 0.
 */
export interface FerryEntropyAccount {
  batchBits: number;       // B: total bits in this commit batch
  landauerFloor: number;   // B × kT·ln2 (irreducible minimum)
  erasureWindow: number;   // τ: time available for erasure (predictive = large)
  finiteTimeExcess: number; // L²/τ: excess above floor (smaller = better)
  totalHeat: number;        // floor + excess (what's actually paid)
}

export function accountFerryCommit(
  batchBits: number,
  erasureWindow: number,
  thermodynamicLength: number = 1, // L² normalized
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
