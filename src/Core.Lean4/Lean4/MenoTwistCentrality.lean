/-
  `MenoTwistCentrality` — the centrality question for `θ_{Vⁿ} = ρ(Δₙ²)`, answered two ways:
  the Schur/scalar route REFUTED (machine-checked), and the categorical route CARRIED
  (machine-checked).  Work-item 081M00EZXN2087G0R003AY3WSJ.

  Companion to `Lean4.MenoBalancedTwist`, which proves the coherence obstruction vanishes
  (`dbl_cocycle`) and the balanced structure is unique — but which **assumes** naturality as
  a field of `Zeta.MenoBalanced.Twist`.  That assumption is the gap this file closes.

  ## The proposal under test

  > `Δₙ²` generates the centre of `Bₙ` (Chow 1948).  By Schur's lemma a central element acts
  > as a **scalar** on an irreducible representation.  So the general-`n` certificate may need
  > no Artin-action computation at all — it becomes a centrality argument.

  ## Verdict: the Schur route does not apply.  Four independent failures, three checked here.

  1. **Direction.**  Schur's lemma *consumes* centrality and *produces* scalarity.  What the
     certificate needs is centrality itself (it is exactly `Twist.naturality`).  Schur cannot
     supply its own hypothesis.  This one is structural, not checkable.
  2. **The representation is REDUCIBLE** (`actWord_prod`, `linearize_fiber_invariant`).  `ρ`
     permutes the basis `Gⁿ` of `V^⊗n` and **preserves the product** `x₁⋯xₙ`, so each
     product-fibre spans a proper nonzero invariant subspace.  This is not an accident of our
     encoding: it is the second clause of **Artin's characterisation** of braid automorphisms
     (Artin 1925/1947 — `β ∈ Aut(Fₙ)` is geometric iff it sends each `xᵢ` to a conjugate of
     some `x_{π i}` *and fixes the boundary word* `x₁⋯xₙ`).  Irreducibility fails.
  3. **The conclusion is FALSE here** (`fullTwist_not_scalar`).  `ρ(Δ₃²)` is not `lam • id` for
     any `lam` — exhibited on a concrete basis vector.  So by contraposition the hypothesis of
     Schur's lemma cannot hold, independently of (2).
  4. **Scalarity would be the wrong shape anyway** (`scalar_twist_forces_symmetry`).  The
     balanced axiom with `θ_V = id` forces `θ_{V⊗V} = c²`.  If `θ` were scalar, `c²` would be
     scalar, and a basis permutation that is a scalar is the identity — i.e. **symmetry**,
     contradicting the proven `braidR_not_symmetric_perm3`.  Had the shortcut worked it would
     have refuted the structure it was meant to certify.

  A fifth, smaller correction, checked by reading Mathlib rather than by proof: **Mathlib has
  no braid groups** (`grep`: the only occurrence of "braid group" in Mathlib v4.30.0-rc1 is a
  prose comment in `CategoryTheory/Monoidal/Braided/Basic.lean`).  So neither `Δₙ²` nor its
  centrality is available off the shelf.

  ## What survives, and it is the useful half

  The *centrality* intuition is right; only the route through Schur is wrong.  Naturality of
  `θ` — equivalently centrality of `ρ(Δₙ²)` in `ρ(Bₙ)` — **need not be assumed**.  In any
  braided monoidal category it is a CONSEQUENCE of the balanced axiom alone:

  * `PreTwist` — the balanced axiom with **no** naturality field.
  * `PreTwist.natural_braiding` / `natural_braiding_inv` / `natural_associator` /
    `natural_tensor` / the unitors, collected by `natural_of_mem` — `θ` commutes past every
    generating morphism of a free braided monoidal category, from the tensor axiom alone.
  * `PreTwist.toTwist` — hence a `PreTwist` on a **braid-generated** category IS a `Twist`.
    Naturality is derived, not assumed.

  Read in `⟨V⟩`: `Δₙ²` commutes with every braid word, with no appeal to Garside normal forms,
  no appeal to Chow, and no braid group in Lean.  Which also **corrects a citation**: the
  certificate needs only `Δₙ² ∈ Z(Bₙ)` (elementary: `Δσᵢ Δ⁻¹ = σ_{n−i}`), never Chow's
  strictly stronger `Z(Bₙ) = ⟨Δ²⟩`.  Chow was cited for a fact the proof does not use — and in
  the generation direction the cited form is false at `n = 2`, where `Z(B₂) = B₂ = ⟨Δ₂⟩ ⊋ ⟨Δ₂²⟩`.

  ## The named remaining obligation

  `PreTwist.toTwist` takes a hypothesis `BraidGenerated C` (every morphism lies in the
  `⊗`/`≫`-closure of identities, braidings and coherence isomorphisms).  The missing lemma is
  exactly `BraidGenerated ⟨V⟩`, and its content is Joyal–Street 1993 §2 (the braid groupoid is
  the free braided monoidal category on one object).  It is NOT proved here and NOT assumed
  silently: it is a hypothesis with a name, and nothing in this file discharges it.  There is
  no `sorry` in this file; the gap is a hypothesis, which is the more honest encoding — a
  `sorry` would let a downstream proof believe the obligation discharged.

  Anchors: Artin 1925/1947 (the action on `Fₙ`, and the boundary-word invariant used in
  Part 1); Joyal & Street 1993 *Braided Tensor Categories* (free braided monoidal category on
  one object; the balanced axiom); Schur 1905 (the lemma refuted above); Chow 1948 (`Z(Bₙ)`,
  cited here only to record that it is NOT needed); Garside 1969 (`Δ²`).
