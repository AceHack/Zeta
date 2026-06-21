# Trajectory — Cross-language interface codegen (GCF + specialize)

Status: **active — bookmarked, ready to build**
Last refreshed: 2026-06-21
Parent: `codegen-spread` (shares the IR substrate + emitter infra)

## Design principle

**GCF plus specialize** — not "least common denominator." Emit the richest shared structure
all 7 languages can express (the greatest common factor), plus per-language specializations
for what's unique (C# variance, Rust lifetimes, Go embedding, Q# functors).

## The interface stack to port (priority order)

| Interface | What | Cross-lang status | Variance |
|-----------|------|-------------------|----------|
| `ISemiring<T>` | Zero/One/Add/Mul/Negate | C# ✅, F# ✅, TS ✅ (via StarRing), Rust ✅, Go ✅ | invariant |
| `IStarRing<T>` | ISemiring + Conj (involution) | C# ✅, F# ✅, TS ✅, Rust ✅, Go ✅ | invariant |
| `IGroup<T>` | Zero/Add/Negate/Inverse | C# ✅, F# ✅ | invariant |
| `IMonoid<T>` | Combine + Identity (CRDT merge, fold) | C# ✅ | invariant |
| `ILattice<T>` | Join/Meet (semilattice, GSet/LWW) | C# partial | invariant |
| `IFunctor<F>` | Map (lift a function over a container) | — | **covariant (out T)** |
| `IMonad<M>` | Bind/Return (distribution, soft-value lift) | — | **covariant** |
| `ICodec<A,B>` | Encode/Decode pair (DynamicValue ↔ domain) | — | **A contra, B co** |
| `IPort<T>` | Hexagonal port (WorkspacePort, EventSink) | pattern exists, no interface | varies |
| `ITensor<T>` | Sparse/dense value-at-coordinate | C# ✅ | invariant |
| `WeakRef<T>` | The collection enabler (see below) | stdlib in all | **covariant** |

## Variance model (the C# richness to preserve)

| Concept | C# | TS | Rust | Go | F# | Python | Q# |
|---------|----|----|------|----|----|--------|-----|
| Covariance (`out T`) | `out T` | structural | `+ PhantomData` | implicit | natural | `TypeVar(covariant=True)` | `is Adj` |
| Contravariance (`in T`) | `in T` | structural | `- PhantomData` | implicit | natural | `TypeVar(contravariant=True)` | `is Ctl` |
| Default impl | default interface methods | mixin/prototype | trait defaults | embedding | module functions | ABC/mixin | — |
| Associated types | — | mapped types | `type Output` | generics | type params | `TypeAlias` | type params |
| Higher-kinded | not native (simulate) | not native | GATs | not native | native | not native | — |

## WeakReference as cogen = mix(mix,mix) collection enabler

The weak compiler reference pattern:
- **Strong ref** = "I own this, keep it alive" → classical lane (deterministic, always available)
- **Weak ref** = "I can reach this, but allow collection" → soft lane (derived, regenerable)

Connection to the gen(gen)=gen architecture:
- The **generator IS the ECC** — if derived code is collected, regenerate it on demand
- **generate the derivable, keep the irreducible** — WeakRef on generated code, StrongRef on IR
- `cogen = mix(mix,mix)` — the compiler-generator can reproduce any compiled artifact
- Collection = the GC deciding "this derivable artifact isn't hot, drop it"
- Regeneration = the generator re-specializing the IR when the artifact is needed again

This is `only-the-irreducible-is-primitive` applied to MEMORY MANAGEMENT:
- The IR (irreducible) stays alive (strong ref)
- The generated code (derivable) is weakly held (can be collected + regenerated)
- The generator (= ECC = cogen) is the mechanism that makes this safe

### Per-language WeakRef

| Language | Type | Finalization |
|----------|------|-------------|
| C# | `WeakReference<T>` | `ConditionalWeakTable`, GC tracks it |
| TS/JS | `WeakRef<T>` + `FinalizationRegistry` | V8 GC |
| Rust | `Weak<T>` (from `Arc`) | deterministic drop (no GC) |
| Go | `runtime.SetFinalizer` + manually nil-able | concurrent GC |
| F# | `System.WeakReference<'T>` | .NET GC |
| Python | `weakref.ref` | CPython refcount + cycle GC |
| Q# | N/A (quantum states aren't GC'd — measured or discarded) | unitary lifecycle |

## How this connects to the codegen

The interface codegen should emit:
1. **The interface definition** (GCF shape + variance annotations)
2. **Default implementations** (where the language supports it)
3. **A WeakRef-wrapped cache** for specialized/generated artifacts
4. **The regeneration path** (call the specializer on cache miss)

Pattern:
```
cache: WeakRef<SpecializedMix> = specialize(ir)
mix(x):
  if cache.deref() is Some(specialized):
    return specialized(x)  // fast path: already generated
  else:
    let fresh = specialize(ir)  // regenerate (the generator IS the ECC)
    cache = WeakRef(fresh)
    return fresh(x)
```

This is **lazy compilation + collection + regeneration** — the 1st Futamura projection
applied as a runtime strategy, not just a build-time tool.

## Next concrete steps

1. ~~Define `ISemiring<T>` / `IGroup<T>` / `IMonoid<T>` in TS (port from C# Abstractions)~~ ✅ #8890
2. ~~Add variance annotations (co/contra) to the IR interface-description schema~~ ✅ #8880
3. ~~Emit interface definitions in all 7 languages from one IR description~~ ✅ #8880
4. ~~Implement the WeakRef-wrapped specialization cache (TS first, then port)~~ ✅ #8892
5. ~~Wire into the soft-mix: first call specializes, subsequent calls use cache, GC can collect~~ ✅ #8895

## Status: CLOSED (2026-06-21)

All 5 steps complete. The interface stack exists in 4 compiled languages (TS/C#/Rust/Go),
the WeakRef cache is operational with no-error-caching safety, and it's wired into soft-mix.

### What's next (new trajectory: algebraic-codegen-capstone)
1. Self-hosting codegen — IR description of the codegen itself
2. Clifford lens emission — Cl3/multivectors from IR
3. Cross-lane cost-parity golden — DumpMachine entry-count = AmplitudeEmu.support

## Depends on

- `codegen-specialize.ts` (the 1st Futamura projection — already on main)
- `zeta-ir-v2` (the IR that describes the ops — already on main)
- `StarRing<T>` in all languages (already on main)
