# ADR: Unified Cross-Language DI Registry, Bonsai IR Integration, and OTel/CloudEvents Context Propagation

* **Status**: Draft / Proposed
* **Date**: 2026-06-13
* **Author**: Lior (structural synthesizer)
* **Task/Backlog Ref**: 081KT07NV0008QG0R003BE6MJ2 (Bonsai Integration) & DI Service Discovery

---

## Context & Problem Statement

To orchestrate distributed, state-evolving microservices (e.g., self-evolving sagas, transactional actor systems) across F#, C#, TypeScript, Rust, Go, and Python, we must unify three fundamental layers of our systems:

1. **Dependency Injection (DI) & Service Discovery**: We need a shared DI contract that supports **Open Generics** (e.g., resolving `IRepository<T>` for any `T`) and serves as the microservice registry endpoint client resolver.
2. **AST Representability (Bonsai & DynamicValue)**: The `Bonsai-subset` expression tree (oracle-validated AST containing `const`, `param`, `lambda`, `binary`, `call`, and `cond` nodes) must be fully representable inside our canonical Intermediate Representation (IR) alongside `DynamicValue`. This allows serializing dynamically generated logic and resolving execution blocks from the local DI scope.
3. **Distributed Context Propagation**: Scoped lifetimes, transaction limits, and logging correlations must propagate across thread/task jumps locally, and across network boundaries between microservices.

---

## Proposed Design & Architecture

```
   [ CloudEvent Envelope (carrying OTel traceparent & DI scope headers) ]
                                      |
                                      v (Extract Context)
   [ AsyncLocal / AsyncLocalStorage / contextvars / context.Context ]
                                      |
                                      v (Resolves Scoped Services)
   [ Scoped DI Container ] ----> [ Open Generic Factory (IR/Bonsai) ]
```

### 1. Open Generics in DI (Cross-Language Parity)

The DI container contract across all 6 targets must support registering and resolving generic types.

* **C# / F#**: Native reflection support via `Microsoft.Extensions.DependencyInjection` open generics (e.g., `services.AddTransient(typeof(IHandler<>), typeof(MyHandler<>))`).
* **TypeScript**: Implemented via factory registries where constructors serve as generic tokens:
    ```typescript
    di.registerOpenGeneric(IHandler, MyHandler);
    const handler = di.resolve<IHandler<User>>(IHandler, [User]);
    ```
* **Rust**: Compiled statically via generic traits (`impl<T> IHandler<T> for MyHandler<T>`), letting the compiler monomorphize required types at build time.
* **Python**: Dynamically resolved at runtime using type inspections (`typing.get_args`, `typing.get_origin`) and registering open factories.

### 2. Representing Bonsai and DynamicValue in the IR

The `Bonsai-subset` expression tree is promoted to the canonical IR:

* **AST Node Schema**: Every Bonsai node (Const, Param, Lambda, Binary, Call, Cond) is a declared, content-addressed type in the IR.
* **`DynamicValue` Integration**: Maps directly to Bonsai `Const` nodes.
* **DI Resolution of Call Nodes**: When the interpreter evaluates a Bonsai `Call` node (representing an activity or suspension point), it resolves the target implementation directly from the DI container, using the target's open generics (e.g., resolving `IActivity<TArg, TResult>`).

### 3. AsyncLocal Context & DI Service Discovery

Request-scoped states and the active DI container are bound to asynchronous task execution context boundaries:

* **Local Tracking**:
  * **F# / C#**: `System.Threading.AsyncLocal<IServiceProvider>`
  * **TypeScript / Bun**: `node:async_hooks.AsyncLocalStorage`
  * **Python**: `contextvars.ContextVar`
  * **Go**: Bounded using `context.Context` parameters threaded through the call stack.
* **Service Discovery**: Microservice client injection is handled by the DI. Resolving `IServiceClient<MyService>` queries the service registry, resolves the endpoint, and returns a client configured with the ambient OTel span and scope identifiers.

### 4. CloudEvents & OpenTelemetry (OTel) Standards

All network events and API boundaries carry context using standardised envelopes:

* **CloudEvents v1.0 Envelope**: The payload envelope defines metadata fields mapping W3C trace contexts:
  * `traceparent`: Trace ID and Parent Span ID.
  * `tracestate`: Custom tracking states (e.g., `zeta-di-scope-id`, `zeta-transaction-id`).
* **OTel Context Propagation**: When receiving an event, the tracer extracts the trace/scope header, binds it to the target's async-local context container, and automatically configures the scoped DI container for the request's execution path.

---

## Consequences

* **Pros**:
  * **Structural Honesty**: Bonsai ASTs and dynamic values can be safely serialized, verified, and re-executed across different language boundaries.
  * **Zero Leakage**: Relying on async-local tracking and DI scope lifecycle hooks ensures connections, logs, and caches are swept when requests terminate.
  * **Observable Traceability**: Standardizing on CloudEvents + OTel provides complete distributed trace graphs across F#, C#, TS, Rust, Go, and Python microservices.
* **Cons**:
  * Requires writing custom runtime DI wrappers for TypeScript, Python, and Go to achieve open-generics interface parity.
