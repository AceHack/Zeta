---
pr_number: 5079
title: "fix(persona/max): 3 post-merge accuracy fixes from #5078 Copilot review"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T03:44:00Z"
merged_at: "2026-05-26T03:51:33Z"
closed_at: "2026-05-26T03:51:33Z"
head_ref: "otto-cli/max-starting-point-accuracy-fixes-2026-05-25"
base_ref: "main"
archived_at: "2026-05-27T19:44:48Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5079: fix(persona/max): 3 post-merge accuracy fixes from #5078 Copilot review

## PR description

## Summary

Three small post-merge Copilot findings on PR #5078's "Otto + the foreground autonomous-loop tick" section in `memory/max/STARTING-POINT.md` — fixed against the canonical sources.

## Findings + fixes

| Thread | Finding | Fix |
|---|---|---|
| PRRT_kwDOSF9kNM6ErIjO | Per-tick flow summary dropped the `commit` step from the canonical six-step checklist | Now reads "speculative work → verify → **commit** → write tick shard → CronList → visibility-signal stop" per `.claude/rules/tick-must-never-stop.md` |
| PRRT_kwDOSF9kNM6ErIjp | Commit trailer specified as `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` was too specific | Reworded to the AGENTS.md baseline `Co-Authored-By: Claude <noreply@anthropic.com>` (model/version suffix optional but baseline required) + cross-link AGENTS.md |
| PRRT_kwDOSF9kNM6ErIj7 | `/loop` recommendation was misleading — `docs/AUTONOMOUS-LOOP.md` explicitly says the factory wires `CronCreate` directly, not `/loop` | Reworded to "Cadence adjustment is via `CronDelete` + `CronCreate` with a new cron expression" + cross-link AUTONOMOUS-LOOP.md naming `/loop` as not the factory's invocation path |

Also adopted the corrected commit trailer (`Co-Authored-By: Claude <noreply@anthropic.com>`) on this commit going forward.

## Test plan

- [x] markdownlint clean
- [x] All 3 findings addressed against the cited canonical sources
- [ ] CI passes (gate workflow + CodeQL)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T03:46:29Z)

## Pull request overview

This PR updates Max’s onboarding starting point to align the “Otto + foreground autonomous-loop tick” section with the repo’s canonical autonomous-loop sources (tick checklist, commit attribution trailer, and cadence adjustment mechanism).

**Changes:**

- Restores the canonical 6-step end-of-tick checklist (including the **commit** step) and cites the canonical tick-shard path.
- Updates commit attribution guidance to the baseline required `Co-Authored-By: Claude <noreply@anthropic.com>` trailer per `AGENTS.md`.
- Rewords cadence adjustment guidance to use `CronDelete` + `CronCreate` (and clarifies `/loop` is not the factory invocation path per `docs/AUTONOMOUS-LOOP.md`).

## Review threads

### Thread 1: memory/max/STARTING-POINT.md:138 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T03:46:28Z):

P1 (documentation accuracy): This says each cron fire “enters the autonomous-loop skill”, but the CLI mechanism is the `<<autonomous-loop>>` sentinel / per-tick discipline (no `.claude/skills/autonomous-loop` exists). Consider rewording to avoid implying there is a Skill artifact and instead reference the sentinel firing + applying the per-tick discipline.

### Thread 2: memory/max/STARTING-POINT.md:152 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T03:46:29Z):

P2 (consistency): This parenthetical says `/loop` “is not the factory's invocation path” (per docs/AUTONOMOUS-LOOP.md), but `.claude/rules/tick-must-never-stop.md` still frames the tick as running under “`/loop` autonomous mode”. Since this section links both docs, consider clarifying that “/loop” is historical/user-facing naming while the factory’s actual tick arming is via `CronCreate`, to avoid readers interpreting the sources as contradictory.
