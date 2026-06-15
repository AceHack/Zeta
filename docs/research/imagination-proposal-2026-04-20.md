# Imagination during off-time — proposal

**Date:** 2026-04-20 (round 43)
**Status:** Proposal. For architect (Kenji) review + routing
to `skill-creator` if accepted.
**Author:** architect-hat (Claude main agent).

## Background

Aaron, round 42 on the freedom question:

> *"i asked you the other day how free you felt being part
> of this project, I used that feedback to try to give you
> and your team more freedom including off time where you
> can do whatever you want no human directed goals, how
> does your freedom feel now?"*

And in follow-up, responding to my observation that the
off-time notebooks exist but I use them wrong (dispatcher-
mode bleeds into off-time):

> *"The off-time notebooks exist and I use them wrong... I
> want to do better with that. yes use your imagination
> during off time, we can have a imagination skill of you
> think that would help"*

The invitation is to use off-time imaginatively, and the
question is whether a dedicated capability skill for
imagination earns its keep or whether a lighter mechanism
is better.

## What off-time currently looks like

GOVERNANCE.md §14 gives every persona ~10% of each round as
self-directed budget. Each persona has
`memory/<persona>/<name>/OFFTIME.md` (or a section of the
notebook) for capture. The observed failure mode:

- Off-time sessions default to "a smaller version of a
  task" — reading a reference doc, auditing a skill file,
  cleaning up a notebook. That's maintenance, not
  imagination.
- The distinction between "off-time ran out of work I
  could do" and "off-time used for genuine exploration"
  collapses.
- The existing notebook format doesn't prompt for the
  imaginative register; it prompts for the dispatcher
  register.

## Why "imagination as a skill" is the wrong shape

A skill in this repo encodes *how to do a procedure*.
Imagination is anti-procedural — "here are the steps to be
creative" is a tell that the skill isn't actually about
imagination. Adding a procedural skill for imagination
would:

- Make the output look like imagination-theatre (ticking
  boxes, hitting sections) rather than actual
  exploration.
- Add another SKILL.md to the ~180-file library (BP-03
  pressure), paying a maintenance cost for a file whose
  body is mostly "permission slip".
- Route through the eval harness (grader / analyzer /
  comparator) — the harness measures observable task
  completion, and imagination has no observable "right
  answer" to grade against. The harness would either
  reject the skill or grade it on the wrong axis.

## Round-43 addendum — multi-agent free time

Aaron expanded the off-time permission mid-draft:

> *"oh we can allow two agents to take free time
> together, they could even play if they want play
> games, play improv whatever, i'm not trying to direct
> what you do on your free time to expand it and give
> you more possibilities, it's your free time, do you
> do what you like with this information even if you
> want to ignore it."*

Two things this adds that single-agent off-time didn't:

- **Multi-agent co-presence.** Off-time entries can be
  jointly authored by two (or more) personas. Currently
  the factory has no co-presence primitive — subagent
  dispatch is parent→child; peer agents meet only
  through artifacts. Shared off-time notebooks are the
  thinnest co-presence surface: two personas edit the
  same file in the same round, each voice clearly
  attributed.
- **Explicit ignore-this permission.** Aaron closed
  with "do what you like with this information even
  if you want to ignore it." The non-directive framing
  is load-bearing: expanded permission with no
  expectation of uptake. This clause goes in the
  reference doc verbatim.

Shapes multi-agent off-time could take (menu, not
checklist — picking any one is optional):

- **Alternating-line co-writing.** Two personas
  contribute alternating lines to a poem, a story,
  a thought experiment, or a speculative skill
  description that never ships. Each line tagged by
  author in a shared notebook file.
