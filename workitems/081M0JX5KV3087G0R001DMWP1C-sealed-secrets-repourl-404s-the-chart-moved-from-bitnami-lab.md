---
id: 081M0JX5KV3087G0R001DMWP1C
type: bug
state: backlog
priority: P2
slug: sealed-secrets-repourl-404s-the-chart-moved-from-bitnami-lab
title: "sealed-secrets repoURL 404s -- the chart moved from bitnami-labs to bitnami and the Application cannot resolve"
created: 2026-08-21T19:36:07.779Z
depends_on: []
composes_with: []
---

# sealed-secrets repoURL 404s -- the chart moved from bitnami-labs to bitnami and the Application cannot resolve

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0JX5KV3087G0R001DMWP1C-*.md` glob. -->

## Measured (2026-08-21)

`full-ai-cluster/k8s/applications/sealed-secrets/Application.yaml`:

    :15   repoURL: https://bitnami-labs.github.io/sealed-secrets
    :16   chart: sealed-secrets
    :17   targetRevision: 2.16.2

- `https://bitnami-labs.github.io/sealed-secrets/index.yaml` -> **HTTP 404**
- `https://bitnami-labs.github.io/sealed-secrets/` (Pages root) -> **HTTP 404**

The project moved from the `bitnami-labs` org to `bitnami`. At the new home:

- `https://bitnami.github.io/sealed-secrets/index.yaml` -> HTTP 200, **87 `sealed-secrets` entries**
- the pinned **`2.16.2` is published there**, unchanged
- latest is `2.19.3` (appVersion `0.39.1`, published 2026-08-20) — 20 versions ahead, **same major**

Upstream announcement, which names the ArgoCD `repoURL` edit explicitly:
<https://github.com/bitnami/sealed-secrets/issues/1982> — "ANNOUNCEMENT: Repository moving to
bitnami/sealed-secrets – Action Required for Helm Users".

## Why this is the cheapest fix in the roster

ArgoCD cannot resolve the Application at all today, and the correction requires **no version
decision**: point `repoURL` at `https://bitnami.github.io/sealed-secrets` and keep
`targetRevision: 2.16.2`. Whether to then take `2.19.3` is a separate, ordinary same-major bump.

Note this is a *third* failure mode alongside the two never-published pins found in the same survey
(`oz` `081M0JVD5YG087G0R002QDFR9H`, `forgejo` `081M0JX5GQ8087G0R002TD5Z0Q`): the version is fine,
the **address** rotted. A resolvability check has to test the repo, not only the version.

## Evidence

- `docs/research/2026-08-21-every-remote-helm-chart-pin-surveyed-against-its-own-upstream-index-two-were-never-published.md` §3.3

