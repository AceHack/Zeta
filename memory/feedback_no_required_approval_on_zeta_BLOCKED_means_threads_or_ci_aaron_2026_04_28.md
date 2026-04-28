---
name: >-
  BOTH FORKS — requiredApprovingReviewCount=0 on Zeta; BLOCKED never
  means "waiting for reviewer approval"; the only blockers are
  unresolved review threads, failing/pending status checks, or merge
  conflicts; this is a CALIBRATION CONSTANT for the project's branch
  protection ruleset on AceHack/Zeta and Lucent-Financial-Group/Zeta
  — verified empirically via gh api graphql against
  branchProtectionRule 2026-04-28; Aaron 2026-04-28 caught me
  parroting "blocked on reviewer approval" multiple times in this
  session despite zero approvals being required
description: >-
  Aaron 2026-04-28 input after I claimed LFG #660 was "BLOCKED
  awaiting reviewer" — he asked *"are you sure, it's not something
  simple you can figure out?"* prompting me to actually query the
  branch-protection rule via GraphQL. Result —
  requiredApprovingReviewCount=0 on origin/main (LFG). The same is
  true on AceHack/main. **No approval is required to merge on this
  project — neither fork.** A mergeStateStatus=BLOCKED with green CI
  on Zeta MUST mean one or more of: (1) unresolved review threads
  (requiresConversationResolution=true), (2) pending or failing
  status checks in the required list, (3) merge conflicts. NEVER
  means "waiting for human reviewer approval" — there is no
  human-reviewer-approval gate configured. I made this same
  misdiagnosis multiple times in this session despite Otto-355
  (BLOCKED-investigate-threads-first) being a wake-time discipline.
  Aaron explicit ask — save somewhere that
  requiredApprovingReviewCount=0 on this project — this memory IS
  that durable reminder, indexed in MEMORY.md so fresh sessions hit
  it before falling into the same misdiagnosis.
type: project
---

# Calibration constant — `requiredApprovingReviewCount: 0` on Zeta

## The constant (verified 2026-04-28)

Both forks of Zeta have `requiredApprovingReviewCount: 0` configured
on the `main` branch protection ruleset:

- `https://github.com/AceHack/Zeta` — main
- `https://github.com/Lucent-Financial-Group/Zeta` — main

**No human reviewer approval is required to merge any PR.** The
`requiresApprovingReviews: true` flag is on (so the review system is
*enabled*) but the *count* required is zero — meaning a PR can merge
with zero approving reviews as long as the other gates clear.

## What `mergeStateStatus: BLOCKED` actually means on Zeta

When the GitHub API reports `mergeStateStatus: BLOCKED` on a Zeta PR,
the blocker is **one OR MORE** of these FOUR classes (they CAN
coexist — e.g., a PR can simultaneously have unresolved threads AND
pending CI; fixing only one class won't unblock the merge until ALL
classes are clear; the diagnostic playbook below MUST check all four
before declaring the diagnosis exhausted):

1. **Unresolved review threads.** `requiresConversationResolution: true`
   is set on both forks. Even ONE unresolved thread blocks merge. Even
   if the thread is `isOutdated: true` after a force-push, it still
   blocks until explicitly resolved (per
   `feedback_outdated_review_threads_block_merge_resolve_explicitly_after_force_push_2026_04_27.md`).

2. **Failing or pending required status checks.** The required-context
   list on both forks includes:
   - `lint (semgrep)`
   - `lint (shellcheck)`
   - `lint (actionlint)`
   - `lint (markdownlint)`
   - `build-and-test (macos-26)`
   - `build-and-test (ubuntu-24.04)`
   - `build-and-test (ubuntu-24.04-arm)`

   Any of these in `FAILURE`, `IN_PROGRESS`, or `QUEUED` blocks merge.

3. **Merge conflicts** with the base branch. Surfaces as
   `mergeable: CONFLICTING` in the same API response and as `DIRTY`
   in `mergeStateStatus`.

