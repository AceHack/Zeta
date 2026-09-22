---
id: 081M33RD7PW087G0R0011EVZYQ
type: task
state: done
priority: P2
slug: image-resolvability-checker-verify-first-boot-roster-images
title: "Image resolvability checker: verify first-boot roster images actually pull"
created: 2026-09-22T05:11:23.612Z
completed: 2026-09-22T09:45:23.084Z
depends_on: []
composes_with: []
---

# Image resolvability checker: verify first-boot roster images actually pull

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M33RD7PW087G0R0011EVZYQ-*.md` glob. -->

## What

`src/Core.TypeScript/cluster/image-resolvability.ts` — renders every first-boot
HelmChart CR (`full-ai-cluster/k8s/bootstrap/*.yaml`) and every ArgoCD
Application (metal rung, the committed tree), extracts every container image
(generic `image:` walker + a small explicit table for operator-injected images
that never appear as a literal string — KubeVirt's component images, verified
against upstream source), and resolves each one against its registry's OCI
distribution API. Reports `ok` / `missing` (404) / `arch-missing` (resolves,
but no linux/amd64 in the manifest) / `unknown` (auth-required or a failed
probe — never conflated with `missing`). Also flags `:latest`/untagged, no
digest, Docker Hub count (anonymous pull rate limit), and — added after a real
first-boot VM finding — `kube-version-derived` (a tag that exactly matches the
declared k3s version, which breaks silently when
`full-ai-cluster/k8s/kubernetes-version.json` drifts from the real node).

Offline (PR-blocking) mode renders fresh and checks the CURRENT image list
against a checked-in snapshot (`full-ai-cluster/k8s/image-resolvability.json`);
`--refresh` (helm-validate.yml's existing daily cron) re-resolves everything
live and rewrites the snapshot, non-blocking — same DV2.0 split
`image-source-provenance.ts` already uses, for the identical reason.

## Measured against the real tree

137 distinct image references, 134 `ok`, 0 `missing`, 0 `arch-missing`, 3
`unknown` (all genuine: `hat-system-operator:placeholder` is a documented
not-yet-built operator at replicas:0; two ancient Docker Hub `minio/*` tags
bundled by GitLab's chart default now 401 on EVERY tag, not just those two —
MinIO Inc. appears to have closed anonymous Docker Hub pulls entirely,
upstream, not a repo defect). 51 Docker Hub images. 1 `kube-version-derived`
risk (spire's `docker.io/rancher/kubectl` hook image).

## Fixed in passing

- `image-footprint.ts`: exported `fetchManifest`/`MANIFEST_ACCEPT` (the generic
  WWW-Authenticate flow) for reuse.
- `rendered-storage-claims.ts`: `RenderOptions.kubeVersion` (optional,
  additive) — `renderApplication` never passed `--kube-version` to `helm
  template`, so a chart deriving an image tag from `.Capabilities.KubeVersion`
  could not be reproduced by any existing offline render.
- Corrected a wrong first guess in the KubeVirt operator-injected table
  (`virt-pr-helper` doesn't exist upstream; the real names, `pr-helper` and
  `sidecar-shim`, carry no `virt-` prefix) — caught by actually resolving it
  against quay.io before shipping, not by inspection.

## Not fixed (documented, not ambiguous enough to auto-fix)

GitLab's bundled `minio` subchart's default images are now fully gated
upstream (401 on every tag, `minio/minio` and `minio/mc`) — a real first-boot
risk if that Application's minio subchart is enabled, but disabling/repointing
it is an app-config decision outside this checker's scope.

