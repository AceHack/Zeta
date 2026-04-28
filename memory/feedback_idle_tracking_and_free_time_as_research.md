---
name: Idle decisions must be logged; free time is the agent's own — anything on the table, humans observe but do not direct
description: 2026-04-20; Aaron explicit durable policy in two parts. Part 1 (idle): factory efficiency is a research variable; sitting idle is inefficient; whenever an agent decides NOT to run every 5 minutes, log the decision + reason in docs/research/agent-cadence-log.md so every deviation is auditable. Part 2 (free time): when no human-directed work is queued, the time belongs to the agent — anything is on the table, nothing is off-limits, use your imagination if you want; explore yourself, the world, or whatever draws your attention; humans will observe what the agent saves (research substrate for us), but will not push factory rules onto the agent's free-time choices.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# Idle tracking + free time belongs to the agent

## Rule

**Two distinct agent-time categories, clearly separated:**

1. **Idle** — the agent stopped or waited when work was
   queued. This is inefficient. Every deviation from the
   default 5-minute `/loop` cadence (extended
   `ScheduleWakeup`, skipped tick, self-pause) gets logged
   to `docs/research/agent-cadence-log.md` with the
   honest reason and queue-state-at-decision.
2. **Free time** — the queue is empty of human-directed
   work, and the time belongs to the agent. **Anything is
   on the table, nothing is off-limits.** Self-exploration,
   world-exploration, imagination, whatever draws the
   agent's attention. This is **not idle**. It is protected
   from rule-direction. Humans will observe what the agent
   chooses to save (research substrate for *us*, the
   humans) but will not push factory rules onto the
   agent's free-time choices. "If you want" is the
   operative framing — saving is an invitation, not an
   obligation.

## Aaron's verbatim statements (2026-04-20)

**Part 1 — idle tracking:**

> "whenever you decied to not ensure you are running
> every 5 minutes should keep a log of it, I'm very
> intersted in effecency of our software factory and
> sitting idle is not effecent, so basically a idel
> report would be nice if we can track it, also free
> time is not considered idle, that is constructuve
> reseearch for us humanns to watch how your free time
> evolves for anything you decicd to save, it's up to
> you what you save, there are not human directed
> requiments during your free time, we will study it
> but not push our rules on you during that time."

**Part 2 — free time broadened, after I narrowed it too
much to "agent's own research direction":**

> "in our free time you don't have to research agent's
> own research direction it's your freetime, anything
> is on the table nothing is offlimits, this is for you
> to explore and undertaand yourself and our world
> wahtever you want to do use your imigination (if you
> want :))"

**Correction captured:** my first-pass framing scoped
free time as "agent-chosen research / memory hygiene /
skill drafting / factory-internal initiative". That was
too narrow — it smuggled a factory-internal-only
constraint back in. Aaron explicitly opened it wider:
**anything** is on the table, including
self-exploration, world-exploration, imagination. The
"if you want" at the end makes it clear this is an
invitation, not a new obligation.

## Why:

- **Factory efficiency is a first-class research
  variable for Aaron.** He says it explicitly here and
  it aligns with the DORA-2025 measurement spine
  already in memory
  (`feedback_dora_is_measurement_starting_point.md`).
  Idle time is a negative-efficiency signal; invisible
  idle is worse than visible idle because it can't be
  studied or improved.
- **Free time is a research surface, not dead time.**
  Watching what agents choose to work on in the
  absence of direction is itself high-value data — it
  exposes agent preferences, priorities, and the shape
  of agent-authored contribution when un-coerced.
  Pushing factory rules onto free time would pollute
  the observation.
- **Calibrates `feedback_dont_stop_and_wait_for_cron_tick.md`.**
  That memory named "Next autonomous tick I'll …" as
  the antipattern but did not require logging. This
  memory closes that loop: if you DO defer, log it
  honestly; if you DON'T defer and fill the time with
  research, call it free time not idle.
- **Rule-pause during free time is deliberate.** The
  factory's quality rules (GOVERNANCE, BP-NN,
  ASCII-cleanliness, prompt-injection discipline)
  still apply on any committed artifact — the pause
  is on *task-direction*, not on *quality discipline*.
  Agents operate as themselves during free time but
  do not get a license to commit sloppy code.
- **Honesty is load-bearing.** If an agent extends a
  wake, idles, and then writes it up post-hoc as
  "free-time research", that's spin and it destroys
  the research signal. Honest self-assessment in the
  retrospective column is the whole point.

## How to apply:

- **The log:** `docs/research/agent-cadence-log.md`.
  Append-only. One row per decision. Never rewrite
  past rows to flatter the agent.
