---
id: 081M0TK8DE8087G0R0001HSKHF
type: bug
state: backlog
priority: P2
slug: gate-required-absent-from-a-pr-reads-as-green-bare-gh-pr-che
title: "gate (required) absent from a PR reads as green: bare gh pr checks returns rc=0 with zero required checks"
created: 2026-08-24T19:16:49.224Z
depends_on: []
composes_with: []
---

# gate (required) absent from a PR reads as green: bare gh pr checks returns rc=0 with zero required checks

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0TK8DE8087G0R0001HSKHF-*.md` glob. -->

## The measurement

`CI Gate` is the only ruleset carrying a `required_status_checks` rule and it names exactly
one context, `gate (required)`. A PR for which `gate.yml` produced no run therefore has
ZERO required checks — and the ordinary reading surface calls that green.

Measured 2026-08-24 on PR #14858 (`ouroboros-bootstrap`), exit codes captured directly:

    gh api .../workflows/gate.yml/runs?branch=ouroboros-bootstrap --jq .total_count  -> 0
    gh pr checks 14858             -> rc=0   6 pass / 0 fail / 0 pending
    gh pr checks 14858 --required  -> rc=1   "no required checks reported on the branch"

Population: of 42 open PRs, FOUR carry no `gate (required)` — #12058, #12066, #12321,
#14858. Three have zero gate runs ever; #12321 is queued, not stalled.

## What this is NOT

The routed hypothesis was that the ace drift gate sits outside the required floor. It does
not: `bun test src/Core.TypeScript/ace/` is a step of `cross-verify`, which is named in
`gate-required.needs`, with no `if:` and no `continue-on-error`. Sabotage control — add a
`<ProjectReference>` to `clis/Zeta.Clis.fsproj` without regenerating `build-graph.json`:
703 pass / 0 fail becomes **701 / 2, rc=1**, and the two failures are the DRIFT GATE pair
reported on #14858. Restored: 84 pass / 0 fail. The gate works and it gates. It simply
never ran.

## Fix landed (detection only — nothing new blocks)

- `required-check-started.ts` generalised from a hard-coded `heartbeat/` ref filter to a
  `--ref-prefix` parameter defaulting to `heartbeat/`, so the heartbeat lane's verdict is
  unchanged and `--ref-prefix ''` asks the same question of every open PR.
- `gh pr list --limit 50` against 42 open PRs replaced with a limit of 200 plus a
  truncation guard: a full page exits 2 (unmeasured), never 0 (clean).
- `.github/workflows/pr-gate-presence.yml` — hourly, level-triggered, absent from the
  floor, ~730 free runner-minutes/month, measured 8.7s per run.
- The `cross-verify` header comment that claimed the job does not block auto-merge,
  corrected.

## Still open (governance, not devops)

`docs/research/2026-08-24-the-required-check-that-never-ran-and-the-1162-tests-that-block-nothing.md`
§6 carries six numbered questions for the maintainer. The one that matters most: of 1,219
bun-discoverable test files, **57 are executed by a job whose red blocks a merge and 1,162
are not**.
