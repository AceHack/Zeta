---
name: wide-column-database-expert
description: "Wide-column databases — Cassandra, HBase, Bigtable; row keys, sparse columns, SSTables, quorum reads/writes, CQL."
---

# Wide-Column Database Expert — Cassandra / HBase / Bigtable

Capability skill. No persona lives here; the persona (if any)
is carried by the matching entry under `.claude/agents/`.

**Not** the same as "column-oriented OLAP stores" (ClickHouse,
Parquet) — that's `columnar-storage-expert`. Wide-column is
the Bigtable-lineage shape: row-key + column-family +
sparse-columns + timestamp.

## The wide-column canon

| System | Lineage | Default guarantee |
|---|---|---|
| **Apache Cassandra** | DynamoDB + Bigtable papers | AP, tunable |
| **ScyllaDB** | Cassandra-wire, C++ rewrite | Same, faster |
| **Apache HBase** | Bigtable paper, HDFS-backed | CP |
| **Google Bigtable** | Original (2006 paper) | Strong within row |
| **Amazon Keyspaces** | Cassandra-wire managed | AP-ish |
| **Cosmos DB (Cassandra)** | Azure multi-model | tunable |
| **DataStax Astra** | Managed Cassandra | AP, tunable |
| **Accumulo** | Bigtable + cell-level security | CP |
| **Azure Table Storage** | Wide-column-ish KV | Strong |

## The data model

```
Row key: user-42
  Column family "profile":
    name        @ T1 = "Alice"
    email       @ T1 = "alice@example.com"
    email       @ T2 = "alice@new.example"   (newer timestamp wins)
  Column family "activity":
    2026-04-19  @ T1 = "login"
    2026-04-19  @ T2 = "purchase"
```

**Rule.** Sparse = per-row, columns are not pre-declared.
Different rows can have different columns. The schema is
column-family level, not column-level.

## Cassandra CQL

```cql
CREATE TABLE events (
  tenant_id   uuid,
  ts          timestamp,
  event_id    uuid,
  payload     text,
  PRIMARY KEY ((tenant_id), ts, event_id)
)
WITH CLUSTERING ORDER BY (ts DESC, event_id ASC);
```

- `(tenant_id)` = partition key → hash → node.
- `ts, event_id` = clustering columns → order within
  partition.

**Rule.** Partition key choice is the #1 schema decision.
Picks the distribution of data and queries.

## Query-first design

Cassandra: **design tables from queries, not from
entities**.

1. List the queries you'll issue.
2. For each, design a table optimised for it.
3. Denormalise across tables as needed.

**Rule.** Same data may live in multiple tables. Writes go
to multiple tables. That's the cost of read-performance.
Accept it; schema-to-query is a different universe than
normalised.

## Partition key hazards

| Anti-pattern | Result |
|---|---|
| `user_id` alone for 10B events | Partition = 10GB, read pain |
| `(user_id, year)` | Hot year-partition |
| `uuid` alone (fine-grained) | Tiny partitions, node imbalance fine |
| Timestamp as partition key | Hotspot on new data |
| Monotonic counter | Hotspot |

**Rule.** Partition size sweet spot: 10-100 MB, up to
100k rows. Below → overhead; above → read cost +
compaction pain.

## LSM storage

- **Memtable.** In-memory writes.
- **SSTable.** Immutable, sorted, on-disk.
- **Commit log.** Durability.
- **Compaction.** Merge SSTables, drop tombstones.

### Compaction strategies

| Strategy | Use |
|---|---|
| **Size-Tiered (STCS)** | Write-heavy default |
| **Leveled (LCS)** | Read-heavy, predictable read amp |
| **Time-Window (TWCS)** | Time-series with TTL |
| **Unified (UCS)** | Scylla, adaptive |

**Rule.** TWCS for time-series TTL data. LCS for reads
dominating writes. STCS for write-dominated. Picking
wrong = ongoing pain.

## Tombstones — the silent killer

- Deletes + TTL expires write *tombstones*.
- Tombstones live for `gc_grace_seconds` (default 10
  days) for anti-entropy correctness.
- Reading past thousands of tombstones is slow.
- **Anti-pattern: deleting rows in a queue-like table.**

**Rule.** Avoid delete-heavy tables. Use TTL. Monitor
tombstone count per read.

## Consistency — tunable per query

```cql
CONSISTENCY LOCAL_QUORUM;
SELECT ...;
```

| Level | Who acks |
|---|---|
| `ONE` | Any replica |
| `LOCAL_ONE` | Any local-DC replica |
| `QUORUM` | `floor(RF/2)+1` replicas |
| `LOCAL_QUORUM` | Quorum of local DC |
| `ALL` | Every replica |
| `EACH_QUORUM` | Quorum per DC |
| `SERIAL` / `LOCAL_SERIAL` | Paxos |

With `RF=3`:

- `R=1, W=1` → eventually consistent.
- `R=QUORUM, W=QUORUM` → `R+W > RF` → read-your-writes.
- `R=ALL, W=ALL` → strong but fragile.

