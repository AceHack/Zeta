---
pr_number: 4808
title: "docs(research): cluster bare-metal substrate architecture decision (NixOS + bare-metal k8s + Argo CD; no hypervisor for primary stack)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-24T01:57:18Z"
merged_at: "2026-05-24T01:59:14Z"
closed_at: "2026-05-24T01:59:14Z"
head_ref: "otto/research-cluster-bare-metal-architecture-nixos-no-hypervisor-2026-05-24"
base_ref: "main"
archived_at: "2026-05-24T14:24:56Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4808: docs(research): cluster bare-metal substrate architecture decision (NixOS + bare-metal k8s + Argo CD; no hypervisor for primary stack)

## PR description

## Summary

Architecture decision record for the **bare-metal substrate layer below Kubernetes** in the framework's basement cluster build (20 GPUs + 20 phones via Cellhasher + Pi cluster + AI hats).

## Primary stack DECIDED

| Layer | Choice |
|---|---|
| Host OS | **NixOS 24.11+** (flake-based) |
| Hypervisor | **None for primary stack** (bare-metal direct) |
| GitOps | **Argo CD** (Aaron preference over Flux) |
| Container runtime | containerd |
| CNI | Cilium (eBPF) |
| CSI | Longhorn over local NVMe + ZFS-on-root |
| GPU device plugin | NVIDIA k8s device plugin |
| Boot loader | systemd-boot |
| Provisioning | nixos-anywhere via SSH + iPXE |

## Deferred (backlog)

- Talos Linux as alternative for k8s control-plane subset
- KubeVirt as k8s extension for VM workloads if needed
- Proxmox for separate experimental tier (outside framework DST)
- k3s vs kubeadm decision
- MIG slicing strategy (hardware-dependent)

## Rejected with reasoning

Guix System / Ubuntu/Debian/Fedora / Fedora CoreOS / Flatcar / Bottlerocket / Proxmox primary / ESXi / XCP-ng / Harvester / Flux — each with explicit reasoning.

## Heterogeneous compute architecture

Three node classes via NixOS per-node-class modules from one flake:

- **GPU compute** nodes (k8s workers)
- **Phone orchestrator** (Cellhasher management; NOT k8s worker — phones are workload-substrate)
- **Pi cluster + AI hats** (k8s optional; direct hardware access for Hailo/Coral/Edge TPU)

## Framework alignment

Maps each architecture choice to specific framework disciplines:

- DST → NixOS reproducibility
- Substrate-or-it-didn't-happen → NixOS as full state
- Glass-halo bidirectional → Argo CD GitOps + Cilium eBPF
- NCI floor at OS scope → NixOS atomic rollback
- m/acc-multi-oracle → heterogeneous compute orchestration per class

## 8 open architecture questions captured

k3s vs kubeadm / Pi hardware specs / GPU class / storage backplane / network fabric / PXE infra / secret management / observability stack.

## Test plan

- [ ] CI green (lint only — no source changes)