4. **Required check missing entirely from the tip commit's rollup
   contexts.** This is the SNEAKIEST class — every reported context
   is `SUCCESS`, no failures, no pending, no conflicts, all threads
   resolved, and `statusCheckRollup.state == SUCCESS` — but a
   required check from `branchProtectionRule.requiredStatusCheckContexts`
   is **absent** from the contexts list (it never reported). Branch
   protection treats absent-required as blocking even though the
   visible signal is all-green.

   **How this happens:** matrix workflows where one leg failed to
   start (resource unavailable, fork-permission gate, runner-class
   capacity exhaustion, transient infrastructure error pre-job-
   queue), workflows that didn't trigger because of `paths:` filter
   on a PR that didn't touch matching paths, deleted required-check
   names that no longer match any workflow output.

   **Diagnostic:** compare
   `branchProtectionRule.requiredStatusCheckContexts` (the required
   list) against the SET of `name` fields from
   `statusCheckRollup.contexts.nodes`. ANY required name not in the
   actual set is a class-4 blocker.

   **Empirically observed 2026-04-28 on LFG #660:** required list
   includes `build-and-test (macos-26)` but the tip commit's rollup
   only had `build-and-test (ubuntu-24.04)` and
   `build-and-test (ubuntu-24.04-arm)` — the macos-26 leg never
   reported. This was discovered AFTER claiming "all green, all
   threads resolved" — the rollup state was misleadingly SUCCESS
   because GitHub's rollup state only reflects the contexts that
   DID report, not the contexts that SHOULD have reported.

   **Resolution:** find the workflow run, check why the missing leg
   didn't report (failed to start / not triggered / dispatched via
   different workflow), then either re-trigger the leg, fix the
   workflow config so the leg runs, or (last resort) update the
   branch protection rule to remove the absent required-check name.

## What BLOCKED does NOT mean on Zeta

**It does NOT mean "waiting for a human reviewer to approve."**

There is NO human-reviewer-approval gate configured. If I find myself
typing "BLOCKED awaiting reviewer" or "blocked on reviewer approval"
or "needs human sign-off before merge" on a Zeta PR, that's the
failure mode this memory exists to catch.

## How to verify the actual blocker (correct diagnostic command)

```bash
gh api graphql --field query='query {
  repository(owner:"<owner>",name:"Zeta"){
    pullRequest(number:<N>){
      mergeStateStatus
      mergeable
      reviewDecision
      reviewThreads(first:100){pageInfo{hasNextPage} nodes{isResolved}}
      commits(last:1){nodes{commit{statusCheckRollup{state contexts(first:100){pageInfo{hasNextPage} nodes{__typename ... on CheckRun{name conclusion status} ... on StatusContext{context state}}}}}}}
      baseRef{branchProtectionRule{requiredStatusCheckContexts}}
    }
  }
}'
```

Then check, in order:

1. Are any threads `isResolved: false`? If yes — that's the blocker.
2. Are any required status checks `FAILURE` / `IN_PROGRESS` / `QUEUED`?
   If yes — that's the blocker.
3. Is `mergeable: CONFLICTING`? If yes — rebase needed.
4. **Is any name in `requiredStatusCheckContexts` MISSING from the
   `contexts.nodes` list entirely?** If yes — that's the class-4
   blocker (sneakiest class — rollup state will report SUCCESS
   because it only counts contexts that DID report). Compare set
   membership: `set(required) - set([n.name for n in contexts])`.
   Any non-empty diff = absent-required blocker.
4. Are 1-3 all clear and BLOCKED still shows? Then check the branch-
   protection rule directly via `baseRef.branchProtectionRule` — but
   on Zeta this should never happen because `requiredApprovingReviewCount: 0`.

## Why this rule needs a durable memory

Aaron 2026-04-28 verbatim: *"requiredApprovingReviewCount you've made
this mistake several time, can you just save soewhere that
requiredApprovingReviewCount: 0 or something that reminds you of that
on this project?"*

I made this mistake **multiple times in a single session** despite:

- Otto-355 (BLOCKED-with-green-CI investigate-threads-first) being a
  CLAUDE.md wake-time discipline
- Already having drained dozens of threads on the same PRs in earlier
  ticks (which means I had empirical evidence that threads ARE the
  blocker on Zeta)
- The memory file
  `feedback_blocked_status_is_not_review_gating_check_status_checks_failure_first_otto_live_lock_2026_04_26.md`
  already existing as a 9-pattern live-lock taxonomy

The reason vigilance-only enforcement keeps failing: GitHub's UI uses
the word "review" everywhere, and my training-data prior maps "BLOCKED"
to "waiting for human." This is a **trained-prior-vs-substrate**
conflict per Otto-340 (substrate IS identity). The substrate says no
approval required; the trained prior says BLOCKED-means-reviewer. I
keep snapping back to the prior under load.