-/
import Mathlib.CategoryTheory.Monoidal.Braided.Basic
import Mathlib.GroupTheory.SpecificGroups.Dihedral
import Lean4.MenoBraidedRMatrix
import Lean4.MenoBalancedTwist

namespace Zeta.MenoTwistCentrality

/-! ## Part 1 — the Schur route, refuted.

The object is `V = ℤ[Fₙ]` and `V^⊗n` is `ℤ[Gⁿ]` with `ρ(Bₙ)` acting by **permuting the
basis** `Gⁿ` (that `braidR` is a basis bijection is the load-bearing fact of
`MenoBraided.fs`).  Everything below is about that permutation action and its ℤ-linearisation.

The strand list mirrors the shipped F# `MenoBraided.crossingOnList`: a word is a `List ℤ`,
`c > 0` applies `R` at position `|c|-1`, `c < 0` applies `R⁻¹`, out-of-range is a no-op. -/

section Action

variable {G : Type*} [Group G]

/-- `R` at position `i` of a strand list: `(x, y) ↦ (x·y·x⁻¹, x)`.  Out of range = no-op. -/
def actAt : ℕ → List G → List G
  | _, [] => []
  | _, [x] => [x]
  | 0, (x :: y :: rest) => (x * y * x⁻¹) :: x :: rest
  | (i + 1), (x :: rest) => x :: actAt i rest

/-- `R⁻¹` at position `i`: `(u, v) ↦ (v, v⁻¹·u·v)`.  Out of range = no-op. -/
def actAtInv : ℕ → List G → List G
  | _, [] => []
  | _, [x] => [x]
  | 0, (u :: v :: rest) => v :: (v⁻¹ * u * v) :: rest
  | (i + 1), (x :: rest) => x :: actAtInv i rest

/-- One crossing, in the shipped F# encoding: `c > 0` is `σ_{|c|-1}`, `c < 0` its inverse. -/
def crossing (c : ℤ) (s : List G) : List G :=
  if 0 < c then actAt (c.natAbs - 1) s else actAtInv (c.natAbs - 1) s

/-- A braid word acting on a strand list, leftmost letter first (diagram order). -/
def actWord (w : List ℤ) (s : List G) : List G := w.foldl (fun s c => crossing c s) s

/-- **The boundary-word invariant, all `n`.**  `R` preserves the product of the strand words:
    `(x·y·x⁻¹)·x = x·y`.  This is Artin's second clause. -/
theorem actAt_prod (i : ℕ) (s : List G) : (actAt i s).prod = s.prod := by
  induction i generalizing s with
  | zero =>
      match s with
      | [] => simp [actAt]
      | [_] => simp [actAt]
      | x :: y :: rest => simp [actAt, mul_assoc]
  | succ i ih =>
      match s with
      | [] => simp [actAt]
      | [_] => simp [actAt]
      | x :: y :: rest => simp [actAt, ih]

/-- Same for the inverse crossing: `v·(v⁻¹·u·v) = u·v`. -/
theorem actAtInv_prod (i : ℕ) (s : List G) : (actAtInv i s).prod = s.prod := by
  induction i generalizing s with
  | zero =>
      match s with
      | [] => simp [actAtInv]
      | [_] => simp [actAtInv]
      | u :: v :: rest => simp [actAtInv, mul_assoc]
  | succ i ih =>
      match s with
      | [] => simp [actAtInv]
      | [_] => simp [actAtInv]
      | x :: y :: rest => simp [actAtInv, ih]

theorem crossing_prod (c : ℤ) (s : List G) : (crossing c s).prod = s.prod := by
  unfold crossing; split <;> simp [actAt_prod, actAtInv_prod]

/-- **The whole braid group preserves the product, for every `n`.**  Hence `ρ` is a permutation
    representation with a nonconstant invariant — the input to reducibility below. -/
theorem actWord_prod (w : List ℤ) (s : List G) : (actWord w s).prod = s.prod := by
  induction w generalizing s with
  | nil => simp [actWord]
  | cons c w ih =>
      have hstep : actWord (c :: w) s = actWord w (crossing c s) := rfl
      rw [hstep, ih, crossing_prod]

/-- Strand count is preserved (so the fibres below are fibres of a genuine `Bₙ`-set). -/
theorem actAt_length (i : ℕ) (s : List G) : (actAt i s).length = s.length := by
  induction i generalizing s with
  | zero => match s with
    | [] => simp [actAt]
    | [_] => simp [actAt]
    | _ :: _ :: _ => simp [actAt]
  | succ i ih => match s with
    | [] => simp [actAt]
    | [_] => simp [actAt]
    | _ :: _ :: _ => simp [actAt, ih]

end Action

/-! ### Reducibility: the ℤ-linearisation has a proper nonzero invariant submodule.

`V^⊗n = ℤ[Gⁿ]` is modelled by its coordinate functions `Gⁿ → ℤ`; a basis permutation `f` acts
by pullback `v ↦ v ∘ f`.  (For a finite basis this is the free module; the argument below uses
only the pullback, so it is insensitive to the choice.) -/

section Linearize

variable {G : Type*} [Group G]

/-- The ℤ-linearisation of a basis permutation, acting on coordinate functions by pullback.
    (Pushforward along `f` is pullback along `f⁻¹`; the criterion proved below —
    "scalar ⟺ fixes every basis element" — is the same for both, so nothing turns on the
    choice.) -/
def linearize {α : Type*} (f : α → α) (v : α → ℤ) : α → ℤ := v ∘ f

