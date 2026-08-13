/-
# ZSet copy Δ is a cocommutative counital comonoid — the Lean half of the two-tool proof
  (081KYXE4W8808QG0R0011X8S70: "Lean: ZSet copy (Δ,ε) is a cocommutative counital comonoid
   via Mathlib `RingTheory.Coalgebra`").

A Z-set over key type `K` is a finitely-supported weight function `K →₀ ℤ` — which is
precisely the underlying module of the monoid algebra `ℤ[K]`, and Mathlib's
`Finsupp.instCoalgebra` equips it with EXACTLY the comonoid the F# side ships
(`src/Core/WSet.fs`):

* comultiplication  Δ(single k w) = single k 1 ⊗ single k w   — the DIAGONAL
  (the basis element copies; the weight rides one leg — `WSet.copy`'s
  `k ↦ (k,k)` with weight preserved, read through the iso
  `(K →₀ ℤ) ⊗ (K →₀ ℤ) ⊇ diag ≅ (K×K →₀ ℤ)`);
* counit            ε(single k w) = w                          — the total-weight
  covector (`WSet.discard`, the all-ones functional);
* the comonoid laws — coassociativity + left/right counitality — are the FIELDS of
  the `Coalgebra ℤ (K →₀ ℤ)` instance (holding definitionally, not re-proved here),
  and cocommutativity is the `IsCocomm` instance.

Division of labour with the FsCheck pack (`tests/Tests.FSharp/Formal/
WSet.Comonoid.Laws.Tests.fs`): Lean pins the ABSTRACT structure on the honest
finite-support model (this file — the laws hold, they are not a hope); FsCheck
exercises the EXECUTABLE F# implementation, including what Lean does not state here:
the naturality DISCRIMINATOR (deterministic `arr` is a comonoid hom; branching maps
are not — Fritz's axis, the corner-defining fact) and the ℝ≥0/ℂ/Bool corner
witnesses. Mathlib has no Markov/CD-category framework, so the "one GDL circuit /
N semirings" unifier stays a documented conjecture (Fritz 2020; Cho–Jacobs 2019;
Fox 1976; Aji–McEliece 2000) — deliberately NOT axiomatized here.

House rule: no `sorry`, nothing axiomatized; every claim below is closed.
-/
import Mathlib.RingTheory.Coalgebra.Basic

open Coalgebra TensorProduct

namespace Zeta.ZSetCopyComonoid

variable {K : Type*}

/-- A Z-set: a finitely-supported ℤ-weight function on the key type. -/
abbrev ZSet (K : Type*) : Type _ := K →₀ ℤ

/-- **The comonoid exists**: the coalgebra structure on `ZSet K` — comultiplication,
counit, coassociativity, and both counit laws — supplied by Mathlib's
`Finsupp.instCoalgebra` over the base coalgebra `ℤ` (every commutative ring is a
coalgebra over itself with `Δ r = 1 ⊗ r`). -/
noncomputable example : Coalgebra ℤ (ZSet K) := inferInstance

/-- **The comonoid is cocommutative**: `swap ∘ Δ = Δ` — the `IsCocomm` instance,
inherited from cocommutativity of the base `ℤ`. (The F# mirror:
`WSet copy Δ is cocommutative` in the FsCheck pack.) -/
example : IsCocomm ℤ (ZSet K) := inferInstance

/-- **Δ is the diagonal** on basis elements: `Δ(single k w) = single k 1 ⊗ single k w`.
The key copies; the weight rides one tensor leg (cocommutativity makes the choice of
leg immaterial). This is `WSet.copy`'s `(k, w) ↦ ((k, k), w)` stated against the
tensor product. -/
theorem comul_single (k : K) (w : ℤ) :
    comul (R := ℤ) (Finsupp.single k w) =
      Finsupp.single k (1 : ℤ) ⊗ₜ[ℤ] Finsupp.single k w := by
  simp [Finsupp.comul_single, CommSemiring.comul_apply]

/-- **ε is the weight** on basis elements: `ε(single k w) = w` — the counit reads the
weight off a single row. -/
theorem counit_single (k : K) (w : ℤ) :
    counit (R := ℤ) (Finsupp.single k w) = w := by
  simp [Finsupp.counit_single, CommSemiring.counit_apply]

/-- **ε is the TOTAL weight** on arbitrary Z-sets: `ε(s) = Σ_k s(k)` — exactly
`WSet.discard` (the all-ones covector). Extends `counit_single` to the whole module
by linearity. -/
theorem counit_eq_total (s : ZSet K) :
    counit (R := ℤ) s = s.sum fun _ w => w := by
  induction s using Finsupp.induction_linear with
  | zero => simp
  | add f g hf hg =>
      rw [map_add, hf, hg, Finsupp.sum_add_index' (fun _ => rfl) (fun _ _ _ => rfl)]
  | single k w => simp

end Zeta.ZSetCopyComonoid
