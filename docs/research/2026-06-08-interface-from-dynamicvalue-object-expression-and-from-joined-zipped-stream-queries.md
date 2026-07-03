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

### Weak ref for *externalized* state (#7056)

Aaron: *"what about the weak ref for externalized state?"* The weak-ref mixin isn't only for in-process
stored-proc state — it's the natural handle for **externalized state**: state whose durable owner lives
*outside* the interface/process — the **event stream / git / db control plane** (#6994), the
closures-over-external-state routed by Reticulum (the founding model). The weak ref fits even better here:

- **The external source is the durable owner; the weak ref is a rebuildable cache.** The interface holds a
  *non-owning local view* of externalized state. If the GC reclaims it (or it's evicted), there's **no
  loss** — you **rehydrate by re-folding the stream** (the source of truth, #6997/#7050). Forced-RX makes
  the cache *always reconstructible*: the weak ref can be dropped freely because the stream can always
  re-materialize it (table = fold(stream), #7029).
- **Non-owning across the boundary** = no distributed leak / no pinning a remote resource. The interface
  borrows externalized state for as long as it's cheap to hold; under pressure it lets go and re-derives
  on next observation. This is the right default for cells that come and go (ephemeral/durable thermo-
  typing): a cell's interface caches external state weakly and rebuilds from the stream after eviction or
  relocation (Bounded Mobility §4).
- So: **weak ref = a cache over externalized, stream-backed state; GC/eviction is safe because the stream
  is authoritative and the cache rehydrates by re-folding.** (Strong refs would pin remote/durable state
  to a transient interface — wrong; weak + rehydrate-from-source is the correct coupling.)

## Is this a known pattern in category theory? Yes (#7054)

Aaron asked. It's several converging, named results — and his coinage is almost literal:

- **The Banana Split Law** (Fokkinga 1990; Bird & de Moor, *Algebra of Programming* 1997). A **tuple of
  catamorphisms over one structure = a single catamorphism producing the tuple**:
  `⦇f⦈ △ ⦇g⦈  =  ⦇ (f ∘ F π₁) △ (g ∘ F π₂) ⦈`. "Banana-split" is the *actual theorem name* — multiple
  fold-queries over one stream provably collapse to one fold. Aaron's intuition was the literal law.
- **Arrow fanout `&&&`** (Hughes, *Arrows* 2000) — `(&&&)` runs multiple computations on one input and
  tuples the results. "1 stream → N queries → pair" *is* fanout.
- **zip = product/tupling; join-by-key = pullback (fiber product).** Relational join is a pullback in
  **Set/Rel**; zip is the product. "Join/zip and take the intersection" = forming a **limit** of the
  diagram of queries; the synthesized object is that limit.
- **Interfaces are coalgebras** (Rutten; Jacobs, *Introduction to Coalgebra*). An object defined by *what
  you can observe of it* is a **coalgebra**, and **streams are the canonical final coalgebra**. So
  "synthesize the interface from stream observations" is the coalgebraic view of objects — which is exactly
  the forced-RX nature (#7050): you only observe over streams.
- **Applicative functors** (McBride & Paterson) — `zip` is the applicative `⊛` combining independent queries.

The cut: **banana-split law** (folds) + **fanout / product / pullback → a limit** (join/zip + intersection)

+ **coalgebra** (interface-as-observations). Well-trodden; Zeta's twist is running it over the *one DBSP

Z-set stream* with `DynamicValue` stored-procs.

## Does anyone do it in F#/Scala, or with anonymous shapes? (#7055)

The *pieces* exist in real systems; the *exact end-to-end combo* is a composition, not off-the-shelf:

- **Closest real systems.** Jane Street **Bonsai** (OCaml — build a component from joined *incremental*
  computations; literally the in-repo namesake of `Bonsai.fs`); **arrowized FRP** (Yampa / Dunai /
  bearriver — `&&&` fanout running multiple signal-functions over one input stream); Scala reactive UIs
  (**Laminar**, **Scala.Rx** — `Signal.combine`/zip to build a node from joined signals).
- **DynamicValue-backed interface specifically.** **Scala 3 structural types + `Selectable` /
  `selectDynamic`** is the textbook case — a structural interface backed by a runtime `Map[String, Any]`
  (exactly DynamicValue → interface). F#'s nearest equivalent is **type providers** (provided members
  backed by runtime access; the "reified type provider" Aaron raised earlier).
- **Anonymous shapes.** F# **anonymous records** (`{| a = …; b = … |}`); Scala **structural / refinement
  types** and **shapeless** records (HList/record generics).
- **What's not off-the-shelf:** a *named* interface synthesized from multiple **banana-split fold-queries
  over ONE event stream**, joined/zipped, `new`'d via object expression with a `DynamicValue` backing +
  weak-ref mixins to externalized stream-backed state. That specific synthesis is a **composition**
  (Bonsai-style incremental components ⊕ arrow fanout ⊕ structural/object-expression backing ⊕ stream-
  rehydratable weak refs), not a new primitive — each part is prior art; the assembly over the one DBSP
  stream is Zeta's.

## Honest scope (peel)

#7051 is **built + differential-tested** (`ITableProc`, `nativeProc`, `dynamicProc` via object expression).
#7052 is **design** — the shape of interface-synthesis-from-joined-stream-queries; NOT built: no
`synthesize`/`new-from-queries` combinator wiring `Rx.fs`/`Bonsai.fs` join/zip into an object expression
yet (that's the reactive-interface builder — the next step, on the Bonsai/Rx substrate already in-repo).
Recorded as the target shape.

## Does this solve the RX subscribe/dispose memory leak? (#7057)

Aaron asked. **Largely yes — by two mechanisms, with one honest caveat.**

The classic leak: a long-lived observable holds a *strong* reference to a short-lived observer; forget
`Dispose()` and the observer is pinned forever. Two things here defuse that:

1. **Declarative incremental (Bonsai) removes manual `Subscribe`/`Dispose`.** When the interface is
   *synthesized* from banana-split queries in an incremental graph (#7052), lifetime is **structural**: a
   query/subscription is alive **iff it's in the computation graph**, and dropping the node tears down its
   subscription automatically. There's no imperative `Subscribe` to forget — which is exactly how Jane
   Street's Bonsai / Incremental avoid the leak by construction (no observer to leak).
2. **Weak-ref mixins + rehydrate-from-stream (#7053/#7056) make handles droppable.** A **weak** subscription
   lets the GC reclaim a dead observer even if `Dispose` was forgotten — no pin, no leak. And because state
   is rebuildable from the stream (table = fold(stream), #7029/#7050), you never need a long-lived *pinning*
   subscription: drop it under pressure, re-fold on next observation. The lifetime pressure that *causes*
   leaks is removed.

**Honest caveat (the inverse risk).** Weak subscriptions trade the forgotten-dispose leak for the
**lapsed-listener** problem: an observer can be collected *prematurely* if nothing roots it — so you must
keep a strong root for what you want kept alive. And you only get mechanism (1) if you use the incremental
graph, not raw imperative `Rx.Subscribe`. So the design **converts "leak on forgotten dispose" into "keep
your roots / graph correct"** — a strictly better failure mode (a missing root fails *loud and early* as
"no updates", vs a leak that grows silently), but not zero lifetime discipline. (This is why Rx.NET/RxJS
don't default to weak subscriptions — premature collection surprises people; here it's safe because the
stream can always rehydrate.)

**And rooting is easy here (Aaron, #7059).** *"You must root what you want kept alive — this is easy: our
static bounded graph of the inside in the current step is static."* The root set is not guesswork: at any
timestep, **the inside is a static, bounded graph** — the **within-stream push-down graph** (#7005: one
clock, topo-ordered, static). So the strong roots are *exactly that graph* — everything in the current
step's inside-graph is rooted by construction; everything else (the **cross-stream / JIT** part, #7005) is
held weakly and rehydrated from the stream. The within/cross (push-down/JIT) cut #7005 *is* the
strong-root/weak-ref cut: **push-down graph = the roots, JIT graph = weak + rehydratable.** The
lapsed-listener risk evaporates because the graph that must stay alive is finite, static, and known each
step — you don't manage roots, the inside-graph is them.

## Infinite-but-bounded, self-recursive but evolving value, banana-split into lightweight algebras — CT? (#7058)

Aaron: *"using an infinite-but-bounded, self-recursive but evolving dynamic/soft value and doing the
banana-split to map it into lightweight algebras — is anyone doing that with category theory?"* **Yes —
well-studied, under several names; the description maps almost term-for-term:**

- **Hylomorphism** (ana-then-cata; Meijer et al. 1991) — *unfold* an **infinite-but-bounded** virtual
  structure, then *fold* (banana-split) it into an **algebra**. This is exactly "bounded-infinite
  self-recursive → lightweight algebra": the recursion is virtual (never fully materialized), bounded by
  productivity, and consumed by a fold.
- **Metamorphism / streaming** (Gibbons, *Streaming Representation-Changers* 2007) — cata-then-ana over
  **infinite** input; the **evolving stream** part.
- **Dynamorphism / histo- / futu- / chrono-morphisms** (Uustalu & Vene; Kabanov & Vene, *Recursion
  Schemes for Dynamic Programming*) — schemes over evolving structures that **carry history/future** =
  "self-recursive *but evolving*" (the value remembers).
- **Adjoint folds & unfolds** (Hinze) — the unifying categorical account of all the above via adjunctions.
- **Bialgebras + distributive laws** (Turi & Plotkin, *Towards a Mathematical Operational Semantics* 1997)
  — the deepest fit. A value that is **both an algebra (self-recursive build/fold) and a coalgebra
  (evolving/observe)**, tied by a distributive law, is a **bialgebra**. "Self-recursive but evolving" *is*
  bialgebraic: the banana-split is the **algebra** side; the streaming/observation is the **coalgebra**
  side; the distributive law is what makes them cohere (and is exactly the forced-RX coupling, #7050).
- **DBSP** (Budiu et al. 2022) — the **in-house instance**: an infinite stream of *bounded* deltas,
  incrementally folded over the **Z-set abelian-group algebra** (the "lightweight algebra"). Zeta already
  *runs* this pattern; the question's shape is DBSP's shape.

So the exact combination — a `DynamicValue`/`SoftValue` as the **bounded-infinite evolving carrier**,
**banana-split into lightweight commutative algebras**, over the **one DBSP stream** — is a **composition**
(bialgebraic ⊕ hylomorphic ⊕ DBSP-incremental), not a single named theorem, but every constituent is
established category theory. Zeta's contribution is the assembly, not the primitives.

## Anchors (Beacon)

- **F# object expressions** — `{ new I with … }` (the language feature Aaron named).
- **Rx join/zip / reactive combinators** — `Rx.fs`, ReactiveX `zip`/`combineLatest`/`join`; Bonsai
  incremental joins.
- **Catamorphisms ("bananas") / recursion schemes** — Meijer et al. 1991 (each query is a fold).
- **Banana Split Law** — Fokkinga 1990; Bird & de Moor, *Algebra of Programming* 1997 (tuple-of-folds = one
  fold; the literal name of Aaron's pattern, #7054).
- **Arrows / fanout `&&&`** — Hughes 2000; **arrowized FRP** — Yampa / Dunai (fanout over signal-functions).
- **Limits: product (zip) / pullback (join-by-key)** — relational join = pullback in Set/Rel; synthesized
  object = the limit of the query diagram.
- **Coalgebra / final coalgebra** — Rutten; Jacobs, *Introduction to Coalgebra* (interfaces-as-coalgebras;
  streams are the final coalgebra; observation-defined ⇒ forced-RX #7050).
- **Applicative functors** — McBride & Paterson (zip = applicative `⊛`).
- **Incremental component synthesis / dynamic-shape interfaces** — Jane Street **Bonsai** (the `Bonsai.fs`
  namesake); Scala 3 **`Selectable`/`selectDynamic`** (structural iface over a runtime Map); F# **type
  providers**; F# **anonymous records** `{| … |}`; Scala structural/refinement types + **shapeless**.
- **WeakReference / non-owning handles + rehydration** — weak caches over externalized stream-backed state
  (#7056), rebuilt by re-folding the stream (#7029/#7050).
- **Hexagonal ports & adapters** — Cockburn (#7019); native vs interpreted vs synthesized, one interface.
- Internal: #7049 (native-vs-interpreted differential), #7050 (forced RX / bananas), #7029 (table/stream
  fold), #7036 (everything-is-edges; join/zip = edges), #7019 (pluggable/hexagonal), `StoredProc.fs`.
