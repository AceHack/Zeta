# Weak references for observer-dependent refs: GC-safe RX/mumps — what-acts weak-refs what-remains, lazy-load + push-down-cache per cell closure

**Register:** [grounded] memory-management design (Aaron) + [synthesis]. **Date:** 2026-06-09.
**Captured by:** Otto (shadow). The GC discipline for the mumps-DI-RX substrate.

## Aaron's words

> "we use weak references to simulate observer-dependent references on any type — even
> external — in mumps, that's garbage-collection-safe even for our RX 2×2. we already have
> this pattern in code for subscribe safety at the global static level too — for what-acts to
> not leak memory for stuff anchored to what-remains, and only lazily load it and push-down
> cache what's needed for its own closure as a cell."

## The pattern: weak references = observer-dependent lifetime, GC-safe

A reference held *because* something is observing it should live **only as long as the
observer** — then be collectible. Use **weak references** so:

- **observer-dependent refs on ANY type (even external).** A subscription / observation holds
  a **weak** ref to its target; when the observer is gone, the GC can reclaim the target — no
  manual teardown required, no leak. Works for types we don't own (external) — the weak ref
  wraps them without modifying them.
- **GC-safe even for the RX 2×2.** The remember×pay-attention observer cube (the RX observed
  query/pair) subscribes via weak refs, so the reactive graph never pins memory past the
  observer's life. (This is the GC half of the "RX-observed pair reduces uncertainty"
  mechanism — the observation is leak-free.)
- **It's the collection mechanism for the DI lifetimes.** Where the mumps-DI doc gives
  scoped/lifecycle nodes, **weak refs + GC are how they're reclaimed** — not manual dispose:
  scope ends / observer dies → weak ref clears → GC collects. Lifetime ends *by collection*.

## what-acts weak-refs what-remains (the persona/actor GC discipline)

The key application: **what-acts (the ephemeral actor) holds WEAK references to what-remains
(the durable persona / global)**:

- a dead actor **never pins** the persona/durable state (no leak — the actor is collectible,
  and it doesn't keep the persona alive);
- the persona **outlives** its actors (its lifetime isn't tied to any one ephemeral actor);
- so "what acts" can churn freely (spawn/die per op) **without leaking** the "what remains"
  it was anchored to. The asymmetry (ephemeral→weak→durable) is exactly right: the ephemeral
  side must not own the durable side.

This is **subscribe safety at the global/static (singleton) level** — observers subscribing to
a static/singleton global must use weak refs or they leak forever (the classic *lapsed-listener*
problem). We already do disposal-based subscribe safety (`src/Core/Rx.fs`: `Subscribe` returns
`IDisposable`); the **weak-ref version makes it GC-safe even without a manual `Dispose`** — the
belt-and-suspenders for the global-static case where dispose is easy to forget.

## Lazy load + push-down cache per cell closure

Paired with the weak refs:

- **lazy load** — don't materialize a global until it's observed/entered (the Dark Hall
  glows-on-entry / lazy-activation; the cell is dormant until addressed). Combined with weak
  refs: load on entry, collectible on exit.
- **push-down cache what's needed for its OWN closure as a cell** — each **cell** caches
  (pushes down) only what its **Markov-boundary closure** requires — not the whole tree. The
  cache is the cell's working set; weak-ref'd so it's GC-safe; lazily filled. (Cache-aside,
  scoped to the closure.)

So each cell: enters → lazily loads + push-down-caches its closure's needs → holds them
weak/observer-dependent → on exit, GC reclaims. No global pinning; each cell carries only its
own closure; memory tracks the live observation graph.

## Why this composes

- **GC-safe DI lifetimes** — weak refs reclaim scoped/lifecycle nodes automatically (no manual
  dispose to leak).
- **scale-free / lock-free** — weak refs + GC need no central coordinator; per-cell working sets
  scale.
- **what-remains / what-acts** — the ephemeral→weak→durable rule is the memory form of the
  identity split (actors don't own personas).
- **idempotency / DST** — collection is deterministic enough to reason about; the live set is a
  function of the observation graph (replayable).

## Honest scope / handoff

Design + existing partial (`Rx.fs` disposal-based subscribe safety). To bake in: weak-ref
(observer-dependent) subscriptions for the RX 2×2 + the mumps globals (`.NET WeakReference` /
`ConditionalWeakTable` for external types; `WeakRef`/`FinalizationRegistry` on the TS oracle);
lazy-load + per-cell push-down cache. Routes to the F# core (`Rx.fs`, `ReactiveSynth.fs`),
Ilyana (type design), Naledi (perf — weak-ref + GC cost), and the mumps-DI / keyring-treaty work.

## Anchors / ties

`.NET WeakReference` / `ConditionalWeakTable` (weak refs on external types) / weak-event pattern
(WeakEventManager) / the lapsed-listener problem; TS `WeakRef` + `FinalizationRegistry`; RX
subscription leaks + disposal (`src/Core/Rx.fs`); lazy loading; cache-aside / push-down cache;
persona=what-remains / actor=what-acts; the Dark Hall lazy/glows-on-entry cell; the mumps-DI
lifetimes doc (weak refs = its collection mechanism); the RX 2×2 / remember×pay-attention cube.
