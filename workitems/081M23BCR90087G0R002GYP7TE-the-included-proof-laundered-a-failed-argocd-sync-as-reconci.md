---
id: 081M23BCR90087G0R002GYP7TE
type: bug
state: backlog
priority: P2
slug: the-included-proof-laundered-a-failed-argocd-sync-as-reconci
title: "the included proof laundered a failed ArgoCD sync as reconciled whenever health was Healthy"
created: 2026-09-09T15:08:14.496Z
depends_on: []
composes_with: []
---

# the included proof laundered a failed ArgoCD sync as reconciled whenever health was Healthy

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M23BCR90087G0R002GYP7TE-*.md` glob. -->


## The gap

`isApplicationSynced` accepts `OutOfSync + Healthy` for two documented and
legitimate reasons: benign StatefulSet drift on Helm apps, and benign manifest
drift on git-directory apps. Both are real. What neither anticipated is that
ArgoCD assesses health PER RESOURCE KIND, and a kind it has no health check
for contributes nothing. So an Application whose sync genuinely FAILED, and
whose unapplied resources are all health-less kinds, presents as
`OutOfSync + Healthy` -- byte-identical, to every predicate in the file, to an
app that synced cleanly and drifted afterwards.

## Measured, on the lane this file is the proof for

`hat-system` in run `34323056405` carried

    SyncError: Failed last sync attempt to [c73cc49e...]: one or more
    synchronization tasks completed unsuccessfully (retried 10 times).

with all seven Gatekeeper Constraints `OutOfSync`. The same seven were
unapplied in run `34338106811`, which the proof PASSED. A policy engine with
zero installed policies read as reconciled in a green run, and had done for as
long as the lane has existed. The cause of that particular sync failure is
081M23B24P5087G0R002BJWEN1; this row is about the proof being unable to SEE
it.

## Fixed

`applicationOutcome` now refuses any auto-sync Application carrying a
`SyncError` condition, before the `OutOfSync + Healthy` allowances are
consulted. The condition is ArgoCD stating the failure rather than us
inferring it from two status strings that cannot carry it.

Deliberately NOT terminal: ArgoCD retries and clears the condition on a
successful sync, so an app carrying one stays a laggard and the wait keeps
waiting. A transient failure still self-heals; only one that survives the
timeout fails the proof.

Deliberately scoped to the auto-sync contract. A declared manual-sync app is
judged by `manualSyncAssertion`, a weaker contract on purpose, and a test pins
that the new branch does not reach it -- widening the auto contract must not
silently widen the manual one.

## Mutation-tested

| mutant | result |
|---|---|
| refusal disabled (`if (false && ...)`) | 3 tests fail |
| empty `SyncError` message reads as no failure | 1 test fails |
| any condition type counts as a sync failure | 1 test fails |

Restored: 111 pass, 0 fail.
