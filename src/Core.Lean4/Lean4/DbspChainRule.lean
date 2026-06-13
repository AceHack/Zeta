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

## Proof state (round 35 — fully closed)

This file is structured as **named sub-lemmas** — T1 / T2 / T3 /
T4 / T5 for the telescoping identities and B1 / B2 / B3 for the
bilinear/composition lemmas. As of round 35 every sub-lemma and
the main `chain_rule` theorem are **closed with `by` tactics**;
no `sorry` remains in any proof body.

Round-35 landmarks:

* B2 resolved from a conceptual wall into a contract field —
  `IsTimeInvariant` predicate, elevated to an axiom matching the
  DBSP paper's ~~unspoken premise (Budiu et al. Prop. 3.5)~~ LTI condition [corrected 2026-05-05: Theorem 3.3 states LTI explicitly; paper makes it explicit, formalization separates sub-properties].
* B1 statement corrected — the earlier `f (fun _ => s k) k` form
  silently required pointwise-linearity; the generic linear-
  plus-time-invariant form is `f (I s) = I (f s)`.
* `chain_rule` statement corrected — the earlier "expanded
  bilinear" eight-term form was unsound for composition
  (impulse counter-example: `f = g = id`, `s = δ₀`, `n = 0`
  gave LHS `= 1`, RHS `= 0`). Restated in classical form
  `Dop (f ∘ g) s = f (Dop g s)`, which IS the identity DBSP
  §4.2 proves for composition of linear time-invariant
  operators.

See `docs/research/chain-rule-proof-log.md` for the full
decision history behind each statement fix.

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
import Mathlib.Algebra.BigOperators.Group.Finset.Basic
import Mathlib.Data.Finsupp.Basic
import Mathlib.Logic.Function.Basic
import Mathlib.Tactic.Ring
import Mathlib.Tactic.Abel
import Mathlib.Tactic.Linarith

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

/-- `z⁻¹` at tick 0 is zero. Pattern-match reduct (`rfl`). -/
@[simp] theorem zInv_zero (s : Stream G) : zInv s 0 = 0 := rfl

/-- `z⁻¹` at successor tick is the previous value. Pattern-match reduct (`rfl`). -/
@[simp] theorem zInv_succ (s : Stream G) (n : ℕ) :
    zInv s (n + 1) = s n := rfl

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

/-! ## Section 3 — Linearity predicate and refinements

Round-35 update (Architect-reviewed, see
`docs/research/chain-rule-proof-log.md`). Earlier rounds bundled
everything into one `IsLinear` predicate (`map_zero` +
`map_add`). That predicate is insufficient to close B2
(`linear_commute_zInv`) — `map_add` alone does not force
commutation with delay. Three candidate upgrades were considered:

* **Causality** — output at tick `n` depends only on input at
  ticks `≤ n`. True for `D`, `I`, `zInv`, every DBSP primitive.
  Necessary but not sufficient for B2: a causal linear operator
  with a time-dependent kernel `h(n,k)` is causal but need not
  commute with `zInv`.
* **Time-invariance** — `f ∘ zInv = zInv ∘ f` as stream
  operators. This IS B2; adding it as an axiom closes B2
  trivially. In DBSP literature this corresponds to the LTI
  condition: ~~unspoken premise of Budiu et al. Proposition 3.5~~ Budiu et al. Theorem 3.3 [corrected 2026-05-05: paper states `Q^Delta = Q` for LTI operators explicitly via Theorem 3.3, not in an unspoken premise].
* **Pointwise action** — `f s n = φ (s n)` for some
  `AddMonoidHom φ`. Strong; implies both causal and time-
  invariant. But **disqualifies** the DBSP primitives: `I s n =
  Σ_{i≤n} s i` is not pointwise.

The round-35 resolution stratifies the hierarchy:

```
  IsLinear                — map_zero, map_add
  IsCausal                — causality predicate (structural)
  IsTimeInvariant         — commutation with zInv (the B2 axiom)
  IsPointwiseLinear       — IsLinear + φ witness; implies both
                            IsCausal and IsTimeInvariant
```

