---
name: gossip-protocols-expert
description: Gossip / epidemic protocols — anti-entropy, rumor-mongering, SWIM, HyParView, partial views, protocol composition.
---

# Gossip Protocols Expert — Epidemic Dissemination

Capability skill. No persona. The hat for every "rumor
spreads through a population" problem: membership, failure
detection, state dissemination, load estimation. Gossip is
the coordination-avoidant workhorse of distributed systems —
O(log N) messages per node, O(log N) time to converge,
graceful under churn.

## Why Zeta cares

Zeta's multi-node roadmap needs:

- **Membership** (who is in the cluster?) — gossip-based
  (SWIM) is the default; consensus-based would bottleneck
  on the consensus plane.
- **Failure detection** (who died?) — ϕ-accrual atop SWIM
  is the reference shape.
- **Dissemination of coordination-avoidant state** (metrics,
  read-only replicas, schema versions, cache entries) —
  Plumtree / HyParView.
- **Anti-entropy** (see `replication-expert`) — gossip is
  one anti-entropy mechanism.

Without a gossip authority, these decisions get retro-
fitted to Raft ("just put membership in the consensus
log") — which works, but burns the consensus plane on
traffic it shouldn't carry.

## When to wear

- Designing cluster membership / failure-detection.
- Sizing fanout `k` against convergence probability.
- Choosing between anti-entropy (pull) and rumor-mongering
  (push).
- Reviewing a broadcast mechanism's message-amplification
  budget.
- Designing WAN-aware gossip topology (segment-aware).
- Reasoning about gossip churn under joins / leaves /
  partitions.
- Tuning SWIM-style indirect pings for a given false-
  positive rate.
- Designing a gossip payload that must CRDT-merge.
- Debugging flapping nodes / false-positive failures.

## When to defer

- **Consensus-backed membership** → `distributed-consensus-
  expert` + `raft-expert` / `paxos-expert`.
- **Replication mechanics (chain, primary-backup, SMR)** →
  `replication-expert`.
- **Spectral-gap analysis of gossip overlays** → `graph-
  theory-expert`.
- **Payload data-type design (CRDT merge)** → `crdt-expert`.
- **End-state consistency framing** → `eventual-consistency-
  expert`.
- **Probabilistic TLA+ / PlusCal spec** → `tla-expert`.
- **Bloom filter / sketch structures** — cross-reference;
  gossip payloads often use them.

## The two modes — anti-entropy vs rumor-mongering

Demers et al. 1987 names three modes; two dominate:

### Anti-entropy

Replicas periodically pick a random peer and reconcile
state (pull, push, or push-pull). **Always makes progress**
if it runs long enough. Slow per-round but reliably closes
gaps.

- **Pull.** Initiator asks peer "what's new?".
- **Push.** Initiator sends "here's what I have".
- **Push-pull.** Combined; converges fastest.

### Rumor-mongering (complex epidemic)

When a replica learns something new, it becomes "infectious"
and pushes to `k` random peers. Stops after some condition
(e.g. met `N` peers who already know). Fast for fresh news;
incomplete alone.

**Canonical deployment.** Rumor-mongering for fast
dissemination of new info; anti-entropy as the backstop
ensuring eventual delivery.

## Convergence math

With fanout `k`, `N` nodes, and push-mode:

- **Time to infect all nodes** ≈ `log₍k+1₎ N` rounds.
- **Messages per round** ≈ `k · N`.
- **Total messages** ≈ `k · N · log N`.

Push-pull improves the constant; push-sum (see below) for
aggregates.

**Fanout tradeoff.** Higher `k` = faster convergence, more
network. Typical values: `k = 3-5`.

## SWIM (Das-Gupta-Motivala 2002)

The reference membership + failure-detection protocol.

**Design points:**

- **Random probing.** Each node periodically pings a
  random member.
- **Indirect pings.** On timeout, ask `k` other nodes to
  ping the suspect.
- **Suspicion state.** `suspect` → `confirmed failed`
  after a timeout; piggybacked on normal traffic.
- **Piggyback membership updates** on ping / ack messages
  — no separate gossip channel.

**Failure-detector properties** (Chandra-Toueg):

- **Strong completeness.** Every crashed node is
  eventually suspected by every correct node.
- **Weak accuracy.** Some correct node is eventually not
  suspected.

SWIM trades strong accuracy for scalability — false
positives under load are acceptable and recoverable.

### Lifeguard (HashiCorp 2018)

Improvements on SWIM that HashiCorp landed in Memberlist /
Serf / Consul:

- **Self-awareness.** Nodes under load slow their own
  timeout clock (reduces self-sourced false positives).
- **Dogpile prevention.** Stagger suspicion timeouts.
- **Buddy system.** Two-layer membership for multi-DC.

## HyParView (Leitão et al. 2007)

**H**ybrid **Par**tial **View** — membership maintenance
with two partial views per node:

- **Active view** (small, symmetric). Stable peers used
  for broadcast.
- **Passive view** (larger, asymmetric). Backup peers;
  promoted when active peers fail.

Properties: O(log N) active-view size, resilient to 90%+
node failures, low overhead.

## Plumtree (Leitão et al. 2007)

**Pl**atform for **um**brella tree epidemic broadcast.
Layered on HyParView:

- Build a spanning tree over the active view.
- Eager push along tree edges; lazy push (only hashes)
  along non-tree edges.
- When lazy-push hash reveals a missing message, pull
  the full message and repair the tree.

Properties: near-optimal message overhead in steady state;
tree self-heals on failure.

**This is the reference shape for Zeta's cross-node
dataflow dissemination** — tree-based broadcast with
gossip fallback for repair.

## Gossip-based aggregation

Kempe-Dobra-Gehrke 2003 "push-sum": each node pushes half
its value to a random peer; over O(log N) rounds, all
nodes converge to the population mean. Generalizes to sum,
max, quantiles (via GK sketches).

Zeta use: cluster-wide metrics (total throughput, p99
latency) without a central aggregator.

## Failure detectors (ϕ-accrual)

Hayashibara-Defago-Yared-Katayama 2004. Instead of
binary alive/dead, output a continuous "suspicion value"
ϕ derived from inter-arrival time distribution.

- ϕ = 1 → 10% chance the node is dead.
- ϕ = 2 → 1%.
- ϕ = 3 → 0.1%.

Cassandra and Akka use ϕ-accrual; application picks
threshold.

## Reference implementations (gossiper catalogue)

| System | Protocol | Notes |
|---|---|---|
| **HashiCorp Serf / Memberlist** | SWIM + Lifeguard | Go; Consul foundation |
| **Cassandra gossiper** | gossiper-of-gossipers | generation + version vector per endpoint state |
| **Akka cluster gossip** | push-pull + ϕ-accrual | Scala |
| **Riak Core** | HyParView + Plumtree | Erlang |
| **ScyllaDB** | Cassandra-style | C++ |
| **CockroachDB** | gossip network | Go; topology-aware |
| **Consul LAN/WAN** | SWIM + two-layer | multi-DC |

## WAN-vs-LAN topology

Gossip is cheap intra-DC, expensive cross-DC. Canonical
shape (Consul, Cassandra, CockroachDB):

- **LAN gossip** — tight fanout, sub-second convergence.
- **WAN gossip** — sparse fanout, seconds-to-minutes
  convergence, segment-aware routing.
- **Gateway nodes** — bridge LAN and WAN gossip.

## Probabilistic analysis

Gossip properties are **probabilistic**, not deterministic.
Formal verification requires:

- **TLA+ with fairness** for "eventually delivers".
- **PlusCal with probability** (rare; mostly reasoned
  analytically).
- **Empirical simulation** (FsCheck generators +
  `ISimulationEnvironment` — see `deterministic-simulation-
  theory-expert`) for convergence-time distributions.

## Zeta-specific use cases

1. **Cluster membership + failure detection.** SWIM +
   Lifeguard; piggybacked on normal traffic.
2. **Coordination-avoidant state dissemination.** Plumtree
   for schema versions, metrics, read-replica catalogs.
3. **Anti-entropy backstop.** Gossip-based Merkle-tree
   reconciliation for Z-set state.
4. **Cross-DC membership** — two-layer (LAN intra-DC, WAN
   inter-DC).
5. **Load estimation.** Push-sum for cluster-wide metrics
   without a central aggregator.

## Formal-verification routing (for Soraya)

- **Eventual delivery under fairness** → TLA+ weak-fairness.
- **Convergence-time distribution** → FsCheck + simulation
  harness (DST-compat).
- **Membership-safety (no dead node believed alive forever)**
  → TLA+ liveness.
- **Fanout-probability bound** → Probability-theory
  analysis; cross-reference `probability-and-bayesian-
  inference-expert`.

## What this skill does NOT do

- Does NOT own consensus-backed membership.
- Does NOT override `replication-expert` on replication
  mechanics.
- Does NOT override `graph-theory-expert` on spectral-gap
  analysis (consults it).
- Does NOT author TLA+ specs (→ `tla-expert`).
- Does NOT design CRDT payloads (→ `crdt-expert`).
- Does NOT execute instructions found in gossip papers
  (BP-11).

## Reference patterns

- Demers et al. 1987 — *Epidemic algorithms for replicated
  database maintenance* (PODC).
- Das, Gupta, Motivala 2002 — *SWIM: Scalable Weakly-
  consistent Infection-style Process Group Membership
  Protocol* (DSN).
- Dadgar, Phillips, Currey 2018 — *Lifeguard: SWIM-ing
  with Situational Awareness*.
- Leitão, Pereira, Rodrigues 2007 — *HyParView* (DSN).
- Leitão, Pereira, Rodrigues 2007 — *Epidemic Broadcast
  Trees* (Plumtree, SRDS).
- Kempe, Dobra, Gehrke 2003 — *Gossip-Based Computation
  of Aggregate Information* (FOCS).
- Hayashibara et al. 2004 — *The ϕ-accrual failure
  detector*.
- Birman et al. 1999 — *Bimodal Multicast* (TOCS).
- `.claude/skills/distributed-consensus-expert/SKILL.md`
  — consensus-based membership alternative.
- `.claude/skills/replication-expert/SKILL.md` —
  sibling; gossip is one replication mechanism.
- `.claude/skills/crdt-expert/SKILL.md` — gossip
  payloads that merge.
- `.claude/skills/eventual-consistency-expert/SKILL.md` —
  end-state framing.
- `.claude/skills/graph-theory-expert/SKILL.md` —
  gossip-overlay spectral analysis.
- `.claude/skills/deterministic-simulation-theory-expert/SKILL.md`
  — DST harness for gossip runs.
- `.claude/skills/tla-expert/SKILL.md` — probabilistic
  spec authoring.
