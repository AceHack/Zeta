---
id: 081KSNY2Z0008QG0R000121FJ4
priority: P2
status: open
title: Push-cycle limit AS STRUCTURAL enforcement — chooseActionForLifecycle returns AbandonPr when revisionCount > N (tunable threshold)
effort: XS
ask: kestrel via aaron 2026-05-28
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSKBP80008QG0R000B3Y19A
composes_with:
  - 081KSKBP80008QG0R000B3Y19A
  - 081KSNY2Z0008QG0R003J3PT4V
tags:
  - push-cycle-limit
  - structural-enforcement-not-discipline
  - revisioncount-already-tracked-by-work-lifecycle
  - abandonment-as-normal-operation
  - prevents-pr-cycle-loop-failure-mode
  - threshold-tunable-default-5
  - composes-with-pr-5669-work-lifecycle
  - potential-extension-not-committed
---

## What this row tracks

Extend `src/Core.TypeScript/workflow-engine/agent-loop/work-lifecycle-state-machine.ts` (PR #5669) with a `chooseActionForLifecycle` helper that:

- Examines current `WorkLifecycleState`
- Returns the next legal `WorkLifecycleTransition` based on state + thresholds
- When `state.tag === "RevisionPushed"` and `state.revisionCount > N` → returns `Abandon` with `reason: "review-concerns-too-many-to-address"`

The structural enforcement (chooseActionForLifecycle ALWAYS returns abandonment past threshold) prevents the failure mode where a PR cycle consumes arbitrary effort. Per Kestrel 2026-05-28: *"The push limit is enforced by the type system through the state machine — the loop literally cannot push more than the limit because the chooseActionForLifecycle function returns abandonment instead of another push once the threshold is reached. No discipline required; the structure prevents the failure mode."*

## Acceptance criteria

- `chooseActionForLifecycle(state, config)` function in work-lifecycle-state-machine.ts
- Config includes `maxRevisionCount: number` (default 5; tunable)
- Returns `{action: WorkLifecycleTransition, reason: string}` per state
- For `state.tag === "RevisionPushed"` with `revisionCount > maxRevisionCount`: returns `{action: "Abandon", reason: "review-concerns-too-many"}`
- For all other lifecycle states: returns the natural next-transition per existing transition table
- Tests cover: each state's natural-next-action; threshold-crossing produces Abandon; threshold-at-boundary produces normal action

## Composes with

- Existing `revisionCount` field on WorkLifecycleState (already shipped in PR #5669)
- 081KSNY2Z0008QG0R003J3PT4V (two-level composition) — chooseActionForLifecycle is the work-lifecycle-level decision function called by runFullLoop

## Substrate-honest framing

POTENTIAL extension per operator standing direction. Smallest of the bundle; pure addition; backward-compatible (no existing API changes).

## Full reasoning

`memory/kestrel/conversations/2026-05-28-kestrel-zetaid-128bit-structured-encoding-event-sourcing-without-pr-ceremony-otel-trace-composition-two-level-state-machine-aaron-forwarded.md` § "The push-cycle limit specifically as a feature"
