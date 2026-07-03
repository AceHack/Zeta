---
pr_number: 5083
title: "feat(081KSGS9H0008QG0R002T3BJ2R iter-4.2): zflash auto-inject SSH pubkey to boot USB ESP + zeta-install.sh probe \u2014 zero-typing SSH on first boot"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T04:19:31Z"
merged_at: "2026-05-26T04:22:22Z"
closed_at: "2026-05-26T04:22:22Z"
head_ref: "otto-cli/iter42-usb-pubkey-inject-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:44:44Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5083: feat(081KSGS9H0008QG0R002T3BJ2R iter-4.2): zflash auto-inject SSH pubkey to boot USB ESP + zeta-install.sh probe — zero-typing SSH on first boot

## PR description

## Summary

The maintainer's actually-usable iter-4 path. Builds on PR #5080 (v1 scaffolding: initial-password.nix + operator-ssh-keys.nix stub + per-host imports). Result: `zflash` on macOS → boot USB on PC → install → SSH-able as `zeta@<hostname>` from the maintainer's Mac using the existing `~/.ssh/id_ed25519` key. Zero operator-typed commands beyond `zflash`.

## Design discipline (per Aaron 2026-05-26 four signals)

1. *"if that's ssh lets do that first cause we want to get ai running the cluster asap"* → iter-4 authorized
2. *"i can wait for 4.2 or whatever version before we try again"* → this PR is the workflow Aaron flashes
3. *"--no-creds is basically useless right?"* → opt-out removed from recommended path (`--no-inject` kept as escape hatch only)
4. *"whenever i have to ferry commands by reading and typing i'm going to avoid it like the plague and try to get like pictures and auto run and short commands pre built in"* → ALL diagnostics auto-fire in-place + are photo-friendly

## Files

- **`full-ai-cluster/tools/flash-usb.ts`**: added `--no-eject` flag (allowlist + skip-eject branch) so zflash can do post-flash ESP-mount-and-write before the USB ejects
- **`full-ai-cluster/tools/zflash.ts`**: post-flash macOS-side ESP-mount-and-write:
  - Default `~/.ssh/id_ed25519.pub`; `--ssh-key <path>` override; `--no-inject` escape hatch
  - Re-scans external disks; identifies FAT/EFI partition via `diskutil list` regex; mounts; gets mount point via `diskutil info`; writes via `sudo tee`; unmounts + ejects
  - `dumpDiagnostics()` auto-fires on any failure: `diskutil list external` + mounted `/Volumes/*` + "what to do next" suggestions. Photo-friendly compact block
- **`full-ai-cluster/usb-nixos-installer/zeta-install.sh`**: step 6.5 pre-install probe:
  - Try 1: scan `/iso /run /mnt /boot` for `zeta-authorized-keys.pub`
  - Try 2: probe USB partitions (excluding install targets) via vfat-readonly mount
  - If found: writes `operator-ssh-keys.nix` with valid `ssh-*` lines before `nixos-install`
  - If not found: diagnostics auto-fire (external block devices, install targets, lsblk, "what to do next") + falls back to v1 stub
  - Post-install credentials echo branches on `INJECT_OK`: success says "SSH works immediately"; fallback keeps v1 manual instructions
  - shellcheck clean (fixed SC2261)
- **`docs/backlog/P1/081KSGS9H0008QG0R002T3BJ2R-*.md`**: updated iter-4.2 acceptance to mark what shipped + the maintainer-test-pending checkpoint

## End-to-end zero-typing flow

```
$ zflash
ISO: ~/Downloads/zeta-installer-24.11.iso (1.70 GiB)
USB: /dev/disk6 (115 GiB, USB 3.2.1 FD)
*** ALL DATA ON /dev/disk6 WILL BE DESTROYED ***
type: yes a3f9
> yes a3f9
[Touch ID prompt]
Flash complete.
iter-4.2: injecting ~/.ssh/id_ed25519.pub into /dev/disk6 ESP ...
iter-4.2: pubkey written; USB ejected. Safe to remove.
$ # plug into PC 1, boot, install runs autonomously, PC 1 reboots
$ ssh zeta@control-plane     # works immediately on first boot
```

## Failure-path workflow (per Aaron's photo-driven design)

If anything in zflash's ESP-mount or zeta-install.sh's probe fails, photo-friendly diagnostics auto-fire in-place. Aaron photographs + sends → AI fixes-forward against the actual substrate the photo reveals. No "now run this command to debug" — the diagnostic IS the in-place output.

## Test plan

