---
name: >-
  workflow_dispatch on a PR branch creates SEPARATE check_run records
  on the same SHA; branch protection uses latest-by-name across ALL
  runs (not just the PR's run); if any dispatched leg flakes, its
  failure overwrites the prior PR-event success and breaks the merge
  gate; preferred recovery for "missing required check on PR" is
  `gh run rerun <PR-run-id> --failed` on the EXISTING PR-event run,
  NOT `gh workflow run --ref` which creates a new run; observed
  empirically 2026-04-28 on LFG #660 where workflow_dispatch was
  used to fill in a missing macos-26 leg and accidentally broke
  ubuntu-24.04 + ubuntu-24.04-arm via install.sh transient flake on
  the dispatch run; cost: ~10 min of additional CI cycles + cognitive
  load mid-tick
description: >-
  Aaron 2026-04-28 framing on the LFG #660 macos-26 missing-leg fix:
  *"macos-26 we are suposed to have that"* + later *"but it's okay if
  you skip it for now and turn it back on, but i 'll think you have
  another day"*. I dispatched gate.yml via workflow_dispatch to
  populate the missing macos-26 context. macos-26 succeeded but the
  dispatch's ubuntu-24.04 + ubuntu-24.04-arm install.sh step flaked
  and FAILED. GitHub branch protection uses latest-by-name across
  all check-run records on a SHA, so the dispatch's failures
  overwrote the original PR-event run's successes. PR went from
  blocked-on-missing-macos26 to blocked-on-failing-ubuntu — strictly
  worse for ~10 minutes until rerun completes. Capturing as durable
  substrate so future-Otto picks the right tool for "PR missing a
  required check" — preferred is `gh run rerun --failed` on the
  EXISTING PR-event run, NOT `gh workflow run --ref` which creates a
  separate workflow run.
type: feedback
---

# workflow_dispatch on PR branch overwrites latest-by-name (2026-04-28)

## The lesson

When a PR has a missing required check (calibration constant memory's
class-4: required-check absent from the rollup), the instinct is to
trigger the workflow somehow to make the missing check run. The two
available tools have different semantics:

| Tool | What it does | Risk |
|------|--------------|------|
| `gh run rerun <PR-run-id> --failed` | Re-runs failed jobs **inside the existing PR-event run**; no new workflow run is created; results land on the same `check_run` records | Low — flakes just retry; original successes for other legs stay untouched |
| `gh workflow run --ref <pr-branch>` | Creates a **separate `workflow_dispatch` run** on the same SHA; each leg's result lands as a NEW `check_run` record with the same name; branch protection's latest-by-name picks the most recent record | **High** — if any dispatched leg flakes, its FAILURE overwrites the prior PR-event SUCCESS for that leg; PR goes from blocked-on-missing to blocked-on-failing |

**Preferred for "missing required check on PR":**
`gh run rerun <PR-run-id> --failed` (or trigger a fresh PR-event
run by pushing an empty commit / re-merging base into branch). NOT
`gh workflow run --ref`.

**When workflow_dispatch IS the right call:**

- Reproducing a transient failure under different event-context for
  debugging
- Triggering a workflow on a branch that doesn't have an open PR yet
- Manually invoking a `workflow_dispatch`-only workflow (no
  `pull_request` trigger)

Even in those cases, be aware that any dispatched leg's failure
becomes the latest-by-name on that SHA and CAN affect any open PR
pointing at that SHA.

## Empirical sequence (2026-04-28 on LFG #660)

1. **Diagnosis (correct):** LFG #660 mergeStateStatus=BLOCKED with
   green CI + 0 unresolved threads. Class-4 absent-required-check
   discovery: required `build-and-test (macos-26)` was missing from
   the tip commit's contexts because LFG-side gate.yml has a dynamic
   matrix that runs Linux-only on `pull_request` events.

2. **Wrong tool (mine):** dispatched gate.yml via
   `gh workflow run gate.yml --ref sync/...` to trigger the full
   matrix (LFG matrix-setup includes macos-26 on `workflow_dispatch`
   events).

3. **macos-26 succeeded** (~10 min) — desired outcome.

4. **Collateral damage:** dispatch's ubuntu-24.04 +
   ubuntu-24.04-arm legs FAILED at the install.sh "Install
   toolchain via three-way-parity script" step. install.sh has 5
   internal retry attempts but the dispatch context apparently hit
   a transient flake the PR-event context didn't (different runner
   image instance / different upstream-mirror state at dispatch
   time / etc.).

5. **State machine impact:** branch protection's latest-by-name
   picked the dispatch's FAILURE for ubuntu-24.04 + ubuntu-24.04-arm
   over the PR-event run's SUCCESS (newer timestamp wins). PR went
   from "missing macos-26" to "failing ubuntu" — a different blocker.

