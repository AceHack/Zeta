---
id: 081KYXE4W7D08QG0R00256B56A
type: task
state: backlog
priority: P2
slug: icosahedralh3-visual-geometry-module-30-h3-roots-in-cl-3-0-1
title: "IcosahedralH3 visual-geometry module: 30 H3 roots in Cl(3,0) -> 120 spinors (2I/600-cell) -> H4 -> E8 240 via icosian golden doubling; FsCheck set-equals CliffordE8Roots/E8Lattice (3rd independent road, BP-16); the 3D-visual non-numerological geometry layer (buckyball/Addison)"
created: 2026-08-01T01:13:50.061Z
depends_on: []
composes_with: []
---

# IcosahedralH3 visual-geometry module: 30 H3 roots in Cl(3,0) -> 120 spinors (2I/600-cell) -> H4 -> E8 240 via icosian golden doubling; FsCheck set-equals CliffordE8Roots/E8Lattice (3rd independent road, BP-16); the 3D-visual non-numerological geometry layer (buckyball/Addison)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KYXE4W7D08QG0R00256B56A-*.md` glob. -->

The 3D-visual, **non-numerological** geometry layer. Justification: **hardware-targeting** the human
visual cortex (the most optimized human hardware for 3D geometry) — "3D is what perception hardware runs
fastest," not "3 is fundamental." Full routing: `docs/research/2026-08-01-icosahedron-to-e8-the-visual-geometry-layer-soraya-verdict.md`.

## Deliverable — `src/Core/IcosahedralH3.fs` (built on `Cl3`)

1. **30 H3 roots** in `Cl3` (icosahedral Coxeter root system; reflection `x ↦ −αxα`).
2. **120 spinors = 2I** (binary icosahedral group) via even products of H3 roots (even subalgebra Cl⁺(3,0) ≅ ℍ) = vertices of the 600-cell.
3. **H4 = 120 roots** (600-cell) — the spinors as a rank-4 root system (Dechant's spinor induction).
4. **E8 = 240** via the **icosian golden doubling** `2I ∪ φ·2I` (ℚ(√5), icosian ring ≅ E8) — NOT a third spinor step (honest 3→4 vs 4→8 distinction).

## Acceptance gate (FsCheck, finite, DST-replayable; hex/JSON golden vectors per no-binary rule)

- counts: H3=30, spinors=120, H4=120, E8=240; Gram matrices = H3/H4/E8 Cartan.
- **the load-bearing gate — 3rd independent road:** the 240 **set-equals** `CliffordE8Roots.roots` and
  `E8Lattice.roots` up to isometry/rescaling (Cl(8,0)-versor road + Construction-A road + this icosahedral
  road all reach the SAME E8 ⇒ BP-16 cross-check in the geometry layer). Template:
  `tests/Tests.FSharp/Formal/CliffordE8Roots.Tests.fs`.

## Out of scope / cite-don't-reprove

Icosian ring ≅ E8 (Conway–Sloane SPLAG §8.2); Dechant spinor induction (2015/2016); E8 root-system
uniqueness (⇒ all roads = same E8). Optional Lean stretch = the versor-reflection identity — **already
landed** abstractly in `src/Core.Lean4/Lean4/CliffordReflectionE8.lean`.

Depends-on: none (builds on existing `Cl3`, `CliffordE8Roots`, `E8Lattice`). Composes-with:
`081KYXE4W8808QG0R0011X8S70` (WSet hexagon port — the algebra layer this is the visual shape of).