`chain_rule` and its sub-lemmas take a combined `IsLinear ∧
IsTimeInvariant` hypothesis. A caller proving an operator is
`IsPointwiseLinear` gets the combined hypothesis for free via
the upgrade theorems below. The DBSP primitives (`D`, `I`,
`zInv`) will be discharged as `IsLinear ∧ IsTimeInvariant` but
NOT as `IsPointwiseLinear` — matching the DBSP paper's treatment.
-/

section Linearity

variable {G H : Type _} [AddCommGroup G] [AddCommGroup H]

/--
A stream operator `f : Stream G → Stream H` is **linear** (in the
DBSP sense — `AddMonoidHom`-style) iff it distributes over `+` and
sends `0` to `0`. We bundle it as a predicate rather than a
structure so the proof text reads like Budiu et al.

Note: `IsLinear` alone is **not** enough to close B2
(`linear_commute_zInv`). See the hierarchy above — callers
typically want `IsLinear` together with `IsTimeInvariant`, or
the combined `IsPointwiseLinear` when the operator is genuinely
pointwise.
-/
structure IsLinear (f : Stream G → Stream H) : Prop where
  map_zero : f 0 = 0
  map_add  : ∀ s t, f (s + t) = f s + f t

/--
A stream operator is **causal** iff its output at tick `n`
depends only on input ticks `0, …, n`. This is a structural
property: two streams that agree on the first `n+1` ticks
produce the same output at tick `n`.

True for every DBSP primitive (`D`, `I`, `zInv`, any lifted
scalar map). Caller's responsibility to prove for arbitrary
stream operators.
-/
structure IsCausal (f : Stream G → Stream H) : Prop where
  causal : ∀ s t n, (∀ k, k ≤ n → s k = t k) → f s n = f t n

/--
A stream operator is **time-invariant** iff it commutes with
delay: `f (zInv s) n = zInv (f s) n` for every stream and tick.

This is exactly sub-lemma B2, elevated to an axiom. Adding it
to the predicate lattice reflects the DBSP paper's treatment:
time-invariance is a defining property of "stream operator", not
a theorem derivable from `map_add`.

True for every DBSP primitive. Caller's responsibility to prove
for user-defined stream operators.
-/
structure IsTimeInvariant (f : Stream G → Stream H) : Prop where
  commute_zInv : ∀ s n, f (zInv s) n = zInv (f s) n

/--
A stream operator is **pointwise-linear** iff there exists an
ordinary abelian-group homomorphism `φ : G →+ H` with
`f s n = φ (s n)` for every stream and tick.

Strictly stronger than `IsLinear` on its own — pointwise-linear
operators automatically satisfy `IsCausal` (trivially — output
at `n` uses only input at `n`) and `IsTimeInvariant` (since
`φ (zInv s n) = zInv (φ ∘ s) n` by the definition of `zInv`
and `φ 0 = 0`).

**Does NOT** include `I`, `D`, `zInv` — those operators
integrate over history or shift, so they are not pointwise. They
are `IsLinear ∧ IsCausal ∧ IsTimeInvariant` but not
`IsPointwiseLinear`.
-/
structure IsPointwiseLinear (f : Stream G → Stream H) : Prop extends
    IsLinear f where
  pointwise : ∃ phi : G →+ H, ∀ s n, f s n = phi (s n)

/-- Every pointwise-linear operator is causal. Output at tick
`n` uses only input at tick `n`. -/
theorem IsPointwiseLinear.toCausal (f : Stream G → Stream H)
    (hf : IsPointwiseLinear f) : IsCausal f := by
  obtain ⟨phi, hphi⟩ := hf.pointwise
  refine ⟨?_⟩
  intro s t n h_agree
  rw [hphi s n, hphi t n, h_agree n (le_refl n)]

