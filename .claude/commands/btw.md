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
     update the README"*). **Durability escalation is
     mandatory:** classify the lifetime of the nudge:
     - **Same-session only** (finish before session ends,
       ephemeral) → TodoWrite task OR `.btw-queue.md`
       (gitignored, session-scoped) is sufficient.
     - **Cross-session** (might persist past this session's
       context-compaction or into a fresh session) → MUST land
       in a **durable store**:
         - `docs/BACKLOG.md` row (committed; survives fresh
           sessions; visible to all agents via grep)
         - `memory/*.md` file (committed to the repo;
           readable by fresh sessions via git / grep per
           `memory/README.md` + GOVERNANCE §18). In-repo
           memory is the durable mirror; auto-loading
           behaviour depends on harness configuration and
           is NOT universally guaranteed — treat durability
           as "committed and discoverable" not
           "automatically materialised in context."
         - **MANDATORY pair when landing a new
           `memory/*.md`**: update `memory/MEMORY.md` with
           a pointer row in the same commit. Memory-index-
           integrity rule: a new memory file without a
           MEMORY.md row is effectively lost to fresh
           sessions (the index is how discoverability
           works).
       Both are durable across sessions. Pick per scope:
       BACKLOG for action-bearing work; memory for
       factory-discipline / preference / substrate.
     - **When in doubt, escalate to durable.** The cost of
       a stale BACKLOG row is tiny; the cost of a dropped
       nudge is compounding (maintainer 2026-04-24
       directive: *"crutial to not divert your attention"*
       — which only works if the nudges survive).
     - TodoWrite / `.btw-queue.md` alone are **NOT**
       sufficient for a cross-session nudge. They evaporate
       when the session ends.
   - **Correction** — maintainer is correcting the agent's
     direction on the current work (e.g. *"btw I meant X not Y"*).
     Apply the correction to the current work and acknowledge;
     do NOT treat as pivot.
   - **Substrate-add** — the aside is a memory-worthy fact,
     preference, or anecdote (e.g. *"btw my dog's name is
     Apollo"*). Two landing paths depending on how
     interruptive full absorption would be:
     - **Quick capture** (small fact, ≤5 min to file) →
       create the memory entry directly per the auto-memory
       protocol in CLAUDE.md; acknowledge filing.
     - **Deferred absorption** (larger substrate work —
       research, full memory-file drafting, or would
       require a dedicated PR) → **file a BACKLOG row
       capturing the observation + intent to absorb**, then
       continue. The BACKLOG row is itself durable; the
       full absorption happens later without derailing
       in-flight work (maintainer 2026-04-24 directive:
       *"it could be backlog the absorption if that's less
       interruptive"*; composes with Otto-275 log-but-
       dont-implement).
     - **When in doubt → BACKLOG the absorption.** Otto-275
       counterweight discipline: capture-mode pivoting on
       every aside is the drift we're guarding against.
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

**Directive-queued (same-session):**

```
/btw also fix the broken link in README when you're done
```

Agent: *"Queued README link fix (TodoWrite). Continuing."*

**Directive-queued (cross-session; durable escalation):**

```
/btw we need to evangelize this pattern to other maintainers
```

Agent: *"Filed as BACKLOG row (durable; survives fresh
sessions). Continuing."*

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
- Does NOT drop directive-queued items into session-scoped
  stores when the nudge needs cross-session durability (see
  durability-escalation rule in the directive-queued class).

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
