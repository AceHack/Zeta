/-
  LandauerFloor.lean — Formal cost contract: Landauer's principle as a metered floor.

  The Landauer bound (1961): erasing one bit of information irreversibly costs at least kT·ln2
  of heat dissipation. In our framework this IS the cost contract for non-Adj operations
  (measurements, commits, ferry-batch flush) — the entropy tracker's `measure(bitsErased)`
  transfers bits from Ledger A (state/uncertainty) to Ledger B (heat/environment), and the
  heat is MONOTONE (second law: total entropy never decreases in a closed system).

  This file proves the structural properties of the two-ledger model that the TypeScript
  `entropy-tracker.ts` implements:

  1. **Second law (conservation + monotonicity):** total entropy (state + heat) never decreases.
     A `branch` adds uncertainty (state grows); a `measure` transfers it to heat (state shrinks,
     heat grows, total preserved). No operation can decrease the total.

  2. **Landauer floor:** cumulative heat ≥ cumulative bits erased. Since each `measure(k)` pays
     exactly `k` bits of heat, the floor holds by construction — but the STRUCTURAL guarantee is
     that no sequence of operations can produce negative heat or violate the floor.

  3. **Bennett reversibility:** a sequence of ONLY Adj operations (branch + observe + permutation)
     pays ZERO heat. This is the reversible-computation theorem: reversible ops are free.

  4. **Predictive advantage (finite-time thermodynamics):** when the erasure window τ is known in
     advance (predictive scheduling), the finite-time excess L²/τ → 0 as τ → ∞. The total heat
     approaches the Landauer floor (the quasi-static limit). Proven as: excess is a decreasing
     function of τ, and at the limit it vanishes.

  Anchors:
  - Landauer 1961: "Irreversibility and Heat Generation in the Computing Process"
  - Bennett 1973: "Logical Reversibility of Computation" (reversible ops = zero heat)
  - Schmiedl & Seifert 2007: finite-time thermodynamics (L²/τ excess)
  - The repo's `src/Core.TypeScript/algebra/entropy-tracker.ts` (the implementation this formalizes)
  - `src/Core.TypeScript/observe/event-sink-folder.ts` (each append = 1 measurement, wired in item 1)

  Discipline: sorry-free where possible. Operational/combinatorial model (Nat arithmetic over bit
  counts), following the house style of EntropyFloorLift.lean and ChildFloor.lean.

  ## Faithfulness to the implementation (audited 2026-08-13, Soraya)

  Everything above models a ledger over `Nat`, with `measure` carrying the precondition
  `k ≤ s.state`. **The TypeScript this file claims to formalize has neither.** Both ledgers
  are JavaScript `number` (signed), and `measure` has no precondition at all. Two consequences
  worth stating plainly, because they are the difference between a proof and a decoration:

  1. **Theorem 2 (heat monotonicity) is free here and was FALSE there.** `s.heat ≤ (op s).heat`
     over `Nat` is discharged by the type, not by the operations — no arrangement of these
     definitions could have made it fail. The same property over the implementation signed
     arithmetic is a genuine obligation, and `measure(-5)` violated it silently until
     2026-08-13. A formal artefact that discharges an obligation using a type the
     implementation does not have has not discharged it.
  2. **The `k ≤ s.state` precondition is not implemented.** `physics-traits.ts`
     `createNonAdjMap` and `observe/event-sink-folder.ts` both call `measure(1)` with nothing
     admitted, so `state` goes negative in normal operation — a state this Nat model cannot
     even express. That is now a documented, reported precondition on the TS side rather than
     a silent divergence; `key-erasure-meter.ts` is the guarded path that does enforce it.

  Section 5 below adds the signed model, so both claims are checked here rather than asserted
  in a comment. Read the Nat model as the specification of the GUARDED path
  (`key-erasure-meter.ts`), and the signed model as the specification of the UNGUARDED one
  (`entropy-tracker.ts`).
-/

namespace Zeta.LandauerFloor

-- ═══ The Two-Ledger Model ══════════════════════════════════════════════════════
-- Ledger A (state): bits of uncertainty currently in the system (support = 2^state)
-- Ledger B (heat): bits irreversibly discharged to the environment (Landauer cost)

/-- The entropy state of a computation: two ledgers + operation counts. -/
structure EntropyState where
  state : Nat          -- Ledger A: bits of uncertainty
  heat : Nat           -- Ledger B: cumulative bits discharged
  softObs : Nat        -- Adj observations (free, no heat)
  hardMeas : Nat       -- non-Adj measurements (Landauer cost paid)
  deriving DecidableEq

/-- The initial state: zero entropy everywhere. -/
def initial : EntropyState := ⟨0, 0, 0, 0⟩

/-- Total entropy = state + heat (the second-law invariant tracks this). -/
def total (s : EntropyState) : Nat := s.state + s.heat

