---
id: 081M0JX4M7H087G0R0029R5QG6
type: bug
state: backlog
priority: P2
slug: two-argocd-chart-repourls-do-not-resolve-sealed-secrets-page
title: "Two ArgoCD chart repoURLs do not resolve: sealed-secrets Pages site is gone, forgejo moved to OCI (and 9.0.6 never existed)"
created: 2026-08-21T19:35:35.409Z
depends_on: []
composes_with: []
---

# Two ArgoCD chart repoURLs do not resolve: sealed-secrets Pages site is gone, forgejo moved to OCI (and 9.0.6 never existed)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0JX4M7H087G0R0029R5QG6-*.md` glob. -->

## What was measured

Found by `src/Core.TypeScript/hygiene/audit-chart-target-revisions.ts --refresh`
on 2026-08-21, the first time anything in this repo asked those two upstream
repositories for a chart. Both are `repository-unreachable`: the coordinate in
the manifest is not a Helm repository at all, so no `targetRevision` under it
can resolve and neither Application can ever sync.

### 1. `sealed-secrets` — the Pages site no longer exists

`full-ai-cluster/k8s/applications/sealed-secrets/Application.yaml`

```
repoURL: https://bitnami-labs.github.io/sealed-secrets
targetRevision: 2.16.2
```

`GET https://bitnami-labs.github.io/sealed-secrets/index.yaml` → **HTTP 404**,
and the site root returns GitHub Pages' "Site not found". Upstream's own README
(`bitnami-labs/sealed-secrets`, line 305) now says:

```
helm repo add sealed-secrets https://bitnami.github.io/sealed-secrets
```

— `bitnami.github.io`, no `-labs`. That index **does** carry `version: 2.16.2`,
so the pinned version is fine and only the repository host is wrong. Checked,
not assumed: 87 versions listed there, 2.16.2 among them.

### 2. `forgejo` — chart is OCI-only, and 9.0.6 was never published

`full-ai-cluster/k8s/applications/forgejo/Application.yaml`

```
repoURL: https://code.forgejo.org/forgejo-helm/
targetRevision: 9.0.6
```

`GET https://code.forgejo.org/forgejo-helm/index.yaml` → **HTTP 404**. That path
is a Forgejo _organisation page_, not a chart repository. Upstream's install
instructions are OCI:

```
helm install forgejo oci://code.forgejo.org/forgejo-helm/forgejo
```

This one is a **double** defect: correcting the protocol is not enough. The OCI
tag list for `forgejo-helm/forgejo` holds 169 tags and the 9.x line is exactly
`9.0.0` — **there is no 9.0.6**. The nearby lines are 10.0.0–10.1.2 and
11.0.0–11.0.5, i.e. two majors on from the pin.

## Why this is not fixed in the PR that found it

Same reason as 081M0JVD5YG087G0R002QDFR9H (the `oz` pin): choosing what a
cluster Application deploys is the maintainer's call, not the auditor's.
`sealed-secrets` is close to mechanical (host only), but `forgejo` requires
picking between 9.0.0, the 10.x line, and the 11.x line, each of which moves the
chart's values schema under a manifest whose `valuesObject` is hand-written.

Both are recorded in `ACKNOWLEDGED_UNPUBLISHED` in
`src/Core.TypeScript/hygiene/audit-chart-target-revisions.ts`, which **prints
them on every run** and goes red the moment either pin changes to something else
that does not resolve, or either acknowledgement outlives its defect.

## Done when

- Both Applications carry a coordinate the audit resolves.
- Both `ACKNOWLEDGED_UNPUBLISHED` entries are deleted (the audit fails on a
  stale acknowledgement, so this is enforced, not remembered).
