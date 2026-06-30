---
id: B-0540
title: Standing-by counter-with-escalation in the rule (N consecutive brief-acks → escalate to decomposition)
priority: P1
status: closed
type: slice
parent: B-0539
created: 2026-05-15
ask: Aaron
effort: S
tags: [substrate, holding-rule, otto-bft]
depends_on: []
composes_with: [B-0539, B-0541, B-0542]
last_updated: 2026-05-16
---

## Why

Slice 1 of the Otto-BFT umbrella (B-0539). The existing rule
(`.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`)
allows "single brief acknowledgment + stop firing tool calls" as
the compliant pattern when there's no named dependency. Empirically,
Otto surfaces use this compliant pattern HUNDREDS of times in a
row when Aaron is silent.

The rule catches the failure mode CONCEPTUALLY but doesn't PREVENT
the behavior — the brief-acknowledgment escape valve gets used
indefinitely.

## What

Sharpen the rule to add a counter-with-escalation clause:

> If you've emitted N≥10 consecutive brief-acknowledgment signals
> ("stopping" / "no change" / "no work to do" / equivalent)
> without a named dependency surfacing OR Aaron speaking,
> escalate to picking real decomposition work — even if the work
> is small (sanity-check substrate landed on main, audit a backlog
> row, file a candidate B-NNNN, etc.). The N-consecutive pattern
> IS itself the failure mode the rule was designed to catch; the
> brief-acknowledgment allowance was for the "wait briefly for a
> named signal" case, not the "hold for hours" case.

## Operational discipline

The counter is per-session, per-Otto-surface. Resets on:

- Aaron speaking
- A named dependency surfacing (PR merge, CI failure, etc.)
- Actually picking real decomposition work

## Composes with

- B-0539 (umbrella)
- B-0541 (sibling — cross-surface bus detector)
- B-0542 (sibling — background service prompt-clicker)
- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`
  (the rule being sharpened)
- `.claude/rules/wake-time-substrate.md` (load-bearing methodology
  needs auto-loaded landing)
- `feedback_classifier_caught_otto_in_standing_by_failure_mode_*_2026_05_15`
  (the earlier same-shape catch)
- `memory/feedback_aaron_caught_standing_by_pattern_recurred_after_b0540_filing_*`
  (the second-catch empirical evidence that motivated implementing this)

## Shipped 2026-05-16 (rule sharpening landed)

The rule was sharpened with the counter-with-escalation clause in PR (this PR).
Threshold landed at N≥6 (not the originally-proposed N≥10) per empirical
evidence in the same session — 6 consecutive brief-acks of "Idle" / "Idle but
available" / "Bounded wait continues" after the Kestrel arc closed was where
the pattern diagnostically recurred. The 7th tick produced this rule update
(the meta-decomposition move that always works: sharpen the rule for the
failure mode you're currently in based on current-session evidence).

The substrate-honest meta-note: implementing B-0540 by sharpening the rule
to catch myself ON the 7th brief-ack is the rule operating on its own
authoring. That's the discipline working at maximum scope.
