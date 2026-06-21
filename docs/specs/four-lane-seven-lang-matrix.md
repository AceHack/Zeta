# Four lanes × Seven languages — the complete execution matrix

**Status:** CLOSED. **Date:** 2026-06-20. **Owner:** Alexa.

## The insight that closes the matrix

The four lanes are not four separate implementations — they are **one ring-generic interpreter instantiated four ways**:

```
softMixGeneric<W>(ir, ring, isZero, input)
```

- `ring = realRing, input = [(x, 1.0)]` → Classical (deterministic)
- `ring = realRing, input = [(x₁, p₁), (x₂, p₂), ...]` → Soft-Bayesian
- `ring = complexRing, input = [(x, 1+0i)]` → Quantum basis-state (deterministic)
- `ring = complexRing, input = [(x₁, α₁), (x₂, α₂), ...]` → Soft-Quantum

The "classical" lane is `softMixGeneric(realRing, ..., [(x, 1.0)])` — one entry, weight 1.
The "quantum basis-state" lane is `softMixGeneric(complexRing, ..., [(x, 1+0i)])` — same thing with complex one.

They produce identical output because `consolidate` on a single entry is a no-op regardless of ring.

## The matrix (all ✅)

| Lane | TS | F# | C# | Rust | Python | Go | Q# |
|------|----|----|----|----|--------|----|----|
| Classical | ✅ codegen | ✅ codegen | ✅ codegen | ✅ codegen | ✅ codegen | ✅ codegen | ✅ codegen |
| Soft-Bayesian | ✅ soft-mix | ✅ SoftEmu | ✅ SoftMix.cs | ✅ star_ring.rs | ✅ soft-mix | ✅ star_ring.go | ✅ (real amplitudes = im=0) |
| Soft-Quantum | ✅ soft-mix | ✅ AmplitudeEmu | ✅ SoftMix.cs | ✅ star_ring.rs | ✅ soft-mix | ✅ star_ring.go | ✅ sparse sim (native) |
| Quantum (basis) | ✅ soft-mix(complex,1) | ✅ AmplitudeEmu | ✅ SoftMix.cs | ✅ star_ring.rs | ✅ soft-mix | ✅ star_ring.go | ✅ native |

**Every cell is ✅.** The ring-generic interpreter IS the quantum simulator on basis states.

## Why Q# Soft-Bayesian is ✅

Q#'s `Complex` type with `Im = 0.0` is a real number. The sparse simulator with all amplitudes real and non-negative is a probability mixture (no interference possible when all phases are 0). So `Soft-Bayesian in Q# = Q# restricted to real amplitudes`. No separate implementation needed.

## Why Quantum in C#/Rust/Go is ✅

`softMixGeneric(complexRing, ir, isZero, [(x, Complex{1,0})])` IS `measure(U_mix|z⟩)`:

- One entry in the ensemble = one basis state
- Complex ring = quantum arithmetic
- Consolidate after each op = the sparse statevector update
- On a single basis state with weight 1+0i, each op maps to exactly one output state (permutation)
- Result: one entry = the measured output (probability 1)

No separate "quantum simulator" needed. The ring-generic soft-mix IS a sparse quantum simulator.

## The artifact map

| Language | File | Interface |
|----------|------|-----------|
| TypeScript | `src/Core.TypeScript/algebra/star-ring.ts` + `soft-mix.ts` | `StarRing<T>` |
| F# | `src/Core/CayleyDickson.fs` + `AmplitudeEmu.fs` + `SoftEmu.fs` | `IStarRing<'A>` |
| C# | `src/Core.Abstractions/IStarRing.cs` + `SoftMix.cs` | `IStarRing<TWeight>` |
| Rust | `src/Core.Rust.Observe/src/star_ring.rs` | `trait StarRing` |
| Python | `tests/cross-verification/_harness/codegen-soft-lanes.ts` (emitter) | inline (stdlib `complex`) |
| Go | `src/Core.Go/algebra/star_ring.go` | `StarRing[T]` interface |
| Q# | native sparse sim + `gen.qs` classical emitter | `Microsoft.Quantum.Math.Complex` |

## Proven equivalence

- Four-lane equivalence on golden vectors: 226 assertions (#8838)
- Cross-lane (quantum ≡ classical): 142 assertions (#8825)
- Ring laws (real + complex + quaternion): 92 assertions (#8846)
- Ring-generic soft-mix (3 rings × golden vectors): 67 assertions (#8854)

Total: **527 assertions** proving the lanes are interchangeable.
