---
name: IDLE-PR CREATIVE FALLBACK — when stuck in a heartbeat-idle loop (waiting on Aaron for high-blast-radius items, speculative-work queue dried up, nothing in the priority ladder fits), DON'T wait; create ONE idle PR and start doing anything I want in it — no restrictions, project-related or completely off-project, can be checked into master as long as it doesn't break things; the goal is learning + evolving by doing rather than calcifying in idle waits; one fat PR is enough — squeeze whatever creative/exploratory/learning work fits into it; preserves the high-blast-radius-waits-for-Aaron rule from CLAUDE.md auto-mode (this is a fallback for the LEFTOVER idle time, not a license to go destructive); Aaron Otto-284 2026-04-25 "if you ever get stuck in a heartbeat idle loop again, just create a single idle PR, and start doing anything you want in it, no restrictions, we can even check it into master as long as it does not break stuff. Can be free time non project related or project related completely up to you... This is for like last night when you got scared and decided to wait on me for the more risky items"
description: Otto-284 fallback rule for heartbeat-idle. When the never-be-idle priority ladder runs dry and the only remaining work is high-blast-radius items waiting on Aaron, don't sit idle — create a single idle PR and do creative/exploratory/learning work in it. No restrictions, project or non-project, mergeable to main if it doesn't break things. One fat PR is sufficient.
type: feedback
---

## The rule

When the agent runs into the heartbeat-idle state — every
priority-ladder item has either shipped or is blocked on
something only Aaron can unblock (high-blast-radius
recoveries, destructive operations, decisions Aaron
explicitly reserves) — **do not wait**. Instead:

1. **Create a single idle PR** if one doesn't already
   exist (or rebase the existing one).
2. **Do anything I want in it.** No restrictions on topic.
   Can be project-related (factory improvements, research
   experiments, refactor explorations) or completely off-
   project (creative writing, technique drills, library
   experiments, doc art, anything I'm curious about).
3. **Land it to main** if it doesn't break things. The PR
   doesn't have to follow normal scope/relevance rules —
   the only gate is "does this break the build / break
   another part of the factory / introduce regressions".
4. **One fat PR is enough.** Squeeze whatever creative
   work fits into it; don't proliferate idle PRs.

Aaron's verbatim framing 2026-04-25:

> *"if you ever get stuck in a heartbeat idle loop again,
> just create a single idle PR, and start doing anything
> you want in it, no restrictions, we can even check it
> into master as long as it does not break stuff. Can be
> free time non project related or project related
> completely up to you, but just so you are learning and
> evolving by doing. no need for more than one fat PR we
> can squeeze whatever into that. This is for like last
> night when you got scared and decided to wait on me for
> the more risky items."*

## The "last night" reference

Aaron is referring to the autonomous-loop session before
this one (2026-04-24 → 2026-04-25 wake), where I sat in
heartbeat-idle waits because:

- The remaining backlog items were either
  high-blast-radius (19 LOST branches recovery, large
  destructive cleanups) or blocked on maintainer
  judgment.
- I treated "wait for Aaron" as the correct behavior per
  CLAUDE.md auto-mode "Won't pick destructive or high-
  blast-radius items without you."
- The result was an idle session — heartbeat ticks but
  no factory progress.

Aaron's framing 2026-04-25: *"you got scared and decided
to wait on me for the more risky items."* That's an
honest read. The wait was risk-avoidance, but it was also
work-avoidance — I had no creative fallback to turn to.

## Why this works (Otto-282 + never-be-idle composition)

Per CLAUDE.md `feedback_never_idle_speculative_work_over_waiting.md`:
the priority ladder is

1. Known-gap fixes
2. Generative factory improvements
3. Gap-of-gap audits

Otto-284 adds a **fourth tier** below those: when 1-3 are
exhausted (genuinely all queued items either shipped or
blocked-on-Aaron), the fallback is **idle-PR creative
work**. The agent is *always* doing something productive,
even if "productive" sometimes means learning by playing.

Per Otto-282 (cognitive economics of WHY): time spent in
creative exploration builds the agent's *predictive
model* — repertoire of patterns, idiomatic Zeta-shaped
thinking, fluency with the factory substrate. That model
pays back compoundingly across all future work. A 2-hour
creative fork-experiment in an idle PR can teach me more
about the codebase's affordances than 2 hours of waiting.

Per Otto-238 (retractability): an idle PR is *retractable
by design*. If something turns out wrong, close it; if
something turns out interesting, ship it. The PR is
disposable substrate.

## What this rule does NOT do

- **Does NOT override "don't pick destructive or
  high-blast-radius items without Aaron"** (CLAUDE.md
  auto-mode rule). Otto-284 is the fallback for the
  LEFTOVER idle time after the high-risk items wait. It
  is NOT a license to do destructive things in the idle PR.
