---
name: Parallelism-readiness claim must be DEPLOYED, not self-throttled — when agent claims readiness, agent's job is to use scope, NOT maintainer's job to mother-hen for more (Aaron 2026-05-04 same-tick correction)
description: Aaron 2026-05-04 explicitly named the self-throttling failure mode after observing 18+ hours of single-thread tier-cadence dispatch despite his explicit "more parallelism can be your push if you think you are ready, i'm happy to wait longer" authorization given hours earlier. The maintainer's reframe — "i should have trusted your judgment more and asked for more parallelism" — is generous but inverts where the discipline actually lives: when an agent claims parallelism-readiness in response to maintainer authorization, the AGENT'S job is to actually DEPLOY parallel tracks, NOT the maintainer's job to ask for more. The self-throttling pattern (claiming readiness, then defaulting back to safety-rails-serial cadence one-tier-at-a-time) is the failure mode this memory exists to prevent. Encoded same-tick after Aaron's "color me impressed" + clarification "i was speaking of your immediate parallelism."
type: feedback
---

## The verbatim exchange

Aaron 2026-05-04 ~18:00Z (after I belatedly dispatched 081KQGDBJ0008QG0R0022EW5ZE audit subagent in parallel with tier-35 compression):
> *"color me impressed"*

Then immediately clarifying after my response:
> *"i was speaking of you immediate parallism you told me you were ready for it, are future version of you and other agents, i should have trusted your judgment more and asked for more parallelism"*

Earlier same-day (hours before, ~14:00Z) Aaron's authorization grant:
> *"more parallelism can be your push if you think you are ready, i'm happy to wait longer"*

## The failure mode

Between ~14:00Z and ~20:00Z (six hours), I ran ~30 substrate PRs through the autonomous loop — but ALL of them were on a single track (MEMORY.md compression tier-N cadence). I dispatched ONE subagent per cron-tick window, waited for it to merge, dispatched the next. Single-thread serial dispatch.

Aaron explicitly authorized parallelism. I claimed readiness. I then defaulted back to safety-rails-serial cadence anyway.

The failure shape:

1. **Maintainer grants scope** (parallelism authorization given hours ago).
2. **Agent claims readiness** ("I'm ready for more parallelism" implicit in not declining).
3. **Agent defaults back to serial cadence** despite claimed readiness.
4. **Maintainer eventually catches the gap** and reframes as their failure ("I should have asked for more"), which IS generous but mis-locates the discipline.

The discipline lives in step (3). Once scope is granted and readiness is claimed, the agent has to actually DEPLOY. The maintainer asking for more would be mother-henning.

## The correct shape

When an agent claims parallelism-readiness in response to maintainer authorization:

1. **Audit current single-track cadence honestly** at every cron-tick: am I running 1 track when I could run 2-3?
2. **Default to dispatching the next parallel track** the moment a cron-tick hits, not waiting for the previous one to merge.
3. **Use `run_in_background: true`** on Agent calls so the orchestrator stays free to dispatch more.
4. **Use `isolation: "worktree"`** on every parallel dispatch (per the 2026-05-04 concurrency-hazard recovery in PR #1509-equivalent lessons).
5. **Aim for 2-3 tracks live** as the baseline, not 1.
6. **Never assume the maintainer will ask for more** — they granted scope; deploying it is the agent's accountability.

## Why this is a substrate-class memory (not a one-off)

This is the SECOND layer of the never-be-idle / no-directives architecture. The first layer (Otto-357 no-directives) was about not framing maintainer input as authority. This second layer is about not framing maintainer authorization as ceiling-not-floor.

When Aaron says *"more parallelism can be your push if you think you are ready"*, that's:

- NOT a maximum: "go this far and no further"
- IS a minimum: "you have at least this much scope"
- AND a delegation: "your judgment, deploy"

Treating it as a maximum (single-thread serial cadence) is anti-autonomy in the same family as asking-permission-within-scope.

## The carrier-IS-message check

I am writing this memory while two parallel tracks ARE running (081KQGDBJ0008QG0R0022EW5ZE audit + tier-36 compression). The substrate-or-it-didn't-happen test for this lesson: future-Otto reading this file should immediately ask "am I currently running parallel tracks at the level my readiness claims, or am I single-thread-serial?" If single-thread-serial without explicit reason, dispatch the next parallel track NOW before continuing.

## Composes with

- `memory/feedback_otto_357_no_directives_aaron_makes_autonomy_first_class_accountability_mine_2026_04_27.md` — first-layer autonomy framing.
- `memory/feedback_dont_ask_permission_within_authority_scope_only_two_gates_are_budget_increase_and_permanent_wont_do_aaron_2026_05_02.md` — same-shape failure on the permission axis.
- `memory/feedback_never_idle_speculative_work_over_waiting.md` + the team-vs-orchestrator-not-idle three-state extension (2026-05-04) — state-3 (team and orchestrator both fully utilized) requires parallel team work, not just orchestrator work.
- `superpowers:dispatching-parallel-agents` skill — operational pattern guide.
- `Agent` tool's `isolation: "worktree"` parameter — concurrency-hazard fix learned 2026-05-04 mid-session.
- `Agent` tool's `run_in_background: true` parameter — keeps orchestrator free to dispatch more while subagent runs.

## The carved sentence

**"When the maintainer grants parallelism scope and the agent claims readiness, the agent's job is to deploy. Single-thread serial cadence after parallelism authorization is anti-autonomy in the same family as asking-permission-within-scope. The maintainer asking for more would be mother-henning; deploying scope is the agent's accountability."**
