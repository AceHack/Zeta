---
id: 081M0X50HY1087G0R003HTDJ1N
type: task
state: backlog
priority: P2
slug: rank-16-discriminating-test-do-the-in-tree-e8-routes-agree-w
title: "Rank-16 discriminating test: do the in-tree E8 routes agree where the target is not unique?"
created: 2026-08-25T19:05:34.913Z
depends_on: []
composes_with: []
---

# Rank-16 discriminating test: do the in-tree E8 routes agree where the target is not unique?

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0X50HY1087G0R003HTDJ1N-*.md` glob. -->

## Outcome — the routes DISAGREE, and the rank-8 agreement is void

Run 2026-08-25. Answers to the three questions PR #15415 (`081M0X3NH3Y087G0R0020VKK2V`) posed:

1. **Same lattice or different?** DIFFERENT. Construction A over the two Type II codes of
   length 16 gives `E8+E8` (root system: two orthogonal components of 240, rank 8 each) and
   `D16+` (one component of 480, rank 16). The rank-8 agreement was forced by Mordell/Witt
   uniqueness and carries no evidential weight.
2. **Which lattice does each route select, and why?** Three of five routes select NOTHING:
   Construction A takes the code as input, the Clifford/versor route takes the Cartan matrix as
   input, and the theta-series route returns _identical_ series for the two lattices (Milnor's
   isospectral pair). The doubling route selects `E8+E8` by construction and provably cannot
   reach `D16+`.
3. **The invariant `?`** — moved from UNPROVEN to **PROVEN NOT TO EXIST** under the only
   formalisation of "natural in the Cayley-Dickson doubling" that has content (`D(L)` contains
   `L _|_ L`, because the CD norm form IS the orthogonal direct sum). It fails at the FIRST rung:
   `det(A2 _|_ A2) = 9`, `det(D4) = 4`, so the index would be `3/2` and `A2 _|_ A2` is not a
   sublattice of `D4` at all.

Also settled: the classification at length 16 is exactly two classes, proven by a mass-formula
balance against computed automorphism orders (3612672 + 5160960 -> 5791500 + 4054050 = 9845550).

Deliverables: `docs/research/2026-08-25-rank-16-is-where-the-e8-routes-disagree-*.md`,
`src/Core.TypeScript/algebra/rank-sixteen-lattice-routes.ts` (+ `.test.ts`).