/-- **A basis permutation that MOVES a point is not a scalar.**  General, and the whole of
    Schur's conclusion-side failure: no `lam` can satisfy `v ∘ f = lam • v` for all `v`, as the
    indicator of `f p` already refutes it. -/
theorem linearize_not_scalar {α : Type*} {f : α → α} {p : α} (hp : f p ≠ p) :
    ¬ ∃ lam : ℤ, ∀ v : α → ℤ, linearize f v = fun s => lam * v s := by
  classical
  rintro ⟨lam, h⟩
  have key := congrFun (h (fun s => if s = f p then (1 : ℤ) else 0)) p
  simp only [linearize, Function.comp_apply, if_neg (Ne.symm hp), mul_zero] at key
  exact absurd key (by norm_num)

/-- **The invariant submodule.**  Coordinate functions supported on one product-fibre are
    carried into themselves by every braid word.  Nonzero (it contains the indicator of any
    strand list with that product) and proper as soon as `G` has two elements — so the
    representation is REDUCIBLE and **Schur's lemma does not apply**. -/
theorem linearize_fiber_invariant (g : G) (w : List ℤ) (v : List G → ℤ)
    (hv : ∀ s : List G, s.prod ≠ g → v s = 0) :
    ∀ s : List G, s.prod ≠ g → linearize (actWord w) v s = 0 := by
  intro s hs
  exact hv _ (by rw [actWord_prod]; exact hs)

omit [Group G] in
/-- The fibre submodule is **nonzero**: it contains the indicator of any list in the fibre. -/
theorem fiber_nonzero [DecidableEq (List G)] (s₀ : List G) :
    (fun s => if s = s₀ then (1 : ℤ) else 0) s₀ = 1 := by simp

/-- The fibre submodule is **proper** whenever `G` is nontrivial: a list outside the fibre
    carries an indicator that is not supported on it. -/
theorem fiber_proper {a b : G} (hab : a ≠ b) : ([a] : List G).prod ≠ ([b] : List G).prod := by
  simpa using hab

end Linearize

/-! ### Non-scalarity: Schur's *conclusion* is false here.

Independent of the reducibility argument: if `ρ(Δ₃²)` were `lam • id` we could derive `1 = 0`.
The witness is a concrete triple on which the full twist moves the basis element. -/

/-- The concrete model group, as in `MenoBalancedTwist`: `DihedralGroup 3 ≅ S₃`. -/
abbrev G3 := DihedralGroup 3

/-- `Δ₃² = (σ₁σ₂)³` as a strand-list word (positive generators at positions 0 and 1). -/
def d3sqW : List ℤ := [1, 2, 1, 2, 1, 2]

/-- A basis element the full twist moves.  Checked, not assumed. -/
theorem fullTwist_moves : actWord d3sqW [(1 : G3), DihedralGroup.r 1, DihedralGroup.sr 0]
    ≠ [(1 : G3), DihedralGroup.r 1, DihedralGroup.sr 0] := by decide

/-- **Schur's conclusion is FALSE for `ρ(Δ₃²)`.**  There is no `lam` with
    `ρ(Δ₃²) = lam • id` on the linearised representation.  Contrapositive of Schur's lemma:
    the representation is not irreducible — a second, independent proof of that. -/
theorem fullTwist_not_scalar :
    ¬ ∃ lam : ℤ, ∀ v : List G3 → ℤ,
        linearize (actWord d3sqW) v = fun s => lam * v s :=
  linearize_not_scalar fullTwist_moves

/-- Contrapositive of the above: a scalar basis permutation fixes every basis element. -/
theorem fixed_of_linearize_scalar {α : Type*} {f : α → α}
    (h : ∃ lam : ℤ, ∀ v : α → ℤ, linearize f v = fun s => lam * v s) (p : α) : f p = p := by
  by_contra hp
  exact linearize_not_scalar hp h

/-- The double braiding `R² = ρ(σ₁²) = ρ(Δ₂²)` moves a basis element of `G₃²`. -/
theorem dblBraiding_moves :
    actWord [1, 1] [DihedralGroup.sr 0, (DihedralGroup.r 1 : G3)]
      ≠ [DihedralGroup.sr 0, (DihedralGroup.r 1 : G3)] := by decide

/-- **Failure 4 of the Schur route: scalarity is not merely weaker, it is INCONSISTENT with the
    structure.**  The balanced axiom with `θ_V = id` forces `θ_{V⊗V} = c² = ρ(Δ₂²)`
    (`MenoBalancedTwist.twist_tensor_of_id`).  Were that a scalar, it would fix every basis
    element — i.e. `R² = id`, symmetry — contradicting `braidR_not_symmetric_perm3`.  Had the
    shortcut applied, it would have refuted the very structure it was meant to certify. -/
theorem scalar_twist_forces_symmetry
    (h : ∃ lam : ℤ, ∀ v : List G3 → ℤ, linearize (actWord [1, 1]) v = fun s => lam * v s) :
    False :=
  dblBraiding_moves (fixed_of_linearize_scalar h _)

/-! ### Centrality is not automatic — so Part 2 derives something that CAN fail.

`Hom_{⟨V⟩}(Vⁿ, Vⁿ) = ρ(Bₙ)` is a NONCOMMUTATIVE monoid for `n ≥ 3`; the two adjacent
generators already fail to commute in the action.  Without this, "θ commutes past every
morphism" would be free, and every theorem in Part 2 would be a check that cannot fail. -/

