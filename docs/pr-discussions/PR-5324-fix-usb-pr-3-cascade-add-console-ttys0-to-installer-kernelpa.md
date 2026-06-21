---
pr_number: 5324
title: "fix(USB PR 3 cascade): add console=ttyS0 to installer kernelParams \u2014 QEMU boot smoke-test couldn't capture serial output"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T21:28:33Z"
merged_at: "2026-05-26T21:31:53Z"
closed_at: "2026-05-26T21:31:53Z"
head_ref: "otto-cli/usb-pr3-fix-add-serial-console-to-installer-kernel-params-for-qemu-cascade-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:32:21Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5324: fix(USB PR 3 cascade): add console=ttyS0 to installer kernelParams — QEMU boot smoke-test couldn't capture serial output

## PR description

## Summary

First-cycle outcome from PR #5322's new QEMU boot smoke-test (cascade #5): **the test correctly caught a real config gap** — serial console wasn't enabled in the installer NixOS config. ISO boots fine (GRUB + kernel + initrd loaded per serial log) but timed out waiting for `zeta-installer login:` because all systemd/getty output went to VGA tty1, which QEMU's `-display none` hides.

## Fix

Add to `full-ai-cluster/usb-nixos-installer/nixos/installer/configuration.nix`:

```nix
boot.kernelParams = [
  "console=ttyS0,115200n8"
  "console=tty1"
];
```

- tty1 stays primary (keyboard-attached install flow unchanged)
- ttyS0 mirrors at standard 115200 8N1 for QEMU capture + real hardware with serial headers

## Why this is the right fix

Substrate-honest framing per the QEMU test's commit message goal ("catches the bug class where the ISO builds + audits pass but the kernel/initrd combination fails to actually boot"): the test is doing its job. The MISSING config (serial console) was a real gap surfaced on first cycle.

Beneficiaries of serial console output:
- CI QEMU boot smoke-test (cascade #5)
- Real hardware with serial headers (some Beelinks; most server-class boards)
- Debugging scenarios where the only output channel is RS-232

## What this is NOT

- NOT a fix to the QEMU test itself (the test is correct)
- NOT a behavior change for the keyboard-attached install flow (tty1 still primary)
- NOT a security concern (serial console is local-physical-presence; no remote exposure)

## Test plan

- [x] Pre-commit: minimal change (4-line addition + 13-line comment block)
- [x] Branch follows `otto-cli/*` convention
- [x] Authored from fresh independent clone per 081KSGS9H0008QG0R002H0ENQ1
- [ ] CI green — including the new QEMU boot smoke-test which should NOW pass with serial console enabled
- [ ] Copilot review pass

## Composes with

- PR #5322 (the QEMU boot smoke-test workflow this fixes the cascade for)
- 081KSGS9H0008QG0R002T3BJ2R iter-3 firmware substrate (similar UX-cleanliness motivation; surface less mysterious behavior)
- canonical zflash + zeta-install flow (no behavioral change for keyboard-attached path)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T21:30:06Z)

## Pull request overview

Enables serial console output for the NixOS installer ISO so the CI QEMU boot smoke-test (run with `-display none`) can observe the installer reaching the `zeta-installer login:` prompt via captured serial output, while preserving the VGA/keyboard-attached install flow.

**Changes:**
- Add `boot.kernelParams` entries to enable `ttyS0` (115200 8N1) console output in addition to `tty1`.
- Document the rationale and expected behavior (tty1 primary, ttyS0 mirrored) inline in the installer configuration.

## General comments

### @chatgpt-codex-connector (2026-05-26T21:28:38Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
