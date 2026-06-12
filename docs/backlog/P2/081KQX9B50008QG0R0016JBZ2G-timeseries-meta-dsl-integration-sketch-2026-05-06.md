---
id: B-0229
zetaid: 081KQX9B50008QG0R0016JBZ2G
priority: P2
status: open
title: "Timeseries native-ZSet research - meta-DSL integration sketch"
created: 2026-05-06
last_updated: 2026-05-06
parent: B-0147
depends_on: [B-0148, B-0225, B-0227]
classification: blocked-on-mdx-and-crdt-semantics
type: feature
---

# B-0229 - Timeseries meta-DSL integration sketch

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
- The design composes with B-0148's MDX/meta-DSL framing.
- CRDT modes remain visible enough to be formally specified.
- The sketch distinguishes DSL surface from storage backend.