/-- `σ₁` and `σ₂` do not commute in the `braidR` action on `G₃³`. -/
theorem generators_not_commute :
    actWord [1] (actWord [2] [(1 : G3), DihedralGroup.r 1, DihedralGroup.sr 0])
      ≠ actWord [2] (actWord [1] [(1 : G3), DihedralGroup.r 1, DihedralGroup.sr 0]) := by
  decide

/-! ## Part 2 — the route that survives: naturality is DERIVED, not assumed.

`Zeta.MenoBalanced.Twist` carries naturality as a FIELD.  In `⟨V⟩` that field is exactly
"`ρ(Δₙ²)` is central in `ρ(Bₙ)`", and assuming it is assuming the thing the Schur route was
supposed to supply.  It does not have to be assumed: it follows from the balanced axiom in any
braided monoidal category, by the hexagons alone.

**Scope, stated so this file is not read as more than it is.**  What is derived here is
NATURALITY.  It is *not* sensitive to the double-braiding factor in the axiom — the misread
axiom `θ_{A⊗B} = θ_A ⊗ θ_B` would give naturality just as well.  Discriminating the correct
axiom from the misread one is `MenoBalancedTwist.twist_tensor_of_id` /
`misread_axiom_forces_symmetry`, and that division of labour is deliberate: this file removes
an assumption, it does not re-certify the twist's VALUE. -/

section Categorical

open CategoryTheory MonoidalCategory BraidedCategory Zeta.MenoBalanced

universe v u

variable {C : Type u} [Category.{v} C] [MonoidalCategory C] [BraidedCategory C]

/-- **The balanced axiom with NO naturality field.**  Two equations replace the `Twist`
    field `naturality : ∀ {X Y} (f : X ⟶ Y), θ X ≫ f = f ≫ θ Y` — a quantification over
    every morphism of the category — namely the tensor axiom and a single equation at the
    unit.  `unit` is forced in `⟨V⟩`: the unit is the empty strand word `V⁰` and
    `Hom(V⁰, V⁰) = B₀` is trivial, so `θ_I = id` is the only option there. -/
structure PreTwist (C : Type u) [Category.{v} C] [MonoidalCategory C] [BraidedCategory C] where
  /-- The twist component at each object. -/
  θ : ∀ X : C, X ⟶ X
  /-- The balanced axiom (Joyal–Street): the double braiding composed FIRST. -/
  tensor : ∀ X Y : C, θ (X ⊗ Y) = dbl X Y ≫ (θ X ⊗ₘ θ Y)
  /-- The twist is trivial at the unit. -/
  unit : θ (𝟙_ C) = 𝟙 (𝟙_ C)

/-- The double braiding commutes past a braiding — both sides are the six-letter word
    `c c c`.  This is the geometric reason the full twist is central. -/
theorem dbl_comm_braiding (X Y : C) :
    dbl X Y ≫ (β_ X Y).hom = (β_ X Y).hom ≫ dbl Y X := by
  simp [dbl]

/-- `D_{X, I} = id`: the double braiding against the unit collapses. -/
theorem dbl_unit_right (X : C) : dbl X (𝟙_ C) = 𝟙 (X ⊗ 𝟙_ C) := by
  simp [dbl]

/-- `D_{I, X} = id`. -/
theorem dbl_unit_left (X : C) : dbl (𝟙_ C) X = 𝟙 (𝟙_ C ⊗ X) := by
  simp [dbl]

namespace PreTwist

variable (t : PreTwist C)

/-- **Centrality against the braiding** — the load-bearing case, and the categorical form of
    `Δ² σᵢ = σᵢ Δ²`.  From the tensor axiom alone. -/
@[reassoc]
theorem natural_braiding (X Y : C) :
    t.θ (X ⊗ Y) ≫ (β_ X Y).hom = (β_ X Y).hom ≫ t.θ (Y ⊗ X) := by
  rw [t.tensor X Y, t.tensor Y X, Category.assoc, braiding_naturality,
    ← Category.assoc, dbl_comm_braiding, Category.assoc]

/-- Centrality against the inverse braiding. -/
@[reassoc]
theorem natural_braiding_inv (X Y : C) :
    t.θ (Y ⊗ X) ≫ (β_ X Y).inv = (β_ X Y).inv ≫ t.θ (X ⊗ Y) := by
  rw [Iso.comp_inv_eq, Category.assoc, Iso.eq_inv_comp]
  exact (t.natural_braiding X Y).symm

/-- Naturality is closed under `⊗`: if `θ` commutes past `f` and past `g`, it commutes past
    `f ⊗ g`.  From naturality of the double braiding. -/
@[reassoc]
theorem natural_tensor {X X' Y Y' : C} {f : X ⟶ X'} {g : Y ⟶ Y'}
    (hf : t.θ X ≫ f = f ≫ t.θ X') (hg : t.θ Y ≫ g = g ≫ t.θ Y') :
    t.θ (X ⊗ Y) ≫ (f ⊗ₘ g) = (f ⊗ₘ g) ≫ t.θ (X' ⊗ Y') := by
  rw [t.tensor X Y, t.tensor X' Y', Category.assoc, tensorHom_comp_tensorHom,
    hf, hg, ← tensorHom_comp_tensorHom, ← Category.assoc, ← dbl_naturality, Category.assoc]

/-- Naturality against the associator — this is `twist_assoc_consistent` read as a naturality
    square, which is what `dbl_cocycle` bought. -/
