# Soft-lane codegen: numeric interface requirements

**Status:** DESIGN. **Owner:** Alexa. **Date:** 2026-06-20.
**Dependency:** The generated soft-lane code must use the project's `IStarRing` numeric algebra, not ad-hoc inline arithmetic.

## The interface stack

The F# source of truth (`src/Core/CayleyDickson.fs` + `src/Core/Semiring.fs`):

```
IStarRing<'A> = ISemiring (Zero, One, Add, Mul, Negate) + Conj
```

Pre-computed instances via Cayley-Dickson doubling:
- `Real.algebra : IStarRing<float>`
- `ImaginaryStack.complex : IStarRing<Complex>` (= `Doubled.algebra Real.algebra`)
- `ImaginaryStack.quaternion : IStarRing<Quaternion>` (= `Doubled.algebra complex`)
- `ImaginaryStack.octonion : IStarRing<Octonion>` (= `Doubled.algebra quaternion`)

The soft lanes use these via:
- `WSet.consolidate ring isZero` — merge with interference (ring.Add on same-key weights)
- `WSet.apply ring op` — linear operator (ring.Mul for weight propagation)

## Per-language requirements

| Language | Interface exists? | What to emit |
|----------|-------------------|-------------|
| F# | ✅ `IStarRing<'A>` native | Import `Zeta.Core.ImaginaryStack.complex` |
| C# | ✅ `IStarRing<T>` in Core.Abstractions | Import from assembly |
| TS | ⚠️ Inline in test (not a proper interface yet) | Define minimal `StarRing<T>` interface + complex instance |
| Rust | ❌ Not yet | Define `trait StarRing { zero, one, add, mul, neg, conj }` |
| Python | ❌ Not yet (uses stdlib `complex`) | Use `complex` builtin + define `star_ring` protocol |
| Go | ❌ Not yet | Define `StarRing` interface + `Complex128` wrapper |
| Q# | ⚠️ Q# has `Complex` in Math namespace | Use `Microsoft.Quantum.Math.Complex` |

## The gen shape

The soft-lane codegen should emit code shaped like:

```
// Given: ring = the IStarRing instance for the weight type
// Given: ensemble = list of (state, weight) pairs
// For each IR op:
//   new_ensemble = ensemble.map(frame => (applyOp(frame.state), frame.weight))
//   ensemble = consolidate(ring, new_ensemble)  // merge same-state, ring.Add weights
```

This is `WSet.apply` + `WSet.consolidate` — the SAME code regardless of whether the ring is:
- `Real.algebra` → Bayesian (real weights, no cancel on positive)
- `ImaginaryStack.complex` → Quantum (complex amplitudes, interference/cancel)
- `ImaginaryStack.quaternion` → Future (quaternion weights, non-commutative)

## What this means for the codegen

The emitter doesn't need to know WHICH ring — it emits the generic fold + consolidate pattern. The ring instance is injected (DI). For the golden-vector check, we instantiate with `complex` (soft-quantum) or `real` (soft-bayesian) and verify identical output on basis states.

## Next steps

1. Define `StarRing<T>` interface in TS (port of `IStarRing<'A>`)
2. Implement complex instance
3. Update soft-lane TS emitter to use it
4. Repeat for Rust/Python/Go (trait/protocol/interface)
5. The generated code is then ring-generic — same template, swap the ring instance
