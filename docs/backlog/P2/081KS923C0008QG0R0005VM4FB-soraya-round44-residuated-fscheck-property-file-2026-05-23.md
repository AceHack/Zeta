---
id: 081KS923C0008QG0R0005VM4FB
priority: P2
status: open
title: "Soraya round-44 hand-off — Residuated FsCheck property file (Galois + residual + retraction equivalence)"
created: 2026-05-23
last_updated: 2026-05-23
classification: buildable-now
decomposition: atomic
assignee: kenji
discovered_by: soraya
owners: [kenji, formal-verification-expert]
type: cross-check-gap
composes_with:
  - src/Core/Residuated.fs
  - tests/Tests.FSharp/Crdt/PNCounter.Tests.fs
  - docs/research/proof-tool-coverage.md
---

# 081KS923C0008QG0R0005VM4FB — Residuated FsCheck property file (round-44 hand-off)

## Origin

Soraya's third autonomous routing tick (2026-05-23 — round 44). Compound option (c+d): cross-check gap + publication-readiness on a genuine framework novelty.

## Finding

`src/Core/Residuated.fs` (129 LoC, `ResidualMax` IVM operator for O(log k) retraction of non-invertible aggregates like `max`) has **ZERO FsCheck properties**.

**Sanity-checked across CRDT/sketch family**: PNCounter, OrSet, Lww, GCounter, DeltaCrdt, Bloom, CountMin, Haar, HyperLogLog, HyperMinHash all have FsCheck tests. **Residuated.fs is the ONLY CRDT-class file with zero FsCheck coverage**.

Gap named in `docs/research/proof-tool-coverage.md` §5 since 2026-04-17; 30+ rounds open.

## Routing decision (Soraya)

Algebraic-law identity → **FsCheck primary** (mirrors `tests/Tests.FSharp/Crdt/PNCounter.Tests.fs` template). Three properties:

1. **Galois connection**: `a·x ≤ b ⇔ x ≤ a\b`
2. **Residual under max**: `a\b = b if a≤b else a`
3. **Retraction equivalence**: `ResidualMax(insert+retract trace) = max(positive-only trace)`

## Regression-guard urgency

Round-17 history: `Residuated.fs` previously advertised "O(1) amortised" retraction that was actually O(n) under adversarial retract-top. Harsh-critic caught it. Current `SortedSet` revision is the fix.

**Without a property test pinning the law, a future "perf optimization" can silently re-introduce the same correctness gap.** FsCheck IS the regression guard the round-17 incident asked for.

## TLA+-hammer guard

TLA+ was tempting (file carries internal state `SortedSet<'K>`). **REJECTED**: state is single-thread BST holding domain values; concurrency is at the circuit-runtime layer (covered by other specs). Property IS pointwise algebraic identity — FsCheck-shape, NOT TLC-shape. TLC would enumerate BST state space and time out.

## Acceptance criteria

1. New file `tests/Tests.FSharp/Algebra/Residuated.Tests.fs` mirroring `PNCounter.Tests.fs` shape
2. Three FsCheck properties covering Galois + residual + retraction equivalence
3. Tests wired into existing dotnet test gate — `tests/Tests.FSharp/Tests.FSharp.fsproj` uses explicit `<Compile Include="..." />` registration (96 entries; not glob-based), so the new file MUST be added to the `.fsproj` in the correct compile order alongside the other Crdt/Algebra entries; `dotnet test Zeta.sln -c Release` picks it up once registered
4. `proof-tool-coverage.md` §5 updated to mark Residuated FsCheck-covered

## Publication-readiness alignment

Per Soraya: "Residuated-lattice IVM is one of the framework's genuine novelties — citable if backed by a machine-checked property; currently ships with prose-only justification." SECOND publication-readiness gap alongside round-43 chain-rule.

## Effort

S (one evening). Assignee: kenji.

## Composes with

- [`src/Core/Residuated.fs`](../../../src/Core/Residuated.fs) — target needing FsCheck
- [`tests/Tests.FSharp/Crdt/PNCounter.Tests.fs`](../../../tests/Tests.FSharp/Crdt/PNCounter.Tests.fs) — template
- [`docs/research/proof-tool-coverage.md`](../../research/proof-tool-coverage.md) §5 — gap named since 2026-04-17
- `memory/soraya/NOTEBOOK.md` — Round 44 entry (pending NOTEBOOK update; locate by `## Round 44` heading once landed; pruned-preserved)
