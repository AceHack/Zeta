---
id: 081KSNY2Z0008QG0R003WFDCJ9
priority: P1
status: open
title: Lifecycle DU split — trajectory-push vs pr-review-for-system-changes (determineReviewLevel discriminator)
effort: S
ask: kestrel via aaron 2026-05-28
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSKBP80008QG0R000B3Y19A
composes_with:
  - 081KSKBP80008QG0R000B3Y19A
  - 081KSNY2Z0008QG0R003J3PT4V
  - 081KSNY2Z0008QG0R001K6HJ7Z
  - 081KSNY2Z0008QG0R000F0C5V0
tags:
  - lifecycle-du-split
  - trajectory-push-no-ceremony-for-state-machine-events
  - pr-review-full-pipeline-for-system-changes
  - determinereviewlevel-discriminator
  - work-touches-agent-events-only-vs-touches-code-or-rules-or-framework
  - safe-default-pr-review
  - composes-with-error-class-extraction-pipeline
  - composes-with-two-level-state-machine-b-0867-16
  - potential-extension-not-committed
---

## What this row tracks

Refine the WorkLifecycle DU (shipped in PR #5669) with a discriminator that routes work to either trajectory-push (no PR ceremony) or pr-review (full pipeline), based on what the work touches.

Per Kestrel 2026-05-28:

```typescript
type WorkLifecycle =
  | { stage: "unclaimed"; item: UnclaimedBacklog }
  | { stage: "claimed"; claim: ClaimedBacklog }
  | { stage: "implementing"; inProgress: InProgress }
  | { stage: "pushed-to-trajectory"; pushed: TrajectoryPush }   // state-machine event, no PR
  | { stage: "pr-open-for-review"; prOpen: OpenPr }             // change to system, PR-reviewed
  | { stage: "completed"; completed: Completed }
  | { stage: "abandoned"; abandoned: Abandoned };

function determineReviewLevel(work: WorkItem): "trajectory-push" | "pr-review" {
  if (work.touchesAgentEventsOnly) return "trajectory-push";
  if (work.touchesCode || work.touchesRules || work.touchesFramework) return "pr-review";
  return "pr-review"; // safe default
}
```

## Operator framing 2026-05-28

> *"even in my setup i want ever non state machine to go through pr review cause we have bunches of agenst that auto review and then we find error classes and save the error classes as rules so we don't make them again."*

State-machine events = direct push (no ceremony); system changes (code, rules, framework) = full PR review with heterogeneous reviewer ensemble (per 081KSNY2Z0008QG0R0004ZF85W) feeding error-class extraction (per 081KSNY2Z0008QG0R000K3ETGB).

## Acceptance criteria

- Update `src/Core.TypeScript/workflow-engine/agent-loop/work-lifecycle-state-machine.ts` (PR #5669) — split `PrOpen` into `pushed-to-trajectory` + `pr-open-for-review` stages
- Add `determineReviewLevel(work)` discriminator
- Tests cover: state-machine-events route to trajectory-push; code/rule/framework changes route to pr-review; safe-default to pr-review
- README updates documenting the split

## Composes with

- 081KSNY2Z0008QG0R003J3PT4V (two-level state machine composition) — the AgentState × WorkLifecycle composition uses this discriminator
- 081KSNY2Z0008QG0R001K6HJ7Z (event-sourcing layer) — trajectory-push writes go to `agent-events/{trajectory}/` branches
- 081KSNY2Z0008QG0R000F0C5V0 (trajectory-async-review surface) — reviews trajectory branches; PR review pipeline handles system-change branches

## Substrate-honest framing

POTENTIAL extension per operator standing direction. P2; small surface; clean refactor of existing PR #5669.

## Full reasoning

`memory/kestrel/conversations/2026-05-28-kestrel-trajectory-push-vs-pr-review-split-error-class-extraction-as-benchmark-training-data-clifford-space-uniqueness-emit-observe-limit-simulate-aaron-forwarded.md` § "Where the auto-review pipeline lives in the loop"
