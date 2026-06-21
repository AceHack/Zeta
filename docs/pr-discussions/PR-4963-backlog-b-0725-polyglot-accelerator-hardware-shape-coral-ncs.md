---
pr_number: 4963
title: "backlog(081KSE6WT0008QG0R002T0BFN4): polyglot-accelerator hardware-shape \u2014 Coral / NCS / Jetson / FPGA beyond NVIDIA-only"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T17:40:41Z"
merged_at: "2026-05-25T17:52:34Z"
closed_at: "2026-05-25T17:52:34Z"
head_ref: "backlog/b0725-polyglot-accelerator-hardware-shape-2026-05-25-c2"
base_ref: "main"
archived_at: "2026-05-27T19:50:00Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4963: backlog(081KSE6WT0008QG0R002T0BFN4): polyglot-accelerator hardware-shape — Coral / NCS / Jetson / FPGA beyond NVIDIA-only

## PR description

## Summary

Aaron 2026-05-25 disclosed the maintainer hardware inventory: *"i own all these just not in first wave an many gadgets and fpga and such"* — Coral TPU, Intel Neural Compute Stick, NVIDIA Jetson modules, Xilinx + Intel FPGAs, "many gadgets." First-wave cluster uses NVIDIA GPUs in the worker boxes; everything else activates over time.

This row captures the per-vendor extension paths against the substrate already in place (`gpu-device-plugin.nix` vendors list, NFD per-device PCI labels, disko-shape template, cluster-inventory tooling) so when gadgets come out of the drawer, deployment is PR-by-PR additions to known modules — not fresh design.

## Per-class extension paths covered

- **Google Coral TPU** (USB + PCIe) — Coral device plugin, libedgetpu nixpkg, PCI vendor `1ac1`
- **Intel Neural Compute Stick (MyriadX)** — Intel Device Plugins Operator, OpenVINO runtime, PCI/USB vendor `03e7`
- **NVIDIA Jetson** — NOT USB; aarch64 nodes joining the cluster as themselves; needs aarch64 installer-ISO variant + Jetson disko-shape
- **Xilinx (AMD) FPGAs** — Xilinx FPGA Resource Manager, Vitis AI runtime (license-walled; OCI image initContainer path), PCI vendor `10ee`. **The sleeper play** — 5-10× more efficient than GPU for fixed-graph workloads; composes with the watt-hour intelligence-cost framing
- **Intel / Altera FPGAs** — Intel Device Plugins includes FPGA support; OPAE runtime
- **"Many gadgets" long tail** — RTL-SDR, Zigbee/Thread radios, GPIO controllers — same NFD-labels + device-plugin pattern at K8s scope

## Plus: edge-vs-datacenter K8s-fit analysis (open question)

Triggered by Aaron's *"i want to push fpgas at the edge but i'm not sure k8s is the right iot shape"*. Maps 7 edge form factors to K8s-fit (full-Linux edge → K8s native via Akri; microcontroller-class → Reticulum past a K8s gateway; hybrid is likely load-bearing for FPGAs-at-edge specifically). Names Akri / KubeEdge / OpenYurt for the K8s-native edge tier and Reticulum (already in framework substrate per 081KR2E4K0008QG0R001SWEPNV) for the past-the-gateway tier. Architectural decision deferred until a concrete edge deployment surfaces.

## Why P3

First-wave cluster build uses NVIDIA GPUs only. Becomes P2 when the first Coral / NCS / Jetson / FPGA enters the cluster physically + needs scheduling. Becomes P1 if a workload class emerges that specifically needs heterogeneous accelerator scheduling.

## Composes with

- `nixos/modules/gpu-device-plugin.nix` — vendor list extension; existing pattern
- NFD — per-device PCI labels; existing
- `nixos/modules/disko-shapes/2nvme.nix` — per-hardware-class template; existing
- `tools/cluster-inventory/` — surfaces accelerator devices when present
- Watt-hour intelligence-cost framing (from Alexa-website convo) — FPGA efficiency advantage measurable here
- PR #4930 hat-system — eventually a `hat-fpga-programmer` hat with elevated authority for bitstream flashing
- 081KSE6WT0008QG0R00195RG48 polyglot K8s operator — FPGA-aware operators may want Rust (kube-rs) for the perf characteristics

## Test plan

- [ ] Row renders correctly under `docs/backlog/P3/`
- [ ] `docs/BACKLOG.md` includes 081KSE6WT0008QG0R002T0BFN4
- [ ] Per-class extension paths reference real upstream projects + correct vendor IDs
- [ ] Edge-fit table maps form factors to viable substrates cleanly

Single file (+ index regen) — no implementation in this PR.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-25T17:43:08Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `20551fd7c8`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T17:43:50Z)

## Pull request overview

