---
id: 081M0KRQP56087G0R000BK28QS
type: task
state: backlog
priority: P2
slug: reason-truth-make-a-deferral-reason-s-cited-anchors-mechanic
title: "Reason-truth: make a deferral reason's cited anchors mechanically checkable"
created: 2026-08-22T03:37:51.526Z
depends_on: []
composes_with: []
---

# Reason-truth: make a deferral reason's cited anchors mechanically checkable

## The defect

Every reasoned-exclusion registry in the cluster tree is audited for a reason
being PRESENT and naming a lift condition. Nothing checked that a reason was
TRUE. `auditDevExclusionReasons` says so about itself:

> all four directions check that a reason is PRESENT and names a lift condition.
> NONE of them checks that the reason is TRUE.

Three measured instances inside 36 hours, each a reason that was false while
every audit over it stayed green:

| reason              | what it cited                         | what retired it                                                  | caught by                                          |
| ------------------- | ------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------- |
| `temporal` (#13472) | a `helm-template-failed` baseline row | #13469, 40 minutes earlier                                       | a person, next day (#13483)                        |
| `oz` (#13313)       | chart pin `1.4.5` + "not drop-in"     | #13471 corrected the pin and rendered all four versions          | a person                                           |
| `gitlab`            | the same `helm-template-failed` row   | #13471 landed `configureCertmanager: false`; the row was DELETED | **this check**, on the tree it was written against |

## What shipped

`src/Core.TypeScript/cluster/reason-truth.ts` — a reason may carry TYPED
citations (`[cite: <kind> <args>]`), each resolved against an artifact the tree
already holds: a baseline acknowledgement, the measured render snapshot, a chart
pin, the published-version roster, a repo path + line, the dev-catalog
`excludeGlob`, a CI job name. A citation the tree refutes is a finding; so is one
nothing can decide (no snapshot, a roster that does not cover the chart, an app
the snapshot never measured).

Polarity is DECLARED, never inferred from prose — `unrenderable` and
`no-unrenderable` are one token apart and mean opposite things — because the
current `temporal` reason names `helm-template-failed` in order to say the row
was retired, and any scanner that reddens on the token reddens the honest
correction.

`unbound-identifier` closes the dodge: naming a render failure class in prose
while citing nothing for that app is refused.

## What it does not do

Free prose about behaviour nobody measures stays unchecked, is counted as
`uncited`, and is never reported as verified. Building a prose matcher here
would be a new vacuity wearing the cure's name.

## Adjacent defect found and fixed

The render snapshot said `appsDiscovered: 53` against a tree of 54
(`spire-crds`, #13488, renders no PVC), and `--check-snapshot` printed "snapshot
matches the live render" — every drift loop compares ROWS, so an app with no rows
is invisible to all of them. `snapshotDrift` now compares coverage; the snapshot
was re-measured (a one-line diff, 53 -> 54, which is itself the proof the
re-measure changed nothing else).