6. **Recovery:** `gh run rerun 25041639455 --failed` re-ran just the
   failed legs inside the dispatch run. Took ~5-10 min. Once
   complete the PR's mergeable state recomputed.

## Diagnostic shape (how to detect this happened)

```bash
# List ALL check-runs on the SHA (not deduped)
gh api "repos/<owner>/<repo>/commits/<SHA>/check-runs?per_page=100" --jq '
  .check_runs
  | group_by(.name)
  | map({name:.[0].name, count:length, conclusions:[.[] | {conclusion, started_at, run_id:(.details_url | split("/")[-3] | tonumber)}]})
  | .[]
  | select(.count > 1)'
```

Any name with count > 1 has multiple runs on the same SHA; check
whether the conclusions agree. If they disagree, branch protection
sees the LATEST timestamp's conclusion, which can mismatch the
"green" rollup view in the PR UI.

## Prevention candidates

### Author-side (preferred)

When seeing class-4 (absent-required-check) on a PR:

1. **First try:** identify the PR-event run via
   `gh run list --branch <pr-branch> --workflow <name> --json databaseId,event --jq '.[] | select(.event=="pull_request") | .databaseId'`
2. **Then `gh run rerun --failed`** on that run if any leg failed,
   or push an empty commit if the leg simply didn't run (matrix
   excluded it).
3. **Last resort:** `gh workflow run --ref` only if the PR-event
   workflow definitively cannot emit the missing leg (matrix excludes
   it on PR events). Even then, expect collateral risk if any
   dispatched leg flakes.

### Reviewer-tooling-side (Zeta-internal hygiene candidate)

A `tools/hygiene/audit-pr-check-runs.sh` script that flags PRs
where the same check-name has divergent conclusions across runs on
the same SHA. Pre-merge gate. Cost: ~30 lines bash. Catches this
class entirely.

### Branch-protection-side (GitHub-platform ask)

Branch protection's latest-by-name is the actual mechanism that
makes this fragile. A "by-original-PR-event-run" mode would prevent
dispatch-induced regressions. Upstream ask, low immediate leverage.

## Composes with

- **calibration-constant memory** — class-4 (absent-required-check)
  is what triggered me to dispatch in the first place. This memory
  is the "what to do when class-4 is the diagnosis" companion.
- **Otto-355** (BLOCKED-investigate-threads-first) — investigation
  catches class-4; this memory says how to fix it without
  collateral damage.
- **Otto-275-FOREVER** — knowing-rule != applying-rule. I knew the
  PR-event-run vs dispatched-run distinction in theory but didn't
  apply it to the diagnostic-resolution path until after the
  collateral damage landed.
- **never-be-idle** — the dispatch was the wrong choice partly
  because I jumped to action without thinking through which tool
  was right. The discipline of "pick the right tool before acting"
  is the substrate-fix this memory codifies.

## Triggers for retrieval

- Seeing a PR with `mergeStateStatus: BLOCKED` and a missing
  required check (class-4 from the calibration constant memory)
- Considering `gh workflow run --ref` on any PR branch
- Considering "I'll just trigger the workflow to fill in the gap"
- Diagnosing a PR that recently changed from passing to failing
  without code changes
- Finding multiple `check_runs` for the same name on a SHA via
  `gh api .../check-runs`

## What this memory does NOT do

- Does NOT forbid `gh workflow run --ref`. It's the right tool for
  some situations (debugging transient failures under different
  event context, branches with no open PR). The rule is just:
  awareness of the latest-by-name overwrite risk.
- Does NOT cover `merge_group` events specifically. The merge-queue
  has its own rollup semantics; this memory is about pull_request +
  workflow_dispatch.
- Does NOT cover GitHub Actions reusable workflows. Those have
  their own check-run shape.
- Does NOT cover the case where the PR-event workflow definitively
  cannot emit the missing leg (matrix excluded). In that case, the
  structural fix is to update the workflow + push (which creates a
  fresh PR-event run); workflow_dispatch is a workaround not a
  fix.

## Operational rule for future-self

When I see "PR has a missing required check":

1. Identify the PR-event workflow run (`gh run list --branch <X>`)
2. If the missing leg failed in the PR-event run: `gh run rerun
   --failed` on that run
3. If the missing leg simply wasn't included in the PR-event run's
   matrix: investigate whether the workflow needs to be updated to
   emit the leg on `pull_request` events (likely a forward-sync
   gap or a deliberate matrix scope decision)
4. Last resort: `gh workflow run --ref` AFTER acknowledging the
   latest-by-name overwrite risk and being prepared to rerun the
   collateral-damaged legs

The cost asymmetry is real: 5 min to choose the right tool vs
~10-20 min recovering from collateral damage.
