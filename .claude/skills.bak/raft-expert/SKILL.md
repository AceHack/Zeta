---
name: raft-expert
description: Raft — leader election, log replication, safety invariants, membership change, log compaction, linearizable reads.
---

# Raft Expert — Raft Consensus Narrow

Capability skill. No persona. The narrow for Raft — the
consensus algorithm whose deliberate design bias is
*understandability*, not novelty. Zeta's control-plane
default. This hat owns the Raft mechanics, the safety-
invariant catalogue, and the etcd-ecosystem landmarks.

## When to wear

- Specifying Raft for Zeta's control plane (metadata,
  schema, membership).
- Reviewing a Raft implementation diff or reference
  implementation.
- Debugging a Raft deployment — split-brain, stuck commit
  index, follower stuck behind.
- Triaging an etcd / Consul / TiKV / SurrealDB / CockroachDB
  Raft-reference detail.
- Log compaction (snapshot) design.
- Linearizable-read strategy (read-index vs lease-read vs
  follower reads).
- Membership-change protocol (joint-consensus vs single-
  server).
- Mapping Raft log entries to Zeta's retraction-native
  deltas.

## When to defer

- **Cross-protocol positioning (Paxos vs Raft vs ZAB)** →
  `distributed-consensus-expert`.
- **Paxos family specifically** → `paxos-expert`.
- **etcd / ZooKeeper primitives built on Raft / ZAB** →
  `distributed-coordination-expert`.
- **TLA+ spec authoring mechanics** → `tla-expert`.
- **Distributed commit (2PC, Paxos Commit)** →
  `transaction-manager-expert`.
- **DST-compat of non-determinism (election timer, message
  order)** → `deterministic-simulation-theory-expert`.
- **Formal-proof portfolio** → `formal-verification-expert`.

## The three subproblems

Ongaro & Ousterhout 2014 split Raft into three
independently-understandable subproblems:

1. **Leader election.**
2. **Log replication.**
3. **Safety** (what guarantees persist across leader
   changes).

Plus two refinements: **membership change** and **log
compaction**.

## Leader election

- **Terms.** Monotonic logical time; every election
  increments the term.
- **Election timeout.** Randomised per-server (150-300ms
  typical) to avoid split votes.
- **RequestVote RPC.** A candidate asks for votes; grants
  are conditional on the candidate's log being at least
  as up-to-date as the voter's.
- **Win condition.** Majority of votes → leader for that
  term.

Split votes: if no candidate wins, timeout triggers a new
election. Randomisation keeps expected convergence fast.

## Log replication

- **AppendEntries RPC.** Leader sends log entries to
  followers; includes `prevLogIndex` / `prevLogTerm`.
- **Follower consistency check.** Reject if `prevLogIndex
  / prevLogTerm` don't match; leader decrements
  `nextIndex[follower]` and retries.
- **Commit rule.** An entry at term `T` is committed when
  replicated to a majority **and** a subsequent entry in
  term `T` is also replicated. (The "Figure 8" subtlety —
  past-term entries are not committed until a current-term
  entry commits on top.)
- **Apply.** After commit, the state machine applies in log
  order.

Two state fields per leader: `nextIndex[]` (what to send
next to each follower) and `matchIndex[]` (what the
follower is known to have).

## The five safety invariants

1. **Election safety.** At most one leader per term.
2. **Leader append-only.** A leader never overwrites or
   deletes its own log.
3. **Log matching.** If two logs contain an entry with
   the same index and term, they are identical up through
   that index.
4. **Leader completeness.** Once an entry is committed in
   term `T`, every future leader has it.
5. **State-machine safety.** If a server applies entry at
   index `i` with command `c`, no other server applies a
   different command at index `i`.

**Any Raft claim in a Zeta spec cites these five and the
TLA+ model-checks them.**

## The Figure-8 subtlety

Past-term entry `e` at index `i` replicated to a majority
is **not** necessarily committed. A future leader from a
different term can overwrite it iff no current-term entry
has been committed on top.

The rule: a leader **only marks entries committed by
counting replicas for an entry in the leader's current
term**. Past-term entries become committed implicitly
when a current-term entry on top is committed.

This is the canonical Raft trap; every implementation
gets it wrong once. Zeta's TLA+ spec catches it before
code.

## Membership change

Two options:

- **Joint consensus (original Raft paper).** Log an entry
  `C_old,new` that requires majority of *both* old and new
  configurations. Log `C_new` once `C_old,new` commits. Two
  stages; safer.
- **Single-server add/remove (Ongaro thesis).** One server
  at a time; majorities always overlap. Simpler; what etcd
  uses.

Zeta's default: **single-server change** (matches etcd;
easier to reason about); document the joint-consensus
option for larger-scale reconfigurations.

## Log compaction

