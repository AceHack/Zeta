---
id: B-0225
zetaid: 081KQX9B50008QG0R003Z7Z9EG
priority: P2
status: open
title: "Timeseries native-ZSet research - algebra fit, retraction, and ZSet mapping"
created: 2026-05-06
last_updated: 2026-05-06
parent: B-0147
depends_on: [B-0224]
classification: blocked-on-candidate-landscape
type: feature
---

# B-0225 - Timeseries algebra-fit analysis

Analyze the top candidates from B-0224 against the ZSet
substrate.

## Work scope

For the top three candidates, document data model, query
semantics, retraction support, first-class event support,
columnar/storage shape, and whether the candidate composes
directly with ZSet algebra or requires an adapter.

## Acceptance criteria

- The four-axis tightness rule is applied to each top
  candidate: ZSet-backed, first-class event, retractable,
  columnar/storage-compatible.
- The analysis distinguishes "adopt", "adopt with adapter",
  and "build native" without choosing prematurely.
- Retraction semantics are treated as load-bearing, not as
  an optional integration detail.
- The output feeds B-0226, B-0227, and B-0229.
