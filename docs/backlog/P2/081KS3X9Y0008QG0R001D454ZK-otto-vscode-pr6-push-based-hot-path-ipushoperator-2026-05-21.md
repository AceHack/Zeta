---
id: 081KS3X9Y0008QG0R001D454ZK
priority: P2
status: open
title: Push-based hot-path — IPushOperator<'T> + per-entry callback bridged at materialize boundaries (Otto-VSCode 8-PR campaign PR #6)
tier: research-grade
effort: L
ask: otto-vscode 2026-05-21 (8-PR algebra-capability-system campaign; aaron-approved via shadow* "file the 3 rows for PRs 6-8")
created: 2026-05-21
last_updated: 2026-05-21
depends_on: []
composes_with: [081KRW63S0008QG0R002KC5DSR, 081KS3X9Y0008QG0R00323NSZA, 081KS3X9Y0008QG0R0010716X9, 081KS3X9Y0008QG0R003Y2X2T0, 081KS3X9Y0008QG0R000J4SFTS]
tags: [push-based, hot-path, ipushoperator, per-entry-callback, materialize-boundary-bridge, otto-vscode-pr-6, dbsp-architecture, fusion-engine]
type: research
---

# Push-based hot-path — IPushOperator<'T>

## Context

Otto-VSCode 8-PR algebra-capability-system campaign 2026-05-21. PRs 1-5 substrate landed:

- **#4558** capability tags on Op<'T> base class + adapter detection via non-generic markers
- **#4560** sink-terminality validation in Circuit.Build() + producer/sink schedule split
- **#4563** OPEN — LawRunner.checkBilinear (left/right linearity + sign-distribution)
- **#4564** OPEN — IncrementalAuto dispatcher using capability tags (close-and-reopen per Otto-CLI substrate-honest preference; supersedes incoming)
- **#4566** FusionEngine DAG rewriter pass + catalog entries

PR #6 (this row) starts the hot-path optimization layer that depends on PRs 1-5.

## The architectural problem

Current Zeta DBSP operators are **materialize-batch**: each operator's StepAsync writes an `ImmutableArray<ZEntry<'T>>` to `Op<'T>.Value` (volatile field); downstream operators read that materialized snapshot. This is semantically correct but creates a per-tick heap-allocation floor that PGO + JIT inlining cannot eliminate (the volatile field write/read pair is a hard barrier for the compiler).

Per Otto-VSCode's earlier analysis: this allocation floor is THE bottleneck for fusion gains. Manual `FilterMap` fusion only escapes it by collapsing two operators into one + bypassing the intermediate Op<'T>.Value write.

## The push-based escape

`IPushOperator<'T>` is the architectural alternative: instead of materializing per tick, hot-path operators emit entries via per-entry callback to downstream consumers. The materialization boundary moves from per-operator to per-fusion-segment.

```fsharp
type IPushOperator<'T> =
    abstract member EmitEntry: ZEntry<'T> -> unit
    abstract member EndTick: unit -> unit
```

