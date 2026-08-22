---
id: 081M0JM6SSG087G0R0029X3F6Z
type: bug
state: backlog
priority: P2
slug: arc-runner-mounts-arc-model-cache-a-pvc-nothing-applies-the
title: "arc runner mounts arc-model-cache, a PVC nothing applies -- the Application sources a remote chart, not its sibling manifest"
created: 2026-08-21T16:59:29.456Z
depends_on: []
composes_with: []
---

# arc runner mounts arc-model-cache, a PVC nothing applies -- the Application sources a remote chart, not its sibling manifest

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0JM6SSG087G0R0029X3F6Z-*.md` glob. -->

## Measured on origin/main

`full-ai-cluster/k8s/applications/arc-runner-set/Application.yaml`:

    :33   repoURL: ghcr.io/actions/actions-runner-controller-charts
    :34   chart: gha-runner-scale-set
    :35   targetRevision: 0.12.1
    :51   minRunners: 1
    :72   claimName: arc-model-cache

and the PVC it names lives at `arc-runner-set/model-cache-pvc.yaml:8`, a
**sibling file in the same directory**.

The Application sources a REMOTE Helm chart, not this git path, so it cannot
apply its own sibling. Nothing else does either: the root app-of-apps
(`full-ai-cluster/k8s/bootstrap/root-application.yaml`) includes only
`{*/Application.yaml,Application.yaml}`, which does not match a bare
`model-cache-pvc.yaml`.

## Why it is live rather than latent

`minRunners: 1` keeps a warm runner, and that runner's pod spec mounts
`arc-model-cache`. A pod mounting a PVC that does not exist does not start. This
is not a future risk; it is the current state whenever the runner set is synced.

The file's own header comment asserts it is applied. It is not — the same
comment-asserts-a-guarantee-the-code-does-not-provide shape this repo keeps
finding.

## The 100 GiB is also phantom capacity

`model-cache-pvc.yaml` requests 100Gi RWX against `longhorn`. Because nothing
applies it, that 100 GiB is counted in the DECLARED planning total while
consuming nothing at bring-up. Recorded here so a future capacity change does
not "reclaim" it and think it found headroom that was never occupied.

## Fix directions, deliberately not chosen here

1. Apply the PVC from something that actually reaches it — e.g. give it its own
   `Application.yaml`, which the root glob does match.
2. Drop the mount and the PVC together if the model cache is not wanted.
3. Move the PVC into the Helm release via `extraVolumes`/chart values, if
   `gha-runner-scale-set` supports declaring it.

Choosing between these is a product call about whether the runner should have a
model cache at all, and (1) versus (3) changes who owns the volume's lifecycle.

## Provenance

Found by the storage-profile measurement (PR #13271) while establishing which
declared PVCs are actually provisioned at bring-up; independently re-checked
against `origin/main` before filing. Note the ArgoCD reach audit added in
PR #13265 targets the sibling class (an `Application.yaml` no root can discover)
but would NOT catch this one, since here it is a non-Application manifest that
is unreachable.
