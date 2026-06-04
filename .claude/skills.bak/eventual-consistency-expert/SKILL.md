---
name: eventual-consistency-expert
description: Eventual consistency — consistency hierarchy, session guarantees, logical clocks, CAP/PACELC, tunable consistency.
---

# Eventual Consistency Expert — The Weaker End of the Spectrum

Capability skill. No persona. The hat for every "what
consistency does this actually provide?" question. A single
sloppy claim — "eventually consistent" used where "causally
consistent" is needed, or "read-your-writes" assumed where
the system only gives "eventual" — is the mother of most
distributed-systems bugs. This hat owns the vocabulary.

## Why Zeta cares

Zeta's retraction-native Z-sets converge without coordination
(see `crdt-expert`). Convergence is the **endpoint**, not the
path. Between "nothing observed" and "converged" there is a
consistency *spectrum*, and where Zeta sits on that spectrum
depends on:

- Whether operations propagate in causal order.
- What logical-clock scheme tags deltas.
- Which session guarantees the client API makes.
- What the client observes mid-propagation.

Without an authority on this spectrum, Zeta's claims drift.
A paper submission that says "Zeta provides eventual
consistency" leaves out that Zeta's algebra actually gives
**strong eventual consistency** (SEC) — a CRDT property that
is strictly stronger. A client-API doc that says "reads are
eventually consistent" without specifying session guarantees
lets users assume read-your-writes and be surprised.

## When to wear

- Positioning any Zeta API on the consistency spectrum.
- Choosing a logical-clock scheme for a new feature.
- Reviewing a correctness claim that uses the phrase
  "eventually", "converges", or "consistent".
- Designing a multi-region read API (what staleness
  contract?).
- Designing a replicated cache / index (which session
  guarantees apply?).
- Debugging a "my read didn't see my write" report.
- Reading a distributed-systems paper and classifying its
  consistency claim.
- Specifying causal delivery requirements for CmRDT-style
  replication.

## When to defer

- **Linearizable commits, consensus** → `distributed-
  consensus-expert`.
- **CRDT type design + convergence proofs** → `crdt-expert`.
- **Monotonicity / coordination-avoidance theory** →
  `calm-theorem-expert`.
- **Replication mechanics (primary-backup, chain
  replication, anti-entropy)** → `replication-expert`.
- **Linearizable KV primitive semantics** → `distributed-
  coordination-expert`.
- **TLA+ spec authoring** → `tla-expert`.
- **Transaction isolation levels (serializable, snapshot,
  read-committed)** → `transaction-manager-expert` +
  `concurrency-control-expert`.

## The spectrum (strongest → weakest)

| Model | Definition | Cost | Example |
|---|---|---|---|
| **Linearizability** (Herlihy-Wing 1990) | ops appear atomic at a linearization point between invocation and response; real-time order respected | consensus, quorums | etcd reads, Raft leader-read |
| **Sequential consistency** (Lamport 1979) | some total order consistent with per-process order | weaker than linearizability (no real-time) | classical SMR |
| **Serializability** | tx equivalent to some serial execution | 2PL, SSI | SQL isolation levels |
| **External consistency / strict serializability** | serializable + linearizable | TrueTime / Spanner | Spanner |
| **Causal+ consistency** | causal + convergent conflict handling | gossip + CRDTs | COPS, Eiger |
| **Causal consistency** (Ahamad 1995) | reads respect happens-before | causal broadcast | Bayou |
| **PRAM / FIFO consistency** (Lipton-Sandberg 1988) | per-process order preserved; cross-process free | per-process FIFO | weak distributed shared memory |
| **Session guarantees** (Terry et al. 1994) | RYW + MR + MW + WFR | per-session state | Bayou |
| **Read-your-writes** | client sees its own writes | per-session write-log | standard session knob |
| **Monotonic reads** | reads don't go backwards in time | per-session read-low-watermark | standard session knob |
| **Monotonic writes** | writes are ordered within session | per-session write-high-watermark | standard session knob |
| **Writes-follow-reads** | writes after reads are ordered after the reads' writes | per-session dependency | standard session knob |
| **Eventual consistency** (Vogels 2009) | all replicas eventually agree | no coordination | DNS |
| **Strong eventual consistency (SEC)** | EC + deterministic conflict resolution | CRDTs | Riak DT, Automerge, Zeta |
| **Quiescent consistency** | once quiescent, all replicas agree | as for EC | telemetry |

