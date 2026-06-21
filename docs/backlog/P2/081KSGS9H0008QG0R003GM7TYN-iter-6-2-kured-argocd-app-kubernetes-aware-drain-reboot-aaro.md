---
id: 081KSGS9H0008QG0R003GM7TYN
priority: P2
status: open
title: iter-6.2 — kured (Kubernetes Reboot Daemon, CNCF Sandbox) deployed via ArgoCD application — drains+reboots cluster nodes K8s-aware when `system.autoUpgrade` (081KSGS9H0008QG0R002T6J6FS) flips `/var/run/reboot-required` — pairs with autoUpgrade for no-manual-operator cluster updates
effort: M
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on:
  - 081KSGS9H0008QG0R001EKTS5A
  - 081KSGS9H0008QG0R002T6J6FS
composes_with:
  - 081KSGS9H0008QG0R001EKTS5A
  - 081KSGS9H0008QG0R002T6J6FS
  - 081KSGS9H0008QG0R00280HHA7
  - 081KSGS9H0008QG0R0034ZYYR8
  - 081KSGS9H0008QG0R002BC2ZR7
tags: [iter-6, kured, kubernetes, argocd, drain-aware-reboot, cluster-self-update, no-manual-operator, full-ai-cluster, cncf-sandbox]
---

## Problem

When [081KSGS9H0008QG0R002T6J6FS](081KSGS9H0008QG0R002T6J6FS-iter-6-1-system-autoupgrade-nixos-modules-common-weekly-schedule-no-auto-reboot-aaron-2026-05-26.md) `system.autoUpgrade` rebuilds a cluster node, the new system generation often requires a reboot to take effect (kernel update, systemd update, etc.). NixOS's autoUpgrade has `allowReboot = true` BUT — for a K8s cluster — that's unsafe: rebooting a node without draining first kills running pods unceremoniously.

The solution: keep `allowReboot = false` in autoUpgrade (NixOS just flips `/var/run/reboot-required` sentinel + leaves the node running on the old kernel until something safely reboots it), and deploy **kured** to handle the safe reboot.

kured (Kubernetes Reboot Daemon, CNCF Sandbox project) watches every node for the `/var/run/reboot-required` sentinel + when it appears:

1. Acquires a cluster-wide lock (only one node reboots at a time)
2. Cordons the node (prevents new pod scheduling)
3. Drains the node (evicts pods respecting PodDisruptionBudgets)
4. Reboots the node
5. Uncordons after the node returns + reports Ready
6. Releases the lock

This makes "cluster self-updates without manual operator" actually safe for running workloads.

## Target

Deploy kured via an ArgoCD `Application` resource under `full-ai-cluster/k8s/applications/`. Use the official kured Helm chart (`https://kubereboot.github.io/charts`) with reboot-window constrained to off-peak (e.g., 03:00-05:00 UTC).

## Sub-targets

### Sub-target 1 — Author `full-ai-cluster/k8s/applications/kured.yaml`

Standard ArgoCD Application resource shape:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: kured
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://kubereboot.github.io/charts
    chart: kured
    targetRevision: <latest-stable-VERIFIED-via-WebSearch>  # per 081KSGS9H0008QG0R002BC2ZR7 discipline
    helm:
      values: |
        # All kured chart values land under one `configuration:` mapping;
        # multiple top-level `configuration:` keys in the same YAML doc
        # silently keep only the last one (Copilot finding on #5123).
        # rebootSentinel path is the NixOS-actual `/run/reboot-required`
        # (sub-target 2 below verifies); NOT `/var/run/reboot-required`
        # which is a Debian-ism — same Copilot finding.
        configuration:
          rebootDays: "su"
          startTime: "03:00"
          endTime: "05:00"
          timeZone: "UTC"
          rebootSentinel: "/run/reboot-required"
          # respect PodDisruptionBudgets; one node at a time
          drainGracePeriod: "5m"
          drainTimeout: "10m"
  destination:
    server: https://kubernetes.default.svc
    namespace: kured
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

### Sub-target 2 — Verify kured detects NixOS sentinel correctly

