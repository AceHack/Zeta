---
id: 081M00QP33F087G0R001JKB5QM
type: task
state: backlog
priority: P2
slug: switch-gpu-nodes-to-hardware-nvidia-open-true-shrink-the-una
title: "Switch GPU nodes to hardware.nvidia.open = true — shrink the unauditable ring-0 surface to GSP firmware only"
created: 2026-08-14T18:13:56.463Z
depends_on: []
composes_with: []
---

# Switch GPU nodes to hardware.nvidia.open = true — shrink the unauditable ring-0 surface to GSP firmware only

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M00QP33F087G0R001JKB5QM-*.md` glob. -->
## Why

`full-ai-cluster/nixos/modules/gpu.nix:33` sets `open = lib.mkDefault false` — the closed
out-of-tree kernel module. NVIDIA's open kernel modules support Turing/Ampere/Ada/Hopper, report
performance parity, and became the default from the R560 driver release. The cards in hand
(RTX 4090 + RTX 3090, `docs/HARDWARE-CAPABILITY-MATRIX.md:26`) are both in scope.

Flipping this replaces an unreadable ring-0 blob with source. It does **not** remove the GSP
firmware blob or the CUDA userspace — both stay closed and NVIDIA-signed. The binding moves; it
does not disappear. That is the point: this is a cheap reduction of unauditable surface, not a
solution to the vendor binding.

## The work is the verification, not the change

The change is one line. What earns the flip:

1. Confirm the pinned `nvidiaPackages.production` version is >= R560.
2. Bench the BNN/inference workload before and after on one GPU worker. NVIDIA claims parity;
   Fedora has reported at least one Turing-specific regression (Runtime D3 with open kernel +
   GSP). Consumer Ampere/Ada is expected clean but has not been measured here.
3. Confirm CUDA, the container toolkit, and a GPU pod schedule unchanged.
4. Roll one node first, per the same sequencing the secure-boot work uses.

## Not claimed

This does not improve attestation. The module is not in the measured chain either way (the initrd
carries only `virtio_*`; the driver loads post-boot from the store). This is an auditability
change, not a trust-chain change.

## Anchor

`docs/research/2026-08-14-what-a-full-rewrite-cannot-remove-binding-dependencies-and-the-claims-they-cap.md` §3.3