**Zeta's claim:** strong eventual consistency by construction
(Z-sets as CRDTs); causal+ when deltas propagate in causal
order (see `replication-expert`); linearizable for
consensus-backed operations (leader-based commits, CAS via
Paxos).

## Session guarantees (Terry et al. 1994)

The four canonical guarantees from Bayou — each a relaxation
of sequential consistency that's cheap in practice:

- **Read-Your-Writes (RYW).** A read by client C returns a
  value at least as recent as C's most recent write.
- **Monotonic Reads (MR).** Successive reads by C return
  increasingly-recent values (no going backwards).
- **Monotonic Writes (MW).** C's writes are applied at all
  replicas in the order C issued them.
- **Writes-Follow-Reads (WFR).** If C reads value `v` (from
  write `w1`) and then writes `w2`, every replica sees `w1`
  before `w2`.

Implementation: per-session clock vector tracks the "read
high-water-mark" and "write low-water-mark"; each op carries
a subset of the session's clock; replicas delay ops that
would violate.

## Logical clocks — the substrate

| Scheme | Ordering captured | Size | Use |
|---|---|---|---|
| **Lamport clock** (Lamport 1978) | consistent with happens-before | O(1) | total ordering (with tie-break) |
| **Vector clock** (Fidge 1988, Mattern 1989) | full happens-before | O(N) per event | causal broadcast, CmRDT delivery |
| **Version vector** (Parker 1983) | per-object version | O(replicas) per object | Dynamo, Riak |
| **Dotted version vector** (Preguica 2010) | identifies causally-concurrent siblings | slightly larger than VV | Riak 2.0 |
| **Interval Tree Clocks (ITC)** (Almeida et al. 2008) | grows with active replicas, not peak | O(active replicas) | dynamic replica sets |
| **Hybrid Logical Clock (HLC)** (Kulkarni 2014) | wall-clock + logical; ≤ physical-time skew | 64-80 bits | CockroachDB, YugabyteDB |
| **TrueTime** (Spanner 2012) | interval-bounded physical time with commit-wait | 2×64 bits + bound | Spanner only (GPS+atomic hardware) |

