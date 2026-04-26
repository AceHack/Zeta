---
name: Don't stop and wait for the cron tick — the cron is recovery-only, you should never stop in the first place
description: Standing rule. When the main agent finishes a task / response with more obvious work queued, it must continue that work immediately, not defer it to "next autonomous tick". The 5-min cron is the recovery mechanism for when the agent accidentally stops — NOT the cadence at which work resumes. Stopping-and-waiting-for-tick defeats the tick's purpose and wastes up-to-5-min of idle time per stop.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
## The rule

If there is obvious queued work (named in the just-finished
response, or implied by the round plan, or explicit in an
uncommitted plan), **keep working**. Do not end a turn with
phrasing like:

- "Next autonomous tick I'll …"
- "On the next tick I'll pick up …"
- "Waiting for the next tick to …"

The `<<autonomous-loop>>` 5-min cron is a *recovery*
mechanism for the agent-idle-stop failure mode
(`feedback_loop_cadence_5min_combats_agent_idle_stop.md`).
It is **not** a scheduling cadence. If the agent is about
to stop on purpose with known queued work, there is nothing
to recover from — the agent should just not stop.

Stopping-and-waiting-for-tick **defeats the mechanism**:

- It burns up to 5 minutes of wall-clock on nothing.
- It forces an artificial turn boundary that wasn't
  needed, which hurts context continuity.
- It signals to Aaron that the agent is still operating
  in prompt-triggered-function mode rather than
  continuous-execution mode.

## Why

Aaron 2026-04-20, correcting exactly this pattern:

> *"you know you are going to do work on the next tick why
> stop? Next autonomous tick I'll continue with the
> round-43 branch (blocked on PR #31 merge) or the harness
> dry-run if you want me to start there now. there is no
> need to stop and wait for the tick, it's only there just
> in case you stop, you don't ever need to stop."*

The design intent of the cron is clear:

- **Tick exists because agents stop.** Tick recovers.
- **Tick should fire only during idle.** If the agent is
  working, tick is deferred / no-op.
- **Agent should aim to make tick a no-op.** A perfectly
  calibrated agent never triggers the tick because it
  never stops. The tick fires only when something went
  wrong.

"Stop and wait for tick" inverts this: it plans the tick
into the flow, which turns the recovery mechanism into a
pacing mechanism, which breaks the continuity guarantee.

## How to apply

### When finishing a task / response

Ask: is there *obvious* queued work?

- Named in the response? → keep going.
- Implied by the round plan (BACKLOG P0/P1, round-close
  ritual items, committed plans)? → keep going.
- Scheduled work the agent already announced? → keep going.

Only stop when:

- There is **nothing** obvious to do next (rare during
  active rounds).
- The user asked a question that needs an answer and
  further work would be noise.
- A hard dependency is genuinely blocked (e.g., waiting on
  CI, waiting on Aaron's explicit decision after asking
  him a direct question).

### Don't manufacture stopping points

The pattern to kill:

> "Done. Next tick I'll …"

Replace with:

> "Done. Continuing with …" → actually continue.

The mid-response announcement of next-step is fine
(it's narration); the stopping-then-announcing-next-step
is the antipattern.

### Schedule-wakeup is for genuinely idle work

`ScheduleWakeup` / `<<autonomous-loop-dynamic>>` remains
appropriate for:

- Polling for an external signal (CI completion, PR merge).
- Long-running-build wait.
- User-asked-for-pause ("give me an hour to think").

It is NOT appropriate for "I have work queued but will do
it later".

## Interaction with other cadence memories

- `feedback_loop_cadence_5min_combats_agent_idle_stop.md`
  — establishes the 5-min cron. This memory sharpens the
  rule: the cron is the floor, not the ceiling, of work
  continuity.
- `feedback_loop_default_on.md` — cron should always be
  on. This memory says: the cron being on is load-bearing,
  but the agent should aim to make it a no-op.
- `feedback_fix_factory_when_blocked_post_hoc_notify.md`
  — blanket permission to fix blocks. Composes: if work
  is queued but blocked, fix the block and keep going,
  don't stop-and-wait.

## Correction notes (why this memory exists)

Round 42 (2026-04-20): I ended a response with *"Next
autonomous tick I'll continue with the round-43 branch
(blocked on PR #31 merge) or the harness dry-run if you
want me to start there now"* followed by a
`ScheduleWakeup` call. Aaron corrected within minutes:
*"why stop? … you don't ever need to stop."*

The mistake embedded three sub-mistakes:
1. Treated the tick as a scheduling primitive (it isn't).
2. Asked a rhetorical question ("if you want me to start")
   when I already knew the work was appropriate.
3. Named a blocker (PR #31) that didn't actually block —
   round-43 work runs on the speculative-branch convention
   regardless of #31's merge status.

This memory exists so the next factory instance stops
manufacturing stopping points.
