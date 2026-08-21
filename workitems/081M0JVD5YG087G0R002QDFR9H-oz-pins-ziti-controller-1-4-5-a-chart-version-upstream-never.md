---
id: 081M0JVD5YG087G0R002QDFR9H
type: bug
state: backlog
priority: P2
slug: oz-pins-ziti-controller-1-4-5-a-chart-version-upstream-never
title: "oz pins ziti-controller 1.4.5, a chart version upstream never published -- the Application cannot resolve"
created: 2026-08-21T19:05:18.544Z
depends_on: []
composes_with: []
---

# oz pins ziti-controller 1.4.5, a chart version upstream never published -- the Application cannot resolve

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0JVD5YG087G0R002QDFR9H-*.md` glob. -->

## Measured

`full-ai-cluster/k8s/applications/oz/Application.yaml`:

    :19   repoURL: https://docs.openziti.io/helm-charts/
    :20   chart: ziti-controller
    :21   targetRevision: 1.4.5

Checked against the upstream index at that exact repoURL: **`ziti-controller`
1.4.5 does not exist.** The published 1.x line ends at **1.3.4** (2025-05-01).
`1.4.2` exists upstream only as an *appVersion*, not a chart version — which is
the likely origin of the mistake: an app version copied into a chart-version
field.

ArgoCD cannot resolve a chart version that was never published, so this
Application cannot sync at all. It is not a drift or a deprecation; the
coordinate has never been valid.

## Why nobody noticed

`oz` is not in the included dev/CI proof, so nothing ever attempted to resolve
its chart. This is the cost of the 26-of-45 exclusion surface: an Application
can carry a coordinate that has never once been resolved by anything, and no
check says so.

The general form is worth more than this instance: **nothing in the tree
verifies that a pinned `chart`+`targetRevision` is actually published.** Every
Application sourcing a remote Helm chart carries that risk, and a typo in a
version field is indistinguishable from a correct pin until something tries to
sync it. A resolvability check over every remote-chart Application would catch
this class rather than this row.

## Not fixed here

Choosing the replacement is a product call, not a mechanical one: 1.3.4 is the
newest 1.x, but there are published 2.x and 3.x lines, and moving major
versions is a decision about OpenZiti's own compatibility rather than about this
field. Recorded so the choice is made deliberately.

## Provenance

Found by the day-zero chart-requirements research (PR #13309) while pulling
every pinned chart at its exact `targetRevision` — eleven of twelve resolved;
this was the twelfth. Independently re-verified against the upstream index
before filing.

