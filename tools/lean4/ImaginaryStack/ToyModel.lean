/-
  Imaginary Stack — Toy Model for Lemma 1 (bulk-from-boundary reconstruction)

  Finite, computable toy version of the Remember-When + Pay-Attention →
  HaPPY-like QECC claim: the "Adinkra-as-generator" / bulk-from-boundary
  property, that a full codeword (the *bulk*) is recoverable by a single
  LINEAR reconstruction map from a partial *boundary* observation, exactly
  when the hidden coordinates lie in the code subspace.

  Status (2026-06-05): the `sorry` placeholders are DISCHARGED. The earlier
  revision stated the lemma with `sorry` even in *type* position (the claim was
  not yet well-posed). This revision states and PROVES the honest core:

    * the 16-coordinate space is split 16 = 12 (boundary) ⊕ 4 (bulk);
    * the code subspace is the GRAPH of a fixed linear generator
      `G : boundary → bulk` (the "multiplication-table-determined code");
    * `reconstruct G = id.prod G` is a genuine LINEAR map, and it recovers
      every codeword exactly from its 12 boundary coordinates.

  This is the provable skeleton of HaPPY bulk-from-boundary for a graph code.
  Honest scope (the part that remains open, named not hidden):
    * the *erasure distance* — recovery from an ARBITRARY 12-of-16 erasure
      pattern (not just the fixed boundary positions) — depends on the concrete
      generator matrix structure (the real Adinkra), and is NOT proven here;
    * which specific `G` the imaginary-stack multiplication table induces, and
      the lift to the continuous / infinite-dimensional case.
  See docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md §B (Adinkra-as-generator row).
-/

import Mathlib.LinearAlgebra.Prod
import Mathlib.Data.ZMod.Basic

/-! Exact arithmetic over a finite field; `ZMod 17` is a field (17 prime). -/
abbrev F := ZMod 17

/-- The boundary: 12 known coordinates. -/
abbrev Boundary := Fin 12 → F

/-- The bulk: 4 hidden coordinates. -/
abbrev Bulk := Fin 4 → F

/-- A 16-coordinate vector, split as `(boundary, bulk)`.  16 = 12 + 4, so this
    `Boundary × Bulk` is a faithful model of the 16-dimensional real cube. -/
abbrev Vec16 := Boundary × Bulk

/-- **Boundary projection** — read the 12 known coordinates (`HaPPY` boundary).
    A genuine linear map. -/
def proj : Vec16 →ₗ[F] Boundary := LinearMap.fst F Boundary Bulk

/-- **Reconstruction map** for a fixed linear generator `G`. Places the observed
    boundary in the 12 known slots and the generated bulk `G b` in the 4 hidden
    slots. `id.prod G` is linear by construction — the "Adinkra as generator". -/
def reconstruct (G : Boundary →ₗ[F] Bulk) : Boundary →ₗ[F] Vec16 :=
  (LinearMap.id).prod G

/-- **The code subspace** — the graph of `G`: codewords are exactly the vectors
    whose bulk is the generated `G boundary`. A `Submodule` (linear code). -/
def Code (G : Boundary →ₗ[F] Bulk) : Submodule F Vec16 :=
  LinearMap.ker (LinearMap.snd F Boundary Bulk - G.comp (LinearMap.fst F Boundary Bulk))

/-- Membership in the code is exactly "bulk = G boundary". -/
theorem mem_Code (G : Boundary →ₗ[F] Bulk) (v : Vec16) :
    v ∈ Code G ↔ v.2 = G v.1 := by
  simp [Code, LinearMap.mem_ker, sub_eq_zero]

/-- The reconstruction preserves the boundary: projecting a reconstructed vector
    returns the original boundary observation (a left section of `proj`). -/
@[simp] theorem proj_reconstruct (G : Boundary →ₗ[F] Bulk) (b : Boundary) :
    proj (reconstruct G b) = b := by
  simp [proj, reconstruct]

/-- **Reconstruction property (toy HaPPY bulk-from-boundary).**
    For any codeword `v` (one whose hidden bulk lies in the code, `v.2 = G v.1`),
    the single linear map `reconstruct G` recovers the FULL 16-vector exactly from
    its 12 boundary coordinates. This is the discharged form of the old `sorry`. -/
theorem reconstruction_property
    (G : Boundary →ₗ[F] Bulk) (v : Vec16) (hv : v.2 = G v.1) :
    reconstruct G (proj v) = v := by
  have e : reconstruct G (proj v) = (v.1, G v.1) := by
    simp [proj, reconstruct]
  rw [e, ← hv]

/-- The same statement keyed on the `Code` submodule: reconstruction recovers
    every codeword from its boundary. -/
theorem reconstruct_proj_of_mem
    (G : Boundary →ₗ[F] Bulk) (v : Vec16) (hv : v ∈ Code G) :
    reconstruct G (proj v) = v :=
  reconstruction_property G v ((mem_Code G v).1 hv)

/-- **Lemma 1 (toy).** For every linear generator `G`, there EXISTS a single
    linear reconstruction map recovering every codeword exactly from its 12
    boundary coordinates. (The witness is `reconstruct G`.) -/
theorem lemma1_toy (G : Boundary →ₗ[F] Bulk) :
    ∃ R : Boundary →ₗ[F] Vec16, ∀ v : Vec16, v.2 = G v.1 → R (proj v) = v :=
  ⟨reconstruct G, fun v hv => reconstruction_property G v hv⟩

/-- Sanity: the boundary projection of the code is everything — every boundary
    observation extends to a (unique) codeword. Shows the code is a genuine
    12-dimensional "hologram" of the 16-dimensional bulk. -/
theorem code_covers_boundary (G : Boundary →ₗ[F] Bulk) (b : Boundary) :
    ∃ v : Vec16, v ∈ Code G ∧ proj v = b :=
  ⟨reconstruct G b, by simp [mem_Code, reconstruct], proj_reconstruct G b⟩
