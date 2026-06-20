/-
  Measure-theoretic min-entropy lift (math-team handoff row 1, **measure-theoretic tier**) — the
  real-distribution counterpart of `Lean4/EntropyFloorLift.lean`.

  Row 1's property: NFT forgery-resistance `H_∞(H_AB | E) ≥ k` — "the entropy floor = G3b / Bell
  lifted from a SINGLE body to a PAIR." `EntropyFloorLift.lean` proves the lift in the OPERATIONAL
  (guessing-space, pure-`Nat`, no-Mathlib) form. THIS file proves the same lift in the real-number,
  Mathlib-backed form, using the standard cryptographic definition of min-entropy and Mathlib's
  `Real.logb` / `Finset.sup'`.

  ── Definitions (standard; Rényi/Shannon, Cover & Thomas, Dodis et al.) ──────────────────────────
  Min-entropy of a finite distribution `D` over outcomes `Ω`:

      pmax(D)  = max_{x ∈ Ω} p(x)               -- the optimal single-guess probability
      H_∞(D)   = − logb 2 (pmax D)               -- min-entropy, base-2

  For two INDEPENDENT sources the joint distribution is the product `p(a,b) = pa(a)·pb(b)`. The
  load-bearing arithmetic fact is that the product distribution's guessing probability FACTORIZES:

      pmax(product)  =  pmax(a) · pmax(b)

  and therefore, by `Real.logb_mul`,

      H_∞(product)   =  H_∞(a) + H_∞(b)          -- the lift, as an EXACT equality

  This is STRONGER than the row-1 `≥` claim (`floor_lifts`): min-entropy of an independent pair is
  not merely ≥ the sum of the single-body floors, it EQUALS it. The `≥`-floor corollary
  (`hasFloor`) then follows for free.

  ── HONEST SCOPE ─────────────────────────────────────────────────────────────────────────────────
  This is the real-distribution (`ℝ`-valued probabilities, Mathlib `logb`/`sup'`) min-entropy lift
  for INDEPENDENT finite distributions — a faithful measure-theoretic statement, not another
  operational surrogate. It does NOT (and need not) re-derive that a physical Bell/G3b source meets a
  single-body floor (that is the empirical `ρ_owe` + Tariq's inequality cross-check, per the handoff
  "ρ_owe is evidence, not the lemma"). It models a *finite* distribution (a `Finset` of outcomes with
  an `ℝ→` probability mass); the general measure-space `H_∞` over an arbitrary `MeasureTheory.Measure`
  is the next rung and is scoped in
  `docs/research/2026-06-20-measure-theoretic-entropy-tier-mathlib-scope.md` (Mathlib v4.30.0-rc1 has
  no Shannon `measureEntropy` def yet — only `Real.negMulLog`, `BinaryEntropy`, KullbackLeibler).

  Beacon anchors: Rényi 1961 (α→∞ Rényi entropy = min-entropy); Cover & Thomas, *Elements of
  Information Theory* (entropy, independence-additivity); Dodis–Reyzin–Smith 2004 (min-entropy as the
  cryptographic guessing-hardness measure); Bell 1964 (single-body floor, lifted to a pair). Mathlib:
  `Real.logb` / `Real.logb_mul` (`Mathlib/Analysis/SpecialFunctions/Log/Base.lean`), `Finset.sup'`
  (`Mathlib/Data/Finset/Lattice/Fold.lean`).
-/
import Mathlib.Analysis.SpecialFunctions.Log.Base
import Mathlib.Data.Finset.Lattice.Fold
import Mathlib.Algebra.Order.BigOperators.Group.Finset

namespace Zeta.EntropyMeasureTheoretic

open Real

/-- A finite probability distribution modelled measure-theoretically: a **nonempty** finite set of
    outcomes `outcomes` over a type `Ω`, with an `ℝ`-valued probability mass `p`, each mass `> 0` on
    the support. (Strict positivity on the listed outcomes keeps `logb` well-behaved and matches the
    cryptographic setting where `pmax > 0`; outcomes of probability 0 are simply not listed.) -/
structure FinDist (Ω : Type*) [DecidableEq Ω] where
  outcomes : Finset Ω
  nonempty : outcomes.Nonempty
  p : Ω → ℝ
  pos : ∀ x ∈ outcomes, 0 < p x

variable {Ω Ω' : Type*} [DecidableEq Ω] [DecidableEq Ω']

/-- **Guessing probability** `pmax(D) = max_{x ∈ outcomes} p(x)` — the adversary's optimal single
    guess. Uses `Finset.sup'` (well-defined because `outcomes` is nonempty). -/
noncomputable def pmax (D : FinDist Ω) : ℝ := D.outcomes.sup' D.nonempty D.p