NixOS's autoUpgrade with `allowReboot = false` writes the sentinel as `/run/reboot-required` (note: `/run` not `/var/run`; these are usually symlinked but worth verifying). Adjust `rebootSentinel` path per NixOS-actual behavior.

### Sub-target 3 — PodDisruptionBudgets for cluster workloads

For drain to actually be safe, every workload that can tolerate scheduled disruption needs a `PodDisruptionBudget`. Audit existing ArgoCD-managed apps; file sibling B-NNNN rows for any missing PDBs.

### Sub-target 4 — Test sequence with 081KSGS9H0008QG0R002T6J6FS on PC1 canary

1. Land 081KSGS9H0008QG0R001EKTS5A (nixpkgs bump to 25.11)
2. Land 081KSGS9H0008QG0R002T6J6FS (autoUpgrade enabled)
3. Land this row (kured deployed)
4. Trigger upgrade manually first time to verify the chain works:
   - `sudo nixos-rebuild switch --flake .#pc1 --upgrade` on PC1
   - If kernel changed, `/run/reboot-required` flips
   - kured picks up the sentinel within ~60s + drains + reboots PC1
   - PC1 returns + uncordons
5. Verify cluster-wide kured lock prevents multi-node concurrent reboots once we have >1 node

## Acceptance

- [ ] `full-ai-cluster/k8s/applications/kured.yaml` exists
- [ ] kured deployed in `kured` namespace via ArgoCD
- [ ] `rebootSentinel` matches NixOS-actual sentinel path
- [ ] PC1 canary test: autoUpgrade triggers reboot-required → kured drains + reboots
- [ ] PDB audit row filed for any missing workload PDBs
- [ ] `targetRevision` is verified-current per [081KSGS9H0008QG0R002BC2ZR7](../P1/081KSGS9H0008QG0R002BC2ZR7-iter-6-5-all-deps-current-version-audit-nix-flake-argocd-helm-charts-otto-training-data-stale-defaults-must-search-first-aaron-2026-05-26.md) (WebSearch the kured chart version; don't use Otto-default)

## Out of scope

- Distro-upgrade orchestration (081KSGS9H0008QG0R0034ZYYR8 — kured handles within-version reboots, not cross-version migrations)
- Multi-cluster federation (single-cluster only at this stage)

## Composes with

- [081KSGS9H0008QG0R001EKTS5A](../P1/081KSGS9H0008QG0R001EKTS5A-iter-6-0-bump-nixpkgs-24-11-to-25-11-warbler-xantusia-eol-recovery-aaron-2026-05-26.md) — must land first
- [081KSGS9H0008QG0R002T6J6FS](081KSGS9H0008QG0R002T6J6FS-iter-6-1-system-autoupgrade-nixos-modules-common-weekly-schedule-no-auto-reboot-aaron-2026-05-26.md) — autoUpgrade flips the sentinel kured listens for
- [081KSGS9H0008QG0R00280HHA7](081KSGS9H0008QG0R00280HHA7-iter-6-3-deploy-rs-from-ci-gitops-flake-lock-pull-with-auto-rollback-aaron-2026-05-26.md) — alt-shape; kured composes with EITHER autoUpgrade XOR deploy-rs
- [081KSGS9H0008QG0R0034ZYYR8](081KSGS9H0008QG0R0034ZYYR8-iter-6-4-distro-upgrade-automation-runbook-canary-rollout-coordinated-cluster-bump-aaron-2026-05-26.md) — cross-channel jumps need coordinated cluster-wide drain (kured + manual orchestration)
- [081KSGS9H0008QG0R002BC2ZR7](../P1/081KSGS9H0008QG0R002BC2ZR7-iter-6-5-all-deps-current-version-audit-nix-flake-argocd-helm-charts-otto-training-data-stale-defaults-must-search-first-aaron-2026-05-26.md) — discipline: WebSearch the kured chart targetRevision

## Sources

- [kured (Kubernetes Reboot Daemon)](https://kured.dev/) — official docs
- [CNCF Sandbox — kured](https://www.cncf.io/projects/kured/)
- [kured Helm chart](https://github.com/kubereboot/charts)
