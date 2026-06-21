# 081KQZVQW0008QG0R001FG05RZ PR Blocker Source Join Receipt - 2026-05-30

## Status

Prepared as a bounded monitor slice.

## Provenance

- Surface: codex-background-service
- Origin: codex-launchd-loop
- Prepared Run ID: 20260530T183757Z
- Committed Run ID: 20260530T185312Z

## Change

`tools/health/factory-health-monitor.ts` now converts open PR review blockers
and failed gate conclusions into `CoincidenceEvent` values:

- `CHANGES_REQUESTED` review decisions emit `pr-review-blocker` events.
- Failed check conclusions emit `failed-gate` events.
- In-progress, queued, neutral, and successful checks do not emit blocker
  events.

Both event kinds carry `pr:<number>` correlation keys, so multiple blocker
signals on the same PR do not inflate a coincidence window by themselves.

## Why

The stronger-source escalation gate already treats PR review blockers and
failed gates as incident-grade sources. This packet adds the missing source
adapter so those blockers can join ordinary merge and trajectory receipt
events without relying on local broadcasts.

## Verification

Focused tests cover:

- review-blocker event construction,
- failed-gate event construction,
- ignoring still-running checks,
- lookback filtering,
- incident escalation when a failed gate joins an ordinary merge event.
