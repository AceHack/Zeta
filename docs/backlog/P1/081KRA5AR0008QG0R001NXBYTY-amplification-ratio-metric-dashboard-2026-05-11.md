---
id: 081KRA5AR0008QG0R001NXBYTY
priority: P1
status: open
title: "Amplification ratio metric — human input : agent actions on dashboard"
created: 2026-05-11
last_updated: 2026-05-11
depends_on: [081KRA5AR0008QG0R0021SSM9R]
composes_with: [081KQX9B50008QG0R0004N4HNK]
type: feature
---

# 081KRA5AR0008QG0R001NXBYTY — Amplification ratio metric

## What

Add an amplification ratio counter to the Zeta Plant dashboard:

```
Aaron messages today: 47
Agent actions today: 612
Amplification: 13x
```

The ratio measures leverage per human input. It is the single
most viral, most honest metric for "what AI agents can do with
minimal human direction."

## Why P1

Aaron 2026-05-11: "how many time i type to how many actions you
take is a metric people will care about" + "show amplification
as first class trackable."

Amplification beats PR count, lines-of-code, and lead-time as a
product claim. It's downstream-of-nothing — every other metric
follows from leverage per human input.

## Acceptance criteria

1. `tools/dashboard/generate-metrics.ts` counts Aaron messages
   (from chat transcript or commit annotations) and agent
   actions (commits, PR opens, thread resolves, archive
   landings)
2. `demo/metrics.json` exposes `amplification_ratio_today`
3. Dashboard renders the ratio alongside DORA metrics
4. The number is verifiable from git log + chat history (glass
   halo discipline)

## Operational definitions

**Agent action (unweighted)** — any of:

- Git commit
- PR open, close, merge
- Review thread reply + resolve
- PR archive landing
- Memory file create/edit

**Aaron message** — top-level human input in conversation,
including forwarded packets (counted as 1 each).

## Out of scope

- Weighted action counts (substrate vs hygiene) — separate row
- Multi-week aggregates — initial release is daily
- Per-agent amplification breakdown — initial release is array-total

## Composes with

- 081KRA5AR0008QG0R0021SSM9R (metrics.json data layer)
- 081KQX9B50008QG0R0004N4HNK (SEO meta tags — amplification number is the viral hook)
- `memory/feedback_amplification_ratio_human_input_to_agent_actions_first_class_metric_aaron_2026_05_11.md`

## Origin

Aaron 2026-05-11 conversation, immediately after the substrate-
stability + orchestrator-cost landings.
