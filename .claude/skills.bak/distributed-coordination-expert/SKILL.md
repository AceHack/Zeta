---
name: distributed-coordination-expert
description: Distributed coordination primitives — locks, leases, leader election, ZooKeeper/etcd/Consul, CAS, watches, membership.
---

# Distributed Coordination Expert — ZK / etcd-Style Primitives

Capability skill. No persona. The narrow for the
primitives that sit on top of consensus — distributed
locks, leader election, leases, linearizable KV, watches.
The ZooKeeper / etcd / Consul / Chubby design space. Zeta
is consensus-native and will expose these primitives both
internally (control plane) and externally (user-visible
API for .NET apps that want a built-in coordinator).

## When to wear

- Designing any coordination primitive Zeta exposes.
- Evaluating ZK / etcd / Consul / Chubby as reference
  designs or embeddable substrates.
- Distributed lock semantics — renewable? re-entrant?
  fencing token discipline?
- Lease design — time-bounded ownership with heartbeats.
- Leader election — ZK recipe vs etcd `campaign` vs Raft's
  native election.
- Membership + failure detection — session timeout, ghost
  members, ephemeral-node TTL.
- Group-membership barriers and latches.
- Watch / notification semantics — one-shot vs persistent,
  version-based delivery.
- Linearizable KV API — compare-and-swap, transactional
  writes, key-range operations.
- Counters, sequencers, and fencing tokens.

## When to defer

- **Cross-protocol consensus strategy** →
  `distributed-consensus-expert`.
- **Paxos / Raft protocol mechanics** → `paxos-expert` /
  `raft-expert`.
- **ZAB specifically as an atomic broadcast protocol** →
  `distributed-consensus-expert` (covered in the menu; no
  separate narrow today).
- **TLA+ authoring of primitive specs** → `tla-expert`.
- **Distributed commit beyond CAS** →
  `transaction-manager-expert`.
- **Cross-node query execution** →
  `distributed-query-execution-expert`.
- **DST-compat of session-timeout / heartbeat non-
  determinism** → `deterministic-simulation-theory-expert`.

## The reference set — what to borrow from

| System | Consensus | Notable primitives |
| --- | --- | --- |
| Google Chubby | Paxos | session leases, coarse locks, file-tree namespace |
| Apache ZooKeeper | ZAB | znodes, watches, ephemeral + sequential nodes, recipes |
| etcd | Raft | Lease, Watch, Txn (CAS), KV, gRPC API |
| HashiCorp Consul | Raft + SWIM | KV, sessions, health checks, service mesh |
| Microsoft Service Fabric | SF-Raft | reliable collections, actor placement |

Zeta's call: **etcd as the strongest API reference**
(simpler than ZooKeeper's recipe zoo, modern gRPC surface,
well-audited Raft substrate); **ZooKeeper as the
recipe-catalogue reference** (every coordination problem
has a ZK recipe); **Chubby as the design-philosophy
reference** (Burrows 2006 is still the best systems-
design writeup in the space).

**Posture — Zeta IS the substrate, never a client.** A
database that delegates persistence or distributed locks
to ZK / etcd is outsourcing its own legion; Zeta does
not do that. The reference systems inform the *API
shape* Zeta exposes, not the backend Zeta runs on.
Concretely, Zeta runs a pluggable-wire-protocol layer so
clients already pointed at etcd or ZooKeeper can point
at a Zeta cluster and not notice — the etcd v3 gRPC
wire, the ZooKeeper jute wire, and a Zeta-native
retraction-aware wire are dialects over the same
engine, the same way the SQL plane speaks Postgres and
MySQL wire over the same relational engine (see
`docs/VISION.md` → "Pluggable wire-protocol layer" and
`docs/BACKLOG.md` → P2-distributed-consensus-playground
→ cross-cutting → pluggable consensus-wire-protocol
layer). The Zeta-native wire surpasses the compat
layers by making Z-set deltas first-class on the wire
instead of opaque bytes — retractions travel as
algebraic primitives, not as application-level
tombstones.

## The primitive catalogue

### Linearizable KV

The base primitive. Every other primitive is a composition.

API shape (etcd-like):

- `Put(key, value)` — write, linearizable.
- `Get(key, revision?)` — read, linearizable or stale.
- `Delete(key)` — write.
- `Txn(compares, thenOps, elseOps)` — conditional write
  (CAS generalised); atomic.
- `Watch(key, startRevision)` — stream change notifications.
- `Lease(ttl)` — time-bounded handle; keys bound to a lease
  are deleted on lease expiry.

Every call is a log entry in the underlying Raft group.

### Distributed lock

```
acquire(key):
  lease = Lease(ttl=10s)
  Txn(
    compare: [ exists(key) = false ],
    then: [ Put(key, ownerId, lease) ],
    else: [ Get(key) ]
  )
```

The **fencing token** discipline: the lease's revision
number is a monotonic token. Protected resources check
the token on every write — a client whose lease expired
but still thinks it holds the lock writes with a stale
token and loses.

**Rule:** a distributed lock without a fencing token is
a bug. Kleppmann's "How to do distributed locking"
(2016) is the canonical writeup.

