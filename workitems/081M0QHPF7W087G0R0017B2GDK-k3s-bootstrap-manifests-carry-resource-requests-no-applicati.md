---
id: 081M0QHPF7W087G0R0017B2GDK
type: bug
state: backlog
priority: P2
slug: k3s-bootstrap-manifests-carry-resource-requests-no-applicati
title: "K3S bootstrap manifests carry resource requests no Application-based check can see — a fifth latent coordinate at 500m/512Mi"
created: 2026-08-23T14:51:49.372Z
depends_on: []
composes_with: []
---

# K3S bootstrap manifests carry resource requests no Application-based check can see — a fifth latent coordinate at 500m/512Mi

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QHPF7W087G0R0017B2GDK-*.md` glob. -->

## The gap

`unreachableGitPathRequests` walks Applications — `discoverApplications` enumerates
`*/Application.yaml` under `full-ai-cluster/k8s/applications` and
`infra/k8s/applications`. **K3S bootstrap manifests are not Applications**, so no check
built on that enumeration can see them, however complete it is over its own domain.

One is live today. `infra/nixos/modules/k3s-server.nix:78` declares

    initial-orleans.source = ../../k8s/bootstrap/initial-orleans.yaml;

so K3S auto-applies it on first boot (`infra/README.md` step 4). Document 4 of that file
is `StatefulSet/orleans-silo` with `replicas: 0` and a hardcoded
**`cpu: 500m` / `memory: 512Mi`** on container `silo`.

## Why it is the same defect at a coordinate nobody counted

`081M0QDJGDS087G0R003Z35VZN` records four `replicas: 0` coordinates totalling
**5100m / 17536Mi**, each baselined with the replica count inside the finding key
(`…@x0`) so a scale-up cannot arrive quietly. This is a **fifth**, at 500m/512Mi, and it
has none of that protection — scaling it to 1 would move 500m onto the metal box with
nothing in the repo reporting it.

Note it is a near-duplicate by content of `infra/k8s/applications/orleans/deployment.yaml`
(same name, same namespace, same 500m/512Mi), which IS governed by the baseline. Two
copies of one workload, one visible to the arithmetic and one not, is the part worth
fixing regardless of the number.

## Options (sized, not built)

1. **Widen the census to bootstrap manifests.** A `bootstrapManifestRequests` register
   beside `unreachableGitPathRequests`, sourced from the nix roster
   (`services.k3s.manifests`) rather than a directory listing, so a manifest added to
   first boot is counted or refused. The nix roster is the right source: it is what
   decides what metal applies.
2. **Delete the duplicate.** If `infra/k8s/applications/orleans` supersedes the bootstrap
   skeleton, the bootstrap copy is dead weight carrying a real request. Needs someone who
   knows whether first boot still needs the namespace before ArgoCD exists.
3. **Leave it, stated.** Defensible — `replicas: 0`, image `:bootstrap` unpublished
   (`081M0QB1Q6Z087G0R00091JH3Q`) — but _only_ if it is written down, which is what this
   item does.

Found while auditing chart vendoring (2026-08-23); adjacent to that work, not part of it.
