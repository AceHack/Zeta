# Upstream Reference List

Curated list of external repos / projects / papers we study to keep
`Dbsp.Core` honest.

See `docs/TECH-RADAR.md` for our own Adopt/Trial/Assess/Hold rings;
this doc is the broader "here's every system we should keep an eye on"
list. When a project graduates from here into our tech radar, mark it
with a ⭐ below and add a row there.

## Dbsp.Core's own reading list

- **DBSP / IVM** ⭐ — Budiu et al. *DBSP: Automatic Incremental View
  Maintenance for Rich Query Languages* (VLDB 2023); VLDB Journal
  2025 extended version; `arXiv:2203.16684`.
- **Differential Dataflow / Timely** ⭐ — McSherry, Murray, Isard,
  Isaacs TODS 2013; Naiad SOSP 2013; Abadi et al. — the foundations
  our `Recursive.fs` references.
- **FASTER HybridLog (MSR)** ⭐ — Chandramouli et al. SIGMOD 2018;
  closest .NET-native prior art for our `DiskSpine.fs` tiers.
- **TigerBeetle** ⭐ — LSM-forest + VOPR simulator; inspiration for
  deterministic simulation testing and the `ChaosEnv.fs` discipline.
- **Datomic** ⭐ — AEVT/AVET indexes; inspiration for
  closure-table-style `Hierarchy.fs`.
- **XTDB 2** ⭐ — Arrow bitemporal indexes; temporal-query
  inspiration.
- **Reaqtor / IQbservable** ⭐ — stateful event-processing +
  Nuqleon/Bonsai reference; slim-IR inspiration for persistent
  queries.
- **Apache Arrow + Flight** ⭐ — columnar wire format; we use Arrow
  IPC in `ArrowSerializer.fs` and plan Flight for multi-node.
- **FoundationDB** ⭐ — Will Wilson's DST lineage; our `ChaosEnv.fs`
  + `VirtualTimeScheduler` borrow directly.
- **Materialize / Feldera** ⭐ — our closest incremental-SQL
  competitors; Feldera is `docs/research/feldera-comparison-status.md`.
