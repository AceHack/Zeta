---
id: 081KSNY2Z0008QG0R0017JSTGD
priority: P1
status: open
title: State-machine event fast-lane + batch-merge-to-main coordinator — composes with 081KSKBP80008QG0R001KK9WV6 heartbeat pattern; reduces per-event ceremony at scale
effort: M
ask: aaron 2026-05-28
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSKBP80008QG0R000B3Y19A
composes_with:
  - 081KSKBP80008QG0R000B3Y19A
  - 081KSNY2Z0008QG0R001K6HJ7Z
  - 081KSNY2Z0008QG0R003WFDCJ9
  - 081KSKBP80008QG0R001KK9WV6
  - 081KSNY2Z0008QG0R003X1QWYG
  - 081KSNY2Z0008QG0R0034FR5FG
  - 081KSNY2Z0008QG0R001DFZK4V
  - 081KSNY2Z0008QG0R003FR5TVG
tags:
  - state-machine-fast-lane
  - batch-merge-to-main-coordinator
  - composes-with-heartbeat-pattern-b-0858
  - reduces-per-event-ceremony-at-scale
  - n-events-become-1-main-merge
  - composes-with-trajectory-branches
  - composes-with-zeta-native-review-substrate
  - cluster-supporting-substrate-not-blocking-cluster
---

## Operator framing 2026-05-28

> *"can we create a fast lane for the state machine like the heartbeats and batch merge to main?"*

Yes — composes cleanly with the existing 081KSKBP80008QG0R001KK9WV6 heartbeat fast-lane pattern + the trajectory-branches event-sourcing substrate (081KSNY2Z0008QG0R001K6HJ7Z) + the lifecycle DU split (081KSNY2Z0008QG0R003WFDCJ9 trajectory-push vs PR-review).

## What this row tracks

Two composing mechanisms that together create the fast-lane:

### Mechanism 1 — State-machine event fast-lane (per-event low-ceremony writes)

State-machine events go to a dedicated path that's substantively low-ceremony:

- Path: `docs/agent-events/{trajectory}/YYYY/MM/DD/{eventId}.json` (or similar; composes with 081KSNY2Z0008QG0R001K6HJ7Z event-sourcing layer's filename convention)
- OR trajectory branches: `agent-events/{trajectory}` (per 081KSNY2Z0008QG0R001K6HJ7Z's branch convention)
- Either way: agents push events directly without per-event PR ceremony

This is the heartbeat-pattern transposed to state-machine events. Heartbeats today go in `docs/agent-heartbeats/` (per 081KSKBP80008QG0R001KK9WV6 substrate) and have minimal review-friction; state-machine events get the same treatment on their own path.

### Mechanism 2 — Batch-merge-to-main coordinator

A periodic batch coordinator bundles N events from N trajectory branches and merges to main as ONE PR (instead of N per-event PRs):

- Cadence configurable (e.g., hourly; or on threshold of M events accumulated; or on operator-trigger)
- Coordinator reads accumulated events from agent-events branches → assembles bundle PR → opens with auto-merge → CI runs once on the bundle, not N times
- Bundle PR title + description summarize what's in the batch (per-trajectory event counts; key state transitions; etc.)
- Operator's trajectory-async-review (per 081KSNY2Z0008QG0R000F0C5V0) operates on these batches naturally (review the trajectory shape; the batch PR is the visible chunking unit)

### Together

Mechanism 1 handles per-event write-time speed (no PR per event); Mechanism 2 handles main-merge bandwidth (1 PR per N events). The combination matches operator framing "fast lane + batch merge."

## Acceptance criteria

- `src/Core.TypeScript/workflow-engine/agent-loop/events/fast-lane-write.ts` — agent-side helper that writes events to the fast-lane path / trajectory branch with appropriate metadata (composes with 081KSNY2Z0008QG0R001K6HJ7Z event-sourcing layer)
- `src/Core.TypeScript/workflow-engine/agent-loop/events/batch-merge-coordinator.ts` — periodic coordinator:
  - Reads accumulated events across trajectory branches
  - Assembles batch PR (or batch-merge to main if branch protection permits direct path-scoped merge)
  - Configurable batching policy (cadence / threshold / hybrid)
- Branch protection rule (or path-scoped exception) for fast-lane path:
  - `docs/agent-events/**` (or equivalent) allows direct push without PR review
  - Composes with existing project branch protection rules (additive; doesn't loosen non-fast-lane paths)
- `.claude/rules/state-machine-event-fast-lane.md` (or rule extension to existing) — documents the fast-lane discipline
- Tests cover: per-event write hits fast-lane; non-event commits don't accidentally use fast-lane path; batch-merge correctly bundles N events; failure modes (partial batch; coordinator crash mid-batch)

## Composition

- **081KSKBP80008QG0R001KK9WV6** heartbeat folder substrate — direct prior art for the fast-lane pattern
- **081KSNY2Z0008QG0R001K6HJ7Z** event-sourcing layer — fast-lane is the write-side of 081KSNY2Z0008QG0R001K6HJ7Z's event storage; batch-merge is the read-side aggregation
- **081KSNY2Z0008QG0R003WFDCJ9** lifecycle DU split (trajectory-push vs PR-review) — fast-lane IS the trajectory-push branch's operational form
- **081KSNY2Z0008QG0R003X1QWYG** GitHub Actions recursion — batch-merge coordinator could run as a GitHub Action OR as a local job; composes with the runtime substrate
- **081KSNY2Z0008QG0R001DFZK4V** Zeta-native review substrate — fast-lane events DON'T require review (per the lifecycle DU split); system-changes DO
- **081KSNY2Z0008QG0R0034FR5FG** ASAP cluster umbrella — this row is supporting infrastructure; should be added to umbrella composition
- **081KSNY2Z0008QG0R003FR5TVG** symbiotic cross-track self-healing — fast-lane composes with cross-track sync (events on one track propagate to the other via batch-merge coordinator)

## Priority justification

P1 because the cluster's substantive value depends on running at scale (many events per cycle across many trajectories). Without fast-lane, the per-event PR ceremony would either:

- Throttle the cluster down to a few events per hour (defeating the "full throttle" property operator named)
- Burn GitHub GraphQL budget for PR mutations (the rate-limit topology 081KSNY2Z0008QG0R001DFZK4V specifically routes around)

Either failure mode kills the architectural property the cluster is built for. Fast-lane is critical-path-for-scale even though minimal PoC can work without it (PoC at handful of events per cycle).

## Substrate-honest framing

P1 per operator framing + cluster-criticality analysis. Not currently blocking the foreground PoC (a 1-day minimal PoC per Otto's just-given estimate works without fast-lane at PoC scale) but blocks production-scale operation of the cluster.

The batch-merge coordinator design needs care — partial-batch-recovery + coordinator-crash-mid-batch + ordering-guarantees-across-trajectories are real engineering questions. Design memo likely needed before TS lands.

## Full reasoning

Operator 2026-05-28: *"can we create a fast lane for the state machine like the heartbeats and batch merge to main?"*

Composes with the existing heartbeat fast-lane pattern (per 081KSKBP80008QG0R001KK9WV6) + the trajectory-branches event-sourcing substrate (per 081KSNY2Z0008QG0R001K6HJ7Z + 081KSNY2Z0008QG0R003WFDCJ9) + the no-PR-coordination substrate (per 081KSNY2Z0008QG0R003X1QWYG + 081KSNY2Z0008QG0R001DFZK4V). The substrate-engineering shape is already there; this row makes the fast-lane + batch-merge mechanism explicit + composable.
