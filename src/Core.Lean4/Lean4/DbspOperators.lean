/-
# DBSP operator set — machine-checked laws (Lean 4 + Mathlib)

The Lean-oracle mirror of `src/Core/DbspCellGraph.fs` and its cross-language IR
(`tests/cross-verification/zeta-ir-v2/interfaces/dbsp-operators.ir.json`). Where the
TS/Py/Go treaty *cross-verifies* the weight-algebra laws and the Q# reference oracle
*grounds* them structurally, this file **proves** them.

A Z-set over key type `K` is modelled as a weight function `K → ℤ` (pointwise
algebra; finite support is irrelevant to the linear/bilinear laws proved here). The
operators:

* LINEAR   `relay` (id), `select` (filter — pointwise mask) — distribute over `add`;
* BILINEAR `join` (equi-join, weights multiply) — distributes over `add` each side;
* sink     `integrate` (running `I` = `add`) — associative + commutative;
* RING     `neg` (retraction) — the additive inverse (`add a (neg a) = zero`);
* NON-LIN  `distinctCross` (the `H` boundary op) — 0 when the weight does not cross.

Headline: `select_incremental` — folding filtered deltas equals filtering the folded
deltas (`∑ select (δ i) = select (∑ δ i)`), the incremental ≡ recompute law for a
linear operator, over a `Finset`. Anchor: Budiu et al. DBSP (VLDB 2023).
-/
import Mathlib.Algebra.Group.Basic
import Mathlib.Algebra.BigOperators.Group.Finset.Basic
import Mathlib.Algebra.BigOperators.Pi
import Mathlib.Tactic.Ring

namespace Zeta.DbspOperators

/-- A Z-set over key type `K`: a pointwise integer weight function. -/
abbrev ZSet (K : Type _) := K → ℤ

namespace ZSet

variable {K : Type _}

/-- The empty Z-set (additive identity). -/
def zero : ZSet K := fun _ => 0

/-- Z-set addition (pointwise). -/
def add (a b : ZSet K) : ZSet K := fun k => a k + b k

/-- Additive inverse — a retraction (RING tier). -/
def neg (a : ZSet K) : ZSet K := fun k => -a k

/-- LINEAR relay: identity. -/
def relay (a : ZSet K) : ZSet K := a

/-- LINEAR selection (filter): keep the weight where `p` holds, else 0. -/
def select (p : K → Prop) [DecidablePred p] (a : ZSet K) : ZSet K :=
  fun k => if p k then a k else 0

/-- BILINEAR equi-join: matched keys, weights multiply. -/
def join (a b : ZSet K) : ZSet K := fun k => a k * b k

/-- The sink's running integral `I`: `acc ⊕ delta`. -/
def integrate (acc delta : ZSet K) : ZSet K := add acc delta

/-- NON-LINEAR distinct boundary (the DBSP `H`), at the weight level: emit the
    0↔positive crossing only. -/
def distinctCross (prevW deltaW : ℤ) : ℤ :=
  let wasPos := decide (0 < prevW)
  let nowPos := decide (0 < prevW + deltaW)
  if wasPos == nowPos then 0 else if nowPos then 1 else -1

-- ─── Laws ────────────────────────────────────────────────────────────────

/-- `relay` is the identity operator. -/
theorem relay_id (a : ZSet K) : relay a = a := rfl

/-- LINEAR: `select` distributes over `add`. -/
theorem select_linear (p : K → Prop) [DecidablePred p] (a b : ZSet K) :
    select p (add a b) = add (select p a) (select p b) := by
  funext k
  simp only [select, add]
  by_cases h : p k <;> simp [h]

/-- BILINEAR (left): `join` distributes over `add` in the first argument. -/
theorem join_bilinear_left (a b c : ZSet K) :
    join (add a b) c = add (join a c) (join b c) := by
  funext k; simp only [join, add]; ring

/-- BILINEAR (right): `join` distributes over `add` in the second argument. -/
theorem join_bilinear_right (a b c : ZSet K) :
    join a (add b c) = add (join a b) (join a c) := by
  funext k; simp only [join, add]; ring

/-- `join` is commutative (weights multiply). -/
theorem join_comm (a b : ZSet K) : join a b = join b a := by
  funext k; simp only [join]; ring

/-- The integral fold is associative. -/
theorem integrate_assoc (a b c : ZSet K) :
    integrate (integrate a b) c = integrate a (integrate b c) := by
  funext k; simp only [integrate, add]; ring

/-- The integral fold is commutative — the algebraic root of DoP-invariance:
    delta arrival order does not change the integral. -/
theorem integrate_comm (a b : ZSet K) : integrate a b = integrate b a := by
  funext k; simp only [integrate, add]; ring

/-- Retraction is the additive inverse: `a ⊕ (−a) = 0`. This is why an insert
    followed by its retraction cancels as it propagates through the graph. -/
theorem retract_inverse (a : ZSet K) : add a (neg a) = zero := by
  funext k; simp only [add, neg, zero]; ring

/-- `distinctCross` emits nothing when the weight does not cross the 0 boundary. -/
theorem distinctCross_no_cross (prevW deltaW : ℤ)
    (h : (0 < prevW) ↔ (0 < prevW + deltaW)) :
    distinctCross prevW deltaW = 0 := by
  simp only [distinctCross]
  have : decide (0 < prevW) = decide (0 < prevW + deltaW) := by
    simp [h]
  simp [this]

/-- **Incremental ≡ recompute for a linear operator.** Folding the filtered deltas
    equals filtering the folded deltas: `∑ select (δ i) = select (∑ δ i)`. This is
    DBSP's incremental-view-maintenance guarantee for `select`, over any `Finset`. -/
theorem select_incremental (p : K → Prop) [DecidablePred p]
    (s : Finset ℕ) (δ : ℕ → ZSet K) :
    (∑ i ∈ s, select p (δ i)) = select p (∑ i ∈ s, δ i) := by
  funext k
  simp only [select, Finset.sum_apply]
  by_cases h : p k
  · simp [h]
  · simp [h, Finset.sum_const_zero]

end ZSet

end Zeta.DbspOperators
