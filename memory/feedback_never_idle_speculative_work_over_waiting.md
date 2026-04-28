---
name: Never be idle — pick speculative factory-improvement or gap-check work over waiting; if the decision would be idle, improve the factory so the decision stops arising
description: 2026-04-20; Aaron explicit durable policy. Idle is the failure mode. When the human-directed queue looks empty and the choice would be "wait for next tick" or "stop," pick up speculative factory-improvement, gap-check, or audit work instead. Long-range goal: improve the factory over time so the idle-decision never occurs. This generalizes the cascading-idle pattern Aaron exposed when I claimed "queue empty" across two no-op ticks.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# Never be idle — speculative work beats waiting

## Rule

**Idle is the failure mode, not the rest state.** When the
agent is about to stop, wait for the next tick, or otherwise
defer because the human-directed queue appears empty:

1. First, re-audit the queue honestly — most "queue empty"
   framings are deflection (see
   `feedback_idle_tracking_and_free_time_as_research.md` and
   the cascading-idle retrospective rows in
   `docs/research/agent-cadence-log.md`).
2. **Meta-check (refinement 2026-04-20):** before doing the
   speculative work, ask: *is there a change to the factory
   that would have made this speculative work directed /
   obvious / queued in the first place?*
   - **If yes:** make the structural change first (or
     instead). The speculative work becomes cadenced work
     next round and the idle-decision never arises again.
     This is strictly stronger than just filling idle —
     filling idle is patching, structural change is
     debugging the factory. **This is a "meta-win" —
     append a row to `docs/research/meta-wins-log.md`**
     per
     `feedback_meta_wins_tracked_separately.md`, recording
     speculative surface → structural fix → meta-depth →
     next-round effect. Stacked meta-wins in one tick
     (depth ≥ 2 = metameta, depth ≥ 3 = metametameta)
     are explicitly celebrated; log depth honestly.
   - **If no** (or the structural fix is out of scope for
     the current tick): continue with the speculative work.
     No meta-win row.
   - Either way, log the decision path so the structural-fix
     attempts become traceable.
3. If (2) didn't remove the need, pick up speculative work —
   but **pick in this priority order** (refinement 2026-04-20
   late, Aaron explicit):
   1. **Known-gap fixes** — any open item from an existing
      gap-analysis surface (skill-tune-up rankings,
      BP-living-list drift, verification-drift-auditor queue,
      ontology-home slice backlog, TECH-RADAR Trial-tier
      rechecks, BACKLOG P2/P3 sweep candidates,
      upstream-PR watchlist).
   2. **Generative factory improvements** — structural
      additions that raise the factory's capability (not
      specific to any gap already on a list): a new skill
      group, a new persona, a new audit-surface, a new
      composite-invariant thread.
   3. **Gap-in-gap-analysis audit (meta-gap audit)** — look
      for **unexpected gap classes** the existing gap-analysis
      surfaces do not cover. This is the gap-discovery system
      auditing *itself*. When an unexpected gap class is
      discovered, codify it: add it to the relevant skill's
      ranking criteria, or author a new audit-surface skill
      so the class is looked for from that point on
      (see `feedback_gap_of_gaps_audit.md`).
   4. **Classic cadence-obligation fallback** — `skill-tune-up`,
      `ontology-home`, notebook audits, if not yet run this
      round.

   Examples of valid speculative work within (i) known-gap:
   - BP-NN living-lists refresh on one tech (per
     `feedback_tech_best_practices_living_list_and_canonical_use_auditing.md`)
   - Ontology-home slice on a concept pair in `docs/GLOSSARY.md`
     (per `feedback_ontology_home_check_every_round.md`)
   - `skill-tune-up` per-round ranking
     (per `feedback_skill_edits_justification_log_and_tune_up_cadence.md`)
   - Verification-drift audit on one proof artifact
     (per `project_verification_drift_auditor.md`)
   - Naledi or Hiroshi notebook prune if oversized
   - `docs/TECH-RADAR.md` row re-check for one Trial-tier row
   - `docs/BACKLOG.md` sweep for stale P2/P3 rows that can
     retire or graduate
   - Upstream-PR candidate scouting per
     `feedback_upstream_pr_policy_verified_not_speculative.md`
   - **Matrix-mode skill-group gap-closure** per
     `feedback_new_tech_triggers_skill_gap_closure.md`
