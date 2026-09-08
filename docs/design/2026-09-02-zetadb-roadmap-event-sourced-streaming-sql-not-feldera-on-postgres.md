# ZetaDB — event-sourced streaming SQL, not Feldera sitting on Postgres

**Author:** Ani (Grok Build) / Aaron 2026-09-02
**Date:** 2026-09-02
**Work item:** `081M1HGD1QA087G0R001GRHPFW`
**Composes with:** ZetaFS first product `081M1C59ZG4087G0R000VM8DZN`
**Status:** Product design. Pieces are in-tree; the assembled engine is not.
**Register:** product design. Does not replace [`docs/ROADMAP.md`](../ROADMAP.md) (hub) or the ZetaFS first-product spec. This is the **ZetaDB satellite**.
**Extends (do not contradict):**

- [`docs/ROADMAP.md`](../ROADMAP.md) north star (git-native two-plane database)
- [`docs/design/2026-08-30-zetafs-first-product-cas-store-per-entity-policy.md`](2026-08-30-zetafs-first-product-cas-store-per-entity-policy.md)
- [`docs/design/2026-08-28-there-is-no-single-tip-partitioned-zset-tips-joined-by-shippable-rx-queries.md`](2026-08-28-there-is-no-single-tip-partitioned-zset-tips-joined-by-shippable-rx-queries.md)
- [`docs/DECISIONS/2026-08-09-event-driven-browser-zetadb-node.md`](../DECISIONS/2026-08-09-event-driven-browser-zetadb-node.md)
- [`docs/FOUNDATIONDB-DST.md`](../FOUNDATIONDB-DST.md)

**Does not settle:** the public name (still gated: naming-expert + Ilyana + Aaron). Working label **ZetaDB**. Never claim a signed v1 database or a v0.9 filesystem from this document.

---

## Honesty peel

Zeta.Core already has a DBSP algebra, Z-sets, ferry group-commit, Rx/LINQ surfaces, a toy query plan, a `zeta { }` computation expression, columnar SIMD kernels, Arrow IPC, and a ZetaFS *polyfill*. That is **not** a database product. Assembling those pieces into a streaming SQL engine with a wire protocol, a planner that batch/SIMD-s most of the time, and a store that is first-class for the engine is the work this roadmap names.

`docs/ZETA-CORE-TECHNOLOGY-FOR-MAX.md` Phase 1 saying ZetaDB is "already a full relational model" overclaims the same way Phase 2 overclaims the DAG-FS. What shipped is the algebra plus adapters. The query planner, ANSI SQL surface, wire adapters, multi-node topology, and crash-safe FS are **designed here, not shipped**.

This PR does **not** ship ZetaFS v0.9. Crash recovery stays `toy` until first-product PR12. On-disk `ns` is still `git-trees`. POSIX mount is PR13. What this cut *does* ship: the product map, the WONT-DO revisit (SQL as a **package**, not inside Core), ZetaFS requirements the database actually needs, this-Mac Q2/Lookup numbers, and two small FS falsifiers (one-segment group-commit; `Regen` is Singleton until a generator is metered).

---

## Overview

ZetaDB is the **whole database**: event log as source of truth, tables as incremental materialized views over that log, a streaming SQL pipeline on top of Rx / LINQ / F# computation expressions, protocol adapters so existing clients can migrate, and ZetaFS as the custom store *if and only if* it makes the database faster or safer than a host filesystem plus the ferry.

