---
id: 081M0XBP381087G0R001C2Q9W7
type: task
state: backlog
priority: P2
slug: construct-the-so-16-half-spinor-bracket-and-verify-jacobi-th
title: "Construct the so(16)+half-spinor bracket and verify Jacobi: the second E8 route is arithmetic, not a construction"
created: 2026-08-25T21:02:12.225Z
depends_on: []
composes_with: []
---

# Construct the so(16)+half-spinor bracket and verify Jacobi: the second E8 route is arithmetic, not a construction

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0XBP381087G0R001C2Q9W7-*.md` glob. -->

## Why

`src/Core/CliffordPeriodicity.fs:192` declares `e8FromSpinors = (16, 248)` and
`tests/Tests.FSharp/CliffordPeriodicity.Tests.fs:264` asserts `bivectorDim 16 + halfSpinorDim 16
= 248`. Explicit-target search over `src/` and `tests/` for `so(16)` / `so16` / `spinor` / `128`
finds **no code that constructs a bracket** on `so(16) + Delta^+`. `E8LieAlgebra.fs` contains none
of those strings — it builds `e_8` from the root system (Chevalley), which is downstream of the
Construction-A route, not the spinor route.

So the "second, uncoded route to E8" is currently `120 + 128 = 248` — a matching count.

**Named competitor with the identical count:** `so(16) semidirect Delta^+` with
`[Delta^+, Delta^+] = 0`, the Inonu-Wigner graded contraction of `e_8`. Dimension 248, same
`120 + 128` split, same `so(16)` action on the same 128. Not isomorphic to `e_8`.

**Excluding invariant:** the bracket `Lambda^2 Delta^+ -> so(16)` is nonzero; equivalently the
Killing form is nondegenerate; equivalently the algebra is simple.

## Scope

1. Build `Gamma: Lambda^2 Delta^+ -> so(16)` from the `Cl(0,16)` gamma matrices.
2. Define the bracket on `so(16) + Delta^+` and run **exhaustive** Jacobi over all
   `C(248,3) = 2,538,776` unordered basis triples (the pattern `E8LieAlgebra.fs` already uses).
3. Check the Killing form is nondegenerate (this is what excludes the contraction).
4. Only then may the route be labelled `metered` and cited as a construction.

## Instrument (routed by Soraya)

**Executable F# in `tests/Tests.FSharp/Formal/`.** Explicitly NOT Lean 4 (weeks of Clifford-module
formalisation for a fact a triple loop settles in seconds, and the loop already exists in-tree),
NOT Z3 (no decision problem), NOT FsCheck (the triple space is exhaustible; sampling is strictly
weaker than the trivial loop), NOT TLA+ (no state machine).

Same gap one rung down at `f4FromSpinors = (9, 52)` — `36 + 16 = 52`, competitor
`so(9) semidirect Delta_9`.

## Pointers

- `docs/research/2026-08-25-routing-the-e8-route-claims-the-bivector-route-quotients-nothing-and-costs-exactly-as-much-soraya.md` §2.4 (the finding) and §4 (the route table)
- `src/Core/CliffordPeriodicity.fs:179-232` · `src/Core/E8LieAlgebra.fs` · PR #15424 (rank 8 is a uniqueness sink; agreement there has zero evidential value)
