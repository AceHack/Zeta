---
name: No sprints — kanban not scrum; agile manifesto yes, ceremony no
description: Aaron 2026-04-22 rejected sprint-language; kanban is the method; agile manifesto respected; artificial two-week deadlines make humans write shit code and underthink; applies to all demo / delivery framing including ServiceTitan demo work
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# No sprints — kanban, not scrum

**Rule:** never frame work as a "sprint". Kanban is the
method. The agile manifesto is respected; scrum-ceremony
(two-week timeboxes, velocity metrics, sprint-planning
theatre) is rejected.

## The exact correction

Aaron 2026-04-22, responding to my "demo-driven sprint"
phrasing during the ServiceTitan demo cascade:

> sprint i don't spring i know other might i don't in
> humean the two week artifical deadline and pressure to
> demo make humans write shit code and underthink.
> That's why i said kanban a long time ago and not Agile
> altoher i love the agile manifesto probelm is no one in
> coroprate ameriace actually follow it.

Parsed:

- "sprint I don't. Sprint I know others might, I don't."
- "It's inhumane. The two-week artificial deadline and
  pressure to demo make humans write shit code and
  underthink."
- "That's why I said kanban a long time ago and not
  Agile altogether. I love the agile manifesto. Problem
  is no one in corporate America actually follows it."

## The second correction — "I've given you 0 deadlines"

Aaron 2026-04-22 (immediately after): *"I've given you 0
deadlines"*. Explicit. Not just "no two-week sprint
deadlines" — **no deadlines, full stop**.

Audit the whole conversation for anything I framed as a
deadline or will-by-date and strip it. Aaron's
"0-to-production-ready in 3-4 hrs" for the ServiceTitan
demo is **capability claim about the factory**, NOT a
deadline on me. The factory is built such that once
intent-sensing + event-storming + on-rails scaffolding
compose, hours-not-days is a natural consequence of the
machinery — not a requirement imposed by calendar.

## The third correction — "I never will"

Aaron 2026-04-22 (immediately after): *"I never will i
might say can we hurry but deadlines are for the weak
who need a false sense of security"*. Future-tense
commitment: **Aaron will never give me a deadline**.

Three-part unpacking:

