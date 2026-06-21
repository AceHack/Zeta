---
id: 081KQX9B50008QG0R002RZXEQK
priority: P2
status: open
title: "Timeseries native-ZSet research - CRDT multi-mode semantics"
created: 2026-05-06
last_updated: 2026-05-06
parent: 081KQGDBJ0008QG0R0004ACHJJ
depends_on: [081KQX9B50008QG0R003Z7Z9EG]
classification: blocked-on-algebra-fit
type: feature
---

# 081KQX9B50008QG0R002RZXEQK - CRDT multi-mode timeseries semantics

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
- The result feeds 081KQX9B50008QG0R003GWYQR3's formal-spec plan and 081KQX9B50008QG0R0016JBZ2G's
  meta-DSL integration sketch.
