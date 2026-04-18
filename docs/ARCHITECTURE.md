# Architecture Principles

Dbsp.Core is an F# implementation of the DBSP algebra (Budiu et al. VLDB'23).
It is not a transliteration of the Rust reference. This doc captures the
design principles the codebase is organised around — what it borrows,
what it rejects, and where the shape is going.

## Load-bearing commitments

- **Algebra at the core.** Z-set operators and their laws (`I ∘ D = id`,
  chain rule, distinct/H bound) are the system. Implementation serves them.
- **F# core, C#-native surface.** The library is written in F#; the C#
  surface is a first-class consumer via `[<Extension>]` and CLS-friendly
  signatures, not an afterthought.
- **Zero-alloc hot paths.** `ArrayPool`, `Span<T>`, struct comparers,
  `CollectionsMarshal` — measured, not asserted.
- **Result over exception.** User-visible errors flow through
  `Result<_, DbspError>` / `AppendResult`. Exceptions break referential
  transparency the operator algebra depends on.
- **Specs as source of truth.** Behavioural specs under `openspec/specs/`
  plus formal specs (`docs/*.tla`, `proofs/lean/`) describe what the code
  must satisfy. Code is regenerable from specs; the reverse is not.
- **Greenfield.** Pre-v1, no users, no backward-compatibility constraint.
  When the shape is wrong, it gets rewritten.

## Package split

```
Dbsp.Core            algebra, operators, Circuit/Stream/Op, sketches,
                     primitives (z^-1, integrate, differentiate), CRDTs
Dbsp.Tests.FSharp    F# xUnit v3 + FsUnit + FsCheck
Dbsp.Tests.CSharp    C# xUnit v3 — C# surface coverage
Dbsp.Benchmarks      BenchmarkDotNet + MemoryDiagnoser
Dbsp.Demo            sample app
```

The current inner core is one assembly. If a feature wants to evolve
independently (learned plan, Bayesian aggregates, Arrow wire, SQL front-
end, storage tiers), split it into its own project before it welds itself
into `Dbsp.Core`.

Seams exposed via DI:

- `IClock` — deterministic time
- `IMetricsSink` / `RecordingMetricsSink` — metrics capture for tests
- `IHashStrategy` / `IConsistentHash` — hashing plug points
- `IBackingStore` — state persistence
- `ISink` (2PC) / `IAppendSink` (event-log) — sinks
- `IWatermarkStrategy` — watermark policy (shipping with P1 KLL-statistical)

These are composition boundaries, not hot-path calls. Extension dispatch
happens once per pipeline build, not per tuple.

## What is borrowed

### DBSP (Budiu, McSherry, Ryzhyk, Tannen — VLDB'23)

- the algebra itself: D / I / z⁻¹ / H / Distinct / differentiation
- the chain rule and bilinear decomposition for joins
- semi-naïve LFP as the recursion primitive
- retractions as signed weights (`δ < 0`) rather than tombstones

### Materialize / Feldera / Differential Dataflow

- incremental-view maintenance as the product category
- Feldera's Rust operator surface as the "does it cover every real
  workload" checklist
- timely-dataflow multi-dimensional logical time as a research direction
  (see P3)

### Kafka / Kurrent (EventStore) / rqlite

- append-only log as a first-class primitive
- durable global positions kept distinct from stream-local revisions
- projections and checkpoints as explicit runtime concepts
- optimistic append with typed outcomes rather than exception control flow
- decoupling durable event delivery from internal replication/log
  truncation lifecycle

### FASTER (MSR)

- HybridLog (memory / read-only / stable regions) as the state layout
  model for anything disk-backed
- careful latch-free hot-path design over ambient-lock abstractions

### TigerBeetle / Antithesis

- deterministic simulation testing as the correctness strategy, not an
  add-on. `ChaosEnv` plus the `ISimulationDriver` unification (P1) live
  on this lineage; see `docs/FOUNDATIONDB-DST.md`.

### Datomic / XTDB 2

- AEVT/AVET/EAVT-style covering indexes as the target shape for
  closure-table work
- bitemporal modelling via Arrow segments as the P3 direction once the
  core time story is mature

### SlateDB

- CAS-on-manifest + writer-epoch fencing as the storage coordination
  pattern once a persistent storage tier is warranted

### Reaqtor / IQbservable

- expression-tree-based persistent queries (Bonsai slim-IR) as the model
  for persisted query shapes (P2)

### Apache Arrow + Flight

