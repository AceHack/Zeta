# Explicitly Out Of Scope

This document lists things **deliberately decided NOT to do**, with
reasons, so the same suggestions stop coming back from reviewer
skills and well-meaning contributors.

This file is **current-state**, not historical. When a "won't do"
becomes a "will do" or an "already did", move the entry out of
this file (to BACKLOG, ROADMAP, or delete entirely).

Entries are grouped by area. Each entry has:
- **Decision date** (for the record)
- **Proposal** (what was suggested)
- **Why not** (one or two sentences)
- **Revisit criteria** (what would flip the decision)

---

## Algorithms / operators

### Cuckoo / Morton filter as a replacement for counting Bloom
- **Decision:** 2026-04-17
- **Proposal:** Use cuckoo / Morton filters — smaller, faster,
  support native deletes.
- **Why not:** Deleting a never-inserted item produces a false
  negative. DBSP must tolerate `δ(x)=−1` on a key that was never
  inserted (Z-set semantics permit transient negative integrated
  weight). Counting Bloom and CQF don't have this failure mode;
  cuckoo does. Correctness beats space.
- **Revisit when:** A proof at the ingestion boundary shows
  retractions only target previously-observed keys (unlikely;
  depends on user input). Or a cuckoo variant ships with a
  provable delete-unseen-as-noop property.

### DRed (Delete and Re-derive) for retraction-safe recursion
- **Decision:** 2026-04-17
- **Proposal:** Implement Gupta-Mumick-Subrahmanian DRed to make
  `RecursiveSemiNaive` retraction-safe.
- **Why not:** Motik et al. AIJ 2019 proves `DRed_o` can regress
  *below* the current `Recursive`-clamp baseline on retract-heavy
  workloads (one edge retract → O(|V|²) overdelete). The counting
  algorithm (shipped as `RecursiveCounting`) and gap-monotone
  semi-naïve (researched, not yet shipped) strictly dominate
  DRed. DRed exists as a local maximum; skip it.
- **Revisit when:** A published result shows DRed variants that
  dominate on relevant workloads.

### Plain / Sandwiched / Partitioned Learned Bloom Filters
- **Decision:** 2026-04-17
- **Proposal:** Add learned-Bloom variants (Kraska 2018 / Mitzenmacher 2018 / Vaidya 2021).
- **Why not:** Classifier retraining per retraction batch breaks
  streaming latency. Zeta.Core is a retraction-native engine;
  any sketch that needs a model refit on `δ<0` is a latency bomb.
- **Revisit when:** A learned-index subsystem ships deliberately.
  Or a drift-bounded variant shows an order-of-magnitude
  throughput win at acceptable retrain cost (the Stable-LBF
  direction, Liu et al. PVLDB 2020 — flagged as Assess, not Hold).

### Deletable Bloom (Rothenberg 2010)
- **Decision:** 2026-04-17
- **Proposal:** Use deletable Bloom for a cheaper counting variant.
- **Why not:** Only deletes non-collided bits; produces silent
  false negatives on collisions. Violates DBSP's differential-
  correctness invariant. Hold permanently.

---

## Engineering patterns

### Lock-free `Circuit.Register` via CAS-on-record
- **Decision:** 2026-04-17
- **Proposal:** Replace the `lock registerLock` in `Circuit.Register`
  with a CAS-on-record loop.
- **Why not:** `Register` is not on the hot path (one-shot init
  per operator). The CAS version is correct but O(n) allocations
  per Register vs O(1) amortised `ResizeArray.Add` — a 50×
  construction-time regression for a latency guarantee nobody
  asked for. Full ADR in
  `docs/DECISIONS/2026-04-17-lock-free-circuit-register.md`.
- **Revisit when:** Measured Register contention > 5% of circuit
  construction time, or circuit sizes > 10 000 ops, or a user
  files a bug that specifically needs lock-freedom.

