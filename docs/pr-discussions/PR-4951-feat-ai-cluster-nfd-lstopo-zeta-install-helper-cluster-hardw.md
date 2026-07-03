---
pr_number: 4951
title: "feat(ai-cluster): NFD + lstopo + zeta-install helper + cluster hardware inventory"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T16:35:08Z"
merged_at: "2026-05-25T16:37:41Z"
closed_at: "2026-05-25T16:37:41Z"
head_ref: "feat/nfd-lstopo-hardware-inventory-2026-05-25-c2"
base_ref: "main"
archived_at: "2026-05-27T19:50:09Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4951: feat(ai-cluster): NFD + lstopo + zeta-install helper + cluster hardware inventory

## PR description

## Summary

Adds precise hardware mapping (kubectl-queryable + visual diagrams), a guided install script baked into the USB ISO, and a cross-platform rescue/inventory workflow. Four composing pieces, one PR.

## What lands

1. **Node Feature Discovery (NFD)** — `k8s/applications/node-feature-discovery/Application.yaml`. Labels every node with detailed hardware features (CPU model, AVX-512 and friends, PCI vendors, kernel modules, storage class). Upstream `kubernetes-sigs/node-feature-discovery` Helm chart. Workers tolerate everything so they discover on control-plane + tainted GPU nodes alike. PCI source plugin tuned to whitelist network/display/NVMe/accelerator classes.

2. **hwloc / lstopo on every node** — added to `common.nix` so every cluster host has the topology tool; also added to the USB installer ISO so the operator can inspect NUMA / PCI / GPU layout BEFORE picking disk-by-id paths. NFD labels are kubectl-queryable; lstopo XML is diff-stable for catching silent hardware drift.

3. **`tools/cluster-inventory/`** — `capture.sh` pulls NFD labels + lstopo XML from every node (via `kubectl debug`, with ssh fallback), renders SVG diagrams, lands artifacts under `docs/cluster-hardware/<node>/`. README documents query patterns, **cross-platform rescue substrate via Paragon FS drivers** (any cluster disk mounts read+write on any maintainer machine — Mac, Windows, or Linux), and recommended cadence.

4. **`zeta-install` guided installer** — baked into the USB ISO via `writeShellScriptBin`. Walks through: enumerate internal NVMes, confirm boot disk, type WIPE to confirm, wipe + partition + format + mount per the 2-NVMe shape, clone Zeta, run `nixos-install` for the chosen host. `/etc/zeta-install.md` runbook updated to point at it as the default path.

## Why this composes well

- **NFD + lstopo** = full visibility. NFD gives you scheduler-targetable labels; lstopo gives you the precise NUMA/PCI diagram. Combine them in `capture.sh` for diffable hardware inventory.
- **zeta-install + PR #4950 disko cookie-cutter** are alternative paths to the same disk layout. zeta-install does the imperative `sgdisk` sequence; the disko module does it declaratively. Operator picks based on what they want — both end on identical partitioning.
- **Paragon FS drivers** are operational substrate the maintainer already has — documenting the rescue paths makes "pull a disk, mount on Mac/Windows, recover" a normal-Tuesday operation rather than a Linux-rescue-host expedition.

## Test plan

- [ ] `nix build .#installer-iso` succeeds with disko + hwloc + zeta-install baked in
- [ ] On a USB-booted system: `which zeta-install` resolves; `zeta-install --help` (or running it) shows the prompts
- [ ] On the cluster after ArgoCD reconciles: `kubectl -n node-feature-discovery get pods` shows master + worker DaemonSet + gc
- [ ] `kubectl get nodes --show-labels | grep feature.node.kubernetes.io` shows hardware labels
- [ ] `lstopo` runs on any node and produces sensible NUMA/PCI output
- [ ] `tools/cluster-inventory/capture.sh` runs end-to-end and produces `docs/cluster-hardware/<node>/` artifacts

## Notes

- `zeta-install.sh` lives at the installer's root (not `bin/`) because the root `.gitignore` blocks `bin/` globally for .NET build outputs. `configuration.nix` `readFile` path matches.
- `worker: tolerations: [{operator: Exists}]` for NFD is intentional — NFD is observability infrastructure; should run everywhere.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T16:38:28Z)

## Pull request overview

This PR adds an AI-cluster hardware inventory and provisioning workflow by deploying Node Feature Discovery (NFD) for scheduler-queryable node labels, installing `hwloc/lstopo` across hosts (and in the USB installer ISO), and introducing tooling/docs to capture and commit per-node topology artifacts. It also adds a guided `zeta-install` script to perform a standard 2×NVMe install path from the USB ISO.

**Changes:**

- Add ArgoCD Application for NFD with Helm values tuned for cluster-wide discovery.
- Install `hwloc` on cluster nodes and the USB installer, and add a `zeta-install` guided installer into the ISO.
- Add `tools/cluster-inventory/` to capture NFD labels + `lstopo` XML and render SVGs into `docs/cluster-hardware/<node>/`.

### Reviewed changes

Copilot reviewed 6 out of 6 changed files in this pull request and generated 8 comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| full-ai-cluster/usb-nixos-installer/zeta-install.sh | New guided installer script for the standard 2×NVMe provisioning flow. |
| full-ai-cluster/usb-nixos-installer/nixos/installer/configuration.nix | Adds `hwloc` and bakes `zeta-install` into the installer ISO; updates on-USB runbook text. |
| full-ai-cluster/tools/cluster-inventory/README.md | Documents the inventory workflow, query patterns, and rescue workflow notes. |
| full-ai-cluster/tools/cluster-inventory/capture.sh | New capture script to collect NFD labels + lstopo XML and render SVGs per node. |
| full-ai-cluster/nixos/modules/common.nix | Adds `hwloc` to the common node package set. |
| full-ai-cluster/k8s/applications/node-feature-discovery/Application.yaml | New ArgoCD Application deploying NFD via Helm with PCI discovery tuning. |
</details>

