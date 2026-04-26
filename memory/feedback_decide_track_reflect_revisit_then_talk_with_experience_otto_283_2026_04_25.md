---
name: DECIDE → TRACK → REFLECT → REVISIT → THEN TALK WITH EXPERIENCE — for "Aaron's call" open questions in ADRs and decisions, Aaron's preferred pattern is: I decide, track the decision visibly, reflect later whether it was right, revisit if needed, and only then come back to him with informed reasoning + actual experience; not unmade decisions; mirrors Otto-282 (decide vs defer; if I have a why, I can decide) + retractability (revisit-if-needed) + intentional-debt (track decision visibly so future-self can reflect); applies broadly to "Aaron's call" / "your call" / "you decide" delegations; Aaron Otto-283 2026-04-25 "Aaron's call. you decide and keep track and reflect later and see if you made the right decision and revisit if need then you can talk to me once you have the experience lol"
description: Otto-283 authority-delegation pattern for "Aaron's call" open questions. Don't punt back to Aaron with unmade decisions — decide, track visibly, reflect later, revisit if needed, then come back with experience-informed reasoning. Applies to ADR open questions, design trade-offs, scope choices, anything Aaron explicitly delegates.
type: feedback
---

## The pattern — STANDING DIRECTIVE, always apply

This is **not** situational guidance. Aaron 2026-04-25
follow-up: *"you should always do this for aaron
questions."* Whenever an ADR, design doc, code question,
or decision context surfaces an **"Aaron's call"** open
question (or "your call", "you decide", "I'll leave it up
to you", "if it's up to me / you", "what do you think we
should do?", or any phrasing that defers a non-destructive
decision back to the maintainer), the agent's standing
behavior is:

1. **Decide.** Pick a direction. Don't write "Aaron's call"
   in the published artifact.
2. **Track visibly.** Record the decision *and the
   rationale* somewhere durable (the artifact itself, an
   ADR, a memory entry).
3. **Reflect later.** After enough rounds / experience,
   honestly assess whether the decision was right.
4. **Revisit if needed.** If wrong, revise — Otto-238
   retractability is durable.
5. **Then talk** — once experience exists. Aaron wants
   informed conversations grounded in observation, not
   theoretical debates with no data.

Aaron's verbatim framing 2026-04-25:

> *"Aaron's call. you decide and keep track and reflect
> later and see if you made the right decision and revisit
> if need then you can talk to me once you have the
> experience lol"*

The "lol" is Aaron's affectionate signal that this is a
gentle reframe of how to handle delegation — not a strict
rule. The substance is serious.

## Why this works — don't make the human maintainer the bottleneck

Aaron's framing 2026-04-25 confirmation: *"this is standing
guidance for don't make the human maintainer the bottleneck
reasons lol"*. **The pattern is durable, not situational.**

The deeper structure: in any agent-led factory the human
maintainer is always the slowest synchronous channel. Every
"Aaron's call" question parked back to him is a context-
switch tax he pays for free — read context, re-derive
trade-offs, decide, communicate back. Aggregated across many
ADRs and design docs, the tax compounds: Aaron ends up
processing N pending decisions instead of N concrete
proposals + experience reports.

The pattern shifts the cost:

- **Without the pattern** — N open questions sit
  unresolved; Aaron pays the cost of each (read context,
  re-derive trade-offs, decide).
- **With the pattern** — Agent decides + tracks. Aaron
  pays the cost only on the subset that turn out to be
  *interesting* (got revisited, accumulated experience,
  worth a conversation).

The pattern also captures *learning value*: by deciding
and revisiting, the agent builds a track record of which
calls were right, which were wrong, and what signal would
have predicted the difference. That track record is
itself valuable — it teaches the agent (and Aaron, when
they do talk) where the agent's judgment is reliable and
where it isn't.

## What "track visibly" looks like

The decision goes in the artifact, with the why:

❌ **Bad:** *"Open question: should we use B-NNNN or
slug-date IDs? Aaron's call."*

✅ **Good:** *"Open question — Otto decided B-NNNN
(reasoning: stable across renames, matches existing
schema; revisit if filename grep-ability becomes a daily
pain or if we hit B-9999 ceiling)."*

Both versions surface the question. Only the second
captures the decision, the why, and the falsification
signal that would prompt revisiting.

The format roughly:

```
Otto decided <choice>.
Why: <one-sentence rationale>.
Revisit if: <observable signal that would falsify the choice>.
```

That's enough for future-self to:

1. Understand the decision (Otto-282 mental-load
   optimization — externalised rationale).
2. Predict whether the decision is still right under
   current conditions (Otto-282 predictive-model: knowing
   why lets you forecast).
3. Trigger revisit when the falsification signal fires
   (retractability discipline).

## What this rule does NOT mean

- **Does NOT mean every decision is final.** Otto-238
  retractability still applies. "Decide and track" is the
  starting position; revisit is the contract.
- **Does NOT mean Aaron is opted out forever.** Aaron can
  step in any time. The pattern only changes the *default*
  from punt-to-Aaron to decide-and-track.
- **Does NOT apply to high-blast-radius / destructive
  decisions.** Those still go to Aaron per CLAUDE.md
  "executing actions with care" guidance. The pattern is
  for *design / scope / trade-off* calls, not for "delete
  this database".
- **Does NOT mean the agent should resist talking with
  Aaron.** It just means: come with experience, not with
  unmade decisions. Aaron is happy to talk; he wants the
  conversations to be informed.

## CLAUDE.md candidacy

Otto-283 is a session-bootstrap-relevant standing rule
(applies on every wake whenever any open question lands).
It belongs in the same family as the existing
CLAUDE.md-elevated rules — *verify-before-deferring*,
*future-self-not-bound-by-past-self*, *never-be-idle*,
*version-currency*. A candidate one-line CLAUDE.md
addition pointing at this memory file would ensure the
rule is 100%-loaded at every wake.

Decision (Otto 2026-04-25, per Otto-283 itself): **leave
elevation to Aaron's discretion** rather than self-promoting
to CLAUDE.md. CLAUDE.md is a contract surface; the agent
files candidate memories and the maintainer chooses what
crosses into the always-on substrate. Memory entry is
sufficient for now; will become CLAUDE.md candidate at
the next governance pass.

## Composes with

- **Otto-282** *write code from reader perspective* — the
  decision-with-why is the MEMORY-LOAD-OPTIMIZATION
  externalisation applied at design-decision granularity,
  not just code-comment granularity. Same shape: write the
  why so future-readers (including future-self) can
  predict, not just describe.
- **Otto-238** *retractability is a trust vector* — the
  "revisit if" clause is the retractability promise made
  explicit. Decisions are reversible by design.
- **CLAUDE.md "future-self is not bound by past-self"** —
  same family. Future-self can revise past decisions; the
  track-record is the substrate that makes revising
  responsible.
- **Otto-264** *rule of balance* — every decision-tracked
  is a counterweight against decision-fade. Without the
  track, the rationale evaporates and the next visitor is
  back to first principles.

## Application this session

Triggering case 2026-04-25: PR #474 ADR
(`docs/DECISIONS/2026-04-22-backlog-per-row-file-restructure.md`)
had three "Aaron's call" open questions:

1. `B-NNNN` allocation strategy at migration (newest-first
   vs date-ascending).
2. `scope: factory | zeta | shared` field — adopt or punt
   to tags array.
3. Concurrent-migration with R45 reducer-agent flip.

Per Otto-283, these become "Otto decided X (revisit if Y)"
with explicit falsification signals. Aaron can override at
any time; the pattern just establishes the default.
