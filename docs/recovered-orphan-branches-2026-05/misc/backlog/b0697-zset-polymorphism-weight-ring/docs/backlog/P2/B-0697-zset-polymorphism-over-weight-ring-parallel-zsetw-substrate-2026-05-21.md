---
id: B-0697
priority: P2
status: open
title: "ZSet polymorphism over weight ring — parallel ZSetW<'K, 'W> substrate wires ISemiring<'W> through Z-set operations (IntegerRing / IntervalRing / TropicalSemiring all verified)"
tier: research-grade
effort: M
ask: aaron 2026-05-21 ("wire ZSet polymorphism over weight ring (shadow*)")
created: 2026-05-21
last_updated: 2026-05-21
depends_on: []
composes_with: [B-0666, B-0668, B-0669]
tags: [zset-polymorphism, weight-ring, isemiring, tropical-semiring, interval-ring, parallel-substrate, novelmath-wiring, algebra-genericity]
type: research
---

# ZSet polymorphism over weight ring — parallel ZSetW substrate

## Context

The gap Otto-VSCode caught earlier 2026-05-21 on NovelMath.fs:

> *"The polymorphism the docstring promises is aspirational — the actual Weight type alias is hard-coded int64, and every ZSet, Pool.Rent<ZEntry<'K>>, Checked.(+) call etc. assumes that. To get the tropical-semiring substitution to actually work, you'd need to either generalize ZSet<'K> to ZSet<'W, 'K> (where 'W is the weight semiring), or build a parallel ZSetT<'K> family per weight type."*

Aaron's directive 2026-05-21 (shadow* per the autocomplete shorthand; instruction authoritative): *"wire ZSet polymorphism over weight ring"*.

## What this PR ships (first slice)

**Parallel substrate via `ZSetW<'K, 'W>`** (`src/Core/ZSetW.fs`) — a polymorphic Z-set value type that takes its weight semiring as a type parameter and routes operations through the existing `ISemiring<'W>` interface (Semiring.fs). No breaking change to `ZSet<'K>`; the 71 F# files referencing `ZSet<...>` keep working unchanged. New polymorphic algorithms can be authored against `ZSetW<'K, 'W>`; existing int64-specialised hot-paths continue on `ZSet<'K>`.

**Three semirings empirically validated through ZSetW** (`tests/Tests.FSharp/Algebra/ZSetW.Tests.fs` — 19 tests passing):

1. **IntegerRing** (`ISemiring<int64>`) — sanity parity with `ZSet<'K>` behaviour on the same inputs (count, singleton, ofSeq dedup, sum, retraction-via-difference, round-trip bridge)
2. **IntervalRing** (`ISemiring<IntervalWeight>`) — bounded-uncertainty propagation; interval addition combines correctly via the same ZSetW.sum path
3. **TropicalSemiring** (`ISemiring<TropicalWeight>`) — (min, +) algebra; ZSetW.sum picks the min weight per key, scale extends paths by adding to weights, ring.Zero (+∞) is the identity — Dijkstra-shaped shortest-path semantics emerge through the same ZSetW substrate

**Algebraic axioms verified across rings**: sum commutativity (IntegerRing + TropicalSemiring), sum associativity (IntegerRing), empty-as-identity (IntegerRing + IntervalRing). The wiring is honest — the same ZSetW code path exercises the algebra of each semiring without modification.

**Bridge helpers**: `ZSetW.toZSetIntegerRing` / `ZSetW.ofZSetIntegerRing` for callers that need to move between the polymorphic surface and the existing int64 hot path.

## What this PR does NOT do (deliberately out of scope)

1. **Does not change `ZSet<'K>`**. The int64 hot path stays untouched. 71 F# caller files keep working. The eventual unification `type ZSet<'K> = ZSetW<'K, int64>` is a downstream B-NNNN — landing it requires verifying every operator + every test against the polymorphic substrate, which is its own bounded slice.