/-- `pmax` is strictly positive (the max of strictly-positive masses), so `logb` is well-defined. -/
theorem pmax_pos (D : FinDist Ω) : 0 < pmax D := by
  obtain ⟨x, hx⟩ := D.nonempty
  exact lt_of_lt_of_le (D.pos x hx) (Finset.le_sup' D.p hx)

/-- **Min-entropy** `H_∞(D) = − logb 2 (pmax D)`, base-2 (Rényi α→∞ / Dodis–Reyzin–Smith). -/
noncomputable def Hmin (D : FinDist Ω) : ℝ := - logb 2 (pmax D)

/-- The **product** (independent join) of two distributions: outcomes are the Cartesian product and
    the joint mass factorizes, `p(a,b) = pa(a) · pb(b)` — the relational NFT minted from two
    INDEPENDENT bodies. -/
noncomputable def product (A : FinDist Ω) (B : FinDist Ω') : FinDist (Ω × Ω') where
  outcomes := A.outcomes ×ˢ B.outcomes
  nonempty := A.nonempty.product B.nonempty
  p := fun q => A.p q.1 * B.p q.2
  pos := by
    intro q hq
    rw [Finset.mem_product] at hq
    exact mul_pos (A.pos q.1 hq.1) (B.pos q.2 hq.2)

/-- **The product distribution's guessing probability FACTORIZES** (the load-bearing arithmetic):
    `pmax(A × B) = pmax A · pmax B`. Maximising a product of independent nonneg masses = product of
    the maxima. This is the measure-theoretic core the lift rests on. -/
theorem pmax_product (A : FinDist Ω) (B : FinDist Ω') :
    pmax (product A B) = pmax A * pmax B := by
  -- `pmax (product A B)` is `(A.outcomes ×ˢ B.outcomes).sup' _ (fun q => A.p q.1 * B.p q.2)`.
  have hmem_iff : ∀ q : Ω × Ω',
      q ∈ (product A B).outcomes ↔ q.1 ∈ A.outcomes ∧ q.2 ∈ B.outcomes := by
    intro q; exact Finset.mem_product
  apply le_antisymm
  · -- every joint mass ≤ pmaxA * pmaxB, so the sup' is too
    refine Finset.sup'_le _ _ ?_
    intro q hq
    obtain ⟨hq1, hq2⟩ := (hmem_iff q).mp hq
    have ha : A.p q.1 ≤ pmax A := Finset.le_sup' A.p hq1
    have hb : B.p q.2 ≤ pmax B := Finset.le_sup' B.p hq2
    have ha0 : 0 ≤ A.p q.1 := le_of_lt (A.pos q.1 hq1)
    show A.p q.1 * B.p q.2 ≤ pmax A * pmax B
    calc A.p q.1 * B.p q.2 ≤ pmax A * B.p q.2 :=
            mul_le_mul_of_nonneg_right ha (le_of_lt (B.pos q.2 hq2))
      _ ≤ pmax A * pmax B := mul_le_mul_of_nonneg_left hb (le_trans ha0 ha)
  · -- pmaxA * pmaxB is achieved at the maximising pair, so it ≤ the sup'
    obtain ⟨a, ha, hamax⟩ := Finset.exists_mem_eq_sup' A.nonempty A.p
    obtain ⟨b, hb, hbmax⟩ := Finset.exists_mem_eq_sup' B.nonempty B.p
    have hmem : (a, b) ∈ (product A B).outcomes := (hmem_iff (a, b)).mpr ⟨ha, hb⟩
    have heq : pmax A * pmax B = (product A B).p (a, b) := by
      show pmax A * pmax B = A.p a * B.p b
      simp only [pmax] at *
      rw [hamax, hbmax]
    rw [heq]
    exact Finset.le_sup' (product A B).p hmem

/-- **THE LIFT (row 1, measure-theoretic tier):** min-entropy of an INDEPENDENT pair EQUALS the sum
    of the single-body min-entropies, `H_∞(A × B) = H_∞(A) + H_∞(B)`. The entropy floor lifts from a
    single body to a pair and ADDS exactly — the real-distribution form of `EntropyFloorLift.floor_lifts`
    (which proved the `≥` floor combinatorially; here it is an equality over `ℝ`). -/
theorem Hmin_product (A : FinDist Ω) (B : FinDist Ω') :
    Hmin (product A B) = Hmin A + Hmin B := by
  unfold Hmin
  rw [pmax_product, logb_mul (ne_of_gt (pmax_pos A)) (ne_of_gt (pmax_pos B))]
  ring

/-- **Forgery-resistance floor (≥ form, matching `EntropyFloorLift.hasFloor`):** with single-body
    min-entropy floors `H_∞(A) ≥ ka`, `H_∞(B) ≥ kb`, the independent pair carries `H_∞(A × B) ≥
    ka + kb`. Recovers the row-1 `≥`-lift as a corollary of the exact equality. -/
theorem Hmin_product_ge {A : FinDist Ω} {B : FinDist Ω'} {ka kb : ℝ}
    (ha : ka ≤ Hmin A) (hb : kb ≤ Hmin B) : ka + kb ≤ Hmin (product A B) := by
  rw [Hmin_product]; exact add_le_add ha hb

/-- The pair floor is never WEAKER than the left body's floor, given the right body carries at least
    its own (a relational NFT is at least as forgery-resistant as either body). Mirrors
    `EntropyFloorLift.pair_floor_ge_left`. -/
theorem Hmin_product_ge_left {A : FinDist Ω} {B : FinDist Ω'} {ka : ℝ}
    (ha : ka ≤ Hmin A) (hB : 0 ≤ Hmin B) : ka ≤ Hmin (product A B) := by
  rw [Hmin_product]
  linarith

/-- **Non-negativity sanity:** a genuine distribution (`pmax ≤ 1`, automatic when the masses are a
    sub-probability summing to ≤ 1) has non-negative min-entropy. Stated as the clean hypothesis
    `pmax ≤ 1`; rules out a vacuous reading of `Hmin`. -/
theorem Hmin_nonneg {D : FinDist Ω} (h : pmax D ≤ 1) : 0 ≤ Hmin D := by
  unfold Hmin
  have hb : (1 : ℝ) < 2 := by norm_num
  have := logb_nonpos hb (le_of_lt (pmax_pos D)) h
  linarith

end Zeta.EntropyMeasureTheoretic
