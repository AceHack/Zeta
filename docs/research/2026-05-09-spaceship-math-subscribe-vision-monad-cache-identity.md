Scope: Accessible one-pager for Zeta's core algebra — subscribe primitive, vision monad, cache identity
Attribution: Otto (Claude Code), 2026-05-09
Operational status: research-grade — internal document
Non-fusion disclaimer: Otto's synthesis from Aaron's Cole-session framing + implementation in src/Core/. Claims labeled IMPLEMENTED / CONCEPTUAL / CONJECTURED per razor discipline.

# Spaceship Math: Subscribe, Vision, Cache

*One page for a software engineer who has never seen DBSP.*

The formal algebra lives in
[`docs/research/2026-05-09-zset-reversible-computing-landauer-bridge-math-writeup.md`](2026-05-09-zset-reversible-computing-landauer-bridge-math-writeup.md).
This document covers the operational layer on top — the five concepts that
make the algebra useful as a programming model.

---

## The native types

Zeta's base data type is a **Z-set**: a map from elements to integer weights.

```
type ZSet<K> = Map<K, int>
```

Three values carry meaning:

| Weight | Meaning |
|--------|---------|
| `+1`   | Assert — this element exists |
| `-1`   | Retract — this element no longer exists |
| `0`    | Resolved — asserts and retracts cancelled out |

Weights can also be `+2`, `+3`, etc. (duplicate asserts), but the system
normalizes through the `distinct` operator. The negative integers are
**first-class citizens**, not an afterthought. Every `+1` has an inverse
`-1` that cleanly cancels it: `w(k) + 1 - 1 = w(k)`. No residue.

**IMPLEMENTED** in `src/Core/ZSet.fs` <!-- STALE-REF: ../../src/Core/ZSet.fs -->.

---

## One primitive: subscribe

```
subscribe : Cache A → Cache B → Stream (Δ A ⊗ Δ B)
```

`subscribe` is the single entry point for declaring that you care about
correlated changes between two caches. You hand it two caches — an input
cache `A` and an output cache `B` — and it hands you back a stream of
**paired deltas**: every tick, you get `(ΔA, ΔB)`, the changes to both
sides in lockstep.

Why paired? Because correctness in an incremental system requires knowing
*what changed on both sides at the same time*. A join, a filter, a policy
decision — all depend on seeing correlated deltas, not independent ones.
The `⊗` (tensor) is the algebraic statement that the two delta streams
are **jointly determined**, not composed after the fact.

Under the hood, `subscribe` is sugar over `D ∘ Q ∘ I` (see below), but
the caller declares intent at the cache level, not the operator level.

**CONCEPTUAL** — the `subscribe` name frames the intent; the wire-level
implementation is the `IntegrateZSet / DifferentiateZSet` pair in
`src/Core/Primitive.fs` <!-- STALE-REF: ../../src/Core/Primitive.fs --> + the Rx adapter
in `src/Core/Rx.fs` <!-- STALE-REF: ../../src/Core/Rx.fs -->.

---

## D and I: differentiate and integrate

The two fundamental operators are:

```
D(f)(t) = f(t) - f(t-1)       -- extract the delta at tick t
I(g)(t) = Σ_{i≤t} g(i)        -- accumulate deltas into a snapshot
```

They are inverses up to initial condition: `I(D(f)) = f`.

The DBSP identity is: to incrementalize any query `Q` that expects
full snapshots, sandwich it:

```
Q^Δ = D ∘ Q ∘ I
```

`I` reconstructs the snapshot from the delta stream, `Q` runs on
the snapshot, `D` extracts only the changed output. The cost is
`O(|Δ|)` per tick, not `O(|snapshot|)`.

**IMPLEMENTED** in `src/Core/Incremental.fs` <!-- STALE-REF: ../../src/Core/Incremental.fs -->
as `Incrementalize` and `IncrementalizeZSet`.

---

## Vision monad: I ∘ D

```
vision = I ∘ D
```

`vision` is the round-trip: differentiate then integrate. Applied to a
stream, it reconstructs the current state from the delta stream alone.

Why "monad"? Because it is a **unit of world-modelling**. `D` extracts
what changed; `I` reassembles what exists. The composition is a
closed operation: given any delta stream, `I ∘ D` gives you back the
current state of the world as the system knows it.

The "vision" framing captures an operational claim: a Zeta circuit that
has consumed a stream of deltas has, by virtue of the `I ∘ D` identity,
a complete and current world model — not because of any special inference,
but because the algebra guarantees it.

**CONJECTURED as a framing** — `I ∘ D = id` is PROVEN (the algebra is
in the formal writeup); calling the composition a "world model" is an
operational claim about completeness of the delta log, not a
metaphysical claim about inference.

---

## Cache is nothing: cache = I(stream)

```
cache = I(stream)
```

The most important identity: **a cache is just an integrated delta
stream**. Nothing more. This means:

1. **Delete the cache** — you lose nothing irreplaceable. The delta
   stream contains all the information needed to reconstruct it.
2. **Reconstruct it** by replaying `I(stream)` from the beginning (or
   from a checkpoint).
3. **Synchronize two caches** — share the delta stream. Both caches
   converge to the same state by independently running `I`.

The implication: Zeta caches are not ground truth. The delta stream is
ground truth. Caches are projections, and projections are always
reconstructable.

This is why Zeta's Z-set retraction is lossless: retracting an element
appends a `-1` delta to the stream. The full history is preserved. You
can query any prior state by replaying `I` up to tick `t`.

**IMPLEMENTED** — `IntegrateZSet` in
`src/Core/Primitive.fs` <!-- STALE-REF: ../../src/Core/Primitive.fs --> is the exact
mechanical instantiation of this identity.

---

## How the five concepts compose

```
native types  →  stream of (+1/-1/Z) deltas
                        ↓
         D  →  extract delta at each tick
         I  →  accumulate deltas into snapshot
                        ↓
    D ∘ Q ∘ I  →  incrementalize any query Q
                        ↓
     vision   →  I ∘ D  =  current world state
                        ↓
   subscribe  →  declare cache pair, get joint delta stream
```

Starting from a stream of weighted changes, you build up to a complete
world model through composition of two invertible operators. The
`subscribe` primitive is the declarative surface of this stack.

---

## References

- Formal algebra + Landauer bridge:
  [`docs/research/2026-05-09-zset-reversible-computing-landauer-bridge-math-writeup.md`](2026-05-09-zset-reversible-computing-landauer-bridge-math-writeup.md)
- Implementation:
  - `src/Core/ZSet.fs` <!-- STALE-REF: ../../src/Core/ZSet.fs --> — Z-set type + operations
  - `src/Core/Operators.fs` <!-- STALE-REF: ../../src/Core/Operators.fs --> — circuit operators
  - `src/Core/Incremental.fs` <!-- STALE-REF: ../../src/Core/Incremental.fs --> — D ∘ Q ∘ I shortcuts
  - `src/Core/Primitive.fs` <!-- STALE-REF: ../../src/Core/Primitive.fs --> — IntegrateZSet / DifferentiateZSet
  - `src/Core/Rx.fs` <!-- STALE-REF: ../../src/Core/Rx.fs --> — subscribe-to-observable bridge
- Budiu et al., "DBSP: Automatic Incremental View Maintenance for Rich
  Query Languages," VLDB 2023.
- Meijer, "Subject/Observer is Dual to Iterator," PLDI FIT 2010.