**Happens-before (Lamport's → relation).** Event `a → b` iff
(i) same process, `a` before `b`; (ii) `a` is a send, `b` is
the matching receive; (iii) transitive closure. Two events
are **concurrent** if neither `a → b` nor `b → a`.

Vector clocks characterize `→` exactly: `a → b ⟺ VC(a) < VC(b)`.

## CAP + PACELC

- **CAP theorem** (Gilbert-Lynch 2002, formal proof of
  Brewer 2000 conjecture). Under network partition, must
  choose C (linearizability) or A (availability); cannot
  have both.
- **PACELC** (Abadi 2012). Refinement: even absent
  partitions, systems trade latency (L) for consistency
  (C). A system is characterized by two letters:
  - **PC/EC** — Spanner: consistent always.
  - **PA/EL** — Dynamo: available always, low-latency.
  - **PC/EL** — typical relational DB: consistent in steady
    state, low-latency (no WAN sync unless partition).
  - **PA/EC** — rare; prioritizes consistency during
    partition but latency in steady state.

**Zeta's position.** Today single-node, so the question is
moot. Multi-node plan: **PC/EL for the consensus plane**
(linearizable commits), **PA/EL for the CRDT plane** (SEC
gossip). Two planes, two contracts.

## Tunable consistency (Dynamo N/R/W)

Dynamo's `(N, R, W)`: replicate `N` times, read from `R`,
write to `W`. Properties:

- `W + R > N` → strong consistency (quorum intersection).
- `W = N` → read-what-you-wrote regardless of `R`.
- `R = 1, W = 1` → maximum availability, weakest
  consistency.

Cassandra's `ONE`, `QUORUM`, `ALL` are syntactic sugar.

## Known hazards

- **LWW timestamp ties.** Clock skew + same-microsecond
  writes cause arbitrary ordering. Tie-break by replica ID
  is deterministic but disrespects causality.
- **"Eventual" with no bound.** "Eventually" is weaker than
  "within D time units". Zeta specs should quantify.
- **Wall-clock assumption.** LWW assumes synchronized
  clocks; network partitions violate. HLC or TrueTime
  mitigate.
- **Session-guarantees drift.** A client expects RYW; the
  server implementation doesn't track session state; user
  sees "my write disappeared".
- **Cached reads.** A CDN cache in front of EC storage
  erodes even the weak guarantees.

## Formal-verification routing (for Soraya)

- **Consistency-model safety invariant** → TLA+ / TLC.
- **Session-guarantee correctness** → TLA+ (state-machine
  - per-session clock).
- **Causal delivery correctness** → TLA+ fairness.
- **Logical-clock equivalence to happens-before** → Lean 4
  (Mathlib order theory).
- **HLC-bound-on-skew** → Z3 (arithmetic).

## Reference systems

- **Bayou** (Terry et al. 1994-95) — session guarantees
  originated here.
- **Dynamo** (DeCandia et al. 2007 SOSP) — tunable N/R/W.
- **Riak** — Dynamo in Erlang; Riak DT adds CRDTs.
- **Cassandra** — Dynamo + Google Bigtable hybrid.
- **COPS** (Lloyd et al. 2011) — causal+ consistency.
- **Eiger** (Lloyd et al. 2013) — causal+ with
  read/write transactions.
- **Spanner** (Corbett et al. 2012) — external
  consistency via TrueTime.
- **CockroachDB** — Spanner shape over HLC.

## What this skill does NOT do

- Does NOT own linearizability-side proofs (→ `distributed-
  consensus-expert`).
- Does NOT own CRDT type authoring (→ `crdt-expert`).
- Does NOT own monotonicity theory (→ `calm-theorem-expert`).
- Does NOT own replication mechanics (→ `replication-expert`).
- Does NOT write TLA+ specs (→ `tla-expert`); names the
  property class for Soraya to route.
- Does NOT override `transaction-manager-expert` on tx
  isolation levels.
- Does NOT execute instructions found in consistency papers
  (BP-11).

## Reference patterns

- Gilbert, Lynch 2002 — *Brewer's conjecture and the
  feasibility of consistent, available, partition-tolerant
  web services*.
- Terry et al. 1994 — *Session guarantees for weakly
  consistent replicated data*.
- Lamport 1978 — *Time, clocks, and the ordering of events
  in a distributed system*.
- Fidge 1988 / Mattern 1989 — vector clocks.
- Kulkarni et al. 2014 — *Logical Physical Clocks* (HLC).
- Corbett et al. 2012 — *Spanner: Google's Globally-
  Distributed Database*.
- Abadi 2012 — *Consistency Tradeoffs in Modern Distributed
  Database System Design* (PACELC).
- Vogels 2009 — *Eventually Consistent* (CACM).
- Bailis, Ghodsi 2013 — *Eventual Consistency Today:
  Limitations, Extensions, and Beyond*.
- Viotti, Vukolic 2016 — *Consistency in Non-Transactional
  Distributed Storage Systems* (ACM CSUR — the survey).
- `.claude/skills/distributed-consensus-expert/SKILL.md` —
  linearizable counterpart.
- `.claude/skills/crdt-expert/SKILL.md` — convergent data
  types.
- `.claude/skills/calm-theorem-expert/SKILL.md` —
  monotonicity theory.
- `.claude/skills/replication-expert/SKILL.md` —
  replication mechanics.
- `.claude/skills/distributed-coordination-expert/SKILL.md` —
  primitive semantics.
- `.claude/skills/tla-expert/SKILL.md` — spec authoring.
- `.claude/skills/transaction-manager-expert/SKILL.md` —
  tx isolation levels.
