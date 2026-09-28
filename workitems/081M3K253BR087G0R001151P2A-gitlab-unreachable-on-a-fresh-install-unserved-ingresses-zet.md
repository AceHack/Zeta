---
id: 081M3K253BR087G0R001151P2A
type: bug
state: backlog
priority: P2
slug: gitlab-unreachable-on-a-fresh-install-unserved-ingresses-zet
title: "GitLab unreachable on a fresh install: unserved Ingresses, zeta.local external URL, runner registration-token crash loop, gitaly SSA refusal"
created: 2026-09-28T03:50:19.256Z
depends_on: []
composes_with: []
---

# GitLab unreachable on a fresh install: unserved Ingresses, zeta.local external URL, runner registration-token crash loop, gitaly SSA refusal

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3K253BR087G0R001151P2A-*.md` glob. -->

## Measured (2026-09-27, freshly reinstalled bare-metal node, read-only kubectl)

- Three Ingresses of class `gitlab-nginx`; the cluster's only IngressClass is `cilium`, so none
  got an address and ArgoCD held the gitlab sync at Progressing on their health.
- GitLab advertised `https://gitlab.gitlab.zeta.local` (nothing resolves it, nothing terminates
  TLS); the bundled runner registered against it, failed on DNS and PANICked, using the
  registration-token flow GitLab 17 disables by default.
- StatefulSet `gitlab-gitaly` was never created: SSA refused the chart's duplicate `TZ` env key.
  `gitlab-postgresql` / `gitlab-redis-master` read OutOfSync (SSA volumeClaimTemplates drift).

## Fix

- Ingress off; web + registry are HTTPRoutes on a dedicated hostname-less `gitlab-lan` Gateway
  pinned to `192.168.1.250` (last LB-pool address). UNSET external URL `http://192.168.1.250/`.
- SET (install-time public domain): `platform-public-tls` adds `gitlab.<domain>` /
  `registry.<domain>` listeners + routes and patches the gitlab Application's helm parameters
  (root ignores that one field) so the external URL is `https://gitlab.<domain>`.
- Runner: in-cluster `gitlabUrl`, authentication-token flow, token minted by a Sync-hook Job
  through the toolbox's Rails (non-blocking; prints the operator step on failure).
- gitlab Application uses client-side apply. KAS disabled.

Falsifiers: `src/Core.TypeScript/cluster/gitlab-exposure.test.ts`, `public-tls.test.ts` (d).
