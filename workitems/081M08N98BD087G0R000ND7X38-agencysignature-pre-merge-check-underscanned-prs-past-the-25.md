---
id: 081M08N98BD087G0R000ND7X38
type: bug
state: in-progress
priority: P2
slug: agencysignature-pre-merge-check-underscanned-prs-past-the-25
title: "AgencySignature pre-merge check underscanned PRs past the 250-commit API cap"
created: 2026-08-17T20:05:54.157Z
depends_on: []
composes_with: []
---

# AgencySignature pre-merge check underscanned PRs past the 250-commit API cap

## The defect

`.github/workflows/agencysignature-enforcement.yml` reconstructs the squash preimage —
the artifact that actually lands, since `squash_merge_commit_message = COMMIT_MESSAGES` —
with:

```
gh api --paginate "repos/${GITHUB_REPOSITORY}/pulls/${PR_NUMBER}/commits" \
    --jq '.[].commit.message' | bun .../validate-agencysignature-pr-body.ts
```

`GET /repos/{owner}/{repo}/pulls/{number}/commits` returns **at most 250 commits**.
`--paginate` reaches that ceiling and stops. The validator was then handed the oldest
250 messages of a longer proposal and reported in its ordinary voice — **a check that did
not fully run, looking like one that passed.**

## Measured, 2026-08-17, live forge — PR #11528

```
$ gh api repos/Lucent-Financial-Group/Zeta/pulls/11528 --jq '.commits'
475
$ gh api --paginate repos/Lucent-Financial-Group/Zeta/pulls/11528/commits --jq '.[].sha' | wc -l
     250
$ git rev-list --count 34856165584ad825987c75de21e71a413307043f..a38c1acc15a43ab11331be8424d69f57e4ed57fd
475
```

225 commits were never read. Note the third line: **git enumerates the full list with no
cap**, which is what the workflow change below is for.

Also measured on the same artifact: `Agency-Signature-Version:` occurs **269** times
across those **250** commit messages, because squashed heartbeat merges carry several
blocks each. So the stream cannot be counted from its own content — block occurrences are
not commits.

PR #11555 removed the *cause* of 400-commit branches in the flush lane (post-fix flush PRs
measure 1–3 commits: #11623 = 1, #11625 = 3). It did not fix the check.

## Shipped (this work-item's PR) — the check fails closed

`src/Core.TypeScript/hygiene/agencysignature-commit-coverage.ts` decides one thing:
can the caller show that the commit list it piped in covers the whole proposal?

- **Only the PASS is guarded.** A FAIL found in a truncated prefix is *sound* — the
  violating commit really is in the PR — so it is still reported as a FAIL (exit 1).
  A PASS over a truncated prefix is *unsound*, so it is replaced by exit **3**,
  `REFUSED (UNMEASURED)`.
- **Fails closed on an unknown total**: "I could not find out how many commits this
  proposal has" must never read as "few enough".
- **No workflow edit was needed to ship it**: the total is read from the Actions event
  payload (`pull_request.commits`) that the yaml already exposes, and the PR-body lane is
  exempted by DATA (stdin is byte-identical to `PR_BODY`), not by a step name. If that
  discrimination ever drifts, the body lane starts being checked too — the failure
  direction is more refusal, never less.
- The cross-commit consistency rule is untouched. Only its coverage was broken.

## Open — the workflow change that removes the cap instead of refusing it

Needs a human: it edits `.github/workflows/`. **Not** attempted here, and no admin bypass
was sought.

Status of the "workflow PRs are unmergeable" claim, measured rather than assumed:
`gate (required)` **was** scheduled and **passed** on PR #11296, whose only changed file
was `.github/workflows/agencysignature-enforcement.yml` (run 31989815625, job
`gate (required)`, success 2026-08-17T03:14:29Z). The PR merged at 03:09:04Z — *before*
that job completed — so whether it needed the admin bypass is not determinable from the
API. `flush-via-staging.ts`'s header says such a PR "never gets `gate` scheduled"; that
sentence is at least imprecise. Either way the fix above does not depend on it.

The exact diff, for whoever takes it:

```diff
--- a/.github/workflows/agencysignature-enforcement.yml
+++ b/.github/workflows/agencysignature-enforcement.yml
@@ jobs.validate-pr-body.steps
       - name: Checkout
         uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
+        with:
+          # The commit list must come from git, not from the REST endpoint:
+          # `pulls/{n}/commits` caps at 250 and #11528 had 475. A full clone is
+          # what makes `base..head` resolvable here.
+          fetch-depth: 0
@@ the squash-preimage step
       - name: Validate the AgencySignature block in the squash preimage
         env:
           GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
           PR_CREATED_AT: ${{ github.event.pull_request.created_at }}
           PR_AUTHOR: ${{ github.event.pull_request.user.login }}
           CUTOVER: "2026-08-15T00:00:00Z"
-          PR_NUMBER: ${{ github.event.pull_request.number }}
+          BASE_SHA: ${{ github.event.pull_request.base.sha }}
+          HEAD_SHA: ${{ github.event.pull_request.head.sha }}
+          COMMIT_TOTAL: ${{ github.event.pull_request.commits }}
         run: |
           set -euo pipefail
-          gh api --paginate \
-              "repos/${GITHUB_REPOSITORY}/pulls/${PR_NUMBER}/commits" \
-              --jq '.[].commit.message' \
+          git fetch --no-tags --quiet origin "$BASE_SHA" "$HEAD_SHA"
+          SUPPLIED="$(git rev-list --count "$BASE_SHA".."$HEAD_SHA")"
+          git log --reverse --format='%B' "$BASE_SHA".."$HEAD_SHA" \
             | bun src/Core.TypeScript/hygiene/validate-agencysignature-pr-body.ts \
                 --pr-created-at "$PR_CREATED_AT" \
                 --grandfather-cutover "$CUTOVER" \
-                --author-identity "$PR_AUTHOR"
+                --author-identity "$PR_AUTHOR" \
+                --commit-total "$COMMIT_TOTAL" \
+                --commits-supplied "$SUPPLIED"
```

What that buys over the shipped refusal: a >250-commit proposal gets **validated** instead
of refused, and coverage becomes **counted** (`supplied` vs `declared`) rather than
inferred from the endpoint's ceiling — which closes the one residual stated in
`agencysignature-commit-coverage.ts` (an uncounted list of a ≤250-commit PR is assumed
whole; a pipeline that died halfway would not be caught).

Verified locally, not in CI (only the shipped half has CI evidence): the git enumeration
above returns exactly 475 messages for #11528's range, matching `pull_request.commits`.
The `git fetch` line is the part that has never run in an Actions container.

## Falsifier

`src/Core.TypeScript/hygiene/agencysignature-commit-coverage.test.ts`, `the underscan
mutation` block: a 300-commit proposal whose 251st commit disagrees on `Action-Mode`.
Feed the validator the truncated 250-message prefix and it must return 3, not 0.
Mutation run 2026-08-17 (`refusesPass` forced to never refuse): **21 pass / 5 fail**, and
the truncated case printed a full `PASS: AgencySignature v1` block — the defect, exactly.
Restored: **26 pass / 0 fail** in that file, 79 across both AgencySignature test files,
1604 across `src/Core.TypeScript/hygiene/`.
