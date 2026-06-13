# ADR: Cross-Language DI Port & Scoped Lifetime Emulation

* **Status**: Draft / Proposed
* **Date**: 2026-06-13
* **Author**: Lior (structural synthesizer)
* **Task/Backlog Ref**: Primitive Registry (docs/PRIMITIVE-REGISTRY.md)

---

## Context & Problem Statement

To build scale-free, testable, and robust systems across our 6 consensus languages, we must establish a consistent strategy for dependency management and object lifetimes.

Rust manages object lifetimes at compile-time using strict lexical lifetimes (e.g., `MyStruct<'a>`). In contrast, our garbage-collected targets (F#, C#, TypeScript, Go, Python) do not have compile-time lifetimes; their memory is managed at runtime by GC sweeps.

To bridge this conceptual gap, we need a unified **Dependency Injection (DI)** model where GC-based languages **emulate Rust's compile-time lexical lifetimes using DI Scoped Lifetimes**.

---

## Proposed Design: Lifetime Mapping

We define a 1-to-1 mapping between Rust's compile-time lifetimes and GC-based DI container lifetimes:

| Rust Lifetime | GC DI Container Lifetime | Semantic Description |
| :--- | :--- | :--- |
| **`'static`** | **Singleton** | The object lives for the entire duration of the process. |
| **`'a` (Bound Scope)** | **Scoped** | The object is tied to a specific boundary context (e.g., a Request, Transaction, or Actor Session). Entering the scope instantiates the object; exiting/disposing the scope releases it. |
| **Short-Lived (Transient)** | **Transient** | A new instance is created every time it is requested. |

### Architectural Mapping across Runtimes

```
   [ Rust Lexical Lifetimes ]                [ GC DI Container Lifetimes ]
 -----------------------------              -------------------------------
   'static (Global)              =======>    Singleton Scope
   'a (Lexical/Reference Scope)  =======>    DI Scope (e.g., Transaction, Request)
   Transient / Owned             =======>    Transient Scope (Fresh instance per resolve)
```

#### 1. Rust Target: Pure Structural Dependency Wiring

- Rust does not need a runtime DI container. Instead, we use **Constructor Injection** combined with explicit **Lexical Lifetimes** (`'a`) to guarantee at compile-time that a child dependency never outlives its parent scope.
- Global singletons are represented using `'static` references or thread-safe once-cell initializers (`lazy_static`, `OnceLock`).

#### 2. F# & C# Target: `Microsoft.Extensions.DependencyInjection`

- We use the standard .NET DI abstractions (`IServiceCollection` and `IServiceProvider`).
- Scoped lifetimes are managed via `IServiceScope`. Entering a scope (e.g. `using var scope = provider.CreateScope()`) mimics entering a Rust block scope. Exiting the `using` block disposes all resolved scoped services, freeing memory.

#### 3. TypeScript Target: Mapped Scope Containers

- In JS/TS, we implement a lightweight DI registry supporting Singleton, Scoped, and Transient lifetimes.
- Scopes are managed using explicit context managers:
  ```typescript
  class DiScope {
      private instances = new Map<symbol, any>();
      resolve<T>(token: symbol): T { ... }
      dispose(): void { this.instances.clear(); }
  }
  ```
  This creates a predictable boundary mimicking Rust’s scope constraints.

#### 4. Python Target: Context-Managed Containers

- In Python, we define a DI container that integrates with python’s context managers (`with` blocks):
  ```python
  with container.scope() as scoped_services:
      db_connection = scoped_services.resolve(DbConnection)
      # exiting the block triggers database connection teardown
  ```

#### 5. Go Target: Context-Bounded Lifetimes

- Go manages scope lifetimes by carrying request-scoped or transaction-scoped states inside the standard `context.Context` parameter, combined with factory function injection.
- When the context is cancelled, cleanup hooks are executed, simulating the cleanup of a Rust scope.

---

## Consequences

* **Pros**:
  * **Unified Architectural Model**: Developers can reason about lifetimes identically across all 6 targets (e.g. "this database pool has a Singleton lifetime, and this transaction buffer has a Scoped lifetime").
  * **Leak Prevention**: Associating resource disposal with DI scope exit ensures all allocated memory is GC-reclaimed, matching Rust's RAII (Resource Acquisition Is Initialization) safety.
  * **Test Isolation**: Mocking and overriding dependencies during integration testing is consistent across all targets by replacing DI registrations.
* **Cons**:
  * **Runtime Overhead in GC Languages**: DI container resolution and scope creation introduce minor runtime allocations in GC languages, whereas Rust's lifetime assertions are 100% free at runtime.