- IPC + zstd as the checkpoint wire format (P1)
- Flight bi-directional streaming as the multi-node delta-propagation
  protocol (P1)
- zero-copy columnar interchange for anything that crosses a process
  boundary

### Riak / delta-CRDTs

- dotted version vectors for nested-circuit iteration numbering
- convergence-aware replicated data types as explicit replication-layer
  types, not engine-core assumptions
- anti-entropy as a subsystem concern distinct from single-node
  correctness

### Modern MVCC research

- optimistic concurrency and latch minimisation where it holds
- memory-optimised, disk-capable architecture — plan for modern hardware,
  not 1990s disk era

## What is rejected

- **SQLite-derived on-disk format.** The reference Rust implementation is
  not the storage story here; see `docs/WONT-DO.md`.
- **Full-log-in-memory designs.** State lives on disk with FASTER-style
  regions as soon as size justifies it.
- **Synchronous-only I/O.** `IAsyncEnumerable`, `ValueTask`, and
  `backgroundTask` are the shape; fake-async wrappers over sync reads are
  a bug.
- **Exception-based error control flow** for user-visible failures.
  `Result` / `AppendResult` or equivalent typed outcome types.
- **1990s-era patterns** inherited from donor projects. Borrowed shapes
  are rewritten against current research (FASTER / TigerBeetle /
  SlateDB / Arrow), not against the donor's code.
- **"Defer all major version bumps"** as a heuristic. Latest stable is the
  default; downgrades need a documented rationale.
- **Binary-compatibility-first thinking.** Pre-v1, no promise.
- **Central feature-flag service** runtime dependency (see `docs/WONT-DO.md`).
- **Prompt-injection corpora** (elder-plinius family) under any pretext.

## Near-term architectural work

1. Finish the retraction-native recursion story. `RecursiveCounting`
   is shipped; the gap-monotone signed-delta variant is Assess.
2. Land the Arrow IPC + zstd checkpoint format and make it the default over
   the legacy JSON serialiser (P1).
3. Unify `ChaosEnv` + virtual-time scheduler + `ISimulatedFs` behind
   `ISimulationDriver` so every DST test runs through one surface (P1,
   `docs/FOUNDATIONDB-DST.md`).
4. Move content-addressed batches from `nextId` to `MerkleHash` through the
   Spine (P1).
5. Keep the operator algebra's formal-verification pipeline (TLA+ / Z3 /
   Lean 4 / FsCheck) strictly current with the F# surface; drift is a bug.
6. A real storage tier lands as a separate project with FASTER-style
   regions and SlateDB-style CAS-manifest semantics — not as another
   layer grafted onto `Dbsp.Core`.

## Formal-verification posture

Four ladders cover different bug classes:

- **TLA+ / TLC** — liveness and concurrency invariants (`docs/*.tla`,
  `docs/*.cfg`); 6 specs currently TLC-validated.
- **FsCheck** — algebraic laws as properties: idempotence of `I ∘ D`,
  chain-rule equivalence, Beam ACC/DISC/RET mode-collapse.
- **Z3 SMT** — pointwise axioms on weights and operators.
- **Lean 4 + Mathlib** — proof-grade algebraic claims. Currently
  `ChainRule.lean` is a `sorry`-bodied stub; the 2-week P2 push finishes
  it.

Research pass on coverage gaps in `docs/research/proof-tool-coverage.md`
(LiquidF#, Dafny, F*, Isabelle, Stainless, P#).

## The shape the future takes

- **Distribution via Arrow Flight.** Shard-level operators exchange Z-set
  deltas bi-directionally; consistent hashing routes (Jump / HRW /
  Memento) with power-of-two-choices (P2) for load-awareness.
- **Consensus where durability requires it.** Raft for the multi-node
  replicated log is P2. CAS-Paxos with state-transition-function
  consensus is the research-grade alternative (target: NSDI/OSDI).
- **Semiring-parametric Z-sets** — extend operators to any commutative
  semiring (tropical / Boolean / distributive lattice). PODS/ICDT target.
- **Typed, persistable queries** via IQbservable + Bonsai slim-IR (P2).
- **Verified core** — `D ∘ I = id` and the chain rule proved in Lean 4
  with Mathlib, rewrite-commute as a derived theorem.

None of this lands without a paper target or a measurable user win.
Dbsp.Core is a research library; publishability is a first-class
priority signal. See `docs/ROADMAP.md` for research opportunities
and CFPs.
