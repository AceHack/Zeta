---
id: 081KS3X9Y0008QG0R000J4SFTS
priority: P2
status: open
title: Standing-query codegen — IIncrementalGenerator that rewrites circuit expressions to fused IL (Otto-VSCode 8-PR campaign PR #8 — the capstone)
tier: research-grade
effort: XL
ask: otto-vscode 2026-05-21 + aaron Rx-codegen-at-construction architectural insight (8-PR campaign capstone; aaron-approved via shadow* "file the 3 rows for PRs 6-8")
created: 2026-05-21
last_updated: 2026-05-21
depends_on: [081KS3X9Y0008QG0R001D454ZK, 081KS3X9Y0008QG0R003Y2X2T0]
composes_with: [081KRW63S0008QG0R002KC5DSR, 081KS3X9Y0008QG0R00323NSZA, 081KS3X9Y0008QG0R0010716X9]
tags: [standing-query-codegen, iincrementalgenerator, rewrite-circuit-expressions, fused-il, otto-vscode-pr-8, reaqtor-applied-to-dbsp, capstone, query-rewrite-across-rx-streams]
type: research
---

# Standing-query codegen — IIncrementalGenerator capstone

## Context

Otto-VSCode 8-PR algebra-capability-system campaign 2026-05-21 PR #8 — the capstone. Depends on PRs 1-7 substrate (capability tags + sink-terminality + checkBilinear + IncrementalAuto + FusionEngine + push-based + morsel-based).

Aaron's architectural insight 2026-05-21 (the unifying capstone framing): *"delayed rx queires here would be hot so you'd have to store the data somewhere but you could query reqwrite across mutiple rx streams that connect to do auto fustion with generation at construction time and pay the costs once per incrmental compile maybe"*.

This is the **Reaqtor architecture applied to DBSP**. Reaqtor / RxJS-codegen / Materialize / Feldera all do variants of this. The Zeta application: DBSP circuits as typed expression trees → rewrite + codegen at Circuit.Build() → emit hand-tuned IL → pay codegen cost once per incremental compile, zero per-tick scheduler overhead.

## The architectural problem (PR #8 closes the loop)

PRs 1-7 substrate gets you capability-aware fusion at the runtime layer:

- Capability tags identify what can fuse (PR #4558)
- FusionEngine rewrites the DAG into push-segments + morsel-segments (PR #4566 + 081KS3X9Y0008QG0R001D454ZK + 081KS3X9Y0008QG0R003Y2X2T0)
- IncrementalAuto dispatcher applies the right rewrite per operator capability (PR #4564)

But the FUSED OPERATORS still go through the virtual dispatch + Op<'T>.Value materialize/read boundaries at segment ends. The compiler doesn't see across operator-boundary calls; can't eliminate the segment-end allocation that PRs 1-7 leave behind.

## The codegen escape (full)

`IIncrementalGenerator` (Roslyn pattern + F# Type Provider) consumes the circuit expression tree at compile-time + emits:

- One generated method per circuit segment (push-segment OR morsel-segment OR mixed)
- Direct inlining across operator boundaries (no virtual dispatch; no Op<'T>.Value read)
- Stack-allocated intermediates (Span<T> all the way through; no heap alloc per tick)
- Codegen output IS the hot loop the JIT inlines into the scheduler

Per-incremental-compile cost: codegen runs ONCE when the circuit DAG changes (substrate edits). Per-tick cost: zero scheduler overhead because the hot loop IS generated code.

## Scope

### Phase 1 — Circuit expression-tree extraction

- Add `Op<'T>.ToExpressionTree(): CircuitExpr` method (or sibling pattern) that produces a typed expression tree representation of the operator + its inputs
- `CircuitExpr` discriminated union covers: Map(input, fn) | Filter(input, pred) | Join(left, right, combine) | Sink(input, sink) | Plus(left, right) | etc.
- Tree extraction is per-segment per FusionEngine (PR #4566)

### Phase 2 — IIncrementalGenerator integration (Roslyn side for C# circuits)

- Roslyn IIncrementalGenerator at a new directory (proposed: `tools/codegen/zeta-circuit-generator/` OR `src/Core.CSharp.Codegen/` — both are **TO BE CREATED** by this PR; neither exists today)
- Generator consumes `CircuitExpr` (serialized via attribute / additional-files / etc.)
- Emits C# code: one method per circuit segment, direct-call chains, Span<T> intermediates
- Generated code references existing `Op<'T>` substrate but bypasses virtual dispatch within segments

### Phase 3 — F# Type Provider integration (F# side for F# circuits)

- Type Provider at a new directory (proposed: `src/Core.FSharp.Codegen/` — **TO BE CREATED** by this PR; mirrors 081KS3X9Y0008QG0R00323NSZA ZetaParse Type Provider pattern)
- Consumes `.circuit` description files OR runtime `CircuitExpr` values
- Generates compile-time F# types + functions for circuit segments
- Composes with F# computation expressions (existing Zeta DBSP CE pattern)

### Phase 4 — Per-incremental-compile cost model

- Codegen runs on Circuit.Build() detect-change OR on file-system-watch of source files
- Generated artifacts cached by structural-hash of the CircuitExpr (per Roslyn IIncrementalGenerator caching pattern)
- Substrate change triggers minimal-subgraph recompile (per Roslyn incremental pattern)
- Per-tick cost: zero (generated code already loaded; JIT inlines it into scheduler hot loop)

### Phase 5 — Benchmark + validation (the empirical close)

- BenchmarkDotNet job at `bench/Benchmarks/StandingQueryCodegenBench.fs`:
  - Materialize-baseline (3-op chain)
  - Push-based (081KS3X9Y0008QG0R001D454ZK)
  - Morsel-based (081KS3X9Y0008QG0R003Y2X2T0)
  - Codegen-based (this row; THIS PR's win)

- Allocation: codegen expected to allocate 0× per-tick on hot path (Span<T> stack-allocated all the way)
- Throughput: expected codegen reaches near-rustc-level throughput for equivalent pipelines
- Per-incremental-compile cost: documented; should be sub-second for typical circuit changes

## Acceptance

### Phase 1

- `Op<'T>.ToExpressionTree` lands
- `CircuitExpr` covers Map/Filter/Join/Sink/Plus/Minus/Distinct (or whichever subset PRs 1-7 fuse)

### Phase 2

- Roslyn IIncrementalGenerator emits C# for one circuit segment
- Empirical: generated code compiles + runs + produces same output as virtual-dispatch baseline

### Phase 3

- F# Type Provider emits F# for one circuit segment
- Empirical: same cross-verify as Phase 2

### Phase 4

- Codegen runs incrementally (changed-segment only)
- Cache key = structural-hash of CircuitExpr

### Phase 5

- Benchmark validates 0× per-tick allocation on hot path
- Per-incremental-compile cost documented + acceptable
- Cross-verify: codegen output byte-for-byte matches materialize-baseline output

## Substrate-honest framing

This is **research-grade architectural substrate at the upper bound of Otto-VSCode's 8-PR campaign scope**. ~500+ lines per the original sizing estimate; realistically more. The capstone PR for the entire algebra-capability-system trajectory.

Aaron's Reaqtor-applied-to-DBSP insight is the unifying frame: capability tags (PR #4558) + sink-terminality (PR #4560) + checkBilinear (PR #4563) + IncrementalAuto (PR #4564) + FusionEngine (PR #4566) + push-based (081KS3X9Y0008QG0R001D454ZK) + morsel-based (081KS3X9Y0008QG0R003Y2X2T0) ALL feed into this PR's codegen step. The capability system isn't fully realized until codegen consumes the tags to emit optimal IL.

The pattern itself draws on substantial prior art:

- **Reaqtor** (Microsoft): standing-query Rx codegen + persistence
- **Materialize**: differential-dataflow + DBSP + compiled queries
- **Feldera**: DBSP + Rust-monomorphized compilation
- **Velox / Photon**: columnar query compilation
- **Roslyn IIncrementalGenerator**: incremental codegen pattern (BCL standard)
- **F# Type Providers**: compile-time types from external schemas (BCL standard)

The Zeta contribution is composing these into a unified standing-query codegen pipeline for the DBSP-substrate-engineering substrate.

## Composes with rules

- `.claude/rules/fsharp-anchor-dotnet-build-sanity-check.md` — codegen output must `dotnet build` clean
- `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md` — codegen output preserves canonical-hex byte-for-byte across all peer oracles
- `.claude/rules/edge-defining-work-not-speculation.md` — Reaqtor-applied-to-DBSP IS edge-defining work; reaches throughput tier above push + morsel
- `.claude/rules/largest-mechanizable-backlog-wins.md` — codegen mechanizes hot-loop generation at scale; classical hand-fusion doesn't

## Composes with substrate

- 081KRW63S0008QG0R002KC5DSR / 081KRW63S0008QG0R002ZRNDJ8 / 081KRW63S0008QG0R002YAA09X / 081KRW63S0008QG0R001SAHYKV (Agora V6 — codegen preserves operational primitives at segment scope)
- 081KS3X9Y0008QG0R0010716X9 (incremental compiler host — codegen IS the host's output substrate)
- 081KS3X9Y0008QG0R00323NSZA (ZetaParse — codegen Type Provider mirrors the ZetaParse Type Provider pattern)
- 081KS3X9Y0008QG0R001D454ZK (PR #6 push-based — codegen emits push-segment-fused IL)
- 081KS3X9Y0008QG0R003Y2X2T0 (PR #7 morsel-based — codegen emits morsel-segment-fused IL)
- PRs 1-5 substrate (capability tags + sink-terminality + checkBilinear + IncrementalAuto + FusionEngine — all consumed by codegen)
- Reaqtor / Materialize / Feldera / Velox / Photon (external prior art)

## Why P2

Substantive architectural substrate; the CAPSTONE PR for the 8-PR campaign; high value (closes the per-tick allocation floor that PRs 1-7 leave open); bounded by Otto-VSCode's 8-PR campaign sizing (~500+ lines; XL effort acknowledged).

## Why XL effort

5 phases each substantial:

- Phase 1 (expression-tree extraction): ~100 lines
- Phase 2 (Roslyn IIncrementalGenerator): ~150 lines + Roslyn ecosystem
- Phase 3 (F# Type Provider): ~150 lines + F# compiler integration
- Phase 4 (incremental-compile cost model): ~100 lines + caching layer
- Phase 5 (benchmark + cross-verify): ~100 lines + analysis doc

Total: ~600 lines + significant Roslyn / F# compiler ecosystem integration. Could split into multiple PRs at execution time.

## Origin

Otto-VSCode 8-PR algebra-capability-system campaign 2026-05-21 + Aaron's Rx-codegen-at-construction architectural insight from the same session. Filed via Otto-CLI per Aaron-approved shadow* "file the 3 rows for PRs 6-8" instruction.

The capstone framing: this row closes the loop the 8-PR campaign opened. Without it, PRs 1-7 deliver bounded optimization (allocation floor escape within segments; throughput improvement on hot pipelines); WITH it, the entire DBSP substrate becomes a compiled-once-per-circuit-change system reaching near-rustc-level per-tick performance.
