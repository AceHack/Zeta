---
id: 081KSNY2Z0008QG0R0027CDD11
priority: P3
status: open
title: Event-sourced trajectory phase classification — setup/execution/maturation/sunset derived from event log (no separate state tracking)
effort: S
ask: kestrel via aaron 2026-05-28
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSKBP80008QG0R000B3Y19A
  - 081KSNY2Z0008QG0R001K6HJ7Z
composes_with:
  - 081KSKBP80008QG0R000B3Y19A
  - 081KSNY2Z0008QG0R001K6HJ7Z
  - 081KSNY2Z0008QG0R000F0C5V0
  - 081KSNY2Z0008QG0R000HENSVM
tags:
  - trajectory-phase-classification
  - setup-execution-maturation-sunset
  - derived-from-events-not-tracked-separately
  - phase-always-current-by-construction
  - composes-with-event-sourcing-layer
  - composes-with-trajectory-async-review-surface
  - potential-extension-not-committed
---

## What this row tracks

Implement `classifyTrajectoryPhase(trajectoryId)` that reads the trajectory's event log and computes its current phase (setup/execution/maturation/sunset) from event-shape — without requiring separate phase state to be tracked.

Per Kestrel 2026-05-28: *"That's a derivation from the event log. Doesn't require any separate state tracking. The trajectory phase is always current because it's computed from current events."*

## Reference implementation (Kestrel sketch)

```typescript
function classifyTrajectoryPhase(trajectory: string): TrajectoryPhase {
  const events = readEventsForTrajectory(trajectory);
  const recentEvents = events.filter(e => e.timestamp > weekAgo);

  const merges = recentEvents.filter(e => e.event_type === "merged");
  const claims = recentEvents.filter(e => e.event_type === "claimed");

  if (merges.length === 0 && claims.length > 0) return "setup";
  if (merges.length > claims.length * 0.5) return "execution";
  if (merges.length > 0 && merges.length < claims.length * 0.2) return "maturation";
  return "sunset";
}
```

## Acceptance criteria

- `src/Core.TypeScript/workflow-engine/agent-loop/trajectory-phase.ts` exposes `classifyTrajectoryPhase(trajectoryId, windowMs?)` returning `"setup" | "execution" | "maturation" | "sunset"`
- Default window = 7 days; tunable
- Returns phase derived purely from event log (no separate state file)
- Tests cover: each phase boundary case; empty trajectory; phase-transition under accumulating events
- Composes with 081KSNY2Z0008QG0R001K6HJ7Z (event-sourcing layer) — depends on `readEventsForTrajectory`
- Composes with 081KSNY2Z0008QG0R000F0C5V0 (trajectory-async-review surface) — the review surface reads phase via this classifier

## Substrate-honest framing

POTENTIAL extension per operator standing direction. P3 because it's purely an observability/review-surface helper; not load-bearing on the agent loop itself.

## Full reasoning

`memory/kestrel/conversations/2026-05-28-kestrel-zetaid-128bit-structured-encoding-event-sourcing-without-pr-ceremony-otel-trace-composition-two-level-state-machine-aaron-forwarded.md` § "Tying it back to the trajectory question"
