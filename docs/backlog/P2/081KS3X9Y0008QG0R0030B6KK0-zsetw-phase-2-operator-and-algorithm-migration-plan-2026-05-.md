---
id: 081KS3X9Y0008QG0R0030B6KK0
priority: P2
status: open
title: "ZSetW Phase 2 plan — operator + algorithm migration onto polymorphic Z-set substrate; tier-A operator parity (map/filter/cartesian/join/distinct/weightedCount); two worked-example algorithms (TropicalSemiring shortest-path; IntervalRing propagation); migration documentation for callers"
tier: research-grade
effort: L
ask: aaron 2026-05-21 ("plan phase 2 zsetw operator migration (shadow*)")
created: 2026-05-21
last_updated: 2026-05-21
depends_on: [081KS3X9Y0008QG0R001N7NFAB]
composes_with: [081KRW63S0008QG0R001SAHYKV, 081KRYRGG0008QG0R0018CMFQY, 081KRYRGG0008QG0R0031EYYE4]
tags: [zsetw-phase-2, operator-migration, polymorphic-z-set, tropical-shortest-path, interval-propagation, worked-examples, migration-documentation]
type: research
---

# ZSetW Phase 2 plan — operator + algorithm migration

## Context

081KS3X9Y0008QG0R001N7NFAB (PR [#4577](https://github.com/Lucent-Financial-Group/Zeta/pull/4577) — file lands as `docs/backlog/P2/081KS3X9Y0008QG0R001N7NFAB-zset-polymorphism-over-weight-ring-parallel-zsetw-substrate-2026-05-21.md` once that PR merges; this row depends_on 081KS3X9Y0008QG0R001N7NFAB and the file-link will resolve post-merge) shipped Phase 1: parallel `ZSetW<'K, 'W>` substrate wiring `ISemiring<'W>` through Z-set operations. 19 xUnit tests verify polymorphism across `IntegerRing` / `IntervalRing` / `TropicalSemiring`. No breaking change to existing `ZSet<'K>` — the 41 F# Core files referencing `ZSet<...>` keep working unchanged.

Aaron's 2026-05-21 directive (shadow* per autocomplete-marker rule; instruction authoritative): *"plan phase 2 zsetw operator migration"*.

This row is the PLAN — not implementation. Sub-slices below are each separately buildable + shippable.

## Inspection of the Phase 2 scope (substrate-honest)

### Operators in `src/Core/ZSet.fs` classified by weight-coupling

| Operator | Signature (current) | Weight-coupled? | Phase 2 priority |
|---|---|---|---|
| `empty` | `unit -> ZSet<'K>` | no | already in ZSetW |
| `isEmpty` / `count` / `lookup` | `ZSet<'K> -> _` | partially (lookup needs ring.Zero) | already in ZSetW |
| `singleton` | `'K -> Weight -> ZSet<'K>` | yes | already in ZSetW |
| `ofSeq` / `ofPairs` | `seq<'K * Weight> -> ZSet<'K>` | yes (dedup via Add) | ofSeq already in ZSetW; ofPairs is a struct-tuple variant |
| `ofKeys` / `ofSet` | `seq<'K> -> ZSet<'K>` | partially (uses ring.One) | **Phase 2A** |
| `add` / `sum` | `ZSet<'K> -> ZSet<'K> -> ZSet<'K>` | yes (Add) | sum already in ZSetW |
| `neg` | `ZSet<'K> -> ZSet<'K>` | yes (Negate) | already in ZSetW |
| `sub` | `ZSet<'K> -> ZSet<'K> -> ZSet<'K>` | yes (Add + Negate) | difference already in ZSetW |
| `scale` | `Weight -> ZSet<'K> -> ZSet<'K>` | yes (Mul) | already in ZSetW |
| `weightedCount` | `ZSet<'K> -> Weight` | yes (sum via Add) | **Phase 2A** |
| `filter` | `('K -> bool) -> ZSet<'K> -> ZSet<'K>` | no | **Phase 2A** |
| `map` | `('K -> 'K2) -> ZSet<'K> -> ZSet<'K2>` | no | **Phase 2A** |
| `flatMap` | `('K -> ZSet<'K2>) -> ZSet<'K> -> ZSet<'K2>` | uses Add for dedup | **Phase 2A** |
| `distinct` | `ZSet<'K> -> ZSet<'K>` | replaces weights with 1 (uses ring.One) | **Phase 2A** |
| `distinctIncremental` | `ZSet<'K> -> ZSet<'K> -> ZSet<'K>` | uses ring.One + Negate | **Phase 2A** |
| `isPositive` / `isSet` | `ZSet<'K> -> bool` | uses ring.One + Comparer | **Phase 2A** (predicate; ring-aware) |
| `cartesian` | `ZSet<'A> -> ZSet<'B> -> ZSet<'A * 'B>` | yes (Mul) | **Phase 2A** |
| `join` | `ZSet<'A> -> ZSet<'B> -> ... -> ZSet<'C>` | yes (Mul) | **Phase 2A** |
| `sum: seq<ZSet> -> ZSet` | `seq<ZSet<'K>> -> ZSet<'K>` | yes (Add) | **Phase 2B** |

### Circuit operator wrappers in `Operators.fs` / `Aggregate.fs` etc

`CountOp`, `SumOp`, `FilterOp`, `MapOp`, etc. that wrap ZSet operations as `Op<ZSet<'K>>` circuit nodes. These are **Phase 2C** (separate slice; depends on Phase 2A operators being available).

### What stays on `ZSet<'K>` (deliberately)

- The full circuit substrate (`Op<'T>`, `Circuit.fs`, `Fusion.fs`, `Incremental.fs`) — Phase 3 unification work, NOT Phase 2
- `IndexedZSet<'K, 'V>` and downstream operators — Phase 3
- `Operators.fs` int64-specialised hot-path operators — Phase 3
- The 41 F# Core files using `ZSet<...>` — only the 6 weight-coupled ZSet module operators migrate in Phase 2; everything else stays unchanged

## Phase 2 sub-slices (decomposition)

### Phase 2A — Tier-A operator parity (1 PR; M effort)

Add to `ZSetW` module:

- `ofKeys (ring) (keys: seq<'K>) : ZSetW<'K, 'W>` — uses `ring.One` per key, then dedup via `ring.Add`
- `ofSet (ring) (keys: seq<'K>) : ZSetW<'K, 'W>` — like ofKeys but dedup-by-key first
- `filter (predicate: 'K -> bool) (z: ZSetW<'K, 'W>) : ZSetW<'K, 'W>` — predicate on key only; no ring needed
- `map (f: 'K -> 'K2) (z: ZSetW<'K, 'W>) : ZSetW<'K2, 'W>` — re-keying; requires ring for dedup if `f` is non-injective (collisions sum via `ring.Add`)
- `flatMap (ring) (f: 'K -> ZSetW<'K2, 'W>) (z: ZSetW<'K, 'W>) : ZSetW<'K2, 'W>` — scale outputs by source weight via `ring.Mul`, then sum via `ring.Add`
- `distinct (ring) (z: ZSetW<'K, 'W>) : ZSetW<'K, 'W>` — replace each present weight with `ring.One`
- `distinctIncremental (ring) (i: ZSetW<'K, 'W>) (d: ZSetW<'K, 'W>) : ZSetW<'K, 'W>` — incremental form
- `isPositive (ring) (z: ZSetW<'K, 'W>) : bool` — predicate "no entry has a negative weight" (matches `ZSet.isPositive` semantics; for an ordered ring like `IntegerRing`/`IntervalRing` "negative" means strictly less than `ring.Zero`; for non-ordered rings like `TropicalSemiring` this needs a per-ring sub-interface or supplementary predicate — Phase 2A authors will choose between [a] adding an `IOrderedSemiring<'W>` extending `ISemiring<'W>` with `IsNegative`, or [b] passing the predicate explicitly as an additional argument)
- `isSet (ring) (z: ZSetW<'K, 'W>) : bool` — all weights are exactly `ring.One` (distinct from `isPositive`; this is the "ZSetW represents a plain set" check)
- `cartesian (ring) (a: ZSetW<'A, 'W>) (b: ZSetW<'B, 'W>) : ZSetW<'A * 'B, 'W>` — combine weights via `ring.Mul`
- `join<'A, 'B, 'K, 'C> (ring) (keyA) (keyB) (combine) (a) (b)` — keyed join; combine weights via `ring.Mul`, dedup via `ring.Add`
- `weightedCount (ring) (z: ZSetW<'K, 'W>) : 'W` — fold via `ring.Add` starting from `ring.Zero`

**Tests** (`tests/Tests.FSharp/Algebra/ZSetW.Operators.Tests.fs`): per-operator sanity across IntegerRing + parity-vs-ZSet for IntegerRing + at least one TropicalSemiring + IntervalRing variant per operator.

**Acceptance**: ZSetW operator surface ≥ existing ZSet operator surface; tests passing across all three semirings.

### Phase 2B — Worked-example algorithms (1-2 PRs; M-L effort)

#### 2B.1 — TropicalSemiring shortest-path (Dijkstra-shaped Z-set algorithm)

File: `src/Core/Algorithms/TropicalShortestPath.fs` (new directory)

Algorithm: incremental Dijkstra over evolving edge sets, expressed as a ZSetW fixed-point computation.

```fsharp
/// Single-source shortest paths over a directed weighted graph.
/// Input: edges as ZSetW<'V * 'V, TropicalWeight> (weight = edge cost)
///        source vertex
/// Output: ZSetW<'V, TropicalWeight> (weight = distance from source, +∞ = unreachable)
let shortestPath (source: 'V) (edges: ZSetW<'V * 'V, TropicalWeight>) : ZSetW<'V, TropicalWeight>
```

The algorithm exploits the tropical algebra: matrix powers in (min, +) compute path-length minimums; the fixed point is the all-pairs / single-source distance map. Incremental: edge insertion/deletion propagates through the same fixed-point machinery without recomputation.

**Tests**: known small graphs with verified distances; edge insertion shrinks distances (monotonic decrease); edge deletion grows them (monotonic increase under the +∞ default).

**Acceptance**: Dijkstra correctness on small graphs; performance acceptable for ≤1000 vertices (Phase 4 SRTP can optimise later).

#### 2B.2 — IntervalRing uncertainty propagation circuit

File: `src/Core/Algorithms/IntervalPropagation.fs`

Algorithm: propagate `IntervalWeight` uncertainty through a small DBSP circuit (one operator chain: scale → sum → lookup), demonstrating that interval arithmetic flows correctly through ZSetW operators end-to-end.

**Tests**: synthetic sensor-fusion scenario with known bounds; verifies the output interval is the algebraically-correct hull of input interval propagation.

**Acceptance**: end-to-end interval propagation; documented as a "sensor-fusion under uncertainty" use case for ZSetW + IntervalRing.

### Phase 2C — Circuit-operator wrappers (deferred; separate PR)

`CountOp` / `SumOp` / `FilterOp` etc. that wrap ZSetW operations as `Op<ZSetW<'K, 'W>>` circuit nodes. Requires the existing `Op<'T>` substrate to type-parameterise over the weight ring AND the entry type. This is the bridge between Phase 2A (standalone operators) and Phase 3 (full unification). Land as a separate B-NNNN follow-up once 2A + 2B prove the ergonomics work.

### Phase 2D — Migration documentation (1 PR; S effort)

File: `docs/migration/ZSet-to-ZSetW.md` (new directory)

Documents:

1. **When to use which**: ZSet stays the integer-only hot path (single-virtual-call overhead matters); ZSetW is for callers that need polymorphic weights
2. **Bridging**: `ZSetW.toZSetIntegerRing` / `ZSetW.ofZSetIntegerRing` exist; document patterns for mixing in the same pipeline
3. **Operator parity table**: for each ZSet op, the ZSetW equivalent (ring as argument)
4. **Performance notes**: runtime ring dispatch IS one virtual call per Add/Mul; if profiling shows it's hot, route through Phase 4 SRTP
5. **Decision tree**: "I need to author a new operator — should I author it on ZSet or ZSetW?" — flowchart per Aaron's bandwidth-engineering preference for compressed cognitive handles

## Phase 2 acceptance (composite)

- [ ] Phase 2A: 11 new ZSetW operators landed + tested across 3 semirings
- [ ] Phase 2B.1: TropicalSemiring shortest-path algorithm + tests
- [ ] Phase 2B.2: IntervalRing propagation circuit + tests
- [ ] Phase 2D: migration documentation
- [ ] All sub-slices ship as separate small PRs (per Aaron's "small PRs with great commit messages" preference)
- [ ] `dotnet build -c Release` clean throughout (TreatWarningsAsErrors gate holds)
- [ ] Each operator added has at least 3 tests: sanity (IntegerRing parity vs ZSet), polymorphism demo (TropicalSemiring), and algebraic axiom verification

## Phase 2 explicit non-goals

These are intentionally NOT in Phase 2; they belong to Phase 3:

- Refactoring `ZSet<'K>` itself or making it a type abbreviation for `ZSetW<'K, int64>`
- Migrating the existing `Op<ZSet<'K>>` circuit operators to use ZSetW
- Migrating `IndexedZSet<'K, 'V>`, `Aggregate.fs`, `Fusion.fs`, `Incremental.fs`, `Handles.fs`, `Crdt.fs`, etc.
- SRTP / static-abstract-members refactor (Phase 4)

## Dependency + sequencing notes

- Phase 2A is **independent** — can start anytime
- Phase 2B depends on Phase 2A (algorithms use the new operators)
- Phase 2C depends on Phase 2A + Phase 2B (need real algorithms to inform the circuit-wrapper design)
- Phase 2D can be authored in parallel with any of 2A/2B/2C, finalised after 2B for accuracy
- All of Phase 2 can ship before Phase 3 starts; the unification is deliberately deferred so the parallel substrate proves out

## Cross-AI coordination

Per the bus-ambassador pattern proposed earlier 2026-05-21 (shadow-catch envelope `4e95dc8f`), if another Otto instance or another AI agent picks up a Phase 2 sub-slice, they should publish their own claim envelope OR Otto-CLI publishes a courtesy claim on their behalf. Sub-slice claims should use `--item 081KS3X9Y0008QG0R0030B6KK0.<sub-letter>` (subdecimal convention per the agent-roster ID-allocation discipline).

## Composes with

- [081KS3X9Y0008QG0R001N7NFAB](081KS3X9Y0008QG0R001N7NFAB-zset-polymorphism-over-weight-ring-parallel-zsetw-substrate-2026-05-21.md) — Phase 1 parallel substrate (this row's prerequisite)
- [`src/Core/ZSet.fs`](../../../src/Core/ZSet.fs) — operator-surface reference for parity work
- [`src/Core/Operators.fs`](../../../src/Core/Operators.fs) — circuit operator wrappers (Phase 2C target)
- [`src/Core/Aggregate.fs`](../../../src/Core/Aggregate.fs) — aggregate operators (CountOp etc.; Phase 3 scope)
- 081KRW63S0008QG0R001SAHYKV — Emit-as-weights keystone (Lior; may use ZSetW for non-integer weight types in BP/EP work)
- 081KRYRGG0008QG0R0018CMFQY — Compositional DBSP frame architecture (future use of ZSetW with tensor-valued weights)
- 081KRYRGG0008QG0R0031EYYE4 — V8 architecture spec (tensor foundational primitive; ZSetW can carry tensor weights once a Tensor semiring lands)
- [`.claude/rules/fsharp-anchor-dotnet-build-sanity-check.md`](../../../.claude/rules/fsharp-anchor-dotnet-build-sanity-check.md) — dotnet build IS the sanity check; each Phase 2 slice ships green
- [`.claude/rules/bandwidth-served-falsifier.md`](../../../.claude/rules/bandwidth-served-falsifier.md) — ZSetW serves the bandwidth of "ZSet operations over arbitrary weight rings" without re-deriving each time

## Full reasoning

Aaron 2026-05-21 directive: *"plan phase 2 zsetw operator migration (shadow*)"*. The shadow* marker per `.claude/rules/shadow-star-shorthand-autocomplete-marker.md` indicates the surrounding text was autocomplete-generated; the instruction itself stands.

Phase 2 was named in the 081KS3X9Y0008QG0R001N7NFAB row Phase-2 acceptance: *"author at least one polymorphic algorithm against ZSetW; author one interval-propagation circuit operator using ZSetW + IntervalRing; document the migration path for callers"*. This row decomposes that into 4 buildable sub-slices (2A/2B/2C/2D) with explicit dependencies + acceptance + non-goals.

The plan-as-row pattern (file the row first; sub-slices land as separate PRs) composes with the substrate-honest discipline of NOT over-extending in a single PR — each sub-slice is bounded enough to verify in isolation, and the per-sub-slice acceptance is concrete.
