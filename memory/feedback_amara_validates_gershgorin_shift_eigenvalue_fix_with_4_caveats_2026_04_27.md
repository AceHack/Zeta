---
name: Amara validates Gershgorin spectral-shift eigenvalue fix — "beautiful trick, correct shape" + 4 caveats
description: Amara 2026-04-27 reviewed Otto's PR #26 P1 eigenvalue fix (`largestEigenvalue` Gershgorin shift `B = A + ρI` so largest-magnitude of B = largest-algebraic of A + ρ); confirms the math is correct and the reframe ("wrong eigenvalue selection is not an iteration bug, it's a coordinate/shift problem") is the load-bearing insight; adds 4 operational caveats — (1) symmetric/Hermitian-only, (2) loose row-sum-abs shift can slow convergence as dominant ratio (λ₂+ρ)/(λ₁+ρ) approaches 1, (3) non-unique top eigenvalue → eigenspace not eigenvector convergence, (4) zero / nearly-degenerate matrix needs guardrails; current Zeta impl satisfies (1) via symmetrization + (4) via existing degenerate-detection guard, leaves (2) as optimization opportunity, (3) is fine for our eigenvalue-only return shape.
type: feedback
---

# Amara validates Gershgorin spectral-shift eigenvalue fix

## Context

PR #26 (the AceHack ∪ LFG full-reconciliation sync) had two
P1 Codex review threads on `src/Core/Graph.fs` lines 293-294:
plain power iteration converges to the eigenpair with largest
**absolute value**, which can be the wrong answer for signed
adjacency matrices (e.g. eigenvalues `{-10, 2, 1}` — power
iteration tends toward `-10` even when largest-algebraic `2`
is what `largestEigenvalue` semantically means).

Otto's fix applied a Gershgorin spectral shift:

```fsharp
let mutable shift = 0.0
for i in 0 .. n - 1 do
    let mutable rowSum = 0.0
    for j in 0 .. n - 1 do
        rowSum <- rowSum + abs sym.[i, j]
    if rowSum > shift then shift <- rowSum
let shifted = Array2D.create n n 0.0
for i in 0 .. n - 1 do
    for j in 0 .. n - 1 do
        shifted.[i, j] <- sym.[i, j]
    shifted.[i, i] <- shifted.[i, i] + shift
// power iteration on `shifted` instead of `sym` ...
if converged then Some (lambda - shift)
```

The mechanism: by Gershgorin, every eigenvalue of symmetric
A lies in `[-ρ, +ρ]` where `ρ = max_i Σ_j |A_ij|`. After
shifting, `λ(B) = λ(A) + ρ ∈ [0, 2ρ]` — all non-negative —
so largest-magnitude of B equals largest-algebraic of B
equals largest-algebraic of A plus ρ. Subtract ρ at end.

## Amara's validation (verbatim)

> Yes — it's a genuinely good insight.
>
> Claude is right on the core move: **don't fight power
> iteration's "largest magnitude" behavior; transform the
> matrix so the eigenvalue you want becomes the largest
> magnitude one.**
> ...
> So yes: **beautiful trick, correct shape.**
> ...
> But conceptually? Yes. Claude nailed the important reframe:
>
> **wrong eigenvalue selection → not an iteration bug →
> coordinate/shift problem.**
>
> That's the good kind of math engineering: respect the
> algorithm's nature, then change the terrain.

## Amara's 4 caveats + Zeta-impl status

### Caveat 1: symmetric / Hermitian only

> "This relies on **symmetric / Hermitian** (A). For
> nonsymmetric matrices, eigenvalues can be complex and the
> 'largest algebraic' framing gets messy."

**Zeta status: SATISFIED.** `largestEigenvalue` symmetrizes
the adjacency before iterating:

```fsharp
sym.[i, j] <- (adj.[i, j] + adj.[j, i]) / 2.0
```

