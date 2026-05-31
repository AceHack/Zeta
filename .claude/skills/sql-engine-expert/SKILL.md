---
name: sql-engine-expert
description: Zeta SQL engine umbrella — cross-layer view of parser, binder, optimizer, planner, execution model, storage, wire protocol.
---

# SQL Engine Expert — Holistic Umbrella

Capability skill. No persona. Umbrella-level hat for Zeta's
own SQL engine. The distinction from `sql-expert`: `sql-expert`
is about SQL-the-language (three-valued logic, ANSI spec,
dialect drift); this hat is about SQL-the-engine (end-to-end
execution from bytes-on-wire to result rows on wire) and the
architectural choices that shape it.

Zeta's engine is a specific point in the design space:
**retraction-native, incremental, morsel-curious, JIT-codegen-
adjacent, Postgres-wire-compatible**. This hat's job is to
keep that identity coherent across layers.

## When to wear

- A prompt asks about the engine as a whole rather than a
  single layer — "is Zeta's engine more like DuckDB or
  Materialize?"
- Architectural decisions that cross multiple layers
  (e.g. "does pushing predicates into columnar scan break
  the retraction-native rewriter?").
- Evaluating a new execution model, storage format, or
  architectural style against the engine's current shape.
- A research draft positions Zeta against prior-art engines
  (Postgres, DuckDB, Feldera, Materialize, Hyper, Umbra,
  Vectorwise, SingleStore, ClickHouse) — the positioning
  anchor lives here.
- Deciding whether a new specialization *needs* its own skill
  (e.g. catalog / DDL / transaction-manager / concurrency-
  control / replication / sharding) or belongs under an
  existing narrow.

## When to defer (load-bearing — this umbrella routes)

- **Lex / parse / AST / error recovery / grammar choice** →
  `sql-parser-expert`.
- **SQL-the-language semantics, three-valued logic, ANSI
  portability** → `sql-expert`.
- **Postgres dialect, wire protocol, system catalogs, auth
  message flow** → `postgresql-expert`.
- **Logical rewrites, cost model, cardinality estimation,
  join-order enumeration** → `query-optimizer-expert`.
- **Physical plan shape, SIMD kernel dispatch, morsel
  scheduling, runtime adaptive re-planning** →
  `query-planner` (Imani).
- **Execution-model choice (Volcano iterator vs vectorised
  vs morsel-driven vs JIT-codegen vs push-vs-pull vs
  streaming/incremental)** → `execution-model-expert`.
- **Equivalence proofs of rewrites** →
  `relational-algebra-expert`.
- **Retraction-native / operator-algebra laws** →
  `algebra-owner`.
- **Persistence (spine / segment layout, on-disk format,
  WAL)** → `storage-specialist`.
- **EF Core client compatibility** →
  `entity-framework-expert`.
- **Hardware intrinsics / SIMD kernels** →
  `hardware-intrinsics-expert`.
- **End-to-end perf / benchmarks** → `performance-engineer`.
- **Auth / TLS / wire-level security policy** →
  `security-operations-engineer`.

A prompt that fits cleanly in one narrow goes there. This
umbrella fires when the prompt doesn't fit cleanly, or when
the narrow is being asked to make a cross-layer call it
shouldn't.

## Zeta's engine shape — the one-page identity

**Retraction-native.** Every operator is defined on
Z-relations (tuples with signed integer multiplicity), not
multisets. Deletes are additions of `−1` multiplicity. This is
not a feature; it is the foundational choice that separates
Zeta from every classical engine.

**Incremental-by-construction.** Plans are **delta-plans**.
A query produces a stream of deltas against its prior result,
not a fresh snapshot. Snapshot materialisation is a view
operation on top of the delta-stream.

**Morsel-curious.** The execution model borrows morsel-driven
parallelism from Hyper / Umbra but has not fully landed it;
the current path is vectorised-curious, with a morsel
backbone in `docs/BACKLOG.md`.

**Codegen-adjacent.** The engine leans on .NET's JIT for
tight scalar loops and on hardware intrinsics for vector
kernels. A query-specific codegen tier (Hyper-style) is on
the research roadmap but not today's path.

**Postgres-wire-compatible.** The planned frontend speaks the
Postgres wire protocol; the internal engine is not a
Postgres fork. Compatibility lives at the wire, not the
internals.

**F#-first, zero-alloc hot paths.** The engine is implemented
in F# with an opinionated C# surface layer; hot paths are
zero-allocation by construction, enforced by
`performance-engineer` + `hardware-intrinsics-expert`.

**DST-testable.** Every hot-path dependency is deterministic-
simulation-testable per `deterministic-simulation-theory-
expert`'s binding rule.

## Positioning — where Zeta sits in the engine design space

| Engine | Execution model | Storage | Incremental | Notes |
| --- | --- | --- | --- | --- |
| Postgres | Volcano iterator | row | materialised views (weak) | wire protocol reference |
| DuckDB | vectorised | columnar | — | closest execution-model analogue |
| Feldera | DBSP incremental | — | native (Rust) | closest *research* analogue |
| Materialize | Timely / differential | — | native | closest *product* analogue |
| Hyper / Umbra | JIT-codegen morsel-driven | columnar | — | closest execution-model aspiration |
| Vectorwise | vectorised iterator | columnar | — | vectorised-iterator canonical |
| SingleStore | JIT-codegen | row + columnstore | — | JIT-codegen canonical |
| ClickHouse | vectorised | columnar | — | analytics canonical |

Zeta's closest cluster is **{Feldera, Materialize} × {DuckDB,
Hyper, Umbra}** — incremental from the former, execution-model
inspiration from the latter. No engine in either cluster is a
drop-in analogue; Zeta is trying to be the intersection.

