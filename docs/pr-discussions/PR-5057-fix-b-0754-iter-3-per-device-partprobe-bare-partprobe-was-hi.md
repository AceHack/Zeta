---
pr_number: 5057
title: "fix(081KSGS9H0008QG0R002T3BJ2R iter-3): per-device partprobe \u2014 bare partprobe was hitting the boot USB (/dev/sda) + bailing"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T00:54:23Z"
merged_at: "2026-05-26T01:43:12Z"
closed_at: "2026-05-26T01:43:12Z"
head_ref: "otto-cli/b0754-iter3-partprobe-per-device-2026-05-25"
base_ref: "main"
archived_at: "2026-05-27T19:46:38Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5057: fix(081KSGS9H0008QG0R002T3BJ2R iter-3): per-device partprobe — bare partprobe was hitting the boot USB (/dev/sda) + bailing

## PR description

## Iteration 2 result (cluster node 1, real-hardware test, Aaron 2026-05-25)

Photo evidence on PC 1 shows iter-2 reached 98% of the install path on first try:

- Wifi connected
- Banner shown
- Greedy N-disk enum: both Crucial CT1000P3PSSD8 NVMes correctly identified with serials
- Plan presented (BOOT nvme0n1: ESP 1G + root 256G + longhorn1 rest; DATA nvme1n1: whole disk longhorn2)
- ZETA_AUTO_CONFIRM=WIPE bypass: WORKED
- wipefs + sgdisk on both NVMes: SUCCESS
- GPT partition creation on both NVMes: SUCCESS
- **Then**: `Error: Partition(s) 1 on /dev/sda have been written, but we have been unable to inform the kernel of the change, probably because it/they are in use`
- drop_to_shell fired correctly with recovery hints

## Root cause

zeta-install.sh called bare `sudo partprobe` (no args). partprobe with no args probes EVERY block device the kernel knows about. Linux exposes USB mass-storage as `/dev/sda` when no SATA disks present. The booted live ISO has mounted partitions on /dev/sda; partprobe refuses to refresh (rightfully); returns non-zero; `set -euo pipefail` bails.

The greedy N-disk enum ALREADY correctly excluded the USB (TRAN=usb filter). We never partitioned /dev/sda. The partprobe call was the only blanket-all-devices invocation in the whole script.

## Fix

Per-device partprobe on BOOT_DISK + each DATA_DISKS entry. Never blanket. Never touch /dev/sda.

Aaron 2026-05-25: 'i would rather do it right so it's not ambigious for future me / users' — the script now operates on explicit-target devices throughout, no blanket-system-wide invocations remaining.

## Test plan

- [x] `bash -n` syntax check
- [ ] CI rebuilds ISO via build-ai-cluster-iso.yml
- [ ] Aaron reflashes via zflash + boots cluster node 1 + observes unattended install reaches end-to-end (cluster member after reboot)
- [ ] CI green

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T00:56:30Z)

## Pull request overview

This PR updates the AI-cluster USB NixOS installer script to avoid calling `partprobe` without arguments (which probes every block device, including the live-boot USB), and instead refreshes the kernel partition table only for the disks that were just partitioned.

**Changes:**

- Replace blanket `sudo partprobe` with per-device `partprobe` calls for `BOOT_DISK` and each `DATA_DISKS` entry.
- Add inline rationale documenting why blanket probing is unsafe in this installer context.

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T01:11:51Z)

## Pull request overview

Copilot reviewed 2 out of 2 changed files in this pull request and generated no new comments.

## Review threads

### Thread 1: full-ai-cluster/usb-nixos-installer/zeta-install.sh:171 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T00:56:29Z):

The comment says the kernel exposes the boot USB as `/dev/sda`, but the assigned `/dev/sdX` letter isn't guaranteed across hardware/boot order. Rewording this to something like “often /dev/sdX (commonly /dev/sda)” would keep the rationale accurate.

### Thread 2: full-ai-cluster/usb-nixos-installer/zeta-install.sh:175 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T00:56:30Z):

With `set -euo pipefail`, a `partprobe` failure here will abort the install. Adding an explicit failure handler (e.g., `... || bail "partprobe failed for $disk ..."`) would make the abort message more immediately actionable by identifying the disk and suggesting next steps.

## General comments

### @chatgpt-codex-connector (2026-05-26T00:54:27Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