/-- Every pointwise-linear operator is time-invariant.

At tick 0: `f (zInv s) 0 = φ (zInv s 0) = φ 0 = 0 = zInv (f s) 0`.

At tick `n+1`: `f (zInv s) (n+1) = φ (zInv s (n+1)) = φ (s n) =
f s n = zInv (f s) (n+1)`. -/
theorem IsPointwiseLinear.toTimeInvariant (f : Stream G → Stream H)
    (hf : IsPointwiseLinear f) : IsTimeInvariant f := by
  obtain ⟨phi, hphi⟩ := hf.pointwise
  refine ⟨?_⟩
  intro s n
  cases n with
  | zero =>
    -- f (zInv s) 0 = phi (zInv s 0) = phi 0 = 0; zInv (f s) 0 = 0
    rw [hphi (zInv s) 0, zInv_zero, map_zero, zInv_zero]
  | succ n =>
    -- f (zInv s) (n+1) = phi (zInv s (n+1)) = phi (s n) = f s n
    -- zInv (f s) (n+1) = f s n
    rw [hphi (zInv s) (n+1), zInv_succ, zInv_succ, hphi s n]

end Linearity

/-! ## Section 4 — Algebraic identities (the telescoping lemmas) -/

section TelescopingLemmas

variable {G : Type _} [AddCommGroup G]

/--
**Sub-lemma T1 — `z⁻¹` at tick 0 is zero.**
Moved to Section 2 alongside `def zInv`; re-exported here as a
named alias for backward reference in the prose below.
-/
theorem T1_zInv_zero (s : Stream G) : zInv s 0 = 0 := zInv_zero s

/--
**Sub-lemma T2 — `z⁻¹` at successor tick is the previous value.**
Moved to Section 2 alongside `def zInv`; alias retained.
-/
theorem T2_zInv_succ (s : Stream G) (n : ℕ) :
    zInv s (n + 1) = s n := zInv_succ s n

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
    simp [I, zInv]
  | succ n ih =>
    -- Expand both prefix sums (explicit function to avoid double match
    -- on a single `rw [sum_range_succ]`), apply ih, and rearrange.
    show I (zInv s) (n + 1) = I s (n + 1) - s (n + 1)
    have hL : I (zInv s) (n + 1) = I (zInv s) n + zInv s (n + 1) :=
      Finset.sum_range_succ (zInv s) (n + 1)
    have hR : I s (n + 1) = I s n + s (n + 1) :=
      Finset.sum_range_succ s (n + 1)
    rw [hL, hR, zInv_succ, ih]
    -- Goal: (I s n - s n) + s n = I s n + s (n+1) - s (n+1)
    abel

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
    simp [D, I, zInv]
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
  funext n
  induction n with
  | zero =>
    -- `I (D s) 0 = D s 0 = s 0 - zInv s 0 = s 0 - 0 = s 0`.
    simp [I, D, zInv]
  | succ n ih =>
    -- `I (D s) (n+1) = I (D s) n + D s (n+1) = s n + (s (n+1) - s n) = s (n+1)`.
    show I (D s) (n + 1) = s (n + 1)
    unfold I
    rw [Finset.sum_range_succ]
    -- Goal: (Σ_{i<n+1} D s i) + D s (n+1) = s (n+1).
    -- `ih` gives `(Σ_{i<n+1} D s i) = s n`.
    have hIH : (Finset.range (n + 1)).sum (D s) = s n := ih
    rw [hIH]
    show s n + D s (n + 1) = s (n + 1)
    unfold D
    rw [zInv_succ]
    -- Goal: s n + (s (n+1) - s n) = s (n+1).
    abel

end TelescopingLemmas

/-! ## Section 5 — Bilinearity & composition lemmas -/

section Bilinearity

variable {G H J : Type _} [AddCommGroup G] [AddCommGroup H] [AddCommGroup J]

/--
**Sub-lemma B1 — Linear time-invariant operators commute with `I`.**

