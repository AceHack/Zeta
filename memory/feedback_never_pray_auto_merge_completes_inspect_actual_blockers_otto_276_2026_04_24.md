---
name: COUNTERWEIGHT — NEVER pray auto-merge completes; when polling a PR that's BLOCKED, ALWAYS inspect the underlying failing-checks + open-threads + review-decision, not just the summary mergeStateStatus; "summary says BLOCKED, CI must still be running" is a prayer, not a diagnosis; this is a RECURRING CLASS — #190 wedge (polled for many ticks without investigating), #385 + #388 now (same pattern); Aaron caught both times; DST lens: "observable state" means the real check detail, not the summary; Otto-264 in-phase balance says inspect immediately not "wait and see"; Aaron Otto-276 2026-04-24 "are you checking the ticket or did you forget again and just pray it auto completes again" + "balance this, it's a recurring issue"
description: Aaron Otto-276 counterweight for recurring PR-state-prayer drift. I keep polling summary state and assuming CI-still-running instead of inspecting failing checks + threads. Aaron has called this out on #190 and now #385/#388. Short + durable. Save per Otto-275 absorb discipline.
type: feedback
---
## The rule

**When a PR is BLOCKED, ALWAYS inspect the underlying
checks + threads + review-decision before concluding
"just CI running."**

**"Summary says BLOCKED, must still be CI" is prayer,
not diagnosis.**

Direct Aaron quotes 2026-04-24:

> *"are you checking the ticket or did you forget
> again and just pray it auto completes again"*

> *"balance this, it's a reoccuring issue"*

## What inspection means (not summary-state)

When polling a BLOCKED PR, the check must always
include:

```graphql
query($owner: String!, $repo: String!, $num: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $num) {
      mergeable
      mergeStateStatus
      reviewDecision
      reviewRequests(first: 20) { totalCount }
      latestReviews(first: 20) { nodes { state } }
      reviewThreads(first: 50) {
        nodes { isResolved }
      }
      commits(last: 1) {
        nodes {
          commit {
            statusCheckRollup {
              state
              contexts(first: 50) {
                nodes {
                  ... on CheckRun { name status conclusion }
                  ... on StatusContext { context state }
                }
              }
            }
          }
        }
      }
      baseRef {
        branchProtectionRule {
          requiresApprovingReviews
          requiredApprovingReviewCount
        }
      }
    }
  }
}
```

Then analyze:

1. **Any FAILURE-conclusion check?** → investigate the
   failure (flake vs real; re-run if flake, fix if
   real).
2. **Any non-COMPLETED status check?** → actually still
   running; waiting is correct.
3. **Any unresolved threads?** → drain them.
4. **reviewDecision null AND `requiresApprovingReviews`
   is true AND approving-review count is 0?** → GitHub
   quirk; may need to kick auto-merge or wait for
   reviewer approval.
5. **`mergeable` is CONFLICTING?** → rebase needed.

Only when all the above are clean AND the PR is still
BLOCKED is "waiting on GitHub state-machine" a valid
diagnosis. Even then, document it as the explicit
state — not a guess.

## The pattern Aaron caught

Both #190 (earlier session) + #385/#388 (now): I
polled `mergeStateStatus: BLOCKED` repeatedly, read
"state=BLOCKED merged=null", and assumed CI. No
underlying-check inspection. In BOTH cases the PR
had real failing checks OR open threads I could have
fixed IF I'd inspected.

The drift: lazy polling without DST-discipline
"observable state" check.

## Composition with prior memory

- **Otto-248** never-ignore-flakes (DST) — flakes
  need diagnosis + fix, not prayer. Otto-276 is the
  PR-polling corollary.
- **Otto-264** rule of balance — this is a filed
  counterweight for the recurring class.
- **Otto-265** 3-cycle rebase cap — related liveness
  guard. Otto-276 is the summary-state variant.
- **Otto-271** don't diagnose subagent failure
  mid-execution — different; that says "don't diagnose
  failure too fast." Otto-276 says "don't diagnose
  success too fast either." Inspect before
  concluding either way.
- **Otto-272** DST everywhere — "observable state"
  = the check-level detail, not the summary.
- **Otto-275** rapid-fire absorb — save this memory
  short + continue; don't spin a big implementation
  around it.

## Direct Aaron quotes to preserve

> *"are you checking the ticket or did you forget
> again and just pray it auto completes again"*

> *"balance this, it's a reoccuring issue"*

Future Otto: when polling PR state and seeing BLOCKED,
IMMEDIATELY query `statusCheckRollup` + `reviewThreads`
+ `reviewDecision`. If FAILURE-check, inspect log
decide flake-vs-real; if threads, drain; if
reviewDecision-null-quirk, kick auto-merge. NEVER
report "still CI" without verifying.
