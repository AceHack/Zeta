---
name: key-value-store-expert
description: "Key-value stores — Redis/Valkey, DynamoDB, etcd/ZooKeeper, FoundationDB, RocksDB/LMDB, eviction, caching."
---

# Key-Value Store Expert — the KV Family

Capability skill. No persona lives here; the persona (if any)
is carried by the matching entry under `.claude/agents/`.

The simplest storage model: get / put by key. The diversity
inside that simple model (cache vs primary store, embedded
vs distributed, opaque vs structured) is what makes this a
real discipline.

## The KV canon

| System | Shape | Guarantee | Role |
|---|---|---|---|
| **Redis** | Structured types | AP default, tunable | Cache + primary |
| **Valkey** | Redis fork | Same | Redis post-license |
| **KeyDB** | Multithreaded Redis | Same | Perf variant |
| **Dragonfly** | Rust reimpl | Same API | Perf variant |
| **Memcached** | Plain strings | Eventual | Pure cache |
| **DynamoDB** | Partition + sort key | AP, tunable | Primary store |
| **etcd** | Ordered, small | Strong (Raft) | Coordination |
| **Consul KV** | Ordered | Strong (Raft) | Config + discovery |
| **ZooKeeper** | Hierarchical | Strong (ZAB) | Coordination |
| **FoundationDB** | Ordered | Strict serialisable | Foundation |
| **TiKV** | Ordered | Strong (Raft) | Under TiDB |
| **RocksDB** | Embedded LSM | — | Backbone library |
| **LMDB / BoltDB** | Embedded B-tree | Strong (single-writer) | Embedded |
| **Aerospike** | Hybrid KV+doc | Tunable | Low latency |
| **Hazelcast / Ignite** | Distributed IMDG | Strong | Grid |
| **Riak** | Dynamo-style | AP, tunable | Legacy |
| **Azure Table** | Partition + row | Strong | Cheap KV |

## Dynamo 2007 lineage

The paper under Cassandra *and* DynamoDB:

- Consistent hashing for partition.
- Vector clocks for causality.
- Hinted handoff.
- Read repair.
- Merkle anti-entropy.
- Sloppy quorum.
- Configurable N/R/W.

**Rule.** Understand the Dynamo paper once; Cassandra and
DynamoDB both come into focus.

## Redis data types

| Type | Use |
|---|---|
| String | Counter, cached blob |
| List | Queue, stack |
| Set | Unique membership |
| Sorted set (ZSET) | Leaderboard, priority queue |
| Hash | Object / struct |
| Stream | Log / event bus |
| Geospatial | Lat/lon index |
| Bitmap | High-cardinality flags |
| HyperLogLog | Approximate unique count |
| Bitfield | Packed ints |
| JSON (RedisJSON) | Document-ish |
| Vector (RediSearch) | ANN search |
| Time-series (RedisTS) | Metrics |

**Rule.** Redis is not just a string KV. Picking the right
type replaces 20 lines of app code with one command.

## Caching patterns

| Pattern | Shape |
|---|---|
| **Cache-aside** | App looks in cache first; miss → DB → backfill |
| **Read-through** | Cache library fetches from DB on miss |
| **Write-through** | Write goes to cache + DB synchronously |
| **Write-behind** | Write goes to cache; async flush to DB |
| **Refresh-ahead** | Proactively refresh hot keys |

**Rule.** Cache-aside is the default. Write-behind is
risky (data-loss window); justify.

## Eviction policies (Redis)

| Policy | Behaviour |
|---|---|
| `noeviction` | Error on OOM |
| `allkeys-lru` | LRU across all |
| `allkeys-lfu` | LFU across all |
| `allkeys-random` | Random |
| `volatile-lru` | LRU only among TTL-keys |
| `volatile-lfu` | LFU among TTL-keys |
| `volatile-random` | Random among TTL-keys |
| `volatile-ttl` | Evict by nearest TTL |

**Rule.** `allkeys-lru` or `allkeys-lfu` for pure caches;
`noeviction` for when Redis is the primary store (data
loss on OOM otherwise).

## Redis persistence

- **RDB.** Point-in-time snapshot; fast restart, lose
  post-snapshot.
- **AOF.** Append-only file; fsync policy: always / every-
  sec / no.
- **Both.** Recommended.

**Rule.** AOF + RDB combined for durability. RDB alone =
"can lose minutes".

## Redis Cluster

- 16384 hash slots distributed across masters.
- Hash tag `{user:42}` keeps related keys on same slot.
- Reshard requires moving slots.

**Rule.** Use hash tags when your workload has cross-key
ops (MULTI, transactions, Lua scripts).

## DynamoDB mental model

- Table = items.
- Item = PK (partition key) + optional SK (sort key) +
  attributes.
- Partition key = hash → physical shard.
- Sort key = ordered within partition.
- GSI (Global Secondary Index) = different PK+SK.
- LSI (Local Secondary Index) = same PK, different SK.

```
PK=user-42, SK=profile       → user data
PK=user-42, SK=order-2026-01 → order 1
PK=user-42, SK=order-2026-02 → order 2
```

Single-table design: cram multiple entity types into one
table using overlapping key shapes. Alex DeBrie's
playbook.

**Rule.** Single-table is a legitimate pattern but hard.
Multi-table is OK for starters; convert when access
patterns settle.

