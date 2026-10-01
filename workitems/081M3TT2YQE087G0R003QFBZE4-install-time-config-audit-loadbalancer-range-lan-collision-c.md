---
id: 081M3TT2YQE087G0R003QFBZE4
type: task
state: backlog
priority: P1
slug: install-time-config-audit-loadbalancer-range-lan-collision-c
title: "Install-time config audit: LoadBalancer range, LAN collision check, placeholder lint"
created: 2026-10-01T04:03:15.822Z
depends_on: []
composes_with: []
---

# Install-time config audit: LoadBalancer range, LAN collision check, placeholder lint

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3TT2YQE087G0R003QFBZE4-*.md` glob. -->

Goal: a USB installer that installs and first-boots on a different network with no post-install
hand-editing. Inventory of every environment-specific value that breaks a fresh install, and the
highest-impact ones moved to install time by the #17712 mechanism (ESP conf -> prompt -> UNSET,
`/etc/zeta/<file>` -> `injected-*.nix` -> separate ArgoCD Application).

Landed with this item: `docs/ops/INSTALL-TIME-CONFIG.md` (the table), `zflash --lb-pool` + the
installer's LoadBalancer range (refused before the wipe if it cannot work on the measured LAN or
already answers), the pod/service-CIDR-vs-LAN collision refusal, and
`lint-rendered-manifest-placeholders.ts` (fail-closed scan of every applied manifest and both
rendered install-time templates).

Still open (see the table's OPEN rows): GitLab LAN pin `192.168.1.250` must follow the resolved
range (gitlab lane), ArgoCD tracks `main` while the node is pinned to the ISO commit, headscale
`.zeta.local`, `postgres` Blueprint `change-me`, hat-system `:placeholder` image, console password
default. Nothing here has been booted (no nix, no QEMU).