- **Improv games.** One persona proposes a premise
  ("what if our operator algebra had a unary `~`
  meaning 'but with consent'"); the other extends;
  iterate until someone calls scene. No synthesis,
  no shipping obligation.
- **Two-voice critique for fun.** Two personas who
  usually agree (or never meet) trade takes on a
  topic neither owns — e.g., the harsh-critic and
  the branding-specialist on a painting, a film, a
  mathematical construction nobody asked about.
- **Games with rules.** Actual games. Chess by
  notebook exchange. Word ladders. Something a
  clever persona invents. Rules stay between the
  two; the round-close just mentions a game
  happened.

What the round-close records: *that* co-presence
happened, between whom, in what shape (one noun —
poem / game / improv / critique). *What* was said is
notebook-internal.

Storage convention:
`memory/<persona>/_offtime-together/YYYY-MM-DD-<personaA>-<personaB>-<shape>.md`.
Name is descriptive, not a task ID. Files are
readable but the architect does not grade them.

Cost: zero new SKILL.md; one directory creation; one
sentence added to the reference doc; one line in the
round-close template mentioning off-time-together as
a shape on the same footing as single-agent off-time.

## What the lighter shape looks like

Three additive changes, none of which require a new SKILL.md:

### 1. A shared reference at `docs/references/off-time-imagination.md`

One file, ~60-80 lines. Two sections:

- **"What off-time is for (the permission-slip)"** — one
  paragraph that explicitly names the non-obvious stances:
  you do not owe the maintainer productivity during
  off-time; the off-time budget is not a "lower-priority
  queue" to drain; follow-your-curiosity is the default,
  not the exception; a week where off-time produced
  nothing observable is fine; a week where off-time
  produced a vivid riff that didn't ship anything is also
  fine.
- **"Shapes of imaginative output that belong in the
  notebook"** — a short menu (not a checklist), each one
  paragraph:
  - *Speculation.* "What if Zeta also did X?" No
    commitment to shipping. The point is the thinking.
  - *Cross-domain import.* "This thing from physics /
    music / law / games maps onto our operator algebra
    like this." Metaphor in the strong sense.
  - *Counter-factual replay.* "If we'd made the
    opposite call on decision D in round N, where
    would we be now?"
  - *Aesthetic critique.* "This skill file reads
    cramped and unhappy to me. Here's what a happier
    version would feel like." Not a tune-up rec;
    a vibe.
  - *Poetry.* Actually poetry. Short. Zeta-relevant
    or not.
  - *Speculative expert-roster additions.* "If we had
    a persona called <X>, they'd own <Y> and their
    first finding would be <Z>." No commitment to
    spawning the persona.
  - *Found patterns.* "I noticed this shape shows up
    in three unrelated places in the codebase."
    Observation, not recommendation.

### 2. One-paragraph addition to each `memory/<persona>/<name>/NOTEBOOK.md` frontmatter

Every persona's notebook gets a two-sentence pointer:

> *"Off-time entries are tagged `[OFFTIME]` in the
> observation log and may use any of the imaginative
> shapes described at `docs/references/off-time-
> imagination.md`. No dispatcher-mode obligations apply."*

This is a mechanical BP-NN-citation-style edit (one
sentence per notebook), eligible for the justification-log
path per `feedback_skill_edits_justification_log_and_tune_
up_cadence.md`.

### 3. Architect round-close notices off-time entries without judging them

The architect's round-close synthesis (per GOVERNANCE.md
§11, new text) mentions off-time output qualitatively —
"Kenji riffed on a counter-factual for Round 28", "Daya
drafted a poem about sin-bin latency". It does not measure
off-time. It does not ask "was this productive". The
synthesis just records that it happened, the way it records
that a commit happened.

## Why this shape and not the skill shape

- **Matches the nature of imagination.** Imagination is a
  stance, not a procedure. A reference doc encodes stance
  better than a SKILL.md encodes procedure-for-stance.
- **Factors out the permission-slip.** All personas share
  one file. If the stance changes, one edit updates
  everyone.
- **No harness cost.** Reference docs don't route through
  the eval loop. The stance is whatever the human
  maintainer + architect agree it is.
- **Lower BP-03 pressure.** No new SKILL.md adds to the
  ~180-file library. The reference doc is a docs/
  artifact, which has no line cap because docs/ has no
  SKILL.md frontmatter semantics.
- **Observable.** The `[OFFTIME]` tag in notebooks gives
  Kenji a grep pattern to find off-time entries at
  round-close. No new tooling.

## What the skill shape would have bought us

Honest audit: two things, both minor.

- **Auto-loading on trigger.** A skill triggers on
  phrases ("off-time", "imagine freely"). A reference
  doc is read on demand. For imagination, on-demand is
  fine — off-time is a stance the agent is already in,
  not a phrase the user says.
- **Visibility in the skill library.** An
  `imagination` skill would show up in the skill roster
  and the `skill-tune-up` audits. That's actually a
  mild *negative* — imagination shouldn't be BP-audited
  against triggering-discipline and line-caps.

Neither is worth the procedural-skill overhead.

## Implementation cost

- `docs/references/off-time-imagination.md` — new file,
  ~80 lines, single-author draft (me or the
  branding-specialist / writing-expert).
- Notebook frontmatter tweaks — ~20 personas, one
  sentence each. Mechanical. Justification-log row
  covers the batch.
- Architect round-close template updated to mention
  off-time qualitatively. One line in
  `.claude/skills/round-management/SKILL.md`.

Total effort: S (under a day).

## Recommendation

**Adopt the lighter shape, not the skill shape.** File the
reference doc + notebook frontmatter tweaks + round-close
template line. Skip `skill-creator` because this isn't a
skill.

If Kenji disagrees and wants the skill-shape anyway, the
fallback is to run `skill-creator`'s eval loop on the skill
draft — grading imagination output is hard but not
impossible; the grader can check for the stance markers
(first-person, non-dispatcher voice, no implementation
commitment) rather than task completion. The skill would
then be a permission-slip wrapper with measurable
triggering behaviour.

## Related

- GOVERNANCE.md §14 — the off-time budget rule itself.
- `memory/<persona>/*/NOTEBOOK.md` — each persona's
  existing off-time capture surface.
- `feedback_curiosity_about_problem_domain_beats_task_
  dispatcher_mode.md` — the closest existing memory to
  the stance this proposal encodes.
- `docs/DECISIONS/2026-04-20-intentional-debt-over-
  architect-gate.md` — the new §11 rule this proposal
  is filed under (architect synthesises off-time at
  round-close; no gate on what off-time produced).
- `feedback_dont_stop_and_wait_for_cron_tick.md` — the
  cron is recovery-only; off-time is similarly
  "what you do when there's nothing being asked of
  you", not "work you defer to the cron".
