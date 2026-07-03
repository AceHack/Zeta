---
pr_number: 5476
title: "feat(081KSKBP80008QG0R003AX2A69.4a+4d): NixOS module zeta-creds-restore.nix + wire into cluster common.nix imports \u2014 last gate for end-to-end USB cred-persistence test (Aaron 2026-05-27 USB priority)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T14:30:29Z"
merged_at: "2026-05-27T14:40:07Z"
closed_at: "2026-05-27T14:40:07Z"
head_ref: "feat/b-0852-4a-4d-nixos-module-plus-common-nix-wire-2026-05-27"
base_ref: "main"
archived_at: "2026-05-27T19:23:43Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5476: feat(081KSKBP80008QG0R003AX2A69.4a+4d): NixOS module zeta-creds-restore.nix + wire into cluster common.nix imports — last gate for end-to-end USB cred-persistence test (Aaron 2026-05-27 USB priority)

## PR description

## Summary

Two commits bundled — the NixOS module + the common.nix import — together completing the end-to-end USB cred-persistence chain.

**Commit 1 (081KSKBP80008QG0R003AX2A69.4a)**: \`full-ai-cluster/nixos/modules/zeta-creds-restore.nix\` — systemd service \`zeta-creds-restore.service\` that decrypts \`/esp/zeta-creds.enc\` at boot (via 081KSKBP80008QG0R003AX2A69.2b restore CLI), populates per-cred files, fires before 081KSKBP80008QG0R000GPC0TB.1 \`zeta-self-register.service\`. Two passphrase modes (file / interactive); disabled by default; opt-in per host config.

**Commit 2 (081KSKBP80008QG0R003AX2A69.4d)**: adds \`./zeta-creds-restore.nix\` to \`full-ai-cluster/nixos/modules/common.nix\` imports list right after \`./zeta-self-register.nix\` — every cluster node now inherits the module surface; per-host opt-in via \`zeta.credsRestore.enable = true;\`.

## End-to-end USB test path now complete

1. Reflash USB with ISO carrying these changes
2. Boot, run installer with ZETA_CREDS_PICKER=1 + ZETA_CREDS_PASSPHRASE=...
3. Step 6.95-picker writes \`/esp/zeta-creds.enc\` (081KSKBP80008QG0R003AX2A69.3a, PR #5450 in flight)
4. Operator enables \`zeta.credsRestore.enable = true;\` in host config + pre-stages \`/run/zeta-creds-passphrase\`
5. Reboot → \`zeta-creds-restore.service\` fires → blob decrypted → per-cred files populated
6. \`zeta-self-register.service\` fires next per 081KSKBP80008QG0R000GPC0TB.1 ordering

## Test plan

- [x] \`nix-instantiate --parse\` on both files → PARSE OK
- [x] Module disabled by default (opt-in via host config)
- [x] AgencySignature v1 trailers on both commits
- [x] Per .claude/rules/agent-worktree-hygiene-...: isolated worktree

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T14:35:18Z)

## Pull request overview

This PR completes the NixOS-side of the USB credential persistence chain by introducing a new `zeta-creds-restore` module (boot-time decrypt + restore from `/esp/zeta-creds.enc`) and wiring it into the cluster-wide `common.nix` module import set so every node has the same opt-in surface.

**Changes:**

- Adds `full-ai-cluster/nixos/modules/zeta-creds-restore.nix`, defining `zeta.credsRestore.*` options and a `zeta-creds-restore.service` oneshot unit.
- Imports the new module from `full-ai-cluster/nixos/modules/common.nix` so it’s available across cluster node types.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 3 comments.

| File | Description |
| ---- | ----------- |
| full-ai-cluster/nixos/modules/zeta-creds-restore.nix | New NixOS module + systemd unit to restore credentials from ESP at boot. |
| full-ai-cluster/nixos/modules/common.nix | Adds the new module to the shared cluster module import list. |

## Review threads

### Thread 1: full-ai-cluster/nixos/modules/zeta-creds-restore.nix:180 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T14:35:16Z):

P0: `sudo -u ${cfg.user}` runs the restore CLI without root privileges, but the default credential manifest includes required `/etc/...` targets (e.g. `/etc/zeta/operator-authorized-keys`, `/etc/ssh/ssh_host_*` in tools/installer/zeta-creds-manifest.ts). This will reliably fail to restore required creds on boot. Consider running the restore CLI as root (keep `HOME=${cfg.home}` so `~` resolves to /home/zeta), then `chown` the home-scoped credential paths to `${cfg.user}:${cfg.group}` after the restore completes.

### Thread 2: full-ai-cluster/nixos/modules/zeta-creds-restore.nix:208 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T14:35:17Z):

P0: `RemainAfterExit = true` keeps the oneshot unit in an active state after `ExecStart` returns, so `ExecStopPost` cleanup will not run on a normal successful boot. That leaves `/run/zeta-creds-passphrase-temp` and (in file mode) `${cfg.passphraseFile}` behind, contradicting the “deleted on stop”/“always clean up” intent. Move cleanup into the `ExecStart` script (e.g., trap +/or remove-on-success), or drop `RemainAfterExit` and use `ExecStartPost` for cleanup.

### Thread 3: full-ai-cluster/nixos/modules/zeta-creds-restore.nix:140 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T14:35:18Z):

`USB_UUID="$(cat …)"` will include a trailing newline if the file ends with one, which then gets passed through to `--usb-uuid`. Safer to trim whitespace (e.g. `tr -d '\r\n'`) so the UUID is stable regardless of how the file was authored.

## General comments

### @chatgpt-codex-connector (2026-05-27T14:30:35Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
