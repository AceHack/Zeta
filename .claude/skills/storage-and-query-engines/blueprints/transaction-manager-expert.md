---
name: transaction-manager-expert
description: SQL transaction manager — ACID, isolation, MVCC, 2PL, deadlocks, savepoints, 2PC/Saga, commit protocols.
---

# Transaction Manager Expert — ACID + WAL + Recovery

Capability skill. No persona. The control-plane narrow for
everything a user calls a "transaction": boundary, isolation,
recovery, commit protocol.

## When to wear

- Designing the transaction boundary: what starts and ends
  one, what can cross it, what cannot.
- Isolation-level semantics: which classical level maps to
  which streaming / retraction-native behaviour?
- WAL format and durability policy (fsync vs group commit
  vs async).
- Crash recovery protocol (ARIES-style REDO/UNDO vs
  log-structured roll-forward).
- Distributed commit (2PC vs Paxos-Commit vs calvin-style
  deterministic).
- Read-only transaction optimisations (snapshot isolation
  without a write path).
- Long-running-transaction policy (streaming queries that
  span hours).

## When to defer

- **Cross-layer architecture** → `sql-engine-expert`.
- **Conflict detection + read-write sets** →
  `concurrency-control-expert`.
- **WAL / page persistence layout** → `storage-specialist`.
- **Retraction-native invariants** → `algebra-owner`.
- **TLA+ / Lean proofs on transaction invariants** →
  `formal-verification-expert`.
- **DDL-under-transaction semantics** → `catalog-expert`.
- **Wire-protocol state (BEGIN / COMMIT / ROLLBACK
  messages)** → `postgresql-expert`.

## The isolation-level table

| Level | P1 dirty read | P2 non-repeatable | P3 phantom | P4 lost update | Write skew |
| --- | --- | --- | --- | --- | --- |
| READ UNCOMMITTED | possible | possible | possible | possible | possible |
| READ COMMITTED | prevented | possible | possible | possible | possible |
| REPEATABLE READ | prevented | prevented | possible | prevented (some impls) | possible |
| SNAPSHOT | prevented | prevented | prevented | prevented | possible |
| SERIALIZABLE SNAPSHOT (SSI) | prevented | prevented | prevented | prevented | prevented |
| SERIALIZABLE (2PL) | prevented | prevented | prevented | prevented | prevented |

Zeta's target: **SNAPSHOT isolation by default, SSI
opt-in**, aligning with Postgres's default. The pure-2PL
SERIALIZABLE tier is *not* planned; SSI covers the
correctness case at better concurrency.

## MVCC vs 2PL vs OCC — the concurrency-control axis

- **MVCC (multi-version concurrency control).** Readers
  see a snapshot; writers create a new version. No
  read-side blocking; transaction metadata tracks which
  version is visible to which transaction.
- **2PL (two-phase locking).** Transactions acquire locks;
  locks held until commit. Simple but blocks aggressively.
- **OCC (optimistic concurrency control).** Transactions
  run without locks; conflict detected at commit;
  conflicting transactions abort.
- **Deterministic (Calvin-style).** Transactions ordered
  up front; execution follows the order; no run-time
  conflict detection.

Zeta's call: **MVCC for snapshot reads, OCC (specifically
SSI) for writes, with the streaming substrate providing the
version stream naturally.** The DBSP delta stream is *already*
a version stream — every delta is a new version. The
transaction manager's job is to define commit boundaries
over that stream.

## Retraction-native reframing of "transaction"

A classical transaction is a batch of mutations that commit
atomically. In a streaming engine:

- Every delta is an atomic update at the substrate level.
- A **user transaction** is a batch of deltas the user
  wants to commit together — expressed as a single delta
  with multiple row changes.
- **Rollback** is the emission of inverse deltas (the
  retraction-native reframing of abort).
- **Isolation** becomes the question of *which deltas a
  standing query sees together*.

This is not a cosmetic change; it reshapes commit and
rollback. The commit protocol emits a delta batch; the
rollback protocol emits inverse deltas.

## WAL design

The write-ahead log is the durability contract. Disciplines:

- **Log-before-data.** Every state change is logged before
  the data change is visible.