Adds a new P3 backlog row (081KSE6WT0008QG0R002T0BFN4) documenting how the existing `full-ai-cluster/` substrate (NFD labels, device-plugin pattern, disko shapes, inventory capture) can be extended to support non-NVIDIA accelerators (Coral, Intel NCS, Jetson nodes, Xilinx/Intel FPGAs), plus an edge-vs-datacenter K8s-fit analysis.

**Changes:**
- Added `docs/backlog/P3/081KSE6WT0008QG0R002T0BFN4-…` backlog row capturing per-vendor extension paths and acceptance criteria.
- Regenerated `docs/BACKLOG.md` to include the new 081KSE6WT0008QG0R002T0BFN4 index entry.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 4 comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P3/081KSE6WT0008QG0R002T0BFN4-polyglot-accelerator-hardware-shape-coral-ncs-jetson-fpga-beyond-nvidia-only-2026-05-25.md | New backlog row describing heterogeneous accelerator extension paths and edge-fit analysis. |
| docs/BACKLOG.md | Adds the auto-generated index link for 081KSE6WT0008QG0R002T0BFN4. |

### COMMENTED — @AceHack (2026-05-25T17:47:03Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-25T17:47:04Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-25T17:47:06Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-25T17:47:08Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-25T17:47:10Z)

_(no body)_

### COMMENTED — @chatgpt-codex-connector (2026-05-25T17:48:46Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `3171cb5920`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @AceHack (2026-05-25T17:50:57Z)

_(no body)_

### COMMENTED — @chatgpt-codex-connector (2026-05-25T17:52:50Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `bbc177a71c`


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

### Thread 1: docs/backlog/P3/081KSE6WT0008QG0R002T0BFN4-polyglot-accelerator-hardware-shape-coral-ncs-jetson-fpga-beyond-nvidia-only-2026-05-25.md:41 (resolved)

