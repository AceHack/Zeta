---
pr_number: 4950
title: "feat(ai-cluster): cookie-cutter node provisioning via disko + Longhorn multi-disk"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T16:29:19Z"
merged_at: "2026-05-25T16:32:55Z"
closed_at: "2026-05-25T16:32:55Z"
head_ref: "feat/disko-cookie-cutter-2026-05-25-c2"
base_ref: "main"
archived_at: "2026-05-27T19:50:09Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4950: feat(ai-cluster): cookie-cutter node provisioning via disko + Longhorn multi-disk

## PR description

## Summary

Declarative end-to-end node provisioning: copy template → edit six lines → boot USB → `disko + nixos-install` → cluster member. No hand-partitioning, no per-host shell scripts. Adding a new identical box is ~10 minutes wall-clock.

## What lands

- **`nixos/modules/disko-shapes/2nvme.nix`** — cookie-cutter shape for boxes with 2 equal NVMes. Uses `size = "100%"` for Longhorn partitions so the shape works at any disk size (handles \"1TB is never really 1TB\"). Layout: nvme0 = 1G ESP + 256G root + rest Longhorn; nvme1 = whole-disk Longhorn. OS + bootloader live on **nvme0 only** — the bootloader-on-untouched-disk failure mode from manual install is structurally impossible since `disko --mode disko` wipes both drives first and only one disk has an ESP.
- **`nixos/modules/longhorn-disks.nix`** — wires the shape's mountpoints to Longhorn's node-level data-path catalog. Takes `zeta.longhorn.dataDisks` list, ensures mount dirs exist, emits `/etc/longhorn/node-disks.yaml` for the cluster-side patch Job, adds the `zeta.io/longhorn-disks=N` K3S node label.
- **`nixos/hosts/worker-template/default.nix`** — composes shape + longhorn module + k3s-agent/gpu/docker. Six clearly-marked PLACEHOLDER blocks (hostName, hostId, two `by-id` disk symlinks, network, SSH key).
- **`flake.nix`** — disko input + `worker-template` nixosConfiguration + new modules exposed under `nixosModules.{disko-shape-2nvme, longhorn-disks}`.
- **`usb-nixos-installer/.../configuration.nix`** — bakes disko into the ISO so the installer doesn't need network access to fetch it.
- **`PROVISIONING.md`** — end-to-end cookie-cutter workflow + disk-failure recovery + multi-shape extension guide.

## Why this is the right shape for symmetric 2×NVMe

Discussed in conversation:

- Longhorn already replicates cross-node (default replica count 3), so intra-node RAID is wasted capacity at cluster scope
- K3S + GPU workloads → swap is a footgun (OOM-kill > thrashing), so no swap partition
- Container image cache (CUDA + vLLM + Ollama + ArgoCD + Cilium + SPIRE + Vault + Hindsight layers...) easily hits 50+ GB → 256 GB root not 80 GB
- Using both NVMes for Longhorn data paths (vs mirroring) gives \\~1.7 TB usable per node and lets a single-disk failure isolate to one Longhorn path while OS keeps running

## Future-shape extension

`disko-shapes/2nvme.nix` is one shape. Future hardware classes get their own file (`4nvme.nix`, `nvme-plus-sata.nix`, etc.) matching the same `zeta.disko` options pattern. The Longhorn module is shape-agnostic — takes a list of mount paths, doesn't care how many disks contributed them.

## Test plan

- [ ] `nix flake check` from `full-ai-cluster/` passes after `nix flake update` adds the disko input
- [ ] `nix build .#installer-iso` succeeds (disko gets baked in)
- [ ] On a target box: USB boot → `disko --mode disko --flake .#worker-template` (with placeholder disk IDs replaced) wipes + partitions + formats + mounts both drives without errors
- [ ] `nixos-install --flake .#worker-template` completes
- [ ] After reboot: `lsblk` shows the expected layout; `mount | grep longhorn` shows both data paths
- [ ] After node joins cluster: `kubectl get nodes` shows the new node; `kubectl -n longhorn-system get nodes.longhorn.io <hostname> -o yaml` shows both `disks` entries

## Open follow-ups (not blockers for this PR)

- Cluster-side Job/DaemonSet to consume `/etc/longhorn/node-disks.yaml` and patch the Longhorn Node CR automatically (documented in `longhorn-disks.nix` TODO)
- Real per-host configs (`worker-gpu-01.nix`, etc.) as physical boxes come online — those are cookie-cutter copies of the template, one PR per box
- Additional shapes as new hardware classes show up

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-25T16:36:10Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `1f1d1e3699`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

## Review threads

### Thread 1: full-ai-cluster/PROVISIONING.md:85 (unresolved)

**@chatgpt-codex-connector** (2026-05-25T16:36:10Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Remove unsupported auto-patch step from provisioning workflow**

This step states that a Longhorn DaemonSet will read `/etc/longhorn/node-disks.yaml` and patch Node CRs automatically, but this commit does not add any manifest or script under `full-ai-cluster/k8s/` that consumes that file (and `nixos/modules/longhorn-disks.nix` still documents the patch job as TODO/manual). As written, operators can complete the runbook believing both data disks are active while Longhorn still uses default disk config, which can misreport usable capacity and scheduling behavior immediately after node bring-up.

Useful? React with 👍 / 👎.

### Thread 2: full-ai-cluster/usb-nixos-installer/nixos/installer/configuration.nix:146 (unresolved)

**@chatgpt-codex-connector** (2026-05-25T16:36:10Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Synchronize disko package change with root USB installer copy**

Adding `disko` only to `full-ai-cluster/usb-nixos-installer` breaks the documented "byte-identical" relationship with `/workspace/Zeta/usb-nixos-installer`, whose `nixos/installer/configuration.nix` still lacks this package. That creates divergent installer behavior: users building from the root `usb-nixos-installer/` path (explicitly supported in its README) will not have offline `disko`, so the documented provisioning flow can fail on air-gapped installs.

Useful? React with 👍 / 👎.