- [x] flash-usb.ts --help parses + shows new --no-eject flag
- [x] zflash.ts --help parses + shows new --ssh-key + --no-inject flags
- [x] shellcheck clean on zeta-install.sh
- [x] markdownlint clean on 081KSGS9H0008QG0R002T3BJ2R row
- [ ] **Maintainer flashes iter-4.2 USB once, plugs into PC, verifies `ssh zeta@<hostname>` works immediately** ← end-to-end success criterion
- [ ] If failure: photo of auto-diagnostics → fix-forward PR
- [ ] CI passes (gate workflow + CodeQL)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T04:23:00Z)

## Pull request overview

This PR extends the AI-cluster USB flashing + installer workflow to enable “zero-typing” SSH access on first boot by automatically copying the operator’s SSH public key onto the flashed USB (macOS-side) and injecting it into the installed NixOS config during `zeta-install.sh`.

**Changes:**

- Add `--no-eject` to `flash-usb.ts` so downstream tooling can mount/write the USB ESP before ejection.
- Extend `zflash.ts` to (optionally) mount the flashed USB’s FAT/EFI partition and write `zeta-authorized-keys.pub`, with photo-friendly diagnostics on failures.
- Extend `zeta-install.sh` to probe for `zeta-authorized-keys.pub` and generate `operator-ssh-keys.nix` prior to `nixos-install`, with branched post-install messaging.

### Reviewed changes

Copilot reviewed 4 out of 4 changed files in this pull request and generated 5 comments.

| File | Description |
| ---- | ----------- |
| full-ai-cluster/usb-nixos-installer/zeta-install.sh | Adds step 6.5 USB pubkey probe + injection into `operator-ssh-keys.nix`, plus updated post-install messaging. |
| full-ai-cluster/tools/zflash.ts | Adds iter-4.2 post-flash ESP mount/write of `zeta-authorized-keys.pub` and diagnostics; adds `--ssh-key` / `--no-inject`. |
| full-ai-cluster/tools/flash-usb.ts | Adds `--no-eject` flag and skips eject when requested to support post-flash ESP writes. |
| docs/backlog/P1/081KSGS9H0008QG0R002T3BJ2R-iter4-ssh-key-and-hashedpassword-substrate-for-cluster-bringup-2026-05-26.md | Updates iter-4.2 acceptance checklist to reflect the shipped auto-inject/probe behavior. |

## Review threads

### Thread 1: full-ai-cluster/usb-nixos-installer/zeta-install.sh:248 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T04:22:58Z):

P0: With `set -euo pipefail`, this `find /iso /run /mnt /boot ... | head -1` pipeline can terminate the whole install if any of those root dirs don’t exist (e.g., `/iso` on some installers) because `find` exits non-zero on missing start paths. Make the mounted-FS scan resilient by only including directories that exist and/or by explicitly tolerating `find` errors so the script continues to the USB-partition probe/fallback path instead of aborting the install.

### Thread 2: full-ai-cluster/usb-nixos-installer/zeta-install.sh:289 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T04:22:59Z):

P0: This loop reads from `$PUBKEY_FILE` without `sudo`. If the file is only root-readable (likely for paths under `/mnt` or a root-owned mount), the redirection will fail and `set -e` will abort the install. Read the file content via `sudo` (or ensure permissions) so a permissions issue degrades to the intended diagnostics/fallback rather than killing the installer.

### Thread 3: full-ai-cluster/usb-nixos-installer/zeta-install.sh:304 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T04:22:59Z):

P0/security: The pubkey line is inserted into a quoted Nix string without escaping. If the key comment contains a double-quote or backslash (or a maliciously crafted line lands on the USB), the generated `operator-ssh-keys.nix` becomes invalid or could be turned into Nix code injection at install time. Escape Nix string metacharacters (at least `\` and `"`) and/or parse+reconstruct keys more strictly (type + base64 + optional comment) before writing the Nix module.

### Thread 4: full-ai-cluster/tools/zflash.ts:337 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T04:22:59Z):

P1: `--ssh-key` examples encourage `~/.ssh/...`, but `resolve(next)` does not expand `~` in Node. As a result, `--ssh-key ~/.ssh/id_ed25519.pub` will resolve to a literal `.../~/...` path and fail existence checks / injection. Expand a leading `~/` to `homedir()` (and consider doing the same for the positional ISO path).

### Thread 5: full-ai-cluster/tools/zflash.ts:272 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T04:23:00Z):

P1: The pubkey format validation rejects common OpenSSH public key types like `ecdsa-sha2-nistp256 ...` and FIDO keys (`sk-ssh-ed25519@openssh.com ...`). Either broaden the accepted key-type prefixes to match OpenSSH’s standard formats or validate more structurally (key type token + base64 token) so `--ssh-key` works for non-ed25519 operators too.

## General comments

### @chatgpt-codex-connector (2026-05-26T04:19:35Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
