---
pr_number: 4897
title: "feat(infra): single-file installer packages for USB stick (Addison)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T02:17:44Z"
merged_at: "2026-05-25T02:26:21Z"
closed_at: "2026-05-25T02:26:21Z"
head_ref: "feat/addison-installer-packages-2026-05-24"
base_ref: "main"
archived_at: "2026-05-27T19:51:53Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4897: feat(infra): single-file installer packages for USB stick (Addison)

## PR description

## Summary

Adds `infra/nixos/hosts/installer/configuration.nix` — one file that declares every package needed on the bootable USB installer image for the NixOS-based AI cluster bootstrap.

Addison (19, working with Aaron) asked for a single Git-tracked file containing every package the USB stick needs. This is that file.

## What's on the stick (~70 packages, organized by install-time role)

| Section | Packages | Why |
|---|---|---|
| Version control | `git`, `git-lfs`, `gnupg`, `openssh` | Clone Zeta from GitHub |
| Editors | `vim`, `neovim`, `nano` | Live config tweaks |
| Shell QoL | `tmux`, `htop`, `ripgrep`, `jq`, `yq-go`, `fzf`, `bat`, `eza`, ... | Survive long install sessions |
| Network | `curl`, `nmap`, `networkmanager`, `iwd`, `wireguard-tools`, ... | Reach internet/LAN/VPN |
| Disk | `parted`, `gptfdisk`, `cryptsetup`, `zfs`, `lvm2`, `mdadm`, `smartmontools` | Partition + LUKS + ZFS + RAID |
| Hardware inspection | `lshw`, `dmidecode`, `nvme-cli`, `lm_sensors`, ... | Know the box first |
| GPU detection | `glxinfo`, `vulkan-tools`, `clinfo` | Confirm GPUs visible (drivers per-host) |
| NixOS install | `nixos-install-tools`, `nom`, `nvd`, `nh` | Pretty + safe install |
| Kubernetes clients | `kubectl`, `helm`, `k9s`, `argocd`, `k3s` binary | Poke control plane from the stick |
| Secrets | `age`, `sops`, `ssh-to-age` | Decrypt cluster tokens during install |
| Build helpers | `gcc`, `gnumake`, `pkg-config`, coreutils, ... | Bootstrap flake inputs |
| Observability | `iotop`, `iftop`, `ncdu`, `pv` | Watch the install progress |
| Docs | `man-pages`, `tldr` | Readable offline |

## What's NOT on the stick

K3S / ArgoCD / Orleans / GitLab / Argo Workflows / Argo Rollouts runtime is deliberately **not** baked into the ISO. Those land on the target machine via `nixos-install --flake .#<host>` pulling from this same Git repo. The stick is one-shot ignition; the flake-in-Git is the strange attractor that draws desired state.

Only the Kubernetes/GitOps **CLIs** (`kubectl`, `helm`, `argocd`, `k9s`) ship so you can talk to a freshly-installed control plane from the live USB before reboot.

## How it's built

The flake at the repo root (next file, gated on Addison) wires:

\`\`\`nix
nixosConfigurations.installer = nixpkgs.lib.nixosSystem {
  modules = [ ./infra/nixos/hosts/installer/configuration.nix ];
};
\`\`\`

Then:

\`\`\`bash
nix build .#nixosConfigurations.installer.config.system.build.isoImage
dd if=result/iso/zeta-installer-*.iso of=/dev/sdX bs=4M status=progress
\`\`\`

## Pre-staged runbook on the ISO

`environment.etc."zeta/README.md"` bakes the install instructions onto the stick itself, so the runbook is reachable offline once booted.

## Test plan

- [ ] `nix flake check` once `flake.nix` lands wiring `nixosConfigurations.installer`
- [ ] `nix build .#nixosConfigurations.installer.config.system.build.isoImage` produces an ISO
- [ ] ISO boots on a target machine, `nixos-install --flake /etc/zeta#<host>` works against a per-host config

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-25T02:19:41Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `e2ace3ed9a`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T02:20:21Z)

## Pull request overview

Adds a NixOS installer ISO configuration (`nixosSystem` module) intended to be the single Git-tracked source of truth for what packages/tools are present on a bootable USB installer used to bootstrap the cluster.

**Changes:**

- Introduces a new NixOS installer configuration importing the upstream minimal install CD modules.
- Defines a large `environment.systemPackages` set for install-time workflows (disk, network, secrets, k8s CLIs, etc.).
- Adds ISO branding plus a baked `/etc/zeta/README.md` runbook.

### COMMENTED — @chatgpt-codex-connector (2026-05-25T02:26:26Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `5ab288c8bb`


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

### Thread 1: infra/nixos/hosts/installer/configuration.nix:230 (resolved)

**@chatgpt-codex-connector** (2026-05-25T02:19:41Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Bundle the actual flake under /etc/zeta**

This module advertises an offline install path (`nixos-install --flake /etc/zeta#<host>`) but only writes `/etc/zeta/README.md`; it never stages `flake.nix` (or the referenced host modules) into `/etc/zeta`. On a machine without network access, following the included runbook will fail when `nixos-install` tries to resolve the flake from `/etc/zeta`. Please add an explicit copy/symlink mechanism for the repository contents (at minimum `flake.nix` and referenced infra files) instead of only shipping a README.

Useful? React with 👍 / 👎.

### Thread 2: infra/nixos/hosts/installer/configuration.nix:81 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T02:20:20Z):

P0 security: The installer ISO disables the firewall while enabling SSH with password authentication and PermitRootLogin="yes". On any networked install this is trivially remotely exploitable; keep the firewall enabled (or explicitly open only port 22) and disable password auth and root login (e.g., keys-only for the nixos user).

### Thread 3: infra/nixos/hosts/installer/configuration.nix:77 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T02:20:20Z):

P0 security: Hard-coding initialPassword = "zeta" for both root and nixos, combined with wheelNeedsPassword=false, creates a known-credential privilege-escalation path for anyone with network/console access. Avoid committing default passwords; prefer no password by default + documented `passwd` step, or an injected hashed password/authorizedKeys set at build time.

### Thread 4: infra/nixos/hosts/installer/configuration.nix:243 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T02:20:20Z):

P1 bug: The baked runbook references /etc/zeta/infra/nixos/hosts/<host>/README.md for partitioning recipes, but the repo currently only contains infra/nixos/hosts/installer/ (no per-host directories/README). This path will be broken on the ISO unless those files are added and actually staged into /etc/zeta.

### Thread 5: infra/nixos/hosts/installer/configuration.nix:244 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T02:20:20Z):

P1 documentation: The comment says the flake is pre-staged at /etc/zeta for offline `nixos-install --flake /etc/zeta#<host>`, but this module only writes /etc/zeta/README.md. Either stage the actual flake content into /etc/zeta (ideally with a filtered source to keep ISO size reasonable) or update the comment/runbook to require `git clone` before running nixos-install.

### Thread 6: infra/nixos/hosts/installer/configuration.nix:76 (unresolved)

**@chatgpt-codex-connector** (2026-05-25T02:26:27Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Open SSH firewall port for documented headless workflow**

This config documents a headless path (`systemctl start sshd`) but keeps `networking.firewall.enable = true` while declaring `services.openssh.enable = false`, so TCP/22 is never opened by NixOS and remote SSH attempts to the live installer will be dropped. This only affects the headless install scenario, but in that scenario the documented instructions won’t work unless the firewall is relaxed or port 22 is explicitly allowed.

Useful? React with 👍 / 👎.
