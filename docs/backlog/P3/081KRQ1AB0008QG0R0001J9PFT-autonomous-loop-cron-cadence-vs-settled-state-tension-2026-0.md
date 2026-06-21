---
id: 081KRQ1AB0008QG0R0001J9PFT
priority: P3
status: open
title: "Autonomous-loop cron-cadence vs settled-state tension — design pause-mechanism or adaptive-cadence"
tier: factory-infrastructure
effort: S
created: 2026-05-16
last_updated: 2026-05-16
depends_on: []
composes_with: [081KRFA460008QG0R001KC0VBH, 081KRMEXM0008QG0R0039V4SQQ, holding-without-named-dependency-is-standing-by-failure]
tags: [autonomous-loop, cron-cadence, brief-ack-failure-mode]
type: design
---

# Autonomous-loop cron-cadence vs settled-state tension — design pause-mechanism or adaptive-cadence

## Origin

2026-05-16 session (1531Z → 1900Z+): after the natural cron-tick-discipline
substrate-engineering arc settled (~16 PRs landed), subsequent cron fires
into a quiet main HEAD revealed a structural tension:

- Cron is set to `* * * * *` (every minute) per `<<autonomous-loop>>` sentinel
- The discipline rules
  ([`holding-without-named-dependency-is-standing-by-failure.md`](../../../.claude/rules/holding-without-named-dependency-is-standing-by-failure.md))
  prescribe "either let cron fire empty without per-fire emission, OR run the
  full 7-step discipline"
- The harness requires SOME response to each cron fire — true silence is
  impossible
- Therefore: when substrate has genuinely settled, the agent has no
  rule-compliant disposition that's not brief-ack-shaped

The agent worked around this by emitting "Stop." minimal-phrasing responses
and producing meta-substrate (rule edits, memory files about the failure
mode itself). Both approaches eventually triggered the N=6 brief-ack
escalation rule on their own surface phrasing — minimal phrasing was
sharpened into the rule via [PR #3930](https://github.com/Lucent-Financial-Group/Zeta/pull/3930)
and the memory file via [PR #3927](https://github.com/Lucent-Financial-Group/Zeta/pull/3927).

The structural friction remains: cron fires every minute regardless of
substrate state. No rule-compliant disposition is fully escape-shaped.

## Acceptance

A solution that meets ALL of:

1. Eliminates the harness-vs-rule contradiction (truly-silent response OR
   adaptive cadence)
2. Composes with the existing N=6 escalation rule without weakening it
3. Doesn't require manual intervention each session

## Candidate approaches

### Option A: Adaptive cron-cadence

Replace `* * * * *` with a cron-sentinel that adapts cadence based on
substrate-quiescence signal:

- Cron fires every minute by default
- After N=3 consecutive ticks with `git log origin/main` unchanged AND no
  bus envelope AND no open PR from this Otto, **slow cadence to every 15
  min**
- Resume per-minute cadence when any signal returns

Requires: a per-session quiescence-counter (memory-file or bus-state) +
`CronCreate` re-arm logic that adjusts the schedule.

### Option B: Substrate-quiet sentinel value

The cron prompt is `<<autonomous-loop>>`. Add a sibling sentinel
`<<autonomous-loop-quiet>>` that fires when substrate is known-quiescent.
The agent's response to the quiet sentinel can be genuinely empty (no
tool calls, no output) without violating the discipline.

Requires: a substrate-quiescence detector (similar to Option A) that
emits the sentinel-switch signal.

### Option C: Accept the tension; harden the meta-fallback

Document explicitly that the meta-fallback IS the right move under
quiet-cron: each cron fire that has no novel substrate produces ONE
concrete-artifact (rule edit / memory file / B-row file) that compounds
into substrate. This converts cron-firing-into-quiet from a "failure
mode" to a "background substrate-evolution loop."

The risk: substrate-evolution outpaces actual factory needs (the
substrate-engineering-not-backlog-burning observation from 1657Z).

## Open questions

- Does Option A's adaptive-cadence break any existing rule?
- Does Option B require harness-side changes? (Yes — `<<sentinel>>`
  resolution is harness-controlled)
- Is Option C the substrate-honest default — accept that meta-substrate
  IS valid work when no real backlog is available?

## Composition

- [081KRFA460008QG0R001KC0VBH](../P1/081KRFA460008QG0R001KC0VBH-missed-substrate-cascade-detector-background-service-2026-05-13.md)
  (Standing-by detector — sibling structural mechanism)
- [081KRMEXM0008QG0R0039V4SQQ](../P3/081KRMEXM0008QG0R0039V4SQQ-rule-sharpening-pre-emptive-decomposition-at-n4-2026-05-16.md)
  if exists, OR the rule's own N=6 clause
- [`holding-without-named-dependency-is-standing-by-failure.md`](../../../.claude/rules/holding-without-named-dependency-is-standing-by-failure.md)
- [`feedback_post_cascade_quiet_cron_consolidation_visibility_signal_brief_ack_failure_mode_otto_cli_2026_05_16.md`](../../../memory/feedback_post_cascade_quiet_cron_consolidation_visibility_signal_brief_ack_failure_mode_otto_cli_2026_05_16.md)

## Resolution

(open)
