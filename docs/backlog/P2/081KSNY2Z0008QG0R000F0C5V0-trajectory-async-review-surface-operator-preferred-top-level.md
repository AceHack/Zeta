---
id: 081KSNY2Z0008QG0R000F0C5V0
priority: P2
status: open
title: Trajectory-async-review surface — operator's preferred top-level lens for own-Zeta deployment (not PR-per-deploy)
effort: M
ask: aaron 2026-05-28
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSKBP80008QG0R000B3Y19A
composes_with:
  - 081KSKBP80008QG0R000B3Y19A
  - 081KSNY2Z0008QG0R000HENSVM
  - 081KSNY2Z0008QG0R000V24M7E
  - 081KSNY2Z0008QG0R000ZNRFCE
tags:
  - trajectory-async-review
  - operator-preferred-top-level-lens
  - own-zeta-deployment-vs-servicetitan-pr-per-deploy
  - review-trajectories-over-time-not-per-event
  - composes-with-event-sourced-trajectory-phase
  - asymmetric-review-surface-vs-enterprise-pr-flow
  - potential-extension-not-committed
---

## Operator framing 2026-05-28

> *"The PR process is reserved for the work that actually warrants human review still too strong for me but yes probably for ServiceTitan this is where they would want. For me I just want to review trajectories over time async."*

## What this row tracks

A review surface that operates at TRAJECTORY scope (not per-PR, not per-event) for operator-own-Zeta deployment. The operator-preferred top-level lens for own-Zeta operation is trajectory-shape-over-time review, not per-event or per-PR review. Two-mode discriminator:

| Deployment context | PR ceremony scope | Operator's preferred review-surface |
|---|---|---|
| **ServiceTitan-style enterprise** | PR-per-deploy (status quo expectations) | Per-PR human review |
| **Operator's own Zeta deployment** | Even less than PR-per-deploy | Trajectory-async review (review trajectory-shape over time, not per-event) |

## Acceptance criteria

- `src/Core.TypeScript/workflow-engine/agent-loop/trajectory-review.ts` exposes:
  - `summarizeTrajectory(trajectoryId, sinceIso)` — produces a trajectory-shape summary (phase progression, claims-vs-merges, DORA-curve, key events) suitable for async review
  - `listActiveTrajectories({sortBy: "recency" | "dora-contribution" | "uncertainty"})` — operator's at-a-glance dashboard
- CLI wrapper: `bun src/Core.TypeScript/workflow-engine/agent-loop/trajectory-review.ts --since 1week` produces markdown report
- Composes with event-sourced trajectory phase classification (081KSNY2Z0008QG0R0027CDD11) — phase is derived from events; the review surface reads the derivation
- README documents the asymmetry between enterprise-PR-per-deploy and operator-trajectory-async-review modes

## Scope

Operator-own-deployment surface. Does NOT replace PR review for ServiceTitan-style enterprise contexts. Does NOT replace event-level audit (which lives in agent-state branches). Operates ABOVE both as a review-at-trajectory-scope lens.

## Substrate-honest framing

POTENTIAL extension per operator 2026-05-28. The operator-deployment-style differs from Kestrel's framing (which assumed PR-per-deploy as the floor); this row makes the asymmetric-review-surface explicit.

## Full reasoning

`memory/kestrel/conversations/2026-05-28-kestrel-zetaid-128bit-structured-encoding-event-sourcing-without-pr-ceremony-otel-trace-composition-two-level-state-machine-aaron-forwarded.md` § "Operator's two end-clarifications" — clarification 1.
