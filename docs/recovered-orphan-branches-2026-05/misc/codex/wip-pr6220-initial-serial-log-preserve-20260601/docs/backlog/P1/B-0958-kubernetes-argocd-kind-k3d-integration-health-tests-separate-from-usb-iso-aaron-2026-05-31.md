---
id: B-0958
priority: P1
status: open
title: Kubernetes and ArgoCD integration health tests via kind/k3d, separate from USB/ISO zflash acceptance
effort: M
ask: aaron 2026-05-31
created: 2026-05-31
last_updated: 2026-05-31
renumbered_from: "B-0951; B-0952; B-0953; B-0957 (2026-06-01 merge collision repairs; origin/main retains B-0953 Git-V2 row and B-0957 labels/tags row)"
depends_on:
  - B-0742
  - B-0794
composes_with:
  - B-0742
  - B-0776
  - B-0794
  - B-0813
  - B-0831
  - B-0891
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

# B-0958 -- Kubernetes + ArgoCD integration health tests via kind/k3d

## Operator framing 2026-05-31

Aaron clarified that Kubernetes and ArgoCD health have never been verified as a
first-class test surface, but the USB/ISO QEMU acceptance harness is not the
place to turn those into unit tests:

> "k8s and argocd healthy anywhere but the usb/iso tests are not the spot for
> k8s like unit tests it's more of a integration test"

And then explicitly assigned this as a separate backlog/lane:

> "carve out backlog or another lane for the k8s argocd stuff but all that
> should be testing with like kind/k3d or something like that"

This row creates that lane. B-0891 remains focused on zflash, boot, QEMU
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
`tools/cluster/` or `tools/ci/`, with clear structured output and bounded
timeouts.

## Acceptance

- [ ] A TypeScript integration entrypoint exists for local cluster health, for
  example `tools/cluster/argocd-health-test.ts` or
  `tools/ci/k8s-argocd-health-test.ts`.
- [ ] The harness can create or select an ephemeral k3d/kind cluster and emits
  Result-shaped structured failures for missing tools, Docker unavailability,
  cluster creation failure, or timeout.
- [ ] The harness applies or reuses the Zeta bootstrap path for Cilium, ArgoCD,
  and the root App-of-Apps without duplicating the desired-state manifests.
- [ ] The harness waits for the `argocd` namespace, ArgoCD controller/server
  readiness, Application CRD establishment, and root Application creation.
- [ ] The harness asserts expected ArgoCD Application state and reports exact
  failing Applications/resources rather than a single opaque timeout.
- [ ] A safe drift-repair check exists: mutate a non-destructive test resource
  or fixture-owned object, then assert ArgoCD self-heal/prune reconverges it.
- [ ] CI coverage is added on an appropriate cadence or path filter, likely for
  changes under `full-ai-cluster/k8s/**`, `full-ai-cluster/dev-cluster/**`, and
  the new harness path. It may be separate from default PR checks if runtime is
  too expensive.
- [ ] The supported architecture story is explicit: x86_64 and ARM64/aarch64
  are both assumed target hardware classes; unsupported runner combinations
  fail with a named dependency, not a green skip.

## Out of scope

- USB flashing, ISO boot, zflash credential retention, and QEMU disk snapshot
  behavior. Those remain B-0891/B-0831 surfaces.
- Physical biometric verification. Operator hardware testing covers Touch ID or
  platform biometric behavior; this lane may use test auth-state markers only.
- Production high-availability proofs. The local cluster proves GitOps health,
  not every bare-metal HA characteristic.
- External contributor onboarding. Zeta being baked into the image is the
  direction, but public non-LFG contributor flow is future scope.

## Composition

- **B-0742** is the reference k8s local stack / distributable PoC umbrella.
- **B-0776** identifies ArgoCD as part of the simplest-first cluster substrate.
- **B-0794** covers node self-registration leading to ArgoCD full bring-up.
- **B-0813** covers ArgoCD watching the cluster-nodes tree.
- **B-0831** remains the QEMU full-install and cluster-auto-join cascade.
- **B-0891** remains the USB/ISO zflash acceptance lane and should consume only
  a narrow "cluster is reachable enough / one agent starts" smoke signal, not
  this lane's full ArgoCD health matrix.

## Substrate-honest framing

This is an integration lane, not a unit-test lane and not a USB/ISO lane. The
proof shape is: "a real local Kubernetes cluster can reconcile the Zeta GitOps
substrate to healthy ArgoCD state." The USB/ISO proof shape is different:
"zflash produces a bootable, self-healing installer medium whose identity
retention semantics are correct." Keeping those proofs separate makes both
stronger.