Round-35 update: statement corrected from the earlier
`f (I s) n = I (fun k => f (fun _ => s k) k) n` form, which was
unsound (it silently assumed `f` was pointwise-linear — the very
predicate we disentangled in §3). The correct form for generic
`IsLinear ∧ IsTimeInvariant` operators is the stream equation
`f (I s) = I (f s)`. See `docs/research/chain-rule-proof-log.md`
§"B1 statement fix" for the counter-example at `f = zInv`.

Proof strategy: both sides satisfy the recurrence
`x = f s + zInv x` (left side uses `I s = s + zInv (I s)` +
`map_add` + time-invariance; right side is the definition of
`I`). By induction on `n`, they agree pointwise.
-/
theorem linear_commute_I (f : Stream G → Stream H)
    (hf : IsLinear f) (hti : IsTimeInvariant f)
    (s : Stream G) (n : ℕ) :
    f (I s) n = I (f s) n := by
  -- Recurrence for I on the input stream: I s = s + zInv (I s).
  have hIs_stream : I s = s + zInv (I s) := by
    funext k
    cases k with
    | zero =>
      show (Finset.range 1).sum s = s 0 + zInv (I s) 0
      rw [Finset.sum_range_one, zInv_zero, add_zero]
    | succ m =>
      show (Finset.range (m + 2)).sum s = s (m + 1) + zInv (I s) (m + 1)
      rw [zInv_succ, Finset.sum_range_succ]
      show (Finset.range (m + 1)).sum s + s (m + 1) = s (m + 1) + I s m
      rw [show I s m = (Finset.range (m + 1)).sum s from rfl]
      abel
  -- Recurrence for I on the output stream.
  have hIfs_stream : I (f s) = f s + zInv (I (f s)) := by
    funext k
    cases k with
    | zero =>
      show (Finset.range 1).sum (f s) = f s 0 + zInv (I (f s)) 0
      rw [Finset.sum_range_one, zInv_zero, add_zero]
    | succ m =>
      show (Finset.range (m + 2)).sum (f s) = f s (m + 1) + zInv (I (f s)) (m + 1)
      rw [zInv_succ, Finset.sum_range_succ]
      show (Finset.range (m + 1)).sum (f s) + f s (m + 1)
           = f s (m + 1) + I (f s) m
      rw [show I (f s) m = (Finset.range (m + 1)).sum (f s) from rfl]
      abel
  -- Push f through: f (I s) = f s + zInv (f (I s)).
  have hfIs_eq : f (I s) = f s + zInv (f (I s)) := by
    have h1 : f (I s) = f (s + zInv (I s)) := congrArg f hIs_stream
    have h2 : f (s + zInv (I s)) = f s + f (zInv (I s)) := hf.map_add s (zInv (I s))
    have h3 : f (zInv (I s)) = zInv (f (I s)) :=
      funext fun k => hti.commute_zInv (I s) k
    calc f (I s) = f (s + zInv (I s))        := h1
      _ = f s + f (zInv (I s)) := h2
      _ = f s + zInv (f (I s)) := by rw [h3]
  -- Pointwise induction on n, using both recurrences.
  induction n with
  | zero =>
    rw [congrFun hfIs_eq 0, congrFun hIfs_stream 0]
    show f s 0 + zInv (f (I s)) 0 = f s 0 + zInv (I (f s)) 0
    rw [zInv_zero, zInv_zero]
  | succ m ih =>
    rw [congrFun hfIs_eq (m + 1), congrFun hIfs_stream (m + 1)]
    show f s (m + 1) + zInv (f (I s)) (m + 1)
       = f s (m + 1) + zInv (I (f s)) (m + 1)
    rw [zInv_succ, zInv_succ, ih]

/--
**Sub-lemma B2 — Time-invariant operators commute with `z⁻¹`.**