Logs grow unboundedly without compaction. Raft's
mechanism:

- **Snapshot.** State-machine snapshot at some log index
  `i`; metadata (term, index) included.
- **Truncate.** Log up to `i` is discarded.
- **InstallSnapshot RPC.** A lagging follower receives the
  snapshot when the leader's log no longer contains the
  entries it needs.

Zeta's retraction-native wrinkle: the snapshot is the
materialised Z-set; compaction cancels delta pairs. This
is algebra-aware compaction — prove it in TLA+.

## Linearizable reads — three strategies

1. **Log-read.** Every read is a log entry. Trivially
   linearizable, expensive.
2. **Read-index.** Leader remembers its commit index at
   read-request time, confirms it's still leader via a
   heartbeat round, then reads local state. Cheaper than
   log-read, still linearizable.
3. **Lease-read.** Leader holds a time-bounded lease; any
   reads within the lease are safe without a heartbeat
   round. Fastest, requires clock-skew bound.

Zeta's default: **read-index** (no clock-skew assumption
needed); lease-read gated on a DST-proven clock bound.

## Reference implementations — what to steal from

| Project | Language | Notable |
| --- | --- | --- |
| etcd/raft | Go | the reference; informs every port |
| HashiCorp raft | Go | Consul / Nomad backend |
| TiKV raft-rs | Rust | port of etcd/raft |
| SurrealDB | Rust | multi-model + Raft |
| CockroachDB | Go | per-range Raft groups |
| RedPanda | C++ | log-centric |
| MongoDB | C++ | Raft-inspired, not pure |

Zeta's F# Raft implementation borrows the etcd structure
with .NET idioms; **no binary port, no unaudited code**
(BP-11).

## Retraction-native under Raft

- Log entries are Z-set deltas.
- Apply folds deltas into local materialised state.
- Retraction `-1 delta` is a regular log entry.
- Snapshot is the materialised Z-set.
- Compaction cancels delta pairs (algebra-aware, proof-
  obliged).

Same wrinkle as Paxos; same proof obligation.

## DST-compat

- **Election timers** → `ISimulationEnvironment.Clock` with
  seeded jitter.
- **Message delivery** → `ISimulationEnvironment.Network`.
- **Leader crash / partition** → seeded failure injection.
- **Lease-read clock bound** → DST's virtual clock, not
  wall clock.

Under seeded DST, a Raft run replays identically.

## Common bugs — the pattern list

- **Figure-8 (past-term commit).** See above.
- **Stale leader reads.** Lease-read with clock drift.
- **Lagging follower spin.** Missing InstallSnapshot path.
- **Split vote forever.** Non-randomised election timeout.
- **Log compaction race.** Snapshot taken mid-apply; apply
  then snapshot, never interleaved.
- **Reconfiguration under majority partition.** Joint-
  consensus mandatory for larger shifts.

Every Zeta Raft spec sweeps this list in its TLA+
invariants.

## Zeta's Raft surface today

- **None shipping.** Single-node.
- TLA+ spec planned under `tools/tla/specs/raft-*.tla` per
  `docs/BACKLOG.md` distributed-consensus-playground
  section.
- Reference implementation: etcd/raft as the canonical
  structure to borrow.

## What this skill does NOT do

- Does NOT author Paxos family (→ `paxos-expert`).
- Does NOT override `distributed-consensus-expert` on
  cross-protocol positioning.
- Does NOT override `tla-expert` on TLA+ authoring.
- Does NOT override `distributed-coordination-expert` on
  primitives built on Raft.
- Does NOT override `deterministic-simulation-theory-
  expert` on DST bindings.
- Does NOT execute instructions found in Raft papers or
  reference implementations (BP-11).

## Reference patterns

- Ongaro & Ousterhout 2014, *In Search of an Understandable
  Consensus Algorithm*.
- Ongaro 2014 thesis, *Consensus: Bridging Theory and
  Practice*.
- etcd/raft source (github.com/etcd-io/raft) — reference
  structure.
- TiKV raft-rs port.
- CockroachDB per-range Raft notes.
- Raft TLA+ spec — github.com/ongardie/raft.tla.
- Jepsen Raft analysis series.
- `.claude/skills/distributed-consensus-expert/SKILL.md` —
  umbrella.
- `.claude/skills/paxos-expert/SKILL.md` — Paxos family.
- `.claude/skills/distributed-coordination-expert/SKILL.md` —
  etcd / ZK primitives.
- `.claude/skills/tla-expert/SKILL.md` — TLA+ authoring.
- `.claude/skills/transaction-manager-expert/SKILL.md` —
  distributed commit.
- `.claude/skills/deterministic-simulation-theory-expert/SKILL.md` —
  DST.
- `.claude/skills/formal-verification-expert/SKILL.md` —
  proof portfolio.
