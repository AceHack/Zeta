---
pr_number: 5210
title: "feat(iter-5.4.0 081KSGS9H0008QG0R0027HJZYH): homelab gh-auth-login + operator-pubkey copy at install time"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T16:19:36Z"
merged_at: "2026-05-26T16:22:56Z"
closed_at: "2026-05-26T16:22:56Z"
head_ref: "otto-cli/iter-5-4-0-homelab-gh-auth-device-registration-pubkey-copy-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:39:24Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5210: feat(iter-5.4.0 081KSGS9H0008QG0R0027HJZYH): homelab gh-auth-login + operator-pubkey copy at install time

## PR description

## Summary

Implements **iter-5.4.0** — minimum-viable 081KSGS9H0008QG0R0027HJZYH homelab-mode device-registration substrate the maintainer's deferral named:
> *"i'll wait till we have the install.sh and git native device registration into github is ready before i run again"*

Per Mika 2026-05-26 substrate (homelab-first; production-mode deferred):
> *"USB ships with NO embedded credentials; first boot prompts gh auth login + operator authenticates + auto-copy operator's pubkey to authorized_keys"*

## Changes

1. **`zeta-install.sh` Step 6.8 (NEW)** — between wifi (6.7) and nixos-install:
   - Prompts `[Y/n]` to run `gh auth login`
   - Operator authenticates interactively
   - `gh ssh-key list --json id,key,title` extracts all operator's registered SSH pubkeys
   - Writes one-per-line to `/mnt/etc/zeta/operator-authorized-keys`
   - Skippable; composes additively with iter-4.2 static keys

2. **`nixos/modules/operator-authorized-keys.nix` (NEW)** — mirrors iter-5.3 `initial-password.nix` pattern:
   - `builtins.readFile /etc/zeta/operator-authorized-keys` at activation
   - Filters → `users.users.zeta.openssh.authorizedKeys.keys`
   - Backward-compat fallback (no file → empty list → static keys still apply)

3. **`common.nix`** imports the new module

4. **Installer ISO** adds `gh` to `environment.systemPackages` (needed for `gh auth login` at install time)

5. **Install-complete banner** updated with 3-way path discriminator (iter-5.4.0 success / iter-4.2-only / both-skipped fallback)

## What this enables for next re-flash

After this lands → next ISO build triggers (push to `full-ai-cluster/**` matches the broadened trigger paths) → fresh artifact has:
- iter-5.1 (wifi persist) + iter-5.2 (hostname inject) + iter-5.2.2 (install-time auto-gen + login banner) + iter-5.3 (password prompt) + **iter-5.4.0 (gh-auth + operator-pubkey-copy)**
- Empirical UX: boot → 6.x prompts → gh auth login → operator authenticates → ssh from any of operator's GitHub-registered keys works on first boot

## Not in scope (081KSGS9H0008QG0R0027HJZYH future sub-rows)

- Self-registration commit/push to `maintainers/<name>/cluster-nodes/` (sub-target 3 full)
- ArgoCD app watching the tree (sub-target 4)
- `--maintainer` flag on zflash (sub-target 5; defaults to gh-auth user)
- Production-mode bootstrap-key rotation (deferred per maintainer's homelab-first direction)

## Test plan

- [x] shellcheck clean on zeta-install.sh changes
- [x] `nix-instantiate --parse` clean on the new NixOS module
- [x] Substrate-inventory pass per `verify-existing-substrate-before-authoring.md`
- [ ] CI ISO build greens (auto-triggered by `full-ai-cluster/**` push paths)
- [ ] Re-flash + boot empirical validation (maintainer)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T16:23:33Z)

## Pull request overview

This PR adds an iter-5.4.0 “homelab-mode” install-time flow that lets an operator authenticate with GitHub (`gh auth login`) and automatically inject their GitHub-registered SSH public keys into the freshly installed node’s `zeta` account, reducing post-install manual steps.

**Changes:**
- Adds a new Step 6.8 to `zeta-install.sh` to optionally run `gh auth login`, fetch SSH keys via `gh ssh-key list`, and write them into the target root under `/mnt/etc/zeta/operator-authorized-keys`.
- Introduces a new NixOS module that reads `/etc/zeta/operator-authorized-keys` (if present) and contributes the parsed keys to `users.users.zeta.openssh.authorizedKeys.keys`.
- Updates the installer ISO config and cluster common module imports to include and activate the new functionality.

### Reviewed changes

Copilot reviewed 4 out of 4 changed files in this pull request and generated 5 comments.

| File | Description |
| ---- | ----------- |
| full-ai-cluster/usb-nixos-installer/zeta-install.sh | Adds install-time GitHub auth + operator key capture step and updates the completion banner logic. |
| full-ai-cluster/usb-nixos-installer/nixos/installer/configuration.nix | Adds `gh` to installer ISO packages to support `gh auth login` during install. |
| full-ai-cluster/nixos/modules/operator-authorized-keys.nix | New module to read captured operator keys file and inject into `zeta` authorized keys. |
| full-ai-cluster/nixos/modules/common.nix | Imports the new operator-authorized-keys module for all cluster hosts. |

## Review threads

### Thread 1: full-ai-cluster/usb-nixos-installer/zeta-install.sh:598 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T16:23:31Z):

P0: The prompt says “Press Enter to skip”, but the prompt default is effectively Yes (`GH_AUTH_REPLY` defaults to `Y`). Pressing Enter will run `gh auth login`, which contradicts the UX text. Either change the copy to reflect the default, or switch to a [y/N] prompt with default skip so Enter truly skips.

### Thread 2: full-ai-cluster/usb-nixos-installer/zeta-install.sh:582 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T16:23:32Z):

P1: Comment says this step is “NOT skippable if iter-4.2 injection also failed”, but the implementation always allows skipping and only prints a warning. Either enforce the non-skippable behavior (e.g., gate on `INJECT_OK`) or update the comment to match reality.

### Thread 3: full-ai-cluster/usb-nixos-installer/zeta-install.sh:604 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T16:23:32Z):

P2: This warning points to `usb-nixos-installer/nixos/installer/configuration.nix`, but the path in-repo is `full-ai-cluster/usb-nixos-installer/nixos/installer/configuration.nix`. Using the correct path will make debugging missing `gh` on the ISO less confusing.

### Thread 4: full-ai-cluster/usb-nixos-installer/zeta-install.sh:661 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T16:23:33Z):

P1: The install-complete banner always prints `password: zeta-change-me`, but Step 6.55 allows the operator to set a different initial password (iter-5.3). This is likely to mislead operators who set a custom password; consider printing something like “password: (as set during iter-5.3 prompt; if skipped, zeta-change-me)” instead of a fixed value.

### Thread 5: full-ai-cluster/nixos/modules/operator-authorized-keys.nix:54 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T16:23:33Z):

P1: `isKeyLine` only accepts lines starting with `ssh-` or `ecdsa-`, but GitHub can store FIDO/U2F keys like `sk-ssh-ed25519@openssh.com` / `sk-ecdsa-sha2-*` (and the existing operator-ssh-keys.nix explicitly documents `sk-*` support). As written, those keys would be silently dropped and SSH would fail for operators who only have `sk-*` keys. Expand the filter to include `sk-` key types (or reuse the same validation approach as operator-ssh-keys.nix).

## General comments

### @chatgpt-codex-connector (2026-05-26T16:19:41Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
