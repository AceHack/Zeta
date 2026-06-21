---
id: 081KR50HA0008QG0R0021B5J87
priority: P1
status: closed
title: "F# Toffoli gate type model — Z-set assert/retract encoding with reversibility properties"
effort: S
created: 2026-05-09
last_updated: 2026-05-09
resolved: 2026-05-09
resolved_by: "PR #2333 feat(081KR50HA0008QG0R003T5MZAC): smallest safe slice — decompose + 081KR50HA0008QG0R0021B5J87 Toffoli gate F# model"
depends_on: []
parent: 081KR50HA0008QG0R003T5MZAC
classification: buildable-now
decomposition: atomic
owners: [architect]
type: feature
tags: [toffoli, reversible-computing, fsharp, zset, fscheck, landauer]
---

# 081KR50HA0008QG0R0021B5J87 — F# Toffoli gate type model

## What

Define a minimal F# type model of the Toffoli gate and its encoding of
Z-set operations. Prove logical reversibility via FsCheck properties.

No FPGA hardware required. This is the pure-software foundation that later
child rows (synthesis, measurement) will build on.

### Types to define

```fsharp
/// A single wire value in a reversible circuit
type Bit = Zero | One

/// The Toffoli gate: (a, b, c) → (a, b, c ⊕ (a ∧ b))
/// Universal reversible gate. Self-inverse.
type ToffoliInput = { A: Bit; B: Bit; Control: Bit }
type ToffoliOutput = { A: Bit; B: Bit; Target: Bit }

/// Z-set operation encoded as a Toffoli gate configuration
type ZSetOp = Assert | Retract

/// Map Z-set assert/retract to forward/reverse Toffoli
val toffoliForward  : ToffoliInput -> ToffoliOutput
val toffoliReverse  : ToffoliOutput -> ToffoliInput   // identical function — self-inverse
val encodeZSetOp    : ZSetOp -> ToffoliInput -> ToffoliOutput
```

### FsCheck properties

1. **Self-inverse**: `toffoliForward (toffoliForward x) = x` for all inputs
2. **Assert-retract identity**: applying Assert then Retract returns the original state
3. **No bit erasure**: output bit count equals input bit count (3-in → 3-out always)

## Pre-start checklist

- **Prior-art search**: No existing F# Toffoli gate model in `src/`. The Landauer
  math writeup at `docs/research/2026-05-09-zset-reversible-computing-landauer-bridge-math-writeup.md`
  proves the algebra; this child row provides the computational model.
- **Dependency restructure**: No `depends_on` needed; standalone.

## Acceptance criteria

- `dotnet build -c Release` passes with 0 warnings, 0 errors
- FsCheck properties in `tests/Tests.FSharp/Formal/ToffoliGate.Laws.Tests.fs` all pass
- Properties cover: self-inverse, assert-retract round-trip, bit conservation

## Resolution

Merged via PR #2333 (2026-05-09). Implementation:

- `src/Core/ToffoliGate.fs` — `Bit`, `ToffoliWires`, `ZSetGateOp`, `ToffoliGate` module
- `tests/Tests.FSharp/Formal/ToffoliGate.Laws.Tests.fs` — 7 tests: 4 FsCheck properties + 3 truth-table facts

Test outcome: **7/7 passed** (`dotnet test --filter ToffoliGate`, 346ms).