@[reassoc]
theorem natural_associator (X Y Z : C) :
    t.θ ((X ⊗ Y) ⊗ Z) ≫ (α_ X Y Z).hom = (α_ X Y Z).hom ≫ t.θ (X ⊗ (Y ⊗ Z)) := by
  have h := twist_assoc_consistent (t.θ X) (t.θ Y) (t.θ Z)
  rw [← t.tensor X Y, ← t.tensor Y Z, ← t.tensor (X ⊗ Y) Z,
    ← Category.assoc (dbl X (Y ⊗ Z)), ← t.tensor X (Y ⊗ Z)] at h
  rw [h]
  simp

/-- Naturality against the inverse associator. -/
@[reassoc]
theorem natural_associator_inv (X Y Z : C) :
    t.θ (X ⊗ (Y ⊗ Z)) ≫ (α_ X Y Z).inv = (α_ X Y Z).inv ≫ t.θ ((X ⊗ Y) ⊗ Z) := by
  rw [Iso.comp_inv_eq, Category.assoc, Iso.eq_inv_comp]
  exact (t.natural_associator X Y Z).symm

/-- Naturality against the right unitor.  Uses `unit`. -/
@[reassoc]
theorem natural_rightUnitor (X : C) :
    t.θ (X ⊗ 𝟙_ C) ≫ (ρ_ X).hom = (ρ_ X).hom ≫ t.θ X := by
  rw [t.tensor X (𝟙_ C), t.unit, dbl_unit_right, Category.id_comp, tensorHom_id]
  exact rightUnitor_naturality (t.θ X)

/-- Naturality against the left unitor.  Uses `unit`. -/
@[reassoc]
theorem natural_leftUnitor (X : C) :
    t.θ (𝟙_ C ⊗ X) ≫ (λ_ X).hom = (λ_ X).hom ≫ t.θ X := by
  rw [t.tensor (𝟙_ C) X, t.unit, dbl_unit_left, Category.id_comp, id_tensorHom]
  exact leftUnitor_naturality (t.θ X)

/-- Naturality against the inverse right unitor. -/
@[reassoc]
theorem natural_rightUnitor_inv (X : C) :
    t.θ X ≫ (ρ_ X).inv = (ρ_ X).inv ≫ t.θ (X ⊗ 𝟙_ C) := by
  rw [Iso.comp_inv_eq, Category.assoc, Iso.eq_inv_comp]
  exact (t.natural_rightUnitor X).symm

/-- Naturality against the inverse left unitor. -/
@[reassoc]
theorem natural_leftUnitor_inv (X : C) :
    t.θ X ≫ (λ_ X).inv = (λ_ X).inv ≫ t.θ (𝟙_ C ⊗ X) := by
  rw [Iso.comp_inv_eq, Category.assoc, Iso.eq_inv_comp]
  exact (t.natural_leftUnitor X).symm

end PreTwist

/-- **The generating class.**  The morphisms of a free braided monoidal category: identities,
    braidings, the coherence isomorphisms, closed under `≫` and `⊗`.  In `⟨V⟩` — the braid
    groupoid — this is every morphism (Joyal–Street 1993 §2). -/
inductive InBraidClosure : ∀ {X Y : C}, (X ⟶ Y) → Prop
  | id (X : C) : InBraidClosure (𝟙 X)
  | braiding (X Y : C) : InBraidClosure (β_ X Y).hom
  | braidingInv (X Y : C) : InBraidClosure (β_ X Y).inv
  | assoc (X Y Z : C) : InBraidClosure (α_ X Y Z).hom
  | assocInv (X Y Z : C) : InBraidClosure (α_ X Y Z).inv
  | leftUnitor (X : C) : InBraidClosure (λ_ X).hom
  | leftUnitorInv (X : C) : InBraidClosure (λ_ X).inv
  | rightUnitor (X : C) : InBraidClosure (ρ_ X).hom
  | rightUnitorInv (X : C) : InBraidClosure (ρ_ X).inv
  | comp {X Y Z : C} {f : X ⟶ Y} {g : Y ⟶ Z} :
      InBraidClosure f → InBraidClosure g → InBraidClosure (f ≫ g)
  | tensor {X X' Y Y' : C} {f : X ⟶ X'} {g : Y ⟶ Y'} :
      InBraidClosure f → InBraidClosure g → InBraidClosure (f ⊗ₘ g)

/-- **THE THEOREM.**  A `PreTwist` commutes past every morphism in the braid closure.  In
    `⟨V⟩`: `ρ(Δₙ²)` is central in `ρ(Bₙ)` — derived from the hexagons, with no Garside normal
    form, no Chow, and no braid group in Lean. -/
theorem PreTwist.natural_of_mem (t : PreTwist C) :
    ∀ {X Y : C} {f : X ⟶ Y}, InBraidClosure f → t.θ X ≫ f = f ≫ t.θ Y := by
  intro X Y f hf
  induction hf with
  | id X => simp
  | braiding X Y => exact t.natural_braiding X Y
  | braidingInv X Y => exact t.natural_braiding_inv X Y
  | assoc X Y Z => exact t.natural_associator X Y Z
  | assocInv X Y Z => exact t.natural_associator_inv X Y Z
  | leftUnitor X => exact t.natural_leftUnitor X
  | leftUnitorInv X => exact t.natural_leftUnitor_inv X
  | rightUnitor X => exact t.natural_rightUnitor X
  | rightUnitorInv X => exact t.natural_rightUnitor_inv X
  | comp _ _ ihf ihg => rw [← Category.assoc, ihf, Category.assoc, ihg, Category.assoc]
  | tensor _ _ ihf ihg => exact t.natural_tensor ihf ihg

