/-
  CayleyDicksonDoublyEven.lean — Lean 4 proof oracle: T2 of Face-3.

  Proves the INDUCTIVE STEP of the math-team handoff target T2
  (docs/handoffs/2026-06-20-alexa-to-math-team-phase-d-gen-gen-research-discharge.md):

      Cayley-Dickson doubling preserves the doubly-even self-dual invariant.

  The base case — the [8,4,4] extended Hamming code, the concrete Adinkra
  generator, **N = 8** (see below) — is ALREADY proven exhaustively in
  `AdinkraCode.fs` / `AdinkraCode.Tests.fs` (isDoublyEven, isSelfDual over all
  16 codewords). The routing doc is explicit: "the concrete N=4 doubly-even
  self-dual case is already proven … that is the BP-16 base case, no new proof;
  the open Lean target is the general inductive invariant (CD doubling preserves
  doubly-even self-duality, induction over Doubled.algebra)." This file
  discharges that inductive step, sorry-free.

  ── N label (corrected 2026-08-15) ────────────────────────────────────────
  The quotation above is kept VERBATIM, but its "N=4" is wrong and is retained
  only because it is someone else's words. That 4 is `k`, the code DIMENSION,
  read as `N`. In the adinkra correspondence (Doran–Faux–Gates–Hübsch–Iga–
  Landweber) N is the code LENGTH, so this base case is **N = 8, k = 4**. A
  doubly-even self-dual code of length 4 does not exist at all (Gleason;
  Mallows–Sloane: length ≡ 0 mod 8), so the N=4 reading names an empty set.
  Nothing in this proof depended on the label: the Lean development below is
  parameterised over `length` and `dim` and never mentions N.

  ── Honest scope (peel) ───────────────────────────────────────────────────
  The doubly-even (weight ≡ 0 mod 4) and self-dual (C = C⊥) properties are
  invariants of the code's ADDITIVE / GF(2) vector structure — weight and the
  bilinear form live on the additive group. Under `Doubled.algebra`
  (`CayleyDickson.fs`), the additive group of the doubled algebra is exactly the
  direct sum A ⊕ A: `(a,b) + (c,d) = (a+c, b+d)`. So the doubling relevant to
  this invariant is the coordinate concatenation A ⊕ A, on which
  `weight(a,b) = weight a + weight b` and `dot((a,b),(c,d)) = dot a c + dot b d`.
  The algebra's MULTIPLICATION and CONJUGATION do not enter the weight/duality
  invariant and are therefore (correctly) absent from this proof. What is proved
  here is precisely: the direct-sum doubling that `Doubled.algebra` induces on
  the additive group preserves doubly-evenness and self-orthogonality, and
  doubles both length and dimension (so the rate-½ self-dual condition is
  preserved). The "reflection-grade ↔ CD-doubling-axis" functor (open §B / the
  Bridge target) is NOT claimed here — it remains the separate research target.

  No imports (no Mathlib): pure Lean core + `omega`.
-/

namespace Zeta.CayleyDickson

-- ═══ Definitions ══════════════════════════════════════════════════════════

/-- A binary linear code, abstracted by the data the doubly-even self-dual
    invariant actually depends on: a Hamming `weight`, a GF(2) `dot` form, and
    the two integer parameters `length` (n) and `dim` (k). We work with the
    invariant pointwise over elements, which is all the induction needs. -/
structure BinaryCode (A : Type) where
  /-- Hamming weight of an element (number of 1-coordinates). -/
  weight : A → Nat
  /-- GF(2) inner product (the bilinear form whose fixed point is self-duality). -/
  dot : A → A → Nat
  /-- Code length n (number of coordinates). -/
  length : Nat
  /-- Code dimension k (number of generator rows / message bits). -/
  dim : Nat
  /-- The GF(2) form is symmetric. -/
  dot_comm : ∀ a b, dot a b = dot b a

/-- Doubly-even: every element's weight is a multiple of 4. -/
def IsDoublyEven {A : Type} (C : BinaryCode A) : Prop :=
  ∀ a : A, C.weight a % 4 = 0

/-- Self-orthogonal: every pair of elements has an even GF(2) dot product
    (`C ⊆ C⊥`). Doubly-even ⇒ even weight ⇒ self-orthogonal on the diagonal;
    the off-diagonal pairs are required too, and stated here for all pairs. -/
