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

## STATUS — increment 3 LANDED (2026-08-13, Otto): rung split + Rel corner + the LEAN CERT. Work-item stays OPEN

Start-gate audit first: increments 1–2 (+adjacent) were further along than the row
implied — copy Δ / discard ! / tensor / arr + the ℤ law pack + discriminator
(#9816), FourCornerTrace (#9824), Meno.Bind fix (#9827), and the E8 demotion +
`rootMvs` honest-scope correction (Soraya route-(B), 2026-08-01) are ALL on main.
Landed today, the three open legs:

1. **Rung honesty split on `WSet`** (deliverable 1's missing half): the linear +
   comonoid ops (`consolidate`/`apply`/`tensor`/`discard`) now take `#ISemiring`
   (Add/Mul/Zero/One — all they consume), so the INVERSE-FREE corners of the
   hexagon type-check; `negate` + the whole `FourCornerTrace` demand `#IRing` —
   retraction IS the additive inverse, so the compiler (not a runtime throw)
   refuses the trace off the ring corners. Zero ripple: all existing consumers
   pass `IStarRing` instances which subsume both rungs.
2. **The Bool/Rel corner** (deliverable 2's missing adapter): `BoolOrSemiring`
   in `Semiring.fs` — lawful (∨,∧) commutative semiring, SEMIRING-ONLY on the
   IntervalRing precedent (`true` has no additive inverse; GF(2)/XOR is a
   different structure — parity, not reachability; the docstring keeps them
   apart). Law-pack block added: comonoid laws over (∨,∧); the discriminator
   Rel-flavoured (total-deterministic = comonoid hom; NONDETERMINISTIC fails
   copy-naturality via cross pairs; PARTIAL fails discard-naturality via
   mass-drop); and the Rel-specific witness ℤ cannot show — ∨-idempotence makes
   duplicate emission invisible, so branching does NOT double discarded mass
   (the failure mode moves from doubling to dropping).
3. **The Lean half of the two-tool proof** (the verification section's Lean leg):
   `src/Core.Lean4/Lean4/ZSetCopyComonoid.lean` — ZSet as `K →₀ ℤ`;
   `Coalgebra ℤ (K →₀ ℤ)` + `IsCocomm` via Mathlib `Finsupp.instCoalgebra`
   (coassoc/counital/cocommutative = instance fields, nothing re-proved by hand);
   `comul_single` (Δ IS the diagonal `single k 1 ⊗ single k w`), `counit_single`
   (ε reads the weight), `counit_eq_total` (ε = Σ weights = `WSet.discard`, by
   `Finsupp.induction_linear`). No `sorry`, nothing axiomatized; the GDL
   one-circuit/N-semirings unifier stays a documented conjecture as specified.
   **`lake build` green: full project 8294 jobs, both default targets.**

Full .NET suite 4,898 F# + C#/Bayesian green (whole-solution run).

STILL OPEN on this row: the ℝ≥0-normalized Markov adapter as a first-class corner
(currently a law-pack witness, not an adapter type); wiring the trace through
`FourCorner.fs`'s C₄ phase object explicitly (deliverable 3's remaining half);
`CliffordE8Roots.rootMvs` retirement decision (081KYXCM1WK's versor route);
`MenoBraided` composition audit. Coordinate with the silicon-alife braid-bridge
trajectory before closing.
