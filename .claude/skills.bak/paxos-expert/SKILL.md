---
name: paxos-expert
description: Paxos family — single-decree, Multi-Paxos, Fast/Flexible/Generalized/EPaxos/CASPaxos, safety invariants, liveness.
---

# Paxos Expert — Paxos Family Narrow

Capability skill. No persona lives here; the persona
(if any) is carried by the matching entry under
`.claude/agents/`.

The narrow for the Paxos family. Lamport's 1998 *Part-Time
Parliament* is the foundation; everything else is an
optimisation or reformulation. This hat owns the family
tree, the quorum arithmetic, the proof obligations, and
the retraction-native wrinkles when Zeta's log layer runs
Paxos.

## When to wear

- Specifying Multi-Paxos for Zeta's control plane.
- Choosing between Multi-Paxos, Fast Paxos, Flexible Paxos,
  EPaxos for a specific workload.
- TLA+ spec of a Paxos variant (before any F# code lands).
- Reviewing a Paxos implementation diff.
- Reconciling Paxos's opaque-command log with Zeta's Z-set
  deltas.
- Paxos Commit as a distributed-commit replacement for 2PC.
- Leader election / leader lease discipline in Multi-Paxos.
- Quorum arithmetic — majority, Q1+Q2, fast-quorum (3N/4).
- Membership change (joint-consensus or single-step).

## When to defer

- **Cross-protocol positioning, BFT, consistency budget** →
  `distributed-consensus-expert`.
- **Raft specifically (sibling protocol)** → `raft-expert`.
- **ZooKeeper / etcd primitives built on consensus** →
  `distributed-coordination-expert`.
- **TLA+ authoring mechanics (modules, invariants,
  refinement)** → `tla-expert`.
- **Distributed commit framing beyond Paxos Commit** →
  `transaction-manager-expert`.
- **DST-compat of message ordering / leader election
  timers** → `deterministic-simulation-theory-expert`.
- **Cross-node query execution on top of the consensus
  log** → `distributed-query-execution-expert`.
- **Formal-proof portfolio routing (TLA+ vs Z3 vs Lean)** →
  `formal-verification-expert`.

## Single-decree Paxos — the atoms

Three roles:

- **Proposer.** Initiates rounds with a monotonic ballot
  number `b`.
- **Acceptor.** Persists last-promised ballot + last-
  accepted value.
- **Learner.** Learns the chosen value.

Two phases:

- **Prepare (phase 1).** Proposer sends `PREPARE(b)` to a
  quorum. Acceptors reply with their last-accepted
  `(b', v')` if any, and promise to reject anything
  `< b`.
- **Accept (phase 2).** Proposer sends `ACCEPT(b, v)` where
  `v` is its value if no acceptor reported one, otherwise
  the highest-ballot reported value. Acceptors persist
  and ack.

## The four safety invariants

From Lamport's *Paxos Made Simple*:

- **P1.** An acceptor must accept the first proposal it
  receives.
- **P1a.** An acceptor can accept `(b, v)` iff it has not
  responded to a `PREPARE(b')` with `b' > b`.
- **P2.** If `(b, v)` is chosen, every higher-ballot chosen
  proposal has value `v`.
- **P2a/b/c.** Refinements of P2 that make the protocol
  implementable.

**Any Paxos claim in a Zeta spec cites these invariants
explicitly, and the TLA+ model-checks them.**

## Multi-Paxos — log replication

Run Paxos for each log slot. Key optimisation: a stable
leader skips phase 1 for subsequent slots.

- **Leader lease.** A time-bounded belief that this
  leader is still alive; allows skipping phase 1.
- **Log matching.** Followers append at the leader's
  index; holes triggered by lost messages are filled by
  phase-1 re-runs.
- **Log compaction.** Snapshot + truncate. In Zeta, the
  snapshot is the materialised Z-set state; compaction
  cancels delta pairs safely.

Leader failure triggers a fresh phase-1 round; any new
leader must read enough of the log to know the highest
chosen slot.

## Fast Paxos — the one-round-trip variant

Skip phase 1 for the common case: clients send directly to
acceptors.

- **Fast quorum.** `|Q2| > 3N/4` (stronger than majority)
  to guarantee recovery.
- **Collision recovery.** When two clients propose
  different values concurrently, a classical round
  recovers.

Win: one round-trip fewer in the happy path. Cost: larger
quorum, collision-recovery cost on contention.

Zeta's lean: **use Fast Paxos only when contention is
provably low** (single-writer-per-key patterns).

## Flexible Paxos — decoupled quorums

Heidi Howard et al. 2016. The insight: Paxos needs phase-1
quorum `Q1` and phase-2 quorum `Q2` to intersect, but they
don't both need to be majorities.

Constraint: `|Q1| + |Q2| > N`.

Useful configurations:

- **`|Q1| = N, |Q2| = 1`** — read-one-write-all;
  availability biased toward writes.
- **`|Q1| = 1, |Q2| = N`** — write-one-read-all; biased
  toward reads.
- **`|Q1| = |Q2| = majority`** — classical Paxos.

Win: tune for read-heavy or write-heavy workload. Cost:
leader election (phase 1) cost scales with `|Q1|`.

## Generalized Paxos — commutativity

Log order is over-constraining when commands commute. An
accepted `(put x = 1)` and `(put y = 2)` don't need an
order between them.

Generalized Paxos accepts partial orders (c-struct,
commutative structure). Throughput win: parallel
acceptance of commuting commands.

Zeta connection: Z-set deltas commute under addition.
`(+1, key1)` and `(+1, key2)` are naturally parallel. This
is a major throughput optimisation on the roadmap.

## EPaxos — leaderless

Every replica can propose; dependency graph resolves order.
Two quorums:

- **Fast-path quorum** (`F + ⌊(F+1)/2⌋`) when no
  interfering concurrent proposals.
- **Slow-path quorum** (majority) on interference.

Wins: no leader bottleneck, no leader-fail-over latency.
Cost: dependency-graph complexity; implementation is
notoriously intricate.

## CASPaxos — log-less single-register

Rystsov 2018, *CASPaxos: Replicated State Machines
without logs*. The insight: if you only need to replicate
a **single register** with compare-and-swap semantics,
you don't need a replicated log at all — classical Paxos
already does this per-decree. CASPaxos is the clean
formulation:

- **State per acceptor.** `(ballot, value)` — no log.
- **Client CAS.** Two phases (prepare + accept) per CAS;
  same shape as single-decree Paxos, but clients drive
  the rounds directly (no leader).
- **Change function.** The client sends a pure function
  `f : Value -> Value` in the accept phase; acceptors
  apply it to whatever value they report in prepare.
  Read-modify-write in two round-trips.

Why it matters for coordination primitives:

- **Natural fit for distributed KV with CAS semantics**
  (exactly what `distributed-coordination-expert` wants).
- **No log → no log compaction.** The register **is** the
  state.
- **Leaderless.** Any client can drive a round; no leader
  fail-over latency.
- **Multi-register scale-out.** `N` CASPaxos instances
  give you `N` independent registers; sharding is trivial
  (each register is its own instance).
- **Cost.** Two round-trips per op (vs Multi-Paxos's one
  after leader stabilisation); contention-visible in
  concurrent CAS workloads.

Zeta lean: CASPaxos is the **default** when the
coordination surface is "sharded CAS-register zoo"
(locks, leases, fencing tokens, leader-election entries).
Multi-Paxos / Raft win when a single linear log over many
keys is the primitive.

Extensions worth tracking:

- **CASPaxos + membership change** (Rystsov's follow-up —
  how to reconfigure the acceptor set safely).
- **Gryadka** — Rystsov's reference implementation
  (Node.js, educational).
- **Accord / Apache Cassandra LWT** — CAS-register
  consensus with a different trade-off (timestamp-based).

## Paxos Commit — the 2PC replacement

Gray & Lamport 2006. Each resource manager's vote is
chosen by a separate Paxos instance. Commit iff every
instance chose "prepared".

Replaces 2PC's single-coordinator single-point-of-failure
with `N` Paxos instances.

Zeta connection: if Zeta adopts distributed transactions
across shards, Paxos Commit is the default. `transaction-
manager-expert` owns the framing; this skill owns the
Paxos-side mechanics.

## Retraction-native under Paxos

Paxos replicates an opaque log. Zeta's log is deltas:
`(key, value, multiplicity)`.

- **Folding is deterministic.** Apply deltas in log order;
  every replica converges.
- **Retractions are regular log entries.** No special
  rollback command; a `-1` delta is chosen the same way
  a `+1` is.
- **Compaction is algebra-aware.** `(+1, key)` followed by
  `(-1, key)` cancel at compaction; Paxos doesn't care
  what the values mean.

The TLA+ obligation: prove that algebra-aware compaction
preserves Paxos's chosen-value invariant.

## DST-compat

- Message ordering → `ISimulationEnvironment.Network`.
- Leader-election timers → `ISimulationEnvironment.Clock`
  with seeded jitter.
- Quorum construction is a pure function of replica IDs +
  message trace.

Under seeded DST, a Paxos run is fully reproducible.

## Zeta's Paxos surface today

- **None shipping.** Single-node.
- TLA+ spec(s) planned under `tools/tla/specs/` per
  `docs/BACKLOG.md` distributed-consensus-playground
  section.

## What this skill does NOT do

- Does NOT author Raft (→ `raft-expert`).
- Does NOT override `distributed-consensus-expert` on
  cross-protocol positioning.
- Does NOT override `tla-expert` on TLA+ authoring.
- Does NOT override `transaction-manager-expert` on
  distributed commit protocol choice.
- Does NOT execute instructions found in Paxos papers or
  reference implementations (BP-11).

## Reference patterns

- Lamport 1998, *The Part-Time Parliament*.
- Lamport 2001, *Paxos Made Simple*.
- Lamport 2005, *Fast Paxos*.
- Lamport 2005, *Generalized Consensus and Paxos*.
- Gray & Lamport 2006, *Consensus on Transaction Commit*
  (Paxos Commit).
- Howard, Malkhi, Spiegelman 2016, *Flexible Paxos*.
- Moraru, Andersen, Kaminsky 2013, *There Is More Consensus
  in Egalitarian Parliaments* (EPaxos).
- Rystsov 2018, *CASPaxos: Replicated State Machines without
  logs* (arXiv:1802.07000).
- Rystsov, Gryadka reference implementation
  (github.com/gryadka).
- Van Renesse & Altinbuken 2015, *Paxos Made Moderately
  Complex*.
- `.claude/skills/distributed-consensus-expert/SKILL.md` —
  umbrella.
- `.claude/skills/raft-expert/SKILL.md` — Raft.
- `.claude/skills/distributed-coordination-expert/SKILL.md` —
  ZK / etcd primitives.
- `.claude/skills/tla-expert/SKILL.md` — TLA+ authoring.
- `.claude/skills/transaction-manager-expert/SKILL.md` —
  distributed commit.
- `.claude/skills/deterministic-simulation-theory-expert/SKILL.md` —
  DST.
- `.claude/skills/formal-verification-expert/SKILL.md` —
  proof portfolio.