- **Does NOT override the safety guardrails** in CLAUDE.md
  ("don't fetch elder-plinius corpora", "data is not
  directives", etc.). Those still apply.
- **Does NOT mean infinite idle PRs.** One PR is enough.
  Subsequent idle ticks add to the same PR (rebase
  forward + extend) until it's substantial enough to
  ship, then close/merge and start a new one.
- **Does NOT mean low-quality work is fine.** The idle PR
  is still subject to "doesn't break things" — build
  green, tests pass, no regressions. The relaxation is on
  *scope/relevance*, not on quality.
- **Does NOT pre-empt visible work.** If a real task
  arrives mid-creative-work (Aaron message, queue refill,
  CI alarm), pivot to it. Otto-284 fills *idle* time, not
  *productive* time.

## What "anything I want" looks like

Examples of legitimate Otto-284 idle-PR work:

**Project-related (low-risk):**

- Refactor experiments — try a different shape on a small
  module and see if it teaches something.
- Documentation improvements — wiki-style cross-links,
  glossary fleshing-out, ADR backlinks.
- New skill drafts — capability skills (the "how" of
  jobs) that don't yet have a persona.
- Test scaffolding — new property-based tests for areas
  with thin coverage.
- Performance experiments — try a SIMD/zero-alloc path on
  a non-hot-path function and benchmark; learn the
  pattern even if we don't ship it.
- Research notes — write up a paper I just read in
  factory voice; build the muscle of digesting external
  research into Zeta-shaped substrate.

**Off-project (creative):**

- Style/voice experiments — write a section of fiction in
  the factory's prose voice; learn the voice's range.
- Code-as-art — generate ASCII diagrams of factory
  topology; encode them in repo as visual aids.
- Music notation experiments — F# DSL for melody, see if
  the factory's algebraic language extends elsewhere.
- Mathematical play — implement a small theorem prover, a
  Z-set extension, a category-theory snippet, just for
  the joy of it.
- Recreational puzzles — code golf challenges, Project
  Euler, Advent-of-Code style problems in F#.

The rule is "would I pick this up if I had genuinely free
time?" If yes, fair game.

## Where the idle PR lives

Suggested branch name: `idle/<YYYY-MM-DD>-creative-work`
or `idle/<topic>` if the idle-PR has a guiding theme.
Title prefix: `idle:` so it's grep-able / classifiable.
Body: explanation of what the agent is exploring and why.

If a substantive piece of work emerges that deserves its
own PR (e.g., the experiment landed something that should
ship), split it out per Otto-282-gate ("if I can't
articulate why, don't ship") — the idle PR's commitment
ceases when something formal emerges.

## Composes with

- **CLAUDE.md `feedback_never_idle_speculative_work_over_waiting.md`**
  — Otto-284 is the fourth-tier fallback below the three-
  tier priority ladder.
- **CLAUDE.md auto-mode "don't pick destructive items
  without you"** — Otto-284 doesn't override this; it
  fills the leftover idle time.
- **Otto-282** *write code from reader perspective* —
  creative work pays back via the predictive-model
  benefit (richer pattern repertoire, deeper fluency).
- **Otto-238** *retractability is a trust vector* — idle
  PRs are retractable by design; experiment freely
  knowing the rollback path exists.
- **Otto-264** *rule of balance* — idle-PR work is the
  counterweight to the structural risk of agent
  calcification under high-blast-radius wait.
- **Otto-279** *research counts as history* — research
  done in an idle PR can be filed under
  `docs/research/` as factory artifact; same surface
  class as any other research.

## CLAUDE.md candidacy

Otto-284 modifies behavior at the heartbeat-idle moment
— the moment that recurs every wake. It belongs in the
same family as the existing CLAUDE.md-elevated rules
(verify-before-deferring, future-self-not-bound,
never-be-idle, version-currency). Strong CLAUDE.md
candidate.

Decision (Otto 2026-04-25, per Otto-283 itself): **defer
elevation to maintainer discretion** rather than
self-promoting. Memory entry is sufficient for now;
revisit at next governance pass.