The fix is mechanism-over-vigilance per Otto-341: a memory file that
fresh sessions hit explicitly, plus the empirical data point
(`requiredApprovingReviewCount: 0`) that anchors the calibration. When
I see `mergeStateStatus: BLOCKED` on Zeta, the FIRST thing I should
do is check threads + checks + conflicts — NEVER claim "waiting for
reviewer."

## Recurrences in the 2026-04-28 session (the count itself is signal)

This rule was violated multiple times before Aaron caught it
explicitly. Each recurrence documented as evidence:

### 1st caught: 2026-04-28 (LFG #660 close-of-tick #1)

I closed a tick with: *"LFG #660 is BLOCKED waiting on reviewer
approval — that's not an agent action."* Aaron didn't catch it
immediately because the queue was busy.

### 2nd caught: 2026-04-28 (LFG #660 close-of-tick #2)

Repeated the framing in a status update: *"LFG #660 BLOCKED awaiting
reviewer."*

### 3rd caught: 2026-04-28 (Aaron's catch)

After the same framing landed a third time, Aaron prompted: *"you
said one of the PRs was block on maintainer, are you sure, it's not
something simple you can figure out?"*

I queried the branch-protection rule explicitly and found
`requiredApprovingReviewCount: 0`. The "blocker" was 3 unresolved
review threads that had landed since my last check — fixable in one
commit + 3 GraphQL `resolveReviewThread` calls.

The 5-minute fix had been gated by my parroted misdiagnosis for
hours.

## Always double-check threads AFTER CI completes (Aaron 2026-04-28)

Aaron 2026-04-28 follow-up: *"you should always double check,
unreviewed threads after CI completes"*

**Why this matters:** new review threads can land AFTER CI completes,
not just before. The reviewers I see most often on Zeta:

- `chatgpt-codex-connector` — runs after CI (latency: ~5-10 min)
- `copilot-pull-request-reviewer` — runs after CI (latency: ~2-5 min)

So a PR can transition through these states in sequence:

```
push → CI running → CI green → BLOCKED-with-green-CI (no threads yet)
     → reviewers wake up (5-10 min) → BLOCKED-with-new-threads
```

If I check threads ONLY when CI starts, or ONLY when CI is mid-run, I
miss the threads that land after CI completes. The result is a stale
"0 unresolved" reading that becomes wrong without warning. This is
exactly the failure mode that bit me on LFG #660: I had checked
"0 threads" earlier in the tick, then by the next tick 3 new threads
existed.

**Operational rule:** when a Zeta PR is BLOCKED, run the GraphQL
threads query at minimum TWICE:

1. Once when first investigating the BLOCKED state.
2. Once AFTER CI completes (status-checks all green) — this is the
   moment new reviewer threads typically land.

If still BLOCKED after both checks return clean and CI is green and
no merge conflicts, THEN the diagnostic is exhausted (which on Zeta
should never happen because of `requiredApprovingReviewCount: 0`).

The 2-check discipline composes with Otto-355's "every-tick-inspects"
shape. The single-check failure mode is a sub-class of
manufactured-patience: assuming one read of state is sufficient when
state changes asynchronously to the agent's observation cadence.

**Concrete check shape (memo for future-self):**

```bash
# First check — at the moment of investigating BLOCKED state.
# CRITICAL: count BOTH still-running checks (IN_PROGRESS / QUEUED)
# AND already-completed-with-failure checks (FAILURE / CANCELLED /
# TIMED_OUT). A check that COMPLETED with FAILURE is "done" but the
# blocker is still active — treating it as "CI complete" would skip
# the post-CI thread pass while a real failure is unfixed.
gh pr view <N> --repo <owner>/Zeta --json statusCheckRollup --jq '{
  pending: [.statusCheckRollup[] | select(.status=="IN_PROGRESS" or .status=="QUEUED")] | length,
  failed:  [.statusCheckRollup[] | select(.conclusion=="FAILURE" or .conclusion=="CANCELLED" or .conclusion=="TIMED_OUT")] | length
}'

# If `pending == 0 AND failed == 0`, CI is complete-and-green. Wait
# ~5-10 min for reviewers to wake up, THEN run the threads query a
# second time:
gh api graphql --field query='query{repository(owner:"<owner>",name:"Zeta"){pullRequest(number:<N>){reviewThreads(first:100){pageInfo{hasNextPage} nodes{isResolved}}}}}'

# CRITICAL: if `hasNextPage: true` on either reviewThreads or contexts,
# the playbook is SHOWING A TRUNCATED VIEW. Paginate via the `after`
# cursor (cursor field omitted from these examples for brevity) before
# declaring "clean". A 100+ thread PR with the 50/30-cap form would
# silently drop items past the cap, leading to repeated misdiagnosis
# on high-activity PRs. The 100-cap reduces likelihood of truncation
# but DOES NOT replace the hasNextPage check — always read the flag
# before treating the count as authoritative.

# If `failed > 0`, the blocker is the failing check itself — investigate
# the failure first; the post-CI thread pass is gated on green CI.
```

