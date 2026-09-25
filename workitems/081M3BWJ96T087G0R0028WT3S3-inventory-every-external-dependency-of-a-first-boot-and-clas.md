---
id: 081M3BWJ96T087G0R0028WT3S3
type: task
state: backlog
priority: P2
slug: inventory-every-external-dependency-of-a-first-boot-and-clas
title: "Inventory every external dependency of a first boot, and classify each by what an operator gets when it is unavailable"
created: 2026-09-25T08:57:58.746Z
depends_on: []
composes_with: []
---

# Inventory every external dependency of a first boot, and classify each by what an operator gets when it is unavailable

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3BWJ96T087G0R0028WT3S3-*.md` glob. -->

## The question, asked once, properly

> **A first boot that depends on an external API is an install that fails for
> reasons the operator cannot see or influence.**

So for **every** external dependency of a first boot: **what does an operator
get when it is unavailable?**

| verdict | meaning |
|---|---|
| **named refusal** | it stops, says which dependency, and says what to do. **Fine.** |
| **partial install** | it continues, half-provisioned, and the error is a stack location. **What we measured.** |
| **silent skip** | it continues and nothing records that a step did not happen. **The defect class this whole effort has been about.** |

This item is the map. Nobody has drawn it, and it is directly the maintainer's
question — *will the applications start up when I plug the USB in* — asked about
everything the answer depends on.

## The inventory, as far as tonight established it

Statuses marked **MEASURED** were observed on a real run; the rest are read off
the source and are **unverified** dispositions, which is exactly what the rest
of this item is for.

### Installer phase (`full-ai-cluster/usb-nixos-installer/zeta-install.sh`)

| # | dependency | when unavailable | status |
|---|---|---|---|
| 1 | `git ls-remote $REPO_URL` preflight (:2134) | **NAMED REFUSAL** — and the model for all of these. It runs **before any disk is wiped** and bails with the reason, the remedy (`nmtui`), and the reassurance that nothing was destroyed. | reviewed |
| 2 | `git clone $REPO_URL` (:2334) | covered by #1's preflight, seconds earlier | reviewed |
| 3 | `git fetch` the pinned ISO commit (:2371) | **NAMED REFUSAL** with an explicit escape hatch (`ZETA_ALLOW_REPO_DRIFT=1`) that *records* that it happened | reviewed |
| 4 | Nix substituters — `cache.nixos.org` (`common.nix:234`) | **UNKNOWN.** `nixos-install` without the binary cache builds from source or fails; which, and what the operator sees, is not established. | **unverified** |
| 5 | `mise` toolset installs — one **GitHub attestation API call per pinned tool** | **PARTIAL INSTALL.** `install.sh FAILED rc=1` + `toolset_install.rs:244`. 60/hour unauthenticated **per source IP**. | **MEASURED** — run 36110246885, 081M3BVERK0087G0R001GVH1QP |

### First-boot cluster phase

| # | dependency | when unavailable | status |
|---|---|---|---|
| 6 | **Container image pulls — 134 images across EIGHT registries** | see the breakdown below | **partly measured** |
| 7 | Helm chart repos — **five** distinct hosts: `argoproj.github.io`, `charts.external-secrets.io`, `charts.jetstack.io`, `helm.cilium.io`, `spiffe.github.io` | **UNKNOWN.** A `HelmChart` whose repo is unreachable leaves `helm-install-<chart>` retrying; verdict 4 reports `complete=false` **in the WP11 lane**, but what a bare operator sees is not established. | **unverified** |
| 8 | ArgoCD repo-server cloning + rendering `github.com/Lucent-Financial-Group/Zeta` — **once per Application, ~49 of them, every `timeout.reconciliation` (180s) forever** | **PARTIAL, AND IT DOES NOT SELF-ANNOUNCE.** Applications sit at `sync=Unknown` with `DeadlineExceeded`; the node looks up and the apps do not arrive. | **MEASURED** — 081M3BPJNRS087G0R0008WFXBZ |
| 9 | Bootstrap-or-join discovery probe (`probe.ts:83`) | **SILENT SKIP — the worst class, and it has NEVER RUN**: the code passes `--no-db-lookup`, a flag this `avahi-browse` does not have. | **MEASURED** — 081M39K8ND1087G0R000G4EN4N |
| 10 | DNS, NTP | **UNKNOWN.** Clock skew breaks TLS; nothing establishes what an operator sees. | **unverified** |

### The image-pull breakdown, measured from `image-resolvability.json`

```
48  registry-1.docker.io      <- MIRRORED via mirror.gcr.io
34  quay.io                   <- no mirror
31  ghcr.io                   <- no mirror
14  registry.gitlab.com       <- no mirror
 4  registry.k8s.io           <- no mirror
 1  cgr.dev                   <- no mirror
 1  code.forgejo.org          <- no mirror
 1  ecr-public.aws.com        <- no mirror
```

**The pull-through cache covers 48 of 134 images — 36%.** WP9
(081M33STPKN087G0R0004B5CAK) added `mirror.gcr.io` for exactly the right
reason: Docker Hub's anonymous limit is 100 pulls / 6h / source IP and a first
boot pulls 50+ distinct docker.io images from behind one NAT. **The other 64%
have no pull-through cache at all**, and `registry.gitlab.com` at 14 images is
the one to look at next — GitLab's registry carries its own anonymous limits.

This is the *same shape* as the attestation finding: a per-source-IP budget on
a shared address, spent by strangers, failing an install for a reason the
operator cannot see.

## What to do with this

1. **Complete the table.** Six rows are `unverified` dispositions read off
   source. Each is answerable by making the dependency unreachable and watching
   — which is what a lane is for.
2. **Every `silent skip` becomes a named refusal.** Non-negotiable; #9 is one
   and has been invisible for its entire existence.
3. **Every `partial install` at minimum NAMES its dependency.** #5's operator
   message today is a Rust source location.
4. **Prefer REMOVING a dependency to making it more reliable** — pre-stage at
   image-build time, where a token exists and the network is ours. See
   081M3BVERK0087G0R001GVH1QP's ranking: verify EARLIER, not LESS.

## Origin

081M3BEGSQR087G0R003610CGB (WP31). Three of these were found in one night by
one lane: #5 blocked a verification run, #8 stopped the roster converging, and
#9 turned out never to have executed. That rate of discovery on a surface
nobody had enumerated is the argument for enumerating it.
