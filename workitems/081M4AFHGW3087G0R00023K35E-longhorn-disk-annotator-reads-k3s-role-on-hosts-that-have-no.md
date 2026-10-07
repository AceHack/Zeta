---
id: 081M4AFHGW3087G0R00023K35E
type: bug
state: backlog
priority: P2
slug: longhorn-disk-annotator-reads-k3s-role-on-hosts-that-have-no
title: "Longhorn disk annotator reads k3s.role on hosts that have no k3s module"
created: 2026-10-07T06:06:49.731Z
depends_on: []
composes_with: []
---

# Longhorn disk annotator reads k3s.role on hosts that have no k3s module

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M4AFHGW3087G0R00023K35E-*.md` glob. -->

## Acceptance

`longhorn-disks.nix` reads `config.services.k3s.role or "server"`. A host that
imports this module without nixpkgs' k3s module (ISO flake eval; the
registration eval stub) evaluates the annotator script instead of throwing
`attribute 'role' missing`. An agent still gets the kubelet kubeconfig; a
server still gets `/etc/rancher/k3s/k3s.yaml`.

Do not lengthen WP11 (4500s). Do not complete `081M23ESC5B087G0R002HJ39DG`.

## Measured failure

Scheduled `build-ai-cluster-iso` run 37577095629 on `eb6879f0`
(`gate (required)` green): both `build-iso` and
`build-iso-aarch64 + qemu-boot` died at `Check flake evaluates`:

`error: attribute 'role' missing` at
`full-ai-cluster/nixos/modules/longhorn-disks.nix:214`
(`if config.services.k3s.role == "agent"`).

## Prior-art search

- `#17922` / `081M48Z020C087G0R001E6M83V` — the agent kubeconfig switch. Correct
  on a k3s agent; unguarded `.role` on every other importer.
- `injected-storage-profile.nix` — `config.services.k3s.enable &&
  config.services.k3s.role == "server"` (still assumes the k3s module).
- Nix `or` on a missing attribute. The registration eval stub declares
  `services.k3s.extraFlags` and not `role`; forcing `.script` is the
  falsifier.

## Dependency check

`depends_on:` empty. USB-ladder acting-on-hardware hop is a ranked remainder,
not this.
