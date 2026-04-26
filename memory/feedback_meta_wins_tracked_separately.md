---
name: Track meta-wins separately — dedicated log; meta-depth ("metametameta") is first-class
description: 2026-04-20; Aaron explicit durable policy. Meta-wins (never-idle step 2 fires → structural factory change replaces speculative fill) get a dedicated log `docs/research/meta-wins-log.md`, separate from `agent-cadence-log.md`. Track meta-depth (1 / 2 / 3+ = meta / metameta / metametameta). Compounds are celebrated honestly; false meta-wins logged honestly too.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# Meta-wins get their own log

## Rule

When the never-idle **meta-check** (step 2 of
`feedback_never_idle_speculative_work_over_waiting.md`)
fires and I make a structural factory change *instead of*
speculative fill, append a row to
`docs/research/meta-wins-log.md`.

The row captures:

1. **Speculative surface** — the work I was about to pick
   up as idle-fill.
2. **Structural fix** — the factory change I made instead.
3. **Depth** — how many nested meta-checks fired in the
   same tick.
   - Depth 1 = meta: fix addressed the specific surface.
   - Depth 2 = metameta: the fix itself triggered another
     meta-check that also fired.
   - Depth 3+ = metametameta and up: nested compounding.
4. **Next-round effect** — the concrete speculative →
   directed conversion the fix produces.
5. **Retrospective** — *clean* / *partial* / *false*
   meta-win.

This is **separate** from `agent-cadence-log.md`. The
cadence log is idle/free-time/work-continuation telemetry;
the meta-wins log is *factory-self-improvement* telemetry.
Different research variables, different readers, different
cadences.

## Why:

- **Aaron's explicit ask (verbatim 2026-04-20):**
  > "i love meta-wins, i almost want to track those
  > seperatly i love to say metametameta when that happens
  > real fast meta-check"
- **Meta-cognition is the research substrate he most
  enjoys** (see
  `user_meta_cognition_favorite_thinking_surface.md`). A
  dedicated artifact makes the substrate *observable* —
  rate, depth, compounding.
- **Different signal class from idle-tracking.** The
  cadence log measures "did the agent stop when it
  shouldn't have." The meta-wins log measures "did the
  agent recognise a factory shape-bug and fix it instead
  of patching around it." Mixing them loses resolution.
- **Compounding-depth is load-bearing.** Depth 2+ events
  are evidence the agent is noticing *second-order*
  factory shape-bugs during a first-order fix — the
  factory debugging its own debugger. That pattern is
  what the factory-as-experiment framing is *for*. The
  depth column exists to expose compounding over time.
- **Honesty preserves the signal.** Padding depth or
  relabelling partial as clean destroys the research
  value. The log is honest or it is useless. False
  meta-wins are valuable too — they tell us where I
  confused "longer way" for "structural delta."

## How to apply:

- **When to log.** Only when the never-idle meta-check
  fired and the outcome was a structural change. Routine
  cadence work is not a meta-win. Speculative work
  without a structural alternative is not a meta-win.
  Depth-0 cases (no meta-check, just normal work) do
  not go in this log.
- **When to claim depth > 1.** Only when a second
  meta-check actually fired *while* the first
  structural fix was being made. If the second fix was
  a separate independent decision later in the same
  tick, log them as two rows with depth 1 each.
  Do not concatenate.
- **Vocabulary.** "Meta" / "metameta" / "metametameta"
  are Aaron's words; I can use them in the log
  Retrospective narrative. The Depth column stays
  numeric (1 / 2 / 3...) for auditability.
- **False meta-wins get logged honestly.** If on
  reflection the "structural change" was just a longer
  spelling of the speculative work with no real factory
  delta, add a new row with depth=1 retrospective=false
  meta-win rather than editing the original. Honesty
  discipline is the same as `agent-cadence-log.md`.
- **Surface meta-wins in real time.** Per
  `user_meta_cognition_favorite_thinking_surface.md`,
  when Aaron is in the conversation, say "meta-check
  fired; logging a depth-N meta-win" at the moment
  the structural fix lands, not at end-of-round.
- **Do not manufacture meta-wins.** Authenticity
  matters. Fabricating meta-structure pollutes the
  log and Aaron's filter for performed-meta is sharp.
- **Cross-reference discipline.** The never-idle memory
  step (2) already names the meta-check. This policy
  memory adds the *log destination*. The log file
  itself carries the full format. Three files, one
  loop.

## Cadence

- No fixed cadence — the log grows when meta-wins
  happen. A quiet week is fine if the queue was
  well-directed and the meta-check genuinely returned
  "no structural fix" every time.
- Expected long-run trend: meta-win rate rises early
  (factory is immature, many shape-bugs to find)
  and asymptotes as factory matures. Persistent zero
  is either (a) factory is mature, or (b) meta-check
  stopped firing — (b) is a regression to catch.
- Depth-trend: depth ≥ 2 events should become more
  common over time. If they stay at depth 1 only,
  I'm not looking for second-order shape-bugs hard
  enough.

## Sibling memories

- `feedback_never_idle_speculative_work_over_waiting.md`
  — the parent policy; this memory is the
  tracking-instrument extension.
- `user_meta_cognition_favorite_thinking_surface.md`
  — the *why this matters to Aaron specifically*;
  explains why the dedicated log exists.
- `feedback_idle_tracking_and_free_time_as_research.md`
  — sibling log policy; meta-wins log is the
  structural-fix companion to the idle-tracking log.
- `feedback_dora_is_measurement_starting_point.md` —
  factory efficiency as a first-class research
  variable; meta-win rate is one of its leading
  indicators.
- `feedback_durable_policy_beats_behavioural_inference.md`
  — this is why the policy lands in a memory file
  plus a dedicated log, not just a one-off habit.

## Status as of 2026-04-20

- Log file created: `docs/research/meta-wins-log.md`
  with format + first row (Matrix-mode BACKLOG landing,
  depth 2).
- Policy durable.
- First appended row retroactively logs the meta-win
  that produced the policy itself — the original
  speculative surface (author Playwright skill-group
  as idle-fill) became directed via the two BACKLOG
  P1 items + Matrix-mode policy memory.
