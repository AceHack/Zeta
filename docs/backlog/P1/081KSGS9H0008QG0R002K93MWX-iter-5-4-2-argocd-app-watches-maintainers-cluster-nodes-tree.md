---
id: 081KSGS9H0008QG0R002K93MWX
priority: P1
status: open
title: iter-5.4.2 — ArgoCD application watches `maintainers/*/cluster-nodes/**` tree → reconciles K8s cluster state on registration-PR merge — completes the iter-5.4 arc (gh-auth foothold → self-register → cluster bring-up); decomposes 081KSGS9H0008QG0R0027HJZYH sub-target 4
effort: M
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on:
  - 081KSGS9H0008QG0R0027HJZYH
  - 081KSGS9H0008QG0R0037H3W4T
composes_with:
  - 081KSE6WT0008QG0R002275NDE
  - 081KSE6WT0008QG0R003CMCX84
  - 081KSGS9H0008QG0R00153CQ8B
tags: [iter-5, iter-5.4, argocd, gitops-reconciliation, cluster-nodes, kubernetes-bringup, b0794-sub-target-4, completes-iter-5-4-arc]
---

## Problem

The iter-5.4 arc:

| Slice | What it does | Status |
|---|---|---|
| **iter-5.4.0** (PR #5210) | gh auth login + operator SSH-pubkey copy to authorized_keys | building |
| **iter-5.4.1** (PR #5211 row; impl pending) | Probe hardware + compose node.yaml + commit+push to `maintainers/<operator>/cluster-nodes/<hostname>/` + open registration PR | row filed |
| **iter-5.4.2** (THIS row) | ArgoCD app watches the cluster-nodes tree → on registration-PR merge → reconciles K8s state (K3S join, node-labels, taints, role-specific workloads like GPU device-plugin) | this row |

After iter-5.4.2 lands, the full GitOps-native cluster bring-up arc is operational: zflash → boot → install → gh-auth → self-register → operator merges PR from phone → cluster auto-converges. Zero manual `kubectl apply` required.

## Target

Author an ArgoCD `Application` resource (or `ApplicationSet` for multi-maintainer scope) under `full-ai-cluster/k8s/applications/cluster-nodes-reconciler.yaml` that:

1. Watches `maintainers/*/cluster-nodes/**/*.yaml` (cross-maintainer; per Aaron's homelab-first stance the initial scope is single-maintainer but the path glob is forward-compatible)
2. Applies `ClusterNode` CRs to the cluster
3. A cluster-nodes-reconciler controller (deployed alongside the Application) translates each `ClusterNode` → K8s node-labels (`zeta.lcg/role=<role>`), taints (per role's pod-disruption requirements), and role-specific workloads:
   - `role: control-plane` → K3S server config + bootstrap if needed
   - `role: worker-gpu` → NVIDIA device-plugin DaemonSet membership + node-label `accelerator=nvidia`
   - `role: storage` → Longhorn disk-discovery membership + node-label `storage=longhorn`
   - `role: cpu-worker` → no extras; base K3S agent

## Sub-targets

### Sub-target 1 — `ClusterNode` CRD definition

Land the provisional CRD at `full-ai-cluster/k8s/crds/cluster-node-crd.yaml` matching the schema sketch in 081KSGS9H0008QG0R0027HJZYH sub-target 2:

```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: clusternodes.zeta.lucent-financial-group.com
spec:
  group: zeta.lucent-financial-group.com
  scope: Namespaced
  names:
    plural: clusternodes
    singular: clusternode
    kind: ClusterNode
  versions:
    - name: v1
      served: true
      storage: true
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              properties:
                hostname: { type: string }
                roles: { type: array, items: { type: string } }
                hardware: { type: object, additionalProperties: true }
                network: { type: object, additionalProperties: true }
                registration: { type: object, additionalProperties: true }
```

### Sub-target 2 — ArgoCD `Application` for the cluster-nodes tree

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: cluster-nodes-reconciler
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/Lucent-Financial-Group/Zeta.git
    targetRevision: main
    path: maintainers
    directory:
      recurse: true
      include: '**/cluster-nodes/**/*.yaml'
  destination:
    server: https://kubernetes.default.svc
    namespace: zeta-cluster
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

### Sub-target 3 — cluster-nodes-reconciler controller

A small Go (or TypeScript via Kubernetes Operator SDK) controller that watches `ClusterNode` CRs and translates `spec.roles[]` into:

- `kubectl label node <hostname> zeta.lcg/role-<role>=true`
- `kubectl taint node <hostname>` per role's taint policy
- Annotate the node with the registration metadata (commit SHA, timestamp, maintainer)

Initial scope: declarative role-to-label/taint mapping in a ConfigMap; controller is a simple kubectl-shell loop OR a kustomize template that ArgoCD applies. Defer full operator-pattern controller to iter-5.4.3+.

### Sub-target 4 — empirical end-to-end validation

After all three sub-targets land + iter-5.4.0 + iter-5.4.1 implementations land:

1. `zflash --host pikachu --role control-plane,worker-gpu` on a fresh node
2. Boot → install → gh-auth (iter-5.4.0) → self-register (iter-5.4.1) → PR opens
3. Operator merges PR (from phone or laptop)
4. ArgoCD picks up the new ClusterNode CR
5. cluster-nodes-reconciler labels + taints the K8s node
6. `kubectl get nodes` shows pikachu with `zeta.lcg/role-control-plane=true` + `zeta.lcg/role-worker-gpu=true` labels
7. NVIDIA device-plugin DaemonSet schedules on pikachu (because of worker-gpu role)
8. All apps/charts that target `accelerator=nvidia` start scheduling pods

This is the empirical proof of the full iter-5.4 arc.

## Acceptance

- [ ] `ClusterNode` CRD lands at `full-ai-cluster/k8s/crds/cluster-node-crd.yaml`
- [ ] ArgoCD Application resource at `full-ai-cluster/k8s/applications/cluster-nodes-reconciler.yaml`
- [ ] Reconciler controller (kustomize template OR simple kubectl-shell loop OR Go operator — pick simplest that works)
- [ ] Role-to-label/taint mapping in ConfigMap
- [ ] Empirical end-to-end on PC1 (or a test VM in nixos-test framework via cascade #5 if shipping before hardware available)
- [ ] Install banner from iter-5.4.1 references this row's reconciliation step so operator knows what happens when they merge

## Composes with

- **[081KSGS9H0008QG0R0027HJZYH](081KSGS9H0008QG0R0027HJZYH-node-self-registers-in-git-under-maintainers-cluster-nodes-triggers-argocd-full-bringup-of-k8s-apps-charts-gitops-native-cluster-substrate-aaron-2026-05-26.md)** (parent; this row is sub-target 4)
- **[081KSGS9H0008QG0R0037H3W4T](081KSGS9H0008QG0R0037H3W4T-iter-5-4-1-self-registration-commit-push-to-maintainers-cluster-nodes-builds-on-iter-5-4-0-gh-auth-foothold-aaron-2026-05-26.md)** (sibling sub-row in iter-5.4 arc; depends on the registration commit landing on main)
- **[081KSE6WT0008QG0R002275NDE](081KSE6WT0008QG0R002275NDE-simplest-first-plugin-sequence-wrapping-already-deployed-cluster-substrate-redis-nats-cockroach-temporal-orleans-opa-aaron-2026-05-25.md)** — ArgoCD substrate (deploy/configure) must already be on cluster; this row consumes it
- **[081KSE6WT0008QG0R003CMCX84](../P1/081KSE6WT0008QG0R003CMCX84-cluster-is-the-deterministic-information-object-zeta-cluster-substrate-end-state-aaron-2026-05-26.md)** — cluster-IS-DIO requires reconciler-driven node lifecycle; this row IS the reconciler
- **[081KSGS9H0008QG0R00153CQ8B](../P1/081KSGS9H0008QG0R00153CQ8B-zero-dev-machines-cluster-native-architecture-voice-as-primary-operator-surface-aaron-2026-05-26.md)** — zero-dev-machine end-state requires operator-merges-PR-from-phone → cluster-converges-automatically; this row IS that "automatically"

## Out of scope

- Multi-maintainer governance (081KSGS9H0008QG0R0027HJZYH sub-target 6; future)
- Full operator-pattern controller in Go (initial impl is kustomize + simple kubectl-shell loop; Go operator deferred)
- Cross-cluster federation (081KSE6WT0008QG0R002CC6314 substrate via re-landed 081KSE6WT0008QG0R002CC6314; separate scope at iter-7)
- ArgoCD itself install/config (081KSE6WT0008QG0R002275NDE; assumed already present per cluster bring-up)

## Substrate-inventory pass

Per [`.claude/rules/verify-existing-substrate-before-authoring.md`](../../.claude/rules/verify-existing-substrate-before-authoring.md):

- `grep -rlF "iter-5.4.2"` → unused; safe
- `grep -rlF "cluster-nodes-reconciler"` → unused; safe
- ID 081KSGS9H0008QG0R002K93MWX next-free per `git ls-tree origin/main` (highest = 081KSGS9H0008QG0R0037H3W4T just-filed in PR #5211)
- 081KSGS9H0008QG0R0027HJZYH + 081KSGS9H0008QG0R0037H3W4T + 081KSE6WT0008QG0R003CMCX84 + 081KSGS9H0008QG0R00153CQ8B + 081KSE6WT0008QG0R002275NDE verified on main / in flight

## Origin

Direct decomposition of 081KSGS9H0008QG0R0027HJZYH sub-target 4 (cluster-substrate-reconciliation) after iter-5.4.1 (081KSGS9H0008QG0R0037H3W4T) decomposes sub-target 3. Together the iter-5.4.x arc completes the maintainer 2026-05-26 GitOps-native cluster-bring-up vision.