Round-35 update: the hypothesis is now `IsTimeInvariant f`, not
`IsLinear f`. Map-addition is not enough to force commutation
with delay (see `IsTimeInvariant` docstring in Section 3 for
the analysis). Callers that have proven `IsPointwiseLinear f`
can derive `IsTimeInvariant f` via
`IsPointwiseLinear.toTimeInvariant`.

The proof is a one-liner now that the structural axiom lives
where it belongs.
-/
theorem linear_commute_zInv (f : Stream G → Stream H)
    (hti : IsTimeInvariant f) (s : Stream G) (n : ℕ) :
    f (zInv s) n = zInv (f s) n :=
  hti.commute_zInv s n

/--
**Sub-lemma B3 — Linear + time-invariant operators commute with
`D`.**

Round-35 update: the hypothesis is now `IsLinear f ∧
IsTimeInvariant f`. `IsLinear` gives the additive structure to
distribute `f` over `D s = s - zInv s`; `IsTimeInvariant` gives
the `zInv` commutation needed to close the proof. Callers that
have proven `IsPointwiseLinear f` can derive both via
`IsPointwiseLinear.toTimeInvariant` and the inherited
`toIsLinear`.
-/
theorem linear_commute_D (f : Stream G → Stream H)
    (hf : IsLinear f) (hti : IsTimeInvariant f) (s : Stream G) :
    f (D s) = D (f s) := by
  -- Derive `f (-t) = -(f t)` from map_add + map_zero.
  have h_neg : ∀ t : Stream G, f (-t) = -(f t) := by
    intro t
    have h := hf.map_add t (-t)
    rw [add_neg_cancel, hf.map_zero] at h
    exact (neg_eq_of_add_eq_zero_right h.symm).symm
  -- `D s = s + (-zInv s)` as a stream (pointwise rewriting of subtraction).
  have hDs : D s = s + (-zInv s) := by
    funext m
    show s m - zInv s m = s m + -(zInv s m)
    exact sub_eq_add_neg (s m) (zInv s m)
  rw [hDs, hf.map_add, h_neg]
  -- Goal: f s + -(f (zInv s)) = D (f s)
  funext n
  -- Pi.neg_apply already reduced definitionally; `-f (zInv s) n` is the shape.
  show f s n + -(f (zInv s) n) = D (f s) n
  rw [hti.commute_zInv]
  -- Goal: f s n + -(zInv (f s) n) = D (f s) n
  show f s n + -(zInv (f s) n) = f s n - zInv (f s) n
  exact (sub_eq_add_neg (f s n) (zInv (f s) n)).symm

end Bilinearity

/-! ## Section 6 — The DBSP chain rule -/

section ChainRule

variable {G : Type _} [AddCommGroup G]

/--
**`Dop` commutation with LTI composition — Theorem-3.3 corollary.**

**Paper mapping.** This is *not* Proposition 3.2 of Budiu et al.
arXiv:2203.16684. It is a corollary of Theorem 3.3 (an LTI
operator satisfies `Q^Δ = Q`, equivalently `D ∘ Q = Q ∘ D`).
The actual Proposition 3.2 chain rule — with the paper's
definition `Q^Δ := D ∘ Q ∘ I` — is proven separately below as
`chain_rule_proposition_3_2` with **no linearity or
time-invariance preconditions**.

**Statement.** For linear time-invariant stream operators
`f g : Stream G → Stream G` and a stream `s : Stream G`:

```
Dop (f ∘ g) s  =  f (Dop g s)
```

Recall (line 164): `Dop f` is the *operator-valued* differential,
defined pointwise as `Dop f s = f s - f (zInv s)`, which
coincides with `D ∘ f` exactly when `f` is linear. So this
theorem, unfolded under its LTI preconditions, reads
`D (f (g s)) = f (D (g s))` — i.e. `D` commutes past `f` when
`f` is LTI. That commutation is immediate from Theorem 3.3.

