# `Zeta23/LinAlg` — adapted port (Anthropic, Apache-2.0)

**Register, stated before anything else:**

> **`port`** — adapted port of `Zeta23/LinAlg/` from
> [`anthropics/zeta-23-lean`](https://github.com/anthropics/zeta-23-lean) @ v1.0
> (Apache-2.0, Copyright 2026 Anthropic, PBC), retargeted from Mathlib rev
> `51e6992efd06126df61a496bebf8f49482a4e129` (Lean `v4.33.0-rc2`) to Mathlib
> `v4.30.0-rc1` (Lean `v4.30.0-rc1`). **Not an independent replication: the upstream
> Lean source was read.**

The bare phrase "we replicated it" is refused. See `docs/research/verification-registry.md`
for the row, including the `NOT claimed` field.

## What is here

| file | content |
|---|---|
| `LinAlg/PosIndex.lean` | `posIndex`, `negIndex`, `rtrace`, `frobSq`, the `eigenvalues₀` reindexing |
| `LinAlg/VonNeumann.lean` | **`vonNeumann_trace_ineq`** — `Re tr(AB) ≤ ∑ᵢ λᵢ(A)λᵢ(B)`, Hermitian case |
| `LinAlg/HermitianPosPart.lean` | the `Q = Q₊ − Q₋` PSD splitting |
| `LinAlg/Sylvester.lean` | Sylvester's law of inertia, Hermitian, both directions |
| `LinAlg/Inertia.lean` | paper Lemma 3.1 |
| `LinAlg/RankTrace.lean` | paper Lemma 3.2 — `rank_trace_ineq` |
| `LinAlg/Weyl.lean` | paper Lemma 3.4 — Weyl perturbation |

`vonNeumann_trace_ineq` is **not in Mathlib master** (code search: 0 hits). Upstreaming it
with attribution is real external value and is the reason it was worth acquiring.

## Retarget cost: zero proof edits

Measured, not assumed. The eight files were dropped into a scratch `lean_lib` against our
existing pin and `lake build` was run once: **2690 jobs, build completed successfully**, no
errors, no `sorry`. The only diagnostics were `linter.style.longLine` warnings on upstream's
own provenance comment. Every Mathlib name the proofs call resolves at our pin —
`exists_eq_sum_perm_of_mem_doublyStochastic` (`Analysis/Convex/Birkhoff.lean:152`),
`Monovary.sum_mul_comp_perm_le_sum_mul` (`Algebra/Order/Rearrangement.lean:437`),
`reindex_mem_doublyStochastic`, `eigenvalues₀`, `eigenvectorUnitary`, `spectral_theorem`,
`rank_eq_card_non_zero_eigs`.

Because no step was re-proved, **the register stays `port`.** (Re-proving a lemma because a
name moved would still be a port; nothing here even required that.)

## What is NOT here

`Zeta23/FromPNTPlus/` and the whole analytic-number-theory half. Theorems A and B of the
paper are **not** formalized in this repo. This subtree is §3's engine, not the result.

## Route agreement (recorded because it is the one independence-flavoured fact we have)

Soraya derived the proof route — Birkhoff–von Neumann on `Sₖₗ = ‖Wₖₗ‖²` plus the
rearrangement inequality — from our own Mathlib pin **before** the upstream source was read,
and it is the same route upstream took. That makes this a port that is *understood* rather
than merely copied. It does **not** make it a replication, and it is not offered as one.

## Licence

Apache-2.0 both sides, so no compatibility question — but §4(a)–(d) bind and are honoured:
`LICENSE` (§4(a)), the per-file `MODIFIED FROM UPSTREAM` blocks (§4(b)), the untouched
per-file `Copyright (c) 2026 Anthropic, PBC` / `SPDX-License-Identifier` headers (§4(c)),
and `NOTICE` + `NOTICE.upstream` (§4(d)).
