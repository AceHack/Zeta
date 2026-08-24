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
PR #14858. Three have zero gate runs ever; #12321 is queued, not stalled.

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

## Narrowing observation — it arrives in SIMULTANEOUS PAIRS (shadow, 2026-08-24)

Root cause is still open. This does not close it; it narrows where to look, and
records two hypotheses that were **tested and refuted** so nobody re-runs them.

**The pattern, from tick-loop sampling:**

| pair | created | checks each |
|---|---|---|
| `#15002` / `#15003` | 22:13, same minute | 8 |
| `#14951` / `#14952` | 20:36, same minute | 8 |

Older members of the class — `#14858`, `#12321`, `#12066`, `#12058` — carry
**6–7** checks. A PR that *did* get a gate carries **40+**.

Two things follow:

1. **The gate is not dying mid-run; it is never dispatched.** A cancelled or
   crashed gate would still leave the check present with a non-success
   conclusion. Absent-entirely is a dispatch failure, not an execution failure.
2. **It correlates with near-simultaneous PR creation** by the flush lane —
   twice observed as a same-minute pair.

**Refuted hypothesis 1 — the concurrency group.** `gate.yml:106-108` is
`group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}`,
which is **per-PR**. Two distinct PRs get distinct groups, so `cancel-in-progress`
cannot cancel one PR's gate on account of another's. Checked, not assumed.

**Refuted hypothesis 2 — workflow-created PRs.** GitHub does not trigger
`on: pull_request` workflows for PRs opened with `GITHUB_TOKEN`, which would fit
perfectly. It does not hold here: `gh api .../pulls/N --jq .user.login` returns
**`AceHack` / type `User`** for both the no-gate PRs and a PR that *did* get a
gate. Same creator on both sides, so creator identity does not discriminate.

**Where to look next**, in the order a next investigator should try:
`on:` trigger filters in `gate.yml` (paths/branches) against these branch names;
whether a rate limit or dispatch-concurrency ceiling applies to near-simultaneous
`pull_request` events; and whether the flush lane opens PRs by an API path whose
events differ from a normal push (e.g. created from an existing ref with no new
push event).

Detection is unaffected either way — `pr-gate-presence.yml` names the class
hourly regardless of cause, and the class is visible rather than silent, which
was the point of the original fix.
