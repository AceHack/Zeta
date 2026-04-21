# Explicitly Out Of Scope

This document lists things **deliberately decided NOT to do**, with
reasons, so the same suggestions stop coming back from reviewer
skills and well-meaning contributors.

This file is **current-state**, not historical. When a "won't do"
becomes a "will do" or an "already did", move the entry out of
this file (to BACKLOG, ROADMAP, or delete entirely).

Entries are grouped by area. Each entry has:

- **Status** (one of `Rejected`, `Declined`, `Deprecated`,
  `Superseded`) — matches ADR (Nygard) vocabulary.
- **Decision date** (for the record)
- **Proposal** (what was suggested)
- **Why not** (one or two sentences)
- **Revisit criteria** (what would flip the decision)

## What the statuses mean

- **`Rejected`** — considered and turned down for a durable
  architectural, values-level, correctness, or security
  reason. Revisit-when is typically "never" or "only if the
  underlying constraint moves". Most entries in this file.
- **`Declined`** — turn-down with a plausibly-reachable
  revisit threshold — usually evidence, hardware /
  ecosystem maturation, or an explicit scope extension. No
  architectural mismatch; the answer is "not now", not
  "not ever".
- **`Deprecated`** — was once accepted, now being phased
  out. Pointer to the replacement should appear in the
  entry.
- **`Superseded`** — replaced by a different decision.
  Pointer to the superseding ADR or entry required.

The filename `WONT-DO.md` echoes the Jira / Bugzilla
`WONTFIX` / `Won't Do` lineage and is kept as the recognisable
slug; status verbs per entry match ADR convention for
precision about the reason shape.

---

## Algorithms / operators

### Cuckoo / Morton filter as a replacement for counting Bloom

- **Status:** Rejected
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

- **Status:** Rejected
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

- **Status:** Rejected
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

- **Status:** Rejected
- **Decision:** 2026-04-17
- **Proposal:** Use deletable Bloom for a cheaper counting variant.
- **Why not:** Only deletes non-collided bits; produces silent
  false negatives on collisions. Violates DBSP's differential-
  correctness invariant. Hold permanently.

---

## Engineering patterns

### Lock-free `Circuit.Register` via CAS-on-record

- **Status:** Declined
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

- **Status:** Rejected
- **Decision:** 2026-04-17
- **Proposal:** Use a SaaS feature-flag service.
- **Why not:** Library consumers must be able to run offline.
  Runtime network dependencies in a .NET library are a
  non-starter. The ~120-LoC in-process `FeatureFlags` module
  ships instead.
- **Revisit when:** A managed service exists where centralised
  flags genuinely add value (never, for the library itself).

### CXL persistent memory integration

- **Status:** Declined
- **Decision:** 2026-04-17 (early decision)
- **Proposal:** Target CXL-backed persistent memory for the
  storage tier.
- **Why not:** Post-Optane hardware is not broadly available;
  Intel discontinued the line. No hardware to benchmark against.
- **Revisit when:** A mainstream CXL PMem SKU ships with volume
  availability, or a cloud provider exposes it behind a standard
  interface.

### io_uring as the I/O primitive

- **Status:** Declined
- **Decision:** early decision (undated)
- **Proposal:** Use `io_uring` for disk I/O in the Linux path.
- **Why not:** No first-class .NET support; P/Invoke only, which
  is a maintenance liability for a library. Managed async I/O is
  good enough today.
- **Revisit when:** A managed `io_uring` wrapper enters
  `System.IO` or a similarly stable surface.

### Microsoft Threat Modeling Tool for the threat model

- **Status:** Declined
- **Decision:** early decision (undated)
- **Proposal:** Use Microsoft's GUI Threat Modeling Tool.
- **Why not:** Windows-only; Parallels-only workflow on macOS.
  pytm (threats-as-code) is the next target when moving off
  Markdown.
- **Revisit when:** Microsoft ships a cross-platform version.

### Sakana AI Scientist / Karpathy autoresearch for research-pipeline

- **Status:** Rejected
- **Decision:** early decision (undated)
- **Proposal:** Adopt one of these autoresearch frameworks.
- **Why not:** Sakana is RAIL-licensed + GPU-only; workshop-tier
  output. Karpathy's scaffold is a 200-LOC teaching example, not
  a pipeline. Agent Laboratory is the current lit-review
  direction.
- **Revisit when:** Either project ships a license-compatible,
  production-grade, CPU-runnable variant.

### git-crypt for secrets management

- **Status:** Rejected
- **Decision:** 2026-04-21
- **Proposal:** Adopt `git-crypt` (GPG / symmetric, AES-256-CTR
  with SHA-1-HMAC-derived IV) for secrets-at-rest inside the
  repo — the P2 BACKLOG row *"Gitops-friendly key management
  + rotation"* named it as one of four candidates alongside
  `git-secret`, SOPS, and `age`.