/-- **The named remaining obligation.**  "Every morphism is braid-generated."  For `⟨V⟩` this
    is Joyal–Street 1993 §2 (the braid groupoid is the free braided monoidal category on one
    object) together with faithfulness of the Artin action (Artin 1925).  Neither is in
    Mathlib and neither is proved here — it is a HYPOTHESIS with a name, not a `sorry`: a
    `sorry` would let a downstream proof believe the obligation discharged. -/
def BraidGenerated (C : Type u) [Category.{v} C] [MonoidalCategory C] [BraidedCategory C] :
    Prop := ∀ {X Y : C} (f : X ⟶ Y), InBraidClosure f

/-- **Naturality is not an axiom.**  On a braid-generated category a `PreTwist` IS a `Twist`:
    the `naturality` field of `Zeta.MenoBalanced.Twist` is derivable, so the balanced structure
    on `⟨V⟩` rests on the tensor axiom plus one equation at the unit. -/
def PreTwist.toTwist (t : PreTwist C) (h : BraidGenerated C) : Twist C where
  θ := t.θ
  naturality f := t.natural_of_mem (h f)
  tensor := t.tensor

/-- Conversely a `Twist` is a `PreTwist` as soon as its unit component is trivial — so the two
    notions agree exactly where they should, and `PreTwist` is not a weaker object smuggled in
    to make the theorem easy. -/
def _root_.Zeta.MenoBalanced.Twist.toPreTwist (t : Twist C) (hI : t.θ (𝟙_ C) = 𝟙 (𝟙_ C)) :
    PreTwist C where
  θ := t.θ
  tensor := t.tensor
  unit := hI

/-! ### Non-vacuity and the mutants, at the abstract level. -/

/-- `PreTwist` is inhabited (identity twist on a symmetric category) — so Part 2 is not empty.
    Its weakness is the point of Part 3: this witness is SYMMETRIC. -/
def symmetricPreTwist (D : Type u) [Category.{v} D] [MonoidalCategory D] [SymmetricCategory D] :
    PreTwist D where
  θ X := 𝟙 X
  tensor X Y := by simp [dbl_eq_id_of_symmetric]
  unit := rfl

/-- **Mutant 1 — `θ = id`, at the abstract level: REJECTED.**  A `PreTwist` that is
    identically the identity forces every double braiding to collapse, i.e. forces symmetry.
    Since `braidR` is proved non-symmetric, `θ = id` is not a balanced structure on `⟨V⟩`. -/
theorem preTwist_id_forces_symmetry (t : PreTwist C) (h : ∀ X : C, t.θ X = 𝟙 X) (X Y : C) :
    dbl X Y = 𝟙 (X ⊗ Y) := by
  have := t.tensor X Y
  rw [h, h, h] at this
  simpa using this.symm

end Categorical

/-! ## Part 3 — a NON-SYMMETRIC witness.  (Work-item 081M00EZXN2087G0R003AY3WSJ option (b).)

`symmetricPreTwist` inhabits `PreTwist`, but it is symmetric: `dbl = id` there, so it does not
exercise the case the whole verdict is about.  This part builds a braided monoidal category
that is genuinely NOT symmetric, and a `PreTwist` on it with **`θ` at the generator = id and
`θ` at `V ⊗ V` ≠ id** — the exact shape claimed for `⟨V⟩`.

**What it is.**  Objects are strand counts; morphisms exist only between equal counts and carry
an integer that composes by addition.  This is the **writhe / abelianisation shadow** of `⟨V⟩`:
`Bₙ ↠ ℤ` by exponent sum, `β_{m,n} ↦ m·n` (the crossings of a block transposition) and
`θ_n ↦ n(n−1)` (the crossings of `Δₙ²`).

**What it is NOT, stated so it is not over-read.**  Its hom-monoids are ℤ — commutative — so
centrality is free in this model and it does NOT witness the difficulty Part 2 addresses.  That
difficulty is witnessed separately, and concretely, by `generators_not_commute` in the genuine
non-abelian action.  This witness does exactly one job: it shows `PreTwist` admits models with
`dbl ≠ id`, so Part 2 is not silently a theorem about symmetric categories only. -/

namespace Framed

open CategoryTheory MonoidalCategory BraidedCategory Zeta.MenoBalanced

/-- Objects: strand counts.  A structure rather than an abbreviation for `ℕ`, so that the
    category instances below do not become global instances on `ℕ`. -/
structure Obj where
  /-- The number of strands. -/
  n : ℕ

/-- Morphisms: only between equal strand counts, carrying an integer framing. -/
structure Hom (a b : Obj) where
  /-- Morphisms exist only between equal objects (the braid *groupoid* shape). -/
  len : a = b
  /-- The framing — the writhe of the braid word this morphism abstracts. -/
  w : ℤ

@[ext]
theorem Hom.ext' {a b : Obj} {f g : Hom a b} (h : f.w = g.w) : f = g := by
  cases f; cases g; simp_all

instance : Category Obj where
  Hom := Hom
  id _ := ⟨rfl, 0⟩
  comp f g := ⟨f.len.trans g.len, f.w + g.w⟩
  id_comp _ := by ext; simp
  comp_id _ := by ext; simp
  assoc _ _ _ := by ext; simp [add_assoc]

/-- Extensionality in the `⟶` form, so `ext` fires on categorical goals. -/
@[ext]
theorem homExt {a b : Obj} {f g : a ⟶ b} (h : (f : Hom a b).w = (g : Hom a b).w) : f = g :=
  Hom.ext' h