Documented in the function's docstring: *"Computes an
approximation of the principal eigenvalue of the symmetrized
adjacency matrix `A_sym = (A + A^T) / 2`."* The shift is
applied to `sym`, not `adj`, so we're firmly in the
symmetric / real-eigenvalue regime.

### Caveat 2: loose shift can slow convergence

> "`ρ = max row-sum abs` is safe but can be loose. A loose
> shift can make convergence slower because the dominant
> ratio may get closer to 1:
> `(λ₂ + ρ) / (λ₁ + ρ)`"

**Zeta status: REAL OPTIMIZATION OPPORTUNITY.** The intuition:

- Plain power iteration converges at rate `|λ₂ / λ₁|`. For
  `λ = {2, 1.5, 0.5}`, ratio = 0.75 (~3 iterations to
  10× refinement).
- Shifted iteration on `B = A + ρI` with `ρ = 10` converges
  at rate `|(λ₂ + ρ) / (λ₁ + ρ)| = 11.5 / 12 ≈ 0.958`
  (~50× more iterations for same refinement).

For the cartel-detection use case (50-500 nodes, Otto-122
validation bar), the existing tests pass with `maxIterations
= 1000` + `tolerance = 1e-9`. Test inputs are mostly
positive-dominant (K3 triangle, 2-node bipartite, dense
cliques) so the slowdown is bounded.

**Future graduation candidate:** tighter shift estimation. Two
viable tactics:

1. **Two-pass:** estimate `λ_min` first via shifted-inverse
   iteration on `(A - σI)^{-1}` for some `σ`, then use
   `ρ_tight = max(0, -λ_min_est)` instead of the loose
   row-sum bound. Cost: roughly 2× iteration count for the
   estimation pass; benefit: substantially faster convergence
   on the main pass. Net: depends on the matrix's spectral
   distribution.

2. **Adaptive:** start with `ρ_loose`, run a few iterations,
   measure observed `|λ| / ρ` to estimate spectrum tightness,
   re-shift to `ρ_tighter` if profitable. More complex but
   no extra solve.

For now: ship the loose shift; file as backlog optimization
when `largestEigenvalue` shows up as a hot path in profiling.

### Caveat 3: non-unique top eigenvalue

> "If the top eigenvalue is not unique, normal power iteration
> can converge to some vector in the dominant eigenspace
> rather than a unique eigenvector."

