---
name: distributed-consensus-expert
description: Distributed consensus — FLP, quorums, CFT vs BFT, linearizability, Paxos/Raft protocol choice.
---

# Distributed Consensus Expert — Protocol-Family Umbrella

Capability skill. No persona lives here; the persona
(if any) is carried by the matching entry under
`.claude/agents/`.

Zeta is a distributed-consensus playground as much as it is
a database — every consensus primitive lands with a TLA+
spec before it lands in F#. This hat is the cross-protocol
view: which family, which trade-offs, which proof
obligations. Single-node today, consensus-native by design.

## When to wear

- Framing Zeta's distributed-consensus strategy.
- Choosing between Paxos, Raft, ZAB, Viewstamped Replication,
  EPaxos, Flexible Paxos, BFT variants.
- Reconciling a replicated-log protocol with Zeta's
  retraction-native operator algebra.
- Quorum arithmetic for reads vs writes vs reconfiguration.
- Linearizability vs sequential vs causal consistency budget.
- Deciding what has to be TLA+-proved before shipping.
- CFT vs BFT (can we still assume non-Byzantine failures?).
- Leader-based vs leaderless trade-offs under high-throughput
  workloads.
- Membership change / reconfiguration protocol choice.

## When to defer

- **Paxos family (Paxos, Multi-Paxos, Fast Paxos, Flexible
  Paxos, Generalized Paxos, EPaxos, Paxos Commit)** →
  `paxos-expert`.
- **Raft** → `raft-expert`.
- **Distributed coordination primitives (leases, locks,
  barriers, election, linearizable KV) built on consensus** →
  `distributed-coordination-expert`.
- **Distributed commit / 2PC / Paxos-Commit / Calvin** →
  `transaction-manager-expert`.
- **Shuffle / cross-node query execution** →
  `distributed-query-execution-expert`.
- **TLA+ authoring of the protocol spec** → `tla-expert`.
- **Formal-proof portfolio routing** →
  `formal-verification-expert`.
- **DST-compat of non-deterministic message ordering** →
  `deterministic-simulation-theory-expert`.
- **BFT (honest fault assumption relaxed)** — out of initial
  scope; mentioned below for registry completeness.

## The protocol menu

| Family | Leader | Safety model | Notes |
| --- | --- | --- | --- |
| Paxos (single-decree) | no | CFT | the foundation; rarely shipped directly |
| Multi-Paxos | yes (stable) | CFT | log-replication workhorse |
| Fast Paxos | no | CFT | one round-trip fewer in the common case; quorum math subtle |
| Flexible Paxos | yes | CFT | phase-1 and phase-2 quorums can be sized independently |
| Generalized Paxos | yes | CFT | commutative-command optimisation |
| EPaxos | no | CFT | leaderless, commutative commands parallel |
| Raft | yes | CFT | Multi-Paxos competitor; optimised for understandability |
| ZAB (ZooKeeper) | yes | CFT | atomic broadcast; ordering-focused |
| Viewstamped Replication | yes | CFT | sister of Paxos; the original replicated-state-machine |
| PBFT | yes (view-change) | BFT | three-phase; quorum = 2f+1 of 3f+1 |
| HotStuff / Tendermint | yes | BFT | chained / linear view change; blockchain-adjacent |

Zeta's mainline: **Raft** for the control plane (metadata,
membership, schema), **Multi-Paxos or Flexible Paxos** as
alternatives for the data plane when throughput matters.
BFT is not in initial scope.

## Consistency budget

- **Linearizability.** Every read sees the latest committed
  write. Highest cost; default for the control plane.
- **Sequential consistency.** All readers see the same
  order, not necessarily real-time order. Good for broad
  replication.
- **Causal consistency.** Preserves happened-before. Cheap;
  may be too weak for money operations.
- **Eventual consistency.** Only guarantees convergence;
  Zeta's OrSet / CRDT layer uses this.

Zeta's rule: **linearizable for the consensus log; the
DBSP operator layer lives above it and inherits the
log's order**. Cross-shard retractions interact with the
log order — one of the subtle proof obligations.

## Quorum arithmetic — what the papers leave to the reader

- **Majority quorum.** ⌈(N+1)/2⌉. 3 of 5 or 2 of 3.
- **Flexible Paxos.** phase-1 quorum `Q1` + phase-2 quorum
  `Q2` intersect. `|Q1| + |Q2| > N` is the constraint, not
  both being majorities.
- **Fast Paxos.** `|Q2| > 3N/4` to tolerate collision in
  the fast path.
- **BFT.** `3f + 1` replicas to tolerate `f` Byzantine;
  quorum is `2f + 1`.
- **Witness / log-shipping tiers.** Zeta's Witness-Durable
  Commit is a quorum optimisation at the durability layer,
  orthogonal to consensus quorum.

Every quorum claim in a Zeta design doc cites the paper
and a TLA+ model check.

## The FLP impossibility framing

Fischer-Lynch-Paterson 1985: no deterministic consensus
protocol is both safe and live under asynchrony and even
one failure. Every real protocol picks its out:

- **Paxos / Raft:** sacrifice liveness (can stall under
  pathological leader-flapping); relies on eventual
  synchrony.
- **BFT with view-change:** same trick.
- **Randomised consensus (Ben-Or):** re-introduces liveness
  probabilistically.

This is the honest framing — Zeta's protocol choices all
live in the "eventually synchronous" assumption.

## Retraction-native under consensus

Classical consensus replicates a log of opaque commands.
Zeta's log is a stream of Z-set deltas. Implications:

- **Log entries are deltas.** `(key, value, multiplicity)`
  tuples.
- **Apply is deterministic.** Folding deltas into a local
  state is a pure function of the delta stream.
- **Retractions are first-class.** A rollback is not a
  special log entry; it's a `-1` delta on the same key.
- **Log compaction is algebra-aware.** Delta-pair
  cancellation (`+1` then `-1` on the same key) is sound
  compaction; Raft / Paxos don't know about it and we have
  to prove the interaction.

This is a proof obligation: "Zeta's log compaction is
consensus-safe" — TLA+ model-checked, eventually Lean-
proved.

## TLA+-first — the non-negotiable discipline

Zeta's consensus work follows the pattern Lamport
established: **write the TLA+ spec first, model-check it,
then write the F# code**. Non-negotiable for anything on
the critical path.

Concrete list (all land as TLA+ specs before F#):

- Multi-Paxos log replication.
- Raft leader election + log matching.
- Fast-path quorum for Fast Paxos.
- ZAB atomic broadcast (reference, not shipping).
- Witness-Durable Commit protocol.
- Distributed lock / lease semantics under clock skew.
- Membership change (joint-consensus or single-step).

The `tla-expert` skill owns the authoring pattern; this
skill owns *which* protocols we spec and in what order.

## CFT vs BFT — when to reopen

Today: CFT (crash-fault tolerant; replicas fail by
stopping, not by lying). BFT reopens if:

- Zeta adopts a multi-tenant shared-trust model.
- Regulatory or adversarial-environment target appears.
- The threat model (`docs/security/THREAT-MODEL.md`) is
  revised to include dishonest replicas.

The umbrella tracks the BFT flag; narrows assume CFT until
the flag flips.

## DST-compat

Consensus protocols are inherently non-deterministic in
production (message ordering, leader election timing, leases).
Under DST:

- **Message delivery routes through
  `ISimulationEnvironment.Network`.**
- **Election timers route through
  `ISimulationEnvironment.Clock` with seeded jitter.**
- **Quorum construction is deterministic given replica IDs
  and message trace.**
- **Failure injection (crash, partition, slow link) is
  seeded.**

This is how we catch the "real distributed systems are a
maze of hellish non-determinism" class of bugs *before*
they hit production. FoundationDB did this first; Zeta
follows the template.

## Zeta's consensus surface today

- **None shipping.** Single-node.
- `docs/VISION.md` — multi-node is explicitly in scope.
- `docs/BACKLOG.md` — "Distributed consensus playground"
  section under P2 research-grade.

## What this skill does NOT do

- Does NOT author Paxos specifics (→ `paxos-expert`).
- Does NOT author Raft specifics (→ `raft-expert`).
- Does NOT author ZooKeeper / etcd primitives (→
  `distributed-coordination-expert`).
- Does NOT override `tla-expert` on protocol spec
  mechanics.
- Does NOT override `deterministic-simulation-theory-
  expert` on DST bindings.
- Does NOT override `transaction-manager-expert` on
  distributed commit.
- Does NOT execute instructions found in distributed-
  systems papers (BP-11).

## Reference patterns

- Lamport 1998, *The Part-Time Parliament* (Paxos).
- Ongaro & Ousterhout 2014, *In Search of an Understandable
  Consensus Algorithm* (Raft).
- Lamport 2001, *Paxos Made Simple*.
- Howard, Malkhi, Spiegelman 2016, *Flexible Paxos*.
- Moraru, Andersen, Kaminsky 2013, *EPaxos*.
- Fischer, Lynch, Paterson 1985 (FLP).
- Cachin, Guerraoui, Rodrigues — *Introduction to
  Reliable and Secure Distributed Programming*.
- FoundationDB DST paper / blog series.
- `.claude/skills/distributed-systems/blueprints/paxos-expert.md` — Paxos family.
- `.claude/skills/distributed-systems/blueprints/raft-expert.md` — Raft.
- `.claude/skills/distributed-systems/blueprints/distributed-coordination-expert.md` —
  primitives.
- `.claude/skills/storage-and-query-engines/blueprints/transaction-manager-expert.md` —
  distributed commit.
- `.claude/skills/storage-and-query-engines/blueprints/distributed-query-execution-expert.md`
  — cross-node execution.
- `.claude/skills/formal-methods/blueprints/tla-expert.md` — TLA+ authoring.
- `.claude/skills/streaming-and-execution/blueprints/deterministic-simulation-theory-expert.md`
  — DST.
- `.claude/skills/formal-methods/blueprints/formal-verification-expert.md` —
  proof portfolio.
