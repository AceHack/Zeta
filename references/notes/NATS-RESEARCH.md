# NATS + JetStream — Research Notes

Authored synthesis for the `nats` and `nats-jetstream`
upstreams in `reference-sources.json`. Focus: what Dbsp.Core
borrows, what it does not, and where the ideas land in our
code.

## The two systems

**NATS core** (`nats-io/nats-server`, Apache-2.0) is a
subject-based pub/sub wire protocol. Clients connect over TCP
(or WebSocket) and exchange short line-oriented frames — `PUB
subject reply bytes\r\n<payload>`, `SUB subject queue sid`,
`MSG`, `PING`, `PONG`. Subjects are dot-separated tokens
(`orders.us-east.new`) with `*` single-token and `>` multi-token
wildcards. Queue groups turn fan-out into load-balanced
delivery — one receiver per queue-group name gets each message.
Request/reply is built on top: the publisher sets `reply` to a
short-lived inbox subject and blocks on the first response. No
durability; if the server dies, in-flight frames are gone. The
protocol fits on a postcard.

**JetStream** (same repo, MIT-licensed subsystem) is the
durable streaming layer. It replaced the retired "NATS
Streaming / STAN" product in 2021. Key abstractions: **streams**
(append-only logs subscribed to one or more subjects) and
**consumers** (stateful server-side cursors with per-consumer
ack policy, filter subject, delivery mode, and redelivery
rules). Replication is RAFT across 3 or 5 servers, per-stream
replica count. Consumers are push (server delivers to a
subject) or pull (client requests batches). Ack policies:
`AckNone`, `AckAll` (ack N = ack all ≤ N), `AckExplicit`.
Retention is limit-, interest-, or work-queue-based.

## Correctness story

No Jepsen report on JetStream as of 2026-Q1 — the biggest gap
versus Kafka (multiple Kingsbury analyses) or etcd. No
published TLA+ or Ivy spec of JetStream's RAFT usage;
maintainers decline on the basis that RAFT is proved and their
implementation is "just RAFT." Insufficient: the interesting
failures in Kafka's history were always at the log /
consumer-offset seam, exactly where JetStream's server-side
consumer sits. Known issues: split-brain when a stream's
replica set disagrees with the meta-cluster (GH 2022-2024),
double-delivery under leader-change / pull-consumer
interleavings, and `AckAll` being stronger than the docs imply
under consumer restart. Treat correctness claims as
*load-bearing but unproved*.

## Against Kafka / Redpanda / BookKeeper / EventStoreDB

| System       | Partitioning        | Replication | Consumer state       |
| ------------ | ------------------- | ----------- | -------------------- |
| Kafka        | Explicit partitions | ISR + KRaft | Client offsets       |
| Redpanda     | Same as Kafka       | RAFT        | Client offsets       |
| BookKeeper   | Ledgers             | Quorum write | External            |
| EventStoreDB | Streams per aggregate | Gossip/epoch | Server-side        |
| JetStream    | Streams over subjects | RAFT    | Server-side consumers |

JetStream is closer to EventStoreDB than to Kafka: consumers
are first-class server-side objects, not client-held offsets.
Our "checkpoint + replay" story tracks the `eventstore`
reference, not the `kafka` one.

## Why this applies to Dbsp.Core

**NATS core as transport.** Arrow Flight remains the primary
data-plane target — Flight carries zero-copy Arrow batches end
to end; NATS's byte-payload model cannot. NATS fits the
*control plane* — circuit registration, shard-assignment
gossip, liveness — where Flight is overkill. Hard line: no
Arrow batches through NATS; that pays exactly the copy Flight
exists to avoid.

**JetStream as ingestion source.** The real fit. Our Z-set
algebra is retraction-native: `(+1, row)` / `(-1, row)` deltas
map onto `ZSet<_>` with zero adaptation. One subject per
logical input table, each message a signed delta. Action item:
a `JetStreamSource` operator paired with the existing `Sharder`
for fan-out across circuit replicas.

**JetStream as durability substrate.** Secondary. `AckExplicit
+ R=3` maps loosely to `StableStorage`. JetStream acks a
*consumer cursor*, not a transactional commit — reference, not
a plan.

**Sharder mapping.** `InfoTheoreticSharder`
(`src/Dbsp.Core/NovelMathExt.fs:88`) picks least-loaded shard
via a Count-Min sketch; JetStream queue groups use name-hash
with pull-based work-stealing. Compatible: one circuit shard
plays one queue-group member.

**Ack-policy alignment.** `AckExplicit ↔ StableStorage`,
`AckAll ↔ OsBuffered` (batched fsync is the moral equivalent of
a bulk ack), `AckNone ↔ InMemoryOnly`. Useful framing for
`DurabilityMode` docstrings. `WitnessDurable` has no JetStream
analogue — WDC targets sub-ack latency that RAFT can't deliver.

**Threat-model hook.** The unproved RAFT/consumer-state seam
belongs in `docs/security/THREAT-MODEL.md` under T (Tampering)
as a cited example of a popular replicated-log system without
Jepsen coverage — cautionary for any proposal that puts
JetStream on a critical path.

## .NET client

`NATS.Client` (formerly `NATS.Client.Core` +
`NATS.Client.JetStream`) is Apache-2.0, idiomatic async-await.
Shape: `INatsConnection`, `SubscribeAsync<T>`,
`IJetStreamContext`. Relevant if we ship `JetStreamSource` —
adequate, no fork needed; serialisation hooks accept our
`ArrowSerializer` signature cleanly.

## Sources

- `nats-io/nats-server` README + `doc/` (Apache-2.0)
- `nats-io/nats.net` (Apache-2.0)
- ADR-018 "JetStream as the Durable Replacement for STAN",
  `nats-io/nats-architecture-and-design`
- Ongaro + Ousterhout 2014 (RAFT)
- EventStoreDB docs (server-side-consumer comparison)
- Kingsbury, Jepsen reports on Kafka (2013, 2024) — the
  methodology JetStream has not yet been subjected to
