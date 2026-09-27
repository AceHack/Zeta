---
id: 081M3HPNST9087G0R001X410AE
type: bug
state: backlog
priority: P2
slug: first-boot-bootstrap-helmcharts-fetch-charts-from-five-repo
title: "First-boot bootstrap HelmCharts fetch charts from five repo hosts at runtime; the image preload does not cover them and an unreachable repo retries with nothing on the console"
created: 2026-09-27T15:10:29.193Z
depends_on: []
composes_with: ["081M3BWJ96T087G0R0028WT3S3"]
---

# First-boot bootstrap HelmCharts fetch charts from five repo hosts at runtime; the image preload does not cover them and an unreachable repo retries with nothing on the console

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3HPNST9087G0R001X410AE-*.md` glob. -->

## The condition

Found by the first-boot dependency inventory (081M3BWJ96T087G0R0028WT3S3,
`docs/ops/FIRST-BOOT-EXTERNAL-DEPENDENCIES.md` rows 16 and 17). Read from source,
**not measured**.

WP34 preloads the 26 bootstrap **images** into the ISO, and
`bootstrap-preload-blackhole.ts` proves they resolve with every registry in that set
blackholed. Two things the same first boot still needs from the network are outside
that proof:

1. **Chart tarballs.** Every bootstrap `HelmChart` carries a `repo:` URL
   (`full-ai-cluster/k8s/bootstrap/{argocd,cert-manager,trust-manager,cilium,external-secrets,spire}-install.yaml`)
   — five hosts: `argoproj.github.io`, `charts.jetstack.io`, `helm.cilium.io`,
   `charts.external-secrets.io`, `spiffe.github.io`. The `helm-install-<chart>` Job
   fetches the chart at run time. An unreachable repo means the Job fails and
   helm-controller retries; nothing reaches the console.
2. **k3s's own built-in images** (`rancher/mirrored-pause`, coredns, metrics-server,
   `klipper-helm`, `klipper-lb`) — deliberately not preloaded
   (`full-ai-cluster/nixos/modules/k3s-bootstrap-image-preload.nix:60`), served via
   `mirror.gcr.io` for docker.io. Without pause no pod sandbox starts; without
   `klipper-helm` no chart Job starts, preload or not.

So `zeta-install.sh`'s `[wp34]` line "the bootstrap charts come up even if quay.io /
ghcr.io / registry.k8s.io are unreachable" is true for those registries and not for
the chart hosts or docker.io.

## Candidate fixes (not chosen here)

- `HelmChart.spec.chartContent` (base64 chart tgz) generated at ISO build time from
  the pinned versions, so the Job needs no repo.
- nixpkgs' `k3s.airgapImages` into the same agent images dir (~150 MB, per the module
  header's own estimate).

## Falsifier

Extend the blackhole lane: blackhole the five chart hosts and docker.io/mirror.gcr.io
as well, with the same negative control (empty images dir, no chartContent) that must
go red.
