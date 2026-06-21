/-
  Finite Shannon entropy root (information-theory tower, target #1) — the Mathlib-backed,
  real-ℝ **Shannon entropy** of a finite probability distribution, and its foundational lemmas.

  This is the SIBLING of `Lean4/EntropyMeasureTheoretic.lean` (min-entropy `H_∞ = − logb 2 (pmax)`):
  same finite-distribution setting, different functional — Shannon entropy

      H(D)  =  ∑_{x ∈ outcomes} negMulLog (p x)    -- natural-log base; `negMulLog x = −x·log x`

  using Mathlib's `Real.negMulLog`. It is the **bottom brick** the rest of the information-theory
  tower hangs off (conditional entropy → mutual information → DPI → channel capacity are LATER rungs
  and are deliberately NOT in this file — see the routing note).

  ── HONEST SCOPE ─────────────────────────────────────────────────────────────────────────────────
  • A *finite* distribution: a `Finset` of outcomes with an `ℝ→` probability mass `p ≥ 0` summing to
    `1`. The general measure-space Shannon entropy over an arbitrary `MeasureTheory.Measure` is a
    later rung (Mathlib v4.30.0-rc1 has `Real.negMulLog` but no Shannon `measureEntropy` def — see
    `docs/research/2026-06-20-measure-theoretic-entropy-tier-mathlib-scope.md`).
  • Base: natural log (`negMulLog x = −x·log x`), the Mathlib-native choice; rescaling to bits is a
    constant factor (`/ log 2`) and is not needed for the foundational lemmas below.
  • Three foundational lemmas only: the definition, non-negativity, and the point-mass = 0
    non-vacuity. No conditional entropy / MI / DPI / capacity here.

  Beacon anchors: Shannon 1948 (*A Mathematical Theory of Communication* — the entropy functional
  `H = −∑ p log p`); Cover & Thomas, *Elements of Information Theory* (Ch. 2: H ≥ 0; H = 0 iff a
  point mass). Mathlib: `Real.negMulLog`, `Real.negMulLog_nonneg`, `Real.negMulLog_zero`,
  `Real.negMulLog_one` (`Mathlib/Analysis/SpecialFunctions/Log/NegMulLog.lean`);
  `Finset.sum_nonneg`, `Finset.single_le_sum`
  (`Mathlib/Algebra/Order/BigOperators/Group/Finset.lean`).
-/
import Mathlib.Analysis.SpecialFunctions.Log.NegMulLog
import Mathlib.Algebra.Order.BigOperators.Group.Finset

namespace Zeta.FinShannonEntropy

open Real

variable {Ω : Type*} [DecidableEq Ω]

/-- A finite probability distribution: a finite set of `outcomes` over a type `Ω`, with an
    `ℝ`-valued probability mass `p ≥ 0` everywhere, summing to `1` over the outcomes. (Outcomes
    of probability `0` MAY be listed — unlike the min-entropy `FinDist`, Shannon entropy is
    well-defined at `p = 0` because `negMulLog 0 = 0`, which makes the point-mass lemma clean.) -/
structure FinDist (Ω : Type*) [DecidableEq Ω] where
  outcomes : Finset Ω
  p : Ω → ℝ
  nonneg : ∀ x, 0 ≤ p x
  sum_one : ∑ x ∈ outcomes, p x = 1

/-- **Shannon entropy** `H(D) = ∑_{x ∈ outcomes} negMulLog (p x)`, natural-log base
    (`negMulLog x = −x·log x`; Shannon 1948, Cover & Thomas Ch. 2). -/
noncomputable def H (D : FinDist Ω) : ℝ := ∑ x ∈ D.outcomes, negMulLog (D.p x)

/-- Each listed mass is at most `1`: `p x ≤ ∑ p = 1` (a single term of a sum of nonneg masses cannot
    exceed the total). Keeps `negMulLog` in its nonneg regime `0 ≤ p x ≤ 1`. -/
theorem p_le_one (D : FinDist Ω) {x : Ω} (hx : x ∈ D.outcomes) : D.p x ≤ 1 := by
  calc D.p x ≤ ∑ y ∈ D.outcomes, D.p y :=
        Finset.single_le_sum (fun y _ => D.nonneg y) hx
    _ = 1 := D.sum_one

/-- **Non-negativity (Shannon 1948 / Cover & Thomas Ch. 2):** `0 ≤ H D`. Each summand
    `negMulLog (p x) ≥ 0` because `0 ≤ p x ≤ 1` (`Real.negMulLog_nonneg`), so the finite sum is
    `≥ 0` (`Finset.sum_nonneg`). -/
theorem H_nonneg (D : FinDist Ω) : 0 ≤ H D := by
  unfold H
  apply Finset.sum_nonneg
  intro x hx
  exact negMulLog_nonneg (D.nonneg x) (p_le_one D hx)

/-- The **point-mass** distribution at `x₀` over a finite outcome set `s` containing `x₀`: all mass
    on `x₀`, zero elsewhere — the degenerate, zero-uncertainty distribution. -/
noncomputable def pointMass (s : Finset Ω) (x₀ : Ω) (hx₀ : x₀ ∈ s) : FinDist Ω where
  outcomes := s
  p := fun x => if x = x₀ then 1 else 0
  nonneg := by
    intro x
    by_cases h : x = x₀ <;> simp [h]
  sum_one := by
    simp [Finset.sum_ite_eq' s x₀ (fun _ => (1 : ℝ)), hx₀]

/-- **Point mass ⇒ zero entropy (non-vacuity; H = 0 at a certain outcome, Cover & Thomas Ch. 2):**
    a distribution with all mass on a single outcome has `H = 0`. Every summand is `negMulLog 1 = 0`
    (at `x₀`) or `negMulLog 0 = 0` (elsewhere). -/
theorem H_pointMass_zero (s : Finset Ω) (x₀ : Ω) (hx₀ : x₀ ∈ s) :
    H (pointMass s x₀ hx₀) = 0 := by
  unfold H pointMass
  apply Finset.sum_eq_zero
  intro x _
  by_cases h : x = x₀ <;> simp [h]

end Zeta.FinShannonEntropy
