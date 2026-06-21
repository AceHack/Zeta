/-
  Finite data-processing inequality (DPI) — the key lemma rung (information-theory tower).

  The data-processing inequality `I(X;Z) ≤ I(X;Y)` for a Markov chain `X → Y → Z` reduces, by the
  chain rule of mutual information `I(X;Y,Z) = I(X;Y) + I(X;Z|Y)` plus the Markov factorization
  (which forces `I(X;Z|Y)` to be the only slack term), to ONE non-negativity fact:

      **the relative entropy (Kullback–Leibler divergence) of two finite probability vectors is
       non-negative** — Gibbs' inequality, `0 ≤ ∑ p·log(p/q)`.

  That is the reusable lever this file proves, DIRECTLY off `gibbs_sum` from the rung below it. It
  REUSES, and never redefines, the entropy / mutual-information substrate:
    • `Lean4/FinShannonEntropy.lean`      (#8816) — `FinDist`, `H`.
    • `Lean4/FinConditionalEntropy.lean`  (#8832) — `FinJoint`, marginals, `I(X;Y)`, chain rule.
    • `Lean4/FinMutualInfoNonneg.lean`    (#8848) — **`gibbs_sum`** (the finite log-sum / Gibbs
       inequality), `mutualInfo_nonneg`. `gibbs_sum` is the lever; we hang DPI's heart off it.

  This is the FINITE INFORMATION-THEORY DPI (mutual information over a finite joint). It is NOT a
  duplicate of `Lean4/DecorrelationDpi.lean`, which is a different, pure-`Nat`, log-free OPERATIONAL
  DPI over partition cells (the `ρ_owe` decorrelation floor) — same name "DPI", disjoint content.

  ── WHAT IS PROVEN (no `sorry`; `#print axioms` = propext / Classical.choice / Quot.sound) ──────────
  • `relEntropy_nonneg`  — Gibbs / KL ≥ 0 for two finite probability vectors on a common support
                           (`∑ p = ∑ q = 1`, `q` positive where `p` is): `0 ≤ ∑ p·log p − ∑ p·log q`.
                           This is the **DPI key lemma** — the single non-negativity DPI reduces to.
  • `gibbs_le`           — the contrapositive cross-entropy form: `∑ p·log q ≤ ∑ p·log p`
                           (the self log-likelihood dominates any other; the lever DPI quotes).
  • `relEntropy_self`    — `KL(p‖p) = 0` (the divergence vanishes on the diagonal; non-vacuity).

  ── DPI in terms of the key lemma (the rung above this one) ──────────────────────────────────────
  For a finite Markov chain `X → Y → Z` (joint factoring `p(x,y,z) = p(x)·p(y|x)·p(z|y)`), conditional
  mutual information is a relative entropy, `I(X;Z|Y) = ∑ p(x,y,z)·log( p(x,y,z)·p(y) / (p(x,y)·p(y,z)) )`,
  whose two arguments are probability vectors summing to 1 — so `relEntropy_nonneg` gives
  `0 ≤ I(X;Z|Y)`, and with the MI chain rule `I(X;Y,Z) = I(X;Y) + I(X;Z|Y) ≥ I(X;Y)` together with the
  Markov identity `I(X;Y,Z) = I(X;Z)` yields `I(X;Z) ≤ I(X;Y)`. The remaining step is wiring a
  3-variable `FinJoint3` (the marginal bookkeeping `∑ p(x,y)·p(y,z)/p(y) = 1`); it rests entirely on
  the key lemma proven here and carries no further analytic content. (Deliberately the next rung — see
  the strategy note: the key lemma is the reusable, complete result; the 3-var wiring is bookkeeping.)

  Beacon anchors: Gibbs 1902 (Gibbs' inequality); Kullback & Leibler 1951 (relative entropy / KL
  divergence, `D(p‖q) ≥ 0` with equality iff `p = q`); Shannon 1948; Cover & Thomas, *Elements of
  Information Theory* (Thm 2.6.3 information inequality `D(p‖q) ≥ 0`; Thm 2.8.1 the data-processing
  inequality `I(X;Z) ≤ I(X;Y)` for `X → Y → Z`). Lever: `Zeta.FinMutualInfoNonneg.gibbs_sum`.
-/
import Lean4.FinShannonEntropy
import Lean4.FinConditionalEntropy
import Lean4.FinMutualInfoNonneg
import Mathlib.Analysis.SpecialFunctions.Log.NegMulLog
import Mathlib.Algebra.Order.BigOperators.Group.Finset

namespace Zeta.FinDataProcessing

open Real
open Zeta.FinMutualInfoNonneg

variable {α : Type*}

/-! ## The DPI key lemma: relative entropy (KL divergence) is non-negative -/

/-- **Relative entropy / Kullback–Leibler divergence is non-negative** (Gibbs 1902; Kullback–Leibler
    1951; Cover & Thomas Thm 2.6.3) — the **data-processing-inequality key lemma**. For two finite
    probability vectors `p, q : α → ℝ` on a common support `s` (each nonnegative, each summing to `1`,
    with `q` strictly positive wherever `p` is), the relative entropy is non-negative:

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

end Zeta.FinDataProcessing
