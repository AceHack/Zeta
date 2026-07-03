---
pr_number: 5047
title: "fix(081KSGS9H0008QG0R002T3BJ2R iter-2): empty systemd PATH broke clear+nmtui+ping+systemctl on real hardware"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T00:10:32Z"
merged_at: "2026-05-26T00:22:03Z"
closed_at: "2026-05-26T00:22:04Z"
head_ref: "otto-cli/b0754-fix-systemd-path-iter2-2026-05-25"
base_ref: "main"
archived_at: "2026-05-27T19:46:43Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5047: fix(081KSGS9H0008QG0R002T3BJ2R iter-2): empty systemd PATH broke clear+nmtui+ping+systemctl on real hardware

## PR description

## Iteration 1 result (real-hardware test, Aaron 2026-05-25)

Photo evidence on the cluster node screen after booting the v1 ISO:

- `clear: command not found` (line 40 + line 77) — the role-prompt and banner sections
- `nmtui: command not found` — when ethernet-DHCP wait expired and the wifi-fallback fired
- Drop-to-shell worked correctly — operator landed at a working root prompt with the recovery hints intact

The substrate-honest failure path validated: the script degraded gracefully and the operator could still complete the install manually (`nmtui` + `zeta-install control-plane` from the recovery shell). But the load-bearing zero-typing-automation flow didn't reach the end. **This PR is the fix so iteration 2 completes unattended.**

## Root cause

NixOS systemd services get a **minimal PATH** by default. The first-boot script's bare commands (`clear`, `nmtui`, `ping`, `systemctl`, plus every command zeta-install.sh would reach for — `lsblk`, `sgdisk`, `mkfs.fat`, `mkfs.ext4`, `mount`, `partprobe`, `partprobe`, etc.) all need either explicit absolute paths OR a configured Environment block on the systemd unit. The interactive-shell PATH that 'just works' for SSH or tty2 login is NOT inherited by Type=idle systemd services.

The reason only `clear` and `nmtui` were observed: `nmtui` blocked first; the rest never executed in the failed path.

## Fix (defense in depth)

### 1. systemd unit Environment block (load-bearing)

`configuration.nix`: explicit `PATH` + `TERM` on the zeta-first-boot service. Covers every current AND future bare command:

```nix
environment = {
  PATH = "/run/current-system/sw/bin:/run/current-system/sw/sbin:/run/wrappers/bin";
  TERM = "linux";
};
```

### 2. Script-level belt-and-suspenders

`zeta-first-boot.sh`:

- Replace `clear || true` (×2) with `printf '\\033c' || true` — ANSI 'reset terminal' escape; no external command dependency
- Change `nmtui` invocation to `/run/current-system/sw/bin/nmtui` (absolute path)

Even if the systemd Environment is overridden by some future change, these two failure modes stay fixed.

## Composes with

- 081KSE6WT0008QG0R003G0Y62D first-time-CLI-user persona — drop-to-shell with recovery hints worked exactly as designed; the persona-aligned error path was substrate-honest
- 081KSE6WT0008QG0R003WG0V6P USB-as-repair-tool — same systemd-PATH discipline applies to every command the repair flow will invoke
- 081KSE6WT0008QG0R0015ZF2G6 reference architecture — this is iteration N of N for the AI-native cluster-bootstrap reference; bandwidth payoff across every future install

## Test plan

- [x] `bash -n` syntax check on edited zeta-first-boot.sh
- [ ] CI rebuilds ISO via build-ai-cluster-iso.yml (auto-triggers on `full-ai-cluster/usb-nixos-installer/**` path)
- [ ] Aaron reflashes via zflash + boots cluster node + observes unattended install completes end-to-end
- [ ] CI green

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T00:12:22Z)

## Pull request overview

Fixes the installer ISO’s first-boot automation failing under NixOS systemd’s minimal default `PATH`, so the unattended “zero-typing” flow can complete on real hardware.

**Changes:**

- Replaced `clear` with an ANSI terminal reset escape to remove reliance on `clear` being in `PATH`.
- Invoked `nmtui` via an absolute path to avoid `PATH`-inheritance issues.
- Set explicit `PATH` and `TERM` in the `zeta-first-boot` systemd unit to cover current and future bare command usage in the first-boot flow.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 1 comment.

| File | Description |
| ---- | ----------- |
| full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh | Removes dependency on `clear` being available and pins `nmtui` to an absolute path for robustness under systemd. |
| full-ai-cluster/usb-nixos-installer/nixos/installer/configuration.nix | Adds explicit `PATH`/`TERM` to the first-boot systemd unit to ensure all invoked tools are discoverable in the unit environment. |

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T00:21:32Z)

## Pull request overview

Copilot reviewed 2 out of 2 changed files in this pull request and generated no new comments.

## Review threads

### Thread 1: full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh:120 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T00:12:22Z):

The comment mentions “the env-var below” as a defense, but there isn’t an environment variable being set in the script at/after this point. Consider rewording to reference the systemd unit Environment block (and/or explicitly exporting a PATH in the script if that’s what you meant) so the rationale stays accurate for future readers.

## General comments

### @chatgpt-codex-connector (2026-05-26T00:19:05Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @AceHack (2026-05-26T00:19:11Z)

Fixed in `fd160ff1`: reworded the comment to reference the systemd unit's `environment.PATH` override (set in `configuration.nix` on `systemd.services.zeta-first-boot.environment.PATH` via `lib.mkForce`) rather than implying an env-var is set in the shell script. Thanks for the catch.
