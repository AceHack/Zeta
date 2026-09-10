---
id: 081M24GP48E087G0R00158CEGE
type: bug
state: backlog
priority: P2
slug: two-thirds-of-codeql-javascript-analyses-on-main-never-run-c
title: "two thirds of CodeQL javascript analyses on main never run: cancel-in-progress kills each commit baseline"
created: 2026-09-10T01:59:58.990Z
depends_on: []
composes_with: []
---

# two thirds of CodeQL javascript analyses on main never run: cancel-in-progress kills each commit baseline

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M24GP48E087G0R00158CEGE-*.md` glob. -->

## The measurement

Over the FULL history of the code-scanning analyses API for
`ref=refs/heads/main`, category `/language:javascript-typescript`:

```
20,390 analyses total
13,335 with rules_count == 0   (65.4%)
```

`rules_count: 0` means no queries were evaluated. Those uploads also carry
GitHub own verdict on them:

```
error: "unsuccessful execution, exit code: 0, description:  "
```

The analyses that DO run are consistent and unmistakable by contrast --
`rules 103 / results 61`, every time. There is no middle band, so this is not a
threshold judgement.

## The cause

`.github/workflows/codeql.yml:166-171`:

```yaml
concurrency:
  # PR force-push supersedes the previous run. Schedule runs
  # carry a distinct ref (`refs/heads/main` on cron) so they
  # do not cancel each other.
  group: codeql-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

The stated intent is right FOR PULL REQUESTS. On `main` every push shares
`refs/heads/main`, so the group is the same for every commit and each push
cancels the previous commit analysis. Pushes to `main` land faster than a
CodeQL analysis completes, so the analysis almost never finishes.

Measured on the workflow runs, independently of the analyses API: of the last
99 COMPLETED `codeql.yml` runs on `main`, **61 cancelled (62%)**, 38 success.
Two independent surfaces, the same ratio.

## Caught in the act, on security work

This was not inferred from a ratio. It happened to the tranche that found it,
three times in one hour:

```
34427573531  4dc0a3714  in_progress   <- PR #17175, a js/xss-through-dom FIX
34427150554  a7d8a9086  cancelled     <- carried four merged security fixes
34427065475  12170c610  cancelled     <- PR #17203 (shell injection)
34426765814  54ec04844  cancelled     <- PR #17201 (TOCTOU)
34426754523  cbc6335b1  cancelled
34426493322  35b23c98b  cancelled
```

Read the top two lines together: **one security fix merging cancelled the
analysis that would have verified four other security fixes.** The lane is
self-defeating under exactly the load it exists to handle -- the busier the
security work, the less of it gets analysed.

Consequence for this tranche: alerts 557, 558, 576, 577 (`js/file-system-race`)
and 288 (`js/shell-command-injection-from-environment`) are still `open` with
`fixed_at: null` after their fixes merged. That is NOT evidence the fixes
failed. Nothing has looked at them. The last successful javascript analysis is
commit `dac0086974` at 01:32:53Z, which sits BELOW all four merges.

## Why this is the worst class, not merely a slow one

For roughly two thirds of pushes, `main` alert state is a STALE READING that
presents as a current one. Both directions hurt, and the second is the
dangerous one:

- a FIX closure is delayed until some later push happens to win the race;
- a NEWLY INTRODUCED defect is invisible for the same interval.

`results: 0` in the analyses API is a check that did not run wearing the
appearance of one that passed -- the class this repo already names as its
worst, and the one
`src/Core.TypeScript/hygiene/lint-no-clean-sarif-for-skipped-analysis.ts`
was written for on 2026-08-27 after a synthetic clean SARIF falsely closed 102
alerts across 14 rules.

## The one thing keeping it safe is NOT ours

These uploads do not currently close alerts, because GitHub marks them
`unsuccessful execution` and declines to act on them. Nothing in this
repository produces that protection -- it is upstream behaviour we happen to
benefit from. The 2026-08-27 incident is what it looks like when it is absent.
Depending on an upstream implementation detail for a security invariant is a
standing exposure even while it holds.

## Proposed remedy -- NOT applied here, and why

One line, `.github/workflows/codeql.yml:171`:

```yaml
cancel-in-progress: ${{ github.event_name == pull_request }}
```

(the value being the literal string comparison; written without quotes here
only to keep this file YAML-quote-free). It preserves the PR force-push
behaviour the comment asks for and stops `main` pushes from cancelling each
other. Cost: concurrent CodeQL runs on `main`, i.e. minutes.

DELIBERATELY LEFT UNAPPLIED. Two reasons, and the second is the load-bearing
one:

1. CI workflow wiring is the devops lane; this lane audits what is wired.
2. A concurrency change cannot be verified inside the session that makes it.
   Confirming it worked requires watching several `main` pushes NOT cancel each
   other -- and the evidence channel for that is the very channel the change is
   meant to repair. Shipping it and declaring it fixed would be asserting the
   conclusion on the instrument under repair.

## How to check it worked, once someone does apply it

Re-run the measurement at the top. The ratio is the falsifier: if
`rules_count == 0` does not fall well below 65% of javascript analyses on
`main` over the following day, the change did not take. A green workflow run
is NOT the check -- cancelled runs already report a conclusion.

## The controlled comparison already exists in this repo

The remedy is not a hypothesis. A sibling workflow ALREADY RUNS THE PROPOSED
CONFIGURATION, against the same branch, under the same push rate, with a
same-shaped concurrency group:

```
scorecard.yml:68-70   group: ${{ github.workflow }}-${{ github.ref }}
                      cancel-in-progress: FALSE

codeql.yml:170-171    group: codeql-${{ github.workflow }}-${{ github.ref }}
                      cancel-in-progress: TRUE
```

Measured over the last 99 COMPLETED runs of each on `main`:

| workflow        | cancel-in-progress | cancelled    | success |
| --------------- | ------------------ | ------------ | ------- |
| `scorecard.yml` | `false`            | **3 (3%)**   | 95      |
| `codeql.yml`    | `true`             | **61 (62%)** | 38      |

Same repository, same branch, same commits, same group shape. The single
differing variable is the flag. This is as close to a controlled experiment as
CI substrate allows, and it was already running before anyone looked.

### And the asymmetry is the wrong way round

The consequence of that table is worse than a uniform gap. The two scanners do
not find the same class of thing:

- `scorecard.yml` -- cheap supply-chain posture (unpinned deps, token
  permissions, binary artifacts). **Runs 95 times out of 99.**
- `codeql.yml` -- dataflow analysis (injection, TOCTOU, XSS, prototype
  pollution). **Runs 38 times out of 99.**

So the cancellation is SEVERITY-WEIGHTED TOWARD THE DEEPER ANALYSIS. The
scanner that finds "you forgot a digest" is reliable; the scanner that finds
"an attacker reaches this write" is the one that never completes.

This tranche is the worked example, and it is why the split was visible at all:
every `PinnedDependenciesID` closure was confirmable within minutes
(690/714 `fixed_at 01:41:42Z`), while every `js/*` closure from the same hour
is still `unknown`. The two dispositions differ by which scanner had to run,
not by anything about the fixes.
