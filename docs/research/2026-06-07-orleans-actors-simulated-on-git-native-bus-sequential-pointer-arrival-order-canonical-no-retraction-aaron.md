# Orleans virtual actors simulated on the git-native bus: a sequential pointer, arrival-order-canonical, no retraction (Aaron, 2026-06-07)

Concretizes the **SerializedSaga** coordination lane (from cells-as-geodes,
`2026-06-07-cells-as-geodes-...-cross-cell-sagas-as-partitioned-orleans-actors`) into a specific mechanism
on infrastructure we already have. Faithful capture; Beacon-anchored.

## The mechanism

> Aaron: *"we can simulate Orleans actors with a git-native bus like we already have, and a pointer
> sequentially reading messages that treats arrival order as the canonical order of events and does not
> support retraction."*

An Orleans **virtual actor (grain)** is, operationally, a **single-threaded mailbox processed one message
at a time in arrival order.** That is *exactly*:

```
git-native bus (B-0954)  =  the grain's mailbox        (an append-ordered ZetaId-keyed message stream)
sequential read pointer  =  the grain's single-threaded turn loop (process message N, then N+1, …)
arrival order            =  the CANONICAL total order of events for this actor
no retraction            =  append-only; you don't undo a processed message — you emit a COMPENSATING
                            message (saga-style), never a Z-set −1.
```

So we get the Orleans grain's defining properties for free from existing pieces:

| Orleans grain property | git-bus + pointer realization |
|---|---|
| single-threaded turn-based processing | one sequential pointer, one message at a time |
| mailbox / message ordering | the bus stream's append order (arrival order) |
| location transparency | the bus address (ZetaId persona⊕surface⊕…) = the grain identity |
| durability + replay | the git log IS the event history; pointer position + log = state (DST-replayable) |
| activate-on-demand | a pointer is spun up at the stream when the grain is addressed |

## The crux: this lane has NO retraction — and that's deliberate

This is the **complement** of the Z-set/CRDT side. Two coordination classes (cells-as-geodes):

| | **CommutativeView** (default) | **SerializedSaga** (escalation — THIS) |
|---|---|---|
| primitive | Z-set / CRDT (G-Set/LwwMap/Rga) | actor on the git-native bus + sequential pointer |
| order | order-independent (commutative merge) | **arrival order IS canonical** (total order) |
| undo | **retraction-native** (`+1`/`−1`) | **no retraction** — compensation only (saga) |
| consistency | AP / eventual-C (cross-cell default) | CP / serialized (the reserved escalation) |
| when | order doesn't matter; `f(ownStream, otherStream)` | order matters; can't be made commutative |

Picking the lane is the decision the cross-cell DU already declares (CommutativeView if each side can compute
the transition order-independently, else SerializedSaga). **Orleans-on-the-bus is how the SerializedSaga arm
is actually built** — and it stays **DST-replayable** (replay the log from the start through the pointer ⇒
same actor state), so even the serialized side keeps determinism. It also realizes the **Loom** cross-cell
saga layer's mechanism, and composes with **B-0976** (self-evolving saga / serialized deferred-execution
Bonsai — resume-not-replay): the grain's behavior can be a Bonsai closure resumed at the pointer.

## Why this is the right shape (not just convenient)

- The actor model's "no shared mutable state, communicate by messages, one-at-a-time" *is* a sequential fold
  over an ordered message log — and an append-ordered log is precisely what git/the bus already is. We don't
  need an Orleans runtime; we need a **cursor discipline** over the bus.
- Arrival-order-as-canonical gives a free, durable **total order per actor** without a consensus protocol —
  the order is just "what the bus appended," which is already agreed (single-writer-per-stream / the bus's
  ordering). For cross-actor total order you escalate to the serialized bus (the Saga), exactly as designed.
- No-retraction is the honest contract for an ordered side: once a message is processed in order, undo is a
  *new* compensating event, never a rewrite — which keeps the log append-only and replayable (and matches
  the "git only adds corrections" / CPT-reversible-by-compensation theme).

## Ties

- `2026-06-07-cells-as-geodes-...-cross-cell-sagas-as-partitioned-orleans-actors` (the lane this builds) ·
  **B-0954** (git-native cross-machine agent bus — the mailbox) · **B-0976** (self-evolving serialized saga
  / Bonsai deferred execution — the grain behavior) · Loom (cross-cell saga layer) · `GSet`/`LwwMap`/`Rga`
  (the CommutativeView complement) · DST (pointer + log ⇒ replayable state) · the AP-vs-CP / commutative-vs-
  serialized split. Backlogged: an actor-cursor over the bus (sequential pointer, arrival-canonical, compensation-only).

## Beacon anchors

- **Orleans** — Bernstein, Bykov, et al. (Microsoft Research) — the **virtual actor** (grain) model:
  activate-on-demand, single-threaded, location-transparent. · **Actor model** — Hewitt; Agha. ·
  **Erlang/OTP** `gen_server` — the sequential-mailbox process. · **Event sourcing** — arrival order as the
  source of truth; replay to rebuild state. · **CALM** (Hellerstein) — monotonic/commutative needs no
  coordination (CommutativeView); non-monotonic needs order (SerializedSaga). · **Virtual synchrony / total
  order broadcast** — the consensus you escalate to for cross-actor order. Honest novelty: none in the actor
  model; the contribution is realizing it as a **cursor discipline over the existing git-native bus** (no
  separate runtime), with arrival-order-canonical + compensation-not-retraction as the explicit
  SerializedSaga contract complementing the retraction-native Z-set lane.