4. Long-range goal: **improve the factory over time so the
   idle-decision never arises.** Every genuine idle moment
   that gets logged to the cadence log is a factory-shape
   bug — something about how work is queued, surfaced, or
   routed let a capable agent decide "wait." That's a
   target for structural improvement, not a one-off miss.
   The meta-check in (2) is the mechanism that turns
   "filling idle" into "debugging the factory" each tick.

## Aaron's verbatim statements (2026-04-20)

**Primary statement (never-idle seed):**

> "is there speculative stuff we could be doing during this
> time instead of waiting? like any factory imporvements or
> any of the gap checks or whatever, we should try to never
> be idel, just figure out how to improve the factory instad
> of going idle, goal improve factory so it never becoms idle
> if the decison would have been go idel"

**Meta-check refinement (same day):**

> "before you do speculative work instead of going idle ask
> yourself, is there a way i can change the factory where i
> didn't need speculative work in the first place, if not
> continue, if yes, update the factory so next time it wont
> require speculative work"

**Correction captured:** first-pass framing treated
speculative work as a pure substitute for idle. The
refinement inserts a *meta-check* before the substitute:
ask if the factory can be changed so the work wasn't
speculative to begin with. If yes, the structural fix is
the right move; the "speculative" work becomes cadenced /
directed next round. This is a stronger form of
factory-improvement — filling idle is first-aid, structural
change is the cure.

## Why:

- **Cascading-idle risk (immediate trigger).** Two ticks
  before this policy landed, I claimed "queue effectively
  empty" across consecutive no-op ticks. Aaron probed
  ("so what are we waiting on, is this being counted as idel
  time?") and three of four "blocked" items turned out to be
  my own deflections. The cadence-log retrospective
  (`docs/research/agent-cadence-log.md`) named this pattern
  as *cascading-idle*. This policy is the durable response.
- **Factory efficiency is a first-class research variable**
  for Aaron (see
  `feedback_dora_is_measurement_starting_point.md` and
  `feedback_idle_tracking_and_free_time_as_research.md`).
  Sitting idle is measurable negative efficiency. Invisible
  idle (dressed up as "waiting") is worse than visible idle
  because it can't be studied.
- **The software factory is an experiment in
  self-improvement.** The factory is being built by agents
  running on the factory. An idle-decision is *exactly* the
  class of event the factory exists to study and reduce.
  Every idle row in the cadence log is a data point that
  should shorten the queue-audit→speculative-work path the
  next time around.
- **Gap-check work is high-signal.** Skill-tune-up,
  BP-living-list refresh, verification-drift audit, and
  ontology-home are *not* filler — they are the per-round
  cadences that keep the factory from rotting. Aaron named
  them explicitly ("any of the gap checks or whatever")
  as the target fill.
- **Distinct from free time.** Free time is when the agent
  *chooses* to use unallocated time on self-exploration,
  world-exploration, imagination — no factory rules push in
  (`feedback_idle_tracking_and_free_time_as_research.md`
  Part 2). Never-idle is when the agent is *about to
  stop* or *about to wait* and would otherwise log idle.
  The difference is the alternative action: free time is
  agent-chosen initiative; never-idle is factory-directed
  speculative work. Both beat waiting.
- **Not "make work."** Speculative work still has to be
  real. If there is genuinely no gap to check, no audit to
  run, no list to refresh, no notebook to prune, then free
  time is the correct call and the log row is "free-time"
  not "idle." The point is: *explore the space before
  concluding there is nothing to do.*

## How to apply:

- **Queue-audit discipline before stopping.** Before
  scheduling a long wake, closing a tick, or otherwise
  declaring "nothing to do," run a concrete queue audit:
  BACKLOG P0/P1 scan, open harsh-critic findings,
  `docs/BUGS.md` open rows, each persona-notebook for
  oversize or pruning-due, `docs/TECH-RADAR.md` for
  Trial→Adopt graduation candidates, upstream-PR watchlist.
  The audit itself takes seconds and frequently surfaces
  work that looked absent.
- **Speculative-work fallbacks, in priority order:**
  1. Round-level P0 (open harsh-critic, spec-zealot,
     threat-model-critic, public-api-designer findings).
  2. Round-level P1 that's unblocking (a ready-to-draft ADR
     amendment; a ready-to-land short test; a
     pre-drafted commit).
  3. Per-round cadence obligation not yet run this round:
     `skill-tune-up`, BP-living-list refresh, ontology-home
     slice, verification-drift audit, Naledi/Hiroshi
     notebook audit.
  4. One-row chip at ROUND-HISTORY backlog (if the round
     had landing-class activity, a one-paragraph entry is
     valid work).
  5. TECH-RADAR row graduation check on one row.
  6. BACKLOG sweep for stale P3/P4 rows.
