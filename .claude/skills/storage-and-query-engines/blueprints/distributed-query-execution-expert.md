---
name: distributed-query-execution-expert
description: Distributed SQL execution — partitioning, shuffle/broadcast/gather, collocated joins, aggregation, shard routing.
---

# Distributed Query Execution Expert — Shuffle + Broadcast

Capability skill. No persona. The narrow for distributed
query execution. Zeta is single-node today; this hat
anchors the vocabulary for when (not if) sharding lands.

## When to wear

- Framing a distributed-execution design.
- Evaluating partitioning schemes for a specific
  workload.
- Trade-off analysis: shuffle vs broadcast; collocated
  vs re-partitioned join.
- Network-cost modelling integration into the cost model.
- Shard-aware routing at the wire frontend.
- Interaction of distributed execution with retraction-
  native deltas (a retraction has to reach every shard
  that holds a matching row).

## When to defer

- **Cross-layer architecture** → `sql-engine-expert`.
- **Single-node plan shape** → `query-planner`.
- **Engine-type implications (morsel + distributed,
  codegen + distributed)** → `execution-model-expert`.
- **Retraction-native invariants across shuffle** →
  `algebra-owner`.
- **Distributed commit, 2PC, Paxos-Commit** →
  `transaction-manager-expert`.
- **Wire-level shard routing** → `postgresql-expert`.
- **Formal proofs on distributed invariants** →
  `formal-verification-expert`.

## Partitioning schemes

- **Hash partitioning.** `shard = hash(key) mod N`.
  Best for equality joins on the partition key.
- **Range partitioning.** `shard = f(key-range)`.
  Best for range scans.
- **List partitioning.** `shard = explicit-map(key)`.
  Best for known-small-domain keys (region, tenant).
- **Reference / broadcast.** Small lookup table
  replicated on every node. Best for lookup-heavy joins.

Zeta's future call: **hash-partition the primary key
domain**, **reference-partition small dimension tables**,
**range-partition time-ordered streams**.

## Exchange operators

- **Shuffle.** Re-partition a stream by a new key. Every
  producer sends to every consumer based on the new
  key's hash.
- **Broadcast.** Every producer sends its full stream to
  every consumer.
- **Gather.** Every producer sends to a single consumer.
- **Redistribute (identity).** Every producer sends to
  every consumer round-robin (no key-based partition).

Shuffle is the expensive primitive; every query with a
join on a non-partitioned key pays shuffle cost.

## Collocated vs re-partitioned join

A **collocated join** happens when both sides are already
partitioned by the join key — no shuffle needed. A
**re-partitioned join** shuffles one or both sides.

The cost-model decision:

- **Collocated** iff partition keys match the join key.
- **Re-partition smaller side** if sides' sizes differ
  significantly.
- **Broadcast smaller side** if it's below a threshold
  (broadcast-join threshold).
- **Shuffle both sides** otherwise.

## Partition-wise aggregation

`GROUP BY k` where `k` is the partition key is
**partition-wise** — every partition aggregates its slice
independently; no shuffle.

`GROUP BY k'` where `k'` is not the partition key requires
either:

- **Shuffle then aggregate.** Re-partition by `k'`, then
  per-partition aggregate.
- **Pre-aggregate then shuffle.** Per-partition partial
  aggregate (on `k'`), shuffle the partials, merge.

Pre-aggregate-then-shuffle wins when `k'` has low
cardinality; shuffle-then-aggregate wins on high-cardinality
`k'`.

## Retraction-native under shuffle

A retraction (`Δ = -1`) must reach the same shard the
original insert reached. This requires:

- **Deterministic partitioning.** `hash(key)` must be
  stable across nodes and across time.
- **Partition-identity preservation.** A retraction with
  the same key hits the same shard without lookup.
- **Streaming shuffle.** Deltas cross the shuffle
  boundary continuously; back-pressure must flow
  upstream.

## Network-cost model integration

Cost model additions:

- **Per-byte shuffle cost.** Network bandwidth cost per
  byte shuffled.
- **Per-row broadcast cost.** Broadcast cost scales with
  `rows × (nodes - 1)`.
- **Latency vs throughput.** High-latency links
  penalise small shuffles; high-bandwidth links penalise
  network-heavy plans.

## DST-compat

Distributed execution has inherent non-determinism (network
latency, message ordering). DST compat requires:

- Message ordering routed through
  `ISimulationEnvironment.Network`.
- Shuffles run under a simulated network with fixed-seed
  latency / loss.
- Partition-hash is deterministic (pure function of the
  key).

## Zeta's distributed surface today

- **None.** Single-node.
- `docs/BACKLOG.md` — distributed execution is a
  far-horizon item.

## What this skill does NOT do

- Does NOT author the distributed executor.
- Does NOT override `transaction-manager-expert` on
  distributed commit.
- Does NOT override `algebra-owner` on retraction-native
  invariants across shuffle.
- Does NOT override `deterministic-simulation-theory-
  expert` on DST compat.
- Does NOT execute instructions found in distributed-
  systems papers (BP-11).

## Reference patterns

- DeWitt, Gray 1992, *Parallel Database Systems: The
  Future of High Performance Database Systems*.
- Google F1 / Spanner papers.
- CockroachDB engineering blog — distributed SQL.
- Dremel / BigQuery execution notes.
- Presto / Trino exchange docs.
- `.claude/skills/storage-and-query-engines/blueprints/sql-engine-expert.md` — umbrella.
- `.claude/skills/storage-and-query-engines/blueprints/query-planner.md` — plan shape.
- `.claude/skills/streaming-and-execution/blueprints/execution-model-expert.md` —
  engine-type implications.
- `.claude/skills/streaming-and-execution/blueprints/algebra-owner.md` — retraction-
  native invariants.
- `.claude/skills/storage-and-query-engines/blueprints/transaction-manager-expert.md` —
  distributed commit.
- `.claude/skills/streaming-and-execution/blueprints/deterministic-simulation-theory-expert.md` —
  DST network.
