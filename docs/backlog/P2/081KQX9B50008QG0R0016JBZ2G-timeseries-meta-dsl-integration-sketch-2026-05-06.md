---
id: 081KQX9B50008QG0R0016JBZ2G
priority: P2
status: open
title: "Timeseries native-ZSet research - meta-DSL integration sketch"
created: 2026-05-06
last_updated: 2026-05-06
parent: 081KQGDBJ0008QG0R0004ACHJJ
depends_on: [081KQGDBJ0008QG0R002175ECA, 081KQX9B50008QG0R003Z7Z9EG, 081KQX9B50008QG0R002RZXEQK]
classification: blocked-on-mdx-and-crdt-semantics
type: feature
---

# 081KQX9B50008QG0R0016JBZ2G - Timeseries meta-DSL integration sketch

Sketch how the timeseries algebra plugs into the unified
meta-DSL alongside graph, hierarchy, filesystem, and other
first-class types.

## Work scope

Produce a concrete integration sketch that shows how
timeseries queries, labels, windows, retractions, and CRDT
modes appear through the DSL without collapsing per-domain
optimization opportunities.

## Acceptance criteria

- The sketch names the timeseries primitives exposed to the
  DSL.
- The design composes with 081KQGDBJ0008QG0R002175ECA's MDX/meta-DSL framing.
- CRDT modes remain visible enough to be formally specified.
- The sketch distinguishes DSL surface from storage backend.
