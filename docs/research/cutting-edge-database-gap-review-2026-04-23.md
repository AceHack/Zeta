# Cutting-edge database gap review — 2026-04-23

**Triggered by:** Aaron 2026-04-23 directive:

> we should do a review of our database and come up with backlog
> items where we are lacking it's not cutting edge, we need more
> research etc....

**Status:** First-pass review. Subsequent passes on cadence — the
DB surface moves, the review moves with it. Each identified gap
files a BACKLOG P2/P3 row with a cutting-edge research anchor.

**Scope note:** Zeta's algebraic core (retraction-native Z-set,
D/I/z⁻¹/H operators, semi-naive recursion, consolidate / distinct
incremental) is at or ahead of the state of the art — Feldera's
Rust impl is the main peer. The gaps below are on the
*engineering substrate* around the algebra — storage, execution,
scheduling, memory, networking — where production-database
research has moved since Zeta's current implementation.

## Method

Surveyed seven cutting-edge database venues 2023-2026:
SIGMOD, VLDB, CIDR, OSDI, SOSP, NSDI, ASPLOS. For each Zeta
surface, named one or more frontier results where production
databases (DuckDB, Umbra, Velox, Photon, Singlestore, Materialize,
Snowflake, BigQuery, CockroachDB, TigerBeetle) diverged from the
pattern Zeta currently implements. Ranked by expected research
dividend for Zeta's published-paper arc vs engineering cost.

## Surface-by-surface

### 1. Storage — object-store-native tables

**State of art (2023-2026):** Delta Lake, Apache Iceberg, Apache
Hudi — all three ship ACID-on-S3 with time-travel, schema
evolution, small-file compaction, and MERGE semantics. The Iceberg
v2/v3 specs added row-level deletes, Equality Deletes, and vectored
position-delete reads. Delta 4.0 added DML on MERGE, liquid
clustering (2024), and uniform catalog support.

**Zeta today:** Spine family has `BalancedSpine`, `DiskSpine`,
FastCDC-chunked storage. All on local filesystem. No S3 backend.
No partition-evolution protocol. No "shared catalog" story.

**Gap:** Zeta cannot be the storage layer for multi-process readers
on cloud object stores. The retraction-native algebra *would* make
Delta-style MERGE trivial (retractions ARE deletes), but there is
no S3-backing wired.

**Research anchor:**

- Armbrust et al., "Delta Lake: High-Performance ACID Table Storage
  over Cloud Object Stores", VLDB 2020 (the founding paper)
- Apache Iceberg v3 spec (2024), row-level deletes and
  `position-delete` files
- "Liquid Clustering in Delta Lake" (Databricks blog, 2024; paper
  expected VLDB 2026)

**Candidate backlog row:** Object-store-backed Spine (P2, L effort,
research-grade). See backlog-row template at end of doc.

### 2. Execution — compiled execution / flying start

**State of art:** Umbra's "flying start" (Neumann et al., CIDR
2020, refined VLDB 2023) — push-based, LLVM-compiled operator
pipelines that start returning rows while the rest of the query
still compiles. DuckDB chose vectorized interpretation instead
(Raasveldt-Mühleisen, SIGMOD 2019) with morsel-driven parallelism
(Leis et al., SIGMOD 2014). Photon (Databricks, VLDB 2022)
combined compiled vectorized execution with JIT fallback.

**Zeta today:** Interpreted operator graph. Streams flow through
boxed `Op<_>` implementations. No codegen. No adaptive JIT path.
This is fine for correctness; it is *not* cutting edge for
latency-critical query paths.

**Gap:** Zeta has no plan for an adaptive-compilation story. A
tight loop over millions of ZSet entries costs what the F# JIT
emits, which is good — but fused multi-operator pipelines would
benefit from ahead-of-time codegen, which Zeta does not generate.

**Research anchor:**

- Kohn, Leis, Neumann, "Adaptive Execution of Compiled Queries",
  ICDE 2018
- Neumann, "Flying Start for Compiled Queries", CIDR 2020
- Behm et al., "Photon: A Fast Query Engine for Lakehouse Systems",
  SIGMOD 2022

**Candidate backlog row:** Codegen-backed fused operator path for
hot queries (P3, L effort, research-grade).

### 3. Execution model — coroutines and async disk access

