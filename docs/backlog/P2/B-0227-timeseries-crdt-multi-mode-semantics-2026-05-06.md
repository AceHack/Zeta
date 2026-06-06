---
id: B-0227
zetaid: 081KQX9B50008QG0R002RZXEQK
priority: P2
status: open
title: "Timeseries native-ZSet research - CRDT multi-mode semantics"
created: 2026-05-06
last_updated: 2026-05-06
parent: B-0147
depends_on: [B-0225]
classification: blocked-on-algebra-fit
type: feature
---

# B-0227 - CRDT multi-mode timeseries semantics

Research the CRDT semantics required for multi-master
timeseries writes.

## Work scope

Identify which timeseries shapes map to G-counters,
PN-counters, gauges, LWW registers, sets, causal histories,
or other CRDT primitives, and how multiple modes compose
within the same algebra.

## Acceptance criteria

- Multi-master writes are modeled as convergent operations,
  not last-write-wins.
- The research names which metric types need which CRDT
  primitive.
- Merge requirements are stated in commutative,
  associative, idempotent terms.
- The result feeds B-0228's formal-spec plan and B-0229's
  meta-DSL integration sketch.
