# Autonomous-loop per-tick discipline lives at `docs/AUTONOMOUS-LOOP-PER-TICK.md`

Carved sentence:

> The 7-step per-tick discipline (refresh → holding-discipline → pick
> work → verify → shard → cron-check → visibility-stop) is canonical
> at `docs/AUTONOMOUS-LOOP-PER-TICK.md`. All three Otto surfaces
> (CLI sentinel, Desktop routine, B-0448 cloud routine) cite that one
> file. When the discipline updates, all three surfaces inherit at
> next cold-boot. Do NOT re-encode the 7 steps locally; cite the
> canonical.

## Operational content

The per-tick discipline that fires on every `<<autonomous-loop>>`
cron tick is canonicalized at [`docs/AUTONOMOUS-LOOP-PER-TICK.md`](../../docs/AUTONOMOUS-LOOP-PER-TICK.md).

Before this canonicalization, the discipline existed in 3 divergent
forms:

| Surface | Where | Drift risk |
|---------|-------|------------|
| Otto-CLI | Ambient `.claude/rules/*` + CLAUDE.md | Auto-loaded; no drift |
| Otto-Desktop | Inline prompt in `tools/routines/autonomous-loop/SKILL.md` | Required manual sync |
| B-0448 cloud | TBD (queued) | Would have re-implemented |

The canonical file is the one-source-of-truth. This rule auto-loads
at every fresh Otto cold-boot so future-Otto knows to consult the
canonical file rather than re-deriving the discipline.

## What to do when the discipline evolves

When a new rule lands that affects per-tick behavior (e.g.,
`holding-without-named-dependency-is-standing-by-failure.md` did
this on 2026-05-13):

1. **Land the rule** at `.claude/rules/<name>.md` (auto-loaded; CLI
   picks it up immediately at cold-boot)
2. **Update the canonical** `docs/AUTONOMOUS-LOOP-PER-TICK.md` to
   reference the new rule in the appropriate step
3. **Desktop routine inherits automatically** at next fresh-session
   cold-boot (the routine cites the canonical file)
4. **B-0448 cloud routine inherits automatically** when it ships
   (will cite the canonical file the same way)

Do NOT update the per-tick discipline in the routine's SKILL.md
inline body — that's the divergence pattern this rule prevents.

## Why this rule auto-loads

Per `.claude/rules/wake-time-substrate.md`: load-bearing methodology
needs wake-time landing. The 3-surface coordination is operationally
load-bearing because:

- Future-Otto at cold-boot must know where the canonical lives
- Without this rule, future-Otto might re-implement the discipline
  in a new surface-specific way (recreating the drift problem)
- The router-as-substrate-inventory discipline applies: check the
  canonical FIRST, only mint new discipline if the canonical doesn't
  cover the case

## Composes with

- [`.claude/rules/wake-time-substrate.md`](wake-time-substrate.md)
- [`.claude/rules/skill-router-as-substrate-inventory.md`](skill-router-as-substrate-inventory.md)
- [`.claude/rules/tick-must-never-stop.md`](tick-must-never-stop.md)
- [`.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`](holding-without-named-dependency-is-standing-by-failure.md)
- [`.claude/rules/never-be-idle.md`](never-be-idle.md)
- [`.claude/rules/refresh-before-decide.md`](refresh-before-decide.md)
- [`.claude/rules/substrate-or-it-didnt-happen.md`](substrate-or-it-didnt-happen.md)
- B-0448 (Cloud Routines integration — 4th catch-43 defence layer)
- PR #3034 (Otto-Desktop routines substrate)

## Full reasoning

The human maintainer 2026-05-13 22:08Z: *"and yall both share the background loop right?
any changes you need to make to it so it's more like the routines and
like a 3 coordinated version?"*

The proposal that emerged: factor Part 5 of the canonical bootstream
(the cron/loop substrate) into its own pointer file all three surfaces
cite. This rule + the canonical pointer file are the substrate-level
realization of that proposal.
