# DST timeline operations — design note (fork · zip · join · converge · rewind · fast-forward)

**Aaron, 2026-06-08.** The design for the not-yet-built **DST timeline-ops** module — time-travel /
emulator operations over the one zset event stream — with the operator vocabulary pinned *before* the build,
including the sharpened **zip ≠ join** distinction and where staged coincidence lives.

## Why

The "interrupt-as-DST-time-emulator" vision (inject DST time, play emulators with `fast-forward / rewind /
fork / join` over the zset timeline) needs a precise operator set. The names matter because they are
different operations with different concurrency profiles and different relationships to staged coincidence.

## The operator taxonomy (pinned)

| op | meaning | wait-free? | staged-coincidence locus | anchor |
|---|---|---|---|---|
| **fork** | **banana split** — one timeline → many parallel folds (diverge) | yes | — | Fokkinga 1990 (Banana Split Law); `⟨f,g⟩` cata |
| **zip** | element-pair two streams, **no condition** | **wait-free** (§2) | none — nothing to gate | Rx `zip`; manifesto §2 lock/wait-free |
| **join** | **wait for a coincidence condition** on both streams before emitting | **waits / gated** | **HERE** — `CoincidenceClock` controls when the join fires | Rx `join`/`groupJoin`; relational join |
| **converge** | consensus reconcile to one frame (CRDT, idempotent, order-independent) | result commutative | — | `Reconcile.fs`; CALM; CRDT |
| **rewind** | replay the event log to tick `N` (fold-to-N) | deterministic (DST) | — | event sourcing; `rr`; save-states |
| **fast-forward** | fold forward from the current cursor | deterministic (DST) | — | event sourcing |

### The load-bearing distinction (Aaron 2026-06-08): zip ≠ join

- **zip = wait-free.** After a `fork` (banana split), `zip` re-pairs streams element-by-element with **no
  condition and no waiting** — lockstep/index-aligned. The manifesto §2 wait-free path: no coordination, no
  blocking on the other stream's state. **Cannot be staged** (nothing to gate).
- **join = coincidence-gated.** A `join` **waits for a condition to coincide** on both streams (a
  predicate/key match within a window) before emitting. It blocks on the coincidence — **not** wait-free.
- **Coincidence is the join's firing condition** ⇒ **staged coincidence operates at the *join*, not the zip.**
  `CoincidenceClock` controls *when the join fires*; the staged Bell/CHSH correlations (`BellTest`) live at
  the join. This is the precise locus where DST seed-control meets the timeline algebra.

## The substrate it rides

- **The zset event stream is the timeline.** `rewind`/`fast-forward` are fold-to-tick over it (deterministic,
  DST §7). `fork` is a banana split of the fold; `zip`/`join` re-combine; `converge` reconciles to one frame
  when agreement is required (the consensus/NCI case — `Reconcile.fs`).
- **The interrupt is the tick/clock** (emulator interrupt = DST time source). Injecting DST time = controlling
  the interrupt schedule; the timeline ops then ff/rewind/fork/join over the resulting event stream.
- **Meta-homoiconic:** the tick/interrupt is itself an event on the same stream, so timelines are first-class
  data that fork and join.

## Build sketch (F#, when greenlit)

- `rewind (events) (n)` = `events |> List.take n |> fold` (replay to tick N).
- `fastForward (state) (events)` = `events |> List.fold apply state`.
- `fork (events) (folds)` = banana split — run each fold over the same event prefix (one pass).
- `zip a b` = wait-free element pairing (`List.zip`-shaped, lockstep), no condition.
- `join pred windowA windowB` = emit pairs whose `pred` coincides within the windows (gated). `CoincidenceClock`
  supplies the staging (when the coincidence is allowed to fire).
- `converge` = the existing `Reconcile.fs` / CRDT order-independent settle.

## Honest scope (peel)

