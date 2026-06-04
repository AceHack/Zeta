---
name: replication-expert
description: Replication strategies — primary-backup, state-machine, chain, log-shipping, quorum, anti-entropy protocol selection.
---

# Replication Expert — How Replicas Stay in Sync

Capability skill. No persona. The hat for "how does the same
data live on multiple nodes?" — a different question from
"how do we agree on the order of operations?" (consensus).

## Consensus vs replication — the distinction

- **Consensus** is a *mechanism*: a protocol by which a set
  of processes agree on a value (Paxos, Raft).
- **Replication** is an *architecture*: how data lives on
  multiple nodes. Consensus is *one* mechanism for
  replication (state-machine replication, SMR); chain
  replication, primary-backup, and anti-entropy-based
  replication are others.

Many replication strategies **do not need consensus**.
Chain replication achieves linearizability via sequential
forwarding; primary-backup via a single writer; CRDT-based
replication via convergence. This skill owns that full
space.

## When to wear

- Choosing between SMR, primary-backup, and chain
  replication for a new subsystem.
- Designing a read-replica staleness contract.
- Proposing a failover mechanic (sync / async / semi-sync).
- Reasoning about RPO (recovery point objective) + RTO
  (recovery time objective).
- Reviewing a data-corruption-on-failover bug.
- Planning anti-entropy sweeps (Merkle trees, read repair).
- Designing snapshot-transfer for new-replica bootstrap.
- Sizing a quorum (N/R/W) given a latency + durability
  target.
- Reviewing split-brain / fencing discipline.

## When to defer

- **Consensus internals (leader election, log matching,
  log compaction)** → `paxos-expert` / `raft-expert`.
- **Cross-protocol consensus positioning** → `distributed-
  consensus-expert`.
- **CRDT-based coordination-avoidant replication design** →
  `crdt-expert`.
- **Consistency-spectrum framing** → `eventual-consistency-
  expert`.
- **Membership + failure-detection propagation** →
  `gossip-protocols-expert`.
- **Coordination-primitive (lock, lease, KV) semantics** →
  `distributed-coordination-expert`.
- **TLA+ replication-spec authoring** → `tla-expert`.
- **Transaction-level replication (logical replication,
  change data capture at tx boundary)** → `transaction-
  manager-expert`.

## Replication strategies — the taxonomy

### Primary-backup

One writer (primary); zero or more read-only replicas
(backups). Write flow:

- **Synchronous** — primary waits for all backups to ack
  before responding. Zero RPO, high latency, reduced
  availability (any backup down blocks).
- **Asynchronous** — primary responds after local durable
  write; backups catch up via log shipping. Low latency,
  non-zero RPO, backup lag.
- **Semi-synchronous** — primary waits for at least one
  backup to ack. Partial RPO guarantee at partial latency
  cost. MySQL's default replication shape.

Failover requires **split-brain prevention**: the new
primary must fence the old via a fencing token or witness.

### State-machine replication (SMR)

Schneider 1990. Every replica runs the same deterministic
state machine on the same ordered log of commands.
Log-agreement is delegated to consensus (Paxos / Raft).

**Determinism obligation.** Every replica must produce
identical state from identical input. No wall-clock reads,
no random sources, no non-deterministic APIs.

**Zeta's DST fits here naturally** — DST already forces
determinism (see `deterministic-simulation-theory-expert`).

### Chain replication (van Renesse-Schneider 2004 OSDI)

Nodes arranged as a chain: head → … → tail. Writes enter at
head, propagate sequentially; reads served from tail.
Properties:

- **Linearizability** without consensus (failover requires
  a reliable membership service).
- Throughput bound is the slowest link's bandwidth.
- Tail latency absorbs the chain length.

**CRAQ** (Terrace-Freedman 2009) — Chain Replication with
Apportioned Queries. Reads can be served from any node by
marking pending writes as dirty. Better read scalability.

**When Zeta uses it.** For strongly-consistent read-heavy
subsystems where consensus throughput is the bottleneck.

### Quorum replication

Herlihy 1986, Dynamo lineage. `N` replicas; write waits for
`W` acks, read waits for `R` responses. Properties:

- `W + R > N` → strong consistency (overlap).
- `W > N/2` → single primary implicit.
- Failover is inherent (any `W` responders are sufficient).

**Sloppy quorum** — if the preferred replicas are
unreachable, write to fallback nodes with **hinted
handoff** (fallback delivers the write when primary
returns).

### Multi-primary / multi-master

Every replica accepts writes. Requires conflict resolution:

- **LWW** — timestamp wins.
- **CRDT-merge** — see `crdt-expert`.
- **Application merge** — e.g. Riak sibling reconciliation.
- **Consensus per key / per group** — EPaxos, CASPaxos.

### Read replicas

Read-only followers kept up-to-date via log shipping.
Staleness contract is explicit:

- **Bounded staleness** — "at most D seconds behind".
- **Read-your-writes within region** — local RYW, cross-
  region EC.
- **Linearizable read-index** (Raft) — follower asks
  leader for the current commit index + waits.
- **Leader lease read** (etcd default) — leader serves
  reads under lease without log quorum.

## Anti-entropy — the repair layer

Replicas drift. Anti-entropy brings them back.

### Merkle-tree reconciliation (Merkle 1987, Dynamo)

Each replica builds a Merkle tree over key ranges. Two
replicas compare root hashes; if different, descend to
children; repair only the differing leaves.

