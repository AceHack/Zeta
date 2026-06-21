---
pr_number: 5113
title: "fix(081KSGS9H0008QG0R003V23XNZ iter-5.2.2): hostname auto-gen at install-time NOT flash-time (multi-node reuse fix) + login-banner shows hostname pre-login (Aaron 2026-05-26)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T06:34:47Z"
merged_at: "2026-05-26T06:37:59Z"
closed_at: "2026-05-26T06:38:00Z"
head_ref: "otto-cli/iter522-move-auto-hostname-from-flash-time-to-install-time-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:42:53Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5113: fix(081KSGS9H0008QG0R003V23XNZ iter-5.2.2): hostname auto-gen at install-time NOT flash-time (multi-node reuse fix) + login-banner shows hostname pre-login (Aaron 2026-05-26)

## PR description

Two Aaron 2026-05-26 empirical observations:

**(1) Hostname auto-gen moved flash-time → install-time** (reverts iter-5.2.1 flash-time approach). Aaron: *'wait zflash has a hard coded name? i was thinking it would be auto generated on each machine so i can't use that same usb twice?'* — flash-time auto-gen baked the same name into the USB; every install from same USB → mDNS collision. Fix: when no `--host`, DON'T write `zeta-hostname.txt` to ESP; `zeta-install.sh` generates fresh `node-<6hex>` on-node per-install. Same USB now installs N nodes with N unique hostnames.

**(2) Login banner shows hostname + ssh hint pre-login**. Aaron: *'i mean i see a login but no hostname until after i login can you update to show hostname before i login'* — new `nixos/modules/login-banner.nix` sets `services.getty.greetingLine` + `services.getty.helpLine` to show photo-friendly banner with hostname + ssh-from-Mac hint BEFORE the login: prompt. Imported transitively via `common.nix`.

Composes with iter-5.1+5.2+5.2.1 substrate already on main. `zflash --host pikachu` still works (operator override path).

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T06:38:37Z)

## Pull request overview

This PR updates the full-ai-cluster install substrate to avoid hostname collisions when reusing the same USB across multiple machines, and improves console UX by showing the hostname before login.

**Changes:**
- Move auto-generated hostname creation from `zflash` flash-time to `zeta-install.sh` install-time (per-node/per-install unique hostname when `--host` isn’t provided).
- Add a NixOS getty login banner module to display hostname + SSH hint pre-login, and import it via `common.nix`.
- Update `zflash` messaging to reflect the new install-time hostname behavior.

### Reviewed changes

Copilot reviewed 4 out of 4 changed files in this pull request and generated 4 comments.

| File | Description |
| ---- | ----------- |
| full-ai-cluster/usb-nixos-installer/zeta-install.sh | Generates a per-install random `node-<6hex>` hostname when no ESP hostname file exists, and writes it into the injected-hostname substrate. |
| full-ai-cluster/tools/zflash.ts | Removes flash-time hostname auto-gen and adjusts operator messaging for the install-time generation path. |
| full-ai-cluster/nixos/modules/login-banner.nix | Adds a getty greeting/help banner to show hostname + SSH hint before the login prompt. |
| full-ai-cluster/nixos/modules/common.nix | Imports the new login-banner module so all cluster hosts get the pre-login banner. |

## Review threads

### Thread 1: full-ai-cluster/tools/zflash.ts:939 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-26T06:38:36Z):

P1 (bug): The banner/hostname guidance is gated on `willInject`, but hostname auto-generation now happens at install-time even when `--no-inject` is used or the pubkey is missing. As written, operators in those cases won’t see the iter-5.2.2 message even though a random hostname will still be chosen. Fix by removing the `willInject` condition (or gating on the new behavior instead).

### Thread 2: full-ai-cluster/tools/zflash.ts:944 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-26T06:38:36Z):

P2 (documentation): This message claims the pre-login banner shows the chosen hostname “+ IP”, but the new login-banner module (as added in this PR) only prints hostname + SSH hint (no IP). Update this output (or add IP display in the banner) so operator guidance is accurate.

### Thread 3: full-ai-cluster/nixos/modules/login-banner.nix:5 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-26T06:38:37Z):

P2 (documentation): The module header says the banner shows “hostname (+ primary IP …)”, but the actual banner text below doesn’t include an IP address. Either include the IP in the banner or remove the IP claim to avoid misleading operators.

### Thread 4: full-ai-cluster/nixos/modules/login-banner.nix:43 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-26T06:38:37Z):

P2 (documentation): The comment about “\\n … in /etc/issue” and agetty expanding it to the hostname doesn’t match what the code does (it interpolates `${hostName}` directly, and doesn’t use /etc/issue escape sequences). Please adjust the comment to the actual mechanism (or switch to using agetty escapes if that’s the intent).

## General comments

### @chatgpt-codex-connector (2026-05-26T06:34:53Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
