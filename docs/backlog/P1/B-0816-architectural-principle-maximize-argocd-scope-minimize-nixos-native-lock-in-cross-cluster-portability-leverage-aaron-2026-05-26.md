---
id: B-0816
priority: P1
status: open
title: Architectural principle — maximize ArgoCD scope, minimize NixOS-native lock-in for cluster substrate; ArgoCD runs on ANY K8s, not just NixOS, so substrate-in-ArgoCD ports to any K8s cluster (Aaron 2026-05-26)
effort: S
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on: []
composes_with:
  - B-0782
  - B-0790
  - B-0794
  - B-0800
  - B-0801
  - B-0802
  - B-0803
  - B-0806
  - B-0811
  - B-0813
  - B-0814
tags: [architectural-principle, argocd, portability, nixos-vs-argocd-tradeoff, cross-cluster-substrate, cluster-substrate, design-discipline, iter-5-iter-6-iter-7]
---

## Carved sentence

> ArgoCD is used by ANYONE running Kubernetes (not just NixOS users); substrate-in-ArgoCD ports across every K8s cluster + every K8s distribution. NixOS-native substrate (NixOS modules, system.autoUpgrade, declarative-Nix-config) is load-bearing for the BOOT + OS layer, but BEYOND THAT every substrate-engineering decision should default to ArgoCD-managed for cross-cluster portability leverage.

## Problem

The cluster substrate has TWO management substrates at play:

- **NixOS-native** (flake.nix, NixOS modules, `nixos-rebuild`, `system.autoUpgrade`): declarative, atomic, replayable. BUT requires NixOS as the host OS — non-portable to K3S-on-Ubuntu, k3s-on-Alpine, talos-Linux, RKE2, EKS, GKE, AKS, OpenShift, etc.
- **ArgoCD-managed** (CRDs + Helm charts + Kustomize): also declarative + GitOps-native. AND portable to ANY K8s distribution.

When a substrate-engineering decision can be made either way, the cross-cluster portability tradeoff should default to **ArgoCD** unless there's a substrate-specific reason NixOS-native wins.

The maintainer 2026-05-26: *"ArgoCD is ususaly be anyone with k8s too not just nixos so antoher reason to push as much as possible into argocd."*

## Principle (operational discipline for future-Otto cold-boots)

When authoring substrate that could live in either layer:

