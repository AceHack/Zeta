---
id: 081KTF5F0AP08QG0R003ERP8D3
type: task
state: backlog
priority: P2
slug: r3-cross-bus-causal-correctness-boundary-partial-replication
title: "R3: cross-bus causal-correctness boundary + partial-replication metadata budget"
created: 2026-06-06T19:09:55.414Z
depends_on: []
composes_with: []
---

# R3: cross-bus causal-correctness boundary + partial-replication metadata budget

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTF5F0AP08QG0R003ERP8D3-*.md` glob. -->

## DEFERRED — after the persistence/speed/durability subsystem (maintainer 2026-06-06)

Research-grade open problem. See vision doc §6(3).

**Problem:** Genuine partial replication + causal consistency is provably hard under failure
(arXiv 1703.05424); causality metadata scales with the share/bus graph, not one vector-clock
entry per node (1611.04022). Cross-bus dependencies are the "lost cross-document causality."

**Proposed posture:** define causal correctness WITHIN a bus; the git commit DAG is exact
causality for what an agent fetched; accept + DOCUMENT causal gaps across buses an agent does not
subscribe to. Quantify the metadata budget per bus topology.

**Anchors:** Lamport (CACM 1978); Shapiro CRDTs (2011); partial-replication lower bounds
(1703.05424); timestamps for partial replication (1611.04022); Weidner CRDT survey pt 4.
Owner: TBD (distributed-systems lane).
