/-
  CostRecurrence.lean — Lean 4 proof oracle for the consolidate cost spike.

  Soraya (formal-verification role), invoked by Otto under the four-ferry role
  split (Gemini proposes, Grok critiques, Amara sharpens, Otto tests, Git decides).
  Step 5 of the complexity spike; handoff
  `docs/handoffs/2026-06-21-alexa-to-soraya-lean-cost-recurrence.md`.

  ## What the spike already shipped (steps 1-4, all on main)

    * #8949  DST cost-counter as an injected, metered effect (§13 noninterference):
             `createCountedEq` counts every `eq()` invocation in `consolidate`.
             Measured witness on n all-distinct keys: `eq()` fires n(n-1)/2 times.
    * #8952  Z3 envelope (`tools/Z3Verify/consolidate-quadratic-envelope.smt2`):
             QF_NIA, UNSAT ⇒ the GROUND bound `n(n-1)/2 ≤ n²` holds for all n ≥ 0.
    * #8953  Empirical growth-shape property: cost(2n)/cost(n) ≈ 4 at n=16..128.

  Z3 discharges the *ground envelope* (a ∀-quantified arithmetic inequality with
  no recursion). What Z3 STRUCTURALLY CANNOT do is the INDUCTION that closes the
  recurrence itself — `T(n) = T(n-1) + (n-1)` ⇒ `T(n) = n(n-1)/2`. That is this
  file's first theorem: the universal statement on the page, not just the
  empirically-confirmed ground samples. This is BP-16 in spirit: two independent
  oracles on one P0-adjacent claim — Z3 on the ground envelope, Lean on the
  inductive closed form — and `eqCount_le_sq` below shows they AGREE (Lean
  re-derives Z3's envelope as a corollary of the closed form, universally).

  ## Theorem 1 — the universal recurrence (the induction Z3 cannot do)

  `consolidate` on n all-distinct keys runs a nested find: the i-th entry scans
  its i predecessors, so the total eq-count is 0 + 1 + ... + (n-1). As a recurrence
  `T(0) = 0`, `T(n+1) = T(n) + n`. Closed form `T(n) = n(n-1)/2`, proved by routing
  through Mathlib `Finset.sum_range_id` (`∑ i ∈ range n, i = n*(n-1)/2`). The
  division-free `eqCount_two_mul` (`2·T(n) = n·(n-1)`) mirrors EXACTLY the trick the
  Z3 `.smt2` uses to dodge integer division ("multiply both sides by 2").

  ## Theorem 2 — the cost map is lax-monoidal over the (min,+) tropical semiring

  Cost composes SUBADDITIVELY: `cost(f ∘ g) ≤ cost(f) + cost(g)`. Read in the
  tropical (min,+) semiring (`Mathlib.Algebra.Tropical.Basic`): tropical
  MULTIPLICATION is base ADDITION (`untrop_mul : untrop (x*y) = untrop x + untrop y`),
  so the subadditive bound is precisely the lax-monoidal coherence cell
  `trop(cost(f∘g)) ≤ trop(cost f) * trop(cost g)` — the cost map is a LAX (not
  strict) monoidal functor, the laxness being the `≤`. Two composition modes
  witness the two tropical operations directly:

    * SEQUENTIAL composition (trace append) is tropical MULTIPLICATION: cost is
      EXACTLY additive (`seqCost_eq`), the tight / strict-monoidal special case.
    * SHARED composition (reuse the cheaper sub-result) is tropical ADDITION (min):
      `min a b ≤ a + b`, and `sharedCost_strictly_lax` exhibits a pair where the
      inequality is STRICT — so the functor is genuinely lax, not strict. This is
      the (min,+) structure made concrete: + for sequencing, min for sharing.

  Scope (drift-auditor honesty, BP-08): `cost_lax_of_subadd` is the load-bearing
  COHERENCE CELL, not a claim of a fully-constructed monoidal-functor object in
  `CategoryTheory`. It states (and the two instances witness) the exact inequality
  that the lax-monoidal structure map provides; the categorical wrapper is not
  built here and is not claimed.

  ## Anchors (Beacon)

    * Gauss's pair-sum / triangular number `∑_{i<n} i = n(n-1)/2` (folklore;
      Mathlib `Finset.sum_range_id`, `Finset.sum_range_id_mul_two`).
    * Tropical / (min,+) semiring: Pin (1998), Maclagan–Sturmfels,
      *Introduction to Tropical Geometry* (2015); Mathlib `Algebra.Tropical.Basic`.
    * Lax monoidal functors: S. Mac Lane, *Categories for the Working
      Mathematician* (1971), §XI (monoidal categories / coherence).
    * Cost as a metered functor: the §13 noninterference door (the injected
      `createCountedEq`); the eq-count is the metered crossing this proof bounds.

  Discipline (per handoff): sorry-free. NO `sorry` remains — verified by the
  axiom-audit step in `.github/workflows/lean-proof.yml`.
