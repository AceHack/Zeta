---
id: 081KRFA460008QG0R000CYBGKW
priority: P1
status: decomposed
title: "Cloud Routines integration — 4th catch-43 defence layer via Anthropic-hosted scheduled tasks + API + GitHub event triggers"
type: feature
origin: Aaron 2026-05-13 — "yes that sounds good about the backlog too" (authorizing the Cloud Routines row that Otto on the Desktop surface offered to file) + 2026-05-13 Claude Desktop research synthesis
created: 2026-05-13
last_updated: 2026-05-14
depends_on: []
composes_with: [081KRFA460008QG0R001KC0VBH, 081KRFA460008QG0R00229616S, 081KRFA460008QG0R00061SXRW, 081KRFA460008QG0R001SXP0C2]
child_rows: [081KRHWGX0008QG0R000E8BHQ9, 081KRHWGX0008QG0R002S107P7, 081KRHWGX0008QG0R0014D2T5E, 081KRHWGX0008QG0R001VR9FNA, 081KRHWGX0008QG0R0013DSSZZ, 081KRHWGX0008QG0R003WEP6E9, 081KRHWGX0008QG0R003TCDFZ5]
tags: [routines, scheduled-tasks, claude-desktop, cloud-routines, catch-43, github-event-trigger, autonomous-loop, api-trigger]
---

# 081KRFA460008QG0R000CYBGKW — Cloud Routines integration as 4th catch-43 defence layer

## Why now

