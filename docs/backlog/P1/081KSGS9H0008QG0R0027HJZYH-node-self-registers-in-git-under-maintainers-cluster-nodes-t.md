---
id: 081KSGS9H0008QG0R0027HJZYH
priority: P1
status: open
title: Node self-registers in git under maintainers/<name>/cluster-nodes/<node>/ on first boot → ArgoCD picks up registration → full GitOps-native bring-up of K8s + apps + charts; cluster substrate is git-source-of-truth from install moment forward
effort: L
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on:
  - 081KSGS9H0008QG0R002T3BJ2R
  - 081KSGS9H0008QG0R003V23XNZ
  - 081KSGS9H0008QG0R000EDNTY5
composes_with:
  - 081KSE6WT0008QG0R002275NDE
  - 081KSGS9H0008QG0R00153CQ8B
  - 081KSE6WT0008QG0R003CMCX84
tags: [gitops, self-registration, argocd, kubernetes-bringup, cluster-bringup, maintainers-subtree, b0789-iter5-cluster-write-back, end-state-substrate]
---

## Problem

The maintainer 2026-05-26 surfaced the GitOps-native cluster-bring-up requirement during iter-5 substrate-engineering:

> *"also the machine alt to register itself in git somewhere under the maintainers dev cluster node so it registers with it settings in git to complete node setup and start kubernetes / argocd / full node / cluster install and all apps / charts"*

Today's substrate (iter-4.x + iter-5.1+5.2 in PR #5103):

- Node boots from USB → NetworkManager comes up → SSH-able via injected pubkey + hostname
- Node DOES NOT register itself in git
- Cluster substrate (k8s, ArgoCD, apps, charts) requires operator to manually `kubectl apply -f ...` OR pre-bake into the NixOS install ISO

Result: every cluster bring-up requires operator-driven manual workflow OR ISO rebuilds for substrate changes. Neither composes with 081KSE6WT0008QG0R003CMCX84 (DIO end-state) or 081KSGS9H0008QG0R00153CQ8B (zero-dev-machine homelab persona).

## Target

Make the node SELF-REGISTER in git on first boot, committing its node-config (hostname + roles + hardware capabilities + per-node settings) to `maintainers/<maintainer-name>/cluster-nodes/<node-hostname>/`. ArgoCD watches that path; when a new node-config commit lands, ArgoCD reconciles the cluster substrate to include the new node (K3S join, GPU device-plugin if applicable, Longhorn membership if storage role, etc.). All apps + charts apply automatically per ArgoCD's existing reconciliation loop.

End-state operator UX:

```bash
zflash --host pikachu --role control-plane
# → flash + boot + install + REGISTER + ArgoCD reconciles + cluster comes up
# → ssh zeta@pikachu.local works; kubectl get nodes shows pikachu Ready;
# → all apps/charts present; zero manual kubectl steps
```

## Sub-targets

### Sub-target 1 — node git-auth substrate (depends on 081KSGS9H0008QG0R002T3BJ2R iter-5+)

Per 081KSGS9H0008QG0R002T3BJ2R iter-5+ sub-row design (cluster-as-PR-author): per-node SSH keypair generated at install time + auto-registered as repo deploy key (write-enabled). Per-node revocable. Commit identity = `<hostname>@<maintainer-cluster>.local` or similar.

Without git-auth, node can't push registration commit. This is the load-bearing dependency.

Out of this row: implementation of node git-auth (tracked under 081KSGS9H0008QG0R002T3BJ2R iter-5+); this row consumes the substrate.

### Sub-target 2 — node-config schema in maintainers/<name>/cluster-nodes/<node>/

Each node, on first boot post-install, writes a tiny declarative config block to git:

```
maintainers/aaron/cluster-nodes/pikachu/
├── node.yaml          # hostname, roles, hardware capabilities, IP, MAC, registration timestamp
├── kubernetes/
│   ├── role-labels.yaml   # K8s node labels matching node's role-set
│   └── taints.yaml        # K8s node taints (if any per role)
└── README.md          # auto-generated; human-readable node summary
```

`node.yaml` structure:

```yaml
apiVersion: zeta.lucent-financial-group.com/v1
kind: ClusterNode
metadata:
  name: pikachu
  namespace: aaron-cluster
  maintainer: aaron
spec:
  hostname: pikachu
  roles:
    - control-plane
    - worker-gpu
  hardware:
    cpu: "AMD Ryzen 9 7950X"
    memory: "128GB"
    gpu: "NVIDIA RTX 4090"
    storage:
      - "/dev/nvme0n1 1TB"
      - "/dev/nvme1n1 1TB"
  network:
    ip: 192.168.4.36
    mac: 66:bf:3a:3d:56:c3
  registration:
    timestamp: 2026-05-26T20:14:00Z
    nixos-generation: 1
    flake-rev: <git-commit-sha-of-install-time-flake>
```

### Sub-target 3 — registration systemd service on node

A NixOS systemd service `zeta-register.service` that runs once on first boot AFTER install completes + after network is up. It:

1. Reads `/etc/zeta/cluster-node-id` (from 081KSGS9H0008QG0R003V23XNZ iter-5.2) for hostname
2. Reads `/etc/zeta/cluster-node-roles` (from 081KSGS9H0008QG0R000EDNTY5 iter-5.3) for role-set
3. Probes hardware (CPU model, RAM, GPUs via `lspci`/`nvidia-smi`, storage via `lsblk`, IP via `ip addr`, MAC via `ip link`)
4. Generates `node.yaml` + role-labels + taints
5. Commits + pushes to `maintainers/<maintainer>/cluster-nodes/<hostname>/`
6. Self-disables (one-shot; doesn't re-register on every boot)

### Sub-target 4 — ArgoCD application for cluster-nodes/ tree

ArgoCD Application that watches `maintainers/*/cluster-nodes/**/*.yaml`. On new node-config commit:

- Apply `node.yaml` (custom resource → reconciler picks up)
- Apply role-labels via kubectl
- Apply taints via kubectl
- Reconcile any role-specific workloads (e.g., GPU device-plugin if `worker-gpu` role)

### Sub-target 5 — maintainer choice at zflash time

`zflash --maintainer aaron --host pikachu --role control-plane,worker-gpu` writes maintainer name to ESP (alongside hostname + roles). zeta-install.sh reads + sets up the node to register under `maintainers/aaron/cluster-nodes/pikachu/`.

Default maintainer: read from `~/.zeta/maintainer-name` on operator Mac OR git config `user.name`-derived OR `whoami`.

### Sub-target 6 — multi-maintainer cluster topology (optional; future)

If multiple maintainers share a cluster, each registers their nodes under their own `maintainers/<name>/cluster-nodes/`. Cross-maintainer authorization handled per Stage-3 attribution (per `.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md`).

Out of this row: actual multi-maintainer governance. Initial scope = single-maintainer per cluster.

## Acceptance

- [ ] **Sub-target 1**: 081KSGS9H0008QG0R002T3BJ2R iter-5+ node git-auth substrate lands (prerequisite)
- [ ] **Sub-target 2**: node-config schema documented + accepted as `zeta.lucent-financial-group.com/v1` CRD
- [ ] **Sub-target 3**: `zeta-register.service` ships in `nixos/modules/`; runs once on first boot; writes + commits + pushes
- [ ] **Sub-target 4**: ArgoCD application watches cluster-nodes tree; reconciles on new node commit
- [ ] **Sub-target 5**: `zflash --maintainer <name>` flag works; defaults to operator-Mac source
- [ ] **Empirical end-to-end**: `zflash --maintainer aaron --host pikachu --role control-plane,worker-gpu` → boot → install → register → ArgoCD reconciles → kubectl get nodes shows pikachu Ready with both role-labels → all apps/charts present; zero manual kubectl steps

## Composes with substrate

- **081KSGS9H0008QG0R002T3BJ2R** (depends_on; load-bearing for node git-auth — without it, node can't push registration commit; iter-5+ sub-row of 081KSGS9H0008QG0R002T3BJ2R is the canonical home for the git-auth substrate this row consumes)
- **081KSGS9H0008QG0R003V23XNZ** (depends_on; iter-5.2 hostname injection provides the node identity this row registers under)
- **081KSGS9H0008QG0R000EDNTY5** (depends_on; iter-5.3 role-as-capability provides the role-set this row registers)
- **081KSE6WT0008QG0R002275NDE** (composes; ArgoCD substrate IS one of the plugins in the simplest-first sequence; this row's reconciliation requires ArgoCD already deployed)
- **081KSE6WT0008QG0R003CMCX84** (composes; cluster-as-DIO requires cluster nodes are git-native first-class citizens; this row IS the bridge from "node booted" to "node IS cluster substrate")
- **081KSGS9H0008QG0R00153CQ8B** (composes; zero-dev-machine homelab persona end-state requires full automation including registration; this row is load-bearing for the end-state)
- `maintainers/<name>/` substrate (composes; per-maintainer subtree pattern this row's `cluster-nodes/` subdir lives inside)
- `.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md` (composes; multi-maintainer + cross-attribution scope; future Stage-3 cluster ops)

## Out of scope (for this row; tracked elsewhere)

- Node git-auth substrate (deploy key generation + registration) — 081KSGS9H0008QG0R002T3BJ2R iter-5+
- ArgoCD substrate selection / install (assumed already present per cluster bring-up) — 081KSE6WT0008QG0R002275NDE
- K8s/K3S join token + control-plane discovery — 081KSGS9H0008QG0R003V23XNZ sub-target 5 (deferred)
- Multi-maintainer governance — sub-target 6; future
- Per-node settings UI / dashboard for non-CLI operators — separate row at homelab-persona UX scope

## Origin

Aaron 2026-05-26 during iter-5 substrate-engineering session, after the iter-5.2 hostname injection + 081KSGS9H0008QG0R000EDNTY5 role-as-capability discussion:

> *"also the machine alt to register itself in git somewhere under the maintainers dev cluster node so it registers with it settings in git to complete node setup and start kubernetes / argocd / full node / cluster install and all apps / charts"*

Filing as P1 because:

1. **End-state load-bearing**: 081KSGS9H0008QG0R00153CQ8B zero-dev-machine homelab persona requires this (no manual kubectl post-install)
2. **Composes with DIO**: 081KSE6WT0008QG0R003CMCX84 cluster-IS-the-DIO requires git-native first-class node substrate
3. **Composes with cluster-as-PR-author** (081KSGS9H0008QG0R002T3BJ2R iter-5+): same git-auth substrate, downstream use case
4. **Aaron named explicitly during active session**: not speculative

Per maintainer's broader 2026-05-26 *"going for right not fast"* discipline + *"land all changes before next USB flash so we are putting our best foot forward"* — implementation of THIS row is deferred to follow-on (depends on 081KSGS9H0008QG0R002T3BJ2R iter-5+ git-auth), but the substrate target is named NOW so iter-5.x work aligns with it.