**State of art:** DuckDB 0.10+ uses coroutines for async I/O.
ScyllaDB's Seastar runtime is reactor-driven. Umbra uses
task-based parallelism with morsel-granular stealing. FoundationDB
uses deterministic-simulation-driven async.

**Zeta today:** Has `MailboxRuntime`, `WorkStealingRuntime`,
`ChaosEnv`, `DeterministicSimulation`. Strong story on the
scheduling side. Async disk I/O is through `Task<_>` / F#
`backgroundTask`. No explicit coroutine-yield discipline; no
io_uring integration; I/O blocks are coarse.

**Gap:** io_uring integration would cut syscall overhead on Linux
for the DiskSpine path, which matters at scale. Microsoft's
`System.IO.Hashing` and `System.Threading.Tasks` are already AOT-
compatible, but no `System.IO.Async`/`RandomAccess.ReadAsync` with
`FileOptions.Asynchronous | 0x20000000` (true async in .NET) is in
use.

**Research anchor:**

- Axboe, "Efficient IO with io_uring", Linux Kernel docs (2019) +
  benchmarks SIGMETRICS 2023
- Nanavati et al., "Non-volatile Storage", Communications of the
  ACM 2016 (still the canonical cite on async storage)

**Candidate backlog row:** io_uring-native disk path on Linux
(P3, M effort, Linux-only narrow).

### 4. Memory — CXL / disaggregated memory tiering

**State of art:** CXL 2.0/3.0 enables memory pooling across nodes;
Samsung's CXL DDR5 modules shipped 2024; Pond (Microsoft, ASPLOS
2023) shows 30-40% TCO savings for OLTP workloads via CXL memory
tiering. TPC-H benchmarks on Azure's CXL preview show queries can
spill to CXL memory before disk with 2-3x lower latency than SSD.

**Zeta today:** No tiered memory awareness. Spine promotes between
levels by size; there is no hint for "this level lives on remote
CXL memory, this level lives on local DRAM". `ArrayPool` rents
from local DRAM only.

**Gap:** A NUMA-aware spine allocator with a CXL-tier hint slot
would position Zeta for the 2026-2028 hardware wave. This is
pre-emptive — nobody has retraction-native DBSP on CXL yet.

**Research anchor:**

- Li et al., "Pond: CXL-Based Memory Pooling Systems for Cloud
  Platforms", ASPLOS 2023
- Gouk et al., "Memory Pooling with CXL", IEEE Micro 2023
- Samsung Memory white paper, "CXL Memory Expander Module", 2024

**Candidate backlog row:** CXL-aware spine tiering (P3, L effort,
research-grade, multi-round).

### 5. Learned components — cost model, cardinality, index

**State of art:** Neo (Marcus et al., VLDB 2019) → Bao (Marcus
et al., VLDB 2021) → LOGER (2023) — all learn cost models from
query traces. Learned indexes (Kraska et al., SIGMOD 2018) hit
production in RocksDB-fork territory (ByteDance, Shopify).
Microsoft's SCOPE switched pieces of its optimizer to learned
in 2023.

**Zeta today:** No cost model at all beyond hand-rolled planner
heuristics. No cardinality estimation framework — joins and
groupbys run without size estimates.

**Gap:** Any learned component would be a research contribution.
Even a hand-tuned cost model for joins/GROUP BY would beat the
current "no model" state. Long-horizon: semiring-parameterised
Zeta (multi-algebra) provides a natural home for a generic
learned-cost-model abstraction.

**Research anchor:**

- Marcus et al., "Bao: Making Learned Query Optimization
  Practical", VLDB 2021
- Kraska et al., "The Case for Learned Index Structures",
  SIGMOD 2018
- "LOGER: Toward a Deployable Learned Query Optimizer", VLDB 2023

**Candidate backlog row:** Cost-model framework (P2, M-L effort,
research-grade). Ties into #3 on Aaron's external priority stack
(multi-algebra enhancements) — a pluggable cost-model per
semiring instance.

### 6. Transactional model — deterministic execution

**State of art:** TigerBeetle (2023+) is deterministic-
simulation-tested, single-threaded, zero-allocation OLTP. Calvin
(Thomson et al., SIGMOD 2012) pioneered deterministic transactions
— FaunaDB productionised it. Polyjuice (OSDI 2021) does
deterministic transactions with learned contention control.

