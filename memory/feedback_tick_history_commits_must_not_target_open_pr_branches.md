---
name: Build-running-on-PR → free-time mode (not commit-speculative-work)
description: Aaron 2026-04-22 — if a build is running on the PR, go into free-time (research/absorb), don't commit; the branch-discipline escape is second-best until the cartographer research delivers something better
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Aaron 2026-04-22 across three messages at the dbt-research
tick close:

1. *"is it building currentlly? this is going to trigger
   another build right? How long before this PR is
   complete?"*
2. *"also if you record ticks while waiting on build you
   are not going to be able to check that in or it will
   kick another build."*
3. *"really just do free time if a build is running on the
   PR until you figure out someting better in yor research"*

## Rule

**If a build is currently running on the PR (or on any
branch whose push kicks CI), go into free-time mode.**
Don't commit tick-history. Don't commit never-idle
speculative work. Research / absorb / memory-sweep / read
only.

**Scope clarification (Aaron 2026-04-22 correction):** the
rule applies to branches that ACTUALLY kick CI, not to
every local commit. A local commit to `round-44-speculative`
(a non-PR branch, zero workflow triggers per verified
scoping) is fine even while another PR's CI is running.
Aaron mid-flight: *"Appending tick-history while CI runs you
can't you have to stop doing this, now you are going to make
the PR build again"* — then, on seeing the commit was on
speculative branch not on PR-triggering branch: *"okay you
are right you didn't mess up ... you had it right this time
with what you did before that was just fine ... i was
paranoid"*. Visibility signal improvement: announce the
target branch in tick summaries so Aaron can see CI-risk at
a glance.

Continue in free-time mode until one of:
- The build finishes AND Aaron signals continuation.
- The cartographer / parallel-worktree research delivers a
  structural fix that removes the push-kicks-CI live-loop
  risk (e.g. `paths-ignore` on tick-history paths, or a
  worktree-split where the tick-committing branch never
  touches CI-triggering branches).

## Why

The append-on-every-tick discipline + push-to-PR-branch =
another build. That's a live-loop generator of the same
class as the 2026-04-22 *"why are yo udoing speculative
work?"* incident. The cheapest fix that doesn't damage the
tick-discipline is: **not commit while the build is
running**. Free-time is a valid tick-mode per memory
`feedback_idle_tracking_and_free_time_as_research.md` —
research counts as productive use of the cadence.

Aaron's preference order:
1. Free-time mode while build running — simplest, no
   structural changes required.
2. Sibling non-PR branch for commits — works but adds
   branch-placement discipline.
3. Structural (`paths-ignore` on workflows, or CI-isolated
   branches) — the "something better" the research is
   expected to produce.

## How to apply

**Before any commit during a tick:** check PR CI state.

```
gh pr view <PR-num> --json statusCheckRollup \
  -q '.statusCheckRollup[] | select(.status != "COMPLETED")'
```

Non-empty output → free-time mode. Empty output → normal
tick work.

**Free-time mode activities (allowed):**
- Read factory docs, audit for gaps, propose in memory.
- Draft research docs (on non-PR branches → wait to
  commit OR commit on round-N-speculative which has no
  CI trigger).
- Update memories (lives in `~/.claude/...`, not the
  repo, zero CI risk).
- Sweep `docs/BACKLOG.md` for rows that need refinement.

**Free-time mode activities (not allowed):**
- Commit to any branch that might get pushed while build
  is running.
- Push any branch that would kick CI.
- Merge PRs.

**Verified 2026-04-22 workflow scoping** (relevant for
branch-placement fallback when Aaron explicitly lifts the
simpler rule): `gate.yml`, `codeql.yml`, `resume-diff.yml`,
`scorecard.yml` all scope to `pull_request` events or
`push: branches: [main]`. Pushing `round-N-speculative`
(non-PR, non-main) kicks zero workflows.

## Cross-references

- `feedback_live_loop_detector_speculative_on_pr_branch.md`
  — parent pattern (commits on open-PR branch kick CI).
- `feedback_parallel_worktree_safety_cartographer_before_default.md`
  — the cartographer research Aaron is waiting on.
- `feedback_idle_tracking_and_free_time_as_research.md` —
  free-time as a valid productive mode.
- `docs/AUTONOMOUS-LOOP.md` — the tick discipline this
  rule bounds.

## Future-proofing

When the parallel-worktree research delivers "something
better" (Aaron's words) — either `paths-ignore` on
workflows, or a CI-isolated branch convention — this rule
upgrades to allow tick-commits during running builds. Until
then, free-time is the conservative default.
