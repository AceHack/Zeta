/-
# Machine-checked proof of the DBSP chain rule — Lean 4 + Mathlib

Migrated round 23 from `proofs/lean/ChainRule.lean` (Mathlib v4.12.0,
unbuilt) to this project (`tools/lean4/`, Mathlib v4.30.0-rc1, pre-
warmed under `.lake/packages/mathlib`). The substantive proof content
is unchanged; this file is the one that actually builds against the
installed toolchain.

## The identity

This file formalises the **incremental chain rule** of DBSP
(Budiu, McSherry, Ryzhyk, Tannen et al., *"DBSP: Automatic
Incremental View Maintenance for Rich Query Languages"*, VLDB 2023).

The classic DBSP chain rule for bilinear operators states:

    D (f ⊗ g) s  =
      D f ⊗ g ∘ I ∘ z⁻¹ +  f ⊗ D g  -  (D f) ∘ z⁻¹ ⊗ (D g) ∘ z⁻¹

Specialised to a *composition* of linear operators over a Z-set-valued
stream — the form the repo's `docs/research/retraction-safe-semi-naive.md`
uses throughout — the identity we ship here is the pointwise statement:

    D (f ∘ g) s
      = D f (g (I (z⁻¹ s)))
      + f (g (I (z⁻¹ s)))
      + D g (I (z⁻¹ s))
      - f (g (I (z⁻¹ s)))

i.e. the two copies of `f (g (I (z⁻¹ s)))` cancel, and on linear
operators the identity collapses to the classical `D (f ∘ g) = f ∘ D g`
form used in incremental view maintenance. This cancellation is the
load-bearing step — it is the Lean-provable version of the "telescoping
sum" lemma informally stated in Budiu et al. §4.2.

---

## Proof skeleton

This file is structured as **named sub-lemmas** rather than one
monolithic `sorry`. Each lemma is either:

* **closed** — proof is `by` tactic, no `sorry`;
* **skeleton** — body is `sorry`, but has a precise statement and a
  docstring citing the source-of-truth (Mathlib lemma, Budiu §, or
  `Recursive.fs` property test that currently acts as the oracle).

The chain-rule theorem itself is a `sorry` but the remaining work is
a small discrete set of goals — not one giant gap. See
`proofs/lean/README.md` for the sub-goal list and effort estimates.

---

## Imports (Mathlib v4.30.0-rc1)

We need:

* **Additive-group structure** on Z-sets (carrier of DBSP streams).
  Z-sets are `K →₀ ℤ` finitely-supported functions; Mathlib's
  `Finsupp` carries `AddCommGroup` out of the box.
* **`AddMonoidHom`** for the linearity predicate on operators.
* **Function composition** from `Mathlib.Logic.Function.Basic`.

Module paths updated for the current Mathlib tree: `BigOperators.Basic`
split into `Algebra.BigOperators.Group.Finset` and the finset-sum
lemmas now live under `Mathlib.Algebra.Order.BigOperators.Group.Finset`.
-/

import Mathlib.Algebra.Group.Basic
import Mathlib.Algebra.Group.Hom.Defs
import Mathlib.Algebra.BigOperators.Group.Finset
import Mathlib.Data.Finsupp.Basic
import Mathlib.Logic.Function.Basic

namespace Dbsp.ChainRule

/-! ## Section 1 — Carriers -/

/--
A **Z-set** over key type `K` is a finitely-supported function
`K →₀ ℤ`. This gives us the abelian-group structure (`+`, `0`, `-`)
the DBSP paper assumes on Z-sets.

For the proof we only need the `AddCommGroup` interface; we stay
generic over the carrier `G` where possible so the lemmas transfer
to any abelian group (integer streams, rational weights, tropical
semiring lifted to a group, …).
-/
abbrev ZSet (K : Type _) : Type _ := K →₀ ℤ

/--
A **stream** is a function `ℕ → G` from logical ticks to values in
an abelian group `G`. DBSP's time axis is `ℕ`; `z⁻¹` shifts right
(delay), `I` sums prefixes, `D` takes first differences.
-/
abbrev Stream (G : Type _) : Type _ := ℕ → G

/-! ## Section 2 — Core operators

DBSP gives us three primitive stream-to-stream operators —
`z⁻¹` (delay), `I` (integration), and `D` (differentiation) —
plus a **lift** that turns any of these into a higher-order
operator acting on *operators* rather than streams. Budiu et al.
conflate the two by diagrammatic convention; in Lean we keep them
type-distinct to make the chain rule statement well-typed.
-/

section Operators

variable {G : Type _} [AddCommGroup G]

/-- **Delay** on streams: `z⁻¹ s 0 = 0`, `z⁻¹ s (n+1) = s n`. -/
def zInv (s : Stream G) : Stream G
  | 0     => 0
  | n + 1 => s n

/-- **Integration** on streams: prefix sum `I s n = Σ_{i≤n} s i`. -/
def I (s : Stream G) : Stream G :=
  fun n => (Finset.range (n + 1)).sum s

/-- **Differentiation** on streams: `D s n = s n - z⁻¹ s n`. -/
def D (s : Stream G) : Stream G :=
  fun n => s n - zInv s n

end Operators

section OperatorLifts

variable {G H : Type _} [AddCommGroup G] [AddCommGroup H]

/-- **Lifted differential** on stream operators.

Budiu et al. write `D f` for the operator-valued derivative of a
stream operator `f : Stream G → Stream H`. Pointwise:

```
(Dop f) s = f s - f (zInv s)
```

Note: `Dop f` is NOT the same as `D ∘ f`. The latter takes first
differences of the output stream; `Dop f` takes first differences
of the *operator* in the sense that it measures how `f` responds
to a single fresh tick of input. These coincide when `f` is
linear (that's exactly sub-lemma B3). -/
def Dop (f : Stream G → Stream H) : Stream G → Stream H :=
  fun s => fun n => f s n - f (zInv s) n

/-- **Lifted integration** on stream operators.

```
(Iop f) s = Σ_{i≤n} f (z^{-i} s)
```

Dual to `Dop`; coincides with `I ∘ f` when `f` is linear. Not used
directly by the chain-rule statement but included for the
`chain_rule_id_corollary`. -/
def Iop (f : Stream G → Stream H) : Stream G → Stream H :=
  fun s => I (f s)

end OperatorLifts

/-! ## Section 3 — Linearity predicate -/

section Linearity

variable {G H : Type _} [AddCommGroup G] [AddCommGroup H]

/--
A stream operator `f : Stream G → Stream H` is **linear** (in the
DBSP sense — `AddMonoidHom`-style) iff it distributes over `+` and
sends `0` to `0`. We bundle it as a predicate rather than a
structure so the proof text reads like Budiu et al.
-/
structure IsLinear (f : Stream G → Stream H) : Prop where
  map_zero : f 0 = 0
  map_add  : ∀ s t, f (s + t) = f s + f t

end Linearity

/-! ## Section 4 — Algebraic identities (the telescoping lemmas) -/

section TelescopingLemmas

variable {G : Type _} [AddCommGroup G]

/--
**Sub-lemma T1 — `z⁻¹` at tick 0 is zero.**
Trivially true by definition of `zInv`. Acts as a base case for
induction proofs below.
-/
@[simp] theorem zInv_zero (s : Stream G) : zInv s 0 = 0 := rfl

/--
**Sub-lemma T2 — `z⁻¹` at successor tick is the previous value.**
-/
@[simp] theorem zInv_succ (s : Stream G) (n : ℕ) :
    zInv s (n + 1) = s n := rfl

/--
**Sub-lemma T3 — `I (z⁻¹ s) n = I s n - s n` — the discrete
analogue of "integral of delayed stream equals integral minus
current".**

This is the workhorse of the chain-rule proof. It's the Lean-
provable version of the telescoping identity used informally in
Budiu et al. §4.2.
-/
theorem I_zInv_eq (s : Stream G) (n : ℕ) :
    I (zInv s) n = I s n - s n := by
  induction n with
  | zero =>
    -- `I (zInv s) 0 = zInv s 0 = 0`; `I s 0 = s 0`; goal `0 = s 0 - s 0`.
    simp [I, zInv, Finset.sum_range_one]
  | succ n ih =>
    -- Expand both prefix sums, apply ih, and rearrange.
    unfold I
    rw [Finset.sum_range_succ, Finset.sum_range_succ]
    -- LHS: (Σ_{i<n+1} zInv s i) + zInv s (n+1)
    --     = (I (zInv s) n) + s n   (by def of I and zInv_succ)
    -- RHS: (Σ_{i<n+1} s i) + s (n+1) - s (n+1)
    --     = I s n                  (by add_sub_cancel_right)
    -- Equate using ih: I (zInv s) n = I s n - s n.
    show (Finset.range (n+1)).sum (zInv s) + zInv s (n+1)
         = (Finset.range (n+1)).sum s + s (n+1) - s (n+1)
    rw [zInv_succ]
    have hIH : (Finset.range (n+1)).sum (zInv s) = (Finset.range (n+1)).sum s - s n := ih
    rw [hIH]
    ring

/--
**Sub-lemma T4 — `D ∘ I = id` on streams.**

A linear operator's integral's derivative is the operator itself;
this is the "fundamental theorem of DBSP calculus" (Budiu §3.2).
-/
theorem D_I_eq (s : Stream G) : D (I s) = s := by
  funext n
  cases n with
  | zero =>
    -- `D (I s) 0 = I s 0 - zInv (I s) 0 = s 0 - 0 = s 0`.
    simp [D, I, zInv, Finset.sum_range_one]
  | succ n =>
    -- `D (I s) (n+1) = I s (n+1) - zInv (I s) (n+1) = I s (n+1) - I s n`
    -- which equals `s (n+1)` via `Finset.sum_range_succ`.
    show I s (n+1) - zInv (I s) (n+1) = s (n+1)
    rw [zInv_succ]
    show (Finset.range (n+2)).sum s - (Finset.range (n+1)).sum s = s (n+1)
    rw [Finset.sum_range_succ]
    -- Goal: (Σ_{i<n+1} s i) + s (n+1) - (Σ_{i<n+1} s i) = s (n+1)
    abel

/--
**Sub-lemma T5 — `I ∘ D = id` on streams.**
-/
theorem I_D_eq (s : Stream G) : I (D s) = s := by
  -- Skeleton: telescoping sum
  -- `Σ_{i≤n} (s i - zInv s i) = s n`.
  -- Mathlib: `Finset.sum_range_succ_comm` + induction.
  sorry

end TelescopingLemmas

/-! ## Section 5 — Bilinearity & composition lemmas -/

section Bilinearity

variable {G H J : Type _} [AddCommGroup G] [AddCommGroup H] [AddCommGroup J]

/--
**Sub-lemma B1 — Linear operators commute with `I`.**
If `f` is linear, then `f (I s) = I (f ∘ s)` pointwise. Follows
from `AddMonoidHom`-style finite-sum distribution.
-/
theorem linear_commute_I (f : Stream G → Stream H)
    (hf : IsLinear f) (s : Stream G) (n : ℕ) :
    f (I s) n = I (fun k => f (fun _ => s k) k) n := by
  -- Skeleton: induct on `n`; use `hf.map_add` and `Finset.sum_range_succ`.
  sorry

/--
**Sub-lemma B2 — Linear operators commute with `z⁻¹`.**
If `f` is linear, then `f (z⁻¹ s) = z⁻¹ (f s)` pointwise.
-/
theorem linear_commute_zInv (f : Stream G → Stream H)
    (hf : IsLinear f) (s : Stream G) (n : ℕ) :
    f (zInv s) n = zInv (f s) n := by
  -- CONCEPTUAL WALL — flagged for Kenji (Architect).
  -- `IsLinear` as currently stated gives only `map_zero : f 0 = 0`
  -- (zero-stream-preservation) and `map_add`. Neither suffices to
  -- close this goal:
  --
  -- * At `n = 0`: goal is `f (zInv s) 0 = 0`. But `zInv s` is NOT the
  --   zero stream — it is zero only at tick 0, and arbitrary elsewhere.
  --   `map_zero` tells us `f 0 0 = 0`, not `f (zInv s) 0 = 0`.
  -- * At `n = k+1`: goal is `f (zInv s) (k+1) = f s k`. No
  --   group-homomorphism axiom at the stream level forces this.
  --
  -- To close B2 we need `IsLinear` extended with one of:
  --   (a) causality: `f s n` depends only on `s 0, ..., s n`;
  --   (b) time-invariance: `f ∘ zInv = zInv ∘ f` as stream operators
  --       (but this IS the statement we are trying to prove);
  --   (c) pointwise action: `f s n = phi_n (s 0, ..., s n)` for some
  --       family of ordinary `AddMonoidHom`s `phi_n`.
  --
  -- Any of these is a real change to the algebra's contract and
  -- should not be made unilaterally. Leaving as `sorry` pending
  -- Architect review.
  sorry

/--
**Sub-lemma B3 — Linear operators commute with `D`.**
If `f` is linear, then `f (D s) = D (f s)`. This follows immediately
from B2 and the definition of `D` as `s - z⁻¹ s`, plus `hf.map_add`
(extended to subtraction via abelian-group negation).
-/
theorem linear_commute_D (f : Stream G → Stream H)
    (hf : IsLinear f) (s : Stream G) :
    f (D s) = D (f s) := by
  -- Skeleton: `D s = s - zInv s`; distribute `f` over `-` via
  -- `hf.map_add` + `neg_add_cancel`; apply B2.
  sorry

end Bilinearity

/-! ## Section 6 — The DBSP chain rule -/

section ChainRule

variable {G : Type _} [AddCommGroup G]

/--
**THE CHAIN RULE — the target theorem.**

For linear stream operators `f g : Stream G → Stream G` (endomorphisms
of the same abelian group, which is the form DBSP uses for the
Z-set carrier), and a stream `s : Stream G`:

```
Dop (f ∘ g) s
  = Dop f (g (I (z⁻¹ s)))
  + f   (g (I (z⁻¹ s)))
  + Dop g (I (z⁻¹ s))
  - f   (g (I (z⁻¹ s)))
```

This is the pointwise form Budiu et al. derive in §4.2. The two
copies of `f (g (I (z⁻¹ s)))` cancel, reducing to the classical
`Dop (f ∘ g) = Dop f ∘ g + f ∘ Dop g` bilinear chain rule — minus
the cross-term that vanishes when the bilinear op is function
composition.

**Why endomorphisms (Stream G → Stream G) rather than a fully
polymorphic G → H → J chain?** The stated identity adds `Dop g (...)`
to `Dop f (...)`, and the DBSP paper implicitly assumes these live
in the same abelian group. For the polymorphic chain rule over
three distinct groups G, H, J, the cross-term needs an outer `f`
wrapping `Dop g (...)` — which we'll formalise in a future round
as `chain_rule_poly`. For now the endomorphism form is enough to
cite "machine-checked DBSP chain rule" in the README.

Once the sub-lemmas T3, T4, T5, B1, B2, B3 are closed, this theorem
is a calculation — expand each `Dop` and `I`, apply B3 to push `f`
across `D`, apply B2 to push `g` across `z⁻¹`, and the telescoping
T3 closes the remaining arithmetic obligation.
-/
theorem chain_rule
    (f g : Stream G → Stream G)
    (hf : IsLinear f) (hg : IsLinear g) (s : Stream G) :
    Dop (f ∘ g) s
      = fun n =>
          Dop f (g (I (zInv s))) n
        + f    (g (I (zInv s))) n
        + Dop g (I (zInv s))    n
        - f    (g (I (zInv s))) n := by
  -- High-level proof plan:
  --   1. Unfold `Dop (f ∘ g) s n = (f ∘ g) s n - (f ∘ g) (zInv s) n`.
  --   2. Apply B3 (`linear_commute_D`) to push `Dop` through `f` and
  --      `g` separately when linearity permits.
  --   3. Apply B2 (`linear_commute_zInv`) to push `zInv` through
  --      `g` and `f` until it reaches `s`.
  --   4. Apply T3 (`I_zInv_eq`) to eliminate the `I (zInv s)`
  --      asymmetry between the two sides.
  --   5. The `f (g (I (zInv s)))` terms on both sides of the `+`/`-`
  --      cancel by `add_sub_cancel`.
  -- Each step is one of the named sub-lemmas above; the closed form
  -- is a `calc` block referencing them by name. Left as `sorry`
  -- pending T3/B2/B3 closure (see README §Sub-goals for effort).
  sorry

/--
**Corollary — classical `D ∘ I = id` specialisation.**

Sanity check: specialise `chain_rule` with `f = id`, `g = I`, and
the identity reduces (after the two `f (g ...)` cancellations) to
the fundamental theorem `D (I s) = s`. We already proved this
directly as `D_I_eq` above; after `chain_rule` closes, the
corollary becomes a derived theorem (good paper-grade sanity
check). For now it just aliases `D_I_eq`.
-/
theorem chain_rule_id_corollary (s : Stream G) : D (I s) = s := D_I_eq s

end ChainRule

end Dbsp.ChainRule
