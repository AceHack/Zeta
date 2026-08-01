/-
  Finite Data-Processing Inequality (DPI) — information-theory tower, the rung above `I ≥ 0`.

  ══ STATUS: PARTIAL RUNG — ONE OPEN OBLIGATION (`sorry`), STATED EXPLICITLY BELOW ══════════════════
  This file is a RESCUE + MERGE of two independently-developed halves, and it is **not** complete.
  Read `§ THE OPEN OBLIGATION` before quoting anything here as proven.

  ── PROVENANCE (why this file looks stitched) ─────────────────────────────────────────────────────
  Two halves were written independently and neither knew about the other:
    • HALF A (was on `main`) — the α-generic Kullback–Leibler lemmas `relEntropy_nonneg`,
      `gibbs_le`, `relEntropy_self`. Complete and `sorry`-free.
    • HALF B (rescued 2026-07-31) — the CONSTRUCTIVE finite Markov-chain model and its marginal
      bookkeeping, recovered from the unpublished, untracked worktree
      `.claude/worktrees/agent-a7dcf28c4e2deb039` (branch `otto/lean-data-processing-inequality`,
      dated 2026-06-21) before that worktree was reclaimed. Complete and `sorry`-free AS FAR AS IT
      GOES — but it stops short of the headline theorem (see below).
  The two halves are COMPLEMENTARY, not competing: zero declaration-name overlap, no redefinition.
  Half A is the analytic lever; half B is the combinatorial model the lever gets applied to.

  ── HONESTY NOTE ON THE RESCUED HEADER (do not repeat this mistake) ───────────────────────────────
  The rescued worktree file carried a header claiming `• dataProcessing — **I(X;Z) ≤ I(X;Y)** (the
  headline DPI, Cover & Thomas Thm 2.8.1)` under a banner reading "WHAT IS PROVEN (no `sorry`)".
  **That claim was false.** No `dataProcessing` declaration existed anywhere in that file; it ended
  at `sum_qf_y`, roughly two-thirds of the way to the theorem. The file contained no `sorry` either
  — which is precisely why the gap was silent: an absent theorem raises no warning, produces no
  `sorryAx`, and passes every axiom audit. A false "what is proven" header is a WORSE failure mode
  than a `sorry`, because `sorry` is loud and a missing declaration is not. This merged file
  therefore states the gap as an explicit `sorry`'d lemma so the build itself reports it.

  ── THE MODEL (constructive Markov chain — no division in the data) ───────────────────────────────
  A Markov chain `X → Y → Z` means `Z ⫫ X | Y`: `Z` is `Y` run through a memoryless channel. It is
  modelled CONSTRUCTIVELY from its two generators, so the factorization is definitional rather than
  a hypothesis to discharge:
    • `base : FinJoint X Y` — the joint of the first two variables.
    • `chan : Y → Z → ℝ`    — the post-processing channel `chan y z = P(Z = z | Y = y)` (a stochastic
                              kernel: `chan y · ≥ 0`, `∑_z chan y z = 1` on the support).
  The full joint is `p(x,y,z) = base.p (x,y) · chan y z`. This is *exactly* the Markov condition
  `p(x,y,z) = p(x,y) · p(z|y)` (Cover & Thomas §2.8); `Z` sees `X` only through `Y`.

  ── THE INTENDED ARGUMENT (one `gibbs_sum`, the KL form of DPI) ───────────────────────────────────
  Write `I(X;Y) − I(X;Z) = ∑_{x,y,z} p(x,y,z) · log( p(x,y,z) / q(x,y,z) )` with comparison
  distribution `q(x,y,z) = pXZ(x,z) · pY(y) · chan y z / pZ(z)`  ( `= pXZ(x,z) · p(y | z)` ).
  Then (i) `q ≥ 0` and `∑ q = 1` (inner sums collapse: `∑_y qf = pXZ`, then `∑_{x,z} pXZ = 1`);
  (ii) by the Markov factorization the log-ratio is `log[pXY/(pX·pY)] − log[pXZ/(pX·pZ)]`, whose
  `p`-weighted sum is `I(X;Y) − I(X;Z)`. `gibbs_sum` (with `∑p = ∑q = 1`, so its LHS is `0`) then
  gives `0 ≤ I(X;Y) − I(X;Z)`. The whole analytic weight rests on `gibbs_sum` — the reusable
  Gibbs / log-sum lemma from the rung below — exactly as `FinMutualInfoNonneg.lean` advertised.

  ── § THE OPEN OBLIGATION (the single `sorry` in this file) ───────────────────────────────────────
  `logRatio_eq_mutualInfo_diff` — step (ii) above, the log-ratio identity

      ∑_{x,y,z} pf·log pf  −  ∑_{x,y,z} pf·log qf   =   I(X;Y) − I(X;Z).

  Everything else the theorem needs is PROVEN below: `sum_pf_one` (∑ pf = 1), `sum_qf_one`
  (∑ qf = 1), `pf_zero_or_qf_pos` (the `gibbs_sum` side condition), and the two collapse lemmas
  `sum_out_y` / `sum_out_z`. `dataProcessing` is then derived from the open lemma at FULL strength —
  the statement `I(X;Z) ≤ I(X;Y)` is NOT weakened to dodge the gap.

  WHAT IT WOULD TAKE. The identity is true and the pen-and-paper derivation is routine; the cost is
  Lean bookkeeping, in three parts:
    (1) Splitting each `log` of a product/quotient (`log_mul`, `log_div`) requires the arguments to
        be nonzero, so every split needs the `rcases eq_or_lt_of_le (nonneg …)` case analysis used by
        `FinMutualInfoNonneg.HX_add_HY_eq` — here over FOUR factors (`base.p`, `pY`, `pXZ`, `pZ`)
        instead of two, on a 3-D index set.
    (2) Re-indexing between the two iteration orders: `sum_out_z` folds `x,y,z` while `sum_out_y`
        folds `x,z,y`, so the two collapses must be aligned with `Finset.sum_comm` before the
        `p`-weighted sums can be subtracted termwise.
    (3) The `log pX` cancellation: `∑_{x,y} base.p·log(pX x) = ∑_x pX x·log(pX x)
        = ∑_{x,z} pXZ·log(pX x)` — sound because `jointXZ_pX_eq` (proven) makes the `X`-marginal
        shared, but it needs both directions of the collapse plus the same positivity case split.
  Estimated at a few hundred lines of `Finset` / `Real.log` manipulation with no new analytic
  content. It is bookkeeping, not mathematics — but it is not yet done, and until it is, this file
  is a PARTIAL rung.

  ── AXIOM LEDGER (verified 2026-07-31 by `#print axioms`, not asserted) ──────────────────────────
  SORRY-FREE (axioms = propext / Classical.choice / Quot.sound only) — 13 declarations:
    relEntropy_nonneg · gibbs_le · relEntropy_self · FinJointLogForm.mutualInfo_eq_logsum ·
    MarkovChain.chan_le_one · jointXZ_pY_eq · jointXZ_pX_eq · sum_out_z · sum_out_y · sum_qf_y ·
    sum_pf3_one · sum_qf3_one · pf3_zero_or_qf3_pos
  CARRIES `sorryAx` — exactly 2 declarations:
    MarkovChain.logRatio_eq_mutualInfo_diff  (the open obligation itself)
    MarkovChain.dataProcessing               (derived from it — the headline theorem)
  Nothing else in this file depends on the gap. `lake build` reports one
  `declaration uses 'sorry'` warning and exits 0.

  ── THE TOWER THIS BUILDS ON (reused, never redefined) ────────────────────────────────────────────
    • `Lean4/FinShannonEntropy.lean`     (#8816) — `FinDist`, `H = ∑ negMulLog (p x)`.
    • `Lean4/FinConditionalEntropy.lean` (#8832) — `FinJoint`, marginals, `mutualInfo`, chain rule.
    • `Lean4/FinMutualInfoNonneg.lean`   (#8848) — **`gibbs_sum`**, the finite Gibbs / log-sum
      inequality `∑(pᵢ−qᵢ) ≤ ∑(pᵢ·log pᵢ − pᵢ·log qᵢ)`, plus `HX_add_HY_eq` / `Hjoint_eq`.

  Not a duplicate of `Lean4/DecorrelationDpi.lean`, which is a different, pure-`Nat`, log-free
  OPERATIONAL DPI over partition cells (the `ρ_owe` decorrelation floor) — same name, disjoint
  content.

  Beacon anchors: Shannon 1948 (mutual information; the Markov-chain data-processing observation);
  Gibbs 1902 (the log-sum inequality the gap rests on); Kullback & Leibler 1951 (relative entropy,
  `D(p‖q) ≥ 0` with equality iff `p = q`); Cover & Thomas, *Elements of Information Theory*,
  Thm 2.6.3 (information inequality), **Thm 2.8.1 (Data-Processing Inequality)** and the Markov
  factorization **§2.8**. Mathlib: `Real.log_mul`, `Real.log_div`, `Finset.sum_product`,
  `Finset.sum_comm`.
-/
import Lean4.FinShannonEntropy
import Lean4.FinConditionalEntropy
import Lean4.FinMutualInfoNonneg
import Mathlib.Analysis.SpecialFunctions.Log.NegMulLog
import Mathlib.Analysis.SpecialFunctions.Log.Basic
import Mathlib.Algebra.Order.BigOperators.Group.Finset

namespace Zeta.FinDataProcessing

open Real
open Zeta.FinShannonEntropy
open Zeta.FinConditionalEntropy
open Zeta.FinMutualInfoNonneg

/-! # Half A — the DPI key lemma: relative entropy (KL divergence) is non-negative

  The α-generic analytic lever. Complete and `sorry`-free. (Was the whole of this file on `main`;
  it is the piece the rescued worktree half never had.) -/

section KeyLemma

variable {α : Type*}

/-- **Relative entropy / Kullback–Leibler divergence is non-negative** (Gibbs 1902; Kullback–Leibler
    1951; Cover & Thomas Thm 2.6.3) — the **data-processing-inequality key lemma**. For two finite
    probability vectors `p, q : α → ℝ` on a common support `s` (each nonnegative, each summing to
    `1`, with `q` strictly positive wherever `p` is), the relative entropy is non-negative:

        `0 ≤ ∑ p·log p − ∑ p·log q`   ( `= D(p ‖ q) = ∑ p·log (p/q) ≥ 0` ).

    Proof: the lever `gibbs_sum` gives `∑ (p − q) ≤ ∑ (p·log p − p·log q)`; the LHS is
    `∑ p − ∑ q = 1 − 1 = 0`, so the RHS is `≥ 0`. This is the single non-negativity fact the data-
    processing inequality `I(X;Z) ≤ I(X;Y)` reduces to (via conditional mutual information). -/
theorem relEntropy_nonneg (s : Finset α) (p q : α → ℝ)
    (hp : ∀ x ∈ s, 0 ≤ p x) (hq : ∀ x ∈ s, 0 ≤ q x)
    (hpq : ∀ x ∈ s, p x = 0 ∨ 0 < q x)
    (hsp : ∑ x ∈ s, p x = 1) (hsq : ∑ x ∈ s, q x = 1) :
    0 ≤ (∑ x ∈ s, p x * log (p x)) - ∑ x ∈ s, p x * log (q x) := by
  -- The lever: ∑ (p − q) ≤ ∑ (p·log p − p·log q).
  have hgibbs := gibbs_sum s p q hp hq hpq
  -- LHS of the lever is 0:  ∑ p − ∑ q = 1 − 1 = 0.
  have hlhs : ∑ x ∈ s, (p x - q x) = 0 := by
    rw [Finset.sum_sub_distrib, hsp, hsq]; ring
  rw [hlhs] at hgibbs
  -- RHS of the lever splits into the two sums.
  rwa [Finset.sum_sub_distrib] at hgibbs

/-- **Gibbs' inequality, cross-entropy form** (Cover & Thomas Thm 2.6.3): the self log-likelihood
    dominates the cross log-likelihood, `∑ p·log q ≤ ∑ p·log p`. This is exactly `relEntropy_nonneg`
    rearranged; it is the form the data-processing inequality quotes when bounding `I(X;Z)` by
    `I(X;Y)` (cross-entropy of the processed channel cannot beat the source's own). -/
theorem gibbs_le (s : Finset α) (p q : α → ℝ)
    (hp : ∀ x ∈ s, 0 ≤ p x) (hq : ∀ x ∈ s, 0 ≤ q x)
    (hpq : ∀ x ∈ s, p x = 0 ∨ 0 < q x)
    (hsp : ∑ x ∈ s, p x = 1) (hsq : ∑ x ∈ s, q x = 1) :
    (∑ x ∈ s, p x * log (q x)) ≤ ∑ x ∈ s, p x * log (p x) := by
  have h := relEntropy_nonneg s p q hp hq hpq hsp hsq
  linarith

/-- **Relative entropy vanishes on the diagonal** (Kullback–Leibler 1951; non-vacuity): `D(p ‖ p) = 0`.
    The two log-likelihood sums coincide, so their difference is `0`. (Confirms the key lemma's bound
    is attained — `relEntropy_nonneg` is tight exactly at `q = p`.) -/
theorem relEntropy_self (s : Finset α) (p : α → ℝ) :
    (∑ x ∈ s, p x * log (p x)) - ∑ x ∈ s, p x * log (p x) = 0 := by
  ring

end KeyLemma

/-! # Half B — the constructive finite Markov chain (rescued 2026-06-21 worktree)

  Everything from here down was recovered from the unpublished
  `otto/lean-data-processing-inequality` worktree. Each declaration below is proven; the half stops
  short of the headline theorem, which is finished (modulo the one open obligation) in Half C. -/

section MarkovModel

variable {X Y Z : Type*} [DecidableEq X] [DecidableEq Y] [DecidableEq Z]

/-! ## Mutual information in explicit log-ratio form (reused for both pairwise joints)

  For any `FinJoint J`, `I(X;Y) = ∑_{(x,y)} p(x,y)·(log p(x,y) − log(pX x · pY y))`. This is just
  `HX + HY − Hjoint` regrouped, using the two identities proven for `mutualInfo_nonneg`
  (`HX_add_HY_eq`, `Hjoint_eq`). We package it once and apply it to `(X,Y)` and `(X,Z)`. -/

namespace FinJointLogForm

open Zeta.FinMutualInfoNonneg.FinJoint

variable {Ω Ψ : Type*} [DecidableEq Ω] [DecidableEq Ψ]

/-- **Mutual information as a single `p·log(p / (pX·pY))` sum.** Regroups
    `I = HX + HY − Hjoint` via `HX_add_HY_eq` (`HX+HY = −∑ p·log(pX·pY)`) and `Hjoint_eq`
    (`Hjoint = −∑ p·log p`). -/
theorem mutualInfo_eq_logsum (J : FinJoint Ω Ψ) :
    J.mutualInfo
      = ∑ q ∈ J.suppX ×ˢ J.suppY,
          (J.p q * log (J.p q) - J.p q * log (J.pX q.1 * J.pY q.2)) := by
  unfold Zeta.FinConditionalEntropy.FinJoint.mutualInfo
  rw [Finset.sum_sub_distrib]
  have e1 : ∑ q ∈ J.suppX ×ˢ J.suppY, J.p q * log (J.p q) = - J.Hjoint := by
    rw [Hjoint_eq J]; ring
  have e2 : ∑ q ∈ J.suppX ×ˢ J.suppY, J.p q * log (J.pX q.1 * J.pY q.2)
      = - (J.HX + J.HY) := by
    rw [HX_add_HY_eq J]; ring
  rw [e1, e2]; ring

end FinJointLogForm

/-! ## The constructive finite Markov chain `X → Y → Z` -/

/-- A **finite Markov chain `X → Y → Z`**, constructively: the joint of the first two variables
    (`base : FinJoint X Y`) post-processed by a stochastic channel `chan : Y → Z → ℝ` (`chan y z =
    P(Z=z | Y=y)`). The full joint is `p(x,y,z) = base.p (x,y) · chan y z`. This *is* the Markov
    condition `Z ⫫ X | Y` (Cover & Thomas §2.8) — `Z` depends on `X` only through `Y`. -/
structure MarkovChain (X Y Z : Type*) [DecidableEq X] [DecidableEq Y] [DecidableEq Z] where
  /-- The joint of the first two variables `(X, Y)`. -/
  base : FinJoint X Y
  /-- The `Z`-outcome support. -/
  suppZ : Finset Z
  /-- The post-processing channel `chan y z = P(Z = z | Y = y)`. -/
  chan : Y → Z → ℝ
  /-- The channel is nonnegative. -/
  chan_nonneg : ∀ y z, 0 ≤ chan y z
  /-- The channel is stochastic: it sums to `1` over `Z` for every `Y` in the base's support. -/
  chan_sum_one : ∀ y ∈ base.suppY, ∑ z ∈ suppZ, chan y z = 1

namespace MarkovChain

variable (M : MarkovChain X Y Z)

theorem chan_le_one {y : Y} (hy : y ∈ M.base.suppY) (z : Z) (hz : z ∈ M.suppZ) :
    M.chan y z ≤ 1 := by
  calc M.chan y z ≤ ∑ z' ∈ M.suppZ, M.chan y z' :=
        Finset.single_le_sum (fun z' _ => M.chan_nonneg y z') hz
    _ = 1 := M.chan_sum_one y hy

/-! ## The two pairwise joints `(X,Y)` and `(X,Z)` -/

/-- The `(X, Y)` joint of the chain is just `base`. So `I(X;Y) = M.base.mutualInfo`. -/
def jointXY : FinJoint X Y := M.base

/-- The `(X, Z)` joint mass `pXZ(x,z) = ∑_{y} base.p (x,y) · chan y z` — `Y` summed out. -/
noncomputable def pXZ (x : X) (z : Z) : ℝ := ∑ y ∈ M.base.suppY, M.base.p (x, y) * M.chan y z

theorem pXZ_nonneg (x : X) (z : Z) : 0 ≤ M.pXZ x z :=
  Finset.sum_nonneg (fun y _ => mul_nonneg (M.base.nonneg (x, y)) (M.chan_nonneg y z))

/-- The `(X, Z)` joint as a `FinJoint X Z`: mass `pXZ`, support `suppX ×ˢ suppZ`. The total mass is
    `1` because `∑_{x,z} ∑_y p(x,y)·chan y z = ∑_{x,y} p(x,y) · (∑_z chan y z) = ∑_{x,y} p(x,y) = 1`
    (the channel rows sum to `1` on the support). So `I(X;Z) = (jointXZ).mutualInfo`. -/
noncomputable def jointXZ : FinJoint X Z where
  suppX := M.base.suppX
  suppY := M.suppZ
  p := fun q => M.pXZ q.1 q.2
  nonneg := fun q => M.pXZ_nonneg q.1 q.2
  sum_one := by
    unfold MarkovChain.pXZ
    rw [Finset.sum_product]
    have step : ∀ x ∈ M.base.suppX,
        (∑ z ∈ M.suppZ, ∑ y ∈ M.base.suppY, M.base.p (x, y) * M.chan y z)
          = ∑ y ∈ M.base.suppY, M.base.p (x, y) := by
      intro x _
      rw [Finset.sum_comm]
      apply Finset.sum_congr rfl
      intro y hy
      rw [← Finset.mul_sum, M.chan_sum_one y hy, mul_one]
    rw [Finset.sum_congr rfl step, ← Finset.sum_product]
    exact M.base.sum_one

/-! ## Marginal bookkeeping for the DPI -/

/-- The **`Z`-marginal** `pZ z = ∑_y base.pY y · chan y z`, which equals `jointXZ.pY z`
    (`= ∑_x pXZ x z`). Both are the marginal of `Z`. -/
theorem jointXZ_pY_eq (z : Z) :
    M.jointXZ.pY z = ∑ y ∈ M.base.suppY, M.base.pY y * M.chan y z := by
  -- jointXZ.pY z = ∑_x pXZ x z = ∑_x ∑_y base.p (x,y) · chan y z = ∑_y (∑_x base.p (x,y)) · chan y z
  unfold Zeta.FinConditionalEntropy.FinJoint.pY
  show (∑ x ∈ M.jointXZ.suppX, M.jointXZ.p (x, z)) = _
  show (∑ x ∈ M.base.suppX, M.pXZ x z) = _
  unfold MarkovChain.pXZ
  rw [Finset.sum_comm]
  apply Finset.sum_congr rfl
  intro y _
  rw [← Finset.sum_mul]

/-- The **`X`-marginal is the same** whether computed from the `(X,Y)` joint (sum out `Y`) or the
    `(X,Z)` joint (sum out `Z`): `jointXZ.pX x = base.pX x`. (`∑_z ∑_y base.p (x,y)·chan y z =
    ∑_y base.p (x,y)·(∑_z chan y z) = ∑_y base.p (x,y) = base.pX x`.) The shared `X`-marginal is what
    makes the `H(X)` terms cancel in `I(X;Y) − I(X;Z)`. -/
theorem jointXZ_pX_eq (x : X) : M.jointXZ.pX x = M.base.pX x := by
  show (∑ z ∈ M.jointXZ.suppY, M.jointXZ.p (x, z)) = _
  change (∑ z ∈ M.suppZ, M.pXZ x z) = _
  unfold MarkovChain.pXZ Zeta.FinConditionalEntropy.FinJoint.pX
  rw [Finset.sum_comm]
  apply Finset.sum_congr rfl
  intro y hy
  rw [← Finset.mul_sum, M.chan_sum_one y hy, mul_one]

/-! ## The 3-D joint and two collapse lemmas

  The full joint over `X × Y × Z` and the two ways its `pf`-weighted sums collapse: summing out `Z`
  recovers the `(X,Y)` joint mass `base.p`; summing out `Y` recovers the `(X,Z)` joint mass
  `jointXZ.p`. Every term in the DPI identity is one of these two collapses. -/

/-- The full joint mass `pf(x,y,z) = base.p (x,y) · chan y z` (Markov factorization). -/
noncomputable def pf (x : X) (y : Y) (z : Z) : ℝ := M.base.p (x, y) * M.chan y z

theorem pf_nonneg (x : X) (y : Y) (z : Z) : 0 ≤ M.pf x y z :=
  mul_nonneg (M.base.nonneg (x, y)) (M.chan_nonneg y z)

/-- **Collapse out `Z`:** for any `h` depending only on `(x,y)`,
    `∑_{x,y,z} pf(x,y,z)·h x y = ∑_{x,y} base.p (x,y)·h x y`, since `∑_z chan y z = 1`. -/
theorem sum_out_z (h : X → Y → ℝ) :
    (∑ x ∈ M.base.suppX, ∑ y ∈ M.base.suppY, ∑ z ∈ M.suppZ, M.pf x y z * h x y)
      = ∑ x ∈ M.base.suppX, ∑ y ∈ M.base.suppY, M.base.p (x, y) * h x y := by
  apply Finset.sum_congr rfl; intro x _
  apply Finset.sum_congr rfl; intro y hy
  -- ∑_z (base.p·chan)·h = (∑_z chan)·(base.p·h) = base.p·h
  have : ∀ z ∈ M.suppZ, M.pf x y z * h x y = (M.base.p (x, y) * h x y) * M.chan y z := by
    intro z _; unfold MarkovChain.pf; ring
  rw [Finset.sum_congr rfl this, ← Finset.mul_sum, M.chan_sum_one y hy, mul_one]

/-- **Collapse out `Y`:** for any `h` depending only on `(x,z)`,
    `∑_{x,z,y} pf(x,y,z)·h x z = ∑_{x,z} pXZ(x,z)·h x z`, since `∑_y base.p (x,y)·chan y z = pXZ x z`. -/
theorem sum_out_y (h : X → Z → ℝ) :
    (∑ x ∈ M.base.suppX, ∑ z ∈ M.suppZ, ∑ y ∈ M.base.suppY, M.pf x y z * h x z)
      = ∑ x ∈ M.base.suppX, ∑ z ∈ M.suppZ, M.pXZ x z * h x z := by
  apply Finset.sum_congr rfl; intro x _
  apply Finset.sum_congr rfl; intro z _
  -- ∑_y (base.p·chan)·h = (∑_y base.p·chan)·h = pXZ·h
  have : ∀ y ∈ M.base.suppY, M.pf x y z * h x z = (M.base.p (x, y) * M.chan y z) * h x z := by
    intro y _; unfold MarkovChain.pf; ring
  rw [Finset.sum_congr rfl this, ← Finset.sum_mul]
  rfl

/-! ## The comparison distribution `qf` and the Gibbs application -/

/-- The **comparison distribution** `qf(x,y,z) = pXZ(x,z) · base.pY(y) · chan y z / pZ(z)`
    (`= pXZ(x,z) · p(y|z)`), the `q`-vector of the Gibbs / log-sum step. Its total mass is `1`
    (the inner sums collapse: `∑_y qf = pXZ`, then `∑_{x,z} pXZ = 1`). -/
noncomputable def qf (x : X) (y : Y) (z : Z) : ℝ :=
  M.pXZ x z * (M.base.pY y * M.chan y z / M.jointXZ.pY z)

/-- `qf ≥ 0` (a quotient of nonnegatives; `jointXZ.pY ≥ 0`). -/
theorem qf_nonneg (x : X) (y : Y) (z : Z) : 0 ≤ M.qf x y z := by
  unfold MarkovChain.qf
  apply mul_nonneg (M.pXZ_nonneg x z)
  apply div_nonneg
  · exact mul_nonneg (M.base.pY_nonneg y) (M.chan_nonneg y z)
  · exact M.jointXZ.pY_nonneg z

/-- Summing `qf` over `Y` recovers the `(X,Z)` joint mass: `∑_y qf(x,y,z) = pXZ(x,z)`.
    `∑_y qf = pXZ · (∑_y base.pY y · chan y z) / jointXZ.pY z = pXZ · jointXZ.pY z / jointXZ.pY z`.
    When `jointXZ.pY z > 0` this is `pXZ`; when `jointXZ.pY z = 0` then `pXZ x z = 0` (it is one
    nonneg summand of `jointXZ.pY z = ∑_x pXZ x z`), so both sides are `0`. -/
theorem sum_qf_y {x : X} (hx : x ∈ M.base.suppX) (z : Z) :
    (∑ y ∈ M.base.suppY, M.qf x y z) = M.pXZ x z := by
  unfold MarkovChain.qf
  -- pull pXZ/jointXZ.pY out, sum base.pY·chan, recognize jointXZ.pY
  -- RESCUE FIX (2026-07-31): the original worktree proof opened with `rw [Finset.mul_sum]`, which
  -- no longer fires — the RHS is `a * (S / c)`, not `a * S`, so the `?a * ∑ …` pattern misses.
  -- Pull the constant `pXZ / pZ` out of the sum termwise instead, then `ring` reassociates.
  -- (`Finset.sum_div` would also do it, but it lives in `Mathlib.Algebra.BigOperators.Field`,
  -- which this tower does not import; the termwise route keeps the import surface unchanged.)
  have hcollect : (∑ y ∈ M.base.suppY, M.pXZ x z * (M.base.pY y * M.chan y z / M.jointXZ.pY z))
      = M.pXZ x z * ((∑ y ∈ M.base.suppY, M.base.pY y * M.chan y z) / M.jointXZ.pY z) := by
    have hterm : ∀ y ∈ M.base.suppY,
        M.pXZ x z * (M.base.pY y * M.chan y z / M.jointXZ.pY z)
          = (M.pXZ x z / M.jointXZ.pY z) * (M.base.pY y * M.chan y z) := by
      intro y _; ring
    rw [Finset.sum_congr rfl hterm, ← Finset.mul_sum]
    ring
  rw [hcollect, ← M.jointXZ_pY_eq z]
  by_cases h0 : M.jointXZ.pY z = 0
  · -- jointXZ.pY z = 0 ⇒ each pXZ x' z = 0 (nonneg sum = 0), in particular pXZ x z = 0
    have hsum0 : ∑ x' ∈ M.jointXZ.suppX, M.jointXZ.p (x', z) = 0 := h0
    have hpxz : M.pXZ x z = 0 := by
      have := (Finset.sum_eq_zero_iff_of_nonneg
        (fun x' _ => M.jointXZ.nonneg (x', z))).mp hsum0 x hx
      simpa using this
    rw [h0, div_zero, mul_zero, hpxz]
  · rw [div_self h0, mul_one]

/-! ## Half C — closing the chain: the Gibbs application

  Half B stopped at `sum_qf_y`. What the data-processing inequality still needs is: the two
  normalizations (`∑ pf = 1`, `∑ qf = 1`), the `gibbs_sum` positivity side condition, and the
  log-ratio identity. The first three are proven here. The fourth is the file's single open
  obligation — see `§ THE OPEN OBLIGATION` in the file header. -/

/-- The 3-D index set `suppX ×ˢ suppY ×ˢ suppZ` — the `Finset` the Gibbs step ranges over. -/
def idx3 : Finset (X × Y × Z) := M.base.suppX ×ˢ (M.base.suppY ×ˢ M.suppZ)

/-- The full joint `pf` as a function on the 3-D index set (the `p`-vector of the Gibbs step). -/
noncomputable def pf3 : X × Y × Z → ℝ := fun t => M.pf t.1 t.2.1 t.2.2

/-- The comparison distribution `qf` as a function on the 3-D index set (the `q`-vector). -/
noncomputable def qf3 : X × Y × Z → ℝ := fun t => M.qf t.1 t.2.1 t.2.2

theorem mem_idx3 {t : X × Y × Z} (ht : t ∈ M.idx3) :
    t.1 ∈ M.base.suppX ∧ t.2.1 ∈ M.base.suppY ∧ t.2.2 ∈ M.suppZ := by
  unfold MarkovChain.idx3 at ht
  obtain ⟨h1, h23⟩ := Finset.mem_product.mp ht
  obtain ⟨h2, h3⟩ := Finset.mem_product.mp h23
  exact ⟨h1, h2, h3⟩

/-- Unfold the 3-D product sum into the `x, y, z` fold order. -/
theorem sum_idx3 (g : X × Y × Z → ℝ) :
    (∑ t ∈ M.idx3, g t)
      = ∑ x ∈ M.base.suppX, ∑ y ∈ M.base.suppY, ∑ z ∈ M.suppZ, g (x, (y, z)) := by
  unfold MarkovChain.idx3
  rw [Finset.sum_product]
  exact Finset.sum_congr rfl (fun x _ => Finset.sum_product ..)

/-- **`∑ pf = 1`** — the full joint is a probability vector. `∑_z chan y z = 1` collapses the
    `Z` fold (`sum_out_z` with `h = 1`), leaving `∑_{x,y} base.p = 1`. -/
theorem sum_pf3_one : (∑ t ∈ M.idx3, M.pf3 t) = 1 := by
  rw [M.sum_idx3]
  have h := M.sum_out_z (fun _ _ => (1 : ℝ))
  simp only [mul_one] at h
  show (∑ x ∈ M.base.suppX, ∑ y ∈ M.base.suppY, ∑ z ∈ M.suppZ, M.pf x y z) = 1
  rw [h, ← Finset.sum_product]
  exact M.base.sum_one

/-- **`∑ qf = 1`** — the comparison distribution is a probability vector. `sum_qf_y` collapses the
    `Y` fold to `pXZ`, and `∑_{x,z} pXZ = 1` is `jointXZ.sum_one`. (The `Y`/`Z` folds are swapped
    with `Finset.sum_comm` to reach `sum_qf_y`'s order.) -/
theorem sum_qf3_one : (∑ t ∈ M.idx3, M.qf3 t) = 1 := by
  rw [M.sum_idx3]
  show (∑ x ∈ M.base.suppX, ∑ y ∈ M.base.suppY, ∑ z ∈ M.suppZ, M.qf x y z) = 1
  have step : ∀ x ∈ M.base.suppX,
      (∑ y ∈ M.base.suppY, ∑ z ∈ M.suppZ, M.qf x y z) = ∑ z ∈ M.suppZ, M.pXZ x z := by
    intro x hx
    rw [Finset.sum_comm]
    exact Finset.sum_congr rfl (fun z _ => M.sum_qf_y hx z)
  rw [Finset.sum_congr rfl step]
  -- `jointXZ.sum_one` is over the product set; unfold it to the nested fold and match by defeq
  -- (`M.jointXZ.p (x, z)` reduces to `M.pXZ x z`, and the supports reduce to `suppX` / `suppZ`).
  have h1 := M.jointXZ.sum_one
  rw [Finset.sum_product] at h1
  exact h1

/-- **The `gibbs_sum` side condition**: wherever the full joint is positive, so is the comparison
    distribution. If `pf(x,y,z) > 0` then `base.p (x,y) > 0` and `chan y z > 0`; hence
    `pXZ(x,z) ≥ base.p (x,y)·chan y z > 0`, `pY(y) ≥ base.p (x,y) > 0`, and
    `pZ(z) ≥ pXZ(x,z) > 0` — so `qf = pXZ·(pY·chan / pZ) > 0`. (Each `≥` is `single_le_sum`: the
    marginal dominates any one of its nonnegative summands.) -/
theorem pf3_zero_or_qf3_pos {t : X × Y × Z} (ht : t ∈ M.idx3) :
    M.pf3 t = 0 ∨ 0 < M.qf3 t := by
  obtain ⟨hx, hy, hz⟩ := M.mem_idx3 ht
  obtain ⟨x, y, z⟩ := t
  rcases eq_or_lt_of_le (M.pf_nonneg x y z) with h0 | hpos
  · exact Or.inl h0.symm
  · refine Or.inr ?_
    -- pf = base.p · chan > 0 forces both factors positive.
    have hbp : 0 < M.base.p (x, y) := by
      rcases eq_or_lt_of_le (M.base.nonneg (x, y)) with h | h
      · exfalso; unfold MarkovChain.pf at hpos; rw [← h, zero_mul] at hpos; exact lt_irrefl 0 hpos
      · exact h
    have hch : 0 < M.chan y z := by
      rcases eq_or_lt_of_le (M.chan_nonneg y z) with h | h
      · exfalso; unfold MarkovChain.pf at hpos; rw [← h, mul_zero] at hpos; exact lt_irrefl 0 hpos
      · exact h
    -- pXZ x z ≥ base.p (x,y) · chan y z > 0
    have hpxz : 0 < M.pXZ x z := by
      have hle : M.base.p (x, y) * M.chan y z ≤ M.pXZ x z :=
        Finset.single_le_sum
          (fun y' _ => mul_nonneg (M.base.nonneg (x, y')) (M.chan_nonneg y' z)) hy
      exact lt_of_lt_of_le (mul_pos hbp hch) hle
    -- pY y ≥ base.p (x,y) > 0
    have hpy : 0 < M.base.pY y := by
      have hle : M.base.p (x, y) ≤ M.base.pY y :=
        Finset.single_le_sum (fun x' _ => M.base.nonneg (x', y)) hx
      exact lt_of_lt_of_le hbp hle
    -- pZ z = jointXZ.pY z ≥ pXZ x z > 0
    have hpz : 0 < M.jointXZ.pY z := by
      have hle : M.jointXZ.p (x, z) ≤ M.jointXZ.pY z :=
        Finset.single_le_sum (fun x' _ => M.jointXZ.nonneg (x', z)) hx
      exact lt_of_lt_of_le hpxz hle
    show 0 < M.qf x y z
    unfold MarkovChain.qf
    exact mul_pos hpxz (div_pos (mul_pos hpy hch) hpz)

/-! ### § THE OPEN OBLIGATION

  This is the **single `sorry` in this file**. It is stated at full strength; nothing downstream
  weakens it, and `dataProcessing` below is derived FROM it rather than around it. See the file
  header (`§ THE OPEN OBLIGATION`) for the three-part account of what discharging it takes. -/

/-- **[OPEN — `sorry`]** The log-ratio identity: the `pf`-weighted log-ratio of the full joint
    against the comparison distribution is exactly the mutual-information gap,

        `∑ pf·log pf − ∑ pf·log qf  =  I(X;Y) − I(X;Z)`.

    TRUE, and the pen-and-paper derivation is routine (see header): `log pf = log base.p + log chan`
    and `log qf = log pXZ + log pY + log chan − log pZ`, so the `chan` terms cancel and the residue
    is `∑ pf·(log base.p − log pY − log pXZ + log pZ)`; collapsing with `sum_out_z` / `sum_out_y`
    and cancelling the shared `log pX` term (`jointXZ_pX_eq`) gives the two `mutualInfo_eq_logsum`
    expansions. NOT YET FORMALIZED: the four-factor `Real.log_mul` / `log_div` positivity case
    splits, the `Finset.sum_comm` re-indexing between the `x,y,z` and `x,z,y` fold orders, and the
    `log pX` cancellation. Estimated a few hundred lines of `Finset` / `Real.log` bookkeeping with
    no new analytic content.

    UNTIL THIS IS DISCHARGED, `dataProcessing` BELOW IS NOT A COMPLETE PROOF. -/
theorem logRatio_eq_mutualInfo_diff :
    (∑ t ∈ M.idx3, M.pf3 t * log (M.pf3 t)) - (∑ t ∈ M.idx3, M.pf3 t * log (M.qf3 t))
      = M.base.mutualInfo - M.jointXZ.mutualInfo := by
  sorry

/-! ### The headline theorem (modulo the open obligation above) -/

/-- **Data-Processing Inequality** (Shannon 1948; Cover & Thomas Thm 2.8.1): for a finite Markov
    chain `X → Y → Z`, post-processing cannot increase information —

        `I(X; Z) ≤ I(X; Y)`.

    Proof: apply the Half-A key lemma `relEntropy_nonneg` to the pair `(pf, qf)` on the 3-D index
    set — both are probability vectors (`sum_pf3_one`, `sum_qf3_one`), both nonnegative, and `qf` is
    positive wherever `pf` is (`pf3_zero_or_qf3_pos`) — to get `0 ≤ ∑ pf·log pf − ∑ pf·log qf`. The
    open obligation `logRatio_eq_mutualInfo_diff` identifies that quantity with `I(X;Y) − I(X;Z)`.

    ⚠ **DEPENDS ON A `sorry`** via `logRatio_eq_mutualInfo_diff`. `#print axioms` on this theorem
    WILL report `sorryAx`. Do not cite it as machine-checked until that obligation is discharged.
    The statement itself is at full strength and is not weakened to dodge the gap. -/
theorem dataProcessing : M.jointXZ.mutualInfo ≤ M.base.mutualInfo := by
  have hkl := relEntropy_nonneg M.idx3 M.pf3 M.qf3
    (fun t _ => M.pf_nonneg t.1 t.2.1 t.2.2)
    (fun t _ => M.qf_nonneg t.1 t.2.1 t.2.2)
    (fun _ ht => M.pf3_zero_or_qf3_pos ht)
    M.sum_pf3_one M.sum_qf3_one
  rw [M.logRatio_eq_mutualInfo_diff] at hkl
  linarith

end MarkovChain

end MarkovModel

end Zeta.FinDataProcessing