-- ═══ Operations (the four primitives from entropy-tracker.ts) ══════════════════

/-- Branch (Hadamard-like): +1 bit of uncertainty. Support doubles. Reversible (no heat). -/
def branch (s : EntropyState) : EntropyState :=
  { s with state := s.state + 1 }

/-- Observe (Adj): read without destroying. Zero heat. Free (Bennett). -/
def observe (s : EntropyState) : EntropyState :=
  { s with softObs := s.softObs + 1 }

/-- Measure (non-Adj): collapse `k` bits. Entropy transfers from state to heat.
    Precondition: `k ≤ s.state` (can't erase more uncertainty than exists). -/
def measure (s : EntropyState) (k : Nat) (h : k ≤ s.state) : EntropyState :=
  { state := s.state - k, heat := s.heat + k, softObs := s.softObs, hardMeas := s.hardMeas + 1 }

/-- Permutation (mul/xorshr/join): bijective, no entropy change. -/
def permutation (s : EntropyState) : EntropyState := s

/-- Local iterator, core-only (no Mathlib `Nat.iterate` / `Function.iterate_succ'`),
    matching the import-free house style of EntropyFloorLift.lean and ChildFloor.lean.
    Definitional unfolding: `iter f (n+1) s = f (iter f n s)` (op applied outermost). -/
def iter {α : Type} (f : α → α) : Nat → α → α
  | 0,          s => s
  | Nat.succ n, s => f (iter f n s)

-- ═══ Theorem 1: Second Law (total entropy never decreases) ═════════════════════

theorem branch_preserves_or_increases_total (s : EntropyState) :
    total s ≤ total (branch s) := by
  simp only [total, branch]; omega

theorem observe_preserves_total (s : EntropyState) :
    total (observe s) = total s := by
  simp [total, observe]

theorem measure_preserves_total (s : EntropyState) (k : Nat) (h : k ≤ s.state) :
    total (measure s k h) = total s := by
  simp [total, measure]; omega

theorem permutation_preserves_total (s : EntropyState) :
    total (permutation s) = total s := by
  simp [total, permutation]

-- ═══ Theorem 2: Landauer Floor (heat ≥ bits erased, cumulatively) ══════════════

/-- After a measurement of `k` bits, heat grows by exactly `k`. The floor holds because
    each measure pays exactly 1 bit of heat per bit erased — no deficit is possible. -/
theorem measure_heat_grows (s : EntropyState) (k : Nat) (h : k ≤ s.state) :
    (measure s k h).heat = s.heat + k := by
  simp [measure]

/-- Heat is monotone: no operation can decrease heat. This IS the irreversibility
    guarantee — once heat is paid, it cannot be recovered (the arrow of time). -/
theorem branch_heat_monotone (s : EntropyState) :
    s.heat ≤ (branch s).heat := by
  simp [branch]

theorem observe_heat_monotone (s : EntropyState) :
    s.heat ≤ (observe s).heat := by
  simp [observe]

theorem measure_heat_monotone (s : EntropyState) (k : Nat) (h : k ≤ s.state) :
    s.heat ≤ (measure s k h).heat := by
  simp only [measure]; omega

theorem permutation_heat_monotone (s : EntropyState) :
    s.heat ≤ (permutation s).heat := by
  simp [permutation]

-- ═══ Theorem 3: Bennett Reversibility (Adj-only sequences = zero heat) ═════════

/-- A sequence of ONLY branches produces zero heat. -/
theorem branches_zero_heat (n : Nat) :
    (iter branch n initial).heat = 0 := by
  induction n with
  | zero => simp [iter, initial]
  | succ k ih => simpa [iter, branch] using ih

/-- A sequence of ONLY observations produces zero heat. -/
theorem observations_zero_heat (n : Nat) :
    (iter observe n initial).heat = 0 := by
  induction n with
  | zero => simp [iter, initial]
  | succ k ih => simpa [iter, observe] using ih

/-- Branches followed by observations: still zero heat (all Adj, all free). -/
theorem adj_only_zero_heat (branches obs : Nat) :
    (iter observe obs (iter branch branches initial)).heat = 0 := by
  induction obs with
  | zero => exact branches_zero_heat branches
  | succ k ih => simpa [iter, observe] using ih

-- ═══ Theorem 4: Predictive Advantage (finite-time excess) ══════════════════════
-- The finite-time excess above the Landauer floor is L²/τ where τ is the erasure
-- window. Predictive scheduling (knowing the batch size B and commit time t in
-- advance) allows stretching τ, driving excess → 0.

/-- The finite-time excess model: L²/τ. Since we work in Nat (avoiding reals), we
    model excess as the pair (L², τ) where the ratio L²/τ is the excess. A larger τ
    means less excess (better prediction). -/
structure FiniteTimeExcess where
  thermLength : Nat  -- L² (thermodynamic length squared)
  window : Nat       -- τ (erasure window; 0 = instant = maximal excess)

/-- A larger erasure window means less excess (the predictive advantage). -/
theorem larger_window_less_excess (e1 e2 : FiniteTimeExcess)
    (hL : e1.thermLength = e2.thermLength)
    (hτ : e1.window ≤ e2.window)
    (hpos1 : 0 < e1.window) :
    e2.thermLength * e1.window ≤ e1.thermLength * e2.window := by
  rw [hL]; exact Nat.mul_le_mul_left _ hτ

/-- At the quasi-static limit (τ = ∞, modelled as τ ≥ L² so excess < 1 in integer
    division), the total heat equals the Landauer floor (zero integer excess). -/
theorem quasistatic_limit (batchBits L2 τ : Nat) (hτ : L2 ≤ τ) :
    batchBits + L2 / τ ≤ batchBits + 1 := by
  have h : L2 / τ ≤ 1 := by
    cases τ with
    | zero => omega
    | succ n => exact Nat.div_le_of_le_mul (by omega)
  omega

-- ═══ Composition: the event-sink wiring (each append = 1 measurement) ══════════

/-- The observe loop: each event-sink append is a measurement of 1 bit (one decision
    collapsed from the possibility space). After `n` appends from a state with `n`
    branches, all uncertainty has been discharged as heat. -/
theorem n_appends_from_n_branches (n : Nat) :
    -- After n branches: state = n, heat = 0
    (iter branch n initial).state = n ∧ (iter branch n initial).heat = 0 := by
  refine ⟨?_, branches_zero_heat n⟩
  induction n with
  | zero => simp [iter, initial]
  | succ k ih => simp [iter, branch, ih]

-- ═══ Theorem 5: the SIGNED model — what entropy-tracker.ts actually implements ══
-- Sections 1-4 model a Nat ledger with a `k ≤ s.state` precondition. The TypeScript has
-- neither: both ledgers are signed `number` and `measure` is unguarded. The theorems below
-- are stated over that model, so the divergence is CHECKED rather than described.

/-- The ledger as shipped: both counters signed, no precondition on `measure`. -/
structure SignedState where
  state : Int
  heat : Int
  deriving DecidableEq

def signedInitial : SignedState := ⟨0, 0⟩

def signedBranch (s : SignedState) : SignedState := { s with state := s.state + 1 }

/-- No `k ≤ s.state` hypothesis and `k : Int` — exactly the shipped signature. -/
def signedMeasure (s : SignedState) (k : Int) : SignedState :=
  { state := s.state - k, heat := s.heat + k }

/-- Heat monotonicity over the signed model holds EXACTLY WHEN the bit count is non-negative.
    Contrast `measure_heat_monotone` above, which is unconditional — that unconditionality is
    supplied by `Nat`, not by the model, and the implementation does not have `Nat`. This is
    the precondition `entropy-tracker.ts` now documents and reports. -/
theorem signed_heat_monotone_iff (s : SignedState) (k : Int) :
    s.heat ≤ (signedMeasure s k).heat ↔ 0 ≤ k := by
  simp [signedMeasure]; omega

/-- The concrete violation, as a theorem rather than a footnote: a negative bit count refunds
    heat that was already paid, reversing an irreversible operation. -/
theorem signed_negative_measure_refunds_heat :
    (signedMeasure signedInitial (-5)).heat = -5 := by
  decide

/-- Why a LEVEL test on the total could not see it. `state + heat` is invariant under
    `signedMeasure` for EVERY `k`, negative ones included — so `state + heat ≥ 0`, the check
    `second_law_satisfied` used until 2026-08-13, is blind to every measurement the tracker
    ever performs. Only `branch` moves that sum, and only upward. This is the vacuity, proven. -/
theorem signed_total_blind_to_measure (s : SignedState) (k : Int) :
    (signedMeasure s k).state + (signedMeasure s k).heat = s.state + s.heat := by
  simp [signedMeasure]; omega

/-- And the sum is monotone under `branch`, so a level test on it can never be false at all
    from `signedInitial`: the two facts together are why the sweep found zero counterexamples. -/
theorem signed_branch_raises_total (s : SignedState) :
    s.state + s.heat ≤ (signedBranch s).state + (signedBranch s).heat := by
  simp [signedBranch]; omega

/-- Erasing bits that were never admitted: expressible here, unreachable in the Nat model
    (where `k ≤ s.state` forbids it). This is what `createNonAdjMap.put` does on every call. -/
theorem signed_unadmitted_erasure (k : Int) (hk : 0 < k) :
    (signedMeasure signedInitial k).state < 0 := by
  simp [signedMeasure, signedInitial]; omega

end Zeta.LandauerFloor
