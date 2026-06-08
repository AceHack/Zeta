# Implementing an interface from DynamicValue — and from joined/zipped banana-split stream queries

**Aaron, 2026-06-08 (#7051/#7052).** Two steps toward "the interface is synthesized from the stream."

## 1. Implement the interface in DynamicValue via an F# object expression (#7051, built)

> "should be able to implement the interface in DynamicValue in F# — you can return `new Interface with {}`
> or something like that."

F# **object expressions** (`{ new IInterface with member … }`) let a `DynamicValue`-backed interpreter
*satisfy the same interface* as the native fold. So native and interpreted are **interchangeable behind
one interface** (hexagonal port, #7019), and the differential test (#7049) compares two implementations of
the *same* interface.

Built (`src/Core/StoredProc.fs`, 6/6 tests green, 0-warning):
- `ITableProc` — the port: `abstract Apply: Table -> Table`.
- `nativeProc d` — native impl (`{ new ITableProc with Apply t = applyDelta t d }`).
- `dynamicProc sp` — the **DynamicValue-backed** impl via object expression: validates the stored-proc once
  (`decodeDelta`), then `Apply` runs the independent interpreter (`interpretApply`). `Error` if malformed.
- Differential test: `nativeProc d` and `dynamicProc (encodeDelta d)` agree behind `ITableProc`.

## 2. Synthesize the interface from joined/zipped banana-split stream queries (#7052, design)

> "I want to take 1 stream and implement one interface from multiple banana-split RX queries joined and/or
> zipped, and then `new` the interface from the intersection."

The next step: an interface implementation isn't hand-written — it's **synthesized from one stream**:

```
            ┌─ query₁ (banana/fold over the stream) ─┐
 one stream ┼─ query₂ (banana/fold) ─────────────────┼─ join / zip ─→ new IInterface { ... }
            └─ query₃ (banana/fold) ─────────────────┘     (intersection)
```

- **One stream** — the DBSP Z-set event stream (#6997); the single source.
- **Multiple banana-split queries** — each interface *member* is a **catamorphism / fold** (a "banana",
  #7050) over the stream: a reactive query projecting the member's value. "Banana-split" = decompose the
  interface into N independent fold-queries.
- **Join and/or zip** — combine the per-member queries: **zip** (align by position/tick — same-index
  combine) or **join** (align by key) — the Rx/Bonsai combinators (`Rx.fs`, `Bonsai.fs`). The combined
  reactive value is the **intersection** of the queries (the tuple/record of all members, live).
- **`new` the interface from the intersection** — an object expression (#7051) whose members read from the
  joined/zipped reactive value: `{ new IInterface with member _.A = q1.Value; member _.B = q2.Value; … }`.
  The interface is *born from the stream*, reactive by construction (the forced-RX nature, #7050).

So an interface = **a bundle of fold-queries over one stream, joined/zipped, new'd into an object**. This
unifies: the noun-class interface (#7051), the table↔stream fold (#7029), the forced-RX observation
(#7050), and the everything-is-edges graph (#7036 — joins/zips are graph edges between queries).

## 3. Weak-reference mixins for on-demand state access (#7053)

> "you can add weakreference-like mixins to the interface too, and have it access the stored proc for state
> access of the DUs if it needs, or CRDTs or actions."

Beyond the reactive query members, the synthesized interface can carry **mixins held by weak reference**
that reach into the **stored-proc** for *on-demand state access*:

- **Mixin** — an attachable extra capability spliced into the object expression (extra members delegating
  to the stored-proc), not a query over the stream — a side-channel into the proc's state.
- **Weak reference (non-owning)** — the mixin does **not** keep the stored-proc / its state alive. The
  **stream / Bonsai owns the state** (the forced-RX substrate, #7050); the interface only *borrows* it. A
  weak ref means a GC can reclaim the backing state when nothing else holds it, and the mixin degrades
  gracefully (state gone → the member returns "unavailable", never a leak). This keeps the interface
  cheap and non-pinning — it observes/queries by default, and only reaches for concrete state through the
  weak mixin *if it needs to*.
- **What it accesses — DUs / CRDTs / actions** (the yin/yang stored proc's two forms, #7048):
  - **DUs** (asymmetric / ordered) — read the imperative delta state (the saga so far).
  - **CRDTs** (symmetric / commutative #7048) — read/merge the convergent state directly.
  - **actions** — invoke the proc's effectful verbs (the engine-of-change side).

So the full picture: **interface = reactive fold-queries (joined/zipped over one stream) + weak-ref mixins
that borrow the stored-proc for on-demand DU/CRDT/action state.** Queries are the default (cheap, reactive,
observe-only); the weak mixin is the escape hatch to concrete state, non-owning so it never pins or leaks.

## Honest scope (peel)

#7051 is **built + differential-tested** (`ITableProc`, `nativeProc`, `dynamicProc` via object expression).
#7052 is **design** — the shape of interface-synthesis-from-joined-stream-queries; NOT built: no
`synthesize`/`new-from-queries` combinator wiring `Rx.fs`/`Bonsai.fs` join/zip into an object expression
yet (that's the reactive-interface builder — the next step, on the Bonsai/Rx substrate already in-repo).
Recorded as the target shape.

## Anchors (Beacon)

- **F# object expressions** — `{ new I with … }` (the language feature Aaron named).
- **Rx join/zip / reactive combinators** — `Rx.fs`, ReactiveX `zip`/`combineLatest`/`join`; Bonsai
  incremental joins.
- **Catamorphisms ("bananas") / recursion schemes** — Meijer et al. 1991 (each query is a fold).
- **Hexagonal ports & adapters** — Cockburn (#7019); native vs interpreted vs synthesized, one interface.
- Internal: #7049 (native-vs-interpreted differential), #7050 (forced RX / bananas), #7029 (table/stream
  fold), #7036 (everything-is-edges; join/zip = edges), #7019 (pluggable/hexagonal), `StoredProc.fs`.
