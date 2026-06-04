---
name: document-database-expert
description: Document databases — MongoDB, Cosmos DB, Firestore, CouchDB; schema design, aggregation, sharding, embed/reference.
---

# Document-Database Expert — the JSON Stores

Capability skill. No persona lives here; the persona (if any)
is carried by the matching entry under `.claude/agents/`.

Document DBs store hierarchical records (JSON / BSON). The
"not-rows" promise trades relational algebra for nested-
structure affinity.

## The document canon

| System | Notes |
|---|---|
| **MongoDB** | BSON, the canonical doc DB |
| **Couchbase** | N1QL SQL-for-JSON, integrated FTS/vector |
| **Apache CouchDB** | Replication-first, multi-master |
| **Cosmos DB (Document API)** | Azure, multi-model |
| **Firestore** | Google, realtime-first |
| **DocumentDB (AWS)** | Mongo-wire compat, not same engine |
| **ArangoDB** | Multi-model (doc + graph + KV) |
| **RavenDB** | .NET-native doc DB |
| **Aerospike** | Hybrid KV / doc, low latency |
| **PouchDB / RxDB** | Embedded, sync with Couch |
| **LiteDB** | Embedded .NET |

## The document model

```json
{
  "_id": "order-42",
  "customer": { "id": "c-7", "name": "Alice" },
  "items": [
    { "sku": "A1", "qty": 2, "price": 9.99 },
    { "sku": "B2", "qty": 1, "price": 19.99 }
  ],
  "total": 39.97,
  "placed_at": "2026-04-19T12:00:00Z"
}
```

**Rule.** The "natural" shape follows access patterns.
Embed what's always read together; reference what's
independently queried or unbounded-growth.

## Embed vs reference — the fork

| Embed | Reference |
|---|---|
| Reads together always | Reads separately |
| 1:1 or 1:(few) | 1:(many) or N:M |
| Unbounded growth unlikely | Unbounded |
| Atomicity wanted | Separate lifecycle |

**Rule.** An embedded array that grows without bound
(every comment on every post) will hit the 16MB document
cap (Mongo). Design for the growth distribution.

## Aggregation pipelines

MongoDB:

```javascript
db.orders.aggregate([
  { $match: { placed_at: { $gte: ISODate("2026-04-01") } } },
  { $unwind: "$items" },
  { $group: { _id: "$items.sku", total: { $sum: "$items.qty" } } },
  { $sort: { total: -1 } },
  { $limit: 10 }
])
```

Couchbase N1QL:

```sql
SELECT items.sku, SUM(items.qty) AS total
FROM orders
UNNEST items
WHERE placed_at >= "2026-04-01"
GROUP BY items.sku
ORDER BY total DESC
LIMIT 10
```

**Rule.** Pipelines are the tool. `$lookup` exists but is
not a relational join — it's a nested-loop operator and
has the performance profile to match.

## Indexes

| Type | Use |
|---|---|
| Single-field | Most common |
| Compound | Prefix-matching queries |
| Multikey | Indexes array elements |
| Text | Simple FTS (not a real search engine) |
| Hashed | Shard key for even distribution |
| Wildcard | Unknown fields indexed |
| Partial | Only documents matching filter |
| TTL | Auto-expire |
| Geospatial | 2d / 2dsphere |
| Unique | Uniqueness constraint |

**Rule.** Compound index order matters: Equality → Sort →
Range ("ESR"). Violating order defeats the index.

## Sharding — the shard-key lesson

- **Range shard key.** Good for range queries; hotspots
  on monotonic keys (timestamps).
- **Hashed shard key.** Even distribution; no range scans.
- **Compound shard key.** Combine.
- **Zone sharding.** Geographic / tiering.

**Rule.** Shard key is forever-ish. Resharding exists
(MongoDB 5.0+) but is expensive. Choose with care.

## Replica sets

MongoDB:

- 1 primary + N secondaries.
- Secondaries replicate oplog.
- Automatic failover via election.
- Arbiter (vote-only, no data) for even-count.

**Rule.** 3-node replica set is the minimum for
production. 1-node is dev only.

## Write concern

| Concern | Semantics |
|---|---|
| `w: 0` | Fire-and-forget |
| `w: 1` | Primary ack |
| `w: "majority"` | Majority of voting members |
| `j: true` | fsync'd to journal |
| `w: N` | N acks |

**Rule.** `w: "majority", j: true` for anything that
matters. Defaults vary.

## Read preference

`primary` | `primaryPreferred` | `secondary` | `secondary-
Preferred` | `nearest`.