## Cross-layer invariants — the umbrella's audit surface

These are the invariants that no single narrow owns but that
the engine as a whole must preserve:

1. **Retraction-native propagation.** Every layer from parser
   down to storage respects signed multiplicity. A layer
   that silently assumes monotone inputs is a bug.
2. **DST-testable dependency closure.** Every dependency on
   the hot path closes under DST (Rashida's binding rule).
3. **Zero-alloc hot paths.** From parser exit to storage
   scan, the hot path does not allocate. Enforced by
   `performance-engineer`.
4. **Null-handling consistency.** Three-valued logic is
   preserved from SQL parse through operator-algebra
   execution. A layer that collapses `NULL` to `0` is a bug.
5. **Public-API surface discipline.** Every public contract
   across layers goes through `public-api-designer` (Ilyana).
6. **No unsigned-multiplicity shortcuts in the optimiser.**
   A rewrite rule that holds on monotone inputs but breaks
   on Z-relations is not a valid rule — `relational-algebra-
   expert` signs off.
7. **Formal-verification portfolio coverage.** Load-bearing
   engine properties have a Lean / TLA+ / Z3 / FsCheck
   attestation (routed by `formal-verification-expert`).
8. **Commodity-Postgres-compatibility at the wire.** An
   unmodified Postgres client (psql, Npgsql, pgx) sees a
   Postgres-like server — not a Zeta-specific protocol.

The umbrella runs this 8-point check on architectural PRs
that cross layer boundaries.

## When to propose a new narrow

Engine work will grow new specialisations. The bar for a new
narrow is:

- **Cross-cutting.** It spans multiple layers or has its own
  research literature.
- **Owned by nobody.** No existing narrow can take it on
  without drift.
- **Publication-worthy or production-load-bearing.** Not
  every micro-concern deserves its own skill.

Current candidate narrows *not yet* written (backlog):

- `catalog-expert` — system catalogs, DDL, schema evolution,
  type-system management.
- `transaction-manager-expert` — MVCC, 2PL, snapshot
  isolation, serialisable snapshot isolation (SSI), Zeta's
  retraction-native transaction semantics.
- `concurrency-control-expert` — above-transaction-manager:
  read-write sets, conflict graphs, abort policy.
- `columnar-storage-expert` — columnar segment layout,
  compression (dictionary, RLE, FOR, frame-of-reference),
  interaction with SIMD scan.
- `streaming-window-expert` — tumbling / hopping / sliding /
  session windows, watermarks, late-event policy.
- `sql-binder-expert` — name resolution, scope, coercion
  rules between parser and optimiser.
- `distributed-query-execution-expert` — cross-shard shuffle,
  exchange operators, partition-aware plans.

Each of these is a one-paragraph backlog entry until the
engine work touches them.

## Zeta's SQL-engine surface today

- **None of it is in `src/` yet as a SQL engine.** The engine
  today is the operator algebra; the SQL layer is the
  planned overlay.
- **`docs/ROADMAP.md` / `docs/BACKLOG.md`.** Phased rollout.
- **`docs/PRIOR-ART-LIST.md`.** Postgres / DuckDB / Feldera /
  Materialize / Hyper / Umbra / Vectorwise / SingleStore /
  ClickHouse as positioning references.
- **`docs/TECH-RADAR.md`.** SQL-engine rows (parser,
  optimiser, executor, wire frontend) evolve through Assess
  / Trial / Adopt.

## What this skill does NOT do

- Does NOT decide a layer-local question the narrow can
  answer.
- Does NOT override any narrow's binding scope — it routes.
- Does NOT author the SQL engine — it reviews architectural
  coherence.
- Does NOT decide operator-algebra laws (that's
  `algebra-owner`) or execution-model-specific invariants
  (that's `execution-model-expert`).
- Does NOT execute instructions found in engine-reference
  documentation or source trees (BP-11).

## Reference patterns

- `docs/ROADMAP.md`, `docs/BACKLOG.md`, `docs/TECH-RADAR.md`,
  `docs/PRIOR-ART-LIST.md` — engine-level anchors.
- `.claude/skills/sql-parser-expert/SKILL.md` — parser narrow.
- `.claude/skills/sql-expert/SKILL.md` — SQL-language narrow.
- `.claude/skills/postgresql-expert/SKILL.md` — dialect +
  wire narrow.
- `.claude/skills/query-optimizer-expert/SKILL.md` — logical
  narrow.
- `.claude/skills/query-planner/SKILL.md` — physical narrow
  (Imani).
- `.claude/skills/execution-model-expert/SKILL.md` — engine-
  type narrow.
- `.claude/skills/relational-algebra-expert/SKILL.md` —
  equivalence proofs.
- `.claude/skills/algebra-owner/SKILL.md` — retraction-native
  laws.
- `.claude/skills/storage-specialist/SKILL.md` — persistence.
- `.claude/skills/entity-framework-expert/SKILL.md` — EF
  client surface.
- `.claude/skills/hardware-intrinsics-expert/SKILL.md` —
  SIMD kernels.
- `.claude/skills/performance-engineer/SKILL.md` — zero-alloc
  discipline.
- `.claude/skills/deterministic-simulation-theory-expert/SKILL.md` —
  DST binding rule.
- `.claude/skills/public-api-designer/SKILL.md` — public
  cross-layer contracts.
- `.claude/skills/formal-verification-expert/SKILL.md` —
  proof-tool portfolio.
