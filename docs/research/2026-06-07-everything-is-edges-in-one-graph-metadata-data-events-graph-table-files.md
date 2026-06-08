# Everything is edges in one graph — (metadata, data) → events → graph → table → files

**Aaron, 2026-06-07 (#7036):**

> "all of it are just special types of edges in our graph, so (metadata, data) → events → graph → table →
> files."

This grounds the whole stack one level deeper than the stream→table→file layering (#7034): the substrate
is a **graph**, and *everything is an edge in it*. **(metadata, data) are just special edge types.**

## The stack (Aaron's revised ordering #7036)

```
(metadata, data)   — the two edge TYPES (meta edges + data edges; #7032 meta-in-band)
      ↓
  graph (cached)    — the materialized typed-edge graph: the CACHED current edge set (ZetaGraph, #6984)
      ↕              ← graph ↔ events is the fold/changelog DUALITY (#7029), not a strict order
  events            — the delta changelog over the graph (the one DBSP Z-set stream, #6997)
      ↓
  table             — a projection/view (rows; fold = #7029)
      ↓
  files             — a view of tables (hierarchy + folders; #7002)
```

Aaron first said `… → events → graph → …` then revised to `… → graph(cached) → events → …` ("maybe more
like this"). **Both are right — because graph↔events is the same duality as table↔stream (#7029):** the
**graph is the cached fold** (materialized current edges) and **events are its changelog** (deltas). Which
you call "first" depends on whether you're reading the cache or the log; they reconstruct each other
(`graph = fold(events)`, `events = changelog(graph)`). The revision's value is naming the graph as the
**cache** — the materialized substrate you read — with events as how it changes.

- **Edges are primitive.** A data event is a **data edge** (key→value, row→column, a dependson edge
  #6996/#7021); a metadata event is a **meta edge** (in-band, #7032). `dependson` (parent folders #7021,
  branches #7025, DepSetup #6996) — all the same: typed edges in the one graph.
- **graph = the cache, events = the changelog.** The materialized graph is what you read; the event stream
  is how it mutates (add/retract edges; idempotent #6, DST §7). Two faces of one thing.
- **table → files are views.** A `table` is a projection of the graph (#7029 duality); a `file` tree is a
  table with hierarchy (#7002). Higher layers are *views* of the graph, not separate substrates.

## Why this matters

It collapses every noun-class we've built into **one graph model**: `db`, `key`, `file`, `table`,
`stream` are all views of edge-mutation events over a single typed graph. `ZetaGraph` (#6984, the
dependson graph + topo-order) and `TableStream` (#7029, the fold) are the same graph seen as edges vs as a
folded table. (metadata, data) being *edge types* is why meta-in-band (#7032) works: a meta edge and a
data edge ride the same event stream into the same graph; the table/meta projections just filter by edge
type. Self-similar / recursive (§9/§10): the graph describes itself with edges, including meta edges about
itself (the self-hosting recursion #7027/#7028 bottoms out in "an edge in the graph").

## Within-stream vs cross-stream = push-down graph vs JIT graph, combined into one (#7037)

Aaron started uncertain — *"IDK, there are cross-stream and within-stream graphs and they look
different"* — then named it: **"this is push-down graphs vs JIT graphs … combined into one."** This is the
*same* push-down-vs-JIT distinction from the db/dependency work (#6996/#6997), now applied to graphs:

- **Within-stream graph = PUSH-DOWN graph** — edges among events *inside one stream/log*, resolved
  **ahead / statically** (push-down: declared, kernel/OS/global, outside the container, #6977). One
  causal/total order ⇒ a DAG you can **topo-sort linearly** (`ZetaGraph.topoOrder`, #6984); deterministic.
  Looks like: one ordered log, deps-before-dependents, resolved up front.
- **Cross-stream graph = JIT graph** — edges *spanning independent streams* (different cells/repos/
  branches; a file in stream A dependson a branch in stream B, #7025), resolved **just-in-time /
  dynamically / lazily** (jit = lazy = dynamic resolution = DI, inside the container, #6997). **No global
  order** — the streams are ordered
  independently, so relating them needs **CRDT convergence / consensus**, not a single topo-sort: the
  Loom (#6980), zip-over-two-CRDTs (#6993, "they may see things in different order but proofs say they
  converge"), cells-push-out/hosts-accept-in. Looks like: a merge/braid of independently-ordered DAGs.

Why they "look different": within-stream (push-down) has **one clock** (linear, topo-sortable);
cross-stream (JIT) has **many clocks** (partial order, convergent-merge). Same split as `TravelerFrame` /
no-global-causal-order (§4) vs a single ordered log — the real boundary between `topoOrder` (#6984,
push-down/within) and the consensus/Loom layer (#6980, JIT/across).

**Combined into one (Aaron):** they are not two rival graphs — they **combine into one graph** with two
edge-resolution modes. A push-down edge resolves statically/ahead within a stream; a JIT edge resolves
dynamically/lazily when it crosses a stream boundary (same as a dependency that's push-down vs
dynamic-resolution, #6996/#6997). So the unified graph is **one graph, two resolution modes**: an edge is
push-down (static, topo-sorted) until it crosses streams, where it becomes JIT (dynamic, convergent-
merged). Self-similar (§9/§10): within-stream is the JIT-graph collapsed to one clock. Open: the exact
representation (one `Edge` with a resolution-mode tag?) — a design pass + Soraya for the cross-stream
convergence proofs.

## Honest scope (peel)

Conceptual unification — names the substrate (a typed-edge graph) under the already-built pieces
(`ZetaGraph` #6984, `TableStream` #7029, `Db`/`File`/`KeyStore`). No new code: it does not yet introduce a
single unified `Edge`/`EdgeType` representation that `db`/`file`/`table` all literally share — that would
be a refactor (collapse the per-noun-class event DUs into one typed-edge event). Recorded as the unifying
model + the supersession of #7034's layering; whether to refactor toward one shared `Edge` type is an open
design call (likely worth a backlog item + Rune/Kira review before churning the working noun-classes).

## Anchors (Beacon)

- **Property/labeled graphs & graph databases** — Neo4j (typed edges/relationships), RDF triples
  (subject-predicate-object = an edge), Datomic datoms (entity-attribute-value-tx = an edge with
  metadata).
- **Edge-as-fact / event-as-edge** — event sourcing where each event is a graph mutation; DBSP over a
  graph (Budiu 2022).
- **Views as projections** — CQRS read models; materialized views (table = a view of the graph).
- Internal: #6984 (ZetaGraph dependson + topo-order), #7029 (table/stream duality), #7032 (meta-in-band),
  #7034 (stream→table→file, now refined to graph-rooted), #7002/#6996/#6998 (file/db/key noun-classes),
  manifesto §9 recursive / §10 self-similar, idempotency #6 / DST §7.