1. **Prefer ArgoCD** for: K8s workloads, CRDs, controllers, Helm charts, container apps, cross-cluster federation primitives, anything that operates over the K8s API
2. **Use NixOS-native ONLY for**: boot substrate (kernel + initramfs + bootloader), OS-level config (systemd units that aren't workloads, NetworkManager, sshd, host-level packages), pre-K8s bootstrap (the path from "node booted" to "K8s API server reachable")
3. **Document the tradeoff** when choosing NixOS-native AGAINST ArgoCD-managed: name the substrate-specific reason (e.g., "K3S needs cluster-membership-token before ArgoCD can manage anything; the membership-token is OS-level bootstrap")

## What this principle changes in current substrate-engineering

| Area | Before | After (per principle) |
|---|---|---|
| iter-5.4.2 ArgoCD reconciler for ClusterNode CRs (B-0813) | ✅ Already ArgoCD-managed — aligns | Reinforced |
| iter-6.1 system.autoUpgrade (B-0801) | NixOS-native for OS-level Nix flake updates | Stays NixOS-native; this is BOOT/OS layer; no portable alternative within Nix substrate |
| iter-6.2 kured (B-0802) | ArgoCD-managed app | ✅ Reinforced — kured is K8s-native, runs on any distro |
| iter-6.3 deploy-rs (B-0803) | NixOS-native pull alternative to autoUpgrade | Stays in-scope but flagged: deploy-rs requires NixOS hosts; doesn't compose with cross-distro |
| iter-7 Crossplane (B-0806 sub-target 3) | ArgoCD-managed external-infra reconciler | ✅ Reinforced |
| iter-7 Ansible+Ace cross-OS (B-0806) | Host-side ansible-pull / Operator-pattern | Composes BOTH ways; principle doesn't override Aaron's "K8s always present + support both" 2026-05-26 |
| Future "control-plane bootstrap" decision (k3s vs k0s vs k3os vs kubeadm vs talos) | NixOS-baked vs ArgoCD-app-of-apps | Apply principle: prefer the path that lets ArgoCD bootstrap as much as possible |

## Implication for B-0782 (cluster-IS-DIO) end-state

The cluster-IS-deterministic-information-object end-state (B-0782) becomes substrate-honest about WHERE that determinism lives:

- **Boot+OS layer**: NixOS substrate IS the DIO (declarative; replayable; atomic via nixos-rebuild)
- **K8s+workload layer**: ArgoCD-managed substrate IS the DIO (declarative; replayable; atomic via ArgoCD sync)
- **External infra layer**: Crossplane via ArgoCD IS the DIO (same reconciliation pattern)
- **Heterogeneous-OS layer** (iter-7): Ansible-pull + Ace IS the bridge for non-NixOS hosts

Composing all four reconcilers per the 4-reconciler shape from B-0806. THIS row's principle adds: when the K8s+workload layer can subsume something that would otherwise live at boot+OS layer, prefer the K8s+workload (ArgoCD) path for cross-distro portability.

## Implication for the iter-5.4 arc

iter-5.4.2 (B-0813) IS the right shape: the cluster-nodes reconciler watches the git tree + applies labels/taints/role-workloads via K8s API. NOT via NixOS modules. This means an operator running K3S-on-Ubuntu OR k3s-on-Alpine OR Talos OR any other K8s distro could adopt iter-5.4.x substrate by:

1. Skipping the NixOS-side install.sh (use their own bootstrap)
2. Cloning the Zeta repo's `maintainers/<op>/cluster-nodes/<host>/` tree shape
3. Pointing their ArgoCD at the tree
4. Running iter-5.4.1-equivalent self-registration with `bun tools/cluster/deregister-node.ts` + a future `register-node.ts` companion

The iter-5.4.0 gh-auth-login piece happens at install time; the rest is K8s API + git, both portable.

## Implication for Ace package manager (B-0247/B-0288/B-0742)

Ace becomes the cross-distro bootstrap of WHATEVER ArgoCD then manages. The path:

1. Operator boots their distro of choice (NixOS / Ubuntu / Alpine / Talos / whatever)
2. Operator runs `ace install argocd` (or `nix build .#installer-iso` if NixOS-native)
3. ArgoCD applies the Zeta substrate (CRDs + apps + reconcilers + iter-5.4.x cluster-nodes-reconciler)
4. Cluster converges

Ace is the entry point per the B-0806 architecture; ArgoCD is the convergence engine. NixOS-native is one of N possible host substrates that the entry point composes with.

## Acceptance

- [ ] Future authoring decisions in cluster substrate cite this row when choosing between NixOS-native vs ArgoCD-managed
- [ ] B-0782 cluster-IS-DIO row updated with the 4-layer DIO decomposition above (sibling PR; not this row)
- [ ] B-0813 iter-5.4.2 reconciler row updated to explicitly note its cross-distro portability per this principle (sibling PR; not this row)
- [ ] Future iter-N proposals classify themselves per the principle table above

## Out of scope

- Implementing K3S-on-Ubuntu or other-distro variants now (the principle enables future portability; doesn't mandate immediate impl)
- Rewriting existing NixOS-native substrate that's legitimately NixOS-only (autoUpgrade for the Nix flake itself; not portable)
- Picking the "right" K8s distribution (operator's choice; Zeta substrate is distro-agnostic per this principle)

## Composes with

- **[B-0782](B-0782-cluster-is-the-deterministic-information-object-zeta-cluster-substrate-end-state-aaron-2026-05-26.md)** — cluster-IS-DIO end-state; this row sharpens WHERE the DIO lives per layer
- **[B-0790](B-0790-zero-dev-machines-cluster-native-architecture-voice-as-primary-operator-surface-aaron-2026-05-26.md)** — zero-dev-machine substrate benefits from cross-distro portability (operator can use whatever cluster substrate they have available)
- **[B-0794](B-0794-node-self-registers-in-git-under-maintainers-cluster-nodes-triggers-argocd-full-bringup-of-k8s-apps-charts-gitops-native-cluster-substrate-aaron-2026-05-26.md)** — iter-5.4 self-registration is ArgoCD-shaped per this principle
- **[B-0800](B-0800-iter-6-0-bump-nixpkgs-24-11-to-25-11-warbler-xantusia-eol-recovery-aaron-2026-05-26.md)** — nixpkgs EOL recovery operates at OS layer (NixOS-native; can't ArgoCD-ify)
- **[B-0801](../P2/B-0801-iter-6-1-system-autoupgrade-nixos-modules-common-weekly-schedule-no-auto-reboot-aaron-2026-05-26.md)** — autoUpgrade STAYS NixOS-native per principle (OS layer)
- **[B-0802](../P2/B-0802-iter-6-2-kured-argocd-app-kubernetes-aware-drain-reboot-aaron-2026-05-26.md)** — kured IS ArgoCD-managed per principle
- **[B-0803](../P2/B-0803-iter-6-3-deploy-rs-from-ci-gitops-flake-lock-pull-with-auto-rollback-aaron-2026-05-26.md)** — deploy-rs flagged as NixOS-only-path
- **[B-0806](../P2/B-0806-ansible-gitops-plus-crossplane-cross-os-declarative-management-for-windows-macs-non-nixos-linux-aaron-2026-05-26.md)** — iter-7 cross-OS substrate; principle reinforces "K8s always present + ArgoCD always preferred"
- **[B-0811](../P2/B-0811-ontology-category-negotiation-as-ai-skills-hats-federation-point-across-clusters-and-forks-of-zeta-reland-from-pr-5003-aaron-2026-05-25.md)** — cross-fork ontology negotiation operates at ArgoCD/Crossplane scope
- **[B-0813](B-0813-iter-5-4-2-argocd-app-watches-maintainers-cluster-nodes-tree-reconciles-on-pr-merge-completes-gh-auth-to-cluster-bringup-arc-aaron-2026-05-26.md)** — iter-5.4.2 reconciler IS the canonical ArgoCD-managed pattern
- **[B-0814](B-0814-tools-cluster-deregister-node-ts-removes-registered-machine-from-git-sibling-to-iter-5-4-1-self-registration-aaron-2026-05-26.md)** — deregister tool operates on git substrate, ArgoCD reconciles on PR-merge

## Substrate-inventory pass

Per [`.claude/rules/verify-existing-substrate-before-authoring.md`](../../../.claude/rules/verify-existing-substrate-before-authoring.md):

- `grep -rlF "ArgoCD"` → existing references across iter-5.4.x + iter-6.x rows (consumes ArgoCD); no existing principle row
- `grep -rlF "portability"` + `grep -rlF "cross-cluster"` → B-0811 + B-0741 substrate at fork-federation scope; this row's scope is the host-distribution scope (different)
- ID B-0816 next-free per `git ls-tree origin/main` (highest = B-0814 just merged via #5216)

## Origin

The maintainer 2026-05-26 immediately after the iter-6.0 nixpkgs bump landed:

> *"nice also ArgoCD is ususaly be anyone with k8s too not just nixos so antoher reason to push as much as possible into argocd."*

## Empirical prior-art anchor (Aaron 2026-05-26)

The principle ISN'T speculative — the maintainer 2026-05-26 named the empirical lineage + use-cases:

> *"ArgoCD becomes universal convergence engine. exactly its perfect for this it's been used at GitHub and LexisNexis for very similar reasons. Me and my friend built this at LexisNexis and he carried it to GitHub."*

> *"At LexisNexis we used it for a Legal Search Data Pipeline for GitHub they use it for CoPilot training pipeline."*

> *"both places we could run in any cloud with 0 external vendor dependencies that were not open source"*

The pattern was built + validated at **3 contexts** by the same operator-lineage now building Zeta:

| Context | Use-case | Scale | Vendor lock-in |
|---|---|---|---|
| **LexisNexis** | Legal Search Data Pipeline | Enterprise; mixed-distro K8s | 0 external; open-source only |
| **GitHub** | Copilot training pipeline | Planet-scale; even more heterogeneous infra | 0 external; open-source only |
| **Zeta (this substrate)** | Cluster-native AI substrate | Homelab + small-cluster + cross-distro reach | 0 external; open-source only (per Zeta's own dependency discipline) |

Three load-bearing properties carried across all three contexts:

1. **Run in ANY cloud** — no AWS-only / GCP-only / Azure-only substrate; the same convergence engine works wherever K8s runs (homelab, single-cloud, multi-cloud, hybrid, air-gapped)
2. **0 external vendor dependencies** — no commercial control planes, no proprietary orchestrators, no closed-source schedulers. Anything required is open-source + can be replaced with another open-source equivalent
3. **ArgoCD as the convergence engine** — same shape; same git-as-source-of-truth pattern; same CR reconciliation model

Composes directly with B-0288 (Ace) and B-0742 (Ace's distributable POC). Zeta inherits all 3 properties: Ace bootstraps the substrate without vendor lock-in; ArgoCD converges it across any K8s distro; the entire stack is open-source.

This anchor changes the P1 classification's basis: not "architectural reasoning that might apply"; rather "pattern validated at LexisNexis-scale + GitHub-scale + now Zeta-scale; the same constraints (cloud-agnostic + 0-vendor-lock-in + ArgoCD-convergence) hold across all three". Future-Otto cold-booting reads: this principle has 3 scale-evidenced anchors; treat it as load-bearing for every cluster-substrate decision.

Filed as P1 because architectural principles inform every subsequent substrate-engineering decision; landing the principle BEFORE iter-7 implementation work begins ensures the cross-distro portability framing is baked into the foundation rather than retrofitted. Empirical anchor strengthens the P1 classification (not speculative; validated at scale across 3 contexts).

NOT a directive per `.claude/rules/no-directives.md` — operator autonomy on each authoring decision preserved; this row just makes the tradeoff explicit so the right answer becomes legible.