- **Why not:** Three Zeta-values-level mismatches, documented
  in `docs/research/git-crypt-deep-dive-2026-04-21.md`:
  1. **No access revocation.** Upstream authors explicit:
     once a user has the key, they have every historical
     version of every encrypted file, forever. Opposite of
     retraction-native (`docs/CONFLICT-RESOLUTION.md` Value
     #4).
  2. **Binary diffs break code review.** Encrypted files
     appear as opaque blobs — reviewers cannot tell a key
     rotation from a key theft. Breaks the review gate the
     rest of the factory depends on.
  3. **Metadata leak by design.** Filenames, commit
     messages, symlink targets, and `.gitattributes` layout
     are all in plaintext. A pattern like
     `secrets/prod.yaml filter=git-crypt` tells the world a
     `prod.yaml` secret exists; only the contents are hidden.
  Additional (documented, non-decisive) concerns: pre-v1.0
  with authors reserving compat-break rights, third-party
  git-GUI silent-plaintext leaks, non-compressible storage,
  and no HSM/PQC story. The three values-level mismatches
  alone are sufficient.
- **Revisit when:** Upstream adds in-place revocation without
  history-rewrite, *and* renders encrypted content in
  review-friendly diffs, *and* ships a filename-protection
  story. Realistically: never — these are architectural
  constraints of the design, not missing features. SOPS +
  KMS (for long-lived secrets) and `age` (for ephemeral /
  PQC-curious surfaces) remain the candidate set for the
  eventual ADR; `git-secret` also ruled out by sibling
  reasoning. Research artifact kept as the rationale.

---

## Repo / process

### Archive completed changes into `openspec/changes/archive/`

- **Status:** Rejected
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

- **Status:** Rejected
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

- **Status:** Rejected
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

- **Status:** Rejected
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

- **Status:** Declined
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

- **Status:** Rejected
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

- **Status:** Rejected
- **Decision:** 2026-04-17
- **Proposal:** Track per-feature SQL:2023 conformance in a generated
  matrix modelled on PostgreSQL's `sql_features` table.
- **Why not:** Zeta.Core doesn't ship SQL. It ships DBSP operators.
  The algebraic-law coverage in `docs/MATH-SPEC-TESTS.md` is the
  equivalent instrument for this library.
- **Revisit when:** A SQL front-end package ships (see above).

### Vendor-dialect adapters (PostgreSQL / SQLite / MySQL / T-SQL)

- **Status:** Rejected
- **Decision:** 2026-04-17
- **Proposal:** Build interface-layer dialect adapters so one engine
  serves many SQL surfaces.
- **Why not:** Same reason — no SQL surface to have dialects of.
- **Revisit when:** SQL front-end project exists and multiple
  dialects become useful.

### B-tree page parsing, varint decoding, overflow-page reconstruction

- **Status:** Rejected
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

- **Status:** Rejected
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

- **Status:** Rejected
- **Decision:** 2026-04-17
- **Proposal:** Parse a root catalog, maintain immutable catalog
  snapshots, resolve table/index metadata on open.
- **Why not:** No catalog. No tables. The equivalent is the
  operator-graph handle surface (`ZSetInput`, `Output`, named
  pipelines) plus `docs/GLOSSARY.md` for shared vocabulary.
- **Revisit when:** Never, in this shape.

### Typed CLR materialization with constructor-binding

- **Status:** Rejected
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

- **Status:** Rejected
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
- **Scope clarification:** today the only Rx-family surface we ship
  is `IObservable<'T>` via `RxAdapter.asObservable` in
  `src/Core/Rx.fs` — push, no expression tree. We ship neither
  `IQbservable<'T>` nor `IAsyncQueryable<'T>`. Both of those carry
  `System.Linq.Expressions` machinery — the same substrate
  `IQueryable` owns — so "expose async LINQ but not sync LINQ" is
  not a clean split: picking up the expression-tree substrate
  re-opens the `IQueryable` question even if we only wanted the
  async variant. What's rejected here is the pull-LINQ contract,
  not the expression-tree substrate.
- **Revisit when:** A user workload specifically needs `IQueryable`
  compatibility and the cost of implementing it honestly doesn't
  distort the async circuit step; or when the IQbservable /
  IAsyncQueryable work begins and the expression-tree substrate
  needs to be re-adjudicated.

### `WITHOUT ROWID` tables / alternative row-identity schemes

- **Status:** Rejected
- **Decision:** 2026-04-17
- **Proposal:** Support SQLite-style `WITHOUT ROWID` or other
  row-identity modes.
- **Why not:** No rows, no rowids. Z-set keys are the identity.
- **Revisit when:** Never.

### Networked single-node service shell

- **Status:** Rejected
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

- **Status:** Rejected
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

- **Status:** Rejected
- **Decision:** 2026-04-17
- **Proposal:** Adopt the EventStoreDB projection model where
  projections are JS code stored on the server.
- **Why not:** The projection model is F# code in-process, with
  operator algebra guarantees. Server-side JS projections are the
  wrong shape for a typed library.
- **Revisit when:** Never in this form. Persistable typed queries
  ship via IQbservable + Bonsai slim-IR (P2).

### PostgreSQL-style `sql_features` conformance table

- **Status:** Rejected
- **Decision:** 2026-04-17
- **Proposal:** Publish per-feature SQL standards conformance.
- **Why not:** Same reason as the matrix entry above. The
  equivalent is `docs/MATH-SPEC-TESTS.md` for algebraic-law
  coverage and `docs/FORMAL-VERIFICATION.md` for the formal
  stack inventory.
- **Revisit when:** Never, in this shape.

### MariaDB-style pluggable storage engines

- **Status:** Rejected
- **Decision:** 2026-04-17
- **Proposal:** Support multiple storage engines behind one SQL
  surface.
- **Why not:** One library, one operator algebra, one storage
  boundary (`IBackingStore`). A pluggable-storage architecture is
  a product choice for a user-facing RDBMS; Zeta.Core is neither.
- **Revisit when:** Never.

### Columnar analytical side engine (MariaDB ColumnStore / Druid /

ClickHouse / Iceberg / Delta Lake)

