---
id: 081M3JG74G0087G0R001XJC837
type: bug
state: backlog
priority: P2
slug: platform-never-syncs-acme-email-and-portal-hostname-are-hard
title: "platform never syncs: ACME email and portal hostname are hardcoded example.com placeholders; make them install-time config (ESP -> prompt -> unset)"
created: 2026-09-27T22:36:51.584Z
depends_on: []
composes_with: []
---

# platform never syncs: ACME email and portal hostname are hardcoded example.com placeholders; make them install-time config (ESP -> prompt -> unset)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3JG74G0087G0R001XJC837-*.md` glob. -->

## Observed (bare-metal node, read-only kubectl)

ArgoCD app `platform` never finishes syncing. Both ClusterIssuers report
`Failed to register ACME account: 400 ... invalidContact ... contact email has forbidden domain "example.com"`;
the sync operation waits on `cert-manager.io/ClusterIssuer/letsencrypt-prod` health and retries forever, so
platform-controller, the portal StatefulSet, zeta-gateway, the HTTPRoute, PrometheusRule, ServiceMonitor and
the Blueprints are never applied. Cause: `platform/clusterissuer.yaml` (`you@example.com # ← CHANGE`),
`gateway.yaml` (`portal.example.com`) and `portal.yaml` (`portal.zeta.example.com`) — placeholders a generic
installer can never change.

## Fix

Install-time configuration, never a repo default. See `full-ai-cluster/INJECTION-POINTS.md` §10:
ESP conf (zflash `--acme-email` / `--public-domain`) -> start-of-install prompt -> UNSET. UNSET = platform
LAN-only with no issuer / certificate / hostname; SET = separate `platform-public-tls` Application rendered
by `nixos/modules/injected-public-tls.nix`.
