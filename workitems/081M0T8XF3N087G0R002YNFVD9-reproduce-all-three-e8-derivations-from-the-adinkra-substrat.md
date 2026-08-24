---
id: 081M0T8XF3N087G0R002YNFVD9
type: task
state: closed
priority: P2
slug: reproduce-all-three-e8-derivations-from-the-adinkra-substrat
title: "Reproduce all three E8 derivations from the adinkra substrate, and settle the mod-8 clock origin"
created: 2026-08-24T16:16:04.725Z
depends_on: []
composes_with: []
---

# Reproduce all three E8 derivations from the adinkra substrate, and settle the mod-8 clock origin

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0T8XF3N087G0R002YNFVD9-*.md` glob. -->

Aaron 2026-08-24: *"we have 'one' adinkra, the Hamming doubly-even code with extensive towers on
top, and a smaller adinkra tower, non-coded, homoiconic at its nature, with 2 of 3 E8 derivations
reproduced from them — the roots for sure and maybe the algebra or the Lie group. We should try to
route and reproduce all three."* Plus: *"in our coded adinkra this demarcation comes out to mod 8
clock to separate what remains from what acts; I don't know about in our 2nd non-coded adinkra
tower"* and *"yes it's from the Clifford expansion."*

## What was measured

**It was one of three, not two.** The object that felt like a second derivation is a *fourth*: the
Weyl group W(E8), reproduced as Clifford versors, which is neither the Lie algebra nor the Lie
group. The chain broke between the root system and `e₈`.

| rung | before | after |
|---|---|---|
| root system, 240 roots | reproduced, metered | unchanged |
| Lie algebra `e₈`, dim 248 | **absent** — two integer tuples and prose | built, metered |
| compact Lie group E8 | absent | honest substitute, metered |

## Landed

- `src/Core/E8LieAlgebra.fs` + `tests/Tests.FSharp/Formal/E8LieAlgebra.Tests.fs` — Chevalley–Serre
  presentation with structure constants derived from the Dynkin diagram; Jacobi over all
  `C(248,3)` triples with five mutation controls; Killing form; compact real form.
- `src/Core.TypeScript/research/adinkra-ecc/mod8-clock.ts` + `.test.ts` — the within-object
  experiment that excludes the code as the clock's origin, and measures the separation clock's
  period as **4**, not 8.
- `docs/research/2026-08-24-all-three-e8-derivations-the-chain-breaks-at-rung-4-and-the-demarcation-clock-is-mod-4.md`

## Left open (deliberately, and named in the doc)

- `|W(E8)| = Π dᵢ` cites Coxeter's theorem; the exponents are computed, the product step is not.
  Closing it means a Schreier–Sims order computation on the degree-240 permutation action.
- The `ℝ/ℂ/ℍ` ground is measured through `dim End_A(M) = Σ mᵢ² dim K`, which does not on its own
  separate multiplicity from ground.
- The presentation isomorphism `G/{±1} ≅ W(E8)` remains a labelled conjecture (Mathlib gaps).
- Two different objects in-repo are called "the adinkra clock" — the ABS periodicity clock and the
  anticommutator clock of `AdinkraClock.fs`, which carries no mod-8 content at all.
