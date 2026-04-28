---
id: B-0087
priority: P1
status: open
title: github-settings-drift.yml has been broken since PR #45 — declares invalid GHA permission `administration: read`
tier: factory-tooling
effort: S
ask: autonomous-loop tick discovery 2026-04-28T20:05Z (workflow-null-result audit class first concrete catch)
created: 2026-04-28
last_updated: 2026-04-28
composes_with:
  - B-0085
tags: [otto-2026-04-28, github-actions, workflow-startup-failure, invalid-permission, drift-detector-broken, factory-hygiene]
---

# B-0087 — github-settings-drift.yml broken since PR #45

## Discovery

Per the **Workflow Null-Result Audit Signal** class memory
(`memory/feedback_incomplete_source_set_regeneration_hazard_and_workflow_null_result_audit_amara_2026_04_28.md`):
applied the six-question diagnostic checklist to
`.github/workflows/github-settings-drift.yml`, which the
budget snapshot (snapshots.jsonl 2026-04-26 entries) has shown
failing on every recent push.

## The bug

`actionlint .github/workflows/github-settings-drift.yml`:

```text
github-settings-drift.yml:45:3: unknown permission scope "administration".
all available permission scopes are "actions", "artifact-metadata",
"attestations", "checks", "contents", "deployments", "discussions",
"id-token", "issues", "models", "packages", "pages", "pull-requests",
"repository-projects", "security-events", "statuses" [permissions]

   |
45 |   administration: read
   |   ^~~~~~~~~~~~~~~
```

`administration` is NOT a valid GITHUB_TOKEN permission scope.
GHA returns "This run likely failed because of a workflow file
issue" because the workflow tries to claim a permission that
doesn't exist.

The workflow's intent (read rulesets, branch protection,
security_and_analysis, secrets counts, deploy keys, webhooks)
genuinely needs **admin-level** access, but `GITHUB_TOKEN`
cannot grant `admin:org` or `admin:repo_hook` scopes — those
require a PAT with explicit org/repo admin rights.

## Has been broken since

- **First commit**: PR #45 (`f92f1d4 Resolve HB-001: transfer
  to Lucent-Financial-Group; land GitHub-settings-as-code +
  drift detector`) introduced the invalid permission.
- **Most recent edit**: PR #375 (round-44 final per-PR matrix)
  did NOT fix the permission.
- **Net duration**: broken for the entire history of the
  workflow on LFG main.

## Failure mode

- GHA cannot grant `administration: read` (silently ignored
  or workflow-startup error).
- Workflow runs with whatever default permissions remain
  (likely `contents: read + actions: read`).
- The drift detector script
  (`tools/hygiene/check-github-settings-drift.sh`) calls
  `gh api /repos/.../rulesets` and similar admin endpoints,
  which return 403.
- Workflow fails per cadenced cron run + per-push trigger.

## What's NOT failing

- The drift detector **script** itself works correctly when
  run with a sufficient PAT (Aaron has run it locally per the
  workflow header comment).
- The expected snapshot at
  `tools/hygiene/github-settings.expected.json` is current.
- The cadenced `cron: "17 14 * * 1"` Mondays trigger fires —
  it just immediately fails at startup.

## What this row asks the maintainer

Three options:

**A — fix the permission to a valid scope.** Replace
`administration: read` with the actual minimum-needed valid
scopes. May require dropping admin-endpoint reads from the
drift script (some endpoints have no read-only public
equivalent and genuinely need PAT).

**B — supply a PAT secret with admin:repo + admin:org scopes.**
Add a repository-secret `DRIFT_DETECTOR_PAT` and reference it
in the workflow's env block instead of `secrets.GITHUB_TOKEN`.
Heavier; supplied PAT can be misused if leaked. Requires
maintainer action (`gh secret set`).

**C — convert to GitHub App.** Most secure long-term; create
a GitHub App with admin:read, install on the LFG org, and
have the workflow use the App's token. Heaviest; multi-week
effort; right answer if this drift detector is load-bearing
for security audits.

## Why P1 (not P0)

- The drift detector is **advisory**; nothing currently
  branches on its pass/fail.
- Aaron has previously stated the github-settings-drift
  workflow flagging IS the intended advisory signal (per
  earlier tick-history rows), suggesting awareness that it
  fails — but the failure mode is "workflow file issue" at
  startup, not "drift detected". Different failure shapes.
- Fixing it surfaces real drift signals the maintainer
  currently can't see — composes with task #287 visibility-
  constraint discipline (Aaron-can-see is load-bearing).

## Why P1 (not P2)

- Active false-failure noise pollutes every PR's CI summary
  + the daily budget snapshots.jsonl.
- The discipline this row demonstrates (workflow-null-result
  audit class) just paid out concretely on its first
  application — keeping the row visible motivates the audit's
  cadenced-counterweight habit (task #269).

## Acceptance criteria

- [ ] Maintainer picks A / B / C (or alternative path)
- [ ] github-settings-drift.yml passes `actionlint` cleanly
  (no unknown permission scope warnings)
- [ ] Workflow runs to completion (success OR drift-detected
  exit code 1, NOT workflow-startup failure)
- [ ] Cadenced cron run on next Monday 14:17 UTC confirms
  fix (or shows real drift findings if option A drops some
  endpoints)

## Operational note

This row is the **first concrete catch** by the
Workflow Null-Result Audit Signal discipline (per Amara
class-naming memory landed in PR #685). Closes the
discipline-application loop: class memorialized → audit
applied → real factory-hygiene bug found → backlog row
filed. Future-Otto: this is what good discipline looks like.

## Composes with

- B-0085 (budget cadence cron-vs-deadline gap, also caught
  by workflow null-result audit) — same discipline, same
  application pattern.
- `memory/feedback_incomplete_source_set_regeneration_hazard_and_workflow_null_result_audit_amara_2026_04_28.md`
  — the discipline this row's discovery applied.
- `memory/feedback_aaron_visibility_constraint_no_changes_he_cant_see_2026_04_28.md`
  — the rule that prevents autonomous-fix; row filing IS the
  visibility surface.
- Task #269 (cadenced-counterweight-audit skill) — this
  audit pattern belongs in the skill's catalog as a routine
  check.
- `docs/GITHUB-SETTINGS.md` — the declarative companion doc
  that the drift detector exists to enforce.