**@chatgpt-codex-connector** (2026-05-25T17:43:09Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Route NCS scheduling guidance through USB labels**

The table maps Neural Compute Stick detection to PCI (`8086:ad03`), but NCS/Movidius sticks are USB-attached devices (and later in this same row you list NCS vendor `03e7`). If future implementation follows this PCI affinity guidance, workloads targeting NCS can fail to schedule because the expected `feature.node.kubernetes.io/pci-*` labels will never appear for USB sticks. Please update this guidance to use NFD USB discovery labels (or explicitly scope this to a different PCIe Intel AI accelerator).

Useful? React with 👍 / 👎.

**@AceHack** (2026-05-25T17:47:02Z):

Addressed in 3171cb592 — paths corrected to repo-root form (full-ai-cluster/ prefix); PCI class codes fixed ('11' for signal-processing FPGAs; '12' + '03' already in NFD config); USB-vs-PCI scheduling distinction added (NCS / Coral USB use NFD usb source-plugin, not PCI labels).

### Thread 2: docs/backlog/P3/081KSE6WT0008QG0R002T0BFN4-polyglot-accelerator-hardware-shape-coral-ncs-jetson-fpga-beyond-nvidia-only-2026-05-25.md:43 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T17:43:49Z):

P1 (xref): The “What’s already in place” table lists paths like `nixos/modules/gpu-device-plugin.nix`, `k8s/applications/node-feature-discovery/Application.yaml`, and `tools/cluster-inventory/capture.sh`, but in this repo those live under `full-ai-cluster/…` (e.g. `full-ai-cluster/nixos/modules/gpu-device-plugin.nix`, `full-ai-cluster/k8s/applications/node-feature-discovery/Application.yaml`, `full-ai-cluster/tools/cluster-inventory/capture.sh`). As written, these paths won’t resolve for readers scanning the table.

**@AceHack** (2026-05-25T17:47:04Z):

Addressed in 3171cb592 — paths corrected to repo-root form (full-ai-cluster/ prefix); PCI class codes fixed ('11' for signal-processing FPGAs; '12' + '03' already in NFD config); USB-vs-PCI scheduling distinction added (NCS / Coral USB use NFD usb source-plugin, not PCI labels).

### Thread 3: docs/backlog/P3/081KSE6WT0008QG0R002T0BFN4-polyglot-accelerator-hardware-shape-coral-ncs-jetson-fpga-beyond-nvidia-only-2026-05-25.md:70 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T17:43:50Z):

P1 (xref): `worker-template/default.nix` isn’t a valid path from repo root; the template is at `full-ai-cluster/nixos/hosts/worker-template/default.nix`. Using the full path here would keep the Jetson/aarch64 note actionable.

**@AceHack** (2026-05-25T17:47:06Z):

Addressed in 3171cb592 — paths corrected to repo-root form (full-ai-cluster/ prefix); PCI class codes fixed ('11' for signal-processing FPGAs; '12' + '03' already in NFD config); USB-vs-PCI scheduling distinction added (NCS / Coral USB use NFD usb source-plugin, not PCI labels).

### Thread 4: docs/backlog/P3/081KSE6WT0008QG0R002T0BFN4-polyglot-accelerator-hardware-shape-coral-ncs-jetson-fpga-beyond-nvidia-only-2026-05-25.md:107 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T17:43:50Z):

P1 (config-drift): This note cites PCI class codes `120000` and `0b80`, but the current NFD config in `full-ai-cluster/k8s/applications/node-feature-discovery/Application.yaml` uses shorter strings (e.g. `"12"` for processing accelerators) and already whitelists `"12"`. Suggest aligning this paragraph’s examples with the actual chart values format (and only calling out missing classes if they’re not already enabled).

**@AceHack** (2026-05-25T17:47:08Z):

Addressed in 3171cb592 — paths corrected to repo-root form (full-ai-cluster/ prefix); PCI class codes fixed ('11' for signal-processing FPGAs; '12' + '03' already in NFD config); USB-vs-PCI scheduling distinction added (NCS / Coral USB use NFD usb source-plugin, not PCI labels).

### Thread 5: docs/backlog/P3/081KSE6WT0008QG0R002T0BFN4-polyglot-accelerator-hardware-shape-coral-ncs-jetson-fpga-beyond-nvidia-only-2026-05-25.md:120 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T17:43:50Z):

P2 (xref): `tools/cluster-inventory/README.md` is referenced here, but the actual doc is `full-ai-cluster/tools/cluster-inventory/README.md`. Using the full path would make the acceptance checklist directly navigable.

**@AceHack** (2026-05-25T17:47:10Z):

Addressed in 3171cb592 — paths corrected to repo-root form (full-ai-cluster/ prefix); PCI class codes fixed ('11' for signal-processing FPGAs; '12' + '03' already in NFD config); USB-vs-PCI scheduling distinction added (NCS / Coral USB use NFD usb source-plugin, not PCI labels).

### Thread 6: docs/backlog/P3/081KSE6WT0008QG0R002T0BFN4-polyglot-accelerator-hardware-shape-coral-ncs-jetson-fpga-beyond-nvidia-only-2026-05-25.md:45 (resolved)

**@chatgpt-codex-connector** (2026-05-25T17:48:46Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Remove PCI-only affinity claim for all accelerator vendors**

The new note at line 45 still says the `pci-<vendor>.present` affinity pattern works "for every other vendor," which is incorrect for USB-attached devices like Coral USB and NCS and can lead to unschedulable workloads if copied into implementation. Fresh evidence vs. the earlier thread is this newly-added broad claim after the USB caveats: it directly contradicts the USB scheduling path documented later in this same file, so the guidance should explicitly scope this example to PCIe accelerators only.

Useful? React with 👍 / 👎.

**@AceHack** (2026-05-25T17:50:57Z):

Addressed in latest push — scoped the PCI affinity example explicitly to PCIe accelerators + called out the USB scheduling path differs (with forward reference to the per-class section).

### Thread 7: docs/backlog/P3/081KSE6WT0008QG0R002T0BFN4-polyglot-accelerator-hardware-shape-coral-ncs-jetson-fpga-beyond-nvidia-only-2026-05-25.md:117 (unresolved)

**@chatgpt-codex-connector** (2026-05-25T17:52:50Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Split acceptance criteria by PCIe vs USB accelerators**

This backlog row explicitly includes USB-attached devices (Coral USB and NCS USB), but the per-class acceptance checklist requires extending the **PCI** source-plugin for every accelerator class. USB accelerators do not have a PCI class to whitelist, so this criterion is misleading for part of the documented scope and can send implementation down the wrong path (PCI-only changes with no usable USB scheduling labels). Scope this item to PCIe classes and add a USB-specific acceptance step for USB-discovered devices.

Useful? React with 👍 / 👎.

### Thread 8: docs/backlog/P3/081KSE6WT0008QG0R002T0BFN4-polyglot-accelerator-hardware-shape-coral-ncs-jetson-fpga-beyond-nvidia-only-2026-05-25.md:107 (unresolved)

**@chatgpt-codex-connector** (2026-05-25T17:52:50Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Correct Coral PCIe class coverage in NFD guidance**

The composition note says existing NFD class `12` coverage already includes Coral PCIe, but Coral Edge TPU PCIe devices are typically exposed as class `0880` (system peripheral), so they are outside the currently listed whitelist classes. If this guidance is followed as-written, `feature.node.kubernetes.io/pci-1ac1.present` may never be emitted and Coral-targeted nodeAffinity will not match. Update the note to reflect the actual class requirement before treating Coral PCIe as “already covered.”

Useful? React with 👍 / 👎.