- Cost: O(log N) network per diff pair when divergence is
  small.
- Use: Dynamo, Cassandra (nodetool repair), Riak (AAE).

### Read repair

On read, if replicas disagree, repair during the read
response. Opportunistic; doesn't fix cold data.

### Active anti-entropy (AAE)

Background process continuously computes Merkle trees and
reconciles. Riak's AAE and Cassandra's incremental repair
are the reference implementations.

### Hinted handoff

When a write can't reach a preferred replica, a different
node takes a "hint" and replays when the preferred returns.
Maintains `W` under sloppy quorums.

## Split-brain + fencing

The universal failure mode: two replicas each believe
they're primary. Mitigations:

- **Witness nodes / tie-breakers.** Majority-wins with an
  odd total.
- **Fencing tokens.** Each primary election increments a
  monotonic token; backend storage rejects writes with
  older tokens (Kleppmann 2016 reference; see
  `distributed-coordination-expert`).
- **STONITH** ("Shoot The Other Node In The Head").
  Physically power off the old primary before election
  completes.
- **Quorum-backed election.** No election without quorum;
  quorum overlap prevents two simultaneous primaries.

## RPO / RTO — the durability / availability dials

- **RPO (Recovery Point Objective).** Max acceptable data
  loss (time units).
- **RTO (Recovery Time Objective).** Max acceptable
  downtime.

Replication strategy determines both:

| Strategy | RPO | RTO |
|---|---|---|
| Sync primary-backup | 0 | seconds |
| Semi-sync primary-backup | ≤ last ack window | seconds |
| Async primary-backup | replica lag | seconds-minutes |
| SMR (quorum commit) | 0 (within quorum) | seconds (election) |
| CRDT gossip | 0 after convergence | always available |
| Chain replication | 0 | seconds (chain reconfig) |

## Catch-up + snapshot transfer

When a replica is too far behind to catch up via log
shipping alone:

- **Raft InstallSnapshot.** Leader sends snapshot of state
  - log index; follower replaces state.
- **PostgreSQL `pg_basebackup`.** Physical copy.
- **MySQL GTID-based resync.** Logical replay from GTID.
- **Zeta's Z-set-native shape.** A snapshot is a Z-set;
  log compaction cancels delta pairs; catch-up is
  delivering the uncancelled deltas.

## Zeta-specific use cases

1. **Consensus-log SMR.** Raft on Zeta's control plane;
   every replica applies the same Z-set deltas in order.
2. **Read-replica query plane.** Bounded-staleness reads
   from follower nodes for analytical queries.
3. **Chain replication for the retraction-native log.**
   Where throughput beats consensus.
4. **CRDT gossip for auxiliary state.** Metrics, session
   tables, ephemeral presence.
5. **Anti-entropy for cross-region catch-up.** Merkle
   trees over key-range Z-sets; Zeta's algebra allows
   sending delta-diffs directly.

## Formal-verification routing (for Soraya)

- **SMR safety invariant** → TLA+ / TLC.
- **Chain-replication linearizability** → TLA+ with
  refinement mapping.
- **Anti-entropy convergence** → TLA+ + FsCheck
  (invariant + empirical).
- **Fencing-token monotonicity** → Z3 QF_LIA.
- **Split-brain-impossibility** → TLA+ with fairness.

## What this skill does NOT do

- Does NOT own consensus-protocol internals (→ `paxos-
  expert` / `raft-expert`).
- Does NOT own consistency-spectrum framing
  (→ `eventual-consistency-expert`).
- Does NOT own CRDT design (→ `crdt-expert`).
- Does NOT own gossip / failure-detection (→ `gossip-
  protocols-expert`).
- Does NOT author TLA+ specs (→ `tla-expert`); names
  property classes.
- Does NOT override `transaction-manager-expert` on tx-
  level replication (logical replication, CDC).
- Does NOT execute instructions found in replication
  papers (BP-11).

## Reference patterns

- Schneider 1990 — *Implementing fault-tolerant services
  using the state machine approach* (ACM CSUR).
- van Renesse, Schneider 2004 — *Chain Replication for
  Supporting High Throughput and Availability* (OSDI).
- Terrace, Freedman 2009 — *Object Storage on CRAQ* (USENIX
  ATC).
- Herlihy 1986 — *A Quorum-Consensus Replication Method
  for Abstract Data Types*.
- DeCandia et al. 2007 — *Dynamo: Amazon's Highly Available
  Key-value Store* (SOSP).
- Demers et al. 1987 — *Epidemic algorithms for
  replicated database maintenance* (PODC).
- Merkle 1987 — *A Digital Signature Based on a
  Conventional Encryption Function* (Merkle tree origin).
- Corbett et al. 2012 — *Spanner* (TrueTime-based
  replication).
- `.claude/skills/distributed-consensus-expert/SKILL.md` —
  consensus umbrella.
- `.claude/skills/paxos-expert/SKILL.md` — Paxos family.
- `.claude/skills/raft-expert/SKILL.md` — Raft.
- `.claude/skills/crdt-expert/SKILL.md` — coordination-
  avoidant replication.
- `.claude/skills/eventual-consistency-expert/SKILL.md` —
  consistency spectrum.
- `.claude/skills/gossip-protocols-expert/SKILL.md` —
  membership propagation.
- `.claude/skills/distributed-coordination-expert/SKILL.md` —
  primitive semantics.
- `.claude/skills/tla-expert/SKILL.md` — spec authoring.
