# Rooms are IO-packet wrappers — uncertainty wraps IO at the PROMISE level (travels with the promise, not the packet)

**Register:** [grounded] IO model (Aaron) + [Beacon] + [peel]. **Date:** 2026-06-10.
**Captured by:** Otto (shadow). How IO + uncertainty are structured at the room membrane.

## Aaron's words

> "for us our rooms are **IO packet wrappers** that wraps IO in **uncertainty at the promise level** —
> the uncertainty travels **with the promise, not the IO packet itself**."

## The model

A **room wraps IO** — but it wraps it as a **promise** (a future / `Task` / `Async`), and it attaches
the **uncertainty to the promise, not to the data packet.**

- **The IO packet is just data.** The bytes that cross the membrane (via Reticulum/net or disk) carry
  no uncertainty *in themselves* — once you hold a packet, it is what it is.
- **The promise carries the uncertainty.** The uncertainty lives in the **pending-ness**: *will* it
  arrive? *what* will it be? That "will/what" is the promise, and the uncertainty rides it. An
  unresolved promise = held uncertainty (a superposition); resolving it collapses that uncertainty.
- **`mea` = resolve the promise = collapse + post ΔU.** Measuring is awaiting/resolving the promise:
  the uncertainty that travelled with the promise becomes a definite reading, and the **reduction
  (ΔU)** is posted to the ledger. The packet was never uncertain; the *promise of it* was, and `mea`
  is where that promise resolves.

So the room is a wrapper that **separates data from uncertainty**: the IO packet (data, certain once
held) vs the promise (the carrier of "will/what" uncertainty). You reason about, route, and account the
uncertainty **at the promise level — before the IO resolves** — because the promise is the *handle* on
the uncertainty.

## Why this is the right seam

- **Uncertainty is about the future, not the bytes.** Attaching it to the promise (the not-yet) rather
  than the packet (the already) puts it where it actually lives. A delivered packet has zero
  uncertainty; a promise of one has all of it.
- **It composes with the digital qubit.** The unresolved promise = the **TriBoolean `Tri.N`
  (superposed)** at the IO scope; `measure` is the only collapse. Promise-pending ≅ superposed;
  promise-resolved ≅ measured. The number-scope `measure` and the IO-scope `mea` are the same move.
- **It composes with the membrane.** The packet crosses the membrane (Reticulum/disk — the injected
  `IEffects`); the **promise of the crossing** carries the uncertainty across. DST = inject a promise
  that resolves deterministically (null/fake IO); prod = a promise over real IO. Same code path, the
  promise is the uncertainty carrier either way.
- **It composes with the ledger.** ΔU posted by `mea` = the uncertainty a resolved promise gave up.

## Anchors (Beacon)

- **Promise Theory** — **Mark Burgess** (CFEngine; *Promise Theory: Principles and Applications*):
  autonomous agents make **promises** they may or may not keep; a promise is a first-class carrier of
  intent **and the uncertainty of whether it is kept**. Directly the "uncertainty travels with the
  promise" thesis. (Already referenced in the declarative-desired-state arc,
  `docs/research/2026-06-07-zeta-is-declarative-desired-state-...`.)
- **Futures / promises** — Baker & Hewitt (1977); the **Actor model** (Hewitt) — promise = a handle on
  a not-yet-computed value; .NET `Task` / F# `Async` / JS `Promise`.
- **Superposition/measure** — the TriBoolean digital qubit (`Tri.N` + `measure`) at the IO scope.

*(Peel: "uncertainty travels with the promise" is the architectural claim; the literals are real —
`Task`/`Async` promises, the injected `IEffects` membrane crossing, the finalizer ΔU on resolve, the
TriBoolean superposition/measure. Promise Theory (Burgess) is the named human shoulder; the
formalization of "ΔU = the uncertainty a resolved promise gives up" routes to Soraya/Sova.)*

## Ties / routing

The cells/membrane doc (`docs/research/2026-06-10-tests-become-cells-*`) — the room/membrane + injected
IEffects · `src/Core/Finalizer*.fs` (mea resolves → posts ΔU) · the TriBoolean Float / `measure`
(superposition collapse) · Reticulum/disk crossings (the IO packets) · `uncertainty/` ledger (ΔU). Ties
the async-all-the-way discipline (truthful promise signatures). **Routes to:** Soraya/Sova (formalize
promise-uncertainty ↔ ΔU), Aaron (the IO model).
