/-
  `MenoBraidedRMatrix` — the abstract R-matrix certificate for the braided-not-symmetric
  earning of `src/Core/MenoBraided.fs`.

  The F# side ships the conjugation-rack Yang–Baxter operator

      R(x ⊗ y) = (x·y·x⁻¹) ⊗ x          (`MenoBraided.braidR`, over V = ℤ[Fₙ] words)

  and earns *braided, not symmetric* on the strength of one tripwire: **σ² ≠ id**,
  i.e. R ∘ R ≠ id.  This file certifies the two abstract lemmas Soraya scoped:

    1.  (`selfBraiding_comp_eq_id`) In ANY symmetric monoidal category the self-braiding
        of an object squares to the identity — the categorical statement of "R² = id".
        This is the Mathlib anchor that fixes the meaning of *symmetric* = involutive
        braiding, tied to `CategoryTheory.SymmetricCategory`.

    2.  (`braidR_isSymmetric_iff_commute`, `braidR_not_symmetric_perm3`) The
        conjugation-rack solution R(x,y) = (x·y·x⁻¹, x) satisfies R² = id **iff** the
        group is abelian; hence over a non-abelian group (concrete witness: S₃) R² ≠ id.
        So the F# `braidR` earns braided-not-symmetric exactly because `Braid.Word`
        lives in the *non-abelian* free group Fₙ.

  We certify the R-matrix axioms ABSTRACTLY (a set-theoretic Yang–Baxter operator on a
  product type is the faithful model of the F# `braidR`, itself a set map on pairs); we
  do NOT port the ZSet monoidal category into Lean.

  SCOPE UPDATE 2026-08-15 — the monoidal half of that scope note is now covered by
  `Lean4/MenoMonoidalHexagons.lean`: the associator + unitors with pentagon/triangle, BOTH
  hexagons (non-strict tuple model at the generating triple; strict list model at all block
  sizes), and the degree argument making copy/discard unrepresentable. It is still not a
  Mathlib `MonoidalCategory` instance — the set-theoretic model is deliberate, matching this
  file — and that limit is named there.

  Anchors: Joyal–Street 1993 (braided monoidal categories); Yang 1967 / Baxter 1972
  (YBE); Joyce 1982 / Fenn–Rourke 1992 (racks/quandles as set-theoretic YB solutions);
  Kassel, *Quantum Groups*.  Work-item 081KYWEM90908QG0R002NHEMZE.
-/
import Mathlib.CategoryTheory.Monoidal.Braided.Basic
import Mathlib.GroupTheory.Perm.Basic
import Mathlib.Data.Fintype.Perm
import Mathlib.Tactic.Group

namespace Zeta.MenoBraided

open CategoryTheory MonoidalCategory

/-! ## Part 0 — the Mathlib anchor: *symmetric* means the double self-braiding is `id`.

`CategoryTheory.SymmetricCategory` extends `BraidedCategory` with exactly the axiom
`(β_ X Y).hom ≫ (β_ Y X).hom = 𝟙 (X ⊗ Y)`.  Specialised to `Y = X` this reads
`(β_ X X).hom ≫ (β_ X X).hom = 𝟙 (X ⊗ X)` — the categorical form of `R ∘ R = id`. -/

/-- In any symmetric monoidal category, an object's self-braiding squares to the identity.
    This is the categorical "R² = id": it is the very content the F# `braidR` must
    *violate* to be braided rather than symmetric. -/
theorem selfBraiding_comp_eq_id
    {C : Type*} [Category C] [MonoidalCategory C] [SymmetricCategory C] (X : C) :
    (β_ X X).hom ≫ (β_ X X).hom = 𝟙 (X ⊗ X) :=
  SymmetricCategory.symmetry X X

/-! ## Part 1 — the set-theoretic R-matrix model.

A set-theoretic braiding on an object V is a map on `V ⊗ V ≅ V × V`.  Modelling `V ⊗ V`
as `α × α`, a braiding is an endomap `R : α × α → α × α`, and (by Part 0) it is
*symmetric* precisely when it is an involution `R ∘ R = id`.  `braidR` below is the exact
Lean image of the F# `MenoBraided.braidR`. -/

/-- A set-theoretic braiding is *symmetric* when it squares to the identity — the set
    model of `selfBraiding_comp_eq_id` with `V ⊗ V` modelled as `α × α`. -/
def IsSymmetric {α : Type*} (R : α × α → α × α) : Prop := R ∘ R = id

/-- The conjugation-rack Yang–Baxter operator `R(x, y) = (x·y·x⁻¹, x)`
    (the Lean image of F# `MenoBraided.braidR`). -/
def braidR {G : Type*} [Group G] : G × G → G × G :=
  fun p => (p.1 * p.2 * p.1⁻¹, p.1)

/-- Its inverse `R⁻¹(u, v) = (v, v⁻¹·u·v)` (the Lean image of F# `MenoBraided.braidRinv`). -/
def braidRinv {G : Type*} [Group G] : G × G → G × G :=
  fun p => (p.2, p.2⁻¹ * p.1 * p.2)

/-- `braidR` is a genuine bijection (a valid set-theoretic braiding): `R⁻¹ ∘ R = id`. -/
theorem braidRinv_braidR {G : Type*} [Group G] (x y : G) :
    braidRinv (braidR (x, y)) = (x, y) := by
  have h0 : braidRinv (braidR (x, y)) = (x, x⁻¹ * (x * y * x⁻¹) * x) := rfl
  rw [h0, Prod.mk.injEq]
  refine ⟨rfl, ?_⟩
  group

/-- …and `R ∘ R⁻¹ = id`. -/
theorem braidR_braidRinv {G : Type*} [Group G] (u v : G) :
    braidR (braidRinv (u, v)) = (u, v) := by
  have h0 : braidR (braidRinv (u, v)) = (v * (v⁻¹ * u * v) * v⁻¹, v) := rfl
  rw [h0, Prod.mk.injEq]
  refine ⟨?_, rfl⟩
  group

/-! ## Part 2 — Lemma 1: the conjugation-rack braiding is symmetric ⟺ abelian. -/

/-- **Lemma 1 (abstract).**  The conjugation-rack braiding is *symmetric* (`R ∘ R = id`)
    **iff** every pair in the group commutes.  Equivalently R² ≠ id ⟺ the group is
    non-abelian: this is precisely *why* `braidR` over the non-abelian free group Fₙ
    earns braided-not-symmetric, and why it would collapse to the symmetry over an
    abelian object. -/
theorem braidR_isSymmetric_iff_commute {G : Type*} [Group G] :
    IsSymmetric (braidR (G := G)) ↔ ∀ x y : G, Commute x y := by
  constructor
  · -- symmetric ⇒ abelian: the second coordinate of R²(x,y) is x·y·x⁻¹, forced to equal y.
    intro h x y
    have hp : braidR (braidR (x, y)) = (x, y) := congrFun h (x, y)
    have h2 : x * y * x⁻¹ = y := congrArg Prod.snd hp
    exact mul_inv_eq_iff_eq_mul.mp h2
  · -- abelian ⇒ symmetric: with commutativity, R sends (x,y) ↦ (y,x) and back.
    intro h
    funext p
    obtain ⟨x, y⟩ := p
    have hxy : x * y * x⁻¹ = y := by have hc := (h x y).eq; rw [hc]; group
    have hyx : y * x * y⁻¹ = x := by have hc := (h y x).eq; rw [hc]; group
    have e1 : braidR (x, y) = (y, x) := by
      have h0 : braidR (x, y) = (x * y * x⁻¹, x) := rfl
      rw [h0, hxy]
    have e2 : braidR (y, x) = (x, y) := by
      have h0 : braidR (y, x) = (y * x * y⁻¹, y) := rfl
      rw [h0, hyx]
    change braidR (braidR (x, y)) = (x, y)
    rw [e1, e2]

/-! ## Part 3 — Lemma 2: a concrete non-abelian witness gives R² ≠ id. -/

/-- If `x` and `y` do NOT commute, then R² ≠ id at `(x, y)` — the general obstruction. -/
theorem braidR_not_involutive_of_not_commute {G : Type*} [Group G] {x y : G}
    (h : ¬ Commute x y) : braidR (braidR (x, y)) ≠ (x, y) := by
  intro heq
  exact h (mul_inv_eq_iff_eq_mul.mp (congrArg Prod.snd heq))

/-- **Lemma 2 (concrete witness).**  In `S₃ = Perm (Fin 3)` the two adjacent
    transpositions `(0 1)` and `(1 2)` do not commute, so the conjugation-rack
    braiding is **not** symmetric: `R ∘ R ≠ id`.  This is the Lean twin of the F#
    P4 tripwire `Braid.equal 3 [1;1] [] = false` (σ² ≠ id). -/
theorem braidR_not_symmetric_perm3 :
    ¬ IsSymmetric (braidR (G := Equiv.Perm (Fin 3))) := by
  intro h
  have hcomm : ¬ Commute (Equiv.swap (0 : Fin 3) 1) (Equiv.swap (1 : Fin 3) 2) := by
    intro hc
    exact absurd hc.eq (by decide)
  exact braidR_not_involutive_of_not_commute hcomm
    (congrFun h (Equiv.swap (0 : Fin 3) 1, Equiv.swap (1 : Fin 3) 2))

/-! ## Part 4 — the missing certificate: `braidR` actually satisfies Yang–Baxter.

THE GAP THIS CLOSES.  Parts 0–3 prove `braidR` is a *bijection* that is *not involutive* — i.e.
"not symmetric".  They never prove it is a **braiding** at all.  The word "Yang–Baxter" appeared
in this file only in prose (the header and the `braidR` docstring), and the sole in-tree evidence
was one `[<Fact>]` on three fixed words in
`tests/Tests.FSharp/BraidR.SectionA24.ConformanceGate.Tests.fs` — a single point, no generator.
`tests/Tests.FSharp/BraidRepYangBaxter.Tests.fs`, despite its name, exercises SWAP / CNOT /
Kauffman–Lomonaco and never touches `braidR`.

So the load-bearing half of "braided, not symmetric" rested on a name rather than a proof: a check
that did not run, wearing the name of one that did.  This part states it and discharges it.

The braid relation on `V ⊗ V ⊗ V` (modelled as `G × G × G`) is `R₁₂ R₂₃ R₁₂ = R₂₃ R₁₂ R₂₃`, the
set-theoretic Yang–Baxter equation.  For the conjugation rack `x ▷ y = x·y·x⁻¹` it holds because
`▷` is **self-distributive** (Joyce 1982; Fenn–Rourke 1992): a rack is *defined* as a set-theoretic
YB solution, and conjugation is the motivating example. -/

/-- `R` acting on the first two tensor factors of `V ⊗ V ⊗ V`. -/
def braidR12 {G : Type*} [Group G] : G × G × G → G × G × G :=
  fun p => (p.1 * p.2.1 * p.1⁻¹, p.1, p.2.2)

/-- `R` acting on the last two tensor factors of `V ⊗ V ⊗ V`. -/
def braidR23 {G : Type*} [Group G] : G × G × G → G × G × G :=
  fun p => (p.1, p.2.1 * p.2.2 * p.2.1⁻¹, p.2.1)

/-- **The Yang–Baxter / braid relation for `braidR`** — `R₁₂ ∘ R₂₃ ∘ R₁₂ = R₂₃ ∘ R₁₂ ∘ R₂₃`.

    Both sides agree definitionally in the second and third coordinates (`x·y·x⁻¹` and `x`); the
    first coordinate is exactly self-distributivity of conjugation,
    `(x ▷ y) ▷ (x ▷ z) = x ▷ (y ▷ z)`, since both reduce to `x·y·z·y⁻¹·x⁻¹`.

    Together with `braidR_not_symmetric_perm3` this is the full earning: `braidR` **is** a braiding
    (this theorem) and is **not** a symmetry (Part 3). -/
theorem braidR_yangBaxter {G : Type*} [Group G] (x y z : G) :
    braidR12 (braidR23 (braidR12 (x, y, z))) = braidR23 (braidR12 (braidR23 (x, y, z))) := by
  simp only [braidR12, braidR23, Prod.mk.injEq, and_true]
  group

/-- The same statement as an equality of maps, which is the form a braiding axiom takes. -/
theorem braidR_yangBaxter_eq {G : Type*} [Group G] :
    braidR12 ∘ braidR23 ∘ braidR12 = (braidR23 ∘ braidR12 ∘ braidR23 : G × G × G → G × G × G) := by
  funext p
  obtain ⟨x, y, z⟩ := p
  exact braidR_yangBaxter x y z

/-- Self-distributivity of conjugation, stated on its own — the rack axiom that makes the
    conjugation operator a set-theoretic Yang–Baxter solution (Joyce 1982; Fenn–Rourke 1992). -/
theorem conj_selfDistrib {G : Type*} [Group G] (x y z : G) :
    (x * y * x⁻¹) * (x * z * x⁻¹) * (x * y * x⁻¹)⁻¹ = x * (y * z * y⁻¹) * x⁻¹ := by
  group

/-! ## Part 5 — negative control: the braid relation actually DISCRIMINATES.

A theorem that is true but vacuous is worth nothing, and this file has already been burned once by
a name standing in for a proof.  Two guards, both machine-checked:

  * `braidR_yangBaxter` is **not** closed by `rfl` — verified separately; the equation needs the
    group axioms, so it carries content rather than unfolding definitionally.
  * a MUTANT that replaces conjugation `x·y·x⁻¹` with plain multiplication `x·y` — not a rack —
    is **rejected** by the same equation (`mut_not_yangBaxter`).  So passing YBE is evidence about
    `braidR` specifically, not a property any similar-shaped operator would enjoy.

`braidR_yangBaxter_perm3_exhaustive` then re-derives the positive case by exhaustive evaluation
over all 216 triples of S₃, independently of the `group` tactic — two routes to the same fact. -/

/-- Mutant of `braidR12`: conjugation `x·y·x⁻¹` weakened to multiplication `x·y`. -/
def mutR12 {G : Type*} [Group G] : G × G × G → G × G × G := fun p => (p.1 * p.2.1, p.1, p.2.2)

/-- Mutant of `braidR23`, likewise. -/
def mutR23 {G : Type*} [Group G] : G × G × G → G × G × G := fun p => (p.1, p.2.1 * p.2.2, p.2.1)

/-- **Negative control.**  The multiplication mutant does NOT satisfy the braid relation, so
    `braidR_yangBaxter` is a discriminating fact about the conjugation rack and not a triviality
    satisfied by any operator of that shape. -/
theorem mut_not_yangBaxter : ¬ (∀ x y z : Equiv.Perm (Fin 3),
    mutR12 (mutR23 (mutR12 (x, y, z))) = mutR23 (mutR12 (mutR23 (x, y, z)))) := by
  decide

set_option maxRecDepth 40000 in
/-- **Second, independent route to the positive case.**  Exhaustive evaluation over all 216 triples
    of `S₃`, using no algebraic tactic — a cross-check on `braidR_yangBaxter`, which is proved
    abstractly by `group`.  If the two ever disagree, one of them is wrong. -/
theorem braidR_yangBaxter_perm3_exhaustive : ∀ x y z : Equiv.Perm (Fin 3),
    braidR12 (braidR23 (braidR12 (x, y, z))) = braidR23 (braidR12 (braidR23 (x, y, z))) := by
  decide

end Zeta.MenoBraided
