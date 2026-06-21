---
id: 081KQX9B50008QG0R0028P9BMR
priority: P2
status: open
title: "Timeseries native-ZSet research - cardinality-adaptive storage"
created: 2026-05-06
last_updated: 2026-05-06
parent: 081KQGDBJ0008QG0R0004ACHJJ
depends_on: [081KQX9B50008QG0R003Z7Z9EG]
classification: blocked-on-algebra-fit
type: feature
---

# 081KQX9B50008QG0R0028P9BMR - Cardinality-adaptive storage research

Split the cardinality question out of the 081KQGDBJ0008QG0R0004ACHJJ blob and
research it directly.

## Work scope

Compare small-cardinality optimized, high-cardinality
first-class, cardinality-adaptive, multi-mode, hybrid layered,
and single high-cardinality-first storage designs.

## Acceptance criteria

- Prometheus's small-cardinality design is described as a
  structural tradeoff, not as a bug.
- At least four architecture options are compared on storage
  cost, query performance, algebra-surface complexity, and
  CRDT/retraction compatibility.
- The analysis identifies which option preserves the
  Prometheus fast path and which option best supports
  Aurora-style high-cardinality event streams.
- The result feeds the Pareto synthesis in 081KQX9B50008QG0R001T7M5SK.
