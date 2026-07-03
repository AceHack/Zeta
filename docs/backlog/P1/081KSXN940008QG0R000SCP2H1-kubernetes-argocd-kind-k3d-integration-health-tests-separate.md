---
id: 081KSXN940008QG0R000SCP2H1
priority: P1
status: closed
closed: 2026-06-13
closed_by: "squash merge e0ba87a448403c48d0bed76c7ef01496f3396190 (#7911)"
title: Kubernetes and ArgoCD integration health tests via kind/k3d, separate from USB/ISO zflash acceptance
effort: M
ask: aaron 2026-05-31
created: 2026-05-31
last_updated: 2026-06-13
renumbered_from: "081KSXN940008QG0R000R76H45; 081KSXN940008QG0R002528JS9; 081KSXN940008QG0R001KZ235R; 081KSXN940008QG0R001YABTHH; 081KSXN940008QG0R001A4WWX4; 081KSXN940008QG0R003FCQ7WT (2026-06-01 merge collision repairs; origin/main retains 081KSXN940008QG0R001KZ235R Git-V2 row, 081KSXN940008QG0R001YABTHH labels/tags row, 081KSXN940008QG0R001A4WWX4 observe-loop row, and 081KSXN940008QG0R003FCQ7WT sovereign distributed-DB row); 081KSXN940008QG0R000JZVFXX (2026-06-01 claim/main duplicate-ID repair; origin/main retains 081KSXN940008QG0R000JZVFXX ZetaId taxonomy row); 081KT07NV0008QG0R001HKPJW6 (2026-06-01 claim/main duplicate-ID repair; origin/main retains 081KT07NV0008QG0R001HKPJW6 Ace store row)"
depends_on:
  - 081KSE6WT0008QG0R000YYH3DY
  - 081KSGS9H0008QG0R0027HJZYH
composes_with:
  - 081KSE6WT0008QG0R000YYH3DY
  - 081KSE6WT0008QG0R002275NDE
  - 081KSGS9H0008QG0R0027HJZYH
  - 081KSGS9H0008QG0R002K93MWX
  - 081KSGS9H0008QG0R0011BC7T2
  - 081KSNY2Z0008QG0R0008PN7RQ
tags:
  - kubernetes
  - argocd
  - kind
  - k3d
  - integration-tests
  - gitops-health
  - cluster-health
  - separate-from-usb-iso
  - x86-64-and-arm64
---