- **SlateDB** ⭐ — CAS-manifest + `writer_epoch` fencing pattern
  (round-16 research verdict: adopt pattern, don't clone code).
- **Category Theory for Programmers (Milewski)** ⭐ — required
  reading for contributors; shapes our operator-algebra vocabulary.
- **Izraelevitz et al. DISC'16** ⭐ — buffered durable
  linearizability; correctness model for our durability modes.
- **Silo (Tu SOSP'13) / FOEDUS (Kimura VLDB'15)** ⭐ — epoch commit
  prior art for WDC paper.
- **CockroachDB Parallel Commits SIGMOD'20** ⭐ — related work for
  WDC.
- **Jepsen** — correctness test discipline; future work to run
  against our distributed paths.
- **Bifunctor / profunctor optics literature** — Milewski, Pickering-
  Gibbons-Wu; references for `NovelMathExt.fs`.
- **Tropical semiring / min-plus algebra** — reference for
  `NovelMath.fs`; Golan *Semirings and their Applications*.
- **Residuated lattices** — Galatos-Jipsen-Kowalski-Ono 2007; shapes
  `Residuated.fs`.
- **HyperLogLog** — Flajolet-Fusy-Gandouet-Meunier; HLL++ (Ertl
  bias correction).
- **Count-Min** — Cormode-Muthukrishnan.
- **KLL quantile** — Karnin-Lang-Liberty 2016.
- **HyperMinHash** — Cohen-Lemire; a sketch we ship.
- **FastCDC** — Xia et al. USENIX ATC 2016; our `FastCdc.fs`.
- **Merkle trees** — Merkle 1979; our `Merkle.fs`.
- **Blake3 / CRC32C / XxHash** — hashing primitives we use or
  reference.
- **Adam Shostack, *Threat Modelling*** — and the EoP card game
  (shipped in `docs/security/eop-*.pdf`).
- **Microsoft SDL (12 practices)** — basis for
  `docs/security/SDL-CHECKLIST.md`.
- **Lamport, *Specifying Systems*** ⭐ — TLA+ canonical reference
  (`references/tla-book/`).
- **Newcombe et al., *How AWS Uses Formal Methods* CACM 2015** —
  the paper that sold us on TLA+.

## Categories

- **Embedded / OLTP SQL** — SQLite, DuckDB, ChaiSQL, FoundationDB ⭐
- **Distributed SQL** — CockroachDB ⭐, TiDB, YugabyteDB, rqlite
- **Event / streaming** — EventStore ⭐ Kurrent, Kafka, Redpanda,
  Flink, Materialize ⭐ (IVM), SpacetimeDB ⭐
- **Vector / AI DB** — Milvus, Weaviate, Qdrant, Chroma ⭐ (wal3
  setsum), pgvector, FAISS
- **OLAP / columnar** — ClickHouse, MariaDB ColumnStore, VoltDB, Druid
- **Graph DB** — Neo4j, ArangoDB, Memgraph, JanusGraph, Dgraph,
  NebulaGraph
- **Lakehouse / table formats** — Iceberg ⭐, Delta Lake ⭐, Parquet,
  ORC, HDF5, Zarr, Apache Arrow ⭐
- **Embedded LSM / KV** — LevelDB, RocksDB, LMDB, FoundationDB, SlateDB ⭐
- **Consensus libraries** — etcd, hashicorp-raft, openraft, raft-rs,
  dotnext, NuRaft, OmniPaxos, dqlite, ZooKeeper, Consul
- **Replicated log** — Kafka, Redpanda, BookKeeper, EventStore
- **Distributed KV / anti-entropy** — Cassandra, Riak ⭐ (CRDTs),
  MongoDB
- **Data grids** — Ignite, NCache, Infinispan, Hazelcast, Geode
- **Serialisation / wire** — Protobuf, gRPC, Avro, Cap'n Proto,
  FlatBuffers, Thrift, Bond, MessagePack, JSON Schema
- **Reactive .NET** — Rx.NET, Ix, Reaqtor ⭐, Bonsai-Rx
- **ORM / data access** — EF Core, Dapper
- **Incremental dataflow** — Materialize ⭐, Feldera ⭐, Differential
  Dataflow ⭐, Naiad
- **Research-grade prior art for WDC** — CockroachDB Parallel Commits,
  Aurora Cell Architecture ⭐, FASTER HybridLog ⭐, TigerBeetle ⭐,
  Datomic, XTDB 2
- **Security / SDL tooling** — pytm, OWASP Threat Dragon, Microsoft
  Threat Modeling Tool (Hold — Windows-only)

## How we use this list

1. When a Dbsp.Core feature starts, the relevant code-owner agent
   (see `.claude/skills/dbsp-*-specialist/` / `-owner/`) scans this
   list for prior art.
2. If a reference is cited as inspiration, we add a row to
   `docs/TECH-RADAR.md` (Assess minimum).
3. If we borrow a protocol / wire format / algorithm, we upgrade to
   Trial and cite in the relevant paper draft.
4. If we replace a dependency with our own implementation, we keep
   the upstream cited — the user asked us to feed improvements
   back upstream, not fork quietly.

## Active reads this round (17)

- SlateDB ⭐ — current verdict *adopt CAS-manifest
  protocol, don't clone code*.
- Feldera Rust DBSP — bench target; P1 to run an apples-to-apples
  micro-benchmark vs our `Dbsp.Core`.
- FoundationDB ⭐ — DST + simulator; our `ChaosEnv.fs` + SimulatedFs
  are modeled on this.
- Apache Iceberg — table-format reference for the Z-set-aware SST
  layout research direction.
- EventStoreDB / Kurrent — typed outcome APIs inform our
  `OutcomeDU` sketch.
- Chroma wal3 — setsum checksum pattern; relevant to WDC witness
  digest.
- Aurora DSQL — lease-based HLC fencing; relevant to multi-writer
  durability story.
- DuckLake — catalog-in-RDBMS; relevant to our metadata layer.

## Ground rules

- Never copy code without an explicit license review. Pattern ≠ code.
- Always cite upstreams in the paper when we use their protocol.
- When we find a bug upstream, file it — `μένω` includes
  good citizenship.
- When we invent something new, make the proof + benchmark tight
  enough to submit back to the community via a paper + PR.

See `references/README.md` for how we manage external references
and `references/reference-sources.json` for the machine-readable
manifest.
