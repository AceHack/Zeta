---
id: B-0226
zetaid: 081KQX9B50008QG0R0028P9BMR
priority: P2
status: open
title: "Timeseries native-ZSet research - cardinality-adaptive storage"
created: 2026-05-06
last_updated: 2026-05-06
parent: B-0147
depends_on: [B-0225]
classification: blocked-on-algebra-fit
type: feature
---

# B-0226 - Cardinality-adaptive storage research

Split the cardinality question out of the B-0147 blob and
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
- The result feeds the Pareto synthesis in B-0230.
