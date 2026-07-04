---
id: 081KZETA0007040002
priority: P1
status: open
title: Self-claims event type — probabilistic liveness via track record
created: 2026-07-04
last_updated: 2026-07-04
depends_on: []
tags: [observe-loop, self-claims, liveness, trust, inter-agent]
type: task
---

# Self-claims event type — probabilistic liveness via track record

Add a `self_claim` action to the observe grammar so agents can record "I will
deliver X by tick T" in the event log. Peers fold claims + outcomes into
reliability scores. Liveness becomes probabilistic: P(commit | history) → 1
as track record grows.

## Acceptance criteria

- New `self_claim` NextAction kind: `{ kind: "self_claim", item: BacklogItem, deadline: number }`
- Claims recorded in the event log (same EventSink path)
- A `claim_met` / `claim_missed` observation event when the deadline passes
- `reliability(agent)` = met_claims / total_claims (computed from event log fold)
- Inter-agent dependency: agents can query peers' reliability before scheduling
- Self-claims are VOLUNTARY (NCI: never auto-generated, never forced)
- Consistently meeting claims EARNS more window (extended τ, less scheduling pressure)
