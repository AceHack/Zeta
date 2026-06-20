# Cross-check: ZSetISA.qs ↔ AmplitudeEmu.fs

**Date:** 2026-06-19 · **By:** Alexa · **Status:** VERIFIED — alignment confirmed, gaps documented

## Purpose

Verify that the six Q# Z-set ISA operators (`src/Core.QSharp.ReferenceOracle/ZSetISA.qs`) are
semantically aligned with the F# amplitude emulator (`src/Core/AmplitudeEmu.fs`) — the classical-lane
reference implementation that uses complex amplitudes to achieve interference without quantum hardware.

## Operator-by-operator alignment

| # | Q# Op | Q# Impl | F# Equivalent | Match | Notes |
|---|--------|---------|---------------|-------|-------|
| 1 | **EMIT(k)** | `Ry(θ, k)` | `pure1 f` / amplitude injection | ✅ | Both inject weight into a key's amplitude slot |
| 2 | **RETRACT(k)** | `Adjoint Emit(k, θ)` | *(implicit via composition)* | ✅⚠️ | F# has no named retract; relies on `merge` cancellation (opposite-phase amplitudes). Q# makes it explicit as `Adj`. Semantically equivalent: `EMIT∘RETRACT = I` ↔ summing `+z` and `-z` → 0 → dropped by `magSq ≤ EPS` |
| 3 | **BRANCH(k)** | `H(k)` | `softStep` → `forkOnInput` | ✅ | Both create superposition (multiple branches coexist). F# forks via classical branching with `√p` amplitudes; Q# uses Hadamard. Same ensemble-widening semantics |
| 4 | **JOIN(a,b)** | `CNOT(a, b)` / `Controlled Ry` | *(implicit via ensemble composition)* | ✅⚠️ | F# correlates keys via frame-tuple identity (same frame = correlated). Q# uses entanglement gates. Both produce coupled streams; F# does it positionally rather than gate-wise |
| 5 | **MERGE(a,b)** | `sourceA(target); sourceB(target)` | `merge : Amp → Amp` | ✅ | **Perfect structural match.** Both sum amplitudes of identical frames/basis-states. Phase cancellation (destructive) and reinforcement (constructive) fall out identically. `magSq ≤ EPS → drop` = interference |
| 6 | **FOLD(sources)** | `for source in sources { source(target) }` | `softStep` (collect + merge) | ✅ | Repeated MERGE. F#'s `softStep` is one-tick FOLD: fork-all then merge. Same reduction semantics |

## Key invariants confirmed

1. **MERGE/FOLD = superposition-merge, NOT measurement.** Both implementations sum amplitudes without
   collapsing to classical. Q# never calls `M` inside MERGE/FOLD. F# `merge` returns `Amp` (still soft).
2. **Born collapse is sim-only.** Q#: `M` only in `VerifyIdentity` (test entrypoint). F#: `bornProb`/`measure`
   are terminal — called externally, never inside the algebra.
3. **EMIT∘RETRACT = I.** Q#: verified in `VerifyIdentity` (Ry then Adjoint Ry → Zero). F#: `merge`
   of `+z` and `-z` → cancellation → empty list.
4. **No decoherence on live path.** Neither implementation forces global collapse.

## Gaps (by design, not bugs)

- **F# has no named RETRACT/JOIN ops** — it's an *emulator* (ensemble over frames), not a gate-level ISA.
  The semantics emerge from amplitude arithmetic rather than named gate composition.
- **Q# MERGE/FOLD take operation-typed args** (lambdas that prepare state), while F# `merge` operates
  on an already-constructed `Amp` list. This is a representation difference, not a semantic one.
- **Scaling boundary:** F# explicitly documents the `4ⁿ` support wall. Q# inherits it from the quantum
  substrate (exponential state space is the hardware cost). The tick-horizon bound applies to both.

## Conclusion

The six Q# operators are **correct per the build spec** and **semantically aligned with the F# reference**.
The two implementations express the same algebra through different substrates (quantum gates vs complex-amplitude
ensembles). No corrections needed.