Operators along a push-segment chain entries through callbacks. Materialization happens only at segment boundaries (where a downstream operator NEEDS the materialized view — e.g., sort/consolidate/join requires the whole tick's worth of entries at once).

## Scope

### Phase 1 — `IPushOperator<'T>` interface + adapter pattern

- Define `IPushOperator<'T>` interface alongside `Op<'T>` (currently in `src/Core/Circuit.fs`; may factor to a new `src/Core/Op.fs` if the type expands enough to warrant separation)
- Add `IsPushable: bool` capability flag to `Op<'T>` (composes with PR #4558 capability-tag pattern)
- `PushAdapter<'T>` wraps materialize-style operators behind the push interface (degrades to materialize for non-pushable ops)

### Phase 2 — Push-segment detection in FusionEngine

Extend the FusionEngine (PR #4566) to detect push-segment-eligible runs:

- Sequence of `IsLinear AND IsPushable` operators is a push-segment candidate
- First materialize-required operator (sort / join / aggregate) is the segment boundary
- Emit fused push-segment operators that callback-chain the entries

### Phase 3 — Push-versions of common linear ops

- `MapPushOp<'A,'B>` — `EmitEntry e = downstream.EmitEntry (mapFn e)`
- `FilterPushOp<'T>` — `EmitEntry e = if pred e then downstream.EmitEntry e`
- `NegPushOp<'T>` — `EmitEntry e = downstream.EmitEntry { e with Weight = -e.Weight }`
- (Other linear ops as needed; bilinear ops materialize by definition)

### Phase 4 — Benchmark + validation

- BenchmarkDotNet job at `bench/Benchmarks/PushBasedHotPathBench.fs` comparing:
  - Materialize-only chain (3-op pipeline)
  - Push-based fused chain (3-op pipeline)

- Allocation column is the smoking gun (expected: push-based eliminates 2 of 3 per-tick `ImmutableArray<ZEntry<'T>>` allocations)
- Throughput: expected 2-3× improvement on hot-path-friendly pipelines

## Acceptance

### Phase 1

- `IPushOperator<'T>` interface lands
- `IsPushable` capability flag on Op<'T>
- PushAdapter wraps existing operators
- `dotnet build` clean; existing tests pass

### Phase 2

- FusionEngine recognizes push-segments
- One push-segment fuses end-to-end in a test case

### Phase 3

- 3 push-versions of common ops land (MapPushOp + FilterPushOp + NegPushOp)
- Cross-verify: push-version output matches materialize-version output for same inputs

### Phase 4

- Benchmark shows push-segment allocates 1× per-segment (not N× per-operator)
- Throughput improvement empirically measured + documented

## Substrate-honest framing

This is research-grade architectural substrate. ~250 lines per Otto-VSCode's 8-PR campaign sizing. The win is the allocation-floor escape; the cost is the materialize-boundary discipline (operators must declare push-capable; segments end at any materialize-required op).

The push-pattern itself isn't novel — Reactive Extensions (Rx) operates this way; LINQ-to-Objects uses IEnumerator chained callbacks. The Zeta contribution is the SEGMENTED push (push within fusion-segments; materialize at segment boundaries to preserve Z-set algebra semantics) + capability-tag-driven segment detection.

## Composes with rules

- `.claude/rules/fsharp-anchor-dotnet-build-sanity-check.md` — F# compiler verifies the IPushOperator<'T> interface + push-pattern type-safety
- `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md` — push-segment optimization preserves multi-oracle parity (same canonical hex across operators; performance differs)
- `.claude/rules/all-complexity-is-accidental-in-greenfield.md` — IPushOperator IS the answer when materialize-batch becomes the bottleneck (proven only by Phase 4 benchmark)
- `.claude/rules/edge-defining-work-not-speculation.md` — segmented push-based DBSP is edge-defining work

## Composes with substrate

- 081KRW63S0008QG0R002KC5DSR / 081KRW63S0008QG0R002ZRNDJ8 / 081KRW63S0008QG0R002YAA09X / 081KRW63S0008QG0R001SAHYKV (Agora V6 substrate — push-pattern preserves operational primitives)
- 081KS3X9Y0008QG0R0010716X9 (incremental compiler host — push-pattern composes with codegen at segment boundaries)
- 081KS3X9Y0008QG0R003Y2X2T0 (PR #7 morsel-based execution — push-pattern + morsel-pattern together = full hot-path optimization)
- 081KS3X9Y0008QG0R000J4SFTS (PR #8 standing-query codegen — codegen emits push-segment-fused IL)
- 081KS3X9Y0008QG0R00323NSZA (ZetaParse — parser-substrate operators may benefit from push-pattern for streaming parse)
- PR #4558 (capability tags — IsPushable is sibling to IsLinear/IsBilinear/IsSink)
- PR #4560 (sink-terminality — sinks are segment-terminators by definition)
- PR #4566 (FusionEngine — Phase 2 extends it with push-segment detection)
- `src/Core/Fusion.fs` (existing FilterMap/Choose hand-fusion; push-pattern generalizes the principle)

## Why P2

Substantive architectural substrate; not blocking V1; high value (per-tick allocation floor escape unlocks meaningful throughput gains on hot pipelines); bounded by Otto-VSCode's 8-PR campaign sizing (~250 lines).

## Origin

Otto-VSCode 8-PR algebra-capability-system campaign 2026-05-21. Filed via Otto-CLI per Aaron-approved shadow* "file the 3 rows for PRs 6-8" instruction. Otto-VSCode owns the implementation; this row tracks the scope.