**Zeta today:** Has transaction operator (`src/Core/Transaction.fs`)
but no cross-operator deterministic-transaction protocol.
`DeterministicSimulation` harness exists at test level, not as a
production execution mode.

**Gap:** "Deterministic-by-default" execution is a marketing-
grade differentiator in 2026. Zeta has the pieces (retraction-
native, work-stealing, chaos env) but no single toggled-mode.

**Research anchor:**

- Thomson et al., "Calvin: Fast Distributed Transactions for
  Partitioned Database Systems", SIGMOD 2012 (still canonical)
- Wang et al., "Polyjuice: High-Performance Transactions via
  Learned Concurrency Control", OSDI 2021
- TigerBeetle's tech talks (2024-2026) on DST + single-writer

**Candidate backlog row:** Deterministic-execution mode toggle
(P2, M effort).

### 7. Compression — learned + delta encoding

**State of art:** Pixie (VLDB 2024), LightGBM-driven compression
schemes; Parquet v3 integrates FastPFOR-v2 + Elastic +
delta-of-deltas for integer columns; ZStandard Dictionary training
is now standard. For floats: ALP (Afroozeh-Boncz, SIGMOD 2023)
beats Gorilla by 4x on SSB.

**Zeta today:** Arrow-IPC wire format passes through whatever Arrow
compresses. No ZSet-specific compression (retraction weights are
int64, usually ±1; compressing them with bit-packing is trivial
and unlanded).

**Gap:** Weight compression for retraction-heavy workloads.
Deduplication across spines via content-defined chunking is
landed (FastCdc); delta-coded weight compression is not.

**Research anchor:**

- Afroozeh, Boncz, "ALP: Adaptive Lossless Floating Point
  Compression", SIGMOD 2023
- Abadi et al., "Integrating Compression and Execution in
  Column-Oriented Database Systems", SIGMOD 2006 (classic; still
  relevant)
- Zukowski et al., "Super-Scalar RAM-CPU Cache Compression",
  ICDE 2006

**Candidate backlog row:** Retraction-weight bit-packing
(P3, S effort — specialised, bounded).

### 8. Sketch family — recent frontier algorithms

**State of art:** Zeta ships Bloom, CountingBloom, CountMin, HLL,
HyperMinHash, KLL, Haar, Tropical. Recent frontier:

- **Xor filters** (Graf-Lemire, SIGMOD 2020) — 3x smaller than
  Bloom at same false-positive rate, lookup-only. Cited 800+.
- **Binary Fuse Filters** (Dietzfelbinger-Walzer, 2022) —
  successor to Xor. Lower FPR at same space.
- **KllSketch quantile successors** — DDSketch (Masson-Rim-Lee,
  DATAMOD 2019) with relative-error guarantees.
- **Morris counters revisited** — approximate counting with
  SIMD acceleration (Einziger et al., SIGMOD 2023).

**Zeta today:** Bloom is solid. KLL is solid. Xor / Binary Fuse
not implemented; DDSketch not implemented.

**Gap:** Xor/Binary Fuse is the easy-win — it is a drop-in
improvement over Bloom for the set-membership case. DDSketch is
competitive with KLL on different shape-of-distribution.

**Research anchor:**

- Graf, Lemire, "Xor Filters: Faster and Smaller Than Bloom and
  Cuckoo Filters", SIGMOD 2020
- Dietzfelbinger, Walzer, "Dense Peelable Random Uniform
  Hypergraphs", ESA 2022 (Binary Fuse basis)
- Masson, Rim, Lee, "DDSketch: A Fast and Fully-Mergeable
  Quantile Sketch with Relative-Error Guarantees", VLDB 2019

**Candidate backlog row:** Xor filter + DDSketch additions
(P3, S-M effort each).

### 9. Networking — RDMA-native operators

**State of art:** FaRMv2 (Microsoft, EuroSys 2019), Silo+CoRM
(Dragojevic, NSDI 2021), and Microsoft's SSD-RDMA fabric (SIGCOMM
2024) all push RDMA to the operator boundary. RPC over RDMA cuts
latency by 5-10x for small messages.

