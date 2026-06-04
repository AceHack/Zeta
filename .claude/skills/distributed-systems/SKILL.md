---
name: distributed-systems
description: Distributed systems — consensus (Paxos/Raft/BFT), replication, CRDTs, coordination, gossip, clocks, consistency.
---

# distributed systems

Category skill (blueprint pack). The `description` above is the only thing the
router sees — broad and generic on purpose. The fat detail lives in the
blueprints below; open the one that matches and read it in full.

Governs its own form per `.claude/rules/rules-are-small-carved-sentences-pointing-to-docs.md`
and `.claude/rules/mirror-beacon-register-discipline.md` (carved sentence = hub /
Beacon; blueprint = satellite / Mirror). The directory is an independent shipping unit.

## Blueprints

- [`raft-expert`](blueprints/raft-expert.md) — Raft — leader election, log replication, safety invariants, membership change, log compaction, linearizable reads.
- [`paxos-expert`](blueprints/paxos-expert.md) — Paxos family — single-decree, Multi-Paxos, Fast/Flexible/Generalized/EPaxos/CASPaxos, safety invariants, liveness.
- [`blockchain-expert`](blueprints/blockchain-expert.md) — Blockchain / permissionless consensus — Nakamoto, PoW/PoS, HotStuff/Tendermint, Merkle proofs, UTXO, tamper-evidence.
- [`distributed-consensus-expert`](blueprints/distributed-consensus-expert.md) — Distributed consensus — FLP, quorums, CFT vs BFT, linearizability, Paxos/Raft protocol choice.
- [`distributed-coordination-expert`](blueprints/distributed-coordination-expert.md) — Distributed coordination primitives — locks, leases, leader election, ZooKeeper/etcd/Consul, CAS, watches, membership.
- [`gossip-protocols-expert`](blueprints/gossip-protocols-expert.md) — Gossip / epidemic protocols — anti-entropy, rumor-mongering, SWIM, HyParView, partial views, protocol composition.
- [`crdt-expert`](blueprints/crdt-expert.md) — CRDTs — CvRDT/CmRDT/δ-CRDT, semilattice merge, OR-Set, RGA, Automerge/Yjs, convergence proofs, Z-set CRDT.
- [`calm-theorem-expert`](blueprints/calm-theorem-expert.md) — "CALM theorem — monotonicity, coordination-avoidance, I-confluence, Bloom/Dedalus, consensus-free replication."
- [`eventual-consistency-expert`](blueprints/eventual-consistency-expert.md) — Eventual consistency — consistency hierarchy, session guarantees, logical clocks, CAP/PACELC, tunable consistency.
- [`replication-expert`](blueprints/replication-expert.md) — Replication strategies — primary-backup, state-machine, chain, log-shipping, quorum, anti-entropy protocol selection.
- [`time-and-clocks-expert`](blueprints/time-and-clocks-expert.md) — Time and clocks — wall vs monotonic, NTP/PTP drift, UTC/TAI, logical clocks (Lamport/vector), DST-safe.
