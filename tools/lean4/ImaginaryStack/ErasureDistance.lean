/-
  Imaginary Stack — Erasure distance (the QECC teeth on top of ToyModel)

  ToyModel.lean proved bulk-from-boundary reconstruction for a *fixed* boundary
  (the known 12 coordinates). That is recovery, but not yet error-*correction*:
  it does not tolerate losing arbitrary coordinates. This file proves the part
  that makes the code genuinely error-correcting in the HaPPY sense —

    **a linear code of minimum (Hamming) distance `d` recovers the full codeword
    uniquely from ANY erasure of fewer than `d` coordinates.**

  Specialised to our 16-coordinate cube: a distance-5 code recovers from ANY 12
  of its 16 coordinates (any 4 erased) — the "arbitrary 12-of-16 erasure pattern"
  property, the strengthening named open in the FROZEN-CORE register §B (Adinkra
  row) and in ToyModel's header.

  Honest scope (what this does / does not give):
    * PROVEN here: the erasure-correction *principle* — distance ⇒ correctable —
      and its 16/12/5 specialisation. This is the load-bearing implication that
      upgrades fixed-boundary recovery to arbitrary-erasure correction.
    * NAMED-OPEN (not here): the *construction* of a concrete distance-5 `[16,12]`
      code — a Reed-Solomon / MDS code (which exists over `ZMod 17` since 16 ≤ 17,
      Singleton-optimal d = n-k+1 = 5) and the proof that a specific imaginary-stack
      generator `G` achieves it. That requires Cauchy/Vandermonde determinant
      machinery and is the next rung.

  Anchors: Singleton bound + MDS / Reed-Solomon codes (Singleton 1964; Reed-Solomon
  1960); HaPPY holographic codes (Pastawski-Yoshida-Harlow-Preskill, arXiv:1503.06237);
  Gates et al. Adinkras as the generator structure.
-/

import Mathlib

/-! Exact arithmetic over a finite field; `ZMod 17` (17 prime ⇒ field). -/
abbrev F := ZMod 17

/-- A 16-coordinate word. -/
abbrev Word := Fin 16 → F

/-- The support of a word: the positions where it is nonzero. Its cardinality is
    the Hamming weight; the minimum weight over nonzero codewords is the code's
    minimum distance. -/
def support (c : Word) : Finset (Fin 16) :=
  Finset.univ.filter (fun i => c i ≠ 0)

theorem mem_support {c : Word} {i : Fin 16} : i ∈ support c ↔ c i ≠ 0 := by
  simp [support]

/-- **The erasure-correction principle.** If every nonzero codeword of a linear
    code `C` has Hamming weight ≥ `d` (minimum distance ≥ `d`), then any two
    codewords that agree on all the *non-erased* positions are equal, whenever
    fewer than `d` positions are erased. I.e. the codeword is recovered UNIQUELY
    from any `(16 − e)` surviving coordinates with `e < d` — arbitrary-erasure
    correction. (Uniqueness is correctability: the encoder is known, so a unique
    preimage on the survivors is exactly recovery.) -/
theorem erasure_correctable_of_min_distance
    (C : Submodule F Word) (d : ℕ)
    (hdist : ∀ c ∈ C, c ≠ 0 → d ≤ (support c).card)
    (erased : Finset (Fin 16)) (herase : erased.card < d)
    (c1 c2 : Word) (h1 : c1 ∈ C) (h2 : c2 ∈ C)
    (hagree : ∀ i, i ∉ erased → c1 i = c2 i) :
    c1 = c2 := by
  by_contra hne
  have hsub : c1 - c2 ∈ C := C.sub_mem h1 h2
  have hdne : c1 - c2 ≠ 0 := sub_ne_zero.mpr hne
  -- the difference can only be nonzero on erased positions
  have hss : support (c1 - c2) ⊆ erased := by
    intro i hi
    by_contra hni
    have hz : (c1 - c2) i = 0 := by
      rw [Pi.sub_apply, hagree i hni, sub_self]
    exact (mem_support.mp hi) hz
  have hcard : (support (c1 - c2)).card ≤ erased.card := Finset.card_le_card hss
  have hge : d ≤ (support (c1 - c2)).card := hdist (c1 - c2) hsub hdne
  omega

/-- **Arbitrary 12-of-16 erasure correction** (the headline). A distance-5 code on
    the 16-coordinate cube recovers the full codeword uniquely from ANY 12 surviving
    coordinates — i.e. tolerating any 4 erasures. This is the error-correcting
    strengthening of ToyModel's fixed-boundary `reconstruction_property`. -/
theorem recover_from_any_12_of_16
    (C : Submodule F Word)
    (hdist : ∀ c ∈ C, c ≠ 0 → 5 ≤ (support c).card)
    (erased : Finset (Fin 16)) (herase : erased.card ≤ 4)
    (c1 c2 : Word) (h1 : c1 ∈ C) (h2 : c2 ∈ C)
    (hagree : ∀ i, i ∉ erased → c1 i = c2 i) :
    c1 = c2 :=
  erasure_correctable_of_min_distance C 5 hdist erased (by omega) c1 c2 h1 h2 hagree

/-- The contrapositive lens: a code that fails to correct some `e`-erasure must
    contain a nonzero codeword supported within those `e` positions (weight ≤ `e`).
    Equivalent to the principle above; recorded as the standard distance↔erasure
    statement of coding theory. -/
theorem low_weight_codeword_of_uncorrectable
    (C : Submodule F Word) (erased : Finset (Fin 16))
    (c1 c2 : Word) (h1 : c1 ∈ C) (h2 : c2 ∈ C)
    (hagree : ∀ i, i ∉ erased → c1 i = c2 i) (hne : c1 ≠ c2) :
    ∃ c ∈ C, c ≠ 0 ∧ support c ⊆ erased := by
  refine ⟨c1 - c2, C.sub_mem h1 h2, sub_ne_zero.mpr hne, ?_⟩
  intro i hi
  by_contra hni
  exact (mem_support.mp hi) (by rw [Pi.sub_apply, hagree i hni, sub_self])
