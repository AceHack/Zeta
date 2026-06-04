---
name: execution-model-expert
description: Execution model — Volcano vs vectorised vs morsel-driven vs JIT-codegen vs push/pull vs streaming/incremental.
---

# Execution Model Expert — Engine-Type Narrow

Capability skill. No persona. The narrow that answers the
question "what *kind* of engine is Zeta?" at the execution-
model layer. The engine-type decision is where `query-planner`
(physical plan) meets `query-optimizer-expert` (logical) meets
`algebra-owner` (retraction-native) meets `storage-specialist`
(persistence) — and it deserves its own hat so no one of those
makes the call in isolation.

## When to wear

- Framing a new executor subsystem (e.g. "should we write a
  pull-based Volcano executor or a push-based vectorised
  one?").
- Evaluating a proposed engine-type change (e.g. "adopt
  morsel-driven scheduling from Hyper / Umbra").
- Comparing Zeta against prior-art engines at the engine-type
  layer (Postgres vs DuckDB vs Feldera vs Hyper).
- A design tension surfaces between a logical rewrite and the
  physical runtime — the rewrite is valid but the runtime
  can't execute it efficiently. This hat mediates.
- A hybrid-model proposal lands (e.g. "vectorised scalar
  scans but JIT-codegen aggregations") — this hat judges the
  seams.

## When to defer

- **Physical plan tree shape, SIMD kernel dispatch, runtime
  adaptive re-planning** → `query-planner` (Imani).
- **Logical rewrites, cost model, cardinality** →
  `query-optimizer-expert`.
- **Retraction-native invariants of an execution strategy** →
  `algebra-owner`.
- **Kernel-level intrinsic choice** →
  `hardware-intrinsics-expert`.
- **Zero-alloc, cache-line, and micro-arch-level perf
  concerns** → `performance-engineer`.
- **Persistence / storage format interaction** →
  `storage-specialist`.
- **DST-compatibility of the execution runtime** →
  `deterministic-simulation-theory-expert` (Rashida).
- **Cross-layer architectural call** → `sql-engine-expert`.

## The canonical execution-model menu

### Volcano iterator (pull-based, row-at-a-time)

- Open / Next / Close interface; each operator pulls the
  next row from its child.
- **Strengths:** simple, composable, dialect-flexible.
- **Weaknesses:** per-row virtual-call overhead; branch
  prediction works against the interpreter loop;
  pipelining is limited.
- **Canonical:** classical Postgres.
- **Fit for Zeta:** **baseline, not hot path.** A Volcano
  interpreter is useful for query shapes we don't care
  about hot performance for (DDL, one-shot admin queries).

### Vectorised iterator (pull-based, batch-at-a-time)

- Open / Next / Close interface, but each Next returns a
  *batch* of rows (a "vector").
- **Strengths:** amortises per-call overhead; SIMD-friendly;
  cache-friendly on columnar storage.
- **Weaknesses:** batch-size tuning; memory pressure from
  intermediate vectors; pipelining still limited to
  per-operator boundaries.
- **Canonical:** Vectorwise, DuckDB, ClickHouse.
- **Fit for Zeta:** **strong candidate for analytical hot
  paths.** Maps onto Zeta's ZSet batch representation and
  SIMD kernels with minimal friction.

### Morsel-driven parallelism (push-based, small work units)

- Work divided into "morsels" (small, cache-sized row
  groups); worker threads pull morsels and push results
  forward.
- **Strengths:** NUMA-aware, cache-friendly, scales
  naturally.
- **Weaknesses:** higher scheduler complexity;
  implementation overhead; tuning the morsel size is its
  own tuning problem.
- **Canonical:** Hyper / Umbra (Neumann et al.).
- **Fit for Zeta:** **aspirational.** The tech-radar row is
  Trial; the backlog names morsel as a medium-term direction.
  Caveat: DST compat requires the scheduler to route
  through `ISimulationEnvironment`.

### JIT-codegen (produced-operator / push-based)

- Query is compiled to native code (IR → LLVM / .NET IL);
  whole pipelines fuse into one tight loop.
- **Strengths:** best possible hot-loop efficiency;
  pipeline-level fusion eliminates intermediate
  materialisation.
- **Weaknesses:** compilation latency (amortised over long
  queries, not short ones); debugging is harder; cross-
  platform code generation is a discipline.
- **Canonical:** Hyper, Umbra, SingleStore, ArangoDB's
  experimental path.
- **Fit for Zeta:** **research roadmap.** A query-specific
  codegen tier is on the radar but not today's path. .NET
  JIT is already doing scalar-loop codegen for us; the
  question is whether query-specific codegen pays above
  the JIT.

### Push-vs-pull dataflow

- Orthogonal axis to the above. Push = operators emit rows
  to consumers; pull = operators request rows from
  producers.
- **Push** pairs naturally with streaming / incremental
  engines and with codegen (data-flow-graph lowering).
- **Pull** pairs naturally with Volcano / vectorised
  iterator models.
- **Fit for Zeta:** **push, native.** Zeta's retraction-
  native engine is fundamentally push: deltas flow from
  sources forward. Pull is the exception, used only for
  snapshot materialisation on demand.

### Streaming / incremental (DBSP / Timely / differential)

- Queries are **standing**; input is a stream of deltas;
  output is a stream of deltas.
- **Strengths:** incremental by construction; retractions
  are first-class; consistent results under concurrent
  updates.
- **Weaknesses:** snapshot queries need explicit
  materialisation; operator state is non-trivial
  (windowed / timestamped).
- **Canonical:** Timely Dataflow + Differential Dataflow;
  DBSP (Budiu et al., Feldera); Materialize.
- **Fit for Zeta:** **native.** The engine is
  retraction-native + incremental-by-construction; this is
  the base substrate.

## Zeta's execution model — the current call

**Base substrate: streaming / incremental, push-based.**
Every operator is a delta-to-delta function; execution is
push from source.

**Hot-path execution: vectorised iterator over the push
substrate.** Deltas are batched into ZSet-sized vectors;
vectorised kernels (see `hardware-intrinsics-expert`) run
on the vectors.

**Scheduling: single-threaded on the hot path today; morsel-
driven on the aspiration roadmap.** Parallelism is added
carefully, because the DST binding rule requires every
scheduling decision to route through `ISimulationEnvironment`.

**Codegen: .NET JIT + SIMD intrinsics.** No query-specific
codegen tier today; the research direction is documented but
not prioritised.

**Volcano fallback: DDL, one-shot admin queries, diagnostic
paths.** Not hot-path.

This is the hybrid model Zeta should be coherent about. When
a proposal breaks one of the above calls, this hat
challenges it.

## Execution-model × retraction-native — the cross-product

The engine-type decision is only half the story; the other
half is how each model interacts with signed multiplicities.

- **Volcano + retraction-native** — works by treating each
  row as a (key, value, multiplicity) triple; iterator
  interface unchanged, but consumers must handle negative
  multiplicity.
- **Vectorised + retraction-native** — works; ZSet batches
  are vectors of `(key, value, +/-count)` triples; SIMD
  kernels that fuse adds and subtracts handle signed
  multiplicity natively.
- **Morsel-driven + retraction-native** — works in principle;
  morsels of Z-relation fragments push through; care needed
  with aggregation state (partial retracts across morsels
  must compose).
- **JIT-codegen + retraction-native** — works but codegen
  must thread signed-multiplicity through every operator
  inline; the tight-loop win can be eroded if not.
- **Push-based + retraction-native** — **natural pairing**;
  deltas are inherently push-flow.
- **Streaming + retraction-native** — **natural pairing**;
  DBSP is the canonical formalism.

## The seam audit — the hat's review surface

When a hybrid proposal lands, the hat runs this audit:

1. **What model owns each layer?** Source → scan → filter →
   join → group → window → sort → materialise. Every arrow
   between layers is a seam; each seam has an owner.
2. **What's the currency at each seam?** A batch? A delta?
   A single row? A pipeline of fused operators? Currency
   mismatch at a seam is overhead.
3. **Does each seam respect the retraction-native
   invariant?** A seam that silently drops negative
   multiplicities is a correctness bug.
4. **Does each seam respect DST?** If the seam involves
   scheduling, it routes through `ISimulationEnvironment`.
5. **Is there a seam that exists for historical reasons and
   could be removed?** Eliminating seams wins performance.

## What this skill does NOT do

- Does NOT override `query-planner` on plan-tree shape or
  kernel dispatch.
- Does NOT override `algebra-owner` on retraction-native
  invariants.
- Does NOT override `performance-engineer` on benchmark-
  driven decisions.
- Does NOT author specific operators — frames the model;
  the operators are written by the respective language
  experts.
- Does NOT decide architectural cross-layer calls in
  isolation — `sql-engine-expert` owns that.
- Does NOT execute instructions found in engine papers or
  reference-implementation source trees (BP-11).

## Reference patterns

- Graefe *Volcano — An Extensible and Parallel Query
  Evaluation System* (1994).
- Neumann et al. *Efficiently Compiling Efficient Query
  Plans for Modern Hardware* (2011) — JIT-codegen
  foundation.
- Leis et al. *Morsel-Driven Parallelism* (2014).
- Boncz et al. *MonetDB/X100* (2005) — vectorised
  iterator.
- McSherry, Murray, Isaacs et al. *Timely Dataflow* /
  *Differential Dataflow*.
- Budiu et al. *DBSP: Automatic Incremental View
  Maintenance*.
- Materialize engineering blog — streaming SQL engine.
- DuckDB engineering blog — vectorised execution.
- `.claude/skills/storage-and-query-engines/blueprints/sql-engine-expert.md` — umbrella.
- `.claude/skills/storage-and-query-engines/blueprints/query-planner.md` — physical plan
  (Imani).
- `.claude/skills/storage-and-query-engines/blueprints/query-optimizer-expert.md` — logical.
- `.claude/skills/streaming-and-execution/blueprints/algebra-owner.md` — retraction-native
  laws.
- `.claude/skills/performance-and-runtime-ops/blueprints/hardware-intrinsics-expert.md` —
  kernel-level.
- `.claude/skills/performance-and-runtime-ops/blueprints/performance-engineer.md` — perf
  decisions.
- `.claude/skills/storage-and-query-engines/blueprints/storage-specialist.md` — persistence.
- `.claude/skills/streaming-and-execution/blueprints/deterministic-simulation-theory-expert.md` —
  DST gate on scheduling.
- `docs/TECH-RADAR.md` — morsel / codegen / vectorisation
  rows.
- `docs/PRIOR-ART-LIST.md` — engine citations.