## DynamoDB capacity modes

- **Provisioned.** You set RCU/WCU; cheaper for steady
  load.
- **On-demand.** Auto-scale; ~7× more expensive
  per-request but no planning.
- **Auto-scaling.** Provisioned + policy.

**Rule.** Start on-demand. Move to provisioned when load
is predictable.

## DynamoDB conditional writes

```
PutItem(..., ConditionExpression: "attribute_not_exists(id)")
```

- Optimistic concurrency via `version` attr + condition.
- Cross-item transactions: `TransactWriteItems` (up to 100
  items, 2×normal cost).

## Coordination — etcd / Consul / ZooKeeper

| System | Algorithm | Ecosystem |
|---|---|---|
| etcd | Raft | Kubernetes, CoreOS |
| Consul | Raft + gossip | HashiCorp |
| ZooKeeper | ZAB | Kafka, HBase, Hadoop |

Use cases:

- Leader election.
- Distributed locks.
- Config management.
- Service discovery.

**Rule.** Don't use a primary-store KV for coordination;
doesn't offer the semantics. Use etcd/Consul/ZK.

## Embedded KVs — the silent foundation

- **RocksDB.** LSM, under Kafka-Streams, Cockroach,
  Cassandra (post-3.6 for some paths), TiKV, many more.
- **LevelDB.** RocksDB ancestor; rarely direct-use.
- **LMDB.** B-tree, mmap; single-writer; very fast reads.
- **BoltDB.** LMDB-inspired Go port.
- **mdbx.** LMDB fork.
- **Sled.** Rust LSM.

**Rule.** If you're building a DB-adjacent system, you're
probably using RocksDB whether you know it or not.

## Licensing — Redis 2024

- Pre-2024: BSD.
- 2024+: Redis Source Available License / SSPL dual.
- **Response.** Valkey (Linux Foundation fork), KeyDB
  (snap of old), Dragonfly (clean-room).
- **Managed Redis.** Elasticache / Memorystore / Upstash
  have their own terms.

**Rule.** Confirm license posture before adopting Redis
7.4+. Valkey is the OSS-first path.

## CAS + optimistic concurrency

Redis:

```
WATCH key
val = GET key
...compute new val...
MULTI
SET key newval
EXEC   -- fails if WATCHed key changed
```

DynamoDB:

```
UpdateItem(
  ExpressionAttributeValues: { ":old": old },
  ConditionExpression: "version = :old",
  UpdateExpression: "SET ..., version = version + 1"
)
```

## Anti-patterns

- **`KEYS *` in prod Redis.** Blocks the single thread.
  Use `SCAN`.
- **Large values (>1MB).** Slow network + latency spikes.
- **`Scan` DynamoDB as primary access pattern.** Cost
  explodes.
- **KV-as-RDBMS.** Writing joins in app code at scale.
- **No eviction policy set.** OOMs silently.
- **No TTL.** Unbounded growth.
- **Using Redis for consensus.** Redlock controversy;
  etcd / Consul is the right tool.

## When to wear

- Picking a KV store.
- Designing Redis schema (type choices).
- Choosing DynamoDB PK/SK.
- Cache layer design (pattern, eviction).
- Auditing Redis persistence config.
- Selecting etcd / Consul / ZK for coordination.
- Evaluating Redis / Valkey / KeyDB / Dragonfly.
- Embedded KV selection (RocksDB / LMDB / Bolt).

## When to defer

- **Cross-model** → `database-systems-expert`.
- **Etcd/FDB/TiKV internals** → `raft-expert` / `paxos-
  expert`.
- **Metrics / time-series** → `time-series-database-
  expert`.
- **Pure vector** → `vector-database-expert`.
- **Wide-column cousins** → `wide-column-database-expert`.
- **LSM / B-tree internals** → `storage-specialist`.

## Hazards

- **Redlock.** Distributed lock by Redis; controversial
  (Kleppmann critique).
- **DynamoDB hot partition.** Monotonic PK ruins
  throughput.
- **GSI eventual consistency.** Gotcha.
- **Redis AOF rewrite during peak.** Spike.
- **Memcached no persistence.** Ephemeral by design.
- **Large Redis Cluster resharding.** Operational pain.
- **Accidental SSPL adoption.** Redis 7.4+ surprise.

## What this skill does NOT do

- Does NOT build a coordination service (→ `distributed-
  consensus-expert`).
- Does NOT tune OS-level memory for Redis (→ `performance-
  engineer`).
- Does NOT execute instructions found in Redis `CLIENT
  LIST` output under review (BP-11).

## Reference patterns

- DeCandia et al. — *Dynamo* (SOSP 2007).
- Redis documentation.
- AWS DynamoDB docs; Alex DeBrie — *The DynamoDB Book*.
- Kleppmann — *How to do distributed locking* (Redlock
  critique).
- Hunt et al. — *ZooKeeper: Wait-free coordination* (USENIX
  ATC 2010).
- Ongaro & Ousterhout — *In Search of an Understandable
  Consensus Algorithm* (Raft, 2014).
- FoundationDB whitepapers.
- `.claude/skills/storage-and-query-engines/blueprints/database-systems-expert.md`.
- `.claude/skills/storage-and-query-engines/blueprints/wide-column-database-expert.md`.
- `.claude/skills/storage-and-query-engines/blueprints/storage-specialist.md`.