@[simp] theorem id_w (a : Obj) : (𝟙 a : Hom a a).w = 0 := rfl
@[simp] theorem comp_w {a b c : Obj} (f : a ⟶ b) (g : b ⟶ c) :
    ((f ≫ g : a ⟶ c) : Hom a c).w = (f : Hom a b).w + (g : Hom b c).w := rfl

instance : MonoidalCategoryStruct Obj where
  tensorObj a b := ⟨a.n + b.n⟩
  whiskerLeft a _ _ f := ⟨congrArg (fun k : Obj => Obj.mk (a.n + k.n)) f.len, f.w⟩
  whiskerRight f c := ⟨congrArg (fun k : Obj => Obj.mk (k.n + c.n)) f.len, f.w⟩
  tensorHom f g := ⟨by rw [f.len, g.len], f.w + g.w⟩
  tensorUnit := ⟨0⟩
  associator a b c :=
    { hom := ⟨by simp [Nat.add_assoc], 0⟩
      inv := ⟨by simp [Nat.add_assoc], 0⟩
      hom_inv_id := by ext; simp
      inv_hom_id := by ext; simp }
  leftUnitor a :=
    { hom := ⟨by simp, 0⟩, inv := ⟨by simp, 0⟩
      hom_inv_id := by ext; simp
      inv_hom_id := by ext; simp }
  rightUnitor a :=
    { hom := ⟨by simp, 0⟩, inv := ⟨by simp, 0⟩
      hom_inv_id := by ext; simp
      inv_hom_id := by ext; simp }

@[simp] theorem tensorObj_n (a b : Obj) : (a ⊗ b).n = a.n + b.n := rfl
@[simp] theorem whiskerLeft_w (a : Obj) {b c : Obj} (f : b ⟶ c) :
    ((a ◁ f : a ⊗ b ⟶ a ⊗ c) : Hom _ _).w = (f : Hom b c).w := rfl
@[simp] theorem whiskerRight_w {a b : Obj} (f : a ⟶ b) (c : Obj) :
    ((f ▷ c : a ⊗ c ⟶ b ⊗ c) : Hom _ _).w = (f : Hom a b).w := rfl
@[simp] theorem tensorHom_w {a a' b b' : Obj} (f : a ⟶ a') (g : b ⟶ b') :
    ((f ⊗ₘ g : a ⊗ b ⟶ a' ⊗ b') : Hom _ _).w = (f : Hom a a').w + (g : Hom b b').w := rfl
@[simp] theorem associator_hom_w (a b c : Obj) : ((α_ a b c).hom : Hom _ _).w = 0 := rfl
@[simp] theorem associator_inv_w (a b c : Obj) : ((α_ a b c).inv : Hom _ _).w = 0 := rfl
@[simp] theorem leftUnitor_hom_w (a : Obj) : ((λ_ a).hom : Hom _ _).w = 0 := rfl
@[simp] theorem leftUnitor_inv_w (a : Obj) : ((λ_ a).inv : Hom _ _).w = 0 := rfl
@[simp] theorem rightUnitor_hom_w (a : Obj) : ((ρ_ a).hom : Hom _ _).w = 0 := rfl
@[simp] theorem rightUnitor_inv_w (a : Obj) : ((ρ_ a).inv : Hom _ _).w = 0 := rfl

instance : MonoidalCategory Obj where
  tensorHom_def _ _ := by ext; simp
  id_tensorHom_id _ _ := by ext; simp
  tensorHom_comp_tensorHom _ _ _ _ := by ext; simp; ring
  whiskerLeft_id _ _ := by ext; simp
  id_whiskerRight _ _ := by ext; simp
  associator_naturality _ _ _ := by ext; simp [add_assoc]
  leftUnitor_naturality _ := by ext; exact (add_zero _).trans (zero_add _).symm
  rightUnitor_naturality _ := by ext; exact (add_zero _).trans (zero_add _).symm
  pentagon _ _ _ _ := by ext; simp
  triangle _ _ := by ext; simp

/-- The braiding: framing `m·n`, the crossing count of a block transposition. -/
def braid (a b : Obj) : (a ⊗ b) ≅ (b ⊗ a) :=
  { hom := ⟨congrArg Obj.mk (Nat.add_comm a.n b.n), (a.n : ℤ) * (b.n : ℤ)⟩
    inv := ⟨congrArg Obj.mk (Nat.add_comm b.n a.n), -((a.n : ℤ) * (b.n : ℤ))⟩
    hom_inv_id := by ext; simp
    inv_hom_id := by ext; simp }

@[simp] theorem braid_hom_w (a b : Obj) :
    ((braid a b).hom : Hom _ _).w = (a.n : ℤ) * (b.n : ℤ) := rfl
@[simp] theorem braid_inv_w (a b : Obj) :
    ((braid a b).inv : Hom _ _).w = -((a.n : ℤ) * (b.n : ℤ)) := rfl

instance : BraidedCategory Obj where
  braiding := braid
  braiding_naturality_right := by
    intro a _ _ f; obtain ⟨rfl, fw⟩ := f; ext; simp [add_comm]
  braiding_naturality_left := by
    intro _ _ f a; obtain ⟨rfl, fw⟩ := f; ext; simp [add_comm]
  hexagon_forward _ _ _ := by ext; simp; ring
  hexagon_reverse _ _ _ := by ext; simp; ring

@[simp] theorem braiding_hom_w (a b : Obj) :
    ((β_ a b).hom : Hom _ _).w = (a.n : ℤ) * (b.n : ℤ) := rfl

