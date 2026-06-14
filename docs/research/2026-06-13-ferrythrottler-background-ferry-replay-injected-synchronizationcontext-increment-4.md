# FerryThrottler background-ferry replay via an injected `SynchronizationContext` (Option-A increment 4)

**Date:** 2026-06-13 · **Author:** Otto (shadow) · **Status:** design sketch / target
**Lineage:** Option-A async-context-threading roadmap (increments 1–3 landed: #8094 / #8097 / #8098).
This is the documented "remaining piece."

## The problem, stated precisely

The `FerryThrottler` is **self-clocked, anti-Nagle** — it adds *no artificial
timer or delay* (top doc comment; Van Jacobson ACK-clocking, 1988). So, unlike
most batching machinery, **there is no wall-clock to virtualize** for DST. The
only source of nondeterminism in the *background* path is the **task scheduling
of the ferry loops themselves**:

```fsharp
let runFerry () : Task = backgroundTask { … await reader.WaitToReadAsync ct … }
let ferryTasks = if isManual then [||] else Array.init ferries (fun _ -> runFerry ())
```

`backgroundTask { }` deliberately runs on the **threadpool with no captured
context** (it strips `SynchronizationContext`). Consequences:

- **DoP=N:** the interleaving of the N ferries draining one channel is decided by
  the threadpool — nondeterministic, not replayable.
- **DoP=1:** even the single ferry's drain timing *relative to the producer's
  enqueues* is threadpool-dependent — so batch boundaries (which items ride which
  boat) are not replayable.

Increment-1–3 work (`ContextualFerryThrottler`, capture-at-boundary, result
arity) threaded the **caller's** context as data through the queue. The DST seam
that shipped (Option B, `?manual` + `PumpToIdleAsync`, #8084) sidesteps the
problem by spawning **no** background ferry — the caller pumps synchronously on
its own flow. That is fully deterministic but it is **not the background path**:
you must *choose* manual mode to get determinism.

**Increment 4 goal:** make the *background* path itself replayable, so DST does
not require giving up the production code path.

## Why `SynchronizationContext`, not `TaskScheduler`

A `TaskScheduler` injected at `Task.Factory.StartNew` only controls where the
*initial synchronous segment* of the ferry runs. The ferry's nondeterminism is
in its **`await` continuations** (`WaitToReadAsync` completing when an item is
written; `processBatch` completing). Continuation routing in .NET is governed by
the ambient `SynchronizationContext` (the `ConfigureAwait(true)` default that
F#'s `task { }` honours). So the correct seam is a `SynchronizationContext`:

- Run each ferry **under an injected `SynchronizationContext`**. Every `await` in
  the loop then `Post`s its continuation back to that context.
- A **deterministic, single-threaded, pumpable** context runs those `Post`ed
  continuations in **FIFO order** — so N ferries draining one channel interleave
  in a fixed, seed-independent, replayable order, driven by the test/sim that
  pumps the context.
- This is the "SynchronizationContext game" + the Itron thread-context capture
  the maintainer named (2026-06-13): *"we likely do want to play the
  synchronizationcontext game … in my itron version I do captures of thread
  context so I can pass it through."*

This is the **noninterference discipline** (manifesto §13 / discipline #7) made
concrete for the ferry: entropy/scheduling enters **only through the injected
context** (a declared, metered door), never the ambient threadpool. Default =
no context injected = today's `backgroundTask`/threadpool path, **byte-identical
for production** and fully reversible (§15).

## The seam (4a — minimal, prod-preserving)

Single additive optional ctor arg on `FerryThrottler<'TItem>` (and later the
result + contextual arities):

```fsharp
?syncContext: SynchronizationContext
```

- **None (default):** `runFerry` uses `backgroundTask { }` exactly as today.
  Production is untouched; the existing test suite is untouched.
- **Some sc:** the ferry runs *under* `sc` — the loop body is the **same**
  `fillBoat`-driven code (single source of boat-building truth preserved), but
  started so that `SynchronizationContext.SetSynchronizationContext sc` is in
  effect on the ferry's execution flow (off the ctor thread — never pollute the
  constructing thread's context), so awaits capture `sc`.

`PumpToIdleAsync` / `?manual` stay exactly as-is — Option B remains the
zero-dependency DST path; the injected context is the *additional* path that
makes the **background** ferries replayable.

### What 4a proves (a true, narrow claim — not over-stated)

A focused test with a deterministic pumpable `SynchronizationContext` (test
scaffolding) proves: **with `syncContext` injected, the background ferry's `await`
continuations are routed to that context and run only when it is pumped** — i.e.
the background ferry's scheduling is now under the injected door, not the
threadpool. This is the load-bearing mechanism; it is *not yet* the full
"N-ferry deterministic replay across a seeded run" claim.

## 4b — LANDED

- **Full N-ferry deterministic-interleaving replay**: `replayScenario` runs a fixed
  interleaved (enqueue, pump) sequence twice at DoP=2 and DoP=3 and asserts the boat
  composition (which items ride which boat, in order) is **identical across runs** —
  the replay claim — plus item conservation. Done.
- **Deterministic context promoted into Core** as the earned sim primitive
  `src/Core/DeterministicSyncContext.fs` (class state = the simulated scheduler's
  run-queue; earned under the DST + injected-`SynchronizationContext` boundary per
  `interfaces-free-classes-earned-under-rules`). Lock-free (`ConcurrentQueue` +
  `Interlocked`, discipline #2). The test file now consumes the Core type.
- **`?syncContext` wired through** the result arity (`FerryThrottler<'TItem,'TResult>`)
  and both contextual wrappers (`ContextualFerryThrottler` /
  `ContextualResultFerryThrottler`), forwarding to the composed core throttler.
- **One launch seam for every arity**: `FerryLaunch.launch` (None → threadpool
  `Task.Run`; Some → `Post` the whole ferry onto the context). Single source of
  launch truth.

### Deadlock caught + fixed during 4b (worth recording)

The pump must own the thread's `SynchronizationContext` for the pump's *duration*
and restore it after. The first cut set the context inside the launch callback
without restoring it, leaking it onto the pump/caller thread — the caller's own
later `await`s then captured the (now-idle) context and deadlocked. Fix:
`PumpToIdle` installs itself as current with a `try/finally` restore (the standard
message-pump contract); the launcher touches no thread's context. Tests would hang
silently (no output) — caught via `--blame-hang-timeout`.

## Anchors (Beacon)

- **Self-clocking:** Van Jacobson, *Congestion Avoidance and Control* (SIGCOMM
  1988) — ACK-clocking, the reason there is no timer to virtualize here.
- **Single-thread deterministic replay:** Zhou et al., *FoundationDB* (SIGMOD
  2021); Will Wilson, *Testing Distributed Systems w/ Deterministic Simulation*
  (Strange Loop 2014).
- **Noninterference:** Goguen & Meseguer, *Security Policies and Security Models*
  (1982) — entropy only through declared, metered channels.
- **Thread-context capture (human anchor):** the maintainer's Itron
  `Platform.Capability/.../Util/AsyncState.cs` (`Lazy<AsyncLocal<T>>` carrier)
  and `Platform.DotNet` `Threading.Tasks.Throttling`.
- **The explicit-Arrow alternative to ambient capture:** `IntrCtx.ISR<'A,'B>`,
  `Traced.withCtx`, and `Tracing.fs`'s "grubby hidden side channel" note — why
  context travels as data, with the injected `SynchronizationContext` as the
  *one* sanctioned BCL door for await-continuation routing.

## Pointers

- `src/Core/FerryThrottler.fs` — the seam site (`runFerry`, `ferryTasks`,
  `?manual`, `PumpToIdleAsync`).
- `memory/project_option_a_async_context_threading_roadmap_ferrythrottler_2026_06_13.md`
  — the roadmap this closes.
- `.claude/rules/async-all-the-way-truthful-signatures.md` ·
  `.claude/rules/dv2-data-split-discipline-activated.md` (#7 noninterference).