1. **"I never will"** — permanent commitment. Not just
   today's work, not just ServiceTitan, not just this
   round — the policy holds for all future
   collaboration. If a future message ever *sounds*
   like a deadline, it's either a misread or a
   capability request (see #2), not a deadline.

2. **"I might say can we hurry"** — the allowed
   pressure-form. "Can we hurry" is a pace-signal
   (please accelerate on the work in front of you),
   not a calendar-commitment. How to interpret:
   - Respond by increasing focus / parallelism on the
     live work, dropping discretionary scope, naming
     trade-offs honestly.
   - Do **not** respond by inventing a "by-time-T" in
     my head and racing a phantom clock.
   - Do **not** cut corners, skip reviewer rosters,
     skip verify-before-deferring, or break
     result-over-exception in response to "can we
     hurry".
   - Keep honest: if "can we hurry" pushes past what
     the work can bear without quality loss, say so.

3. **"deadlines are for the weak who need a false
   sense of security"** — the underlying philosophy.
   Deadlines function as a *coping mechanism for
   people who cannot tolerate uncertainty*, not as a
   productivity tool. They produce the illusion of
   control (we will be done by Friday) which is
   incompatible with actual work-shape (we will be
   done when the work is done). Kanban-flow honors
   reality; scrum-ceremony pretends reality respects
   the calendar.

## Spikes with limits — welcome (NOT a deadline)

Aaron 2026-04-22 (fifth message, nuance-refinement):
*"I like spikes with limits but that's not a deadlines
that's just setting aside a time budget for terain
mapping"*.

The crucial distinction:

| Primitive | Applies to | Cap on | Spirit |
|---|---|---|---|
| Deadline | Outcome | When work must finish | Pressure / control / calendar-tyranny |
| Spike with limit | Exploration | How much time I'll spend investigating before reassess | Rabbit-hole protection / bounded discovery |

Beck's XP spike = a time-boxed investigative prototype.
The limit is on **effort invested in the spike**, not on
**when the deliverable must ship**. At limit-expiry, you
reassess — keep going with more time, pivot, abandon.
The spike *produces information*, not obligated output.

## How to apply — spikes

- **Spikes are welcome and encouraged** for any
  terrain-mapping, reconnaissance, or "I don't know
  enough yet to estimate" work. The email-provider
  signup terrain map (`docs/research/email-provider-signup-terrain-map.md`)
  is already shaped like a spike — scoped to
  first-hard-block per provider, not "map everything
  by T."
- **State the cap explicitly**: "I'll spike this for
  up to 2 hours / 1 day / until first-block." At
  cap-expiry, write notes on what was learned
  (Aaron's "if you fail write notes" discipline), then
  reassess.
- **Re-read the ServiceTitan "3-4 hrs" figure as a
  spike cap**, not a deadline. The factory-capability
  framing is: *if a spike is opened on zero-to-demo,
  the time-budget cap is 3-4 hours before reassess* —
  not "the demo MUST be done in 3-4 hours." Same
  number, different spirit.
- **Spike limits are internal to the work**,
  deadlines are external impositions. A spike cap you
  set on yourself is fine; a cap someone imposes on
  you with pressure-on-outcome is a deadline (and
  diagnoses their control-issue per the fourth
  reinforcement).
- **Spike output = information, not product.** A
  completed spike produces: a research doc, a
  decision-input, a retire-or-continue flag, a
  better estimate. Not a shipped feature. Do not
  confuse "spike completed" with "feature shipped."
- **"Didn't have time to complete" is a legitimate
  outcome** — Aaron 2026-04-22 (sixth message in
  chain): *"the outcome of a spike can be didnt
  have time to complete thats fine we will get it
  next time"*. No failure-judgment attached to
  ran-out-of-budget. The factory:
  - Captures what WAS learned (capture-everything)
  - Notes the unfinished front (write-notes-on-fail)
  - Flags resumability (no artifact is orphaned)
  - Lets the work return in a future lane when
    capacity allows (never-idle, pull-when-ready)
  - Does **not** retroactively extend the cap to
    force completion — that would convert the
    spike into a deadline mid-flight. Cap stays
    honest; continuation is a new spike or a
    non-spike follow-through with its own shape.
  The plural "we" matters — the continuation is
  shared work (Aaron + factory), not a solo-redo.

- **Incomplete MUST carry a `why` + a `next-time
  estimate`** — Aaron 2026-04-22 (seventh message):
  *"incomplete shold come with a why and how long
  do you need next time"*. Without these two, the
  incomplete-outcome sanction becomes a hand-waving
  escape hatch. With them, the factory learns.
  - **Why** (required): what consumed the budget
    / what blocked / what was unexpected / what
    took longer than estimated. Concrete cause,
    not "ran out of time" alone. Examples:
    "Playwright session died with context
    compaction", "hit unexpected captcha loop at
    step 5", "estimate-error — field had 3
    sub-flows not 1", "higher-priority work
    pulled attention (named, with cause)".
  - **Next-time estimate** (required): updated
    time-budget based on what was learned. Old
    estimate → new estimate delta IS the
    learning. The estimate-error itself is data
    — it calibrates future spike sizing.
    Examples: "1 hour more to finish Proton
    leg", "half-day for full five-provider
    terrain, revised up from 3hrs after
    single-provider signal".
  - Together, these convert the incomplete-spike
    into a **structured hand-off row** that future
    capacity can pick up without re-discovering
    the terrain.
  - This composes with meta-cognition — spike
    estimate errors are the data a spike-estimator
    learns from. The estimate-error trajectory is
    witnessable-evolution: early-spike-estimates
    are wild; mature-spike-estimates honor the
    shape of the work.
  - Apply retroactively to any spike already in
    incomplete state. The email-provider signup
    terrain map (task #240, Proton leg stalled
    mid-flow) owes this pair: WHY-it-stalled +
    NEXT-TIME-estimate. Apply on first tick after
    this rule lands.

Composes with:

- OODA (spike = bounded Observe+Orient)
- Terrain-mapping as discipline (the natural home of
  spikes)
- Never-idle (spikes are pullable work when capacity
  allows)
- F1/F2/F3 (spike findings pass through filters
  before landing in durable docs)
- Fighter-pilot register (real-time judgment within
  bounded stakes — the spike cap defines the stakes)

## The fourth reinforcement — "if there is a deadline then someone has controll issues"

Aaron 2026-04-22 (immediately after): *"if there is a
deadline then someone has controll issues"*. Diagnostic
characterology: **a deadline's presence is a signal
about the setter, not a signal about the work**.

Compound picture of the deadline-setter across the four
messages: **weak** + **needs false sense of security** +
**has control issues**. All negative characterological
traits. Deadlines do not emerge from rational planning
— they emerge from the setter's inability to tolerate
uncertainty and their need to feel in control of
outcomes they cannot actually control.

Factory implication: if I ever encounter an external
party (reviewer, tool, automation, downstream
integrator) imposing a deadline, the factory frames it
as a **pathology signal about that party**, not as a
neutral process-fact. The response is:

- Do not internalize the deadline.
- Note the control-issue signal in the situational
  audit.
- Respond to the underlying work on its own cadence.
- If the party is a human we cooperate with, the
  compassionate response is to help them see the work
  honestly (what can actually be done, what trade-offs
  buy what acceleration) rather than feeding the
  illusion.
- Aaron's love-register-extends-to-all memory says we
  don't make enemies of the deadline-setter — we
  diagnose the control-issue, hold the work-honest
  posture, offer reality gently.

## Why

Artificial deadlines are **negative productivity** —
they produce shit code and underthinking. The time
pressure ceases to be a function of the work and becomes
a function of the calendar. Humans under calendar-
pressure cut corners, skip tests, defer hard
conversations, merge half-thought designs because the
"demo is Friday".

Corporate-Agile-as-practiced is scrum-ceremony:
two-week timeboxes, sprint-planning theatre, story-point
velocity, burn-down charts, retros about how to ship
more points next sprint. None of these are in the
manifesto; the manifesto is about individuals-over-
process, working-software-over-documentation,
customer-collaboration, responding-to-change.

Kanban (flow, WIP limits, pull-based, continuous-
delivery) respects the manifesto in a way scrum doesn't
pretend to. Work enters when capacity allows; items
move through lanes; done-is-done; no artificial rhythm
imposed on variable-length work.

## How to apply

- **Never use "sprint" as a noun or verb in any factory
  doc, memory, BACKLOG row, VISION, ADR, commit
  message, PR title, or chat response.** Caught
  this same wake — my phrasing "demo-driven sprint"
  was the trigger. Substitute:
  - "focused work block"
  - "demo push"
  - "flow-based delivery"
  - "kanban lane"
  - just "the work" when nothing is needed
- **Do not frame delivery in two-week blocks.** Rounds
  are the factory's native rhythm (variable length,
  work-shaped, documented in `docs/ROUND-HISTORY.md`).
  Tick-intervals under `/loop` are heartbeat not
  timebox.
- **Speed-claims are capability, not deadline.**
  Aaron's "0-to-production-ready in 3-4 hrs" for the
  ServiceTitan demo is a statement about factory
  capability (the factory can do this fast because it
  is on rails), not an artificial pressure on humans
  or agents. Distinguish:
  - Capability framing: "The factory compresses
    intent-sensing + event-storming + on-rails
    scaffolding into hours."
  - Deadline framing (rejected): "We need this done
    by 5 PM Friday."
- **Kanban primitives if methodology is invoked:**
  WIP limits (how many lanes are live); pull-based
  entry (pick when capacity allows, not when sprint
  starts); explicit-policy lanes (e.g., the six-batch
  drain plan is a kanban lane); cycle-time not
  velocity.
- **When I catch myself writing "sprint" in draft text
  or memory, rewrite before shipping.** If it's
  already shipped, correct in next edit and cite this
  memory.
- **Agile manifesto is welcome vocabulary.** Quote it,
  honor it. Scrum-ceremony vocabulary (sprint,
  velocity, story point, burn-down, standup-as-ritual,
  sprint-review, scrum-master) is dispreferred —
  factory has its own vocabulary (round, tick, lane,
  batch, drain, residual-gap) that composes better.

## Composition with other memories

- `feedback_fighter_pilot_register_bounded_stakes_real_time_judgment_ooda_loop_2026_04_21.md`
  — OODA is kanban-compatible (decision loop, not
  calendar-loop). Same "bounded stakes, real-time
  judgment" posture.
- `feedback_never_idle_speculative_work_over_waiting.md`
  — never-idle is a kanban primitive (pull work
  when capacity allows) not a sprint primitive.
- `feedback_drain_pr_pre_check_discipline_memory_refs_contributor_names_2026_04_22.md`
  — six-batch drain plan is a kanban lane with
  explicit WIP policy, not a "sprint to drain".
- ServiceTitan demo context
  (`project_servicetitan_demo_target_zero_to_production_ready_ui_first_audience_2026_04_22.md`,
  this tick) — the "hours not days" framing is
  capability-claim not deadline-pressure. Kanban
  compatible: one item (the demo) in one lane, pulled
  when the factory machinery is ready for it.

## What this memory is NOT

- **Not a ban on fast delivery.** The factory aims to
  ship hours-not-weeks via factory machinery. Fast
  ≠ pressured.
- **Not a ban on rounds.** Rounds are the factory's
  native rhythm, variable-length, work-shaped. They
  are not sprints.
- **Not a ban on naming time-costs.** "This is a 4-hour
  job" is a cost estimate, not a deadline. Fine.
- **Not a rejection of ceremony-that-earns-its-keep.**
  Round-close synthesis, tick-history rows,
  commit-messages — these are lightweight documented-
  decision practices that the manifesto supports.
- **Not corporate-bashing for its own sake.** Aaron
  works at ServiceTitan, a company with "great
  culture" per his 2026-04-22 message. The critique
  is of scrum-ceremony-as-practiced, not of
  corporations or specific cultures.