### COMMENTED — @chatgpt-codex-connector (2026-05-25T16:39:48Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `dbec671e93`


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

### Thread 1: full-ai-cluster/usb-nixos-installer/zeta-install.sh:43 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-25T16:38:26Z):

P0: BOOT_DISK is accepted from user input without validating it is one of the enumerated internal NVMe devices. A typo (or pasting a /dev/sdX path) would cause the script to wipe an unintended disk. Restrict BOOT_DISK to the discovered NVMES list (and ideally verify it is a block device) before proceeding.

### Thread 2: full-ai-cluster/usb-nixos-installer/zeta-install.sh:101 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-25T16:38:26Z):

P0: The cluster host flakes import a per-host `./hardware-configuration.nix` from `full-ai-cluster/nixos/hosts/<host>/` (see full-ai-cluster/README.md). This installer runs `nixos-generate-config` but never copies the generated hardware config into the selected host directory, so `nixos-install --flake ...#$HOST` will keep using the placeholder hardware config and may boot with incorrect drivers/filesystems. After generating, copy `/mnt/etc/nixos/hardware-configuration.nix` into `/mnt/etc/zeta/full-ai-cluster/nixos/hosts/$HOST/hardware-configuration.nix` (and fail if that host path doesn’t exist).

### Thread 3: full-ai-cluster/usb-nixos-installer/zeta-install.sh:16 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-25T16:38:26Z):

P1: The header comment claims the script will use the disko cookie-cutter shape when present, but the implementation always uses the manual `sgdisk`/mkfs path and never invokes disko. Update the comment to match reality, or implement the disko path detection/invocation.

### Thread 4: full-ai-cluster/usb-nixos-installer/nixos/installer/configuration.nix:181 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-25T16:38:27Z):

P1: Comment path is stale: it says the source lives at `full-ai-cluster/usb-nixos-installer/bin/zeta-install`, but the script is read from `../../zeta-install.sh`. This will mislead future edits; update the comment to the correct path (and keep PR description + runbook consistent).

### Thread 5: full-ai-cluster/tools/cluster-inventory/capture.sh:50 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-25T16:38:27Z):

P1: `kubectl get node ... -o jsonpath='{.metadata.labels}'` does not reliably produce a comma-delimited, quoted key stream, but the pipeline assumes commas + leading quotes (`,` split and `grep '^"feature.node.kubernetes.io'`). This likely results in empty/incorrect `nfd-labels.txt` and therefore an unhelpful `summary.md`. Prefer a deterministic extraction (e.g., `kubectl get node -o json | jq -r '.metadata.labels|to_entries[]|"\(.key)=\(.value)"'` and then filter by prefix).

### Thread 6: full-ai-cluster/tools/cluster-inventory/capture.sh:18 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-25T16:38:27Z):

P2: The script comments say to use `lstopo --import topology.xml ...`, but the implementation uses `lstopo --input ...`. Align the comment and code to the same flag to avoid confusion when someone tries to run the command by hand.

### Thread 7: full-ai-cluster/tools/cluster-inventory/capture.sh:66 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-25T16:38:27Z):

P1: The `kubectl debug` path uses `--image=ghcr.io/open-mpi/hwloc:latest`. Using a floating `latest` tag makes captures non-reproducible and can break unexpectedly if the image changes. Pin to a specific version tag (or digest) so the inventory workflow remains stable over time.

### Thread 8: full-ai-cluster/k8s/applications/node-feature-discovery/Application.yaml:77 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-25T16:38:28Z):

P1: `deviceClassWhitelist` entry `"0c80"` is commented as “NVMe sub-class”, but NVMe controllers are PCI base class 01 (Mass storage) / subclass 08 (Non-Volatile Memory) i.e. `0108`. As written, NVMe devices may be excluded from discovery/labeling. Update the whitelist value (and comment) to match NVMe’s actual PCI class code.

### Thread 9: full-ai-cluster/tools/cluster-inventory/capture.sh:50 (unresolved)

**@chatgpt-codex-connector** (2026-05-25T16:39:48Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Parse labels from JSON instead of map string output**

This pipeline assumes `kubectl` emits comma-separated, quoted labels, but `-o jsonpath='{.metadata.labels}'` prints maps via Go `String()` formatting (for example `map[...]`), so the `tr`/`grep '^"feature.node.kubernetes.io'` filter never matches and `nfd-labels.txt` is effectively empty. That breaks the core inventory artifact this script is meant to produce.

Useful? React with 👍 / 👎.

### Thread 10: full-ai-cluster/tools/cluster-inventory/capture.sh:90 (unresolved)

**@chatgpt-codex-connector** (2026-05-25T16:39:48Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Tolerate missing label groups when building summaries**

With `set -euo pipefail`, each `grep ... | head -10` in the summary block can terminate the whole script when a node has zero matches for that category (grep exits 1). In practice this makes capture brittle and can abort processing remaining nodes even though missing categories should be valid inventory output.

Useful? React with 👍 / 👎.

### Thread 11: full-ai-cluster/usb-nixos-installer/zeta-install.sh:46 (unresolved)

**@chatgpt-codex-connector** (2026-05-25T16:39:48Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Validate BOOT_DISK against discovered NVMe list**

The selected `BOOT_DISK` is never checked to be one of the two enumerated NVMes. If an operator types another existing device path, the script still derives `DATA_DISK` from the NVMe list and then runs destructive `wipefs`/`sgdisk` on both paths, which can erase an unintended disk.

Useful? React with 👍 / 👎.