> **Closed 2026-06-13** — squash merge `e0ba87a4` ([#7911](https://github.com/Lucent-Financial-Group/Zeta/pull/7911)); dev-cluster/zflash CLIs consolidated under `src/Core.TypeScript/` ([#8076](https://github.com/Lucent-Financial-Group/Zeta/pull/8076)).
> **Landed (Riven):** `--scope included` proves kind-eligible dev ArgoCD Applications
> Synced+Healthy (17 charts after seaweedfs/object-store fix; local + CI `live-kind-included`). Smoke scope + path-filtered CI remain.
> **Deferred:** `--scope full` (Longhorn/Cilium/Vault/SPIRE stack), drift-repair check,
> hat-system Gatekeeper `policies/**` on kind — see follow-on workitems below.

# 081KSXN940008QG0R000SCP2H1 -- Kubernetes + ArgoCD integration health tests via kind/k3d

## Operator framing 2026-05-31

Aaron clarified that Kubernetes and ArgoCD health have never been verified as a
first-class test surface, but the USB/ISO QEMU acceptance harness is not the
place to turn those into unit tests:

> "k8s and argocd healthy anywhere but the usb/iso tests are not the spot for
> k8s like unit tests it's more of a integration test"

And then explicitly assigned this as a separate backlog/lane:

> "carve out backlog or another lane for the k8s argocd stuff but all that
> should be testing with like kind/k3d or something like that"

This row creates that lane. 081KSNY2Z0008QG0R0008PN7RQ remains focused on zflash, boot, QEMU
retention/no-retention semantics, and one agent-start smoke path. Kubernetes
and ArgoCD get their own local-cluster integration harness.

## Problem

The existing cluster substrate has a strong declarative shape:

- `full-ai-cluster/dev-cluster/k3d-config.yaml` defines the local k3d parity
  cluster.
- `full-ai-cluster/dev-cluster/up.sh` brings up k3d, Cilium, ArgoCD, and the
  root App-of-Apps.
- `full-ai-cluster/k8s/bootstrap/` and `full-ai-cluster/k8s/applications/`
  declare the GitOps desired state.

But there is no dedicated, repeatable test that proves:

- a local ephemeral cluster can be created on x86_64 and ARM64/aarch64 hosts,
- ArgoCD installs and becomes ready,
- the Zeta root App-of-Apps reconciles,
- critical Applications reach expected sync/health states, and
- safe drift can be repaired by reconciliation.

If those checks are stuffed into USB/ISO tests, failures become muddy: a zflash
installer regression, QEMU boot issue, CNI issue, ArgoCD chart drift, and app
health failure would all look like one large "USB failed" blob. This lane keeps
failure attribution crisp.

## Target

Add a TypeScript-first integration harness, backed by kind or k3d, that can run
the Zeta cluster GitOps bootstrap in an ephemeral local cluster and assert
ArgoCD health directly.

Preferred starting substrate:

- **Primary:** k3d, because `full-ai-cluster/dev-cluster/k3d-config.yaml`
  already exists and mirrors prod's Cilium/ArgoCD posture.
- **Fallback/adapter:** kind, if a CI runner or contributor machine cannot run
  k3d reliably.

The harness should wrap existing cluster definitions instead of creating a
parallel shell-only path. New orchestration should live in TypeScript under
`src/Core.TypeScript/cluster/`, with clear structured output and bounded
timeouts.

## Acceptance

- [x] A TypeScript integration entrypoint exists for local cluster health at
      `src/Core.TypeScript/cluster/argocd-health-test.ts`.
- [x] The harness can create or select an ephemeral k3d/kind cluster and emits
      Result-shaped structured failures for missing tools, Docker unavailability,
      cluster creation failure, or timeout.
- [x] The harness applies or reuses the Zeta bootstrap path for Cilium, ArgoCD,
      and the root App-of-Apps without duplicating the desired-state manifests.
- [x] The harness waits for the `argocd` namespace, ArgoCD controller/server
      readiness, Application CRD establishment, and root Application creation.
- [x] The harness asserts expected ArgoCD Application state and reports exact
      failing Applications/resources rather than a single opaque timeout.
- [x] **`--scope included`** proves every non-excluded dev Application on kind is
      Synced+Healthy (14 apps; CI job `live-kind-included`; merged #7911).
- [ ] A safe drift-repair check exists: mutate a non-destructive test resource
      or fixture-owned object, then assert ArgoCD self-heal/prune reconverges it.
      **Deferred** → `081KV13CRJF08QG0R001NFZTFH` (full-scope follow-on).
- [x] CI coverage is added on an appropriate cadence or path filter, likely for
      changes under `full-ai-cluster/k8s/**`, `full-ai-cluster/dev-cluster/**`, and
      the new harness path. It may be separate from default PR checks if runtime is
      too expensive.
- [x] The supported architecture story is explicit: x86_64 and ARM64/aarch64
      are both assumed target hardware classes; unsupported runner combinations
      fail with a named dependency, not a green skip.

## Implementation slice 2026-06-01

`src/Core.TypeScript/cluster/argocd-health-test.ts` is the first executable
slice. It has a safe dry-run mode, a preflight mode that names missing
dependencies, and live `--run` modes for:

- `--provider kind --scope smoke --runtime docker`, the conservative outside-ISO
  CI lane.
- `--provider kind --scope smoke --runtime podman`, the Podman-standard local
  lane once the Podman VM has enough memory for the Argo graph.
- `--provider kind --scope included --runtime docker`, the outside-ISO proof that
  every kind-eligible dev Application reconciles Synced+Healthy (17 charts; #7911, #8076).
- `--provider k3d --scope full --runtime docker`, the closer Cilium-parity lane.

The first CI workflow is `.github/workflows/k8s-argocd-health-test.yml`: it runs
unit/dry-run checks and a live kind-on-Docker smoke check on a path-filtered
PR/push surface plus weekly cadence. The workflow runs on Ubuntu x86_64 and
Ubuntu ARM64 runners so Linux/architecture drift is visible before the
installer lane consumes the signal.

The helper CLIs now keep the desired-state source canonical (shell wrappers retired in #8076):

- `bun src/Core.TypeScript/cluster/dev-cluster/apply-root-app.ts` applies the root App-of-Apps
  from the current git ref and keeps dev-only GPU/storage exclusions in one place.
- `bun src/Core.TypeScript/cluster/dev-cluster/k3d-up.ts` / `k3d-down.ts` accept `--config` and
  parse the k3d cluster name from the profile.
- `bun src/Core.TypeScript/cluster/dev-cluster/kind-up.ts` / `kind-down.ts` provide the
  smoke substrate for Docker and Podman (`ZETA_CONTAINER_RUNTIME`).

The older `full-ai-cluster/dev-cluster/*.sh` wrappers were removed ([#8078](https://github.com/Lucent-Financial-Group/Zeta/pull/8078)).

The Podman lane reuses the repo-wide 081KT07NV0008QG0R001CBQ2X2 OCI runtime selector:
`ZETA_CONTAINER_RUNTIME=podman` selects Podman. The older
`CONTAINER_RUNTIME` spelling is intentionally not an alias; stale callers fail
fast instead of silently selecting the wrong runtime.
This harness keeps provider choice explicit instead of fully auto-detecting the
runtime because provider topology changes with the runtime. For now, k3d stays
Docker-only because its profile depends on Docker-network and k3d registry
behavior; the Podman-standard lane runs through kind until a k3d/Podman profile
is proven separately.

The USB/ISO zflash reformat-retention proof remains in 081KSNY2Z0008QG0R0008PN7RQ. Its first
cluster-health consumption should be narrow, but the intended installed-system
target is a full Kubernetes cluster with the complete default ArgoCD stack.
081KSXN940008QG0R000SCP2H1 owns proving that full ArgoCD graph outside the ISO first, so the
USB/ISO lane can later assert the same default stack bootstraps after install
without muddying installer failures with chart/dependency failures.

## Live evidence 2026-06-01

Local outside-ISO evidence on Aaron's macOS host:

- kind-on-Docker smoke passed from a fresh cluster using
  `--provider kind --scope smoke --runtime docker`.
- The smoke observed 26 child Applications, a healthy root App-of-Apps, healthy
  ArgoCD, and `cert-manager` synced/healthy.
- k3d-on-Docker failed during `k3d cluster create` before kubeconfig existed,
  with K3S/kine slow SQLite reads and apiserver post-start hook failures. That
  is before Cilium, Helm, ArgoCD, sync waves, or the Zeta charts run.
- Follow-up pin audit found the k3d/kind/kubectl/helm mise pins already on the
  latest stable installable versions, but the k3d node image lagged at
  `rancher/k3s:v1.31.5-k3s1`. The k3d dev and CI profiles now pin
  `rancher/k3s:v1.36.1-k3s1`, matching `kubectl 1.36.1`.
- The k3d CI profile now uses embedded etcd via `--cluster-init` to avoid the
  Docker Desktop sqlite/kine slow-read path, and `up.sh` trims Cilium's
  single-node values when `agents: 0`.
- With that pin and embedded-etcd change, `k3d cluster create --config

full-ai-cluster/dev-cluster/profiles/ci.k3d-config.yaml --wait=false` succeeds
  and `kubectl get --raw=/readyz` returns `ok` before CNI installation. That
  proves the original pre-kubeconfig failure is past the K3S/kine substrate
  layer.
- The current k3d smoke still is not green. It advances past Cilium install,
  then ArgoCD's `argocd-redis-secret-init` pre-install job times out while
  CoreDNS/local-path-provisioner/metrics-server are unhealthy. The next k3d
  slice should test a K3S/Cilium compatibility bump, with `cilium/cilium`
  `1.19.4` as the current latest chart candidate, before claiming full k3d
  ArgoCD health.
- kind-on-Podman control-plane creation passed. Full Argo smoke on the current
  Podman VM is blocked by the 2 GiB Podman machine budget causing Kubernetes
  API timeouts under Argo/app reconciliation load.
- The harness was aligned with the repo-wide OCI runtime swap convention after
  comparing against the 081KT07NV0008QG0R001CBQ2X2 `do_item` substrate: `ZETA_CONTAINER_RUNTIME` is
  now the only environment switch, stale `CONTAINER_RUNTIME` callers fail fast,
  and `--runtime` remains available for explicit one-off runs.

## Full-cluster target

Aaron clarified on 2026-06-01 that the destination is not merely a minimal
cluster smoke. The eventual default ISO/USB install should bring up a full
Kubernetes cluster with the whole ArgoCD-managed stack. The staged proof ladder
is:

1. Outside-ISO smoke proves Kubernetes, ArgoCD, and the root App-of-Apps are
   wired correctly.
2. Outside-ISO full scope proves every non-excluded ArgoCD Application, chart,
   dependency, sync wave, and parameter flow reconciles correctly.
3. NixOS and Ubuntu host runs exercise substrate/networking/CNI differences.
4. Podman becomes the standard OCI-runtime lane, with Docker retained as an
   accelerator.
5. USB/ISO acceptance consumes the mature full-cluster proof: boot the
   installed system and assert the default full stack comes up, while retaining
   separate zflash/key-retention assertions.

## Follow-on workitems (2026-06-13)

Parent row closed at included-scope proof; remaining ladder rungs filed as
ZetaId workitems (B-NNNN series closed per 081KSXN940008QG0R002FWR9B2):

| ZetaId | Title |
|--------|-------|
| `081KV13CRJF08QG0R001NFZTFH` | **Full scope** — `--scope full` on k3d/kind; Longhorn, Cilium, Vault, SPIRE, drift-repair |
| `081KV13CRKG08QG0R0007JMHKE` | **hat-system Gatekeeper** — sync-wave / PostSync wait so constraints apply after CT CRDs register (re-enable `policies/**` on kind) |

## Follow-on matrix

The next slices should keep the same failure-attribution boundary:

- Add a NixOS-hosted local smoke once a NixOS runner or operator host is
  available, covering CNI/networking differences that Ubuntu runners do not
  exercise.
- Keep Ubuntu x86_64 and Ubuntu ARM64 smoke in CI for kind-on-Docker.
- Re-run kind-on-Podman smoke after resizing the Podman VM; treat Docker as an
  accelerator and Podman as the standard lane.
- Add one USB/ISO post-boot smoke after the outside-ISO harness is green, then
  graduate that to full-stack default-install acceptance once the outside-ISO
  full ArgoCD graph is reliable.
- Add dependency-derived sync waves for ArgoCD. Hard-coded waves are acceptable
  as a bootstrap, but the target is Flux-like dependency tracking that can
  generate Argo sync waves/parameters from the repo's existing dependency and
  semver-solving substrate.

## Out of scope

- USB flashing, ISO boot, zflash credential retention, and QEMU disk snapshot
  behavior. Those remain 081KSNY2Z0008QG0R0008PN7RQ/081KSGS9H0008QG0R0011BC7T2 surfaces.
- Physical biometric verification. Operator hardware testing covers Touch ID or
  platform biometric behavior; this lane may use test auth-state markers only.
- Production high-availability proofs. The local cluster proves GitOps health,
  not every bare-metal HA characteristic.
- External contributor onboarding. Zeta being baked into the image is the
  direction, but public non-LFG contributor flow is future scope.

## Composition

- **081KSE6WT0008QG0R000YYH3DY** is the reference k8s local stack / distributable PoC umbrella.
- **081KSE6WT0008QG0R002275NDE** identifies ArgoCD as part of the simplest-first cluster substrate.
- **081KSGS9H0008QG0R0027HJZYH** covers node self-registration leading to ArgoCD full bring-up.
- **081KSGS9H0008QG0R002K93MWX** covers ArgoCD watching the cluster-nodes tree.
- **081KSGS9H0008QG0R0011BC7T2** remains the QEMU full-install and cluster-auto-join cascade.
- **081KSNY2Z0008QG0R0008PN7RQ** remains the USB/ISO zflash acceptance lane. It should consume a
  narrow smoke first, then graduate to proving the installed ISO/USB default
  brings up the full Kubernetes + ArgoCD stack after 081KSXN940008QG0R000SCP2H1 proves that stack
  outside the installer.

## Substrate-honest framing

This is an integration lane, not a unit-test lane and not a USB/ISO lane. The
proof shape is: "a real local Kubernetes cluster can reconcile the Zeta GitOps
substrate to healthy ArgoCD state." The USB/ISO proof shape is different:
"zflash produces a bootable, self-healing installer medium whose identity
retention semantics are correct." Keeping those proofs separate makes both
stronger.