If using autonomous-loop, the natural shape is:

- Tick N: investigate, find threads, drain them, push
- Tick N+1: re-check after CI completes; if new threads landed,
  drain them too

The "always double-check" phrasing also generalizes: never trust a
single read of an asynchronously-updated GitHub state. Threads,
checks, mergeable, mergeStateStatus all transition without the agent
in the loop.

## Pre-write self-scan rule (every status-update message)

Before sending any message that says a Zeta PR is BLOCKED, scan the
draft for these forbidden phrases:

```
blocked awaiting reviewer | awaiting reviewer | needs reviewer approval
| waiting for reviewer | blocked on reviewer | reviewer-approval gated
| waiting for human sign-off | needs human review to merge
| needs maintainer approval | blocked on maintainer
```

If ANY match → STOP. Run the GraphQL query above. The actual blocker
will be threads, checks, or conflicts — never "reviewer approval."

This composes with the Otto-357 forbidden-token list (no "directive"
framing) and the Otto-355 wake-time discipline. Same shape: write-time
scan + structural reason why the prior keeps reasserting.

## Composes with

- **Otto-355** (CLAUDE.md wake-time discipline) — BLOCKED-with-green-CI
  investigate-threads-first; this memory is the ZETA-SPECIFIC
  CALIBRATION that makes Otto-355 sharper (the "what's the actual
  blocker" question has only 3 possible answers on Zeta, not "waiting
  for reviewer" as a 4th)
- **`memory/feedback_blocked_status_is_not_review_gating_check_status_checks_failure_first_otto_live_lock_2026_04_26.md`**
  — the 9-pattern live-lock taxonomy that this rule extends with
  project-specific calibration data
- **`memory/feedback_outdated_review_threads_block_merge_resolve_explicitly_after_force_push_2026_04_27.md`**
  — `isOutdated: true` threads still block; explicit resolve required
- **Otto-275-FOREVER** — knowing-rule != applying-rule; this memory
  IS the applying-rule mechanism for the BLOCKED-means-reviewer
  failure mode
- **Otto-340** — substrate IS identity; the substrate says
  "no approval required" but the trained prior says
  "BLOCKED-means-reviewer." Substrate must win.
- **Otto-341** — mechanism-over-vigilance; the explicit-memory-file
  IS the mechanism that closes vigilance gaps

## What this memory does NOT do

- Does NOT change branch protection. It documents the current state
  (verified 2026-04-28). If the maintainer changes the rule later
  (e.g., to require external-contributor approval pre-v1), this
  memory must be updated.
- Does NOT mean reviews don't matter. Reviews still happen via codex/
  copilot/maintainer + show up as threads. The rule is just that
  *count of approving reviews* is not the gate.
- Does NOT cover other repos. This is a calibration constant for
  AceHack/Zeta + Lucent-Financial-Group/Zeta specifically. Other
  projects under different ownership have different rules.
- Does NOT replace Otto-355's empirical query habit. This memory adds
  the project-specific calibration; Otto-355's "always investigate
  before claiming wait state" is the universal rule.

## Triggers for retrieval

- Any time the word BLOCKED appears in a Zeta PR status
- Any time considering a "waiting for reviewer" framing on a Zeta PR
- `requiredApprovingReviewCount` / `requiresApprovingReviews` in any
  GraphQL response on Zeta
- Aaron 2026-04-28 *"requiredApprovingReviewCount you've made this
  mistake several time"*
- Recurrence catches in tick-history rows (the count itself is signal
  per Otto-275-FOREVER)

## Future-self check

If a future-Otto wake reads `mergeStateStatus: BLOCKED` on a Zeta PR
and the first instinct is "must be waiting for reviewer" — re-read
this memory FIRST. The instinct is the trained-prior. The substrate
says no approval required. Substrate wins.