Round-35 statement correction: earlier rounds shipped an
"expanded bilinear" form with eight terms that purported to
collapse by cancellation. A counter-example (`f = g = id`,
`s = δ₀`, `n = 0`: LHS = `1`, RHS = `0`) showed the expanded
form was unsound as transcribed. See
`docs/research/chain-rule-proof-log.md` §"chain_rule statement
fix" for the sanity check and the paper-trail on why the
classical form is what DBSP §4.2 actually proves for
composition (vs. the different bilinear chain rule for
general `⊗`). The fully polymorphic `chain_rule_poly`
(bilinear `⊗` over three distinct groups G, H, J) remains a
future-round target.

**Name history.** Round-35 internal review (paper-drift audit
against arXiv:2203.16684 §3.1-3.2 on 2026-04-19) renamed this
from `chain_rule` → `Dop_LTI_commute` once it was clear the
old name overclaimed — the real Proposition 3.2 is the theorem
below. The old name is kept as an `abbrev` alias for compat
(see bottom of this section).

Proof: unfold both `Dop`s, use `g` time-invariance to merge
`g (zInv s)` with `zInv (g s)`, then use `f` linearity (map_sub
derived from map_add + map_zero) to pull the subtraction outside
`f`.
-/
-- `hti_f` and `hg` are carried for interface symmetry (the polymorphic
-- extensions will need them) even though the classical endomorphism
-- form below uses only `hf` and `hti_g`. Touching both in the proof body
-- silences the unused-variable linter without changing the public signature.
theorem Dop_LTI_commute
    (f g : Stream G → Stream G)
    (hf : IsLinear f) (hti_f : IsTimeInvariant f)
    (hg : IsLinear g) (hti_g : IsTimeInvariant g)
    (s : Stream G) :
    Dop (f ∘ g) s = f (Dop g s) := by
  -- Interface-symmetry witnesses; unused in the classical form but required
  -- for the polymorphic chain_rule_poly extension.
  have _interface_witness : IsTimeInvariant f ∧ IsLinear g := ⟨hti_f, hg⟩
  -- Derive f's map_neg and map_sub from map_add + map_zero.
  have h_f_neg : ∀ t : Stream G, f (-t) = -(f t) := by
    intro t
    have h := hf.map_add t (-t)
    rw [add_neg_cancel, hf.map_zero] at h
    exact (neg_eq_of_add_eq_zero_right h.symm).symm
  have h_f_sub : ∀ a b : Stream G, f (a - b) = f a - f b := by
    intro a b
    rw [sub_eq_add_neg, hf.map_add, h_f_neg, ← sub_eq_add_neg]
  -- Dop g s = g s - zInv (g s)  (uses g time-invariance).
  have h_Dop_g : Dop g s = g s - zInv (g s) := by
    funext k
    show g s k - g (zInv s) k = g s k - zInv (g s) k
    rw [hti_g.commute_zInv s k]
  -- Push Dop through composition on the LHS.
  funext n
  show f (g s) n - f (g (zInv s)) n = f (Dop g s) n
  -- Push zInv inside g on the LHS.
  have h_g_TI : g (zInv s) = zInv (g s) := funext (hti_g.commute_zInv s)
  rw [h_g_TI, h_Dop_g, h_f_sub]
  -- Goal: f (g s) n - f (zInv (g s)) n = (f (g s) - f (zInv (g s))) n
  rfl

/--
**Corollary — classical `D ∘ I = id` specialisation.**

Sanity check: specialise `Dop_LTI_commute` with `f = id`,
`g = I`, and the identity reduces (after the two `f (g ...)`
cancellations) to the fundamental theorem `D (I s) = s`. We
already proved this directly as `D_I_eq` above; after the
chain-rule theorems close, the corollary becomes a derived
theorem (good paper-grade sanity check). For now it just
aliases `D_I_eq`.
-/
theorem chain_rule_id_corollary (s : Stream G) : D (I s) = s := D_I_eq s

/-! ### Proposition 3.2 (Budiu et al. arXiv:2203.16684 §3)

The paper defines the **incremental version** of a unary
stream operator `Q : Stream A → Stream B` (Definition 3.1) as:

