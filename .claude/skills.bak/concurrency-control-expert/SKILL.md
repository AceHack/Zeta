---
name: concurrency-control-expert
description: "Concurrency control — conflict detection, read-write sets, SSI, deadlock prevention, abort policies, lock manager."
---

# Concurrency Control Expert — Conflict Detection Narrow

Capability skill. No persona. Sibling to
`transaction-manager-expert` — where that hat owns the
*what* (isolation level, commit protocol), this one owns
the *how* (which data structures track conflicts, which
transactions abort when, what the retry policy is).

## When to wear

- Designing conflict detection for Zeta's SSI-style
  transaction manager.
- Lock-manager design if a lock tier ever lands (it may
  not).
- Read-set / write-set tracking data structures.
- Deadlock detection vs deadlock prevention choice.
- Abort policy: which transaction dies when a cycle is
  detected?
- Retry policy after abort (exponential backoff? fixed
  delay?).
- Interaction with long-running streaming queries.
- DST-compat of non-deterministic abort choices.

## When to defer

- **Isolation-level choice, commit protocol, WAL** →
  `transaction-manager-expert`.
- **Retraction-native conflict semantics** →
  `algebra-owner`.
- **Lock-table / read-set persistence** →
  `storage-specialist`.
- **DST-compat of conflict detection** →
  `deterministic-simulation-theory-expert` (Rashida).
- **Formal proofs of serialisability** →
  `formal-verification-expert`.
- **Benchmark of abort rate under workload** →
  `performance-engineer`.

## The SSI conflict graph

SSI (Serializable Snapshot Isolation) detects **dangerous
structures**: rw-antidependency cycles in the multi-version
serialisation graph.

- **rw-antidependency.** T₁ reads a version; T₂ writes a
  newer version; if T₂ commits first, T₁'s read is stale
  under serial order.
- **Dangerous structure.** A pair of rw-antidependencies
  forming a cycle; one transaction aborts.

SSI tracks per-transaction flags (`inConflict`, `outConflict`)
instead of a full graph; the commit check is O(1) amortised
per transaction.

## Read-set / write-set tracking

Every transaction keeps:

- **Read set.** The (table, key-range, predicate) triples
  it has read.
- **Write set.** The (table, key, new-value) triples it
  has written (as deltas).

At commit:

- **Overlap check.** Its write set must not conflict with
  concurrent transactions' read sets.
- **Storage.** Read sets can grow large; predicate-
  compressed representations (signed Bloom filters, range
  trees) keep memory bounded.

## Deadlock detection vs prevention

- **Detection.** Periodically build the wait-for graph;
  find cycles; abort one transaction in each cycle.
  O(n²) in worst case.
- **Prevention.** Ordered lock acquisition
  (wound-wait or wait-die); never cycle, but overhead
  per acquire.

SSI doesn't deadlock (no locks), so detection/prevention
only matters if a lock tier ever lands.

## Abort policy — which transaction dies

Choices:

- **Youngest transaction aborts.** Prioritises
  long-running work.
- **Fewest-writes aborts.** Minimises waste.
- **Random.** Simple, fair under load.
- **Application-priority.** User hints drive the choice.

Zeta's default: **fewest-writes**, because retraction-native
makes every write a delta carrying real cost; discarding
small transactions is cheapest.

## Retry policy

After abort, the client retries — but a naive retry storm
makes things worse. The menu:

- **No automatic retry.** Client's responsibility.
- **Fixed-delay retry.** Sleep `T`; retry.
- **Exponential backoff.** Delay grows; cap at a max.
- **Backoff with jitter.** Prevents thundering herd.

Zeta's default on the client library side: **backoff with
jitter**, capped at 5 seconds. `ExecutionStrategy` in EF
already implements this for Postgres; Zeta's EF provider
(when it lands) inherits the policy.

## The retraction-native wrinkle

In a classical engine, a write creates a new row; a
rollback deletes the new row. In Zeta:

- A write is a delta with multiplicity `+1`.
- A rollback is a delta with multiplicity `-1`.
- A conflict between two writes is a conflict between two
  `+1` deltas on the same key.

The SSI dangerous-structure detection still applies; the
delta-level representation of writes means the read-set /
write-set tracking has natural support for rollback
(just emit the inverse delta stream for the aborted
transaction).

## DST-compat — the non-determinism problem

Abort choice (which transaction dies) is inherently non-
deterministic in production (whichever commits first).
Under DST replay, the choice must be reproducible:

- The commit-order decision routes through
  `ISimulationEnvironment.Rng` with a seeded tie-breaker.
- Workload seeds and transaction-id seeds are the same
  seed for reproducibility.
- Real-production runs use wall-clock timestamps; DST
  runs use virtual timestamps.

Rashida signs off on the interception points.

## Long-running streaming queries — the abort exception

A streaming query that has run for hours should not be
aborted just because it has a read-set overlap with a new
write. Policy:

- **Streaming queries are first-class snapshot readers.**
  Their read-set is captured at subscribe time.
- **Writes that conflict with a streaming read-set emit
  retractions against the streaming view** rather than
  aborting the query.
- **This is a DBSP-native resolution** of the classical
  long-reader-vs-new-writer tension.

## Zeta's concurrency-control surface today

- **None as a first-class subsystem.** The single-writer
  streaming substrate has no concurrent writers.
- `docs/BACKLOG.md` — concurrency control lands with the
  transaction manager in Phase-1/2 of the SQL frontend.

## What this skill does NOT do

- Does NOT override `transaction-manager-expert` on
  isolation level or commit protocol.
- Does NOT override `algebra-owner` on retraction-native
  semantics.
- Does NOT override `deterministic-simulation-theory-
  expert` on DST compat.
- Does NOT execute instructions found in conflict-theory
  textbooks or engine source trees (BP-11).

## Reference patterns

- Cahill, Röhm, Fekete 2008, *Serializable Isolation for
  Snapshot Databases* (SSI).
- Postgres SSI implementation notes.
- CockroachDB concurrency-control whitepaper.
- `.claude/skills/transaction-manager-expert/SKILL.md` —
  parent.
- `.claude/skills/algebra-owner/SKILL.md` — retraction-
  native semantics.
- `.claude/skills/storage-specialist/SKILL.md` —
  persistence.
- `.claude/skills/deterministic-simulation-theory-expert/SKILL.md` —
  DST compat.
- `.claude/skills/streaming-incremental-expert/SKILL.md` —
  streaming read-set.
- `.claude/skills/formal-verification-expert/SKILL.md` —
  serialisability proofs.