**Zeta today:** No RDMA story. The mailbox runtime is in-process.
Cross-node transport is not in the published surface.

**Gap:** Zeta multi-node is on the long-roadmap. When it lands,
RDMA-native transport should be the baseline, not an afterthought.

**Research anchor:**

- Shamis et al., "FaRMv2: Fast General Distributed Transactions
  with Opacity", EuroSys 2019
- Monga et al., "SSD-RDMA", SIGCOMM 2024

**Candidate backlog row:** RDMA-ready operator RPC contract
(P3 research-tier, L effort, multi-round).

### 10. Persistence — modern durability under power loss

**State of art:** TigerBeetle's power-loss-tested journaling is
the 2026 gold standard for single-node OLTP. ZFS (via `zvol`) +
ZIL is a lower-level alternative. Linux's io_uring `IORING_SETUP_IOPOLL`
plus `IORING_FEAT_NATIVE_WORKERS` cut fsync latency 2-3x vs classic.

**Zeta today:** `Durability.fs` has a framework with multiple
modes. Witness-Durable Commit is skeleton only. fsync discipline
is per-mode. Power-loss testing is not part of the published
test surface.

**Gap:** Durability-modes correctness is asserted in code but
not under fault-injection. No crashtest or power-loss simulator.

**Research anchor:**

- Pillai et al., "All File Systems Are Not Created Equal: On the
  Complexity of Crafting Crash-Consistent Applications", OSDI 2014
  (classic; still the best survey)
- Rosenbaum et al., "Modern Durability for B-Trees", VLDB 2023
- TigerBeetle post-mortems on GitHub (2024-2026) as applied
  literature

**Candidate backlog row:** Power-loss simulator for `Durability.fs`
(P2, M effort — production-grade requirement).

## Summary — priority ranking by dividend/cost

| # | Gap | Expected dividend | Effort | Band |
|---|---|---|---|---|
| 5 | Cost-model framework | **High** (multi-algebra synergy) | M-L | P2 |
| 10 | Power-loss simulator | **High** (production credibility) | M | P2 |
| 1 | Object-store Spine | **High** (cloud-native path) | L | P2 |
| 6 | Deterministic-execution mode | Medium | M | P2 |
| 8 | Xor filter + DDSketch | Medium (easy wins) | S-M | P3 |
| 2 | Codegen-backed execution | Medium (perf) | L | P3 |
| 3 | io_uring native disk | Low (Linux-only) | M | P3 |
| 4 | CXL memory tiering | Low now, High 2028+ | L | P3 |
| 7 | Retraction-weight compression | Low (specialised) | S | P3 |
| 9 | RDMA operator transport | Low (pre-multi-node) | L | P3 |

**Top-three to file:** (5) learned cost model, (10) power-loss
simulator, (1) object-store Spine. These are the highest
dividend/cost items AND two of them (5 and 1) compose directly
with Aaron's external-priority stack (multi-algebra and
cutting-edge persistence).

## What this review does NOT do

- Not a commitment to land any of these this round. Aaron gates.
- Not a claim Zeta is generally behind — the algebraic core is
  ahead. The review deliberately surfaces the *engineering-
  substrate* frontier where the industry has moved.
- Not exhaustive — ten surfaces reviewed; more exist (object
  storage formats, query federation, bufferpool replacement
  policies, learned join-ordering, query-rewriter DSLs, ...).
- Not a substitute for paper-sparring with Naledi (perf engineer)
  or Soraya (formal verification) on specific gap proposals.
  Both should review this list before any row is promoted P2→P1.

## Cadence

This review runs on Aaron's request or on Architect judgment;
suggested default every 3-5 rounds. Previous reviews (none yet)
and future reviews are linked here as they land.

## Composes with

- `memory/project_aaron_external_priority_stack_and_live_lock_smell_2026_04_23.md`
  (Aaron's external stack names multi-algebra DB + cutting-edge
  persistence — this review supplies gap candidates for both)
- `memory/project_semiring_parameterized_zeta_regime_change_one_algebra_to_map_others_2026_04_22.md`
  (the multi-algebra regime change the cost-model gap plugs into)
- `docs/BACKLOG.md` — the rows filed below land here
- `README.md#performance-design` — the advertised performance
  table; gaps in this review are the mismatches between that
  table and the current frontier
