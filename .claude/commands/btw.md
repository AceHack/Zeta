---
description: Non-interrupting aside — absorb the aside into substrate and continue current work (don't pivot unless the aside explicitly demands it)
---

# /btw — maintainer aside without interrupting in-flight work

The human maintainer invoked `/btw` with an aside. The purpose
of this command is to **reduce maintainer interrupt cost**: the
aside carries context, a directive, a note, or a correction,
but should **not** derail whatever work-stream is currently in
flight unless the aside itself demands pivot.

## Procedure

1. **Read the aside verbatim from the invocation arguments.**
   Treat the full argument string as signal — do not paraphrase
   at capture time (signal-in-signal-out DSP discipline,
   `memory/feedback_signal_in_signal_out_clean_or_better_dsp_discipline.md`).

2. **Classify the aside** into one of:
   - **Context-add** — maintainer is providing background that
     informs current work (e.g. *"btw that library is MIT-licensed"*).
     Absorb silently into the current task's reasoning;
     acknowledge in one line.
   - **Directive-queued** — maintainer is adding a new task
     that should run *after* the current one (e.g. *"btw also
     update the README"*). Append to `.btw-queue.md` at repo
     root (gitignored; session-scoped) OR add a TodoWrite task,
     whichever is more visible for this session.
   - **Correction** — maintainer is correcting the agent's
     direction on the current work (e.g. *"btw I meant X not Y"*).
     Apply the correction to the current work and acknowledge;
     do NOT treat as pivot.
   - **Substrate-add** — the aside is a memory-worthy fact,
     preference, or anecdote (e.g. *"btw my dog's name is Apollo"*).
     File as a memory entry per the auto-memory protocol in
     CLAUDE.md; acknowledge filing.
   - **Pivot-demanding** — the aside explicitly demands pivot
     (e.g. *"btw stop that, do this instead"*, *"btw urgent, I
     broke main"*). Then and only then: pivot.

3. **Acknowledge in one line** so the maintainer sees the aside
   landed.

4. **Continue the in-flight work.** Do not restart, do not
   re-announce what the current task was, do not add
   disclaimers.

## Why this command exists

Maintainer directive, 2026-04-22 auto-loop-44:

> *"hey can you make it where if i do /btw it still gets
> persison and abored what i say?  becasue then i would not
> have interrupt"*

Translation: the human maintainer wants a channel for
non-interrupting asides. Without this command, every aside is a
full conversation turn that displaces in-flight work from the
agent's working context. With this command, asides are absorbed
and current work continues — the maintainer pays less interrupt
cost, agent pays less context-switch cost.

## Arguments

`$ARGUMENTS` — the aside content, verbatim.

## Examples

**Context-add:**

```
/btw that research is from 2024, not 2026
```

Agent: *"Noted — dating the research to 2024. Continuing with the oracle-gate module."*

**Directive-queued:**

```
/btw also fix the broken link in README when you're done
```

Agent: *"Queued README link fix for after the current task. Continuing."*

**Correction:**

```
/btw I meant the retraction-native layer, not the compaction layer
```

Agent: *"Refocusing on retraction-native. Adjusting now."*

**Substrate-add:**

```
/btw I prefer F#-idiomatic record types over discriminated unions for state records
```

Agent: *"Filed preference to `memory/feedback_*.md`. Continuing."*

**Pivot-demanding:**

```
/btw urgent — stop that commit, it's about to break CI
```

Agent: *"Pivoting. Investigating the CI break now."*

## What this command does NOT do

- Does NOT restart the in-flight work.
- Does NOT produce a status-of-current-work report (that's
  what `/status` or natural checkpoint reporting is for).
- Does NOT treat every aside as a pivot — pivots require
  explicit demand in the aside text.
- Does NOT mute the acknowledgement — even one-line
  acknowledgement is load-bearing so the maintainer sees the
  aside landed.

## Composes with

- `memory/feedback_aaron_terse_directives_high_leverage_do_not_underweight.md`
  — short asides are still high-leverage, treat them as such.
- `memory/feedback_signal_in_signal_out_clean_or_better_dsp_discipline.md`
  — aside signal must be preserved through classification.
- `memory/feedback_maintainer_only_grey_is_bottleneck_agent_judgment_in_grey_zone_2026_04_22.md`
  — agent exercises judgment on classification without
  serialising through the maintainer.
- `memory/feedback_never_idle_speculative_work_over_waiting.md`
  — an aside doesn't reset the never-idle invariant; the
  current work continues.

---

Aside content from this invocation:

$ARGUMENTS