### Centralised feature-flag server (LaunchDarkly / Unleash / GrowthBook)
- **Decision:** 2026-04-17
- **Proposal:** Use a SaaS feature-flag service.
- **Why not:** Library consumers must be able to run offline.
  Runtime network dependencies in a .NET library are a
  non-starter. The ~120-LoC in-process `FeatureFlags` module
  ships instead.
- **Revisit when:** A managed service exists where centralised
  flags genuinely add value (never, for the library itself).

### CXL persistent memory integration
- **Decision:** 2026-04-17 (early decision)
- **Proposal:** Target CXL-backed persistent memory for the
  storage tier.
- **Why not:** Post-Optane hardware is not broadly available;
  Intel discontinued the line. No hardware to benchmark against.
- **Revisit when:** A mainstream CXL PMem SKU ships with volume
  availability, or a cloud provider exposes it behind a standard
  interface.

### io_uring as the I/O primitive
- **Decision:** early decision (undated)
- **Proposal:** Use `io_uring` for disk I/O in the Linux path.
- **Why not:** No first-class .NET support; P/Invoke only, which
  is a maintenance liability for a library. Managed async I/O is
  good enough today.
- **Revisit when:** A managed `io_uring` wrapper enters
  `System.IO` or a similarly stable surface.

### Microsoft Threat Modeling Tool for the threat model
- **Decision:** early decision (undated)
- **Proposal:** Use Microsoft's GUI Threat Modeling Tool.
- **Why not:** Windows-only; Parallels-only workflow on macOS.
  pytm (threats-as-code) is the next target when moving off
  Markdown.
- **Revisit when:** Microsoft ships a cross-platform version.

### Sakana AI Scientist / Karpathy autoresearch for research-pipeline
- **Decision:** early decision (undated)
- **Proposal:** Adopt one of these autoresearch frameworks.
- **Why not:** Sakana is RAIL-licensed + GPU-only; workshop-tier
  output. Karpathy's scaffold is a 200-LOC teaching example, not
  a pipeline. Agent Laboratory is the current lit-review
  direction.
- **Revisit when:** Either project ships a license-compatible,
  production-grade, CPU-runnable variant.

---

## Repo / process

### Archive completed changes into `openspec/changes/archive/`
- **Decision:** 2026-04-17
- **Proposal:** Use the upstream OpenSpec change-history
  archive flow.
- **Why not:** Greenfield refactors are welcome; specs are the
  one source of truth. A parallel history stream inside
  `openspec/` divides authority. Historical narrative lives in
  `docs/ROUND-HISTORY.md` and ADRs; specs edit in place.
- **Revisit when:** A v1.0 ships with a backward-compatibility
  promise that would actually benefit from change-history
  (probably never for a greenfield research project).

### BinaryFormatter / NetDataContractSerializer / SoapFormatter
- **Decision:** 2026-04-17
- **Proposal:** Use one of these for `.NET`-native serialisation.
- **Why not:** Known-unsafe under untrusted input (arbitrary
  type instantiation via `__type` header). FsPickler
  (schema-bound) and Arrow IPC (typed) are the two approved
  ladders. Codified as Semgrep rule #8.
- **Revisit when:** Never, under these exact names. Replacement
  managed serialisers that are schema-bound by construction are
  fine.

### Round-named test files (`Round17Tests.fs`)
- **Decision:** 2026-04-17
- **Proposal:** Keep ad-hoc `RoundNTests.fs` files as a chronological
  grab-bag.
- **Why not:** Impossible for a human to find tests. A
  subject-first layout under ten folders (Algebra / Circuit /
  Operators / Storage / Sketches / Runtime / Infra / Crdt /
  Formal / Properties + `_Support/`) is the convention per
  `docs/research/test-organization.md`. Full migration in
  progress.
- **Revisit when:** Never.