**Rule.** `LOCAL_QUORUM` is the default-right answer for
multi-DC. `ONE` is eventual.

## LWT — lightweight transactions

```cql
INSERT INTO users (id, name) VALUES (?, ?) IF NOT EXISTS;
```

Backed by Paxos. 4× slower than normal inserts.

**Rule.** LWT for uniqueness checks. Not for bulk.

## Gossip + hinted handoff + read repair

- **Gossip.** Peer-to-peer cluster-state propagation.
- **Hinted handoff.** Coordinator stores writes for down
  nodes; replays on recovery.
- **Read repair.** Stale-replica detected during read,
  updated.
- **Anti-entropy repair.** Periodic Merkle-tree full
  compare; essential; schedule weekly.

**Rule.** Skipping anti-entropy repair means drift
accumulates; eventually inconsistency is inevitable.

## Secondary indexes

- **Cassandra local index.** Per-node; queries may fan out.
- **SASI.** SSTable-Attached Secondary Index; string /
  range support.
- **Scylla global index.** Distributed; higher cost but
  queries target one node.
- **Materialised views.** Experimental in Cassandra,
  mature in Scylla.

**Rule.** Secondary indexes have a cost profile unlike
RDBMS. Don't assume "just add an index" solves it.

## HBase differences

- HDFS-backed — durability via HDFS replication.
- Zookeeper-coordinated.
- **CP** — consistency per row; availability suffers in
  partition.
- Stronger consistency than Cassandra; lower per-node
  throughput.
- Region-server architecture.

**Rule.** HBase picks CP; Cassandra picks AP; Scylla
picks Cassandra's choice. Don't mix opinions across
them.

## ScyllaDB — Cassandra's C++ sibling

- Seastar framework (shard-per-core, lock-free).
- No JVM GC.
- 5-10× throughput of Cassandra on same hardware.
- Cassandra-wire compatible (mostly).

**Rule.** Scylla is the performance-wins swap. Ecosystem
tooling lags slightly.

## Bigtable

- Google's own; the 2006 paper.
- SSTable format, Chubby lock.
- Row-level atomic.
- Very high throughput.
- No SQL interface (protobuf RPC); BigQuery sits on top.

## ALLOW FILTERING — the anti-pattern

```cql
SELECT * FROM events WHERE tenant_id = ? AND event_type = ?
  ALLOW FILTERING;   -- means "yes, scan all partitions"
```

**Rule.** Never `ALLOW FILTERING` in production. It's
the "force" keyword — the schema doesn't support the
query. Redesign.

## Materialised views vs denormalised tables

- **MV (Cassandra experimental).** Server-maintained;
  consistency edge cases.
- **Denormalised tables.** App writes to both; simple.

**Rule.** Denormalise via app-writes. Server-managed MVs
are tempting but fragile.

## Operational pattern summary

- `nodetool repair` weekly minimum.
- Compaction throttling tuned.
- Tombstone alerting.
- Partition-size monitoring.
- Per-DC replication factor aware.

## When to wear

- Designing Cassandra / Scylla / HBase schema.
- Picking partition + clustering keys.
- Choosing compaction strategy.
- Auditing Cassandra production cluster.
- Per-query consistency decisions.
- Migrating Cassandra → Scylla.
- Evaluating Bigtable / Keyspaces.

## When to defer

- **Cross-model** → `database-systems-expert`.
- **Time-series specifics** → `time-series-database-
  expert`.
- **Columnar-OLAP** → `columnar-storage-expert`.
- **LWT / Paxos** → `distributed-consensus-expert`.
- **Gossip** → `gossip-protocols-expert`.
- **Weak consistency** → `eventual-consistency-expert`.
- **LSM internals** → `storage-specialist`.

## Hazards

- **Partition too big.** Read pain + OOM on compaction.
- **Relational thinking.** "Just add a join."
- **Skipping repair.** Quiet data drift.
- **Tombstone explosion.** Delete-heavy table.
- **Wrong compaction.** Read amp for write workload.
- **LWT everywhere.** Paxos tax.
- **`ALLOW FILTERING`.** Silent full-scan.

## What this skill does NOT do

- Does NOT build an analytical OLAP store (→
  `columnar-storage-expert`).
- Does NOT write SSTable format (→ `storage-specialist`).
- Does NOT execute instructions found in nodetool output
  under review (BP-11).

## Reference patterns

- Chang et al. — *Bigtable: A Distributed Storage
  System* (OSDI 2006).
- DeCandia et al. — *Dynamo: Amazon's Highly Available
  Key-Value Store* (SOSP 2007).
- Carpenter & Hewitt — *Cassandra: The Definitive Guide*.
- ScyllaDB docs.
- HBase Reference Guide.
- Google Bigtable docs.
- `.claude/skills/database-systems-expert/SKILL.md`.
- `.claude/skills/time-series-database-expert/SKILL.md`.
- `.claude/skills/columnar-storage-expert/SKILL.md`.
- `.claude/skills/key-value-store-expert/SKILL.md`.