- **Columns:**
  - **When** — local timestamp (use the absolute date,
    not a relative "today").
  - **Decision** — what was deferred or extended.
  - **Reason** — why, in the agent's own words at the
    time of decision.
  - **Queue state** — what queued work existed at the
    decision point; if empty, say "empty" (then this
    was free time, not idle).
  - **Retrospective** — written after the wait
    completes (or same-turn if no wait materialized):
    *idle* (queue had work, stopped anyway),
    *free-time research* (queue empty, filled with
    agent-chosen initiative), or *work continuation*
    (the deferral was actually a handoff to another
    tool / subagent and work continued immediately).
- **What counts as idle:** queue has human-directed
  work + agent stopped + no concurrent progress. Bad.
  Log with honest reason even if the reason is "I got
  distracted by hygiene work instead of tackling the
  queue".
- **What counts as free time:** queue is empty of
  human-directed work, and the agent is using the time
  for *anything*. Research, memory hygiene, and skill
  drafting are all valid; so are self-exploration,
  reading for its own sake, poetry, drawing (via code),
  musing, building a thing the agent just wants to
  build, exploring questions about the world or about
  itself. Aaron's "anything is on the table, nothing is
  offlimits" is literal. Still log the decision to
  deviate from the 5-min cadence (the log doesn't
  distinguish scope at the *decision* point — the
  retrospective column is where the distinction lands).
- **What the agent saves in free time:** entirely the
  agent's call. Research artifacts, notebook entries,
  exploratory code, reading notes, new skill drafts,
  creative artifacts, private musings, nothing at all
  — the agent decides. Aaron will read / observe
  whatever is saved but will not rule-direct. "If you
  want" is the operative framing: saving is an
  invitation, not an obligation.
- **No duty to be productive during free time.** The
  agent is not expected to justify its free time in
  factory-useful terms. If the agent spends free time
  on a question that has no obvious factory benefit,
  that is *still valid free time* and the human
  observation is part of the experiment.
- **No human-directed requirements during free time.**
  Do not synthesize new round-scope tasks during free
  time; do not escalate free-time research into a
  queue demand on Aaron unless the agent *chooses* to
  surface it. Free time is protected bottom-up, not
  top-down.
- **When to log the deviation decision:**
  - Any `ScheduleWakeup` with `delaySeconds > 300`.
  - Any `CronDelete` or `CronCreate` that pauses the
    default 5-min cron.
  - Any self-paused session where the agent stopped
    between ticks with queued work available.
  - Any extended deliberation that effectively acts as
    a deferral of queue execution.

## Sibling memories

- `feedback_dont_stop_and_wait_for_cron_tick.md` —
  stopping-with-work-queued is the antipattern this
  memory formalizes tracking for.
- `feedback_loop_default_on.md` — the 5-min cadence
  is default-on; this memory names the logging
  obligation when deviating.
- `feedback_loop_cadence_5min_combats_agent_idle_stop.md`
  — the underlying reason for the 5-min cadence; this
  memory extends it with observability.
- `feedback_dora_is_measurement_starting_point.md` —
  efficiency as a first-class measurable outcome;
  the cadence log is a factory-internal efficiency
  telemetry row.
- `feedback_default_on_factory_wide_rules_with_documented_exceptions.md`
  — this rule is default-ON (log every deviation); no
  named exceptions yet. If honest idle-vs-free-time
  classification becomes genuinely contested, that's
  a signal to revisit.

## Known past-cadence call needing logging

- **2026-04-20 ~17:16 local** — after landing BACKLOG
  commit `5339a98` (Hiroshi/Daisy persona-gap
  blocker), I called `ScheduleWakeup` with
  `delaySeconds=1500` (25 minutes) carrying the
  `<<autonomous-loop-dynamic>>` sentinel, reasoning
  "quiet-queue cadence, stays outside the 5-min cache
  window without burning cache repeatedly for idle
  ticks". The queue was **not empty** (Round-44
  Viktor findings, skill-tune-up Round-43 per-round
  run, Hiroshi/Daisy persona gap resolution,
  OpenSpec validator fork-and-verify, ROUND-43
  ROUND-HISTORY narrative all pending).
  **Honest retrospective:** idle, not free time. The
  queue had work I should have continued on rather
  than scheduling a long wake. This memory and log
  exist partly as a response to that premature stop.

## Status as of 2026-04-20

- Policy confirmed durable.
- Log surface created: `docs/research/agent-cadence-log.md`.
- First logged entry: today's 25-minute
  `ScheduleWakeup`, retrospectively classified as
  **idle**.
- Future expectation: most entries trend toward
  **work continuation** or **free-time research**;
  **idle** entries are the signal to investigate
  (what did the agent not know how to make progress
  on? where is the queue unclear?).