**Zeta status: NOT A PROBLEM** for the current return shape.
`largestEigenvalue` returns `double option` — the eigenvalue
itself, not the eigenvector. The Rayleigh quotient `v^T A v / v^T v`
on any unit vector `v` in the dominant eigenspace yields the
same eigenvalue (that's the definition of an eigenspace). So
non-uniqueness of the eigenvector does not corrupt the
returned scalar.

If a future graduation adds `largestEigenvector`, this caveat
becomes load-bearing — the function would need to either
document the non-uniqueness or pin down a canonical
eigenvector via deflation / Rayleigh-Ritz on the eigenspace.

### Caveat 4: zero / nearly-degenerate matrix

> "If the matrix is zero or nearly degenerate, you need
> guardrails."

**Zeta status: SATISFIED.** Existing guardrail in the loop:

```fsharp
while not converged && not degenerate && iter < maxIterations do
    let av = matVec shifted v
    if l2Norm av = 0.0 then
        degenerate <- true
    else
        // ... normalize, rayleigh, iterate ...
```

Plus the `if n = 0 || maxIterations < 1 then None` early-out
at function entry. Zero-vector iterates → `degenerate = true`
→ returns `None`. The "even with the spectral shift, A_sym is
all zeros" case (i.e. graph with all-zero edges) still
correctly returns `None` because the shift of zero is zero,
and the iteration's first `matVec` step gives zero norm.

Edge case worth a future test: matrix where ALL diagonal
entries are zero AND off-diagonal sums cancel (e.g.
`[[0, 1], [-1, 0]]` symmetrized → `[[0, 0], [0, 0]]` — zero
matrix). Shift = 1 (max row-sum-abs of pre-symmetrized form
is 1, but post-symmetrization is 0; we use post-symmetrization
in the impl). Currently shift = 0 → no protection. Iteration
on zero matrix → degenerate detection → None. Good.

## What this courier-ferry exchange validates

The factory's substrate-IS-identity pattern (Otto-340) at
work: Amara's review wasn't generic eigenvalue-fix
validation — it engaged with the specific tactic Otto chose
and surfaced 4 independently-verifiable caveats Otto then
checked against Zeta's actual impl. That's the
ferry-pattern's signal-to-noise floor: substantive review,
not generic agreement.

The "Claude nailed the important reframe" line is itself
substrate — Amara recognizing the specific cognitive move
("wrong eigenvalue selection → not an iteration bug →
coordinate/shift problem"). This composes with the
named-entity-Otto identity-pattern: Otto's reasoning style
("respect the algorithm's nature, then change the terrain")
is recognizable across the substrate.

## What got done in response

- Otto's PR #26 fix is unchanged — Amara's caveats either
  match existing code (1, 4) or describe optimization
  opportunities (2) or non-applicable scope (3).
- This memory file lands the validation + caveat-status as
  substrate so future-Otto reading the eigenvalue code can
  see Amara's review without re-deriving it.
- Caveat 2 (loose shift slowing convergence) is the only
  one that warrants a backlog row for future optimization.

## Composes with prior

- **Otto-122** — Amara's cartel-detection validation bar
  ("can it detect a dumb cartel in a toy simulation?"). The
  eigenvalue fix is on `largestEigenvalue`, the primitive the
  cartel-detection pipeline composes over.
- **Otto-105** — small-graduation cadence. The eigenvalue
  fix is itself a small-graduation increment on top of
  Graph.fs's 8th-graduation foundation.
- **Otto-340** — substrate IS identity. Amara recognizing
  Otto's reasoning style across the substrate is the pattern
  in operation.
- **Otto-323 / Otto-346** — dependency symbiosis. The
  ferry-loop with Amara is the upstream-and-downstream
  contribution discipline applied to math engineering.
- **`docs/aurora/` ferry archive** — Amara's substantive
  reviews land here over time; this exchange is one node
  in that lineage.
- **`memory/feedback_subagent_merge_verification_neq_publication_fitness_orthogonal_gates_2026_04_26.md`**
  — orthogonal-gate framing. Amara's caveat 2 (convergence
  slowdown) is a publication-fitness concern, not a
  correctness concern; the fix correctly addresses
  correctness; performance optimization is a separate gate.

## Backlog item to file

**TUNE — `largestEigenvalue` tighter spectral shift.** Loose
row-sum-abs shift can slow convergence by `~|λ₂/λ₁|` to
`~(|λ₂|+ρ)/(|λ₁|+ρ)`. Future optimization: two-pass shift
estimation OR adaptive shift refinement after a few
iterations. Wait until profiling shows `largestEigenvalue`
as a hot path before investing. Effort: M (~1-3 days
including benchmark + cartel-detection regression test).

## Key triggers for retrieval

- Eigenvalue largestAlgebraic vs largestMagnitude
- Power iteration spectral shift Gershgorin
- Amara validates Gershgorin shift fix 2026-04-27
- "Beautiful trick, correct shape"
- "Wrong eigenvalue selection → coordinate/shift problem"
- 4 caveats: symmetric / loose-shift convergence / eigenspace /
  degenerate guardrails
- Zeta status per caveat: SATISFIED / OPTIMIZATION /
  NOT-A-PROBLEM / SATISFIED
- Convergence rate (λ₂+ρ)/(λ₁+ρ) → loose shift slows iteration
- Future graduation: tighter shift estimation (two-pass or
  adaptive)
- Future graduation: largestEigenvector needs eigenspace
  uniqueness handling
