---
id: 081KYXCM1WK08QG0R003B9KVP4
type: task
state: backlog
priority: P2
slug: cl-8-0-versor-construction-of-w-e8-lean-cert-root2-scalar-sa
title: "Cl(8,0) versor construction of W(E8): Lean cert (root2-scalar + sandwich-reflection via Mathlib ι_mul_ι_mul_invOf_ι) + exact-arithmetic FsCheck of Coxeter relations and |W(E8)| on the 240 roots; new CliffordE8Versor module, retire Cl(3,0) as the versor bridge"
created: 2026-08-01T00:47:10.227Z
depends_on: []
composes_with: []
---

# Cl(8,0) versor construction of W(E8): Lean cert (root2-scalar + sandwich-reflection via Mathlib ι_mul_ι_mul_invOf_ι) + exact-arithmetic FsCheck of Coxeter relations and |W(E8)| on the 240 roots; new CliffordE8Versor module, retire Cl(3,0) as the versor bridge

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KYXCM1WK08QG0R003B9KVP4-*.md` glob. -->

Route (B) of the E8-braid-orbit question — the *correct-algebra* restatement (W(E8) as Clifford versors
in Cl(8,0), Dechant 2016). Full routing + proof plan:
`docs/research/2026-08-01-e8-route-b-cl8-versor-construction-of-we8-soraya-routing-and-proof-plan.md`.

## Scope

- **(a) Lean cert** for the algebraic core — style-match `MenoBraidedRMatrix.lean` (abstract certificate,
  do NOT port F# types into Lean):
  - L-A `α α = Q(α)·1` via `CliffordAlgebra.ι_sq_scalar`.
  - **L-B (crux, already in Mathlib):** `−α v α⁻¹ = reflection_α(v)` via
    `CliffordAlgebra.ι_mul_ι_mul_invOf_ι` + `QuadraticMap.polar`. Days-not-weeks — bank this first.
  - L-C conjugation preserves V via `lipschitzGroup.conjAct_smul_ι_mem_range_ι`.
- **(b) F# exact-rational reflection engine + FsCheck** for the finite facts (BP-16 second tool):
  - L-E Coxeter relations `(r_i∘r_j)^{m_ij} = id` on the 8 simple reflections over all 240 roots.
  - L-D transitivity (already gated PR #9802) + `|G/{±1}| = 696729600` by orbit-stabilizer / enumeration.
- **(c) new `CliffordE8Versor` module** over `CliffordAlgebra ℝ⁸` (F#-side a `Cl8` type or a rational 8×8
  reflection engine). Reuse ONLY `E8Lattice.roots`; Cl(3,0) cannot become the versor bridge.
- **(d) L-F (`G/{±1} ≅ W(E8)` presentation iso) stays a DOCUMENTED CONJECTURE** — two named Mathlib gaps:
  no concrete E8 `RootSystem` instance, no proven `weylGroup ≅ CoxeterGroup(E₈)` bridge. Revisit when
  Mathlib lands either. Do NOT let L-F block the tractable (a)/(b) wins.

## Portfolio (Soraya)

Lean for L-A/B/C; exact-arithmetic FsCheck for L-D/E; TLA+/Alloy ruled out (category error). Mathlib
already ships the crux; celebrate the cheap tool.

## Anchors

Dechant 2016 (arXiv:1603.06682); Coxeter (reflection groups); `CliffordAlgebra.ι_mul_ι_mul_invOf_ι`.
