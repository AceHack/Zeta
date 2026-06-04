---
name: storage-and-query-engines
description: Databases and query engines — storage layouts, SQL parse→plan→execute, transactions, indexing, every database kind.
---

# storage and query engines

Category skill (blueprint pack). The `description` above is the only thing the
router sees — broad and generic on purpose. The fat detail lives in the
blueprints below; open the one that matches and read it in full.

Governs its own form per `.claude/rules/rules-are-small-carved-sentences-pointing-to-docs.md`
and `.claude/rules/mirror-beacon-register-discipline.md` (carved sentence = hub /
Beacon; blueprint = satellite / Mirror). The directory is an independent shipping unit.

## Blueprints

- [`postgresql-expert`](blueprints/postgresql-expert.md) — PostgreSQL — wire protocol, type system, system catalogs, dialect extensions, EXPLAIN, pg_hba auth.
- [`relational-database-expert`](blueprints/relational-database-expert.md) — RDBMS family — Postgres/MySQL/MSSQL/Oracle/SQLite/NewSQL, Codd forms, MVCC vs 2PL, WAL, partitioning.
- [`document-database-expert`](blueprints/document-database-expert.md) — Document databases — MongoDB, Cosmos DB, Firestore, CouchDB; schema design, aggregation, sharding, embed/reference.
- [`graph-database-expert`](blueprints/graph-database-expert.md) — "Graph databases — Neo4j, Neptune, JanusGraph, Memgraph; Cypher/GQL/Gremlin, RDF, supernodes, traversals."
- [`vector-database-expert`](blueprints/vector-database-expert.md) — "Vector databases — Milvus, Weaviate, Qdrant, pgvector, Pinecone; HNSW/IVF-PQ, ANN benchmarks, hybrid search, embeddings."
- [`wide-column-database-expert`](blueprints/wide-column-database-expert.md) — "Wide-column databases — Cassandra, HBase, Bigtable; row keys, sparse columns, SSTables, quorum reads/writes, CQL."
- [`key-value-store-expert`](blueprints/key-value-store-expert.md) — "Key-value stores — Redis/Valkey, DynamoDB, etcd/ZooKeeper, FoundationDB, RocksDB/LMDB, eviction, caching."
- [`time-series-database-expert`](blueprints/time-series-database-expert.md) — Time-series databases — InfluxDB, TimescaleDB, QuestDB, IoTDB; downsampling, retention, continuous aggregates.
- [`columnar-storage-expert`](blueprints/columnar-storage-expert.md) — "Columnar storage — segment layout, dictionary/RLE/FOR compression, Arrow/Parquet interop, late materialisation."
- [`row-store-expert`](blueprints/row-store-expert.md) — Row-store / OLTP layout — heap files, slotted pages, HOT chains, B+ tree leaves, FSM, latching, WAL images.
- [`catalog-expert`](blueprints/catalog-expert.md) — "SQL catalog — system tables, DDL semantics, schema evolution, OIDs, pg_* synthesis, concurrent DDL consistency."
- [`storage-specialist`](blueprints/storage-specialist.md) — Zeta.Core storage reviewer — DiskBackingStore, Spine family, checkpoint format, durability modes, WDC advisory.
- [`file-system-persistence-expert`](blueprints/file-system-persistence-expert.md) — File-system durability — fsync/fdatasync, journal semantics, io_uring/IOCP, atomic rename, crash-safety, path hazards.
- [`transaction-manager-expert`](blueprints/transaction-manager-expert.md) — SQL transaction manager — ACID, isolation, MVCC, 2PL, deadlocks, savepoints, 2PC/Saga, commit protocols.
- [`concurrency-control-expert`](blueprints/concurrency-control-expert.md) — "Concurrency control — conflict detection, read-write sets, SSI, deadlock prevention, abort policies, lock manager."
- [`sql-engine-expert`](blueprints/sql-engine-expert.md) — Zeta SQL engine umbrella — parser, binder, optimizer, planner, execution model, storage, wire protocol.
- [`sql-expert`](blueprints/sql-expert.md) — SQL standard — SQL:2016/2023, three-valued logic, grouping/window/CTE, isolation levels, dialect drift across engines.
- [`sql-parser-expert`](blueprints/sql-parser-expert.md) — SQL parser — lexing, grammar choice (libpg_query/ANTLR4/recursive-descent), AST design, error recovery, fuzzing.
- [`sql-binder-expert`](blueprints/sql-binder-expert.md) — SQL binder — name resolution, type coercion, overload resolution, scope rules, ambiguity before optimization.
- [`query-optimizer-expert`](blueprints/query-optimizer-expert.md) — Query optimizer — cost model, cardinality estimation, logical rewrite rules, join-order enumeration, statistics.
- [`query-planner`](blueprints/query-planner.md) — Query planner review — join ordering, predicate pushdown, indexes, SIMD dispatch, cardinality estimates, cost model.
- [`distributed-query-execution-expert`](blueprints/distributed-query-execution-expert.md) — Distributed SQL execution — partitioning, shuffle/broadcast/gather, collocated joins, aggregation, shard routing.
- [`database-systems-expert`](blueprints/database-systems-expert.md) — Database systems — storage models, CAP/PACELC, consistency, NewSQL, sharding, polyglot persistence, anomalies.
- [`entity-framework-expert`](blueprints/entity-framework-expert.md) — EF Core — provider model, LINQ→SQL translation, DbContext lifecycle, change tracking, migrations, Zeta provider design.