def IsSelfOrthogonal {A : Type} (C : BinaryCode A) : Prop :=
  ∀ a b : A, C.dot a b % 2 = 0

/-- Rate-½ (the dimension half of self-duality): `2k = n`. Combined with
    self-orthogonality (`C ⊆ C⊥`) this forces `C = C⊥`, i.e. self-dual. -/
def IsRateHalf {A : Type} (C : BinaryCode A) : Prop :=
  2 * C.dim = C.length

/-- Self-dual = self-orthogonal AND rate-½ (matches `AdinkraCode.isSelfDual`:
    `isSelfOrthogonal && (2 * dimension = length)`). -/
def IsSelfDual {A : Type} (C : BinaryCode A) : Prop :=
  IsSelfOrthogonal C ∧ IsRateHalf C

-- ═══ Cayley-Dickson Doubling (additive / direct-sum structure) ═════════════

/-- The Cayley-Dickson doubled carrier A ⊕ A: pairs `(Real, Imag)`, matching
    `Doubled<'A> = { Real; Imag }` in `CayleyDickson.fs`. -/
structure Doubled (A : Type) where
  real : A
  imag : A

/-- The doubled code. On the additive group `(a,b)+(c,d) = (a+c,b+d)`, so:
    weight concatenates (adds), the GF(2) form adds blockwise, and both the
    length and the dimension double. -/
def doubledCode {A : Type} (C : BinaryCode A) : BinaryCode (Doubled A) where
  weight x := C.weight x.real + C.weight x.imag
  dot x y := C.dot x.real y.real + C.dot x.imag y.imag
  length := 2 * C.length
  dim := 2 * C.dim
  dot_comm x y := by
    change C.dot x.real y.real + C.dot x.imag y.imag
         = C.dot y.real x.real + C.dot y.imag x.imag
    rw [C.dot_comm x.real y.real, C.dot_comm x.imag y.imag]

-- ═══ The Inductive Step (T2) ══════════════════════════════════════════════

/-- T2.1 — CD doubling preserves doubly-evenness.
    `a ≡ 0 (mod 4)` and `b ≡ 0 (mod 4)` ⇒ `a + b ≡ 0 (mod 4)`. -/
theorem doubled_isDoublyEven {A : Type} (C : BinaryCode A)
    (h : IsDoublyEven C) : IsDoublyEven (doubledCode C) := by
  intro x
  change (C.weight x.real + C.weight x.imag) % 4 = 0
  have h1 := h x.real
  have h2 := h x.imag
  omega

/-- T2.2 — CD doubling preserves self-orthogonality.
    `dot ≡ 0 (mod 2)` blockwise ⇒ the block sum `≡ 0 (mod 2)`. -/
theorem doubled_isSelfOrthogonal {A : Type} (C : BinaryCode A)
    (h : IsSelfOrthogonal C) : IsSelfOrthogonal (doubledCode C) := by
  intro x y
  change (C.dot x.real y.real + C.dot x.imag y.imag) % 2 = 0
  have h1 := h x.real y.real
  have h2 := h x.imag y.imag
  omega

/-- T2.3 — CD doubling preserves rate-½ (`2k = n` ⇒ `2(2k) = 2n`). -/
theorem doubled_isRateHalf {A : Type} (C : BinaryCode A)
    (h : IsRateHalf C) : IsRateHalf (doubledCode C) := by
  have hC : 2 * C.dim = C.length := h
  show 2 * (2 * C.dim) = 2 * C.length
  omega

/-- **T2 (combined inductive step)** — CD doubling preserves the full
    doubly-even self-dual invariant. With the N=8 base case (AdinkraCode.Tests,
    exhaustive), induction over the `Doubled.algebra` tower R→C→H→O→𝕊→…
    propagates doubly-even self-duality to every level: this is the inductive
    step the math-team handoff (T2) asked for, discharged sorry-free. -/
theorem doubled_preserves_doubly_even_self_dual {A : Type} (C : BinaryCode A)
    (hDE : IsDoublyEven C) (hSD : IsSelfDual C) :
    IsDoublyEven (doubledCode C) ∧ IsSelfDual (doubledCode C) := by
  refine ⟨doubled_isDoublyEven C hDE, ?_, ?_⟩
  · exact doubled_isSelfOrthogonal C hSD.1
  · exact doubled_isRateHalf C hSD.2

end Zeta.CayleyDickson