-/

import Mathlib.Algebra.BigOperators.Intervals
import Mathlib.Algebra.Tropical.Basic

namespace Zeta.CostRecurrence

open Finset Tropical

-- ═══ Theorem 1 — the consolidate eq-count recurrence and its closed form ═══════
-- The induction Z3 cannot do. `consolidate` on n all-distinct keys: the i-th entry
-- scans its i predecessors, so eq() fires 0 + 1 + ... + (n-1) times.

/-- Worst-case `eq()`-count of `consolidate` on `n` all-distinct keys, as the
    recurrence `T(0) = 0`, `T(n+1) = T(n) + n`. (Matches the DST cost-counter
    witness from #8949 and the `.smt2` context comment from #8952.) -/
def consolidateEqCount : ℕ → ℕ
  | 0     => 0
  | n + 1 => consolidateEqCount n + n

/-- The recurrence unfolds to the partial-sum `∑ i ∈ range n, i`. Pure induction —
    this is the step Z3's ground envelope cannot reach. -/
theorem eqCount_eq_sum (n : ℕ) :
    consolidateEqCount n = ∑ i ∈ Finset.range n, i := by
  induction n with
  | zero => rfl
  | succ k ih => rw [consolidateEqCount, ih, Finset.sum_range_succ]

/-- **Closed form (the headline universal statement).** `T(n) = n(n-1)/2` for ALL
    n — the induction-closed companion to Z3's ground envelope. Routed through
    Mathlib `Finset.sum_range_id`. -/
theorem eqCount_closed_form (n : ℕ) :
    consolidateEqCount n = n * (n - 1) / 2 := by
  rw [eqCount_eq_sum, Finset.sum_range_id]

/-- Division-free form: `2·T(n) = n·(n-1)`. Mirrors EXACTLY the `.smt2`'s
    "multiply both sides by 2 to avoid integer division" — same identity, Lean
    side. The two oracles state the same arithmetic with no division either way. -/
theorem eqCount_two_mul (n : ℕ) :
    2 * consolidateEqCount n = n * (n - 1) := by
  rw [eqCount_eq_sum, Nat.mul_comm, Finset.sum_range_id_mul_two]

/-- **Cross-oracle agreement with Z3 (#8952).** The quadratic ENVELOPE
    `T(n) ≤ n²`, here as a UNIVERSAL corollary of the closed form — the same
    bound Z3 proved UNSAT at the QF_NIA ground level. Lean's induction and Z3's
    ground refutation agree (BP-16 cross-check: independent tools, one claim). -/
theorem eqCount_le_sq (n : ℕ) : consolidateEqCount n ≤ n ^ 2 := by
  rw [eqCount_closed_form, pow_two]
  calc n * (n - 1) / 2 ≤ n * (n - 1) := Nat.div_le_self _ _
    _ ≤ n * n := Nat.mul_le_mul_left n (Nat.sub_le n 1)

-- ═══ Theorem 2 — the cost map is lax-monoidal over the (min,+) tropical semiring ═
-- `cost(f ∘ g) ≤ cost(f) + cost(g)`. In the tropical (min,+) semiring, tropical
-- MULTIPLICATION is base ADDITION, so this subadditive bound IS the lax-monoidal
-- coherence cell `trop(cost(f∘g)) ≤ trop(cost f) * trop(cost g)`.

/-- **The lax-monoidal coherence cell.** For ANY cost map `cost : α → ℕ` and
    composition `comp` that is SUBADDITIVE, the tropical lift satisfies the
    lax-monoidal inequality: `trop(cost(comp x y)) ≤ trop(cost x) * trop(cost y)`,
    where the tropical product `*` is base addition (`untrop_mul`). The `≤` is the
    laxness. This is the load-bearing bridge; the two instances below witness it. -/
theorem cost_lax_of_subadd {α : Type*} (cost : α → ℕ) (comp : α → α → α)
    (subadd : ∀ x y, cost (comp x y) ≤ cost x + cost y) (x y : α) :
    trop (cost (comp x y)) ≤ trop (cost x) * trop (cost y) := by
  rw [← untrop_le_iff, untrop_mul, untrop_trop, untrop_trop, untrop_trop]
  exact subadd x y

-- ── Instance A: SEQUENTIAL composition = tropical MULTIPLICATION (tight) ────────
-- A computation trace is a list of metered ops; cost = number of metered ops
-- (the eq-count the §13 door measures). Sequencing is append; cost is EXACTLY
-- additive — the strict-monoidal special case (no sharing).

/-- A trace of metered operations; `Unit` = one metered crossing (one `eq()`). -/
abbrev Trace := List Unit

/-- Sequential cost: the number of metered ops in the trace. -/
def seqCost (t : Trace) : ℕ := t.length

/-- Sequential composition runs one trace after the other (append). -/
def seqComp (a b : Trace) : Trace := a ++ b

/-- Sequencing is EXACTLY additive: `cost(a ; b) = cost(a) + cost(b)`. The tight
    case — sequential composition realizes tropical MULTIPLICATION (base +). -/
theorem seqCost_eq (a b : Trace) : seqCost (seqComp a b) = seqCost a + seqCost b := by
  simp [seqCost, seqComp, List.length_append]

/-- Sequential cost is lax-monoidal over the tropical semiring (here with
    equality — the strict special case obtained from the additive bound). -/
theorem seqCost_lax_monoidal (a b : Trace) :
    trop (seqCost (seqComp a b)) ≤ trop (seqCost a) * trop (seqCost b) :=
  cost_lax_of_subadd seqCost seqComp (fun a b => (seqCost_eq a b).le) a b

-- ── Instance B: SHARED composition = tropical ADDITION (genuinely lax) ──────────
-- A shared computation reuses the cheaper sub-result, so its cost is `min` of the
-- two — which is tropical ADDITION. `min a b ≤ a + b` is subadditive, and the
-- bound is STRICTLY slack whenever both costs are positive. This is why the cost
-- functor is LAX, not strict.

/-- Shared composition cost: reuse the cheaper sub-result. This is tropical
    ADDITION (min) on the raw costs. -/
def sharedCost (a b : ℕ) : ℕ := min a b

/-- `min` is subadditive: sharing never costs more than sequencing. -/
theorem sharedCost_subadd (a b : ℕ) : sharedCost a b ≤ a + b :=
  le_trans (min_le_left a b) (Nat.le_add_right a b)

/-- Shared cost is lax-monoidal over the tropical semiring. -/
theorem sharedCost_lax_monoidal (a b : ℕ) :
    trop (sharedCost a b) ≤ trop a * trop b :=
  cost_lax_of_subadd id (fun a b => min a b) sharedCost_subadd a b

/-- **The laxness is genuine, not strict.** A concrete pair where sharing is
    STRICTLY cheaper than the sequential sum: `min 2 3 = 2 < 5 = 2 + 3`. This is
    what makes the cost map a LAX monoidal functor rather than a strict one — the
    coherence cell `≤` is not always an equality. -/
theorem sharedCost_strictly_lax : sharedCost 2 3 < 2 + 3 := by decide

-- ═══ Verification ═════════════════════════════════════════════════════════════
-- All theorems type-check and are CLOSED: NO `sorry`. Theorem 1 is the induction
-- Z3 cannot do (`eqCount_closed_form`), with `eqCount_le_sq` re-deriving Z3's
-- ground envelope universally (cross-oracle agreement). Theorem 2 is the
-- lax-monoidal coherence cell over the (min,+) tropical semiring, witnessed by
-- sequential (= tropical ×, tight) and shared (= tropical +, strictly lax)
-- composition. Mathlib-backed (`Finset.sum_range_id`, `Algebra.Tropical.Basic`).
-- Run: lake env lean Lean4/CostRecurrence.lean   (from src/Core.Lean4)
-- Expected: ZERO `sorry` warnings, NO errors. Axiom footprint: the standard
-- Lean/Mathlib foundations (propext, Classical.choice, Quot.sound) — NO sorryAx.

end Zeta.CostRecurrence