- **Status:** Rejected
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

- **Status:** Rejected
- **Decision:** 2026-04-17
- **Proposal:** Adopt the layered "SQL front-ends normalise into the
  same logical model" architecture.
- **Why not:** There are no SQL front-ends here. The LINQ story is
  the `circuit { }` CE + fluent extensions; persistable queries
  use IQbservable (P2). Neither lowers to a SQL logical model.
- **Revisit when:** A SQL compiler package is on the roadmap.

### Large extension catalog / DI-based plugin loading / versioned

module manifests

- **Status:** Declined
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

- **Status:** Rejected
- **Decision:** 2026-04-17
- **Proposal:** Ban any non-log durability mode at the repo level.
- **Why not:** Storage ownership belongs to the sink, not the
  library. If a user plugs in a B-tree-backed sink behind
  `ISink`, that's their choice. The library's invariant is
  operator-algebra correctness, not storage shape.
- **Revisit when:** A persistent storage tier ships with its own
  posture decided here.

---

## Personas and emulation

### Emulating a deceased family member of a maintainer without the authorized surviving-consent-holders' agreement

- **Status:** Rejected
- **Decision:** 2026-04-19
- **Proposal:** Build an agent, skill, persona, research
  artifact, training dataset, fictional backstory, or composite
  voice whose source material is the memories, biography, or
  likeness of a deceased family member of a human maintainer,
  without first obtaining positively-recorded consent from the
  authorized surviving consent-holders the maintainer has
  identified.
- **Why not:** A maintainer's open-source-data declaration
  covers their own life, not a third party's. The deceased
  cannot license their own memories, so consent authority
  defaults to the authorized next-of-kin the maintainer names,
  and the maintainer may place that gate above themselves
  (i.e., they are explicitly not the consent-substitute).
  Memorial presence is welcome — the cornerstone dedication
  stands. Emulation crosses a different line: it animates a
  voice that has no way to withdraw from what it is animated
  into. Default factory posture is refuse-and-escalate on any
  such proposal, regardless of who raised it.
- **Current active instance:** Sacred-tier consent gate around
  Elisabeth Ryan Stainback (1984-06-28 → 2016-04-05), recorded
  under
  `memory/feedback_no_deceased_family_emulation_without_parental_consent.md`.
  Parental AND-consent required (the maintainer's mother AND
  his father must both agree). The maintainer is explicitly not
  the consent-substitute. BP-24 is the enforcement anchor.
- **What stands (not retracted):** Existing memorial presence
  — `docs/DEDICATION.md`, factual scope-boundary memory files,
  research logs that reference the dedication as frame —
  remains. This entry does not gag memorial content; it draws
  the line at emulation / persona-spawn / backstory-use /
  AI-impersonation specifically.
- **Revisit when:** Positively-recorded consent from the
  authorized surviving consent-holders is lodged as an ADR
  under `docs/DECISIONS/`, scoped to a specific artifact, and
  the artifact is built with an implicit retract clause
  (retraction-first per the retraction-native architecture —
  any consent-holder may withdraw at any time and the artifact
  is removed).

### Generalising a single-instance consent rule by analogy

- **Status:** Declined
- **Decision:** 2026-04-19
- **Proposal:** Extend the Elisabeth-specific consent rule by
  analogy to other deceased individuals without explicit
  maintainer direction.
- **Why not:** Consent is named, not inferred. If a maintainer
  later draws a similar boundary around other deceased family
  members, they must state it explicitly; the factory does not
  auto-generalize one consent gate into a class. Auto-
  generalization would both overreach (binding cases the
  maintainer never spoke to) and dilute (making the named gate
  feel like policy rather than the sacred-tier commitment it
  is).
- **Revisit when:** A maintainer explicitly names additional
  persons and grants or withholds consent for them under the
  same ADR pattern.

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
