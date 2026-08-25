---
id: 081M0WSF2X2087G0R003F18DDJ
type: bug
state: backlog
priority: P1
slug: github-settings-record-was-wrong-in-the-permissive-direction
title: "github-settings record was wrong in the permissive direction: CI Gate recorded disabled while active, bypass_actors never captured, workflow list truncated at 30 of 90"
created: 2026-08-25T15:43:48.130Z
depends_on: []
composes_with: []
---

# github-settings record was wrong in the permissive direction: CI Gate recorded disabled while active, bypass_actors never captured, workflow list truncated at 30 of 90

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0WSF2X2087G0R003F18DDJ-*.md` glob. -->

## What was wrong

`github-settings-drift.yml` compares a committed record against live repo
settings and its `check drift` job is `continue-on-error: true`. It had been
reporting real differences into a log nobody reads.

Three defects, one class — a record that looks complete and is not:

1. **Wrong in the permissive direction.** Ruleset 16134995 "CI Gate" was
   recorded `enforcement: disabled` while live it has been `active` since
   2026-08-13T15:57:29Z, with a different required-check set. A record that
   says a gate is OFF while it is ON is the benign half; the general hazard is
   that nobody could tell from the committed file what protects `main`.
2. **`bypass_actors` was never captured.** The single most safety-relevant
   field on a ruleset — who may merge past it — was invisible to the detector.
   Live carries `{RepositoryRole 5 (admin), bypass_mode: pull_request}` on the
   CI Gate since 2026-08-13T21:50:54Z. Filed P0-security in `docs/BUGS.md`.
3. **List endpoints were read unpaginated.** `/actions/workflows` pages at 30
   and the snapshot recorded 30 of 90 workflows as if that were all of them.
   A workflow set to `disabled_manually` outside page 1 was undetectable.

Plus a fourth, found while fixing them: a scan that could read NOTHING exited
0 and printed "no drift", because unreadable fields are stripped from both
sides and stripping everything leaves two empty objects. Reproduced against
origin/main@ba92c40373: unfixed exit 0, fixed exit 3.

## What landed

- `bypass_actors` captured, normalized and ordinally sorted on every ruleset.
- All list reads paginated via `--paginate --slurp` with the projection moved
  into TypeScript (gh refuses `--slurp` with `--jq`).
- Unreadable fields reported by name, with the endpoint each came from and the
  credential that would read them, on stdout and as a GitHub annotation.
- New exit code 3 = INDETERMINATE, so "did not run" stops sharing an exit code
  with "passed".
- `--live-from PATH` for offline replay, so every branch including the
  zero-readable one can be demonstrated failing without minting a weak token.
- Record reconciled to live with a per-field verdict in
  `docs/GITHUB-SETTINGS.md`; contested rows recorded as facts and filed as
  bugs rather than ratified.

## Still open (operator's call, not an agent's)

- Remove or document the CI Gate admin bypass (`docs/BUGS.md` P0).
- Re-add `required_linear_history` to ruleset 16189060 (`docs/BUGS.md` P1).
- Decide whether `heartbeat/*` should regain `non_fast_forward`.
- Wire `DRIFT_DETECTOR_PAT` so the check stops depending on which credential
  ran it; that is the precondition for ever making it blocking.
- Rewrite the stale prose sections of `docs/GITHUB-SETTINGS.md`.

