/-
  Mutual-information non-negativity (information-theory tower, target #4) — the Mathlib-backed,
  real-ℝ proof that **`I(X;Y) ≥ 0`** for a finite joint distribution, equivalently the conditioning
  inequality **`H(X|Y) ≤ H(X)`**. This is the rung named-missing by `Lean4/FinConditionalEntropy.lean`
  (#8832) and the gate to the data-processing inequality (DPI) + channel capacity.

  This builds DIRECTLY on the two tower files below it — it REUSES, and never redefines, their entropy /
  conditional-entropy / mutual-information definitions:
    • `Lean4/FinShannonEntropy.lean`     (#8816) — `FinDist`, `H = ∑ negMulLog (p x)`, `H_nonneg`.
    • `Lean4/FinConditionalEntropy.lean` (#8832) — `FinJoint`, `pX`/`pY`, `Hjoint`/`HX`/`HY`,
      `condEntropy = Hjoint − HY`, `mutualInfo = HX + HY − Hjoint`, `mutualInfo_eq_sub`.

  ── ROUTE THAT CLOSED ───────────────────────────────────────────────────────────────────────────────
  Route 1 (log-sum / Gibbs), in its **elementary** form. Mathlib v4.30.0-rc1 has NO packaged finite
  Jensen / log-sum / Gibbs inequality (`Real.strictConcaveOn_negMulLog`, `klDiv`, `strictConvexOn_klFun`
  exist, but no `∑ aᵢ log(aᵢ/bᵢ) ≥ …` lemma). Rather than assemble Finset-weighted Jensen out of the
  convexity API (heavy), we use the elementary one-line bound `log x ≤ x − 1`
  (`Real.log_le_sub_one_of_pos`) — the classical Gibbs trick (Cover & Thomas, Thm 2.6.3, proof via
  `log t ≤ t − 1`). It gives the finite Gibbs inequality with no measure-theory plumbing.

  ── THE ARGUMENT ────────────────────────────────────────────────────────────────────────────────────
  Gibbs (pointwise, `gibbs_pointwise`):  for masses `p, q ≥ 0` with `p = 0 ∨ 0 < q`,
        p − q ≤ p·log p − p·log q                                   (= p·log(p/q) when p,q > 0).
  Summed (`gibbs_sum`):   `∑(pᵢ − qᵢ) ≤ ∑(pᵢ·log pᵢ − pᵢ·log qᵢ)`,  so for two prob vectors (∑p = ∑q = 1)
        0 ≤ ∑ pᵢ·log pᵢ − ∑ pᵢ·log qᵢ  =  −∑ negMulLog pᵢ + ∑ pᵢ·log qᵢ ·(−1)…  (Gibbs / KL ≥ 0).
  Specialize to `pᵢ = p(x,y)`, `qᵢ = pX(x)·pY(y)` over the product support. The product-marginal
  log factors (`log(pX·pY) = log pX + log pY` where positive) and the marginal sums collapse
  (`∑_y p(x,y) = pX x`, `∑_x p(x,y) = pY y`) give `−∑ p·log(pX·pY) = HX + HY`, while
  `−∑ p·log p = Hjoint`. Hence `0 ≤ HX + HY − Hjoint = mutualInfo`.

  ── WHAT IS PROVEN (no `sorry`; `#print axioms` = propext / Classical.choice / Quot.sound) ────────────
  • `gibbs_pointwise`   — the elementary pointwise Gibbs bound (reusable, the analytic heart).
  • `gibbs_sum`         — the finite Gibbs / log-sum inequality over a Finset (reusable for DPI).
  • `mutualInfo_nonneg` — `0 ≤ I(X;Y)`.
  • `condEntropy_le_HX` — `H(X|Y) ≤ H(X)` (the conditioning inequality; immediate corollary).

  ── DELIBERATELY NOT HERE (next rungs) ───────────────────────────────────────────────────────────────
  • Data-processing inequality (DPI) and channel capacity — the rungs AFTER this one (they need
    `I ≥ 0`, now available). `gibbs_sum` is the reusable lemma they will hang off.

  Beacon anchors: Gibbs 1902 (Gibbs' inequality); Shannon 1948 (`I(X;Y) ≥ 0`); Cover & Thomas,
  *Elements of Information Theory* (Thm 2.6.3 information inequality / Gibbs via `log t ≤ t − 1`;
  Thm 2.6.5 `I(X;Y) ≥ 0`; `H(X|Y) ≤ H(X)`). Mathlib: `Real.log_le_sub_one_of_pos`
  (`Mathlib/Analysis/SpecialFunctions/Log/Basic.lean`), `Real.negMulLog` /  `Real.log_mul`,
  `Finset.sum_le_sum`, `Finset.sum_product`/`Finset.mul_sum` (`Mathlib/Algebra/BigOperators/*`).
-/
import Lean4.FinShannonEntropy
import Lean4.FinConditionalEntropy
import Mathlib.Analysis.SpecialFunctions.Log.NegMulLog
import Mathlib.Analysis.SpecialFunctions.Log.Basic
import Mathlib.Algebra.Order.BigOperators.Group.Finset

namespace Zeta.FinMutualInfoNonneg

open Real
open Zeta.FinShannonEntropy
open Zeta.FinConditionalEntropy

variable {Ω Ψ : Type*} [DecidableEq Ω] [DecidableEq Ψ]

/-! ## The finite Gibbs / log-sum inequality (Route 1, elementary `log t ≤ t − 1` form) -/

/-- **Pointwise Gibbs bound** (Cover & Thomas, proof of Thm 2.6.3, via `log t ≤ t − 1`):
    for masses `p, q ≥ 0` with `q` strictly positive wherever `p` is (`p = 0 ∨ 0 < q`),
        `p − q ≤ p·log p − p·log q`     (which is `p·log (p/q)` when both are positive).
    Proof: if `p = 0` the LHS is `−q ≤ 0`; otherwise `q > 0` and
    `log (q/p) ≤ q/p − 1` (`Real.log_le_sub_one_of_pos`) scaled by `p > 0` rearranges to the claim. -/
theorem gibbs_pointwise {p q : ℝ} (hp : 0 ≤ p) (hq : 0 ≤ q) (hpq : p = 0 ∨ 0 < q) :
    p - q ≤ p * log p - p * log q := by
  rcases eq_or_lt_of_le hp with hp0 | hp0
  · -- p = 0:  LHS = -q ≤ 0 = RHS
    simp [← hp0]
    linarith
  · -- p > 0, hence q > 0
    have hqpos : 0 < q := by
      rcases hpq with h | h
      · exact absurd h.symm (ne_of_lt hp0)
      · exact h
    -- log (q / p) ≤ q / p - 1
    have hlog : log (q / p) ≤ q / p - 1 :=
      log_le_sub_one_of_pos (div_pos hqpos hp0)
    -- log (q/p) = log q - log p
    have hsplit : log (q / p) = log q - log p := log_div (ne_of_gt hqpos) (ne_of_gt hp0)
    -- scale by p > 0:  p * log(q/p) ≤ p * (q/p - 1) = q - p
    have hscaled : p * log (q / p) ≤ p * (q / p - 1) :=
      mul_le_mul_of_nonneg_left hlog hp
    have hrhs : p * (q / p - 1) = q - p := by
      field_simp
    -- p * (log q - log p) ≤ q - p  ⟹  rearrange
    rw [hsplit] at hscaled
    rw [hrhs] at hscaled
    -- hscaled : p * (log q - log p) ≤ q - p
    nlinarith [hscaled]

/-- **Finite Gibbs / log-sum inequality** (the reusable lemma; Gibbs 1902, Cover & Thomas Thm 2.6.3):
    for `p, q : α → ℝ` nonnegative on a Finset `s`, with `q` positive wherever `p` is,
        `∑ (p x − q x)  ≤  ∑ (p x · log (p x) − p x · log (q x))`.
    Specialized to two probability vectors (`∑ p = ∑ q = 1`) the LHS is `0`, giving Gibbs' inequality
    `0 ≤ ∑ p·log p − ∑ p·log q` (equivalently `∑ negMulLog p ≤ − ∑ p·log q`, i.e. `KL(p‖q) ≥ 0`).
    Termwise `gibbs_pointwise` under `Finset.sum_le_sum`, then split the sums. -/
theorem gibbs_sum {α : Type*} (s : Finset α) (p q : α → ℝ)
    (hp : ∀ x ∈ s, 0 ≤ p x) (hq : ∀ x ∈ s, 0 ≤ q x)
    (hpq : ∀ x ∈ s, p x = 0 ∨ 0 < q x) :
    ∑ x ∈ s, (p x - q x) ≤ ∑ x ∈ s, (p x * log (p x) - p x * log (q x)) := by
  apply Finset.sum_le_sum
  intro x hx
  exact gibbs_pointwise (hp x hx) (hq x hx) (hpq x hx)

/-! ## Specialization to mutual information -/

namespace FinJoint

variable (J : FinJoint Ω Ψ)

/-- The product-of-marginals mass `b(x,y) = pX(x)·pY(y)` over the product support sums to `1`
    (`∑ pX = ∑ pY = 1`, so `∑_{x,y} pX·pY = 1`). The `q`-vector of the Gibbs specialization. -/
theorem sum_prod_marg_one :
    ∑ q ∈ J.suppX ×ˢ J.suppY, J.pX q.1 * J.pY q.2 = 1 := by
  rw [Finset.sum_product]
  rw [← Finset.sum_mul_sum]
  have hX : ∑ x ∈ J.suppX, J.pX x = 1 := J.margX.sum_one
  have hY : ∑ y ∈ J.suppY, J.pY y = 1 := J.margY.sum_one
  rw [hX, hY]; ring

/-- `HX + HY = − ∑_{(x,y)} p(x,y) · log (pX x · pY y)` over the product support.
    The marginal-product log factors (`log (pX·pY) = log pX + log pY`, valid because every term with
    `p(x,y) > 0` forces `pX x ≥ p(x,y) > 0` and `pY y ≥ p(x,y) > 0`; the `p = 0` terms contribute `0`
    on both sides), and the inner marginal sums collapse: `∑_y p(x,y) = pX x`, `∑_x p(x,y) = pY y`. -/
theorem HX_add_HY_eq :
    J.HX + J.HY = - ∑ q ∈ J.suppX ×ˢ J.suppY, J.p q * log (J.pX q.1 * J.pY q.2) := by
  -- Rewrite the RHS sum, splitting log (pX·pY) into log pX + log pY termwise.
  have hsplit : ∀ q ∈ J.suppX ×ˢ J.suppY,
      J.p q * log (J.pX q.1 * J.pY q.2)
        = J.p q * log (J.pX q.1) + J.p q * log (J.pY q.2) := by
    intro q hq
    rcases eq_or_lt_of_le (J.nonneg q) with h0 | hpos
    · -- p q = 0:  both sides are 0
      rw [← h0]; ring
    · -- p q > 0:  pX q.1 > 0 and pY q.2 > 0, so log_mul applies
      obtain ⟨hx, hy⟩ := Finset.mem_product.mp hq
      have hpx : 0 < J.pX q.1 := by
        have : J.p (q.1, q.2) ≤ J.pX q.1 :=
          Finset.single_le_sum (fun y _ => J.nonneg (q.1, y)) hy
        have hq12 : J.p (q.1, q.2) = J.p q := by rw [Prod.mk.eta]
        rw [hq12] at this; linarith
      have hpy : 0 < J.pY q.2 := by
        have : J.p (q.1, q.2) ≤ J.pY q.2 :=
          Finset.single_le_sum (fun x _ => J.nonneg (x, q.2)) hx
        have hq12 : J.p (q.1, q.2) = J.p q := by rw [Prod.mk.eta]
        rw [hq12] at this; linarith
      rw [log_mul (ne_of_gt hpx) (ne_of_gt hpy)]; ring
  rw [Finset.sum_congr rfl hsplit]
  rw [Finset.sum_add_distrib]
  -- ∑_{(x,y)} p(x,y) log pX x  =  ∑_x (∑_y p(x,y)) log pX x = ∑_x pX x · log pX x
  have hXsum : ∑ q ∈ J.suppX ×ˢ J.suppY, J.p q * log (J.pX q.1)
      = ∑ x ∈ J.suppX, J.pX x * log (J.pX x) := by
    rw [Finset.sum_product]
    apply Finset.sum_congr rfl
    intro x _
    dsimp only
    rw [← Finset.sum_mul]
    rfl
  -- ∑_{(x,y)} p(x,y) log pY y  =  ∑_y (∑_x p(x,y)) log pY y = ∑_y pY y · log pY y
  have hYsum : ∑ q ∈ J.suppX ×ˢ J.suppY, J.p q * log (J.pY q.2)
      = ∑ y ∈ J.suppY, J.pY y * log (J.pY y) := by
    rw [Finset.sum_product_right]
    apply Finset.sum_congr rfl
    intro y _
    dsimp only
    rw [← Finset.sum_mul]
    rfl
  rw [hXsum, hYsum]
  -- HX = ∑ negMulLog pX = − ∑ pX log pX ; same for HY
  unfold FinJoint.HX FinJoint.HY H FinJoint.margX FinJoint.margY
  simp only [negMulLog_eq_neg]
  rw [Finset.sum_neg_distrib, Finset.sum_neg_distrib]
  ring

/-- `Hjoint = − ∑_{(x,y)} p(x,y) · log (p(x,y))` (just `H` of the joint, `negMulLog = −x·log x`). -/
theorem Hjoint_eq :
    J.Hjoint = - ∑ q ∈ J.suppX ×ˢ J.suppY, J.p q * log (J.p q) := by
  unfold FinJoint.Hjoint H FinJoint.toFinDist
  simp only [negMulLog_eq_neg]
  rw [← Finset.sum_neg_distrib]

/-- **Mutual information is non-negative** (Shannon 1948; Gibbs 1902; Cover & Thomas Thm 2.6.5):
    `0 ≤ I(X;Y)`. Route 1 (elementary Gibbs): apply `gibbs_sum` with `p = p(x,y)` and
    `q = pX(x)·pY(y)` over the product support (both prob vectors, so `∑ p = ∑ q = 1` and the
    log-sum LHS vanishes), then identify `−∑ p·log p = Hjoint` and `−∑ p·log(pX·pY) = HX + HY`. -/
theorem mutualInfo_nonneg : 0 ≤ J.mutualInfo := by
  -- Gibbs hypotheses over the product support `suppX ×ˢ suppY`.
  have hp : ∀ q ∈ J.suppX ×ˢ J.suppY, 0 ≤ J.p q := fun q _ => J.nonneg q
  have hq : ∀ q ∈ J.suppX ×ˢ J.suppY, 0 ≤ J.pX q.1 * J.pY q.2 := fun q _ =>
    mul_nonneg (J.pX_nonneg q.1) (J.pY_nonneg q.2)
  have hpq : ∀ q ∈ J.suppX ×ˢ J.suppY, J.p q = 0 ∨ 0 < J.pX q.1 * J.pY q.2 := by
    intro q hq'
    rcases eq_or_lt_of_le (J.nonneg q) with h0 | hpos
    · exact Or.inl h0.symm
    · refine Or.inr ?_
      obtain ⟨hx, hy⟩ := Finset.mem_product.mp hq'
      have hpx : 0 < J.pX q.1 := by
        have hle : J.p (q.1, q.2) ≤ J.pX q.1 :=
          Finset.single_le_sum (fun y _ => J.nonneg (q.1, y)) hy
        have hq12 : J.p (q.1, q.2) = J.p q := by rw [Prod.mk.eta]
        rw [hq12] at hle; linarith
      have hpy : 0 < J.pY q.2 := by
        have hle : J.p (q.1, q.2) ≤ J.pY q.2 :=
          Finset.single_le_sum (fun x _ => J.nonneg (x, q.2)) hx
        have hq12 : J.p (q.1, q.2) = J.p q := by rw [Prod.mk.eta]
        rw [hq12] at hle; linarith
      exact mul_pos hpx hpy
  -- The Gibbs inequality.
  have hgibbs := gibbs_sum (J.suppX ×ˢ J.suppY) J.p (fun q => J.pX q.1 * J.pY q.2) hp hq hpq
  -- LHS of gibbs = ∑ p − ∑ (pX·pY) = 1 − 1 = 0.
  have hlhs : ∑ q ∈ J.suppX ×ˢ J.suppY, (J.p q - J.pX q.1 * J.pY q.2) = 0 := by
    rw [Finset.sum_sub_distrib, J.sum_one, sum_prod_marg_one J]; ring
  rw [hlhs] at hgibbs
  -- RHS of gibbs = ∑ p·log p − ∑ p·log(pX·pY) = (−Hjoint) − (−(HX+HY)) = HX + HY − Hjoint.
  have hrhs : ∑ q ∈ J.suppX ×ˢ J.suppY,
      (J.p q * log (J.p q) - J.p q * log (J.pX q.1 * J.pY q.2))
      = J.HX + J.HY - J.Hjoint := by
    rw [Finset.sum_sub_distrib]
    have e1 : ∑ q ∈ J.suppX ×ˢ J.suppY, J.p q * log (J.p q) = - J.Hjoint := by
      rw [Hjoint_eq J]; ring
    have e2 : ∑ q ∈ J.suppX ×ˢ J.suppY, J.p q * log (J.pX q.1 * J.pY q.2)
        = - (J.HX + J.HY) := by
      rw [HX_add_HY_eq J]; ring
    rw [e1, e2]; ring
  rw [hrhs] at hgibbs
  -- hgibbs : 0 ≤ HX + HY − Hjoint = mutualInfo
  unfold FinJoint.mutualInfo
  linarith

/-- **Conditioning inequality** (Cover & Thomas, `H(X|Y) ≤ H(X)`): conditioning cannot increase
    entropy. Immediate from `mutualInfo_nonneg` and `mutualInfo_eq_sub` (`I = H(X) − H(X|Y)`). -/
theorem condEntropy_le_HX : J.condEntropy ≤ J.HX := by
  have h := mutualInfo_nonneg J
  rw [J.mutualInfo_eq_sub] at h
  linarith

end FinJoint

end Zeta.FinMutualInfoNonneg