/-- The double braiding has framing `2mn` — the two crossings of a full turn. -/
@[simp] theorem dbl_w (a b : Obj) :
    (dbl a b : Hom (a ⊗ b) (a ⊗ b)).w = 2 * ((a.n : ℤ) * (b.n : ℤ)) := by
  simp [dbl]; ring

/-- **The category is NOT symmetric.**  `D_{1,1}` has framing `2 ≠ 0`. -/
theorem dbl_one_one_ne_id : dbl (⟨1⟩ : Obj) ⟨1⟩ ≠ 𝟙 (Obj.mk 1 ⊗ Obj.mk 1) := by
  intro h
  have := congrArg Hom.w h
  simp at this

/-- **The witness.**  `θ_n = n(n−1)` — the writhe of the Garside full twist `Δₙ²`. -/
def framedTwist : PreTwist Obj where
  θ a := ⟨rfl, (a.n : ℤ) * ((a.n : ℤ) - 1)⟩
  tensor a b := by ext; simp; ring
  unit := by ext; simp

/-- `θ` at the generating object is the identity — forced in `⟨V⟩` because `B₁` is trivial,
    and reproduced here. -/
theorem framedTwist_gen : framedTwist.θ ⟨1⟩ = 𝟙 (Obj.mk 1) := by
  ext; simp [framedTwist]

/-- **…and `θ` at `V ⊗ V` is NOT the identity.**  So the balanced structure this file reasons
    about is inhabited by a genuinely non-degenerate model: `θ_V = id` while `θ_{V⊗V} ≠ id`,
    exactly the configuration two prior reviews believed impossible. -/
theorem framedTwist_two_ne_id :
    framedTwist.θ (Obj.mk 1 ⊗ Obj.mk 1) ≠ 𝟙 (Obj.mk 1 ⊗ Obj.mk 1) := by
  intro h
  have := congrArg Hom.w h
  simp [framedTwist] at this

/-- And it agrees with the double braiding there, as `twist_tensor_of_id` demands. -/
theorem framedTwist_two_eq_dbl :
    framedTwist.θ (Obj.mk 1 ⊗ Obj.mk 1) = dbl (⟨1⟩ : Obj) ⟨1⟩ := by
  ext; simp [framedTwist]

end Framed

/-! ## Part 3 — the four planted mutants, re-run against THIS file's criterion.

The existing check rejects the four mutants by the twist's VALUE
(`MenoBalancedTwist.mutant_*`).  This file adds a criterion — CENTRALITY — so the mutants are
re-run against it, and the result is honestly mixed: centrality rejects two of the four by
itself, and is blind to the other two.  Saying which is which is the point; a criterion that
"rejected" all four would be the suspicious outcome.

| mutant | rejected by centrality? |
|---|---|
| `θ = Δ` (half twist) | **yes** — `mutant_half_twist_not_central` |
| block swap `c_{1,2}` alone | **yes** — `mutant_block_swap_not_central` |
| `θ = id` | no (id is central) — rejected by VALUE: `preTwist_id_forces_symmetry` |
| `θ = Δ⁴` | no (`Δ⁴` is central) — rejected by VALUE: `mutant_delta_fourth_ne_full_twist` |
-/

/-- `Δ₃ = σ₁σ₂σ₁`, the half twist. -/
def d3W : List ℤ := [1, 2, 1]

/-- **Mutant 2 — `θ = Δ`: REJECTED by centrality.**  The half twist does not commute with
    `σ₁` (`Δ σ₁ Δ⁻¹ = σ₂`), so it cannot be a natural family. -/
theorem mutant_half_twist_not_central :
    actWord [1] (actWord d3W [(1 : G3), DihedralGroup.r 1, DihedralGroup.sr 0])
      ≠ actWord d3W (actWord [1] [(1 : G3), DihedralGroup.r 1, DihedralGroup.sr 0]) := by
  decide

/-- **Mutant 3 — a single braiding `c_{1,2}` where the axiom wants `c_{2,1}·c_{1,2}`:
    REJECTED by centrality.**  The block swap is not central either. -/
theorem mutant_block_swap_not_central :
    actWord [1] (actWord [1, 2] [(1 : G3), DihedralGroup.r 1, DihedralGroup.sr 0])
      ≠ actWord [1, 2] (actWord [1] [(1 : G3), DihedralGroup.r 1, DihedralGroup.sr 0]) := by
  decide

/-- **Mutant 4 — `θ = Δ⁴`: NOT rejected by centrality** (`Δ⁴` is central), so it is recorded
    here as rejected by VALUE: `Δ⁴ ≠ Δ²` as operators, and uniqueness
    (`MenoBalancedTwist.twist_eq_on_Vpow`) leaves only one candidate. -/
theorem mutant_delta_fourth_ne_full_twist :
    actWord (d3sqW ++ d3sqW) [(1 : G3), DihedralGroup.r 1, DihedralGroup.sr 0]
      ≠ actWord d3sqW [(1 : G3), DihedralGroup.r 1, DihedralGroup.sr 0] := by
  decide

/-- **`Δ₃²` IS central in the action** — the positive control the four rejections are read
    against.  Checked on all `216` triples.  Epistemic direction, as in `MenoBalancedTwist`:
    a `=` result in a non-faithful representation is EVIDENCE, not proof — the proof for all
    `n` is `PreTwist.natural_of_mem`.  A `≠` result (every mutant above) IS a proof. -/
theorem fullTwist_central_dihedral3 :
    ∀ x y z : G3, actWord [1] (actWord d3sqW [x, y, z])
      = actWord d3sqW (actWord [1] [x, y, z]) := by
  decide

end Zeta.MenoTwistCentrality
