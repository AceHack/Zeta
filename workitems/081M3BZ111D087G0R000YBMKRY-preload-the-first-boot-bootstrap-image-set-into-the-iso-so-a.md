---
id: 081M3BZ111D087G0R000YBMKRY
type: task
state: backlog
priority: P2
slug: preload-the-first-boot-bootstrap-image-set-into-the-iso-so-a
title: "Preload the first-boot bootstrap image set into the ISO so a registry outage delays the roster instead of bricking the install"
created: 2026-09-25T09:40:59.053Z
depends_on: []
composes_with: []
---

# Preload the first-boot bootstrap image set into the ISO so a registry outage delays the roster instead of bricking the install

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3BZ111D087G0R000YBMKRY-*.md` glob. -->

## The finding this answers

The first-boot external-dependency inventory (#17670, 081M3BWJ96T087G0R0028WT3S3)
measured what nobody had measured: the 134 first-boot container images span
**eight registries**, and the pull-through cache covers **one**.

```
docker.io           48   mirrored via mirror.gcr.io
quay.io             34   UNMIRRORED
ghcr.io             31   UNMIRRORED
registry.gitlab.com 14   UNMIRRORED
registry.k8s.io      4   UNMIRRORED
others               3   UNMIRRORED
```

36% covered. Every unmirrored registry enforces its own per-source-IP rate
limit, so an operator behind an office NAT, a CGNAT ISP or a campus network
shares that budget with strangers.

## What shipped

The **bootstrap slice only** — the 25 images behind the seven charts
`services.k3s.manifests` installs, derived from the roster (never a list) and
carried on the ISO as an OCI archive k3s imports into containerd before it
pulls anything.

**MEASURED 2026-09-25: 1,019,156,480 bytes.** ISO +1.0 GB; installed disk
+~2.7 GB at the x2.67 unpacked ratio. Approved by the maintainer before any
code was written, on exactly those numbers.

21 of the 25 sit on registries the mirror does not cover, which is what makes
this slice worth carrying rather than an arbitrary gigabyte.

## What it does NOT do

**It makes the cluster COME UP without a registry. It does not make the roster
CONVERGE offline.** The remaining ~109 catalog images still pull from eight
registries. The operator gets a running cluster with ArgoCD visibly reconciling
and visibly behind, instead of a partially provisioned node whose only
explanation is a stack location.

## Two defects found while building it

1. **The ConfigMap blindness.** `local-storage.nix` embeds the local-path
   provisioner's `helperPod.yaml` as a STRING inside a ConfigMap, carrying
   `image: busybox`. A structural `image:` walk cannot see it. The first
   derivation shipped `rancher/local-path-provisioner` without `busybox` — a
   provisioner that cannot provision, on the storage wave the bootstrap roster
   needs. Fixed by `imagesInEmbeddedManifests`.

2. **`skopeo` breaks digest-pinned references, and it does so silently.** An
   OCI-layout destination forces OCI media types, so skopeo rewrites a docker
   manifest LIST into an OCI index — new bytes, new digest. The kubelet
   normalises `repo:tag@sha256:X` to `repo@sha256:X` and asks containerd for
   content with digest X, which is the INDEX digest; the archive held the
   rewritten index or only the amd64 child. Measured with quay.io blackholed:
   plain tag "already present on machine", digest-pinned ImagePullBackOff.
   That is 5 of 25 images — every cilium one, 389 MB, 38% of the payload and
   the chart without which nothing else schedules. Fixed by assembling the
   layout byte-for-byte from the registry.

Both are recorded where they were found, in the module that found them.

## Follow-ups filed

- 081M3C10FFX087G0R0033DYXG0 — two kubectl images at two versions, 36.5 MB
  spent twice on the same tool.

## THE PROOF — measured 2026-09-25, k3s v1.35.7+k3s1, Docker

`bun src/Core.TypeScript/cluster/bootstrap-preload-blackhole.ts --both`, with
all eight registry hostnames in the snapshot pointed at 127.0.0.1 inside the
container:

```
=== POSITIVE: bootstrap roster, registries blackholed, archive mounted ===
  positive: CARRIED — all 26 probed image(s) resolved locally — no pull was attempted

=== NEGATIVE CONTROL: same boot, EMPTY images directory ===
  negative: BLOCKED — 1 image(s) had to be pulled and could not be
      BLOCKED    docker.io/rancher/mirrored-pause:3.10.2

=== PROVEN ===
```

The negative control blocks on the SANDBOX image, which is the sharpest possible
demonstration of the point: without the preload the node cannot create a pod
sandbox at all, so nothing runs — not one of the twenty-five other images gets
as far as being tried. Every other probe in that run is honestly `UNDECIDED`,
because it never got the chance to fail.

Register: **metered**. The falsifier is nameable, it was run, and its negative
control went red.

## FIVE DEFECTS THE FALSIFIER FOUND — three in the feature, two in itself

| # | in | defect |
|---|---|---|
| 1 | feature | `skopeo` rewrites docker manifest LISTS into OCI indexes, changing the digest. The five digest-pinned cilium references (389 MB, 38% of the payload) would have been pulled anyway. |
| 2 | feature | ONE untagged name (`busybox`) makes k3s refuse the ENTIRE archive — `can't cast reference.repository to NamedTagged`. 26 images lost to one string. |
| 3 | feature | A hostless name (`rancher/local-path-provisioner:v0.0.30`) is imported under a name the kubelet never asks for. |
| 4 | harness | Reading events cluster-wide counted the roster's own PRE-IMPORT failures, turning a correct run red. |
| 5 | harness | The import wait could be satisfied by the import STARTING — the archive name is already on the "Importing images from" line. |

Plus the one this work item is most embarrassed by and most glad of: the module
header claimed k3s's built-ins ship inside the k3s image. They do not, and the
sandbox image's absence would have produced a node that ran nothing at all while
reporting `PRESENT` on every boot.

**Not one of the six was visible from the artifact.** Every one required a boot
with the registries unreachable.
