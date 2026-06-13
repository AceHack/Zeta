# ADR: GC-Safe Mixin State via Weak-Keyed Tables

* **Status**: Draft / Proposed
* **Date**: 2026-06-13
* **Author**: Lior (structural synthesizer)
* **Task/Backlog Ref**: Primitive Registry (docs/PRIMITIVE-REGISTRY.md)

---

## Context & Problem Statement

When building extensible pipelines (such as plugins, caching decorators, transaction contexts, or telemetry trackers), we often need to associate dynamic or external state with core domain instances (like `ZetaId` values, observations, or IR nodes) without polluting their underlying schemas or class signatures.

If we use a standard `Map` or `Dictionary` to track this mapping, the dictionary maintains a **strong reference** to the core instance (the key). This prevents the key from being garbage-collected, creating severe memory leaks (often called the *lapsed-listener problem* or *plugin pinning*). In environments like .NET where we load and unload dynamic assemblies using collectible `AssemblyLoadContext` bounds, a single pinned reference will prevent the entire plugin assembly from unloading, leading to Out Of Memory (OOM) failures.

---

## Proposed Design: 6-Language Weak Mixin Pattern

We will standardize on a decoupled, GC-safe "mixin" pattern where attached states are tracked via weak-keyed identity tables. The key's lifetime strictly governs the value's lifetime, ensuring automatic garbage collection when the target object is released.

```
+-------------------------------------------------------+
|  Host Application / Plugin (External State Mixin)    |
+-------------------------------------------------------+
                           |
                           v (Weak Reference Key)
+-------------------------------------------------------+
|  Core Domain Instance / Interface (e.g., ZetaId Node) |
+-------------------------------------------------------+
```

### Target Runtime Implementations

We define the idiomatic equivalent for each of Zeta's target runtimes:

#### 1. F# & C# Target: `ConditionalWeakTable`

- **Mechanism**: `System.Runtime.CompilerServices.ConditionalWeakTable<TKey, TValue>`.
- **Properties**: Threads-safe, lock-free, and handles object identity mapping natively.
- **Example**:
  ```csharp
  private static readonly ConditionalWeakTable<IZetaId, ExtendedState> _stateCache = new();

  public static ExtendedState GetState(this IZetaId node)
  {
      return _stateCache.GetValue(node, k => new ExtendedState());
  }
  ```

#### 2. TypeScript Target: `WeakMap`

- **Mechanism**: ECMAScript native `WeakMap<TKey, TValue>`.
- **Properties**: Key must be an object reference. Garbage collection of the key immediately schedules the value for reclamation.
- **Example**:
  ```typescript
  const stateCache = new WeakMap<object, ExtendedState>();
  ```

#### 3. Python Target: `WeakKeyDictionary`

- **Mechanism**: `weakref.WeakKeyDictionary`.
- **Properties**: Keys must be weakly-referenceable objects. When a key is collected, its dictionary entry is automatically discarded.
- **Example**:
  ```python
  import weakref
  state_cache = weakref.WeakKeyDictionary()
  ```

#### 4. Rust Target: Lifetimes, NewTypes, and ID-Keyed Maps

- **Mechanism**: Since Rust does not have a garbage collector, memory leaks are prevented structurally. We handle mixin states using one of two strategies:
  1. **NewType Wrappers** (`struct MixinObservation(ZetaObservation, ExtendedState)`): Enforces explicit compile-time state tracking.
  2. **Weak-Reference Map** (`Weak<TKey>`): In multi-threaded shared scenarios, we map `ZetaId` keys or weak pointers (`std::sync::Weak<TKey>`) to values, using periodic cleanup sweeps or explicit lifetime boundaries.

#### 5. Go Target: `weak.Pointer` & Finalizers

- **Mechanism**: Native `weak.Pointer` (Go 1.24+).
- **Properties**: Provides a way to store pointers weakly. Can be combined with `runtime.SetFinalizer` or safe wrappers to prune dead cache entries.

---

## Consequences

* **Pros**:
  * **GC-Safe Lifecycle**: Decoupled state has zero effect on GC anchoring. Reclaiming the object automatically cleans up the cache/mixin values.
  * **Unload Safety**: Essential for plugin assemblies. Collectible `AssemblyLoadContext` instances can unload cleanly because they are not pinned by host-level static dictionaries.
  * **Encapsulation**: Keeps core data plane types lightweight and ASCII-clean, avoiding bloated structures.
* **Cons**:
  * **Identity Dependency**: Weak maps require object identity (reference types). Value types (such as raw primitives) cannot act as keys in `WeakMap` or `ConditionalWeakTable` without boxing.
  * **Inspectability**: Weak table values are invisible during standard debugger walks. (Must be mitigated by writing explicit `[DebuggerTypeProxy]` definitions in C#/F#).