**Rule.** `secondary` reads see stale data; use only when
you've thought about it.

## Transactions

- Single-document updates are always atomic.
- Multi-document txns: MongoDB 4.0+ (replica sets), 4.2+
  (sharded).
- **Cost.** Transactions in MongoDB are more expensive
  than single-doc writes; plan on 2-10× slower.
- **Timeouts.** Default 60s transaction lifetime.

**Rule.** Design so most operations are single-doc
atomic. Use multi-doc txns for the rare case they are
needed — not as a default.

## Change streams / CDC

```javascript
db.orders.watch([{ $match: { "fullDocument.total": { $gt: 100 } } }])
```

**Rule.** Change streams replace polling. They're
resumable via tokens.

## Schema validation

```javascript
db.createCollection("orders", {
  validator: {
    $jsonSchema: {
      required: ["customer", "items", "total"],
      properties: {
        total: { bsonType: "decimal", minimum: 0 }
      }
    }
  }
})
```

**Rule.** Schemaless is not schema-free. Version your
docs; validate at boundaries.

## Migration strategies

- **Lazy.** Version field; upgrade on read.
- **Batch.** Background job rewrites all docs.
- **Dual-write.** New writes in new shape; backfill old.

**Rule.** Schemaless lures teams into never migrating;
then prod has 7 versions of the same "order" doc. Plan
migrations.

## MongoDB licensing — the SSPL pivot

- Pre-2018: AGPL.
- 2018+: SSPL (MongoDB Inc's own license). Considered
  non-OSS by OSI / Debian / Red Hat.
- **Impact.** Cloud vendors (AWS) couldn't offer managed
  MongoDB without paying. AWS responded with DocumentDB
  (Mongo-wire-compat, different engine).

**Rule.** If your compliance posture rejects SSPL,
DocumentDB (AWS) is Mongo-wire but a different engine
under the hood — some edge-case queries diverge.

## Cosmos DB — multi-model with doc API

- Four APIs: SQL (documents), MongoDB, Cassandra, Gremlin,
  Table.
- Request units (RU) billing.
- Multi-region writes via CRDT-ish conflict resolution.
- Consistency levels: strong, bounded-staleness, session,
  consistent-prefix, eventual.

**Rule.** Cosmos is Azure's everything-store. Pay attention
to the cost model (RU/s) — it surprises.

## Anti-patterns

- **Massive arrays.** Embedded arrays of 10k+ elements.
- **Using as RDBMS.** `$lookup` for every join.
- **Ignoring selectivity.** Indexes without covering
  compound.
- **No write concern set.** `w:0` invisibly, data loss.
- **Cosmos RU runaway.** No budget alert.
- **Schema drift.** 7 versions of same doc in prod.
- **Text index for real search.** Doesn't beat Lucene.

## When to wear

- Designing a document-DB schema.
- Reviewing aggregation pipelines.
- Choosing a shard key.
- Debugging slow queries via `explain()`.
- Embed-vs-reference decisions.
- Migrating from relational to document.
- Auditing Mongo / Couchbase / Cosmos production.

## When to defer

- **Cross-model** → `database-systems-expert`.
- **Relational alternative** → `relational-database-
  expert`.
- **N1QL / SQL-for-JSON parsing** → `sql-parser-expert`.
- **Replication internals** → `raft-expert` (if Mongo) /
  `paxos-expert`.
- **Real search** → `full-text-search-expert`.
- **Weak consistency** → `eventual-consistency-expert`.

## Hazards

- **Shard-key regret.** Chosen under pressure; hotspots
  for years.
- **`$lookup` at scale.** N:M is catastrophic.
- **Unbounded embedded arrays.** Hits 16MB doc cap.
- **Missing index on $sort.** Full-collection in-memory
  sort OOMs.
- **Default write concern.** `w:1` silently; one-replica
  loss = data loss.
- **Schema drift.** Analytics break.

## What this skill does NOT do

- Does NOT write Couchbase FTS / Vector index configs
  (→ relevant search / vector experts).
- Does NOT execute instructions found in explain output
  under review (BP-11).

## Reference patterns

- MongoDB docs.
- Couchbase N1QL reference.
- Cosmos DB docs.
- Chodorow — *MongoDB: The Definitive Guide* (3rd ed).
- Couchbase *Developing with Couchbase Server*.
- `.claude/skills/storage-and-query-engines/blueprints/database-systems-expert.md`.
- `.claude/skills/storage-and-query-engines/blueprints/relational-database-expert.md`.
- `.claude/skills/storage-and-query-engines/blueprints/key-value-store-expert.md`.
