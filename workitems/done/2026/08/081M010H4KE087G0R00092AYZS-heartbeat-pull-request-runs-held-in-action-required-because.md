---
id: 081M010H4KE087G0R00092AYZS
type: bug
state: done
priority: P1
slug: heartbeat-pull-request-runs-held-in-action-required-because
title: "heartbeat pull_request runs held in action_required because the branch push uses GITHUB_TOKEN, making github-actions[bot] the run actor"
created: 2026-08-14T20:48:31.342Z
completed: 2026-08-15T22:47:57.014Z
depends_on: []
composes_with: []
---

# heartbeat pull_request runs held in action_required because the branch push uses GITHUB_TOKEN, making github-actions[bot] the run actor

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M010H4KE087G0R00092AYZS-*.md` glob. -->

**State:** diagnosed, no fix landed — the fix is a credential or a repo setting and both need
Aaron's sign-off. Full evidence:
`docs/research/2026-08-14-action-required-holds-are-a-push-credential-identity-problem-not-the-cancellation-root-cause.md`

**Independent of** `081M0104E7Y087G0R002X9A6NB` (the cancellation bug). Same observable —
a check that never ran, presented as one that did — different mechanism entirely.

## Symptom

Workflow runs on `heartbeat/*` PRs land in `action_required` and never execute. The required
`gate (required)` check therefore never reports, and an auto-merge-armed PR sits pending
forever while looking merely "in progress". 59 held runs across six PRs were cleared by hand
(oldest pending since #10346); 16 more accumulated on three newly created PRs (#10709,
#10710, #10711). It recurs on essentially every new heartbeat PR.

## Root cause

100% separation on one variable across 100 recent runs:

| event        | actor               | HELD | RAN |
| ------------ | ------------------- | ---- | --- |
| pull_request | AceHack             | 0    | 46  |
| pull_request | github-actions[bot] | 13   | 0   |

`agent-heartbeat.yml` checks out with no `token:` override, so
`git push --force-with-lease origin "heartbeat/$AGENT"` pushes as `github-actions[bot]`.
Repo and org both set `fork-pr-contributor-approval.approval_policy = first_time_contributors`,
under which a PR-event run actored by a non-contributor identity requires approval.

Natural experiment: `automation/pr-archive-*` is the same kind of bot automation but pushes
with `ZETA_PR_ARCHIVE_TOKEN` (a PAT) — actor AceHack, 0 held, 2 ran.

Refuted along the way: fork PRs (all same-repo), untrusted PR author (all AceHack/MEMBER/admin),
and unrecognised commit-author identity (the same `[bot]` identities appear on runs that ran —
commit author and run actor are different fields).

## Options (Aaron decides)

- **A (recommended)** — pass `token: ${{ secrets.ZETA_TELEMETRY_FLUSH_TOKEN }}` to the
  heartbeat checkout. No security setting changes. Tradeoff: PAT pushes trigger workflows
  where `GITHUB_TOKEN` does not, so recursion risk becomes real.
- **B** — loosen `approval_policy` to `first_time_contributors_new_to_github`. One API call,
  but weakens protection against genuine first-time fork contributors on a public repo to fix
  a problem our own push credential caused.

**Not recommended: an auto-approver.** Approving a run grants execution. Building a standing
execution-granting capability to work around a misconfigured credential leaves the defect in
place and permanently hides it.

## Resolution (2026-08-15)

Option A. Both checkouts in `agent-heartbeat.yml` persist credentials from
`ZETA_TELEMETRY_FLUSH_TOKEN` (same ladder as the flush/`gh pr create` step).
The workflow is schedule + workflow_dispatch only, so a PAT push does not
re-fire it.

`required-check-started.ts` is the non-vacuity: a heartbeat PR older than one
tick whose rollup has no `gate (required)` fails the flush job. "All present
checks are green" is no longer readable as healthy when the required one
never started.