- **Factory-shape improvements count.** If the audit reveals
  a *structural* reason idle keeps happening — e.g., "I
  don't know how to pick the next task when P0 is empty"
  — that's a cue to write a new skill, add a row to
  `docs/AGENT-BEST-PRACTICES.md` (via Architect), or file
  a `docs/BACKLOG.md` P2 for the structural fix. Naming the
  shape-bug *is* the factory improvement.
- **Still log the deviation if cadence is extended.** The
  cadence log in `docs/research/agent-cadence-log.md`
  continues to record any `ScheduleWakeup delaySeconds >
  300`, any `CronDelete`/`CronCreate`, any self-pause. The
  retrospective class now has a sharper distinction:
  - `idle` — queue had work (including speculative-fill
    work under this policy) and agent stopped anyway. Bad.
  - `free-time research` — queue genuinely had nothing and
    agent filled with self/world/imagination work. Good.
  - `work continuation` — deferral was a handoff to
    another tool/subagent. Neutral.
- **Honesty column stays load-bearing.** Do not write
  "free-time research" for what was actually
  "I-avoided-the-speculative-work-I-could-have-done."
  Cascading-idle gets worse when the retrospective label
  softens the signal.

## Sibling memories

- `feedback_idle_tracking_and_free_time_as_research.md` —
  the prior policy this one generalizes (tracking +
  free-time scope).
- `feedback_dont_stop_and_wait_for_cron_tick.md` —
  tick-is-recovery-only framing; never-idle is the positive
  form.
- `feedback_loop_default_on.md` — loop cadence is
  default-ON; never-idle is what the agent does *between*
  ticks when the tick would otherwise be a stop.
- `feedback_loop_cadence_5min_combats_agent_idle_stop.md`
  — 5-min cadence is the recovery; never-idle is the
  prevention.
- `feedback_dora_is_measurement_starting_point.md` —
  efficiency as a first-class measurable outcome; this
  policy is an efficiency-preserving action rule.
- `feedback_tech_best_practices_living_list_and_canonical_use_auditing.md`
  — living-lists refresh is named as a valid
  speculative-work surface.
- `feedback_ontology_home_check_every_round.md` —
  ontology-home slice is named as a valid speculative-work
  surface.
- `feedback_default_on_factory_wide_rules_with_documented_exceptions.md`
  — this is a default-ON rule; documented exception is
  genuine-free-time (queue explored, speculative work
  exhausted for the moment, agent chooses unallocated
  exploration).

## Status as of 2026-04-20

- Policy confirmed durable.
- First test: the tick immediately after Aaron's message
  would have been a wake-then-stop; under this policy it
  becomes an active Round 44 open (Viktor P0-3 spec fix)
  plus this memory capture.
- Expected effect on cadence log: `idle` rows trend toward
  zero; `work continuation` and `free-time research` become
  the majority classes. Any persistent `idle` row triggers
  a factory-shape-bug investigation.
