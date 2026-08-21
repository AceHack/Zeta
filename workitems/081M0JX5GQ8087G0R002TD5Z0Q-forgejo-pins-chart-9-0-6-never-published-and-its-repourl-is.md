---
id: 081M0JX5GQ8087G0R002TD5Z0Q
type: bug
state: backlog
priority: P2
slug: forgejo-pins-chart-9-0-6-never-published-and-its-repourl-is
title: "forgejo pins chart 9.0.6 -- never published -- and its repoURL is a dead http repo (chart is OCI-only now)"
created: 2026-08-21T19:36:04.584Z
depends_on: []
composes_with: []
---

# forgejo pins chart 9.0.6 -- never published -- and its repoURL is a dead http repo (chart is OCI-only now)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0JX5GQ8087G0R002TD5Z0Q-*.md` glob. -->

## Measured (2026-08-21)

`full-ai-cluster/k8s/applications/forgejo/Application.yaml`:

    :26   repoURL: https://code.forgejo.org/forgejo-helm/
    :27   chart: forgejo
    :28   targetRevision: 9.0.6

**Two independent defects, either of which alone stops the sync.**

### 1. The repoURL is not a Helm repository any more

- `https://code.forgejo.org/forgejo-helm/index.yaml` -> **HTTP 404**
- `https://code.forgejo.org/api/packages/forgejo-helm/helm/index.yaml` -> HTTP 200 with
  **`entries: {}`** — the classic HTTP chart repo exists and is empty.

The chart is OCI-only now: `helm install forgejo oci://code.forgejo.org/forgejo-helm/forgejo`
(README at <https://code.forgejo.org/forgejo-helm/forgejo-helm>).

### 2. Chart version `9.0.6` was never published

Read from the OCI tag list `https://code.forgejo.org/v2/forgejo-helm/forgejo/tags/list`
(anonymous pull token; **169 tags, unbroken history from `0.0.1` to `17.1.5`** — nothing pruned):

- the **`9.x` line contains exactly one release: `9.0.0`**. The next published version is `10.0.0`.
- `9.0.6` is **not an appVersion either**. Chart majors are offset one ahead of the app, read
  straight from the OCI config blobs:

  | chart | appVersion |
  |---|---|
  | `8.2.3` | `8.0.3` |
  | `9.0.0` | `8.0.3` |
  | `10.0.0` / `10.1.0` / `10.1.1` / `10.1.2` | `9.0.0` / `9.0.1` / `9.0.2` / `9.0.3` |
  | `11.0.0` | `10.0.0` |
  | `17.1.5` (latest) | `15.0.7` |

  The Forgejo `9.0.x` app line tops out at `9.0.3`, so `9.0.6` corresponds to nothing at all.

## Why this matters beyond one Application

This is the **second** instance of the same class in one survey. `oz` pins `ziti-controller 1.4.5`,
which is an *appVersion*-shaped guess (`081M0JVD5YG087G0R002QDFR9H` / PR #13313); this one is an
appVersion-shaped guess that is not even an appVersion. Both survived review because the number
*looks* like it belongs to the right numbering scheme. A pin that was never published is not drift —
it is a coordinate that has never once resolved, and nothing in the repo notices.

## Fix (three separate decisions, none of them a bump)

1. `repoURL` -> `oci://code.forgejo.org/forgejo-helm` with `chart: forgejo` (ArgoCD OCI Helm source).
2. Choose a real chart version.
3. If the target is current (`17.1.5`), that is an **eight-major** upgrade path from the `9.x` line;
   the chart README carries `To v10` ... `To v17` sections. This needs a human decision.

## Evidence

- `docs/research/2026-08-21-every-remote-helm-chart-pin-surveyed-against-its-own-upstream-index-two-were-never-published.md` §3.2

