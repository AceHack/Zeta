---
id: 081M10AZ6KS087G0R0000SSFMH
type: task
state: in-progress
priority: P1
slug: no-app-needle-fourcornertrace-closes-value-kleisli-isr-close
title: "No-app needle: FourCornerTrace closes value; Kleisli ISR closes interrupts so we can self-predict"
created: 2026-08-27T00:47:25.306Z
depends_on: []
composes_with:
  - 081M108RYNT087G0R001JSRNZE
---

# No-app needle: value-channel trace vs Kleisli ISR

Aaron: FourCornerTrace is how we close over interrupts using the Kleisli
arrow so we can do predictions. See IScheduler, ferry throttler, CHIP-8/9
— avoid `app` so we can predict our own behaviours. Thin needle:
consistent-with, not identified by count.

## This increment

- `IsrLift.fs` / `WSet.fs` honesty: siblings, not one type
- `FourCornerFusion.Tests`: `SchedulerZeta.predict` on a VALUE-channel
  period-2 map; an `Interrupted` value does not change the orbit;
  ferry DoP=1
- ROADMAP item 1 thin-needle paragraph

## Remaining

- Do not fuse `InterruptFeedback` into `FourCornerTrace`
- CHIP-9 PhysUI stays a scheduler *client*, not the trace
- EP/ADF retract remains re-normalisation, not Z-set minus