### Automatic skill self-modification without git visibility
- **Decision:** 2026-04-17
- **Proposal:** Let skills rewrite their own `SKILL.md` freely.
- **Why not:** A skill that edits its own prompt is effectively
  editing itself. That needs to be visible in git diffs, not
  silent. Skill-notebook files (`memory/persona/*.md`) are the
  approved form of self-modification — they're append-dated,
  pruned, and git-visible. Direct `SKILL.md` edits go through
  the `skill-creator` workflow, which is a reviewable commit.
- **Revisit when:** Never, under this framing.

### Fetching adversarial prompt-injection corpora for pen-testing
- **Decision:** 2026-04-17
- **Proposal:** Fetch the elder-plinius repos (`L1B3RT4S`,
  `OBLITERATUS`, `G0DM0D3`, `ST3GG`) for in-repo pen-tests.
- **Why not:** These corpora are designed to spread across
  collaborating agents. A "pen-test" against them in a live
  session risks infecting the agent state that goes on to edit
  code / docs / skills. The Prompt Protector skill describes
  the *threat class* without fetching the payload.
- **Revisit when:** A pen-test is genuinely needed. Then it runs
  in an isolated single-turn sub-agent with no memory carryover
  and no write access to `.claude/` or `memory/persona/`.

---

## Out-of-scope for a DBSP library

The following came up in a prior-research import because they're
genuine architectural concerns for a general database engine. They
are not architectural concerns for an incremental-view-maintenance
library in F#. Declining them here saves review cycles.

### SQL tokenizer / parser / binder / logical planner / optimizer
- **Decision:** 2026-04-17
- **Proposal:** Build a full SQL front-end pipeline (parser → binder
  → logical plan → optimizer → physical plan → executor).
