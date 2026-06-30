---
id: B-0693
priority: P2
status: open
title: Morsel/span-based execution — IMorselOperator + cache-sized chunked processing (Otto-VSCode 8-PR campaign PR #7)
tier: research-grade
effort: L
ask: otto-vscode 2026-05-21 (8-PR algebra-capability-system campaign; aaron-approved via shadow* "file the 3 rows for PRs 6-8")
created: 2026-05-21
last_updated: 2026-05-21
depends_on: [B-0635, B-0688, B-0692]
composes_with: [B-0694]
tags: [morsel-execution, span-based, cache-sized-chunks, imorseloperator, otto-vscode-pr-7, dbsp-architecture, columnar-execution]
type: research
---

# Morsel/span-based execution — IMorselOperator

## Context

Otto-VSCode 8-PR algebra-capability-system campaign 2026-05-21 PR #7. Depends on PR #6 (push-based hot-path; tracked at B-0692) — morsel-execution is the next-tier optimization that composes with push-pattern.

## The architectural problem

Even with push-based fusion (per B-0692), per-entry callbacks have function-call overhead. For tight inner loops over large Z-sets, processing entries one-at-a-time leaves cache + SIMD performance on the table. Modern columnar databases (DuckDB, Velox, Photon, Polars) batch process entries in "morsels" — cache-sized chunks (typically 4KB-64KB; matches L1/L2 cache line groups) — which:

- Amortizes function-call overhead across N entries per call
- Enables SIMD-vectorized predicate / projection / arithmetic
- Improves cache locality (one chunk in L1 at a time)

## The morsel pattern

`IMorselOperator` processes `ReadOnlySpan<ZEntry<'T>>` chunks instead of individual entries:

```fsharp
type IMorselOperator<'T> =
    abstract member ProcessMorsel: ReadOnlySpan<ZEntry<'T>> -> unit
    abstract member EndTick: unit -> unit
```

The intermediate "chunk" becomes a stack-allocated `Span<ZEntry<'T>>` from a pooled buffer; the JIT can fuse the chunk processing across method boundaries because the span never escapes to the heap. This is the F#/`.NET` analog of what rustc + LLVM give Rust for iterator chains.

## Scope

### Phase 1 — `IMorselOperator<'T>` interface + morsel-buffer pool

- Define `IMorselOperator<'T>` interface in `src/Core/Op.fs`
- Add `IsMorselCapable: bool` capability flag to Op<'T> (composes with PR #4558 pattern)
- Morsel-buffer pool: pooled `ArrayPool<ZEntry<'T>>` per-thread with chunk size = L1/L2-cache-aware (default 4KB / `sizeof<ZEntry<'T>>` = N entries per morsel)
- MorselAdapter wraps both materialize-style and push-style operators

### Phase 2 — Morsel-segment detection in FusionEngine

Extend FusionEngine (per PR #4566 + Phase 2 of B-0692):

- Sequence of `IsLinear AND IsPushable AND IsMorselCapable` operators is a morsel-segment candidate
- Morsel-segment supersedes push-segment when ALL operators in chain support morsels
- Falls back to push-segment if any operator is push-but-not-morsel-capable

### Phase 3 — Morsel-versions of common linear ops

- `MapMorselOp<'A,'B>` — processes full span; emits to output span
- `FilterMorselOp<'T>` — predicate evaluation across full span; SIMD-eligible
- `NegMorselOp<'T>` — weight negation across full span; trivially SIMD
- Sort/consolidate at morsel boundaries (multi-morsel merge happens at segment end)

### Phase 4 — Benchmark + validation

- BenchmarkDotNet job at `bench/Benchmarks/MorselExecutionBench.fs`:
  - Materialize-baseline (3-op chain)
  - Push-based (3-op chain; per B-0692)
  - Morsel-based (3-op chain; this row)

- Allocation: expected morsel allocates 1× per segment (matches push-based)
- Throughput: expected morsel adds another 1.5-3× over push-based on SIMD-friendly inner loops (filter + arithmetic on int weights)

## Acceptance

### Phase 1

- `IMorselOperator<'T>` interface lands
- `IsMorselCapable` capability flag on Op<'T>
- Morsel-buffer pool implementation
- `dotnet build` clean; existing tests pass

### Phase 2

- FusionEngine recognizes morsel-segments
- Morsel-segment supersedes push-segment when applicable

### Phase 3

- 3 morsel-versions of common ops land
- Cross-verify: morsel-version output matches push-version + materialize-version

### Phase 4

- Benchmark validates throughput improvement over push-baseline
- SIMD-eligibility documented per-op

## Substrate-honest framing

This is research-grade architectural substrate following the well-trodden columnar-execution path. The Zeta contribution is composing morsel-execution with the segmented-push pattern (B-0692) and the DBSP retraction-native algebra: morsel-execution preserves Z-set semantics within a segment; materialize boundaries at segment ends preserve the algebra-level discipline.

The pattern itself isn't novel — DuckDB / Velox / Photon / Polars all do columnar-morsel execution. Zeta's contribution is the DBSP-segment-aware version + the capability-tag-driven segment detection.

## Composes with rules

- `.claude/rules/fsharp-anchor-dotnet-build-sanity-check.md` — F# compiler verifies the morsel interface + Span<T> safety
- `.claude/rules/bandwidth-served-falsifier.md` — morsel-execution serves cache-bandwidth (entries-per-cache-line)
- `.claude/rules/edge-defining-work-not-speculation.md` — composing morsel-execution with DBSP-segment-discipline is edge-defining

## Composes with substrate

- B-0635 / B-0644 / B-0665 / B-0666 (Agora V6 — morsel-pattern preserves operational primitives within segments)
- B-0688 (incremental compiler host — codegen emits morsel-fused IL at hot segments)
- B-0692 (PR #6 push-based — morsel-pattern is the next-tier optimization above push)
- B-0694 (PR #8 standing-query codegen — codegen emits morsel-segment-fused IL)
- PR #4558 (capability tags — IsMorselCapable sibling to IsLinear/IsBilinear/IsSink/IsPushable)
- PR #4566 (FusionEngine — Phase 2 extends with morsel-segment detection)
- DuckDB / Velox / Photon / Polars columnar-execution literature (external prior-art reference)

## Why P2

Substantive architectural substrate; not blocking V1; high value (SIMD + cache-locality unlocks throughput tier above push-based); bounded by Otto-VSCode's 8-PR campaign sizing (~350 lines).

Depends on B-0692 (push-based) landing first — morsel-pattern composes with push-pattern, not replaces it.

## Origin

Otto-VSCode 8-PR algebra-capability-system campaign 2026-05-21. Filed via Otto-CLI per Aaron-approved shadow* "file the 3 rows for PRs 6-8" instruction. Otto-VSCode owns the implementation; this row tracks the scope.