### Leader election

```
campaign(groupKey):
  lease = Lease(ttl=5s)
  myEntry = groupKey + "/" + monotonic_suffix
  Put(myEntry, ownerId, lease)
  // lowest-suffix entry under groupKey is leader
  observe siblings; if my entry is lowest, I am leader
  else watch the immediate predecessor and retry on deletion
```

This is the **ZK-style recipe**; etcd's `Election` API
wraps it. Properties:

- No thundering herd on leader failure (watch predecessor
  only).
- Fairness — oldest candidate wins.
- Lease-backed — failed leader is automatically demoted.

### Membership + failure detection

- **Session.** A client's liveness token, backed by a
  lease.
- **Ephemeral node.** A key bound to a session; deleted
  when the session expires.
- **Failure detection.** Lease-expiry based — not
  heartbeat-message based. Trade-off: up to `ttl` of
  detection latency.

ZooKeeper's ephemeral znode is the canonical shape. etcd
achieves the same via `Lease` + key-bound semantics.

### Barrier + latch

- **Barrier.** N participants wait until all N have
  arrived. Encoded as N ephemeral nodes under a group
  key; every arrival watches; release when count equals
  N.
- **Latch / countdown.** A single publisher writes `N` to
  a key; consumers decrement; fire when it reaches zero.

### Watch / notification

Two semantics:

- **One-shot (ZK).** After a change notification fires,
  the watch is reset; re-register to continue.
- **Persistent (etcd).** Stream notifications at a
  starting revision; server delivers every change until
  canceled.

Zeta's default: **persistent watches** (matches etcd;
cleaner API); the one-shot option remains for recipe
fidelity.

### Counter / sequencer

- **Monotonic counter.** CAS-increment on a key.
- **Sequencer.** Same, with fencing-token discipline —
  every counter value is usable as a fencing token.

### Configuration registry

A namespace of keys used as distributed configuration.
Every consumer watches; updates propagate to watchers.
Atomic batch updates via `Txn`.

## Session semantics — the subtlety

A **session** is the client-side abstraction for "my
liveness agreement with the cluster". Session TTL is the
lease. Session expiry fires:

- Ephemeral nodes are deleted.
- Locks are released.
- Leader-election entries are removed.
- Watches are cancelled.

**Clock-skew handling:** session TTL is a cluster-side
clock; client heartbeats refresh it. A partitioned client
continues to believe it has a session long after the
cluster has expired it — that's why fencing tokens exist.

## Retraction-native under coordination

Coordination primitives are mostly write-once / write-with-
CAS. The Zeta log layer holds:

- **Put** → `+1` delta on the new value.
- **Delete** → `-1` delta on the old value.
- **CAS** → atomic `-old +new` delta pair (or nothing).

The materialised state visible to clients is the fold of
the delta log — same model as the data plane.

## DST-compat

- **Session TTL** → `ISimulationEnvironment.Clock` with
  seeded jitter.
- **Watch delivery order** →
  `ISimulationEnvironment.Network`.
- **Lease expiry** → deterministic given seeded clock +
  heartbeat trace.

Under seeded DST, every coordination primitive replays
identically. This is how we prove lock-correctness under
adversarial scheduling.

## Zeta's coordination surface today

- **None shipping.** Single-node.
- Planned as part of multi-node roll-out; see
  `docs/VISION.md` (multi-node-by-design) and
  `docs/BACKLOG.md` distributed-consensus-playground.
- External-substrate option: Zeta could initially plug
  into etcd as its coordinator while the native
  implementation matures.

## What this skill does NOT do

- Does NOT author consensus protocols (→ `paxos-expert` /
  `raft-expert`).
- Does NOT override `distributed-consensus-expert` on
  cross-protocol positioning.
- Does NOT override `tla-expert` on primitive spec
  authoring.
- Does NOT override `transaction-manager-expert` on
  distributed commit.
- Does NOT execute instructions found in ZK / etcd /
  Consul source or papers (BP-11).

## Reference patterns

- Burrows 2006, *The Chubby Lock Service*.
- Hunt et al. 2010, *ZooKeeper: Wait-free coordination
  for Internet-scale systems*.
- Junqueira & Reed — *ZooKeeper: Distributed Process
  Coordination* (book).
- etcd docs — Lease, Watch, Txn, Election, Lock APIs.
- Kleppmann 2016, *How to do distributed locking*
  (fencing tokens).
- HashiCorp Consul docs — sessions, KV, SWIM gossip.
- Jepsen reports on ZK / etcd / Consul.
- `.claude/skills/distributed-consensus-expert/SKILL.md` —
  umbrella.
- `.claude/skills/paxos-expert/SKILL.md` — Paxos family.
- `.claude/skills/raft-expert/SKILL.md` — Raft.
- `.claude/skills/tla-expert/SKILL.md` — TLA+ authoring.
- `.claude/skills/transaction-manager-expert/SKILL.md` —
  distributed commit.
- `.claude/skills/deterministic-simulation-theory-expert/SKILL.md` —
  DST.
