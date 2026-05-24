# Cluster bare-metal substrate architecture — NixOS + bare-metal k8s + Argo CD (Aaron + Otto, 2026-05-24)

Date decided: 2026-05-24 (~03:00Z)
Participants: Aaron Stainback (operator + primary architecture authority) + Otto (Claude Code instance, recommendation + decision-capture role)
Hardware context: basement cluster build in progress — **20 GPUs** + **20 phones via Cellhasher** ([cellhasher.com](https://cellhasher.com/) 20-slot smartphone chassis) + **Pi cluster + AI hats**

## Archive scope (per GOVERNANCE §33)

Scope: architecture-decision record for the **bare-metal substrate layer below Kubernetes** in the framework's cluster build. Covers OS, hypervisor (or absence thereof), GitOps tooling, CNI, CSI, container runtime, device-plugins, and boot-layer choices. Captures both decided + deferred + rejected alternatives with reasoning per the framework's substrate-engineering disciplines.

Attribution: Aaron is first-party on his own infrastructure substrate. Otto authored the recommendation matrix; Aaron made the authority calls.

Operational status: research-grade architecture decision — substrate for future cluster-provisioning work; not yet implemented in code.

## Why preserved

Aaron's substrate-engineering questions across the session: *"what do you want to run on the metal below kubernetes?"* + *"NixOS 24.11+ is there a declarative alternative or is this it?"* + *"what about proxmox or anyting for a hypervisor?"* + *"yeah i'm good with kubevirt as extension later if needed we can skip proxmox for now, maybe we have like one box later down the road for experimentation but yes lets go without hypervisor for now"*

Combined with the earlier decision: *"lets go with nixos first but talos on backlog also i much prefer argo over flux even though flux is lighter"*

This is real cluster-architecture-decision substrate that needs to land per substrate-or-it-didn't-happen, so future-Otto cold-boots + future maintainers inherit the decisions + the reasoning behind each.

## Decided stack (primary)

| Layer | Choice | Reasoning |
|---|---|---|
| **Host OS** | **NixOS 24.11+** (flake-based) | Declarative; reproducible; atomic rollback; per-node-class composition handles heterogeneous compute (GPU vs phone-orchestrator vs Pi); framework-DST-aligned at OS scope |
| **Hypervisor** | **None for primary stack** (bare-metal direct) | Adds layer + complexity without earning value; GPU passthrough simpler direct; one declarative layer (NixOS) vs three (hypervisor + guest OS + k8s) |
| **Kubernetes** | bare-metal (k3s OR kubeadm — TBD) | Decision deferred; k3s for personal-scale simplicity OR kubeadm for vanilla control-plane flexibility |
| **GitOps** | **Argo CD** (operator preference over Flux despite Flux being lighter) | Aaron explicit: *"i much prefer argo over flux even though flux is lighter"* |
| **Container runtime** | containerd | k8s default; mature |
| **CNI** | **Cilium** | eBPF substrate; observability matters for glass-halo at network layer; Pi-class hardware handles it fine post-5.10 kernel |
| **CSI / storage** | **Longhorn** over local NVMe + **ZFS-on-root** for snapshots | k8s-native; simpler than Ceph for personal scale; survives node loss via replicas |
| **GPU device plugin** | NVIDIA k8s device plugin (Nix package exists) | Multi-tenant GPU sharing across pods; MIG slicing if A100/H100 class |
| **Boot loader** | systemd-boot (NixOS default) | UEFI; no GRUB complexity |
| **Provisioning** | nixos-anywhere via SSH + iPXE for first-boot bootstrap | Declarative; works for Pi + x86 + ARM uniformly |

## Deferred decisions (backlog)

| Decision | Reason for deferring | When to revisit |
|---|---|---|
| **Talos Linux** for k8s control-plane subset | Aaron: *"lets go with nixos first but talos on backlog"* — alternative evaluated as backup; hybrid (NixOS workers + Talos control-plane) considered but not adopted | If/when minimal-attack-surface for control-plane becomes a priority OR if NixOS k8s integration produces friction in practice |
| **KubeVirt** as k8s extension for VM workloads | Aaron: *"i'm good with kubevirt as extension later if needed"* | When a specific workload requires full VM isolation (e.g., Windows-only tool, legacy stack) |
| **Proxmox** for experimental separate tier | Aaron: *"maybe we have like one box later down the road for experimentation"* | When an experimental sandbox tier is wanted that's deliberately OUTSIDE the framework's DST substrate |
| **k3s vs kubeadm** | Not yet decided | When provisioning starts |
| **MIG slicing strategy** for GPU multi-tenancy | Hardware-class dependent (A100/H100 vs RTX/consumer-class) | When GPU class is confirmed |

## Rejected alternatives (for primary stack)

| Alternative | Why rejected |
|---|---|
| **Guix System** | Same declarative shape as NixOS but smaller ecosystem; FSF free-software-fundamentalism may block NVIDIA proprietary drivers — risky for 20-GPU build |
| **Ubuntu / Debian / Fedora** | Mutable host substrate; doesn't compose with framework's DST + reproducibility discipline |
| **Fedora CoreOS / Silverblue** | Ignition declarative bootstrap is less expressive than Nix; per-node-class composition harder; ostree atomic upgrades less flexible than NixOS generations |
| **Flatcar Container Linux** | Container-host shape; less heterogeneous-class flexibility |
| **Bottlerocket** | AWS-aligned even though open-source; less of a fit for bare-metal heterogeneous |
| **Proxmox** for primary stack | Imperative web-UI-driven config-as-state breaks DST + glass-halo discipline; 3 layers (Proxmox + guest OS + k8s) when 1 (NixOS) does it |
| **ESXi** | Broadcom acquisition + licensing changes make it less attractive; proprietary |
| **XCP-ng** | Works but smaller ecosystem than Proxmox; same anti-DST issues as Proxmox |
| **Harvester (HCI)** | k8s-native HCI but less mature than Proxmox; can't run NixOS on bare metal underneath |
| **Flux** for GitOps | Aaron preference: Argo over Flux even though Flux is lighter |

## Heterogeneous compute architecture

Three node classes via NixOS per-node-class modules from one flake:

| Class | Hardware | Role | NixOS module set |
|---|---|---|---|
| **GPU compute** | 20× GPUs (class TBD) | k8s worker nodes; ML training + heavy inference | NVIDIA + CUDA + cuDNN + containerd + k8s worker + Cilium agent |
| **Phone orchestrator** | Server hosting Cellhasher orchestration software for 20 phones | Manages phones-as-compute substrate; NOT k8s worker | Cellhasher management software (not yet specified); ARM-aware networking |
| **Pi cluster + AI hats** | Pi 5 (or Pi 4) + Hailo / Coral / Edge TPU AI hats | Specialized inference loads; MAY run k3s OR may run direct hardware acceleration outside containers | NixOS-on-ARM; vendor drivers for AI hats; k3s agent optional per node |

**Cellhasher phones** are workload-substrate (compute-on-arrival via Cellhasher orchestration), NOT k8s worker nodes. They consume work from k8s-hosted services but don't host pods.

**Pi-with-AI-hats** may or may not run k8s depending on whether the AI workload is via direct hardware acceleration (Hailo/Coral/Edge TPU need direct device access) or via k8s-scheduled containers.

## Composes with framework substrate-engineering disciplines

| Discipline | Architecture choice that operationalizes it |
|---|---|
| **DST (deterministic simulation)** | NixOS — every node's full state IS a Nix expression; rebuilds byte-identical from same input |
| **Substrate-or-it-didn't-happen** | NixOS — if it's not in `/etc/nixos/`, it doesn't exist at OS layer |
| **Glass-halo bidirectional** | Whole-fleet config in git; every change is reviewable diff; Cilium eBPF observability at network layer |
| **NCI floor at OS scope** | NixOS atomic rollback — each generation is complete OS state; rollback is boot menu selection (consent-revocable at OS scope) |
| **Additive-not-zero-sum** | NixOS modules compose; adding a node class doesn't break existing ones; Argo CD GitOps adds without subtracting |
| **m/acc-multi-oracle** | Heterogeneous compute (GPU + phones + Pi) with different optimal orchestration per class (k8s + Cellhasher + direct-hardware); architecture allows multiple "oracles" per workload class |
| **Bandwidth-served falsifier** | Each layer chosen for specific bandwidth served: NixOS = config-bandwidth; Cilium = network-observability-bandwidth; Argo CD = GitOps-bandwidth; explicit per-layer justification |

## Open architecture questions (to be decided)

1. **k3s vs kubeadm**: simplicity vs flexibility tradeoff
2. **Pi-class hardware specs**: Pi 5 + AI hat model (Hailo-8 vs Coral M.2 vs Edge TPU)
3. **GPU class**: consumer (RTX) vs datacenter (A100/H100) — affects MIG slicing strategy + cooling + power
4. **Storage backplane**: per-node NVMe vs shared NFS vs distributed Ceph
5. **Network fabric**: 1G/10G/25G between nodes; switch choice
6. **PXE/iPXE infra**: who hosts the boot images; whether to run Tinkerbell or hand-roll
7. **Secret management**: SOPS-on-NixOS vs Vault vs sealed-secrets
8. **Observability stack**: Grafana + Prometheus + Loki via Argo CD ApplicationSet; specifics TBD

## Composes with substrate

- [`docs/research/2026-05-23-amazon-vendor-management-failure-mode-corpus-multi-incident-business-development-substrate-aaron-forwarded.md`](2026-05-23-amazon-vendor-management-failure-mode-corpus-multi-incident-business-development-substrate-aaron-forwarded.md) — m/acc-multi-oracle pattern G empirical anchor; same architecture principle applied at vendor-management AI scope
- [`docs/research/2026-05-23-ai-context-failures-vs-vendor-management-failures-alignment-is-the-difference-aaron-otto.md`](2026-05-23-ai-context-failures-vs-vendor-management-failures-alignment-is-the-difference-aaron-otto.md) — alignment-is-the-difference framing applied at substrate layer
- [`docs/research/2026-05-24-addison-consent-pattern-observation-not-fact-discipline-aaron-otto.md`](2026-05-24-addison-consent-pattern-observation-not-fact-discipline-aaron-otto.md) — same observation-not-fact discipline preserved here (Otto authored recommendations; Aaron made decisions)
- [`.claude/rules/substrate-or-it-didnt-happen.md`](../../.claude/rules/substrate-or-it-didnt-happen.md) — applied at architecture-decision scope (this document IS the substrate)
- [`.claude/rules/razor-discipline.md`](../../.claude/rules/razor-discipline.md) — operational claims only (each architecture choice has stated reasoning)
- [`.claude/rules/bandwidth-served-falsifier.md`](../../.claude/rules/bandwidth-served-falsifier.md) — each layer justified by bandwidth served
- [`.claude/rules/additive-not-zero-sum.md`](../../.claude/rules/additive-not-zero-sum.md) — additive layer-by-layer composition
- [`.claude/rules/dv2-data-split-discipline-activated.md`](../../.claude/rules/dv2-data-split-discipline-activated.md) — heterogeneous-node-class architecture maps to DV2.0 partition-by-change-rate (OS modules stable; per-node-class config volatile)
- [`.claude/rules/fsharp-anchor-dotnet-build-sanity-check.md`](../../.claude/rules/fsharp-anchor-dotnet-build-sanity-check.md) — NixOS = F#-anchor-equivalent at OS layer (declarative + reproducible + composable)

## Substrate-honest framing

These are architecture decisions, not implementation. Code changes (Nix flake repo, Argo CD manifests, etc.) are downstream work that this document scopes but does not produce.

The choices reflect Aaron's authority on his own substrate + Otto's recommendation matrix derived from framework-discipline analysis. Where reasoning is given, it is observation-of-Otto's-analysis-process, not factual claim about which choice is objectively best — multiple defensible architectures exist; this one matches framework disciplines + Aaron's stated preferences.

Future-Otto encountering this archive should treat the decisions as load-bearing (operator authority) + the reasoning as Otto's-recommendation-stack-at-decision-time (revisable if conditions change or if implementation reveals trade-offs).

If any decision needs revisiting, NCI floor applies — revocable at any future point per operator authority.