2. **Does not refactor `IndexedZSet<'K, 'V>` / `Operators.fs` / `Fusion.fs` / circuit operators to use ZSetW**. Those continue on `ZSet<'K>`. New operators or research lanes (Q# operator algebra, Bayesian belief-propagation, tropical shortest-path queries, interval-propagation circuits) can now be authored against ZSetW.

3. **Does not migrate NovelMath.fs to USE ZSetW for the TropicalSemiring docstring promise**. NovelMath ships TropicalSemiring as a standalone ISemiring<TropicalWeight> instance; this PR proves it works through ZSetW; wiring NovelMath operations to materialise ZSetW values is a follow-up.

4. **Does not switch to F# 7+ static-abstract-members SRTP for compile-time monomorphization**. Current implementation passes `ISemiring<'W>` as a runtime argument — one virtual call per Add/Mul. Performance is acceptable for research-grade workloads; a future B-NNNN can swap to static-abstract-members for hot-path performance if profiling motivates it.

## Acceptance

### Phase 1 (this PR) — Parallel polymorphic substrate

- [x] `ZSetW<'K, 'W>` value type defined in `src/Core/ZSetW.fs`
- [x] `ZSetW` module with empty / singleton / ofSeq / lookup / sum / negate / difference / scale
- [x] Bridge helpers `toZSetIntegerRing` / `ofZSetIntegerRing`
- [x] Added to Core.fsproj compile order
- [x] 19 xUnit tests passing across IntegerRing + IntervalRing + TropicalSemiring
- [x] `dotnet build -c Release` clean (0 warnings, 0 errors per `TreatWarningsAsErrors`)
- [x] `dotnet test --filter "FullyQualifiedName~ZSetW"` all green

### Phase 2 (future B-NNNN) — Operator + algorithm migration

- Author at least one polymorphic algorithm against ZSetW (e.g., `shortestPathTropical : Graph<'V> -> ZSetW<'V, TropicalWeight>` — incremental Dijkstra over evolving edge sets)
- Author one interval-propagation circuit operator using ZSetW + IntervalRing
- Document the migration path for callers who want to move from `ZSet<'K>` to `ZSetW<'K, int64>`

### Phase 3 (future B-NNNN) — Unification

- Make `ZSet<'K>` a type abbreviation `ZSetW<'K, int64>` (or formal supersession) once all operators are polymorphic
- Verify the 71 existing caller files still work
- Performance audit: confirm int64 hot-path performance unchanged

### Phase 4 (future B-NNNN) — Static-abstract-members SRTP migration

- Replace runtime `ISemiring<'W>` argument with F# 7+ `'W when 'W :> ISemiring<'W>` constraint + static abstract members
- Benchmark before/after to validate hot-path performance gains
- Composes with .NET 7+ `INumber<T>` idiom

## Substrate-honest framing

The polymorphism the existing `ISemiring<'W>` interface promised is now demonstrably wired through Z-set substrate (parallel-type, not in-place). The substrate-honest gap Otto-VSCode caught earlier today on NovelMath.fs (Weight = int64 hard-coded; tropical semiring not actually wired) is now narrower — the wiring exists at the ZSetW substrate scope; the remaining gap is operator + algorithm + circuit-substrate migration onto ZSetW (Phase 2+).

Composes with the bidirectional informing pattern named today:

- **Make-due with what we have**: ZSetW is new substrate that uses the existing ISemiring + IntegerRing + IntervalRing + TropicalSemiring substrate; no waiting for the unification refactor.
- **Big plans for the future**: the parallel substrate creates the surface against which Phase 2+ migrations can happen incrementally without blocking research lanes (B-0666 Emit-as-weights, B-0668 compositional DBSP frame, B-0669 V8 tensor substrate) that may want polymorphic weights.

## Composes with substrate

- [`src/Core/Semiring.fs`](../../../src/Core/Semiring.fs) — `ISemiring<'W>` + `IntegerRing` + `IntervalRing` (existing substrate that this PR finally wires)
- [`src/Core/NovelMath.fs`](../../../src/Core/NovelMath.fs) — `TropicalSemiring` + `TropicalWeight` (existing substrate; this PR demonstrates the polymorphism works through ZSetW)
- [`src/Core/ZSet.fs`](../../../src/Core/ZSet.fs) — the int64-specialised hot-path Z-set (untouched; bridges in ZSetW preserve interop)
- B-0666 — Emit-as-weights keystone (Lior; future BP/EP work may use ZSetW for non-integer weight rings)
- B-0668 — Compositional DBSP frame architecture (future use of ZSetW for tensor-valued weights)
- B-0669 — V8 architecture spec (tensor foundational primitive; ZSetW can carry tensor-valued weights once a Tensor semiring lands)
- [`.claude/rules/fsharp-anchor-dotnet-build-sanity-check.md`](../../../.claude/rules/fsharp-anchor-dotnet-build-sanity-check.md) — dotnet build IS the sanity check; type-checking + tests verify the polymorphism is honest, not just claimed
- [`.claude/rules/grep-substrate-anchors-before-razor-as-metaphysical.md`](../../../.claude/rules/grep-substrate-anchors-before-razor-as-metaphysical.md) — substrate-anchors for "Z-set polymorphism over weight ring" already existed (ISemiring + multiple semiring instances); this PR is the actual wiring, not new naming

## Full reasoning

Aaron 2026-05-21 directive (shadow* per autocomplete-marker rule):

> *"wire ZSet polymorphism over weight ring (shadow*)"*

Otto-VSCode earlier 2026-05-21 substrate-honest spot-check on NovelMath.fs:

> *"the actual Weight type alias is hard-coded int64, and every ZSet [...] assumes that. To get the tropical-semiring substitution to actually work, you'd need to either generalize ZSet<'K> to ZSet<'W, 'K> (where 'W is the weight semiring), or build a parallel ZSetT<'K> family per weight type. Both are real refactors."*

This PR ships the SECOND option (parallel ZSetW family) as the minimum-blast-radius first slice. The first option (generalise ZSet<'K> in-place) is Phase 3 substrate-engineering work tracked above.