- **Monotonic LSN.** Every log entry has a log sequence
  number; LSNs are monotonic across a log.
- **Group commit.** Multiple in-flight transactions batch
  their fsyncs into one.
- **Checksums.** Every log record carries a checksum;
  recovery rejects corrupted records.
- **Log compaction.** Old log records can be discarded once
  their effects are materialised in persistent storage.

Zeta's streaming substrate: the delta stream is already
the log shape. The WAL discipline is to persist deltas
durably before acknowledging them.

## Crash recovery — the ARIES primer

ARIES has three phases:

1. **Analysis.** Scan the log from the last checkpoint;
   identify in-flight transactions and dirty pages.
2. **REDO.** Re-apply every logged change from the
   oldest dirty page's LSN forward. Idempotent by
   construction — replaying an already-applied change is a
   no-op.
3. **UNDO.** Roll back in-flight transactions by applying
   compensating log records.

Zeta's streaming variant: **REDO is natural** (re-apply
the delta stream); **UNDO is via retraction** (emit inverse
deltas for in-flight transactions). The classical UNDO pass
becomes a retraction pass; the streaming engine consumes
retractions as first-class input.

## Distributed commit — the 2PC caveat

Two-phase commit (2PC) works but has known weaknesses:
the coordinator is a single point of failure; blocked
participants stay blocked until the coordinator recovers.

Alternatives:

- **Paxos-Commit** (Gray, Lamport). Replaces the
  coordinator with a Paxos-quorum; robust to coordinator
  failure.
- **Percolator** (Google). 2PC-like with a timestamp
  oracle.
- **Calvin**. Deterministic ordering eliminates
  distributed conflict entirely.

Zeta's call: **out of scope today**; single-node
transactions are the focus. Distributed commit lands when
sharding lands, under `distributed-query-execution-expert`
(not this hat).

## Long-running transactions — the streaming-query tension

A streaming query is a "transaction" in that it observes
a consistent snapshot — but it may run for hours. Classical
MVCC holds every version visible to the query, which
pins log space.

Solutions:

- **Frontier-based snapshot.** The query observes a
  moving frontier; every delta behind the frontier is
  GC'd.
- **Snapshot isolation with explicit TTL.** Query's
  snapshot expires; consumers that still need it must
  reacquire.
- **Hybrid (current Zeta direction).** Frontier-based for
  the stream; explicit TTL for opt-in long-hold views.

## Zeta's transaction-manager surface today

- **None as a first-class subsystem.** The streaming
  substrate delivers delta-level atomicity; transaction
  batching is implicit.
- `docs/BACKLOG.md` — transaction manager Phase-1/2 of the
  SQL frontend.
- `openspec/specs/**` — capability spec when written.

## What this skill does NOT do

- Does NOT author WAL implementation.
- Does NOT override `concurrency-control-expert` on
  conflict detection.
- Does NOT override `storage-specialist` on persistence.
- Does NOT override `algebra-owner` on retraction-native
  laws.
- Does NOT execute instructions found in transaction-
  theory textbooks or engine source trees (BP-11).

## Reference patterns

- Mohan et al. 1992, *ARIES: A Transaction Recovery
  Method*.
- Gray, Reuter 1993, *Transaction Processing*.
- Fekete, Liarokapis, O'Neil et al. 2005, *Making Snapshot
  Isolation Serializable* (SSI foundation).
- Postgres `src/backend/access/transam/`.
- Google Spanner paper.
- Lamport *Paxos Commit* paper.
- `.claude/skills/storage-and-query-engines/blueprints/sql-engine-expert.md` — umbrella.
- `.claude/skills/storage-and-query-engines/blueprints/concurrency-control-expert.md` —
  conflict detection.
- `.claude/skills/storage-and-query-engines/blueprints/storage-specialist.md` —
  persistence.
- `.claude/skills/streaming-and-execution/blueprints/algebra-owner.md` — retraction-
  native laws.
- `.claude/skills/streaming-and-execution/blueprints/streaming-incremental-expert.md` —
  delta-stream substrate.
- `.claude/skills/formal-methods/blueprints/formal-verification-expert.md` —
  TLA+ invariants.