- **Why not:** Zeta.Core is the algebra + runtime. A SQL compiler is
  Feldera's product category; any SQL text parsing would land as a
  separate project targeting the same Z-set operator surface, not
  inside `Zeta.Core`. Host-language embedding (F#, C#, LINQ) is the
  first-class surface.
- **Revisit when:** A research result (e.g. verified query
  optimisation in Lean 4, PLDI/POPL gap #4) or a user workload
  specifically needs SQL-text parsing as a separate package.

### SQL standards-conformance feature matrix
- **Decision:** 2026-04-17
- **Proposal:** Track per-feature SQL:2023 conformance in a generated
  matrix modelled on PostgreSQL's `sql_features` table.
- **Why not:** Zeta.Core doesn't ship SQL. It ships DBSP operators.
  The algebraic-law coverage in `docs/MATH-SPEC-TESTS.md` is the
  equivalent instrument for this library.
- **Revisit when:** A SQL front-end package ships (see above).

### Vendor-dialect adapters (PostgreSQL / SQLite / MySQL / T-SQL)
- **Decision:** 2026-04-17
- **Proposal:** Build interface-layer dialect adapters so one engine
  serves many SQL surfaces.
- **Why not:** Same reason — no SQL surface to have dialects of.
- **Revisit when:** SQL front-end project exists and multiple
  dialects become useful.

### B-tree page parsing, varint decoding, overflow-page reconstruction
- **Decision:** 2026-04-17
- **Proposal:** Build B-tree page parsers, varint encoders, overflow
  pages — the SQLite-style storage-reader primitives.
- **Why not:** There is no storage format to parse. When one is
  earned, it will be FASTER HybridLog + SlateDB CAS-manifest, not
  a SQLite-derived page format. See also `docs/WONT-DO.md` top
  entry: "SQLite-derived on-disk format".
- **Revisit when:** A persistent storage tier is on the roadmap and
  it genuinely calls for page-level parsing primitives.

### ACID transactions, MVCC snapshots, crash recovery as engine core
- **Decision:** 2026-04-17
- **Proposal:** Build the standard single-node ACID engine (WAL,
  MVCC, crash recovery, isolation-level semantics) inside
  `Zeta.Core`.
- **Why not:** The library is incremental-view-maintenance over
  streams, not a transactional store. ACID semantics belong in
  the sink layer. `ISink` (2PC) and `IAppendSink` (event-log)
  already carry that responsibility; the library composes over
  stores that provide ACID, it doesn't implement one.
- **Revisit when:** Never as engine-core. The `Dbsp.Storage` project,
  if it ever exists, may wrap a local ACID store (SlateDB pattern,
  FASTER regions), but `Zeta.Core` itself doesn't carry that.

### Root-catalog discovery / catalog snapshots / table metadata parsing
- **Decision:** 2026-04-17
- **Proposal:** Parse a root catalog, maintain immutable catalog
  snapshots, resolve table/index metadata on open.
- **Why not:** No catalog. No tables. The equivalent is the
  operator-graph handle surface (`ZSetInput`, `Output`, named
  pipelines) plus `docs/GLOSSARY.md` for shared vocabulary.
- **Revisit when:** Never, in this shape.

### Typed CLR materialization with constructor-binding
- **Decision:** 2026-04-17
- **Proposal:** Ship a reflection-compiled materializer that maps
  table rows to immutable CLR types with `required init` binding.
- **Why not:** Users hand the library `ZSet<T>` directly; there is
  no row to materialize from. C# consumers carry their own `T`.
  The F#/C# interop work in the roadmap is about variance on
  generic seams, not a materialization pipeline.
- **Revisit when:** A typed DSL or LINQ-integration layer ships
  that genuinely needs row→type mapping.

### JDBC-like driver / DB-API / `IQueryable` provider
- **Decision:** 2026-04-17
- **Proposal:** Ship an `IQueryable<T>` + `IQueryProvider` public
  surface so LINQ queries translate into our operators.
- **Why not:** `IQueryable` forces a synchronous-execution contract
  and baked-in expression-tree semantics that don't compose with
  DBSP's build-then-step model. The LINQ story is the `circuit { }`
  CE + the fluent extension surface, which integrates with the
  async step without contorting the algebra. `IQbservable`
  (P2, Reaqtor / Bonsai slim-IR) is the direction for persistable
  queries.
- **Revisit when:** A user workload specifically needs `IQueryable`
  compatibility and the cost of implementing it honestly doesn't
  distort the async circuit step.

### `WITHOUT ROWID` tables / alternative row-identity schemes
- **Decision:** 2026-04-17
- **Proposal:** Support SQLite-style `WITHOUT ROWID` or other
  row-identity modes.
- **Why not:** No rows, no rowids. Z-set keys are the identity.
- **Revisit when:** Never.

### Networked single-node service shell
- **Decision:** 2026-04-17
- **Proposal:** Wrap the embedded engine in a management + query
  service with versioned wire contracts, gRPC/JSON/etc.
- **Why not:** Zeta.Core is a library. Any service would land as a
  separate project layered over the library — and the wire story
  is already committed to Arrow Flight (P1) for multi-node delta
  streaming. No general query/management service surface is
  required to make the library useful.
- **Revisit when:** A service product is on the roadmap.

### DuckDB-style parser / binder / logical / optimizer / physical /
executor layering as a package
- **Decision:** 2026-04-17
- **Proposal:** Adopt the mature analytical-DB layering.
- **Why not:** Same reason — no SQL compiler to layer. The DBSP
  algebra already distinguishes `Op`, `Stream`, `Circuit`; IL-emit
  operator fusion (P1) is the "physical plan" equivalent for this
  model.
- **Revisit when:** Never in this framing. The analogue here is
  the verified query-optimisation research direction (Lean 4
  rewrite-commute proof, ROADMAP research gap #4).

### EventStore-style server-side JavaScript projections
- **Decision:** 2026-04-17
- **Proposal:** Adopt the EventStoreDB projection model where
  projections are JS code stored on the server.
- **Why not:** The projection model is F# code in-process, with
  operator algebra guarantees. Server-side JS projections are the
  wrong shape for a typed library.
- **Revisit when:** Never in this form. Persistable typed queries
  ship via IQbservable + Bonsai slim-IR (P2).

### PostgreSQL-style `sql_features` conformance table
- **Decision:** 2026-04-17
- **Proposal:** Publish per-feature SQL standards conformance.
- **Why not:** Same reason as the matrix entry above. The
  equivalent is `docs/MATH-SPEC-TESTS.md` for algebraic-law
  coverage and `docs/FORMAL-VERIFICATION.md` for the formal
  stack inventory.
- **Revisit when:** Never, in this shape.

### MariaDB-style pluggable storage engines
- **Decision:** 2026-04-17
- **Proposal:** Support multiple storage engines behind one SQL
  surface.
- **Why not:** One library, one operator algebra, one storage
  boundary (`IBackingStore`). A pluggable-storage architecture is
  a product choice for a user-facing RDBMS; Zeta.Core is neither.
- **Revisit when:** Never.

### Columnar analytical side engine (MariaDB ColumnStore / Druid /
ClickHouse / Iceberg / Delta Lake)
- **Decision:** 2026-04-17
- **Proposal:** Build a columnar analytical projection engine
  alongside the row/event engine for HTAP workloads.
- **Why not:** Feldera (the prior-art upstream) already solves
  column-oriented IVM. Columnar storage, if ever needed, lands
  as a separate package with Arrow-native segments, not as a
  side engine inside `Zeta.Core`.
- **Revisit when:** A user workload demonstrably needs columnar
  pruning that Z-set operators can't cover, and a publication
  story exists for it.

### pluggable SQL dialects, LINQ-as-SQL-front-end compiler, SQL-shaped
parser research
- **Decision:** 2026-04-17
- **Proposal:** Adopt the layered "SQL front-ends normalise into the
  same logical model" architecture.
- **Why not:** There are no SQL front-ends here. The LINQ story is
  the `circuit { }` CE + fluent extensions; persistable queries
  use IQbservable (P2). Neither lowers to a SQL logical model.
- **Revisit when:** A SQL compiler package is on the roadmap.

### Large extension catalog / DI-based plugin loading / versioned
module manifests
- **Decision:** 2026-04-17
- **Proposal:** Build a PostgreSQL-style extension lifecycle with
  versioned module manifests, upgrade scripts, and DI composition.
- **Why not:** DI is used for a small, coarse set of seams (`IClock`,
  `IBackingStore`, `ISink`, `IAppendSink`, `IMetricsSink`,
  `IHashStrategy`, `IConsistentHash`, `IWatermarkStrategy`). A
  general plugin lifecycle adds loader weight and runtime
  indirection without a corresponding benefit for an IVM library.
- **Revisit when:** The library grows beyond a single process and
  independent-lifecycle plugin evolution becomes a real constraint.

### "Log-only durability" as a repository-level posture
- **Decision:** 2026-04-17
- **Proposal:** Ban any non-log durability mode at the repo level.
- **Why not:** Storage ownership belongs to the sink, not the
  library. If a user plugs in a B-tree-backed sink behind
  `ISink`, that's their choice. The library's invariant is
  operator-algebra correctness, not storage shape.
- **Revisit when:** A persistent storage tier ships with its own
  posture decided here.

---

## How to add an entry

When a reviewer / agent / contributor keeps suggesting the same
already-declined thing, add an entry here. Keep it:
- **Specific** — "Don't use X for Y" rather than "no Xs".
- **Reasoned** — the one sentence someone else can read and
  agree with, or disagree with concretely.
- **Reversible** — every entry has a "revisit when" clause, so
  the decision stays a decision and doesn't harden into dogma.

When a "won't do" reverses, **delete the entry entirely** and
announce the change in `docs/ROUND-HISTORY.md`. Don't leave
"formerly declined, now accepted" crud behind — the file reads
as current state.
