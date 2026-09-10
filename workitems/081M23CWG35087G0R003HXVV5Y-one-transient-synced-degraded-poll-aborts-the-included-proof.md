---
id: 081M23CWG35087G0R003HXVV5Y
type: bug
state: backlog
priority: P2
slug: one-transient-synced-degraded-poll-aborts-the-included-proof
title: "one transient Synced/Degraded poll aborts the included proof 2277 seconds early"
created: 2026-09-09T15:34:18.981Z
depends_on: []
composes_with: []
---

# one transient Synced/Degraded poll aborts the included proof 2277 seconds early

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M23CWG35087G0R003HXVV5Y-*.md` glob. -->


## What happened

Run `34369317553` (main, `de612352`). The included proof aborted at **T+123 s of
a 2400 s budget** on `openziti-controller=Synced/Degraded`. The cluster events
captured seconds later, in the same job:

    49s  Updated health status: Progressing -> Degraded
    32s  Updated health status: Degraded -> Progressing

It had already left Degraded when the abort was printed. **2277 seconds of budget
went unspent on an Application that was recovering.**

## The same Application did this before

`degradedHealthTerminalFailure`'s own docstring records run `33830308187`: the
wait aborted on `openziti-controller=OutOfSync/Degraded` while the pod was still
`Init:0/1`, and "events after the abort went Degraded -> Progressing -> Synced".
The remedy then was to narrow the rule from any Degraded to `Synced/Degraded`.

That narrowing was right, and it was not enough. The defect was never WHICH sync
status accompanies the Degraded -- it was **trusting one sample**.

## Fixed

The abort now needs the SAME Application degraded on **two consecutive polls**.
The fail-fast property is kept: a genuinely dead workload is still abandoned
after roughly one poll interval (15 s in CI) instead of 2400 s. What is removed
is the single-sample false positive.

Consecutive POLLS rather than elapsed time, deliberately, so the guarantee does
not silently change when `--poll-sec` moves.

## Mutation-tested

| mutant | tests failed |
|---|---|
| confirmation removed (back to one sample) | 2 |
| any app degrading confirms any earlier one | 1 |

The source-grepping guard that asserts the wait loop CALLS the abort was updated
to match the new call rather than the old identifier -- a guard still matching
`degradedHealthTerminalFailure(lastVerdicts)` would have passed over exactly the
regression it exists to catch.

## Still open

WHY `openziti-controller` flaps Progressing -> Degraded -> Progressing during
bring-up is not diagnosed here. Under the old behaviour the lane could not stay
up long enough to find out; now it can.
