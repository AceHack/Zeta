---
id: 081KYXE4W8808QG0R0011X8S70
type: task
state: backlog
priority: P2
slug: wset-is-the-universal-tensor-hexagon-port-generalize-wset-is
title: "WSet is the universal-tensor hexagon port: generalize WSet/IStarRing to carry copy/discard comonoid morphisms; ring adapters = Markov corners (Z=CD, R>=0=Markov, C=semicartesian/no-cloning, Bool=Rel); demote CliffordE8Bridge numerology; FsCheck comonoid-naturality strata + Lean ZSet-copy-is-comonoid via Mathlib Coalgebra"
created: 2026-08-01T01:13:50.088Z
depends_on: []
composes_with: []
---

# WSet is the universal-tensor hexagon port: generalize WSet/IStarRing to carry copy/discard comonoid morphisms; ring adapters = Markov corners (Z=CD, R>=0=Markov, C=semicartesian/no-cloning, Bool=Rel); demote CliffordE8Bridge numerology; FsCheck comonoid-naturality strata + Lean ZSet-copy-is-comonoid via Mathlib Coalgebra

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KYXE4W8808QG0R0011X8S70-*.md` glob. -->

The algebra core of the four-layer synthesis: **one traced monoidal category over a `*`-semiring, with a
comonoid** — `WSet` is the port, ring choices are the corners. Full design:
`docs/research/2026-08-01-markov-category-hexagon-meno-message-third-corner-design.md` (POST-VALIDATION
section). Confirmed by Soraya's hexagon validation.

## Deliverable

1. **Generalize `WSet` / `IStarRing`** to carry the comonoid morphisms **copy `Δ: A → A⊗A`** and
   **discard `!: A → I`** + the per-ring boundary nonlinearity (Distinct / normalization / Born).
2. **Ring adapters = the corners** (at least four; not three): ℤ=`ZSet` (CD / retraction), `arr f`=cartesian
   (deterministic), ℝ≥0=`WSet<ℝ≥0>` (Markov), ℂ=`WSet<ℂ>`/`MachZehnderWSet` (semicartesian / no-cloning),
   Boolean=`GSet` (Rel). The corner **is** which comonoid naturality holds (Fritz's axis).
3. **Trace = the four-corner feedback** (`FourCorner.fs`, C₄={1,i,−1,−i}) realized by ZSet retraction (−1)
   — wire the traced-monoidal trace so the quantum (i) and retrocausal (−1) corners share one phase.
4. **Demote `CliffordE8Bridge.fs`**: strip the E8-bridge framing; fix `CliffordE8Roots.rootMvs` (line 136)
   which re-pipes clean Cl(8,0) roots back through the numerological relabeling.
5. Fix `Meno.fs` stubs (`Bind`, `bridgeMaji`) before building on them; correct the "Meno = cartesian"
   doc-claim (full `(ZSet,⊗)` is CD; cartesian is the `arr f` subcategory only).

## Verification (BP-16)

- **FsCheck** (`tests/Tests.FSharp/Formal/`, beside `Crdt.Laws` / `SemiringRing.Laws`): comonoid equations
  (coassoc/counit/cocommutative) per adapter; **the discriminator** — `arr f` IS a comonoid hom
  (deterministic) while a signed `a↦b+c` is NOT (copy-naturality counterexample); discard-naturality holds
  on `arr`/normalized, fails on general ℤ-linear.
- **Lean**: `ZSet` copy `(Δ,ε)` is a cocommutative counital comonoid via Mathlib `RingTheory.Coalgebra` /
  `MonoidAlgebra` (the group-algebra comultiplication `Δ(g)=g⊗g` is already an instance). Two-tool with
  FsCheck. Mathlib has `Comon_`/coalgebra but **no** Markov/CD-category framework → the unifying "one GDL
  circuit / N semirings" statement stays a **documented conjecture** (Fritz 2020, Fox 1976, Cho–Jacobs
  2019, Aji–McEliece 2000) — do not gate on it.

## Anchors

Aji–McEliece 2000 (GDL); Fritz 2020 / Cho–Jacobs 2019 / Fox 1976 (comonoid strata); Joyal–Street–Verity
1996 (traced monoidal = the four-corner trace). Composes-with `081KYXE4W7D08QG0R00256B56A` (IcosahedralH3 —
the visual shape of this algebra).
