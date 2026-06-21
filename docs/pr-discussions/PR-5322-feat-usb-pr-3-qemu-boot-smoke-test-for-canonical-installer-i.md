---
pr_number: 5322
title: "feat(USB PR 3): QEMU boot smoke-test for canonical installer ISO \u2014 cascade #5 dynamic boot floor"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T21:12:27Z"
merged_at: "2026-05-26T21:14:53Z"
closed_at: "2026-05-26T21:14:53Z"
head_ref: "otto-cli/usb-cleanup-pr3-qemu-boot-smoke-test-build-ai-cluster-iso-workflow-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:34:02Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5322: feat(USB PR 3): QEMU boot smoke-test for canonical installer ISO — cascade #5 dynamic boot floor

## PR description

## Summary

USB cleanup PR 3 of 3. Adds dynamic boot-time verification to the canonical AI-cluster ISO build pipeline. Catches the bug class where the ISO builds + audits pass but the kernel/initrd combination fails to actually boot (firmware mismatch; missing module; broken init).

Per Aaron's direction: \"push iso testing closer into the ci instead of neading human to physically test usb but also after a few rounds i will physically test teh usb\".

Per Kestrel's ferry pointer (PR #5310 research doc): prior art at \`nixos/tests/installer.nix\`.

## What lands (2 files)

### 1. \`tools/ci/qemu-boot-test.ts\` (~150 lines, Rule 0 compliant)

TS helper that spawns \`qemu-system-x86_64\` with KVM acceleration (TCG fallback when KVM unavailable for local testing), captures serial console to log file, waits up to 5min for the installer's expected login prompt (\`zeta-installer login:\` — matches \`networking.hostName = \"zeta-installer\"\` in the canonical installer config), kills QEMU, returns exit code.

- 2GB RAM + 2 SMP cores (installer needs >= 1GB; 2GB headroom)
- q35 machine type (modern PCIe; matches Beelink hardware profile better than legacy i440fx)
- BIOS boot (simpler than UEFI; ISO supports both)
- Exit codes: 0 success / 1 boot failure / 2 usage error

### 2. \`.github/workflows/build-ai-cluster-iso.yml\` extension

Adds 2 new steps AFTER the existing \"Audit installer ISO content\" step + BEFORE \"Locate ISO + capture metadata\":

- \"Install QEMU (apt)\" — apt-get install qemu-system-x86 on ubuntu-24.04 (~30s)
- \"QEMU boot smoke-test (cascade #5 — dynamic boot floor)\" — invokes the TS helper

No \`github.event.*\` interpolation in run: lines per the GitHub Actions script-injection security guide.

## Verification cascade post-PR-3

| # | Step | When | Cost |
|---|---|---|---|
| 1 | Source-substrate audit | Preflight | ~1s |
| 4 | ISO content audit | Post-build (7z list) | ~10s |
| **5** | **QEMU boot smoke-test** | **Post-build (KVM boot)** | **~3-5min** |
| - | Locate + metadata + artifact upload | Post-build | existing |

Estimated CI time impact: +3-5min per build (KVM keeps it fast vs TCG).

## What this is NOT (substrate-honest defer list)

- NOT a full integration test (doesn't login + run commands) — future B-NNNN follow-up
- NOT a multi-arch test (x86_64 only) — separate build path if/when needed
- NOT a hardware-specific test (UEFI variant; specific GPUs) — physical USB test on real Beelink fills that gap (Aaron's gate)
- NOT a release-attach step (081KSGS9H0008QG0R00126RHQR follow-up filed in PR #5320)

This is the SIMPLEST viable boot test. Once it lands + runs across a few cycles + catches at least one real boot regression (or demonstrates none for N runs), Aaron's physical USB test gate fires.

## Composes with

- PR #5311 (USB cleanup PR 1: root usb-nixos-installer/ deleted)
- PR #5320 (USB cleanup PR 2: infra/installer + legacy workflow retired + 081KSGS9H0008QG0R00126RHQR release-attach follow-up filed)
- \`.claude/rules/rule-0-no-sh-files.md\` (TS-over-bash discipline)
- \`.claude/rules/refresh-world-model-poll-pr-gate.md\` (authored from fresh independent clone per 081KSGS9H0008QG0R002H0ENQ1)
- PR #5291 substrate-check-before-worry-deployment discipline (cascade hierarchy applies cleanly)

## Test plan

- [x] Pre-commit canary green (HEAD 60 = HEAD~1 60; modifications + 1 new TS helper)
- [x] Branch follows \`otto-cli/*\` surface-prefix convention
- [x] Authored from fresh independent clone
- [x] No \`github.event.*\` interpolation in run: lines (security-reminder hook pattern)
- [ ] CI green (the new QEMU step will exercise itself on this PR)
- [ ] Copilot review pass

## General comments

### @chatgpt-codex-connector (2026-05-26T21:12:32Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
