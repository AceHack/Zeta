---
id: B-0230
zetaid: 081KQX9B50008QG0R001T7M5SK
priority: P2
status: open
title: "Timeseries native-ZSet research - Pareto frontier and tradeoff synthesis"
created: 2026-05-06
last_updated: 2026-05-06
parent: B-0147
depends_on: [B-0224, B-0225, B-0226, B-0227, B-0228, B-0229]
classification: blocked-on-research-slices
type: feature
---

# B-0230 - Pareto frontier and tradeoff synthesis

Synthesize the B-0147 research slices into an explicit Pareto
frontier.

## Work scope

For each defensible candidate or native design point, name
what it gains, preserves, and sacrifices. The synthesis must
answer the load-bearing question: can Zeta get better
properties without losing the good properties that existing
systems earned honestly?

## Acceptance criteria

- Candidate tradeoffs are explained by design context, not
  dismissed as mistakes.
- Dominated options are marked as dominated.
- Any deliberate non-Pareto choice is labeled with the
  architectural reason.
- The synthesis directly feeds the recommendation in B-0231.
