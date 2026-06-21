---
id: 081KQNJ500008QG0R000T4QGD7
priority: P1
status: closed
closed: 2026-05-07
closed_by: "PR #1811"
title: budget-snapshot-cadence workflow jq --argjson failure on first natural-Sunday fire post-081KQ8P5D0008QG0R003JETMEV-close (2026-05-03)
tier: factory-tooling
effort: S
ask: maintainer-gated diagnosis + defensive-fix landing (autonomous-loop investigated 2026-05-03T17:46Z but couldn't reproduce in CI environment)
created: 2026-05-03
last_updated: 2026-05-07
depends_on: []
composes_with: [081KQ8P5D0008QG0R003JETMEV]
tags: [budget-snapshot, jq, argjson, ci-failure, cron-fire-2026-05-03, github-token-scopes]
---

# 081KQNJ500008QG0R000T4QGD7 — budget-snapshot-cadence workflow `jq --argjson` failure on first natural-Sunday fire after 081KQ8P5D0008QG0R003JETMEV close

## The failure

Run `25285483579` (`.github/workflows/budget-snapshot-cadence.yml`,
2026-05-03T17:11:12Z, the first natural Sunday fire after 081KQ8P5D0008QG0R003JETMEV's
2026-05-02 close) failed with:

```
jq: invalid JSON text passed to --argjson
Use jq --help for help with command-line options,
or see the jq manpage, or online docs at https://jqlang.github.io/jq
error: snapshot compaction produced empty/null output — refusing to append
##[error]Process completed with exit code 1.
```

Total runtime ~6 seconds. No `warning:` lines preceded the failure
in the log (the script's `api_warnings` defensive pattern didn't
fire), suggesting the failure was at the first `--argjson` site,
not after a fallback-to-empty pattern.

## Hypothesis

The script `tools/budget/snapshot-burn.sh` line 68 fetches:

```bash
copilot_raw="$(gh api "/orgs/${org}/copilot/billing" 2>/dev/null || echo "{}")"
```

The workflow's `snapshot` job grants
`contents:write` + `pull-requests:write` + `actions:read` to its
`GITHUB_TOKEN` per `.github/workflows/budget-snapshot-cadence.yml`
(top-level workflow `permissions:` is `contents: read`, narrower —
the snapshot job widens within job scope only). The job
**does NOT grant `read:org`** scope, which the
`/orgs/{org}/copilot/billing` endpoint requires.

The current fallback (`|| echo "{}"`) only triggers if `gh api` exits
non-zero. **Suspicion**: in the CI environment, `gh api` may either
(a) write partial output to stdout before the 403 is detected,
producing `partial-output{}` after the fallback appends; or
(b) exit zero with non-JSON body in some `gh` version edge case.

Either way, `copilot_raw` ends up as non-JSON text, and the later
`--argjson copilot "$copilot_raw"` (line 139) chokes.

Could also be at line 102 (per-run timing aggregation) or
line 117-121 (entry composition) — without trace-mode log output, the
specific `--argjson` site isn't identified.

## Could-not-reproduce

Local run of `bash tools/budget/snapshot-burn.sh --dry-run` with
the maintainer's `gh auth` (which has `read:org`) succeeds —
local environment has more scopes than CI. Without simulating
the CI's restricted token, the specific failing call can't be
isolated.

## Proposed defensive fix

Apply a JSON-validation guard before each `--argjson` site:

```bash
# After line 68:
copilot_raw="$(gh api "/orgs/${org}/copilot/billing" 2>/dev/null || echo "{}")"
echo "$copilot_raw" | jq empty 2>/dev/null || copilot_raw='{}'
```

Same pattern applied to:

- `runs_json` (line 79) — already has `||` fallback but should
  also validate
- `copilot_raw` (line 68) — primary suspect
- `pr_raw` (line 111) — same pattern as `runs_json`
- The `agg`, `per_run`, `pr_stats`, `entry` intermediate values
  — same defensive validation before each `--argjson` use

Lower-cost alternative: a single helper function

```bash
ensure_json() {
  # Usage: ensure_json "$var" '{}' (returns valid JSON or fallback)
  if echo "$1" | jq empty 2>/dev/null; then echo "$1"; else echo "$2"; fi
}
copilot_raw="$(ensure_json "$copilot_raw" '{}')"
```

## Why not autonomous fix this tick

1. **Cannot reproduce locally** — local `gh auth` has more scopes
   than CI's GITHUB_TOKEN; the failing path isn't directly hit
   from my workstation.
2. **Cannot verify the fix actually closes the bug** without a
   CI test cycle the autonomous loop can't safely pre-create.
3. **Per superpowers:verification-before-completion**, claiming
   a fix without being able to verify it pass/fail is anti-pattern.
4. **The workflow is weekly cadence** — the cost of waiting is
   bounded (one snapshot row missed in `docs/budget-history/snapshots.jsonl`
   per failed Sunday).

## Acceptance criteria

- [x] Land defensive `jq empty` validation before each `--argjson`
  site in `tools/budget/snapshot-burn.sh`
- [ ] Test on next Sunday cron fire (2026-05-10) OR via
  workflow_dispatch with deliberately-invalid token simulation
- [ ] Snapshot row appears in `docs/budget-history/snapshots.jsonl`
  with `scope_coverage.has_read_org: false` (which matches what
  the CI token actually has)

## Composes with

- **081KQ8P5D0008QG0R003JETMEV** (closed 2026-05-02): the parent row that documented
  the workflow's cron timing. This row is the next-failure-mode
  in the same workflow surface, after 081KQ8P5D0008QG0R003JETMEV's natural Sunday fire
  restart actually happened.
- `tools/budget/snapshot-burn.sh` lines 68, 79, 102, 111, 117-121,
  134-154 — the `--argjson` sites
- `.github/workflows/budget-snapshot-cadence.yml` permissions
  block (`contents:write + pull-requests:write + actions:read`,
  notably missing `read:org`)

## Origin

Discovered during autonomous-loop tick 2026-05-03T17:45Z while
auditing main CI for failures during a drained-bounded-PR-queue
no-op window. The failure had been silent for 35+ minutes without
any other surface flagging it — exemplifying the broader
cadence-detector pattern where scheduled workflows' silent failures
need their own audit cadence (the `gh run list --branch main` audit
this iteration found it).