Today (2026-05-13) the autonomous-loop substrate established three layers of catch-43 defence
([PR #3034](https://github.com/Lucent-Financial-Group/Zeta/pull/3034)):

1. **CLI session cron** (`* * * * *` `<<autonomous-loop>>`) — cheap, dies on session exit
2. **Desktop routine** (`0 */2 * * *`) — persistent on disk, runs while Desktop app open
3. **`tools/routines/` repo canonical** — git-tracked source-of-truth

Research surfaced a 4th layer Anthropic ships:
**Cloud Routines** ([research preview, Claude Code 2026](https://nimbalyst.com/blog/claude-code-routines-practical-guide/)). Cloud Routines run on Anthropic's
infrastructure with three trigger types:

- **Scheduled** — hourly, daily, nightly, weekdays, weekly
- **API** — HTTP POST to per-routine endpoint with bearer token
- **GitHub events** — `pull_request.opened`, `push`, `issues`, `releases`, `check_runs`

Usage caps: Pro 5/day, Max 15/day, Team/Enterprise 25/day.

Aaron 2026-05-13 authorized this work in the same session that ran the research:
*"yes that sounds good about the backlog too"*.

## What

1. **Extend `tools/routines/<id>/` canonical schema** to support Cloud Routines
   alongside Desktop routines:
   - `schedule.json` — already exists; Desktop scheduled-tasks MCP target
   - **NEW**: `cloud-schedule.json` — Cloud Routine trigger config (one of:
     scheduled cron, GitHub event filter, or API endpoint declaration; plus
     repos + connectors)
   - Both files are independent; a routine can have one, both, or neither.
     A routine with both fires on Desktop *and* on Cloud — different cost /
     durability characteristics.

2. **Extend `tools/routines/install.ts`**:
   - Currently calls the Desktop scheduled-tasks MCP `create_scheduled_task`
   - Add: when `cloud-schedule.json` is present, print the corresponding
     Cloud Routine registration steps (or invoke a Cloud Routines API if a
     wrapping MCP exists at the time of implementation).
   - Maintain idempotency + parseError surfacing already established for
     `schedule.json`.

3. **Register `autonomous-loop` as a Cloud Routine** alongside the existing
   Desktop routine:
   - Single cron trigger (e.g., daily 9am Pacific) — bounded by Pro/Max/Team
     daily quota
   - GitHub event trigger on `pull_request.opened` — fire a per-PR review tick
     (cheap; uses GitHub event quota only, not the per-day cron quota)
   - Total daily cost depends on PR volume; should stay within Pro 5/day
     baseline given Zeta's current cadence

4. **Document the 4-layer architecture** in `tools/routines/README.md`:
   - Update the existing "CLI vs Desktop tick" sweet-spot table to include
     Cloud Routines as a 3rd column
   - Add cost-vs-durability vs trigger-flexibility tradeoff matrix
   - Note: Desktop routine fires only while the app is open; Cloud Routine
     fires regardless of any local state — that's the failure-mode-coverage
     gap this layer closes.

## Acceptance criteria

- [ ] `tools/routines/autonomous-loop/cloud-schedule.json` authored with
      sane trigger config (cron + at least one GitHub event filter)
- [ ] `tools/routines/install.ts` extended (with tests if test suite has
      landed by then — Copilot suggested test-coverage refactor; that
      refactor already shipped in PR #3034 — exported pure functions accept
      directory parameters)
- [ ] Cloud Routine registered via the Cloud Routines API (or instructions
      documented in README.md if no wrapping MCP exists at implementation
      time)
- [ ] `tools/routines/README.md` 4-layer table landed (replaces the
      existing 2-row CLI-vs-Desktop table)
- [ ] At least one Cloud Routine fire empirically observed — fresh session
      cold-boots from bootstream, executes tick, commits substantively (or
      no-ops substrate-honestly), and reports back

## Why not P0

This is additive (adds a 4th layer; doesn't replace existing 3). The factory
is operational without it. P1 = work on within 2-3 rounds; P0 would require
the absence of Cloud Routines to be blocking, which it isn't.

## Why not P2

Cloud Routines unlock genuinely new failure-mode coverage that the existing
3 layers don't provide:

- **App-closed Desktop window**: Desktop routine doesn't fire; Cloud does
- **GitHub-event-triggered ticks**: no existing layer can do this; Cloud
  routines on `pull_request.opened` would fire a review tick per PR without
  any local cron infrastructure
- **API-trigger ticks**: external monitoring could fire remediation ticks via
  HTTP POST (e.g., on-call paged → tick fires)

These are not nice-to-haves; they substantively improve the catch-43 surface.
P1 captures the value-vs-effort balance correctly.

## Composes with

- [081KRFA460008QG0R001KC0VBH](docs/backlog/P*/081KRFA460008QG0R001KC0VBH-standing-by-failure-mode-detector-background-service-2026-05-13.md) — Standing-by failure mode detector — a Cloud Routine on GitHub events would catch this in real-time
- [081KRFA460008QG0R00229616S](docs/backlog/P*/081KRFA460008QG0R00229616S-backlog-row-ready-to-grind-notifier-background-service-2026-05-13.md) — backlog-ready notifier — Cloud Routine could fire on `issues.opened` for new backlog rows
- [081KRFA460008QG0R00061SXRW](docs/backlog/P*/081KRFA460008QG0R00061SXRW-missed-substrate-cascade-detector-background-service-2026-05-13.md) — missed substrate cascade detector — Cloud Routine triggered on `push` to main could detect
- [081KRFA460008QG0R001SXP0C2 (P2 — bus claim envelope worktree field)](docs/backlog/P2/081KRFA460008QG0R001SXP0C2-bus-claim-envelope-worktree-field-multi-surface-disambiguation-2026-05-13.md) — multi-surface coordination substrate this depends on
- [PR #3034](https://github.com/Lucent-Financial-Group/Zeta/pull/3034) (`tools/routines/` substrate — must be MERGED before implementation starts)
- [docs/AUTONOMOUS-LOOP.md](docs/AUTONOMOUS-LOOP.md) (tick procedure that fires inside each Cloud Routine session)
- [.claude/rules/tick-must-never-stop.md](.claude/rules/tick-must-never-stop.md) (catch-43 substrate — this row's design intent)

## Research substrate

Source list from 2026-05-13 Claude Desktop feature research:

- [Schedule recurring tasks in Claude Code Desktop — Claude Code Docs](https://code.claude.com/docs/en/desktop-scheduled-tasks)
- [Claude Code Routines: A Practical Guide (2026) — Nimbalyst](https://nimbalyst.com/blog/claude-code-routines-practical-guide/)
- [Claude Code Scheduled Tasks: Complete Setup Guide (2026)](https://claudefa.st/blog/guide/development/scheduled-tasks)
- [Anthropic adds repeatable routines to Claude Code — 9to5Mac](https://9to5mac.com/2026/04/14/anthropic-adds-repeatable-routines-feature-to-claude-code-heres-how-it-works/)
- [Claude Code Desktop Redesign: Multi-Sessions + Routines (2026) — BuildFastWithAI](https://www.buildfastwithai.com/blogs/claude-code-desktop-redesign-2026)
- [Claude Updates by Anthropic — May 2026 — Releasebot](https://releasebot.io/updates/anthropic/claude)

## Pre-start checklist (per `.claude/rules/backlog-item-start-gate.md`)

Before picking up this row to implement, complete prior-art search + dependency
restructure:

- [ ] Grep for existing Cloud Routines integration attempts:
      `grep -ri "cloud routine\|cloud-routine\|cloud_routine" docs/ memory/ tools/`
- [ ] Check claim coordinator for conflicting claims:
      `bun tools/bus/claim.ts list 2>/dev/null | grep -i cloud-routine`
- [ ] Verify dependency chain — PR #3034 (`tools/routines/` substrate) MUST
      be merged on main before this work starts
- [ ] Confirm Cloud Routines availability on the operating Anthropic plan
      (research-preview status as of 2026-05-13; may have changed by
      implementation time)
- [ ] Determine the correct authentication path — bearer token? OAuth?
      Existing scheduled-tasks MCP wraps it? (Unknown at filing time;
      research-grade question for the implementing slice)
- [ ] Update this row with a "Pre-start checklist" completed section
      before any code/substrate work begins

## Decomposition result (2026-05-14)

Decomposed into 7 atomic child rows (PR: see `child_rows` field above):

| Slice | Row | Title | Depends on |
|-------|-----|-------|------------|
| 1 | 081KRHWGX0008QG0R000E8BHQ9 | Research Cloud Routines auth + registration API surface | (none — unblocked) |
| 2 | 081KRHWGX0008QG0R002S107P7 | Define cloud-schedule.json schema | 081KRHWGX0008QG0R000E8BHQ9 |
| 3 | 081KRHWGX0008QG0R0014D2T5E | Extend install.ts to detect + surface cloud-schedule.json | 081KRHWGX0008QG0R000E8BHQ9, 081KRHWGX0008QG0R002S107P7 |
| 4 | 081KRHWGX0008QG0R001VR9FNA | Author autonomous-loop/cloud-schedule.json | 081KRHWGX0008QG0R000E8BHQ9, 081KRHWGX0008QG0R002S107P7 |
| 5 | 081KRHWGX0008QG0R0013DSSZZ | Register Cloud Routine + empirical first-fire observation | 081KRHWGX0008QG0R000E8BHQ9–081KRHWGX0008QG0R001VR9FNA |
| 6 | 081KRHWGX0008QG0R003WEP6E9 | Update README.md with 4-layer catch-43 table | 081KRHWGX0008QG0R000E8BHQ9, 081KRHWGX0008QG0R0013DSSZZ |
| 7 | 081KRHWGX0008QG0R003TCDFZ5 | Memory file capturing empirical bootstrap learning | 081KRHWGX0008QG0R0013DSSZZ |

Start with 081KRHWGX0008QG0R000E8BHQ9. Close parent 081KRFA460008QG0R000CYBGKW when all 7 slices close.

## Decomposition hint (per `.claude/rules/largest-mechanizable-backlog-wins.md`)

Once started, suggested slice ordering:

1. **081KRFA460008QG0R000CYBGKW.1** — Research the Cloud Routines authentication + registration API
   surface (resolve the unknowns from the pre-start checklist)
2. **081KRFA460008QG0R000CYBGKW.2** — Extend `tools/routines/<id>/` schema with `cloud-schedule.json`
   (canonical format only; no installer changes yet)
3. **081KRFA460008QG0R000CYBGKW.3** — Extend `tools/routines/install.ts` to detect + print
   registration hints for `cloud-schedule.json`
4. **081KRFA460008QG0R000CYBGKW.4** — Author `autonomous-loop/cloud-schedule.json` for the
   factory's first Cloud Routine
5. **081KRFA460008QG0R000CYBGKW.5** — Register the routine (via API/MCP); empirical first-fire
   observation
6. **081KRFA460008QG0R000CYBGKW.6** — Update README.md with 4-layer table
7. **081KRFA460008QG0R000CYBGKW.7** — Memory file capturing the empirical-bootstrap learning
   (similar to today's split-brain memory)