```
Q^Δ := D ∘ Q ∘ I
```

Proposition 3.2 — the "chain" clause — states that for any
two composable stream operators `Q1, Q2` (no linearity, no
time-invariance precondition):

```
(Q1 ∘ Q2)^Δ = Q1^Δ ∘ Q2^Δ
```

The paper's one-line proof:

```
(Q1 ∘ Q2)^Δ = D ∘ Q1 ∘ Q2 ∘ I                 [Def 3.1]
            = D ∘ Q1 ∘ (I ∘ D) ∘ Q2 ∘ I        [Thm 2.22: I ∘ D = id]
            = (D ∘ Q1 ∘ I) ∘ (D ∘ Q2 ∘ I)     [assoc]
            = Q1^Δ ∘ Q2^Δ.
```

This is the *actual* paper chain rule. We formalise it below.
The `Dop`-based `Dop_LTI_commute` theorem above is a distinct
result (a Theorem-3.3 corollary requiring both operators to
be linear and time-invariant).
-/

section Proposition32

variable {G H K : Type _}
  [AddCommGroup G] [AddCommGroup H] [AddCommGroup K]

/-- **Incremental version** of a unary stream operator, Budiu
et al. Definition 3.1. For `Q : Stream A → Stream B`:

```
Qdelta Q := D ∘ Q ∘ I.
```
-/
def Qdelta (Q : Stream G → Stream H) : Stream G → Stream H :=
  fun s => D (Q (I s))

/-- **Proposition 3.2 (chain clause) — Budiu et al.
arXiv:2203.16684 §3.**

For any two composable stream operators `Q1 : Stream H →
Stream K` and `Q2 : Stream G → Stream H`:

```
Qdelta (Q1 ∘ Q2) = Qdelta Q1 ∘ Qdelta Q2.
```

**No preconditions.** Contrast with `Dop_LTI_commute` above,
which is a distinct `Dop`-based identity requiring linearity
+ time-invariance on both operators.

Proof follows the paper verbatim: unfold `Qdelta` on both
sides, insert `I ∘ D = id` (Theorem 2.22, mechanised here as
`I_D_eq`) between `Q1` and `Q2`, re-associate, refold.
-/
theorem chain_rule_proposition_3_2
    (Q1 : Stream H → Stream K) (Q2 : Stream G → Stream H)
    (s : Stream G) :
    Qdelta (Q1 ∘ Q2) s = Qdelta Q1 (Qdelta Q2 s) := by
  -- LHS by definition: D (Q1 (Q2 (I s)))
  -- RHS by definition: D (Q1 (I (D (Q2 (I s)))))
  -- Reduce RHS to LHS using I (D t) = t with t := Q2 (I s).
  show D (Q1 (Q2 (I s))) = D (Q1 (I (D (Q2 (I s)))))
  rw [I_D_eq (Q2 (I s))]

end Proposition32

/-- **Deprecated alias.** Kept so round-34 and earlier call
sites that imported `chain_rule` continue to type-check. New
code should pick one of:

* `Dop_LTI_commute` — for the `D`-of-operator-output identity
  under LTI preconditions (Theorem-3.3 corollary).
* `chain_rule_proposition_3_2` — for the paper's Proposition
  3.2 over `Qdelta := D ∘ Q ∘ I`, no preconditions.

See `docs/research/chain-rule-proof-log.md` §"paper-drift
audit, round 35" for the rename rationale.
-/
@[deprecated Dop_LTI_commute (since := "2026-04-19")]
theorem chain_rule
    (f g : Stream G → Stream G)
    (hf : IsLinear f) (hti_f : IsTimeInvariant f)
    (hg : IsLinear g) (hti_g : IsTimeInvariant g)
    (s : Stream G) :
    Dop (f ∘ g) s = f (Dop g s) :=
  Dop_LTI_commute f g hf hti_f hg hti_g s

end ChainRule

end Dbsp.ChainRule