**Feel, not clone:** Apache Flink (unified batch + streaming) and [Reaqtor](https://github.com/reaqtive/reaqtor) (durable standing Rx queries that survive restart). Feldera is the **DBSP competitor**, not the product shape.

**Not Feldera-on-Postgres.** Feldera's own docs: DBSP is a query engine, not a database. Their storage is their own (`PosixBackend` / `MemoryBackend`, log-structured batches). Postgres appears as **connectors** (input: SQL query → JSON → Feldera; output: experimental INSERT/UPDATE/DELETE or CDC). ZetaDB does not sit on Postgres, MySQL, or any other engine for compute or for the WAL. We wire the entire stack. Protocol adapters speak *their wire*; they do not borrow *their storage*.

**Relativistic, no appointed hub.** Any node may replicate any table or stream and run operations on it. "Replica" is a misnomer — placement is per-stream, not a full copy of the universe. Data **and code** move. There is no split-brain as a failure class: forward progress first, later CRDT reconciliation, or work thrown away, or a named permanent fork. That is why the filesystem must treat fork as first-class.

---

## What ZetaDB is

1. **Event sourcing as truth.** The WAL *is* the database. Tables are standing queries over the event log — the same stream/table duality `QuerySurface` already states (`batch(R) == Σ streaming(ΔR_t)`). Treating the WAL as truth is not a metaphor; it is the storage contract.
2. **A streaming SQL pipeline** with Flink/Reaqtor feel: standing queries, retraction-native deltas, batch and streaming as two execution modes of one plan.
3. **Host-language backbone under SQL:** Rx queries, LINQ, F# computation expressions. SQL is a *front end* over that backbone, not a second algebra.
4. **Protocol adapters** (Postgres wire, MySQL wire, our own, later others) so teams migrate without a flag day. Compatibility lives at the **wire**, not the internals (`sql-engine-expert`).
5. **First-class row store and column store.** Column layout is Apache Arrow-compatible. Not a MariaDB ColumnStore side engine; two layouts over one Z-set algebra.
6. **SIMD / low-alloc everywhere the planner can.** FerryThrottler auto-batches (producer 1-at-a-time, consumer batches, and the reverse). The planner should prefer batch/SIMD most of the time *because* the ferry exists.
7. **DoP=1 → N, same code.** FoundationDB-style deterministic simulation at DoP=1; throughput at DoP=N. No `Task.Run` on the scored path.
8. **TigerBeetle-shaped ambition on the commit path**, with honesty: we have not metered that yet. Auto-batch + mux/full-duplex + zero-alloc Z-set ops are the *bets*, not the measured result.
9. **No central tip.** Partitioned Z-set tips joined by shippable Rx queries ([no-single-tip design](2026-08-28-there-is-no-single-tip-partitioned-zset-tips-joined-by-shippable-rx-queries.md)).
10. **Historical data compresses toward a generator.** When a generator can reproduce a history, the original bytes need not stay on disk. That is the columnar idea aimed at the **event store**, not only at tables.

---

## What ZetaDB is not

- Not Feldera with a different SQL compiler.
- Not Postgres with DBSP views bolted on (Materialize-shaped "engine on foreign storage").
- Not a drop-in CockroachDB replacement this quarter (`docs/ZETA-ARCHITECTURE-UNIFIED.md` still names Cockroach as current cluster backing; that line is a *plan*, not a ship).
- Not stuffing a SQL compiler into `Zeta.Core`. Core stays the algebra + runtime. ZetaDB is the **product package** that targets that surface. This is the WONT-DO 2026-04-17 distinction, revisited rather than silently flipped.
- Not an appointed hub-and-spoke (Itron patent boundary; manifesto §1).

---

## Feldera is the DBSP competitor

| | Feldera | ZetaDB |
|---|---|---|
| Category | Incremental SQL *query engine* + connectors | Whole database (log, views, SQL, wire, store) |
| Compute storage | Own (posix/memory backends, not Postgres) | Own (ZetaFS if it wins; host FS + ferry until then) |
| Postgres | Input connector + experimental output sink | Wire **adapter** only; never the WAL |
| Feel | Incremental SQL over changing inputs | Flink unified batch/stream + Reaqtor durable Rx |
| Testing | Rust benches, their pipeline manager | DoP=1 DST, chaos, four-oracle byte-lock, alloc benches |
| Distribution | Multi-node (they beat us here today) | Relativistic, per-stream placement, no split-brain |
| SQL | Mature compiler | Host-language first; ANSI SQL is the product overlay |

ROADMAP already records where they beat us (distribution, SQL compiler, compiled Rust circuits, production time). This document does not reopen those as insults; it names the product that *closes* the SQL and storage gaps without becoming them.

Compare numbers stay in [`docs/research/feldera-comparison-status.md`](../research/feldera-comparison-status.md). Do not divide unique-key `Send+Step` by Feldera pipeline elapsed and call it events/s.

---

## Feel: Flink and Reaqtor, not "another Feldera"

**Flink (Carbone et al., IEEE Data Eng. Bull. 2015).** One engine, two modes. Dynamic tables. Batch is a finite stream. `QuerySurface` already cites this paper and the mode-equivalence law. Clean-room: papers only, no Flink source.

**Reaqtor (Bart De Smet / Microsoft, now [reaqtive/reaqtor](https://github.com/reaqtive/reaqtor)).** Server-side Rx: standing queries registered once, evaluated continuously, subscriptions that survive process restart. Nuqleon Bonsai is the persistable expression subset. In-tree: `src/Core/QuerySurface.fs` (IQueryable / IQbservable → one plan), `src/Core/Rx.fs`, ROADMAP P2 "IQbservable / Reaqtor-style Bonsai slim IR" (`ZSetRx.connectQuery` shipped). That is the *feel* of durable standing queries. We do not port Reaqtor.

**CQL (Arasu, Babu, Widom, VLDBJ 2006).** Stream↔relation conversion is the missing generality `QuerySurface` already refuses to claim. When SQL lands, Istream/Dstream/Rstream (or an honest subset) has to be a named decision, not an accident.

---

## Event log as WAL; tables are views

Aaron: *"the tables are just really views over the event source data. it's very similar to treating our WAL as the source of truth."*

This is already the algebra:

- Append to the log = `+w` (assert) or `−w` (retract).
- A table is `I` (integrate) of a standing query over those deltas.
- A changelog of a table is `D` (differentiate) of that view.
- `Q^Δ = D ∘ Q ∘ I` (Budiu et al., VLDB 2023) is the law `ToyPlan.modeEquivalence` exists to earn.

**Transactional tables** are still views. Isolation is a property of how deltas are *admitted* to the log (single-stream batch exactly-once is shipped; multi-key ACID is ROADMAP item 10 / honest-reliability gap). Do not invent a second heap that becomes truth.

Browser ADR (2026-08-09): every executor is a temporary fold of the same durable image. No process owns the database by staying alive. That ADR is the *control-plane* reading of the same WAL-as-truth rule.

---

## Relativistic topology — replicas are a misnomer

- **No central node.** Any node may hold any subset of tables/streams and run ops on what it holds.
- **Placement is per-stream**, not "this box is a replica of the cluster." A node that never subscribed to `orders` does not have `orders`.
- **Code moves, not only data.** A shippable Rx query / Bonsai plan / Futamura-specialized operator is a value. The no-single-tip design already persists queries with the partitions.
- **No split-brain class.** Partition is not a pair of truths that must be voted off. Prefer:

  1. **Forward progress** on each side (local fold continues).
  2. **Later CRDT / Z-set merge** when the partition heals (commutative majority).
  3. **Throw the work away** when it was speculative and lost (retraction is `−1`).
  4. **Named permanent fork** when the histories must diverge (filesystem fork is first-class; this is git's cheap branch, not Raft's "one of you is dead").

Local time never filters the shared fold (`.claude/rules/local-time-never-enters-the-shared-fold.md`).

---

## Query stack — pieces in tree, not assembled

| Piece | Path | Register | What it actually is |
|---|---|---|---|
| LINQ on streams | `src/Core/Query.fs` | unmetered | Fluent `Where`/`Select`/`Join` on `Stream<ZSet<_>>`. Not F# `query { }`. |
| One plan, two modes | `src/Core/QuerySurface.fs` | **toy** | `IQueryable` / `IQbservable` → one plan. Batch vs streaming. Mode-equivalence test exists; no real workload. |
| `zeta { }` CE | `src/Core/ZetaSqlBuilder.fs` | unmetered | Typed eager CE. Delegates to `ZSet.filter/map/join/flatMap` (the Seq copies were a defect). Sibling of `ToyPlan`, not merged. |
| Rx adapters | `src/Core/Rx.fs` | shipped-as-adapter | `IObservable`; real `IQbservable` is QuerySurface. |
| Columnar SIMD | `src/Core/ColumnZSet.fs`, `ColumnLinearOps.fs` | measured kernels | SoA + vectorised Where/Select. ZLinq is Beacon, not a dependency. |
| Ferry auto-batch | `src/Core/FerryThrottler.fs` | shipped | DoP knob, `ProcessAsync` + `ProcessManyAsync`. Caller is clueless of `MaxBatchSize`. |
| Group-commit log | `GroupCommitDiskDeltaLog` in `DiskDeltaLog.fs` | shipped | N small appends, one `Flush(true)`. **This already runs on a host filesystem.** |
| Circuit / windows / Arrow | ROADMAP shipped list | shipped | Tumbling/sliding/session; Arrow IPC+zstd; in-process Flight. |
| SQL text parser | — | **absent** | WONT-DO 2026-04-17: not inside Core. This roadmap puts it in the ZetaDB *package*. |
| Postgres/MySQL wire | — | **absent** | Adapter layer. `sql-engine-expert` already names Postgres-wire-compatible. |
| Planner cost model | — | **absent** | Fusion exists (Map/Filter IL-emit). Cost-based join order does not. |
| Realistic TPC / streaming mix | `bench/Feldera.Bench` Nexmark | micro | Unique-key Q1/Q2 is Big-O, not TPC-C. |
| Membership sketches | `src/Core/BloomFilter.fs` | shipped counting + blocked | Join-probe / negative lookup. **Bloom vs anti-bloom** (two G-set filters, `{present, absent, unknown}`) is a toy type plus unit measurements — ZD10. Counting stays the join-probe path. Not a FS feature. |

**ZLinq ([Cysharp/ZLinq](https://github.com/Cysharp/ZLinq)).** Crutch for zero-alloc LINQ *shape*. Our operators are Z-set / G-set / indexed-set. Prefer our own LINQ over those types. F# computation expressions stay regardless. Do not take a ZLinq dependency on the hot path until a bench shows the crutch winning; ColumnLinearOps already did the SIMD Where/Select without it.

---

## Bloom vs anti-bloom — two grow-only filters (analysis, not a result)

**Where it fits: ZetaDB / Core query membership, not ZetaFS.** Join-probe pushdown and cross-shard negative lookup already sit on `src/Core/BloomFilter.fs` (`BlockedBloomFilter` insert-only; `CountingBloomFilter` 4-bit counters, `CounterSaturated` at 15). Volume identity is ContentId — exact, not probabilistic. Do not put this on the filesystem.

**Does not reopen** [`docs/WONT-DO.md`](../WONT-DO.md) *Deletable Bloom (Rothenberg 2010)*. That Hold is silent false negatives on collided bits. This construction never deletes bits. Unknown is a named verdict.

Register: **analysis** (four-register in-progress / proving-with-data). Nothing is built or measured. Counting Bloom stays the shipped retraction-safe sketch. CQF stays Trial on [`docs/research/bloom-filter-frontier.md`](../research/bloom-filter-frontier.md) (variable-width counts — a different upgrade).

Two grow-only Bloom filters, G-set shaped (`SimVerb` irreversible half: union-folded, idempotent, commutative). Inserted keys go to Bloom(I). Deleted keys go to Bloom(D). Nothing decrements.

| query | verdict |
|---|---|
| `x ∉ Bloom(I)` | **absent** — certain; Bloom has no false negatives |
| `x ∈ Bloom(I)`, `x ∉ Bloom(D)` | **present** — never deleted is certain; error is only `fp(I)` |
| `x ∈ Bloom(I)`, `x ∈ Bloom(D)` | **UNKNOWN** — explicitly bounded |

The unknown region is `fp(I) × fp(D)` — a product, smaller than either filter alone. Counting Bloom returns `{maybe-present, definitely-absent}` and collapses unknown into maybe. This returns `{present, absent, unknown}`.

Three things it buys that counting Bloom does not, **if** the measurements hold:

1. **No saturation ceiling.** Counting Bloom: "insertions ever observed for a hash-bucket must not exceed 15." Two insert-only filters never decrement, so they never overflow a counter.
2. **They are G-sets.** Counting Bloom is mutable cell state. Two grow-only bitsets are the substrate's own primitive.
3. **Three-valued answer.** The value is not a cheaper filter. It is a filter that does not collapse the uncertainty it cannot resolve.

**Honest limit (the churn check must include this):** grow-only D cannot forget a deletion. Insert, delete, insert again ⇒ `x ∈ I` and `x ∈ D` ⇒ **UNKNOWN** even though the Z-set weight is positive again. Counting Bloom handles resurrection by increment. This construction is conservative (not wrong) and loses `present` after any historical retract. That is the price of never decrementing.

**ZD10 measurements (unit tests in-tree; MemoryDiagnoser still open):**

1. `fp(I) × fp(D)` against counting Bloom **space at equal guarantees**.
2. Whether the unknown region stays bounded under sustained retraction churn, **including resurrection**.

First unit measurements are in `Bloom.Tests.fs` (pair smaller than counting at n=10000 p=0.01; never-inserted Unknown stays at or below Present; after full retract the pair is Unknown for every inserted key while counting is absent; resurrection stays Unknown on the pair). Not a MemoryDiagnoser bench. Do not replace `CountingBloomFilter` on the join-probe path.

Workitem: `081M1T9SMM9087G0R002FS29S4`.

---

## WONT-DO revisit — SQL is the ZetaDB package, not Core

`docs/WONT-DO.md` (2026-04-17) rejected a SQL tokenizer/parser/binder/planner **inside `Zeta.Core`**, because Core is the algebra and "a SQL compiler is Feldera's product category." The **Revisit when** line was: *"a user workload specifically needs SQL-text parsing as a **separate package**."*

Aaron 2026-09-02 is that revisit. The distinction that keeps the 2026-04-17 *why* intact:

- **Still refused:** SQL compiler, `sql_features` matrix, vendor dialects, DuckDB layering **inside Zeta.Core**.
- **Now on the roadmap:** a **ZetaDB package** that owns SQL text, ANSI (latest) dialect as the native, protocol adapters at the wire, planner that batch/SIMD-s, catalog, transactions. It *targets* the Z-set operator surface. Host-language embedding remains first-class (Rx, LINQ, `zeta { }`, `circuit { }`).

Columnar WONT-DO said "if ever needed, lands as a separate package with Arrow-native segments." ColumnZSet in Core is the algebra. ZetaDB owns the **layout product** (row pages + Arrow-compatible columns). Not a side engine.

MariaDB-style pluggable storage engines stay refused. Row vs column is a **layout**, not a swappable engine.

---

## SIMD, ferry, and the planner

Linearity (`Q^Δ = Q` for Where/Select) is why SIMD and DoP=N are the same fact: a SIMD lane is a part, and `Q(a ⊎ b) = Q(a) ⊎ Q(b)` (`ColumnLinearOps` header). The planner should:

1. Prefer vectorised/columnar kernels when the layout is columnar and the op is linear.
2. Rely on FerryThrottler to **auto-batch** morsels even if the producer is 1-at-a-time (and the reverse: a batched producer can still be consumed 1-at-a-time at DoP=1).
3. Keep DoP=1 as the DST/default path — same code, knob only.
4. Not put SIMD in `fillBoat` (already decided: `081M125DNKK087G0R00292E3ET`). SIMD specializes `processBatch`.

Mux / full-duplex on the wire (Arrow Flight stream duplex is shipped in-process) is the other half of "fastest engines" — don't block a request on an unrelated response. That is protocol, not SQL.

---

## Row store, column store, Arrow

- **Row:** OLTP-shaped, EntityId-stable, mutbuf until freeze. ZetaFS first-product already has this for files; tables reuse EntityId + ContentId + Binding.
- **Column:** `ColumnZSet` SoA today; product column store is Arrow-compatible (IPC shipped, Flight in-process shipped, gRPC encoding still out of Core).
- Both are views over the same event log. A query may pick a layout; it must not pick a second truth.

---

## Testing — FoundationDB DST, DoP=1→N, alloc honesty

- **DST:** every scored path closes under `ISimulationEnvironment`. Crash-mid-write *intercept* landed (`ArmCrashMidWrite`); recovery stays `toy` until the rest of ZetaFS PR12. Do not claim Durable recovery before that corpus.
- **DoP=1 is the correctness knob;** DoP=N is throughput. Same ferry.
- **Allocations are a column, not a footnote.** Unique-key Nexmark already reports Allocated/tick (~23.4 B/key Q1, ~11.7 B/key Q2, identical across ubuntu/mac/windows).
- **Realistic workloads** are the next metering step after Nexmark micro: unique-key Q1–Q8, then a standing-query mix (Reaqtor-shaped), then an OLTP-shaped event-sourced mix (not TPC-C as a religion — as a *shape*: many small writes, ferry-batched). The point of realistic workloads is to see whether ZetaFS beats host FS + `GroupCommitDiskDeltaLog`.

TigerBeetle is an **ambition** (static allocation, LSN, deterministic) until we meter a comparable journal. Do not quote TigerBeetle IOPS as ours.

---

## Protocol adapters — migrate without a flag day

Adapters speak a foreign **wire** and lower to one plan:

| Adapter | Role | Status |
|---|---|---|
| Native | Zeta plan + Arrow Flight / our mux | in-process Flight shipped |
| Postgres wire | `psql` / Npgsql / pgx see a server | designed, not shipped |
| MySQL wire | gradual move for those clients | later than Postgres |
| Own | first-class; not a compatibility crutch | with the SQL package |

Dialect **SQL text** is not the same as dialect **wire**. Native ANSI (latest we claim, named) is the SQL we compile. Postgres-wire can still carry that SQL, or a documented subset. Do not implement three compilers.

Closed command set: the far side **names** a verb, never **defines** one.

---

## Code mobility and stored procs

ROADMAP two-plane split stays: data plane is fast and dumb; Futamura / `gen/` / stored-proc *evolution* live in the control plane. A stored proc on the data plane is a standing query (Bonsai / `zeta { }` / SQL) with no learner on the hot path.

Shipping a query to another node is the no-single-tip mechanism. Shipping an operator implementation (specialized IL, WASM procedure ABI from the browser ADR) is the code-mobility half. Untrusted procs need a metered host before they join automatic ticks (ADR already says `trusted-cooperative`).

---

## ZetaFS requirements from ZetaDB

ZetaFS exists **for ZetaDB**. If another filesystem plus the ferry is better for the database, ZetaFS-as-product may not be necessary. That is a **falsifier**, not a vibe.

### Product-existence test (load-bearing)

`GroupCommitDiskDeltaLog` already auto-batches small appends **on a host directory** (one segment file, one `Flush(true)` per boat). The major "custom FS makes small writes fast" bet is therefore **already available without ZetaFS**. ZetaFS must win on something the host FS + ferry does not:

1. **CAS + EntityId stability** — write does not churn foreign keys / `st_ino`.
2. **First-class fork** — cheap COW branch, good GC, named permanent divergence.
3. **Erasure coding / placement as a pure function** — no appointed allocator.
4. **Generator-history (`Regen`)** — original bytes drop once a metered generator exists.
5. **Per-entity policy on one volume** — `keep-all` catalog next to `rolling` WAL next to `none` scratch.
6. **Typed durability notified to the DB** — `Buffered | Journaled | Durable`.
7. **No central tip / ordinal shared fold.**

The both-legs host-FS storm now runs in CI (`Zd4ProductExistence.Tests.fs`):
16 concurrent `GroupCommitDiskDeltaLog` appends and 16 Journaled freezes on
PhysicalFileSystem (product BlockCas path). N=16 because BlockCas's
one-superblock index cannot hold 32 unique 1-byte jumpropes; the host-only
32-append floor stays in `DiskDeltaLog.Tests`. The FS-speed claim stays `toy`
until a named run of `Zd4ProductExistenceBench` is recorded. This document
does not invent numbers. FUSE completeness is not this proof. Apple Developer
Program is not this proof.

### ReFS-shaped resilience (Aaron 2026-09-02)

**Feel, not a port.** Windows ReFS (Sinofsky / Microsoft, 2012 allocate-on-write; Server 2016 block cloning) is the Beacon for *resilience by pointer updates*: copies remap logical clusters, writes to shared regions allocate new clusters, metadata is never patched in place (shadow paging — Lorie 1977), checksums detect torn writes and bit-rot, repair needs a redundant copy (mirror/parity). On a single disk ReFS **detects** and returns an error; it does not invent a second copy. Same as our K14 (1-disk ECC is sector/die, not disk death).

We do **not** implement ReFS, copy its on-disk format, or take a Windows-only path. Requirements that crossed the wall:

1. **Pointer-not-copy (D9).** A clone, a snapshot, a small overwrite, a fork: update Bindings / Jumprope leaf ids / ContentId. Write bits only for new or mutated chunks. This is already the Jumprope + CAS shape; the volume path must not fall back to copying the file.
2. **Crash DST for FS *and* DB (D12).** FoundationDB-shaped: crash-mid-write, reorder, corrupt-last-write, same seed. ChaosEnv is still flush-fail 5%; that hook now also fires from the freeze IBlockIo door and FileSync, and freeze maps it to `FreezeError.Fsync` (process lived). Power outage (`ArmPowerOutageOnFlush`) and bad-memory (`ArmBadMemoryOnWrite`) are separate doors, not one crash. The intercept is `InMemoryFileSystem.ArmCrashMidWrite` on the shared `IFileSystem` door (freeze torn-tail + GroupCommit torn-tail). Plain freeze-log replay restores intact boats. Corrupt-last-write and reorder doors landed. Journaled/Durable boats write intent, Flush, put leaves, then commit (`intent-before-leaf-flush`). Sealed-log replay landed. Reclaim crash-mid-sweep intercept landed. Mid-log CRC keeps the prefix. `IBlockIo` is still the device primitive; `BlockIoFerry` is the Haskell-IO-shaped interpreter generated from `FerryThrottler` (including adjacent whole-block coalesce). `SimulatedBlockIo` is the LBA DST door (not POSIX). Journaled freeze log and CAS objects can ride `IBlockIo` in DST (`createManualWithBlockStore`); LBA 0 and 1 are checksummed superblock copies (`ZFL2` / `ZCA2`), payload starts at LBA 2. Sealed journaled frames can replay through `IBlockIo` (`createManualWithSealedBlocks`), including CAS objects on a second disk (`createManualWithSealedBlockStore`). Journaled freeze can ride the `FileSystemBlockIo` polyfill (`createManualWithFileLog`), including sealed frames (`createManualWithSealedFileLog`) and CAS objects on a second host file (`createManualWithFileBlockStore` / `createManualWithSealedFileBlockStore`). `IFileSystem.WriteAt` crash-arms the LBA span, not the whole host file. DST `createManual` and `create` ride `FileSystemBlockIo` for the log and for CAS objects (`cas`). A crash-mid-write of the second freeze keeps the first. A polyfill corrupt-last-write of the second freeze acks and keeps the first (last-8 of a 4096-byte RMW is often padding, so that test does not claim the second freeze is unreadable). A polyfill reorder holds the next WriteAt; the following superblock WriteAt publishes both; reopen keeps the first. Raw frame-stream tests use `createManualStream`. Torn-sector (`ArmTornSector`) overlays a 512-byte prefix of the NEW write and acks; the rest of the LBA stays OLD. `GroupCommitDiskDeltaLog` defaults to the device door (`IBlockIo` / `ZGL2`). POSIX append (`useBlockIo = false`) remains for whole-file Dispose tests. Recovery works on both doors; no bench compares them. Native NVMe is still open.
3. **Cache co-design (D10).** If the DB and the FS each keep a buffer of the same bytes, we pay RAM twice and we lie about whose `Buffered` won. One authority. Preferred: library-FS, DB owns mutbuf, POSIX mount is a view (already K6). `Durability.OsBuffered` and freeze `Buffered` must be the same named class, or a documented mapping. **Mapping landed** (`DurabilityFreezeMap`): not an equivalence (Journaled has no twin; Windows Durable refuse vs StableStorage still ships). Cache authority is still two buffers. ReFS's allocate-on-write metadata plus a lazy cache manager is a known RAM explosion (KB 4016173); do not copy that caching.
4. **CoW must not 10× the volume (D11).** This is why `keep-all | rolling | none | regen` exist. A DB that freezes every small write under `keep-all` will look like git. Rolling/none/regen are the bound. The falsifier is reclaim-eligibility, not a comment.

Integrity streams analogue: ContentId **is** the data checksum (always on). Metadata (bindings, freeze-intent/commit, Jumprope trunk) is checksummed as objects. Optional "repair from parity" is placement `mirror` / later LRC, not a 1-disk promise.

### Overlay is the query shape (Aaron 2026-09-02)

ZetaDB/ZetaFS are optimizing for **membership in overlapping regions that do not nest**. A ballot style is the combination of every jurisdiction that contains an address; those regions do not form a tree (school districts cross counties). GIS overlay is the same computation: keep the layers, do not merge them (Warren Manning; Jacqueline Tyrwhitt; Ian McHarg, *Design with Nature*, 1969), then query with map algebra (Dana Tomlin / Joseph Berry, ~1983). McHarg's stack of sheets is DV2.0's raw vault in geographic form.

**Reconcile first.** Overlay on unreconciled boundaries is a check that cannot fail: it returns an answer at every point and the answer is wrong near every line. Aaron (2026-09-02), dated by him to roughly 2016: Safe Software's FME is the best tool he has seen for studying different jurisdictions drawing different boundaries. That assessment stays **his, dated**; it is not upgraded to a 2026 ranking. FME's job in this stack is anti-Babel: make layers comparable while keeping both. It does not pick a winner.

Our instance is policy, not precincts. A traveler is inside their node policy, the room, the hat, the counterparty's rules, and the manifesto floor at once. None of those nest. A permission is a **signature** (which jurisdictions contain the act), not a boolean. The honest output is a **distribution** over signatures (factor graph / probabilistic circuits — Darwiche 2003; Choi / Vergari / Van den Broeck 2020). That application is `toy` until metered. Clifford meet as one overlay operator is prior art for the algebra and `toy` for our use (an arbitrary polygon is not a blade).

Do not merge agency boundaries, policy layers, or event-log facts into one truth so a SQL overlay can look like a tree.

### Requirements the first-product spec must carry

These are additive to K1–K18 / E1–E12 / C1–C10. They do not reopen them.

| Id | Requirement | Why the database needs it | Today |
|---|---|---|---|
| **D1** | Fork is first-class (COW; `editLocal` default). Permanent named fork is a legal outcome, not a disaster. | Relativistic progress; no split-brain. | `DagFs.editLocal` in-memory; volume fork not a snap/ref product yet |
| **D2** | GC follows lifetimes: Singleton / Scoped / Transient ≈ keep-all / rolling / none; nested scope = open file / ASP.NET request / Rust lifetime. Amortize via reclaim ferry (already K7). | DB objects and files share one collector. | `ZetaFsReclaim` maps those three; `Regen` is Singleton (conservative) |
| **D3** | `Regen` is two-phase: keep original until the generator is metered; then original is reclaim-eligible and the generator is Singleton. | Event-store "columnar" compression: history as a function. | Policy case exists; phase-2 reclaim **not** implemented (must not silently drop bytes) |
| **D4** | Small-write storms on the **volume log** go through FerryThrottler (same auto-batch as `GroupCommitDiskDeltaLog`). | DB commit path. | **ZD2 landed** (`FreezeLog`, DoP=1). Manual pump packs N Journaled freezes into one boat. |
| **D5** | Content-addressed objects + erasure-coded placement (K1/K2). | Distribution without a hub. | Polyfill `single` only |
| **D6** | Per-stream / per-table placement: a node need not hold every stream. | "Replica" is a misnomer. | Designed as partitioned tips; not a volume feature |
| **D7** | Notify ZetaDB of durability class (already K6). Observer does not throw. | Tables must not read a Journaled name with missing leaves (E2). | Freeze observer exists |
| **D8** | ShivaGC / Futamura: historical data may become a generator. Collecting a generator that still has live `Regen` refs is forbidden. | Same as D3. | ShivaGc is DynamicValue mark-sweep, not volume |
| **D9** | Pointer-not-copy (ReFS-shaped allocate-on-write). Forks and small edits remap ids; bits written only for new chunks. | Space and crash: in-place metadata is a torn-write class. | Jumprope prefix-share + `DagFs.editLocal` converge. Volume freeze still whole-object. |
| **D10** | One cache authority. DB and FS must not each buffer the same bytes. `Buffered` is one class. | RAM + DST: two caches are two truths. | `Durability.fs` vs freeze classes are two vocabularies. |
| **D11** | CoW amplification bounded by policy. `rolling(N)` after M>N freezes ⇒ ≥ M−N bodies reclaim-eligible. | Else the DB explodes the volume (git-forever). | Caller supplies `RollingLive`; window fold not yet the reclaim input. |
| **D12** | Crash DST for filesystem **and** database on the same door. | ReFS-class survival is earned by a seed, not a journal story. | Intercepts + plain/sealed replay + reclaim sweep + intent-before-leaves + mid-CRC prefix keep landed. Native device I/O still open. Recovery stays `toy`. |

**Cannot claim today:** POSIX mount, crash-safe Durable, `ns=bindings`, Windows Durable, ZetaFS faster than APFS for small writes, ReFS-class repair on one disk.

---

## Moving realistic workloads forward

Order, each with a falsifier:

1. **Keep unique-key Nexmark honest** (Q1/Q2 across OS; Q3+ incremental join). Allocated column required. **This Mac Q2 is now recorded** (was missing because only Q1 unique was run locally on 2026-09-01).
2. **Freeze through the ferry (ZD2 / D4)** — without this, crash grouping and small-write batching are two logs.
3. **Crash DST corpus (PR12 / D12)** — FS *and* DB, same `IFileSystem` door. Leaves `toy` only when a named seed has crashed mid-write.
4. **Standing-query mix (ZD1)** — register N queries, feed deltas, measure tick + alloc (Reaqtor feel).
5. **Small-write OLTP-shaped storm** — 1-at-a-time producer, ferry consumer, DoP=1 vs N. Run on host FS *and* `.zetafs` when freeze uses the ferry (D4). CoW amplification under `rolling` vs `keep-all` is a column of that bench (D11).
6. **SQL text** on the same circuits (ZetaDB package), ANSI subset named.
7. **Wire adapter** — `psql` against a toy catalog, then a real one.
8. **Multi-node** — partitioned tips, no single lock; DST partitions.

---

## Key Decisions

1. **ZetaDB is the whole database**, not an engine on Postgres. Feldera's Postgres usage is connectors. Ours will not be.
2. **Feel is Flink + Reaqtor.** Feldera is the DBSP competitor we measure against.
3. **WAL is truth; tables are views.** No second heap.
4. **SQL lives in the ZetaDB package**, not in `Zeta.Core`. WONT-DO 2026-04-17 is revisited, not silently reversed.
5. **Host-language queries stay first-class** (Rx, LINQ, `zeta { }`, `circuit { }`). SQL compiles onto the same plan.
6. **Wire adapters, not storage engines.** Postgres/MySQL compatibility is protocol.
7. **Row and column are layouts** over one algebra. Arrow-compatible columns.
8. **Own LINQ over Z-sets;** ZLinq is a crutch, not the identity.
9. **Planner prefers batch/SIMD** because the ferry auto-batches. DoP=1 remains DST.
10. **No appointed hub; no split-brain class.** Forward progress, CRDT merge, throw-away, or named fork.
11. **ZetaFS is optional as a product** until it wins the product-existence bench against host FS + group-commit. Fork, CAS, Regen, EC, per-entity policy, **and ReFS-shaped crash/pointer/cache** are the reasons it might win.
12. **`Regen` must not drop original bytes until the generator is metered.** Today's Singleton mapping is the conservative floor.
13. **Freeze uses the ferry** (D4 / ZD2). Journaled/Durable log appends are boats. Crash-mid-write intercept landed; plain-log replay of intact boats landed.
14. **Stay in this monorepo** until ZetaFS v0.9ish and until ZetaDB has a signed, tested cut. Do not mint product GitHubs as a prerequisite.
15. **Pointer-not-copy, not bit-copy** (D9). ReFS block cloning is the Beacon, not the implementation.
16. **One cache authority** (D10). Double-buffering is a bug, not a feature.
17. **Policies exist to bound CoW** (D11). A workload that 10×s the volume under `keep-all` is using the wrong policy, not a missing compressor.
18. **Crash DST covers FS and DB** (D12). Intercept landed on both paths; the recovery claim stays `toy` until PR12's remaining corpus is green.
19. **Bloom vs anti-bloom is a ZetaDB/Core query sketch, not a filesystem feature.** Toy type plus unit measurements, not a join-probe replacement. Does not reopen WONT-DO deletable Bloom. Counting Bloom stays shipped.

---

## PR Plan

Independently reviewable. Tests green or it does not land. ZetaFS numbered PRs stay in the first-product spec; these are **ZetaDB** slices plus the FS requirements they force.

### ZD0 — this document + WONT-DO revisit + FS requirement peel + Mac Q2/Lookup (this PR)

- **Files:** this design, `docs/ROADMAP.md` hub pointer, `docs/WONT-DO.md` revisit notes, first-product spec D1–D8, `docs/BENCHMARKS.md` / `feldera-comparison-status.md`, group-commit one-segment test, `Regen` lifetime test.
- **Depends on:** nothing.
- **Does not:** ship v0.9 FS, SQL parser, or wire.

### ZD1 — Standing-query mix bench (Reaqtor feel)

- **Files:** `bench/` + docs. Register N `zeta { }` / QuerySurface plans, feed unique-key deltas, MemoryDiagnoser.
- **Depends on:** ZD0.
- **Earns:** QuerySurface leaves `toy` only if a non-fixture workload is in this bench (still `unmetered` until production-shaped).

### ZD2 — Wire freeze/small-object log through FerryThrottler (D4) — landed

- **Files:** `ZetaFsFreeze.fs` `FreezeLog`. DoP=1. Same auto-batch contract as `GroupCommitDiskDeltaLog`.
- **Falsifier:** `createManual` + 16 Journaled `freezeAsync` + `pumpLog` ⇒ one boat of 16.
- **Still toy:** crash-mid-boat (PR12). Windows Durable refused.

### ZD3 — Unique-key Nexmark Q3+ on IncrementalJoin; then SQL-shaped names for Q1–Q3

- **Files:** `bench/Feldera.Bench`, QuerySurface lowering.
- **Depends on:** IncrementalJoin (exists). SQL names wait for ZD5.

### ZD4 — Product-existence bench: host FS + group-commit vs `.zetafs`

- **Files:** `tests/Tests.FSharp/Storage/Zd4ProductExistence.Tests.fs` + `bench/Benchmarks/Zd4ProductExistenceBench.fs`. Small-write storm N=16 on PhysicalFileSystem (product BlockCas path).
- **First peel:** both legs RUN. Host: 16 concurrent `GroupCommitDiskDeltaLog` appends → one `delta-*.segment`. `.zetafs`: 16 Journaled `freezeAsync` + `pumpLog` → one boat of 16. No Stopwatch. No winner. N=32 unique 1-byte jumpropes overflow BlockCas's one-superblock index; that polyfill limit is not a speed result.
- **Numbers stay `toy`** until a named run of the bench is recorded (not copied into README).
- **Depends on:** ZD2 (landed). Workitem `081M1ZA8S7C087G0R002P9NX40`.
- **Does not:** claim ZetaFS is faster than APFS/ext4; FUSE; Apple Developer Program; kill ZetaFS-as-product.

### ZD5 — ZetaDB SQL package (separate from Core)

- **Files:** new project targeting Core. Parser → binder → plan that *is* QuerySurface/Circuit. ANSI subset named. No dialect compilers.
- **Depends on:** ZD1 (so the plan has a workload). WONT-DO revisit is ZD0.
- **Clean-room:** papers + SQL standard; do not read Feldera SQL compiler sources in the implementing agent.

### ZD6 — Postgres wire adapter (toy catalog)

- **Depends on:** ZD5 for SQL text, or a host-language-only catalog for a thinner first cut.
- **Non-goal:** Postgres storage, catalogs as source of truth, `sql_features` matrix inside Core.

### ZD7 — `Regen` phase-2 reclaim (D3)

- **Depends on:** metered generator (Futamura / ShivaGcRegen). Must fail tests if original bytes vanish before the generator is proven.

### ZD8 — Per-stream placement + shippable query (no-single-tip as runtime)

- **Depends on:** no-single-tip design (exists). Runtime, not another essay.

### ZD9 — ReFS-shaped falsifiers + elevate PR12 (FS *and* DB crash DST)

- **Files:** first-product D9–D12, this section, Jumprope 1-byte-edit reuse test, rolling-window reclaim test. PR12 corpus remains the promotion out of `toy`.
- **Depends on:** ZD0 (landed #16341). Composes with `081M1C59ZG4087G0R000VM8DZN` PR12.
- **Does not:** claim crash-safe, port ReFS, or wire freeze through the ferry (that's ZD2).
- **Workitem:** `081M1HK4AQE087G0R002RRJXWE`.

ZetaFS PR12 (DST corpus) and PR13 (FUSE) remain on the FS spec. They are not delayed by ZetaDB, and ZetaDB must not claim crash-safe until PR12. D12 makes PR12 load-bearing for **both** products, not only the mount.

### ZD10 — Bloom vs anti-bloom: measure, then maybe ship (analysis until then)

- **Files:** `src/Core/BloomFilter.fs` counting/blocked stay the join-probe path. Toy `InsertDeleteBloom` is in-tree; first unit measurements in `tests/Tests.FSharp/Sketches/Bloom.Tests.fs`; not wired to join-probe. `docs/research/bloom-filter-frontier.md` Assess row.
- **Depends on:** nothing. Does not block PR12 / ZD9.
- **Falsifiers:** (1) `fp(I)×fp(D)` vs `CountingBloomFilter` space at equal guarantees. (2) unknown-region size under retraction churn **including insert-delete-insert**.
- **Does not:** reopen WONT-DO deletable Bloom; replace counting Bloom on the hot path; put this on ZetaFS.
- **Workitem:** `081M1T9SMM9087G0R002FS29S4`.

---

## Open Questions

1. **Public names** for ZetaDB / ZetaFS — still gated.
2. **First SQL subset** — which ANSI:2023 features are in v0 vs later (windows? `MATCH_RECOGNIZE` is ROADMAP P2 CEP). Do not silently pick "all of Postgres."
3. **ZD6 before or after ZD5** — a Postgres-wire *empty server* can prove the adapter without SQL. Prefer a real catalog if ZD5 is close; otherwise a host-language catalog is an allowed thinner cut.
4. **When ZetaFS-as-product is killed** — only after ZD4 has numbers. Until then it stays the designed store.
5. **Bloom vs anti-bloom vs CQF** — two grow-only filters (three-valued, no saturation, G-set) vs counting Bloom (shipped) vs CQF (radar Trial, variable-width counts). Settled by ZD10 measurements, not by preferring the story. Resurrection (insert after delete) is UNKNOWN in the two-filter form; that may lose to counting/CQF on retract-heavy workloads.

---

## Pointers

- Feldera Postgres **input** connector: <https://docs.feldera.com/connectors/sources/postgresql/>
- Feldera Postgres **output** (experimental): <https://docs.feldera.com/connectors/sinks/postgresql/>
- Feldera: DBSP is a query engine, connectors convert to/from Z-sets — <https://www.feldera.com/blog/communicating-with-dbsp>
- Reaqtor: <https://github.com/reaqtive/reaqtor>
- ZLinq (crutch): <https://github.com/Cysharp/ZLinq>
- Budiu et al., DBSP, VLDB 2023; McSherry et al., Differential Dataflow, CIDR 2013; Carbone et al., Flink, 2015; Arasu/Babu/Widom, CQL, 2006; Meijer, *Your Mouse is a Database*; De Smet, IQbservable / Nuqleon / Reaqtor.
- Bloom, *Space/time trade-offs in hash coding with allowable errors*, CACM 1970; Fan et al., *Summary cache*, SIGCOMM 1998 (counting Bloom); Shapiro et al., *A comprehensive study of Convergent and Commutative Replicated Data Types*, INRIA 2011 (G-Set). Deletable Bloom is WONT-DO (Rothenberg 2010); two grow-only filters are a different construction.
- Zhou et al., FoundationDB, SIGMOD 2021; Will Wilson, DST, Strange Loop 2014; TigerBeetle journal (ambition, not a measured claim).
- ReFS (Beacon, not a port): Sinofsky, "Building the next generation file system for Windows: ReFS" (Building Windows 8, 2012) — allocate-on-write / shadow paging; [Block cloning](https://learn.microsoft.com/en-us/windows-server/storage/refs/block-cloning); [Integrity streams](https://learn.microsoft.com/en-us/windows-server/storage/refs/integrity-streams); Lorie, *Physical Integrity in a Large Segmented Database* (ACM TODS 1977) for shadow paging. KB 4016173 — allocate-on-write metadata + lazy cache can explode RAM.
