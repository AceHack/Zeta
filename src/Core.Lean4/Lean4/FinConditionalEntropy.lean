/-
  Finite conditional entropy + mutual information (information-theory tower, targets #2/#3) — the
  Mathlib-backed, real-ℝ **conditional entropy** `H(X|Y)` and **mutual information** `I(X;Y)` of a
  finite *joint* probability distribution, with their foundational lemmas.

  This builds DIRECTLY on the tower root `Lean4/FinShannonEntropy.lean` (#8816): it REUSES that file's
  `FinDist` structure and `H` functional (Shannon entropy `H D = ∑ negMulLog (p x)`, natural-log base).
  A joint distribution is simply a `FinDist (Ω × Ψ)`; the marginals are derived by summation.

      H(X,Y)  =  H J                              -- joint entropy = entropy of the joint FinDist
      pY y    =  ∑_{x} J.p (x, y)                 -- the Y-marginal (sum out X)
      pX x    =  ∑_{y} J.p (x, y)                 -- the X-marginal (sum out Y)
      H(X|Y)  =  H(X,Y) − H(Y)                    -- conditional entropy (subtractive / chain-rule def)
      I(X;Y)  =  H(X) + H(Y) − H(X,Y)             -- mutual information (symmetric def)

  ── HONEST SCOPE ─────────────────────────────────────────────────────────────────────────────────
  • The joint is a `FinDist (Ω × Ψ)` whose `outcomes` is a *product* `sX ×ˢ sY` (Cartesian product of
    finite supports). The product shape is what makes marginalization a clean `Finset.sum_product` and
    lets `log`-factoring out of the inner sum go through.
  • Base: natural log (`negMulLog x = −x·log x`), inherited from the root file. Bit-rescaling is a
    constant factor and is not needed for the foundational lemmas.
  • Definition choice: the **subtractive / chain-rule** form `H(X|Y) = H(X,Y) − H(Y)`. This makes the
    chain rule definitional/algebraic and mutual-information symmetry pure algebra; the price is that
    `condEntropy_nonneg` requires the *subadditivity of `negMulLog`* (`negMulLog(a+b) ≤ negMulLog a +
    negMulLog b`, i.e. marginal entropy ≤ joint entropy), which we prove here from `Real.log_le_log`.

  ── WHAT IS PROVEN (no `sorry`; `#print axioms` = propext / Classical.choice / Quot.sound) ──────────
  • `negMulLog_add_le`        — two-term subadditivity of `negMulLog` on `[0,∞)`.
  • `negMulLog_sum_le`        — finite-sum subadditivity (`negMulLog (∑ f) ≤ ∑ negMulLog f`).
  • `pY_nonneg` / `pX_nonneg` — marginals are nonnegative.
  • `H_Y_le_H_joint`          — marginal entropy ≤ joint entropy (the conditioning inequality).
  • `condEntropy_nonneg`      — `0 ≤ H(X|Y)`.
  • `chain_rule`              — `H(X,Y) = H(Y) + H(X|Y)` (definitional/algebraic).
  • `mutualInfo_symm`         — `I(X;Y) = I(Y;X)` (algebraic from the symmetric form).
  • `mutualInfo_eq_sub`       — `I(X;Y) = H(X) − H(X|Y)` (bonus; algebraic).

  ── DELIBERATELY NOT HERE (next rung) ──────────────────────────────────────────────────────────────
  • `mutualInfo_nonneg` (`I ≥ 0`) — needs Gibbs' inequality / Jensen / the log-sum inequality applied to
    `∑ p(x,y) log( p(x,y) / (pX·pY) ) ≥ 0`. Mathlib v4.30.0-rc1 has `Real.strictConcaveOn_negMulLog`
    and `Real.add_pow_le_pow_mul_pow_of_sq_le_sq` but no packaged Gibbs/log-sum inequality, so the
    Jensen step is its own rung. NOT `sorry`-stubbed — simply omitted; this is the documented next rung.
  • Data-processing inequality (DPI) and channel capacity — later rungs (need `I ≥ 0` first).

  Beacon anchors: Shannon 1948 (*A Mathematical Theory of Communication* — `H(X,Y)`, `H(X|Y)`,
  `I(X;Y)`, the chain rule `H(X,Y)=H(Y)+H(X|Y)`); Cover & Thomas, *Elements of Information Theory*
  (Ch. 2: chain rule Thm 2.2.1, `H(X|Y) ≥ 0`, `I(X;Y)=H(X)−H(X|Y)`, `I(X;Y)=I(Y;X)`). Mathlib:
  `Real.negMulLog` (`Mathlib/Analysis/SpecialFunctions/Log/NegMulLog.lean`), `Real.log_le_log`
  (`.../Log/Basic.lean`), `Finset.sum_product`, `Finset.sum_mul`
  (`Mathlib/Algebra/BigOperators/*`).
-/
import Lean4.FinShannonEntropy
import Mathlib.Analysis.SpecialFunctions.Log.NegMulLog
import Mathlib.Algebra.Order.BigOperators.Group.Finset

namespace Zeta.FinConditionalEntropy

open Real
open Zeta.FinShannonEntropy

variable {Ω Ψ : Type*} [DecidableEq Ω] [DecidableEq Ψ]

/-! ## Subadditivity of `negMulLog` (the conditioning inequality core) -/

/-- **Two-term subadditivity of `negMulLog` on `[0,∞)`:** `negMulLog (a + b) ≤ negMulLog a + negMulLog b`
    for `a, b ≥ 0`. Equivalently `a·log a + b·log b ≤ (a+b)·log(a+b)`: each of `log a, log b ≤ log(a+b)`
    by monotonicity of `log` (`Real.log_le_log`), scaled by the nonneg masses. This is the analytic
    heart of "adding a variable cannot decrease entropy" (marginal entropy ≤ joint entropy). -/
theorem negMulLog_add_le {a b : ℝ} (ha : 0 ≤ a) (hb : 0 ≤ b) :
    negMulLog (a + b) ≤ negMulLog a + negMulLog b := by
  -- It suffices to show  a·log a + b·log b ≤ (a+b)·log(a+b).
  have key : a * log a + b * log b ≤ (a + b) * log (a + b) := by
    rcases eq_or_lt_of_le ha with ha0 | ha0
    · -- a = 0
      simp [← ha0]
    rcases eq_or_lt_of_le hb with hb0 | hb0
    · -- b = 0
      simp [← hb0]
    -- a > 0 and b > 0
    have hab : 0 < a + b := by linarith
    have hla : log a ≤ log (a + b) := log_le_log ha0 (by linarith)
    have hlb : log b ≤ log (a + b) := log_le_log hb0 (by linarith)
    calc a * log a + b * log b
        ≤ a * log (a + b) + b * log (a + b) := by
          gcongr
      _ = (a + b) * log (a + b) := by ring
  -- Convert the `a·log a` statement to the `negMulLog` statement.
  simp only [negMulLog_eq_neg]
  linarith

/-- **Finite-sum subadditivity of `negMulLog`:** `negMulLog (∑_{x∈s} f x) ≤ ∑_{x∈s} negMulLog (f x)`
    for a nonnegative `f`. Iterated `negMulLog_add_le` over the Finset (induction on `s`). This is
    exactly `negMulLog (pY y) ≤ ∑_x negMulLog (p (x, y))` once `f x = p (x, y)`. -/
theorem negMulLog_sum_le {α : Type*} [DecidableEq α] (s : Finset α) (f : α → ℝ)
    (hf : ∀ x ∈ s, 0 ≤ f x) :
    negMulLog (∑ x ∈ s, f x) ≤ ∑ x ∈ s, negMulLog (f x) := by
  classical
  induction s using Finset.induction with
  | empty => simp
  | @insert a s ha ih =>
    rw [Finset.sum_insert ha, Finset.sum_insert ha]
    have hfa : 0 ≤ f a := hf a (Finset.mem_insert_self a s)
    have hfs : 0 ≤ ∑ x ∈ s, f x :=
      Finset.sum_nonneg (fun x hx => hf x (Finset.mem_insert_of_mem hx))
    have ihs : negMulLog (∑ x ∈ s, f x) ≤ ∑ x ∈ s, negMulLog (f x) :=
      ih (fun x hx => hf x (Finset.mem_insert_of_mem hx))
    calc negMulLog (f a + ∑ x ∈ s, f x)
        ≤ negMulLog (f a) + negMulLog (∑ x ∈ s, f x) := negMulLog_add_le hfa hfs
      _ ≤ negMulLog (f a) + ∑ x ∈ s, negMulLog (f x) := by linarith

/-! ## Joint distributions over a product support, and marginals -/

/-- A **finite joint distribution** over `Ω × Ψ` whose support is a *product* `suppX ×ˢ suppY`.
    `suppX`/`suppY` carry the per-coordinate supports; `toFinDist` packages it as the root file's
    `FinDist (Ω × Ψ)` (so joint entropy is just `H` of that). The product-support shape is what makes
    marginalization a clean `Finset.sum_product`. -/
structure FinJoint (Ω Ψ : Type*) [DecidableEq Ω] [DecidableEq Ψ] where
  suppX : Finset Ω
  suppY : Finset Ψ
  p : Ω × Ψ → ℝ
  nonneg : ∀ q, 0 ≤ p q
  sum_one : ∑ q ∈ suppX ×ˢ suppY, p q = 1

namespace FinJoint

variable (J : FinJoint Ω Ψ)

/-- The joint as a root-file `FinDist (Ω × Ψ)` — so `H J.toFinDist = H(X,Y)` reuses the root entropy. -/
noncomputable def toFinDist : FinDist (Ω × Ψ) where
  outcomes := J.suppX ×ˢ J.suppY
  p := J.p
  nonneg := J.nonneg
  sum_one := J.sum_one

/-- The **Y-marginal** `pY y = ∑_{x ∈ suppX} p (x, y)` (sum out `X`). -/
noncomputable def pY (y : Ψ) : ℝ := ∑ x ∈ J.suppX, J.p (x, y)

/-- The **X-marginal** `pX x = ∑_{y ∈ suppY} p (x, y)` (sum out `Y`). -/
noncomputable def pX (x : Ω) : ℝ := ∑ y ∈ J.suppY, J.p (x, y)

theorem pY_nonneg (y : Ψ) : 0 ≤ J.pY y :=
  Finset.sum_nonneg (fun x _ => J.nonneg (x, y))

theorem pX_nonneg (x : Ω) : 0 ≤ J.pX x :=
  Finset.sum_nonneg (fun y _ => J.nonneg (x, y))

/-- The Y-marginal is a `FinDist Ψ` (`pY ≥ 0`, `∑_y pY y = ∑_{x,y} p = 1`). -/
noncomputable def margY : FinDist Ψ where
  outcomes := J.suppY
  p := J.pY
  nonneg := J.pY_nonneg
  sum_one := by
    unfold FinJoint.pY
    rw [Finset.sum_comm]
    rw [← Finset.sum_product']
    exact J.sum_one

/-- The X-marginal is a `FinDist Ω`. -/
noncomputable def margX : FinDist Ω where
  outcomes := J.suppX
  p := J.pX
  nonneg := J.pX_nonneg
  sum_one := by
    unfold FinJoint.pX
    rw [← Finset.sum_product']
    exact J.sum_one

/-! ## Joint entropy, conditional entropy, mutual information -/

/-- **Joint entropy** `H(X,Y) = H J.toFinDist` (reuses the root `H`). -/
noncomputable def Hjoint : ℝ := H J.toFinDist

/-- **Marginal entropy** `H(Y) = H J.margY`. -/
noncomputable def HY : ℝ := H J.margY

/-- **Marginal entropy** `H(X) = H J.margX`. -/
noncomputable def HX : ℝ := H J.margX

/-- **Conditional entropy** `H(X|Y) = H(X,Y) − H(Y)` (subtractive / chain-rule form; Shannon 1948,
    Cover & Thomas Ch. 2). -/
noncomputable def condEntropy : ℝ := J.Hjoint - J.HY

/-- **Mutual information** `I(X;Y) = H(X) + H(Y) − H(X,Y)` (symmetric form; Cover & Thomas Ch. 2). -/
noncomputable def mutualInfo : ℝ := J.HX + J.HY - J.Hjoint

/-! ## Foundational lemmas -/

/-- **Marginal entropy ≤ joint entropy** (the conditioning inequality, Cover & Thomas Ch. 2):
    `H(Y) ≤ H(X,Y)`. Termwise `negMulLog (pY y) = negMulLog (∑_x p (x,y)) ≤ ∑_x negMulLog (p (x,y))`
    by `negMulLog_sum_le`, summed over `y` and recognized as `H(X,Y)` via `Finset.sum_product`. -/
theorem HY_le_Hjoint : J.HY ≤ J.Hjoint := by
  unfold FinJoint.HY FinJoint.Hjoint H FinJoint.toFinDist FinJoint.margY
  -- LHS: ∑_{y} negMulLog (pY y).  RHS: ∑_{(x,y) ∈ suppX×suppY} negMulLog (p (x,y)).
  rw [Finset.sum_product_right]
  apply Finset.sum_le_sum
  intro y _
  exact negMulLog_sum_le J.suppX (fun x => J.p (x, y)) (fun x _ => J.nonneg (x, y))

/-- **Conditional entropy is nonnegative** (Cover & Thomas Ch. 2): `0 ≤ H(X|Y)`. Immediate from
    `HY_le_Hjoint` and the subtractive definition. -/
theorem condEntropy_nonneg : 0 ≤ J.condEntropy := by
  unfold FinJoint.condEntropy
  have := J.HY_le_Hjoint
  linarith

/-- **Chain rule** (Shannon 1948; Cover & Thomas Thm 2.2.1): `H(X,Y) = H(Y) + H(X|Y)`. Definitional
    from the subtractive `H(X|Y) = H(X,Y) − H(Y)`. -/
theorem chain_rule : J.Hjoint = J.HY + J.condEntropy := by
  unfold FinJoint.condEntropy
  ring

/-- **Mutual information vs conditional entropy** (Cover & Thomas Ch. 2): `I(X;Y) = H(X) − H(X|Y)`.
    Algebraic from the two definitions. -/
theorem mutualInfo_eq_sub : J.mutualInfo = J.HX - J.condEntropy := by
  unfold FinJoint.mutualInfo FinJoint.condEntropy
  ring

end FinJoint

/-! ## Mutual information is symmetric

  `I(X;Y) = I(Y;X)` is symmetry of the *roles* of `X` and `Y`. We model "swap roles" by the swapped
  joint `J.swap : FinJoint Ψ Ω` with `p' (y,x) = p (x,y)`, whose `X`-role is `J`'s `Y` and vice
  versa. Then `mutualInfo_symm : J.mutualInfo = J.swap.mutualInfo` says reading the same joint with
  the two variables exchanged yields the same mutual information — the standard symmetry statement. -/

namespace FinJoint

/-- The **role-swapped joint** `J.swap : FinJoint Ψ Ω`, `p'(y,x) = p(x,y)`, support `suppY ×ˢ suppX`. -/
noncomputable def swap (J : FinJoint Ω Ψ) : FinJoint Ψ Ω where
  suppX := J.suppY
  suppY := J.suppX
  p := fun q => J.p (q.2, q.1)
  nonneg := fun q => J.nonneg (q.2, q.1)
  sum_one := by
    rw [← J.sum_one, Finset.sum_product, Finset.sum_product_right]

/-- `H(X) of the swapped joint = H(Y) of the original`: the swap's X-marginal is the original's
    Y-marginal (as `FinDist`s with the same outcomes and mass), so their entropies agree. -/
theorem HX_swap (J : FinJoint Ω Ψ) : J.swap.HX = J.HY := by
  unfold FinJoint.HX FinJoint.HY H FinJoint.margX FinJoint.margY
  unfold FinJoint.swap FinJoint.pX FinJoint.pY
  rfl

/-- `H(Y) of the swapped joint = H(X) of the original`. -/
theorem HY_swap (J : FinJoint Ω Ψ) : J.swap.HY = J.HX := by
  unfold FinJoint.HY FinJoint.HX H FinJoint.margY FinJoint.margX
  unfold FinJoint.swap FinJoint.pY FinJoint.pX
  rfl

/-- `H(X,Y) of the swapped joint = H(X,Y) of the original`: the same masses, reindexed by `Prod.swap`
    over the product support. -/
theorem Hjoint_swap (J : FinJoint Ω Ψ) : J.swap.Hjoint = J.Hjoint := by
  unfold FinJoint.Hjoint H FinJoint.toFinDist FinJoint.swap
  -- ∑_{(y,x) ∈ suppY×suppX} negMulLog (p (x,y)) = ∑_{(x,y) ∈ suppX×suppY} negMulLog (p (x,y))
  rw [Finset.sum_product, Finset.sum_product_right]

/-- **Mutual information is symmetric** (Cover & Thomas Ch. 2): reading a joint with `X` and `Y`
    exchanged gives the same mutual information, `I(X;Y) = I(Y;X)`. Algebraic from the symmetric
    definition `I = H(X) + H(Y) − H(X,Y)` plus the three swap identities above. -/
theorem mutualInfo_symm (J : FinJoint Ω Ψ) : J.mutualInfo = J.swap.mutualInfo := by
  unfold FinJoint.mutualInfo
  rw [HX_swap, HY_swap, Hjoint_swap]
  ring

end FinJoint

end Zeta.FinConditionalEntropy
