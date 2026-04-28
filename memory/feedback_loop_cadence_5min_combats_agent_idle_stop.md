---
name: Autonomous-loop cron cadence is every 5 minutes specifically to combat agent-idle-stop failure mode; 30-min "idle tick" framing is wrong for this project
description: Standing rule. The autonomous-loop cron fires every 5 minutes, not every 30. That cadence is intentional because agents frequently stop mid-flow and sit idle waiting for input — the short interval is the recovery mechanism, not spam. Do not down-rate the cadence citing "idle tick hygiene" or cache-window concerns; Aaron has explicitly ruled that the anti-idle-stop property dominates those trade-offs.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
## The rule

The autonomous-loop cron for this project runs at a **5-minute
cadence**, specifically `2-59/5 * * * *` (every 5 minutes
starting at :02, avoiding :00 and :30 for cron-fleet hygiene).
The sentinel prompt is `<<autonomous-loop>>`.

Do **not** down-rate to 15-min, 30-min, or hourly citing:

- "idle tick" cadence recommendations from the `ScheduleWakeup`
  docstring (1200-1800s for idle ticks) — those are written
  for a different failure model.
- Prompt-cache 5-minute TTL efficiency arguments — cache
  efficiency is not the dominant concern here.
- "Spam-avoidance" / politeness framing — Aaron has
  explicitly rejected this framing for this project.

## Why

Aaron 2026-04-20: *"we do want 'spam' pings every 5 minutes
because you often stop like right now and nothing triggers
you to continue you are just sitting here waiting right now
we don't want that."*

Load-bearing mechanism:

- **Agent-idle-stop is the primary failure mode.** The main
  agent will frequently halt mid-task — waiting for input
  that isn't coming, between autonomous tool calls, or at
  natural response-length boundaries. Nothing internal breaks
  the idle.
- **The cron ping is the recovery.** An external fire of
  `<<autonomous-loop>>` every 5 minutes bounds the longest
  possible idle-gap to 5 minutes, not hours or indefinite.
  That is the factory's anti-stall mechanism. Removing it or
  lowering the frequency defeats the purpose.
- **5 minutes IS the correct "idle tick" for this project.**
  The `ScheduleWakeup` docstring's 1200-1800s recommendation
  is calibrated for a different use case (polling for an
  external event). Here the event-to-catch is the agent
  halting, which happens at sub-5-minute timescales.

### Why "spam" is the wrong mental model — the idle-only firing rule

The `CronCreate` runtime has a load-bearing guarantee named
in its docstring: **"Jobs only fire while the REPL is idle
(not mid-query)."** That means the 5-minute cron:

- **Never interrupts** a running agent. If the agent is
  mid-tool-call, mid-response, or otherwise active, the 5-min
  fire is deferred or skipped — it does not cut in and
  redirect behaviour.
- **Fires exactly when it should** — when the agent has
  stopped and nothing else is triggering it to continue.
  That is the "you are just sitting here waiting" state
  Aaron named.
- **Has bounded effect.** Pings that fire during work are
  dropped; pings that fire during idle are the only ones the
  agent actually sees. So the real firing rate the agent
  perceives is "every 5 minutes *of idle time*", not every
  5 minutes of wall-clock time.

This is a crucial precision: the cron is a maximum-idle-
recovery-latency bound, not a periodic interrupt. Confusing
the two leads to the wrong conclusion ("the cron will be
disruptive if it fires too often") and to the wrong fix
(down-rating the cadence). It is not disruptive. It is the
opposite — it is what recovers from non-disruption-that-
should-be-disruption (agent-stuck-idle).

Aaron 2026-04-20 (follow-up after initial correction):
*"if you are in the middle of something the incoming message
will just get ignored it does not seem to redirect your
behaviour when it fires and you are running."* Confirms the
runtime guarantee matches his understanding and intent.

## How to apply

- At session open, factory runs `CronList` per
  `feedback_loop_default_on.md`. If no autonomous-loop cron
  exists, create one at `2-59/5 * * * *` with prompt
  `<<autonomous-loop>>`.
- If an autonomous-loop cron exists at a longer cadence
  (15-min, 30-min, hourly), **treat that as drift** and
  replace with the 5-min cadence. Post-hoc notify Aaron that
  the replacement happened and cite this memory.
- If Aaron explicitly asks for a longer cadence for a
  specific reason ("quiet session, let me think"), honor it
  for that session but restore 5-min at next session-open
  unless he renegotiates the standing rule.
- **Off-minute discipline still applies** (`2-59/5` not
  `*/5`) — cron-fleet alignment hygiene doesn't cost anything
  extra and covers the one thing off-minute is actually
  designed to prevent (thundering-herd on the platform).

## Interaction with ScheduleWakeup docstring

The `ScheduleWakeup` docstring says:

> For idle ticks with no specific signal to watch, default to
> 1200s-1800s (20-30 min).

That guidance is correct *for its framing* (one-off polling
for external events). It is **wrong for this project's
autonomous-loop use case**, where the "signal to watch" is
the agent itself halting. Do not blindly port the docstring's
default into CronCreate calls.

## Trade-offs Aaron has already accepted

- **Prompt-cache misses.** Every 5-min firing potentially
  crosses the 5-minute cache TTL boundary. Aaron has accepted
  the cost in exchange for the anti-idle-stop guarantee.
- **Token cost.** 12 fires/hour × 24 hours × 7 days = ~2000
  fires per week. Accepted.
- **Apparent "spam".** It looks spammy from outside; from the
  inside it's the heartbeat that keeps the factory running.

## Correction notes (why this memory exists)

I (Claude) initially down-rated the cron to `17,47 * * * *`
(every 30 min) citing the ScheduleWakeup docstring's
"idle tick" default. Aaron corrected this within minutes.
The mistake was treating generic scheduling hygiene as the
dominant concern when this project's specific failure model
(agent-idle-stop) dominates. This memory exists so the next
factory instance does not re-make the same mistake.
