---
id: 081M1EKTVH7087G0R002XC3GCW
type: bug
state: done
priority: P2
slug: pr-archive-flush-lane-deadlocks-its-gate-runs-are-action-req
title: "PR-archive flush lane deadlocks: its gate runs are action_required, so gate (required) never publishes"
created: 2026-09-01T13:51:42.119Z
completed: 2026-09-09T20:45:00.000Z
depends_on: []
composes_with: []
---

# PR-archive flush lane deadlocks: its gate runs are action_required, so gate (required) never publishes

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to `workitems/done/YYYY/MM/`.
     Identity is the zetaid prefix — resolve cross-refs by `081M1EKTVH7087G0R002XC3GCW-*.md` glob. -->

## MEASURED 2026-09-01

`pr-gate-presence` (a scheduled check, not a PR check) refused on main:

> `required-check-started: no LIVE gate.yml run for #16228` (either none was created,
> or every run finished without publishing it) — `gate (required)` can never report on
> it. **Note that a bare `gh pr checks` reads this as green; `--required` does not.**

That parenthetical is the whole hazard: the deadlocked PR looks fine to the ordinary
command.

### Root cause

The gate run for #16228's head is `completed/action_required` with **0 jobs**. It was
created and never executed, so no job ever published `gate (required)`. Auto-merge is
armed against a check that cannot arrive.

### It is systemic, not a one-off

Of the last 60 `.github/workflows/gate.yml` runs, **7 are `action_required`, and every one is
`heartbeat/pr-archive`**, all with `actor=github-actions[bot]`. Roughly every 45
minutes the lane retries and deadlocks the same way.

### Why this one matters more than a stuck PR

The maintainer's stated position (2026-09-01): *"the pr responses and fixes are the
high quality data"* and *"pr archive is some of our most valuable data when it has
comments and corrections"*. This is the lane that lands exactly that.

## Remeasured 2026-09-09

Scheduled `pr-gate-presence` run 34401307762 on `main` @ `cf6de5aa5` failed:

> `required-check-started: no LIVE gate.yml run for #17145`

`#17145` (`heartbeat/pr-archive`, auto-merge squash armed by AceHack):

- Head `f412a8d0211f538c27616e163cd958aa97aef493`
- `.github/workflows/gate.yml` run 34394714180: `completed` / `action_required`, actor
  `github-actions[bot]`, 0 jobs
- Rollup: CodeQL + nuget only. Bare `gh pr checks` reads green.

The yaml comment on the flush step already assigned
`ZETA_TELEMETRY_FLUSH_TOKEN` to BRANCH-PUSH. Checkout still persisted
`GITHUB_TOKEN`. That is the comment-lie the TREATED-lane tests exist to catch,
and this lane was not in TREATED.

## Pre-start checklist

- Prior art: tick-metrics / society TREATED pattern in
  `src/Core.TypeScript/forge-host/github/flush-via-staging.test.ts`; role table
  `docs/security/2026-08-17-society-heartbeat-token-boundary-and-gate-start-failure.md`;
  work-item itself (options 1-2 still refused).
- Depends on: none. Token already exists and is the BRANCH-PUSH secret on the
  other treated lanes. This is option 3 as "wire the existing secret", not a new
  grant and not a workflow-approval relaxation.
- Option 1 (approve each run) and option 2 (relax approval) remain declined.

## Landed

Option 3, the already-ratified BRANCH-PUSH secret:

- `.github/workflows/pr-archive-on-merge.yml` asserts `ZETA_TELEMETRY_FLUSH_TOKEN`,
  checks out with it, and preflights `credprobe/pr-archive` the same way
  tick-metrics does.
- `ZETA_PR_ARCHIVE_TOKEN` stays the PR-create credential (`GH_TOKEN` on the
  flush step). No `||` ladder.
- Lane added to TREATED so a checkout that talks about the PAT but persists
  `GITHUB_TOKEN` cannot regress silently.
