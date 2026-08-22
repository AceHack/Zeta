---
id: 081M05E28P5087G0R003JAXC2W
type: bug
state: backlog
priority: P2
slug: github-settings-drift-reports-success-on-every-run-while-det
title: "github-settings-drift reports success on every run while detecting real drift (continue-on-error masks exit 1)"
created: 2026-08-16T14:02:01.797Z
depends_on: []
composes_with: []
---

# github-settings-drift reports success on every run while detecting real drift (continue-on-error masks exit 1)

**Policy call for Aaron — deliberately NOT changed by the shadow.** Making this
detector block turns a currently-green lane red, which is a workflow-enforcement
decision, not a defect fix. What follows is the evidence, so the decision is made
against measurements rather than against a description.

## What was demonstrated (not inferred)

`.github/workflows/github-settings-drift.yml` sets `continue-on-error: true` at the
**job** level. The detector runs, finds drift, exits 1 — and the run concludes
`success`. Every run in the visible history:

| run | date | step outcome | run conclusion |
|---|---|---|---|
| 28802851956 | 2026-07-06 | `DRIFT DETECTED` → `exit code 1` | **success** |
| 29267501583 | 2026-07-13 | `DRIFT DETECTED` → `exit code 1` | **success** |
| 30285219271 | 2026-07-27 | `DRIFT DETECTED` → `exit code 1` | **success** |
| 30833144231 | 2026-08-03 | `DRIFT DETECTED` → `exit code 1` | **success** |
| 31402510532 | 2026-08-10 | diff printed → `exit code 1` | **success** |

Pulled with `gh run view <id> --log`. The 2026-08-10 run names the concrete drift:

```
   "pages": {
-    "build_type": "legacy",
+    "build_type": "workflow",
```

So this is not a hypothetical vacuity: **real, named, unremediated drift has been
reported green for at least six weeks**, and `gh run list` shows a 100% success rate
that carries no information about whether drift exists.

## Why this is a policy call and not simply a bug

The workflow header explicitly declares the advisory posture:

> ADVISORY (ISociety observe lane): reports drift for community review and alerts —
> not a merge gate.

That is a legitimate choice and the shadow does not overrule it. Deciding a detector
should start blocking is Aaron's, per the no-directives standing-authority split
(inherit authority, never extend it into a gated class).

## But one thing in the file is internally contradictory regardless of the policy

The `pull_request:` trigger carries this stated purpose:

> so a PR that updates expected gets an immediate green signal that the snapshot
> matches reality at merge time

Job-level `continue-on-error: true` makes that signal **impossible**: the job is green
whether the snapshot matches or not. Whatever is decided about the weekly cron lane,
the PR lane currently promises a confirmation it cannot deliver — a PR that updates
`github-settings.expected.json` incorrectly gets the same green as one that gets it
right. This half looks like an oversight rather than a chosen posture, because a
deliberately-advisory check would not advertise a merge-time confirmation.

## Options (Aaron decides)

1. **Leave fully advisory** — then delete or reword the PR-trigger comment so it stops
   claiming a green signal means "snapshot matches reality", and route the alert
   somewhere a human actually reads (the current design has no reader).
2. **Split the lanes** — keep the weekly cron advisory (`continue-on-error`), drop
   `continue-on-error` on the `pull_request` lane only. Blast radius is confined to PRs
   that touch the snapshot/detector files, which is exactly the set the comment
   describes. This satisfies the stated intent at the lowest cost.
3. **Block outright** — remove `continue-on-error`. Note the prerequisite: the header
   documents that admin-only endpoints return 403 under `GITHUB_TOKEN` and need a
   `DRIFT_DETECTOR_PAT`. Blocking before that is configured would fail on token scope
   rather than on drift — trading a check that cannot fail for one that cannot pass.

Whichever is chosen, the `pages.build_type` drift above is real and wants either a
snapshot refresh or a revert in the GitHub UI.

## Anchors

- `.claude/rules/toy-is-free-metered-must-be-earned.md` — a detector with no falsifier
  is `unmetered`; `continue-on-error` removes the falsifier from a detector that has one.
- `docs/GITHUB-SETTINGS.md`, `docs/FACTORY-HYGIENE.md` row #40 — the detector's home.
- 081KQ8P5D0008QG0R000JHD7AB — the earlier `administration: read` / PAT thread this
  depends on for option 3.
