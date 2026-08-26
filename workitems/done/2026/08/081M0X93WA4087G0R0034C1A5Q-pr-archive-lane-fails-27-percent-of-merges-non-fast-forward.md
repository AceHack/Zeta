---
id: 081M0X93WA4087G0R0034C1A5Q
type: bug
state: done
priority: P2
slug: pr-archive-lane-fails-27-percent-of-merges-non-fast-forward
title: "pr-archive lane fails ~27 percent of merges - non-fast-forward buffer fetch, silent under --quiet, retry defeated by set -e"
created: 2026-08-25T20:17:18.148Z
completed: 2026-08-26T09:24:22.090Z
depends_on: []
composes_with: []
---

# pr-archive lane fails ~27 percent of merges - non-fast-forward buffer fetch, silent under --quiet, retry defeated by set -e

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0X93WA4087G0R0034C1A5Q-*.md` glob. -->

## Symptom

`pr-archive-on-merge` failed 8 of its last 30 runs (~27%), measured 2026-08-25.
Failures **interleave** with successes rather than clustering. Every failure is
the same two lines:

```
[archive] attempt 1/5 for PR #15394
flush-via-staging: fetch heartbeat/pr-archive-buffer failed:
##[error]Process completed with exit code 3.
```

Note what is missing: a reason after `failed:`, and attempts 2 through 5.

Each failure is a **silently undelivered archive record**. The workflow is
deliberately built so a failed publish goes RED rather than exiting 0 with a
stranded ref, so the loud failure was correct — but the cause was unreadable, so
across all 8 occurrences nobody could act on it.

## Root cause 1 — a missing `+` on the fetch refspec

`flush-via-staging.ts:prepare` fetched the lane buffer as:

```ts
git("fetch", "origin", `${candidate}:refs/remotes/origin/${candidate}`, "--quiet")
```

A lane buffer is a **disposable aggregate**: every flush does
`checkout -B staging-<lane> origin/main` and republishes, so the ref is
**rewritten**, not advanced. The calling workflows check out with
`fetch-depth: 0`, so `refs/remotes/origin/<candidate>` is already populated when
`prepare` runs. Without a leading `+`, git refuses the non-fast-forward update to
that remote-tracking ref and exits non-zero.

That makes the failure **conditional on another PR's archive flushing between
this job's checkout and its fetch** — which is exactly the interleaved,
~27%-of-the-time shape observed.

Reproduced standalone before any fix was written:

| form | exit | output |
|---|---|---|
| `buf:refs/remotes/origin/buf --quiet` (shipped) | **1** | *(completely empty)* |
| `+buf:refs/remotes/origin/buf --quiet` | 0 | — |

Forcing is **correct**, not a workaround: a remote-tracking ref exists to mirror
the remote, rewrites included. `CLAUDE.md` already documents the heartbeat fetch
in precisely this form (`+refs/heads/heartbeat/*:...`); this call was the one that
did not follow it.

## Root cause 2 — `--quiet` hid the reason

`--quiet` suppresses git's ref-update report, which is the **only** place the
`! [rejected] (non-fast-forward)` line appears. So `fetched.stderr || fetched.stdout`
were both empty and the message printed `failed: ` with nothing after it. Removed
here, and the error now also reports the exit status and says so explicitly when
git produced no output at all.

## Root cause 3 — the 5-attempt retry never retried

In `pr-archive-on-merge.yml` the step runs under `set -euo pipefail`. The `flush`
call was guarded with `set +e`/`rc=$?`/`set -e`; the `prepare` call was **not**.
So a non-zero `prepare` aborted the whole script on attempt 1 — the backoff, the
`::error` annotation and its operator guidance were all unreachable.

Verified behaviourally by running the workflow's own extracted script against a
stub that fails `prepare`:

| shape | observed |
|---|---|
| shipped | `attempt 1/5`, then nothing |
| patched | `attempt 1/5` … `5/5`, then the `::error` annotation |

This is the **only** lane with a retry loop. The other eleven call `prepare` as a
standalone step where a hard failure is the correct outcome, so they are untouched.

## Blast radius of the fix

Root causes 1 and 2 are in `prepare`, which **all twelve lanes** use
(tick-metrics, society, drift-sweep, red-state, budget-snapshot, search-index,
lockfile-healer, context-cost-trend, drift-dashboard, manifesto-citation-snapshot,
zetadb-scheduled-node, pr-archive). Any of them could hit the same rejection.

## Falsifiers

- `flush-via-staging.test.ts` §"prepare survives a REWRITTEN lane buffer
  (non-fast-forward)" — real git: full clone, buffer force-updated underneath,
  `prepare` must return 0 and adopt the new generation. Removing the `+` makes it
  fail with exactly `Expected: 0 / Received: 3`, the CI exit code.
- The test asserts the ref actually **moved** and the new content is present, not
  just that the exit code was 0 — asserting only the code would still pass if the
  fetch were deleted outright.

## Not fixed here

The generator call (`archive-pr-reviews.ts`) inside the loop is still unguarded.
It is not a contention failure and has never been observed failing; left
deliberately, and named in a comment so it reads as a choice rather than an
oversight.

## Follow-up: the workflow fix now has a permanent falsifier, and the sweep is clean

The first commit fixed root cause 3 but proved it only by hand, with a throwaway
stub. Nothing in the repo stopped it regressing. Closed:

`flush-via-staging.test.ts` §"the pr-archive retry loop retries (the workflow's own
script, real bash)" extracts the step's `run` **from the yaml** — not a retyped
copy, so it cannot drift from what CI executes — neutralises only the backoff, and
runs it under stubs where `prepare` always exits 3. It asserts all five attempts
appear *and* that the `::error` annotation fires. Restoring the unguarded call
fails it with exactly one attempt observed.

**Swept the other seven workflows carrying retry loops** (`arc-lane`, `gate`,
`helm-validate`, `interp-lane`, `k8s-lane-partition`, `lint-autofix`,
`wsl-install-sh-test`) for the same defect. **None share it.** Every one uses
`if cmd; then ... fi`, where `set -e` does not apply because the command sits in an
`if` condition. A first-pass grep for `set -e` + loop + no `set +e` flagged all of
them; that heuristic is wrong and the flags were false positives.

`pr-archive` was unique in invoking a command bare and capturing `rc` separately —
and it did that correctly for `flush` and not for `prepare`.

## Self-inflicted regression, caught and fixed

The retry-loop falsifier above originally imported `yaml` to pull the step's
`run:` block out of the workflow. That broke a stated invariant:

> `.github/workflows/pr-manifest-integrity.yml`:
> **"No bun install step: these tests import node builtins and repo-local modules only."**

So the import was not a missing package — it was a package that is never
installed for that job. And it failed in the worst available shape:

```
error: Cannot find package 'yaml' from '.../flush-via-staging.test.ts'
```

A bare import error **drops every test in the file** rather than failing one.
The job reported **289 tests where it should have reported 339** — a *shrinking
pass count*, which reads like a green run to anyone not counting. That is the
vacuity class arriving through the harness instead of through an assertion.

Fixed by slicing the block from the raw text with builtins only
(`archiveRunBlock`), anchored on `max_attempts=5` and widened by indentation.
The extraction is itself checked — `expect(script).toContain("max_attempts")`
and `toContain("[archive] attempt")` — because a bad slice would otherwise yield
an empty script that runs, prints nothing, and passes nothing.

Verified: every import in `src/Core.TypeScript/forge-host/github/*.test.ts` is
now `bun:test` or `node:*`, and the workflow's own two commands give 339 + 120
pass, 0 fail. Break-red on the retry guard still fails as designed.

## POST-MERGE VERIFICATION 2026-08-26T09:25Z -- the fix holds

PR #15517 merged to `main` at 08:10:23Z. Measured `pr-archive-on-merge` runs since:

| window | completed runs | failures | rate |
|---|---|---|---|
| before the merge (same listing) | 10 | 1 | 10% |
| **after the merge** | **18** | **0** | **0%** |
| originally reported | 30 | 8 | 27% |

**The window covers the failing condition, which is the part that matters.** The defect
needed another lane flush to land between this job's checkout and its fetch, so a quiet
window would prove nothing. Nine of the eighteen runs started within 120 s of the previous
one and the tightest gap was **3 seconds** -- tighter than the 29 s spacing (19:39:19 vs
19:39:48) that produced the originally-observed failure. The contention was present and no
run failed.

`P(18 consecutive successes | 27% failure rate) = 0.73^18 = 0.0038`, so this is not a quiet
patch.

**Honest limits.** Eighteen runs is not a season, and several are `[telemetry-flush]` ticks
whose contention profile may differ from a human PR merge. The stronger evidence is not
this count at all -- it is that the mechanism was identified (a rewritten ref refused
without `+`), reproduced standalone before any fix was written, and pinned by a falsifier
that fails with the exact CI exit code when the `+` is removed. The run counts corroborate
a diagnosis; they did not produce it.

**Not repaired by this row, and still true:** records lost before the fix stay lost until
the `--all-merged --limit 15` backfill reaches them. Whether that backfill drains faster
than it fills remains open.
