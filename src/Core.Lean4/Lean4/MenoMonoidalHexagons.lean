/-
  `MenoMonoidalHexagons` — the associator, the unitors, the two hexagons, and the
  degree argument that makes copy/discard UNREPRESENTABLE in `⟨V⟩`.

  This closes the scope note at the head of `MenoBraidedRMatrix.lean`:

      "We certify the R-matrix axioms ABSTRACTLY … we do NOT port the ZSet monoidal
       category into Lean."

  and the item `src/Core/MenoBraided.fs` calls **the sleeper prerequisite** — "the
  associator α + unitors (ZSet tuples are non-strict, so the two hexagons can't even be
  *stated* without α)".

  ## What was actually missing (read this before trusting the framing)

  Three corrections to the deferral note, all checkable on `origin/main`:

  1. `Meno.associator` / `associatorInv` / `leftUnitor` / `rightUnitor` **already exist**
     (`src/Core/Meno.fs:92–104`), with pentagon + triangle exercised by `MENO-8` / `MENO-9`.
     The `MenoBraided.fs` "NOT here yet" paragraph is **stale**; α is not missing.
  2. The Lean4 R-matrix certificate it also lists as deferred **is on main**
     (`MenoBraidedRMatrix.lean`).
  3. What is genuinely absent, in F# **and** in Lean, is **the two hexagons themselves**.
     Nothing in the tree states them. So the sleeper is real, but it is the hexagons —
     not their prerequisite.

  ## Is α a formality? (the Mac Lane trap, answered)

  Tempting reading: Mac Lane coherence says "every diagram commutes", so strictify α away.
  That reading is wrong here for two independent reasons, and both are load-bearing:

  * **Coherence presupposes α.** Mac Lane 1963 / 1971 (*Categories for the Working
    Mathematician*, VII.2) is a theorem *about* monoidal categories — it applies only once
    (α, λ, ρ) satisfying pentagon and triangle have been **exhibited**. It cannot be used to
    avoid exhibiting them. What it then buys is that no *further* coherence obligation
    arises.
  * **Braided coherence is strictly weaker than monoidal coherence.** Joyal–Street 1993
    (*Braided tensor categories*, Adv. Math. 102) prove that in the free braided monoidal
    category two formal maps are equal **iff their underlying braids are equal** — NOT that
    every diagram commutes. In a braided (non-symmetric) setting "every diagram commutes"
    is *false*; σ² ≠ id is exactly a diagram that does not commute. So coherence does not
    trivialise anything here.

  What *is* true, and is the useful half: strictification is available (Joyal–Street:
  every braided monoidal category is braided-equivalent to one with strict associativity
  and units), and the shipped `⟨V⟩` already lives in the strict model — `Hom.toArrow` has
  type `Meno.Arrow<V list, V list>`, and list concatenation is strictly associative with a
  strict unit. **In the list model α, λ, ρ are identities and the hexagons are statable with
  no associator at all.** In the *tuple* model (`braidR : Meno.Arrow<V*V, V*V>`) they are
  not: `c_{X,Y⊗Z}` and `(1_Y ⊗ c_{X,Z}) ∘ (c_{X,Y} ⊗ 1_Z)` have different *types* without α.
  That typing fact is the correct and precise version of "can't even be stated without α".

  Both models are therefore carried below, and the hexagons are proved in each.

  ## Honest register

  Every theorem here is machine-checked, `sorry`-free. What that does and does not cover:

  * **Metered** (has a falsifier that fires): the two hexagons, against the negative
    controls of Part 5 — a rack that satisfies Yang–Baxter and still fails hexagon 2.
  * **Unmetered**: the correspondence between this Lean model and the F# code. `interp`
    below is a hand-transcription of `MenoBraided.crossingOnList`; nothing mechanically
    checks that they agree. That is the residual gap, and it is named, not papered over.

  Anchors (checked, not merely cited — see the per-theorem docstrings): Mac Lane 1963/1971
  (pentagon/triangle, coherence); Joyal–Street 1993 (braided monoidal, the two hexagons,
  braided coherence); Kassel *Quantum Groups* XIII.1 (hexagon axioms); Joyce 1982 /
  Fenn–Rourke 1992 (racks); Fox 1976 (cartesian ⟺ natural comonoid); Artin 1925.

  Work-items: 081KYWEM90908QG0R002NHEMZE (the braiding), 081KZZVC6SE087G0R001SXE8BV
  (the copy/discard guard — F# rung 1 merged as PR #10617; this file is its Lean half).
-/
import Lean4.MenoBraidedRMatrix
import Mathlib.Algebra.BigOperators.Group.List.Basic

namespace Zeta.MenoMonoidal

open Zeta.MenoBraided

/-! ## Part 1 — the NON-STRICT (tuple) model: α, λ, ρ, pentagon, triangle.

`Meno.tensor` produces `Arrow<'a * 'c, 'b * 'd>`, so `(A ⊗ B) ⊗ C` and `A ⊗ (B ⊗ C)` are
genuinely different types. The maps below are the Lean images of `Meno.associator`,
`Meno.associatorInv`, `Meno.leftUnitor`, `Meno.rightUnitor` (`src/Core/Meno.fs:92–104`). -/

/-- Associator `α : (A ⊗ B) ⊗ C → A ⊗ (B ⊗ C)` — the Lean image of F# `Meno.associator`. -/
def assoc (A B C : Type*) : (A × B) × C → A × (B × C) := fun p => (p.1.1, (p.1.2, p.2))

/-- Inverse associator `α⁻¹ : A ⊗ (B ⊗ C) → (A ⊗ B) ⊗ C` (F# `Meno.associatorInv`). -/
def assocInv (A B C : Type*) : A × (B × C) → (A × B) × C := fun p => ((p.1, p.2.1), p.2.2)

/-- Left unitor `λ : I ⊗ A → A` (F# `Meno.leftUnitor`; the unit object is `Unit`). -/
def leftUnitor (A : Type*) : Unit × A → A := fun p => p.2

/-- Right unitor `ρ : A ⊗ I → A` (F# `Meno.rightUnitor`). -/
def rightUnitor (A : Type*) : A × Unit → A := fun p => p.1

/-- `α` is invertible: `α⁻¹ ∘ α = id`. -/
theorem assocInv_assoc (A B C : Type*) :
    (assocInv A B C) ∘ (assoc A B C) = id := by
  funext p
  obtain ⟨⟨a, b⟩, c⟩ := p
  rfl

/-- `α` is invertible: `α ∘ α⁻¹ = id`. -/
theorem assoc_assocInv (A B C : Type*) :
    (assoc A B C) ∘ (assocInv A B C) = id := by
  funext p
  obtain ⟨a, b, c⟩ := p
  rfl

/-- **Mac Lane's pentagon.**  The two routes from `((A ⊗ B) ⊗ C) ⊗ D` to `A ⊗ (B ⊗ (C ⊗ D))`
    agree:  `α_{A,B,C⊗D} ∘ α_{A⊗B,C,D} = (1_A ⊗ α_{B,C,D}) ∘ α_{A,B⊗C,D} ∘ (α_{A,B,C} ⊗ 1_D)`.

    Anchor **checked**: Mac Lane 1963 §1 / CWM VII.1 states exactly this five-edge diagram as
    the associativity coherence axiom of a monoidal category.

    HONEST NOTE — this is `rfl`, i.e. the pentagon holds *definitionally* for the tuple
    associator, and that is not a defect but it IS a limit on what the proof is worth: for a
    product-of-types tensor there is (by parametricity) only one map of α's type, so the
    pentagon here cannot fail and therefore cannot discriminate. The discriminating content
    of this file is in Parts 4–5, not here. Compare F# `MENO-8`, which checks the same
    identity at a single point. -/
theorem pentagon (A B C D : Type*) :
    (assoc A B (C × D)) ∘ (assoc (A × B) C D)
      = (Prod.map (@id A) (assoc B C D)) ∘ (assoc A (B × C) D)
          ∘ (Prod.map (assoc A B C) (@id D)) := by
  funext p
  obtain ⟨⟨⟨a, b⟩, c⟩, d⟩ := p
  rfl

/-- **Mac Lane's triangle** — unit coherence: `(1_A ⊗ λ_B) ∘ α_{A,I,B} = ρ_A ⊗ 1_B`.
    Anchor checked: CWM VII.1, the second coherence axiom. Same `rfl` caveat as `pentagon`;
    compare F# `MENO-9`. -/
theorem triangle (A B : Type*) :
    (Prod.map (@id A) (leftUnitor B)) ∘ (assoc A Unit B) = Prod.map (rightUnitor A) (@id B) := by
  funext p
  obtain ⟨⟨a, u⟩, b⟩ := p
  rfl

/-! ## Part 2 — the two hexagons in the NON-STRICT model.

This is the statement the deferral note said could not be made. Making it needs a braiding
on *tensor powers*, not only `c_{V,V} = braidR`: the hexagons are precisely the equations
relating `c_{V,V}` to `c_{V,V⊗V}` and `c_{V⊗V,V}`. Yang–Baxter constrains `c_{V,V}` alone and
says nothing about either — see Part 5, where a rack that satisfies Yang–Baxter fails
hexagon 2. -/

/-- `c_{V, V⊗V}` — one strand crossing a block of two, in the tuple model.
    `(x, (y, z)) ↦ ((x ▷ y, x ▷ z), x)` with `x ▷ y = x·y·x⁻¹`. -/
def cV_VV {G : Type*} [Group G] : G × (G × G) → (G × G) × G :=
  fun p => ((p.1 * p.2.1 * p.1⁻¹, p.1 * p.2.2 * p.1⁻¹), p.1)

/-- `c_{V⊗V, V}` — a block of two crossing one strand.
    `((x, y), z) ↦ ((x·y) ▷ z, (x, y))`: the block acts by the **product** of its entries. -/
def cVV_V {G : Type*} [Group G] : (G × G) × G → G × (G × G) :=
  fun p => ((p.1.1 * p.1.2) * p.2 * (p.1.1 * p.1.2)⁻¹, p.1)

/-- **Hexagon 1** (Joyal–Street 1993 (2.1); Kassel XIII.1.1, first hexagon):

      `α_{Y,Z,X} ∘ c_{X,Y⊗Z} ∘ α_{X,Y,Z}  =  (1_Y ⊗ c_{X,Z}) ∘ α_{Y,X,Z} ∘ (c_{X,Y} ⊗ 1_Z)`

    at `X = Y = Z = V`. Note both sides are maps `(V ⊗ V) ⊗ V → V ⊗ (V ⊗ V)`; **without α
    they would not even have the same type**, which is the precise content of "the hexagons
    can't be stated without α" for the tuple model.

    This one is definitional for the conjugation rack — both routes land on
    `(x ▷ y, (x ▷ z, x))`. Hexagon 2 is where the content is. -/
theorem hexagon1_tuple {G : Type*} [Group G] :
    (assoc G G G) ∘ cV_VV ∘ (assoc G G G)
      = (Prod.map (@id G) (braidR (G := G))) ∘ (assoc G G G)
          ∘ (Prod.map (braidR (G := G)) (@id G)) := by
  funext p
  obtain ⟨⟨x, y⟩, z⟩ := p
  rfl

/-- **Hexagon 2** (Joyal–Street 1993 (2.2); Kassel XIII.1.1, second hexagon):

      `α⁻¹_{Z,X,Y} ∘ c_{X⊗Y,Z} ∘ α⁻¹_{X,Y,Z}  =  (c_{X,Z} ⊗ 1_Y) ∘ α⁻¹_{X,Z,Y} ∘ (1_X ⊗ c_{Y,Z})`

    at `X = Y = Z = V`. Unlike hexagon 1 this is **not** definitional: it reduces exactly to

      `(x·y) ▷ z = x ▷ (y ▷ z)`

    i.e. to conjugation being a genuine (left) **action**. That is the fact hexagon 2 pins
    down, and it is not implied by Yang–Baxter — see `hexagon2_opp_fails`. -/
theorem hexagon2_tuple {G : Type*} [Group G] :
    (assocInv G G G) ∘ cVV_V ∘ (assocInv G G G)
      = (Prod.map (braidR (G := G)) (@id G)) ∘ (assocInv G G G)
          ∘ (Prod.map (@id G) (braidR (G := G))) := by
  funext p
  obtain ⟨x, y, z⟩ := p
  simp only [Function.comp_apply, assocInv, cVV_V, braidR, Prod.map, id_eq, Prod.mk.injEq,
    and_true]
  group

/-! ## Part 3 — the STRICT (list) model, which is the one `⟨V⟩` actually ships.

`MenoBraided.Hom.toArrow : Meno.Arrow<V list, V list>` models `V^⊗n` as a `V list`, so the
tensor of objects is `++`. List append is **strictly** associative with `[]` a strict unit, so
α, λ, ρ are identities and pentagon/triangle are content-free. This is Joyal–Street
strictification realised concretely rather than invoked — and it generalises Part 2 from the
generating triple to all block sizes `(m, n)`. -/

/-- Strict associativity of the object-level tensor: `(l ⊗ m) ⊗ n = l ⊗ (m ⊗ n)` **on the
    nose**. This is why α = `id` in the shipped model. -/
theorem strict_assoc {G : Type*} (l m n : List G) : (l ++ m) ++ n = l ++ (m ++ n) :=
  List.append_assoc l m n

/-- Strict left unit: `I ⊗ l = l`, definitionally. -/
theorem strict_leftUnit {G : Type*} (l : List G) : ([] : List G) ++ l = l := rfl

/-- Strict right unit: `l ⊗ I = l`. -/
theorem strict_rightUnit {G : Type*} (l : List G) : l ++ ([] : List G) = l := List.append_nil l

/-- The conjugation action of one group element on a whole tensor block. -/
def act {G : Type*} [Group G] (w : G) (l : List G) : List G := l.map (fun t => w * t * w⁻¹)

/-- `act` distributes over the tensor of blocks. -/
theorem act_append {G : Type*} [Group G] (w : G) (l m : List G) :
    act w (l ++ m) = act w l ++ act w m := by
  simp [act]

/-- `act` is a genuine (left) **action**: `w ▷ (v ▷ l) = (w·v) ▷ l`.  This single lemma is the
    whole content of hexagon 2. -/
theorem act_act {G : Type*} [Group G] (w v : G) (l : List G) :
    act w (act v l) = act (w * v) l := by
  simp only [act, List.map_map, Function.comp_def]
  refine List.map_congr_left ?_
  intro t _
  group

/-- **The block braiding** `c_{m,n} : V^⊗m ⊗ V^⊗n → V^⊗n ⊗ V^⊗m` in the strict model:
    the first block passes the second, acting on it by the product of its entries.
    `c(xs, ys) = (prod xs ▷ ys) ++ xs`. -/
def cBlock {G : Type*} [Group G] (xs ys : List G) : List G := act xs.prod ys ++ xs

/-- The block braiding **restricts to `braidR`** at `m = n = 1` — so it is a genuine extension
    of the shipped R-matrix, not a different map wearing the same name. -/
theorem cBlock_singleton {G : Type*} [Group G] (x y : G) :
    cBlock [x] [y] = [(braidR (x, y)).1, (braidR (x, y)).2] := by
  simp [cBlock, act, braidR]

/-- **Hexagon 1, strict form, all block sizes.**  `c_{X,Y⊗Z} = (1_Y ⊗ c_{X,Z}) ∘ (c_{X,Y} ⊗ 1_Z)`.

    Reading the equation operationally: the right-hand composite first sends
    `(xs ++ ys) ++ zs ↦ (prod xs ▷ ys) ++ xs ++ zs` (that is `c_{X,Y} ⊗ 1_Z`), then fixes the
    leading `Y`-block and applies `c_{X,Z}` to `xs ++ zs`, giving `cBlock xs zs`. -/
theorem hexagon1_strict {G : Type*} [Group G] (xs ys zs : List G) :
    cBlock xs (ys ++ zs) = act xs.prod ys ++ cBlock xs zs := by
  simp [cBlock, act_append]

/-- **Hexagon 2, strict form, all block sizes.**  `c_{X⊗Y,Z} = (c_{X,Z} ⊗ 1_Y) ∘ (1_X ⊗ c_{Y,Z})`.

    The right-hand composite sends `xs ++ (ys ++ zs) ↦ xs ++ (prod ys ▷ zs) ++ ys`, then
    crosses `xs` past `prod ys ▷ zs`. Equality with the left needs `List.prod_append` and
    `act_act` — the action law again, now at arbitrary block size. -/
theorem hexagon2_strict {G : Type*} [Group G] (xs ys zs : List G) :
    cBlock (xs ++ ys) zs = cBlock xs (act ys.prod zs) ++ ys := by
  simp [cBlock, List.prod_append, act_act, List.append_assoc]

/-! ## Part 4 — copy and discard are UNREPRESENTABLE in `⟨V⟩`, and the reason is a THEOREM.

`PR #10617` made `Δ` and `ε` unrepresentable **syntactically** in F#: `MenoBraided.Hom` is a
private union over braid words, so no function can be lifted into `⟨V⟩`. Its falsifier is a
test over the 85 braid words of length ≤ 3.

This part supplies the **semantic** half, universally quantified over *all* braid words: every
`⟨V⟩` hom is a length-preserving bijection, so

  * `Hom(V^⊗m, V^⊗n) = ∅` whenever `m ≠ n` — copy `V → V⊗V` and discard `V → I` do not merely
    fail to be written, **the hom-sets they would inhabit are empty**;
  * the length-preserving copy `Δ∘ε : [x,y] ↦ [x,x]` is excluded by a second, independent
    argument — it is not injective, and every hom is.

That is the strong form of the guard for this model. The honest limit is stated at the top of
the file: the correspondence between `interp` here and `MenoBraided.crossingOnList` in F# is a
hand transcription, checked by reading, not by a machine. -/

/-- One crossing at the head of a block: `x :: y :: t ↦ (x·y·x⁻¹) :: x :: t`; short blocks pass
    through unchanged (the out-of-range no-op of F# `crossingOnList`). -/
def swapHead {G : Type*} [Group G] : List G → List G
  | x :: y :: t => (x * y * x⁻¹) :: x :: t
  | l => l

/-- Its inverse: `x :: y :: t ↦ y :: (y⁻¹·x·y) :: t` (F# `braidRinv`'s letter). -/
def swapHeadInv {G : Type*} [Group G] : List G → List G
  | x :: y :: t => y :: (y⁻¹ * x * y) :: t
  | l => l

/-- σᵢ acting on a block — shift `i` places, then cross at the head. -/
def crossAt {G : Type*} [Group G] : ℕ → List G → List G
  | 0, l => swapHead l
  | _ + 1, [] => []
  | n + 1, x :: t => x :: crossAt n t

/-- σᵢ⁻¹ acting on a block. -/
def crossAtInv {G : Type*} [Group G] : ℕ → List G → List G
  | 0, l => swapHeadInv l
  | _ + 1, [] => []
  | n + 1, x :: t => x :: crossAtInv n t

/-- The letter interpretation of the sign-carrying 1-based crossing convention `Braid.act`
    uses: `+k` is σ_{k−1}, `−k` is σ_{k−1}⁻¹, `0` is the identity. -/
def letterMap {G : Type*} [Group G] (c : ℤ) : List G → List G :=
  if 0 < c then crossAt (c.toNat - 1) else if c < 0 then crossAtInv ((-c).toNat - 1) else id

/-- Interpretation of a braid word — the Lean image of F# `MenoBraided.Hom.toArrow`. -/
def interp {G : Type*} [Group G] (w : List ℤ) (l : List G) : List G :=
  w.foldl (fun s c => letterMap c s) l

/-- The word inverse — reverse and negate, the Lean image of F# `MenoBraided.Hom.inverse`. -/
def invWord (w : List ℤ) : List ℤ := (w.map (fun c => -c)).reverse

theorem swapHeadInv_swapHead {G : Type*} [Group G] (l : List G) :
    swapHeadInv (swapHead l) = l := by
  match l with
  | [] => rfl
  | [_] => rfl
  | x :: y :: t =>
    simp only [swapHead, swapHeadInv, List.cons.injEq, true_and, and_true]
    group

theorem swapHead_swapHeadInv {G : Type*} [Group G] (l : List G) :
    swapHead (swapHeadInv l) = l := by
  match l with
  | [] => rfl
  | [_] => rfl
  | x :: y :: t =>
    simp only [swapHead, swapHeadInv, List.cons.injEq, and_true]
    group

theorem swapHead_length {G : Type*} [Group G] (l : List G) :
    (swapHead l).length = l.length := by
  match l with
  | [] => rfl
  | [_] => rfl
  | _ :: _ :: _ => rfl

theorem swapHeadInv_length {G : Type*} [Group G] (l : List G) :
    (swapHeadInv l).length = l.length := by
  match l with
  | [] => rfl
  | [_] => rfl
  | _ :: _ :: _ => rfl

theorem crossAtInv_crossAt {G : Type*} [Group G] (n : ℕ) (l : List G) :
    crossAtInv n (crossAt n l) = l := by
  induction n generalizing l with
  | zero => exact swapHeadInv_swapHead l
  | succ n ih =>
    match l with
    | [] => rfl
    | x :: t => simpa [crossAt, crossAtInv] using ih t

theorem crossAt_crossAtInv {G : Type*} [Group G] (n : ℕ) (l : List G) :
    crossAt n (crossAtInv n l) = l := by
  induction n generalizing l with
  | zero => exact swapHead_swapHeadInv l
  | succ n ih =>
    match l with
    | [] => rfl
    | x :: t => simpa [crossAt, crossAtInv] using ih t

theorem crossAt_length {G : Type*} [Group G] (n : ℕ) (l : List G) :
    (crossAt n l).length = l.length := by
  induction n generalizing l with
  | zero => exact swapHead_length l
  | succ n ih =>
    match l with
    | [] => rfl
    | x :: t => simpa [crossAt] using ih t

theorem crossAtInv_length {G : Type*} [Group G] (n : ℕ) (l : List G) :
    (crossAtInv n l).length = l.length := by
  induction n generalizing l with
  | zero => exact swapHeadInv_length l
  | succ n ih =>
    match l with
    | [] => rfl
    | x :: t => simpa [crossAtInv] using ih t

theorem letterMap_length {G : Type*} [Group G] (c : ℤ) (l : List G) :
    (letterMap c l).length = l.length := by
  unfold letterMap
  split
  · exact crossAt_length _ l
  · split
    · exact crossAtInv_length _ l
    · rfl

/-- Every letter has a letter inverse — the fact that makes `Hom.inverse` TOTAL in F#, and
    therefore makes `⟨V⟩` a groupoid rather than merely a category. -/
theorem letterMap_neg_letterMap {G : Type*} [Group G] (c : ℤ) (l : List G) :
    letterMap (-c) (letterMap c l) = l := by
  unfold letterMap
  split_ifs with h1 h2 h3 h4 h5 h6 <;>
    first
      | omega
      | rfl
      | (simpa using crossAt_crossAtInv ((-c).toNat - 1) l)
      | (simpa using crossAtInv_crossAt (c.toNat - 1) l)

/-- **Every `⟨V⟩` hom preserves tensor degree.**  `V^⊗n` is a block of length `n`, so this says
    a braid word can never change the number of strands. -/
theorem interp_length {G : Type*} [Group G] (w : List ℤ) (l : List G) :
    (interp w l).length = l.length := by
  induction w generalizing l with
  | nil => rfl
  | cons c w ih => simpa [interp, letterMap_length c l] using ih (letterMap c l)

theorem interp_append {G : Type*} [Group G] (u v : List ℤ) (l : List G) :
    interp (u ++ v) l = interp v (interp u l) := by
  simp [interp, List.foldl_append]

/-- **Every `⟨V⟩` hom is invertible** — `interp (invWord w)` is a left inverse of `interp w`.
    (F# `Hom.inverse` is `TOTAL` for the same reason: every letter has a letter inverse.) -/
theorem interp_invWord {G : Type*} [Group G] (w : List ℤ) (l : List G) :
    interp (invWord w) (interp w l) = l := by
  induction w generalizing l with
  | nil => rfl
  | cons c w ih =>
    have hsplit : invWord (c :: w) = invWord w ++ [-c] := by
      simp [invWord]
    calc interp (invWord (c :: w)) (interp (c :: w) l)
        = letterMap (-c) (interp (invWord w) (interp w (letterMap c l))) := by
          rw [hsplit, interp_append]
          simp [interp]
      _ = letterMap (-c) (letterMap c l) := by rw [ih]
      _ = l := letterMap_neg_letterMap c l

/-- Hence `interp w` is injective. -/
theorem interp_injective {G : Type*} [Group G] (w : List ℤ) :
    Function.Injective (interp (G := G) w) :=
  Function.LeftInverse.injective (interp_invWord w)

/-! ### The closed form IS the shipped braid word (the second route)

`cBlock` was written as a closed form — "the block acts by the product of its entries" — and
the hexagons of Part 3 are theorems about *it*. That is worth nothing unless `cBlock` is the
same map as the braid word `⟨V⟩` actually ships. These three theorems tie it down at the
generating block sizes, by an independent route: `interp` folds `crossAt`/`crossAtInv` letter
by letter and knows nothing about `List.prod`.

`c_{m,n}` is the positive permutation braid `(σ_m ⋯ σ_{m+n-1})(σ_{m-1} ⋯ σ_{m+n-2}) ⋯ (σ_1 ⋯ σ_n)`
(Garside 1969); at `(1,1)`, `(1,2)`, `(2,1)` that is `σ₁`, `σ₁σ₂`, `σ₂σ₁`. -/

/-- `c_{1,1}` = `σ₁` = `braidR`. -/
theorem cBlock_singleton_eq_interp {G : Type*} [Group G] (x y : G) :
    cBlock [x] [y] = interp [1] [x, y] := by
  simp [cBlock, act, interp, letterMap, crossAt, swapHead]

/-- `c_{1,2}` = `σ₁σ₂`. -/
theorem cBlock_one_two_eq_interp {G : Type*} [Group G] (x y z : G) :
    cBlock [x] [y, z] = interp [1, 2] [x, y, z] := by
  simp [cBlock, act, interp, letterMap, crossAt, swapHead]

/-- `c_{2,1}` = `σ₂σ₁`.  Unlike the two above this is **not** definitional: it is exactly the
    step where "the block acts by the product `x·y`" has to agree with "cross `y` past `z`,
    then cross `x` past the result", i.e. `(x·y) ▷ z = x ▷ (y ▷ z)` again. -/
theorem cBlock_two_one_eq_interp {G : Type*} [Group G] (x y z : G) :
    cBlock [x, y] [z] = interp [2, 1] [x, y, z] := by
  simp [cBlock, act, interp, letterMap, crossAt, swapHead]
  group

/-- Copy `Δ : V → V ⊗ V`, `[x] ↦ [x, x]`. -/
def copyDelta {G : Type*} [Group G] (l : List G) : List G := l ++ l

/-- Discard `ε : V → I`, `[x] ↦ []`. -/
def discardEps {G : Type*} [Group G] (_ : List G) : List G := []

/-- The **length-preserving** copy `Δ ∘ ε : V ⊗ V → V ⊗ V`, `[x, y] ↦ [x, x]`.  Included because
    a guard that only compared tensor degree would wave this one through — it is the control
    that shows degree is not the whole invariant. -/
def copyLengthPreserving {G : Type*} [Group G] : List G → List G
  | x :: _ :: t => x :: x :: t
  | l => l

/-- **`Hom_{⟨V⟩}(V^⊗m, V^⊗n) = ∅` for `m ≠ n`.**  The structural statement: copy and discard
    are not "absent by convention", the hom-sets they would live in do not contain anything. -/
theorem no_hom_between_distinct_degrees {G : Type*} [Group G]
    {m n : ℕ} (h : m ≠ n) (w : List ℤ) (l : List G) (hl : l.length = m) :
    (interp w l).length ≠ n := by
  rw [interp_length, hl]
  exact h

/-- **Copy is unrepresentable.**  No braid word interprets to `Δ`, for every group and every
    word — it would have to send a degree-1 block to a degree-2 block. -/
theorem no_copy {G : Type*} [Group G] (w : List ℤ) :
    interp (G := G) w ≠ copyDelta := by
  intro h
  have := congrArg (fun f => (f [(1 : G)]).length) h
  simp [interp_length, copyDelta] at this

/-- **Discard is unrepresentable**, by the same degree argument in the other direction. -/
theorem no_discard {G : Type*} [Group G] (w : List ℤ) :
    interp (G := G) w ≠ discardEps := by
  intro h
  have := congrArg (fun f => (f [(1 : G)]).length) h
  simp [interp_length, discardEps] at this

/-- **The length-preserving copy is unrepresentable too** — and for a *different* reason: it is
    not injective, while every `⟨V⟩` hom is. Needs `Nontrivial G`, which `V = ℤ[Fₙ]` satisfies;
    over the trivial group `Δ∘ε` really is the identity and there is nothing to exclude. -/
theorem no_copy_lengthPreserving {G : Type*} [Group G] [Nontrivial G] (w : List ℤ) :
    interp (G := G) w ≠ copyLengthPreserving := by
  intro h
  obtain ⟨x, hx⟩ := exists_ne (1 : G)
  have hinj : Function.Injective (copyLengthPreserving (G := G)) := by
    rw [← h]; exact interp_injective w
  have : ([(1 : G), x] : List G) = [(1 : G), 1] := by
    refine hinj ?_
    show (1 : G) :: (1 : G) :: ([] : List G) = (1 : G) :: (1 : G) :: ([] : List G)
    rfl
  simp at this
  exact hx this

/-! ## Part 5 — negative controls: the hexagons DISCRIMINATE, and they are INDEPENDENT.

A coherence theorem nobody can fail is not a check. Three controls, all machine-checked:

  * the **opposite conjugation rack** `x ▷' y = x⁻¹·y·x` satisfies Yang–Baxter (it is a rack —
    Joyce 1982) and satisfies **hexagon 1**, yet **fails hexagon 2**. So (a) hexagon 2 carries
    information Yang–Baxter does not, and (b) hexagon 1 alone is not the check;
  * the plain **swap** satisfies BOTH hexagons — as it must, being the symmetry. So the
    hexagons do not detect braided-vs-symmetric either; that is `braidR_not_symmetric_perm3`'s
    job, in `MenoBraidedRMatrix.lean`.

Read together: **Yang–Baxter, the two hexagons, and σ² ≠ id are four independent obligations**,
and no one of them implies another. That is the reason the associator work was not a formality
— but it is also the reason the *pentagon* here is nearly content-free while the *hexagons*
are not. -/

/-- The opposite conjugation rack `x ▷' y = x⁻¹·y·x`. -/
def actOpp {G : Type*} [Group G] (w : G) (l : List G) : List G := l.map (fun t => w⁻¹ * t * w)

/-- Its block braiding, built by the same closed form as `cBlock`. -/
def cBlockOpp {G : Type*} [Group G] (xs ys : List G) : List G := actOpp xs.prod ys ++ xs

/-- The opposite rack's R-matrix, `R'(x, y) = (x⁻¹·y·x, x)`. -/
def braidROpp {G : Type*} [Group G] : G × G → G × G := fun p => (p.1⁻¹ * p.2 * p.1, p.1)

/-- `R'` at tensor positions 1-2 of `V ⊗ V ⊗ V`. -/
def oppR12 {G : Type*} [Group G] : G × G × G → G × G × G :=
  fun p => (p.1⁻¹ * p.2.1 * p.1, p.1, p.2.2)

/-- `R'` at tensor positions 2-3. -/
def oppR23 {G : Type*} [Group G] : G × G × G → G × G × G :=
  fun p => (p.1, p.2.1⁻¹ * p.2.2 * p.2.1, p.2.1)

/-- **The control is a real braiding.**  `R'` satisfies the Yang–Baxter / braid relation, so it
    is not a strawman: it is exactly as much a set-theoretic YB solution as `braidR` is. -/
theorem oppR_yangBaxter {G : Type*} [Group G] (x y z : G) :
    oppR12 (oppR23 (oppR12 (x, y, z))) = oppR23 (oppR12 (oppR23 (x, y, z))) := by
  simp only [oppR12, oppR23, Prod.mk.injEq, and_true]
  group

/-- **…and it satisfies hexagon 1.**  So hexagon 1 does not discriminate between the two racks;
    it is hexagon 2 that does. -/
theorem hexagon1_opp {G : Type*} [Group G] (xs ys zs : List G) :
    cBlockOpp xs (ys ++ zs) = actOpp xs.prod ys ++ cBlockOpp xs zs := by
  simp [cBlockOpp, actOpp]

/-- **…and it FAILS hexagon 2.**  Concrete witness in `S₃`, evaluated exhaustively by `decide`:
    with `xs = [(0 1)]`, `ys = [(1 2)]`, `zs = [(0 1)]` the two sides differ, because
    `(x·y)⁻¹ z (x·y) ≠ x⁻¹ (y⁻¹ z y) x` in a non-abelian group — conjugation-by-inverse is an
    ANTI-action, and hexagon 2 is exactly the statement that the block acts by the product.

    This is the falsifier that makes `hexagon2_strict` metered rather than decorative. -/
theorem hexagon2_opp_fails :
    cBlockOpp ([Equiv.swap (0 : Fin 3) 1] ++ [Equiv.swap (1 : Fin 3) 2]) [Equiv.swap (0 : Fin 3) 1]
      ≠ cBlockOpp [Equiv.swap (0 : Fin 3) 1]
          (actOpp (([Equiv.swap (1 : Fin 3) 2]).prod) [Equiv.swap (0 : Fin 3) 1])
        ++ [Equiv.swap (1 : Fin 3) 2] := by
  decide

/-- The symmetry (plain block swap) — the OTHER control. -/
def cSwap {G : Type*} (xs ys : List G) : List G := ys ++ xs

/-- The swap satisfies hexagon 1… -/
theorem hexagon1_swap {G : Type*} (xs ys zs : List G) :
    cSwap xs (ys ++ zs) = ys ++ cSwap xs zs := by
  simp [cSwap]

/-- …and hexagon 2. **So the hexagons are false-green for a symmetric category** — passing them
    is not evidence of *braided*. `braidR_not_symmetric_perm3` is what earns that, and this
    theorem is the reason it cannot be dropped. Same shape as the P4/P5c trap recorded in
    work-item 081KYWEM90908QG0R002NHEMZE. -/
theorem hexagon2_swap {G : Type*} (xs ys zs : List G) :
    cSwap (xs ++ ys) zs = cSwap xs zs ++ ys := by
  simp [cSwap]

end Zeta.MenoMonoidal