A **design note**, not code — pins the vocabulary so the eventual module is built with the right names and the
right concurrency profile (zip wait-free, join gated). The transport/networked side stays gated (081KT2T2J0008QG0R002R72323); this
is the *local timeline algebra* over the zset event stream. The "play emulators with DST time" framing is real
and buildable (it's event-sourcing + save-states + deterministic replay), not exotic — `rr` and every
save-state emulator already do rewind/fast-forward; the novelty here is only the *unified* fork/zip/join/
converge algebra over the one stream with the interrupt as the DST time source.

## Anchors (Beacon)

Fokkinga 1990 (Banana Split Law); Rx `zip`/`join`/`groupJoin`; CALM / `Reconcile.fs` (converge); event
sourcing + `rr` + save-states (rewind/ff); manifesto §2 (wait-free), §7 (DST). Internal: `CoincidenceClock`,
`BellTest`, `SymmetricEndurance`; 081KT2T2J0008QG0R002R72323 (gated transport). Aaron's settled distinction 2026-06-08.

## Rx-operator realization + homoiconic over the interfaces we own (Aaron 2026-06-08)

Aaron: *"we should make this homoiconic to Rx — or our hexagonal version of Rx, the interfaces we own."* Two
layers:

### (a) Each abstract op → its concrete Rx operator (when run on System.Reactive)

| our op | Rx operator(s) |
|---|---|
| **fork** (banana split) | `Publish`/`Multicast`(+`RefCount`) — one source to many pipelines; `GroupBy` (fork-by-key) |
| **zip** (wait-free pair) | `Zip` (positional) |
| **join** (coincidence-gated) | `Join` / `GroupJoin` — **window overlap = coincidence**; `CoincidenceClock` plugs in here |
| **converge — flatten** (many streams → one) | `SelectMany` / `Merge` |
| **converge — consensus** (CRDT reconcile to one value) | `Scan`/`Aggregate` + commutative-idempotent (CRDT) merge — **NOT** `SelectMany` |
| **rewind / fast-forward** | replay/fold over the buffered event log (`Replay`/`Scan` from the start) |

**Correction to keep:** `SelectMany` is the *flatten* converge (stream→stream), **not** the *consensus*
converge (the CRDT order-independent settle = `Scan` + commutative merge). Two different "converges."

### (b) Homoiconic over the owned interface (not opaque functions)

The ops should be **data, not closures** — a timeline program is a `Bonsai`/`DynamicValue` **expression tree**
(homoiconic; #7032 meta-events in-band; `all-our-metadata-is-homoiconic-to-our-data`), interpreted over the
Rx interface **we own** (`bcl-interface-boundary` — own the port, adapt the backend in). The owned port is
the **`IQbservable` / Reaqtor lineage** already gestured at in `Rx.fs` (`RxAdapter`): Bart De Smet's
expression-tree-*queryable* Rx — queries as inspectable/serializable trees — with **System.Reactive as one
backend** (others: our own DBSP `Stream<ZSet>` runtime, the DoP-knobbed ferry). Because the ops are data:

- the timeline program is **serializable** (Bonsai — 081KRW63S0008QG0R002XA5N6S) and **DST-replayable**;
- it is **meta-homoiconic** — the program is itself an event on the same zset stream, so a *timeline-ops
  program* can be forked/joined/rewound like any other timeline (the meta-boundary is homoiconic);
- `fork`/`zip`/`join`/`converge` are DU cases / Bonsai nodes, given meaning by an interpreter over the owned
  `IQbservable` port (System.Reactive = reference oracle; native DBSP = the fast path), with the
  native-vs-interpreted differential we already use (`StoredProc` pattern).

So: the four-op algebra is a **homoiconic query over our owned Rx port**, not a pile of functions — Rx
operators are the *reference semantics*, Bonsai/DynamicValue is the *homoiconic representation*, and we own
the interface so backends (System.Reactive / DBSP / ferry) swap underneath. Composes 081KRW63S0008QG0R002XA5N6S (Bonsai+Rx) +
`Rx.fs`/`RxAdapter` (IQbservable/Reaqtor) + `StoredProc` (native-vs-interpreted).

## What it unlocks: LINQ over generator functions (Aaron 2026-06-08)

The payoff of homoiconic-over-owned-Rx: **LINQ over generator functions.** Because the ops are `IQbservable`
expression trees (queries *as data*), the **DST generators themselves** — the seeds, the clocks
(`tickingClock`), the qubit/phasor two-stream joins (`QubitIso`/`PhasorEndurance`), the `CoincidenceClock` —
become **first-class queryable**. You compose, filter, and transform the *generators* with the full LINQ
surface (`where`/`select`/`zip`/`join`/`groupBy`/`selectMany`/`aggregate`), and the resulting query is **data**
(serializable via Bonsai, DST-replayable, fork/join/rewind-able as a timeline).

This is the **IQbservable / Reaqtor** value proposition (LINQ over push-streams as expression trees) aimed at
**our DST generators** rather than generic observables. It closes a loop with the earlier arc: `BitGan.probe`
*discovers* a generator; now LINQ *composes over* generators — query the generators, not just their outputs.
**Peel:** LINQ-over-observables-as-expression-trees is De Smet's IQbservable (anchored, not novel); ours is
the application — LINQ over the *DST seed/clock/qubit generators* on the homoiconic zset substrate, where the
query is itself an event on the stream. Anchors: De Smet, *Observations on IQbservable*; Reaqtor; Meijer,
*Your Mouse is a Database* (LINQ-to-Observable).
