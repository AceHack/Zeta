---
pr_number: 4903
title: "fix(installer): refresh embedded runbook (Addison)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T02:58:27Z"
merged_at: "2026-05-25T03:01:26Z"
closed_at: "2026-05-25T03:01:26Z"
head_ref: "fix/addison-installer-runbook-stale-comment"
base_ref: "main"
archived_at: "2026-05-27T19:51:49Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4903: fix(installer): refresh embedded runbook (Addison)

## PR description

## Summary

The runbook baked onto the USB at \`/etc/zeta-install.md\` was authored before per-host configs landed and still said *"Today: installer only; per-host configs land in follow-up PRs"*. Those per-host configs (control-plane, worker-gpu-01, worker-gpu-02) are on main now — the runbook just hadn't caught up.

## Changes

| Section | Before | After |
|---|---|---|
| Step 6 (hardware config) | Just ran \`nixos-generate-config --root /mnt\` | Now also copies the result into the per-host dir the flake reads — otherwise the install picks up the placeholder hardware-configuration.nix and the target boots wrong |
| Step 7 (install) | Said only \`installer\` host existed | Lists all 4 hosts on main + marks \`installer\` as not-for-target |

Cosmetic only. No code change.

## Test plan

- [ ] markdownlint passes (embedded markdown in a Nix multi-line string isn't directly linted, but the surrounding Nix file is)
- [ ] On a fresh USB build, \`cat /etc/zeta-install.md\` shows the corrected runbook

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T03:00:23Z)

## Pull request overview

Updates the NixOS installer ISO’s embedded offline runbook (`/etc/zeta-install.md`) so it matches the current flake layout with per-host NixOS configurations and avoids accidentally installing with placeholder hardware configuration.

**Changes:**

- Step 6 now instructs copying the generated `hardware-configuration.nix` into the selected per-host directory under `infra/nixos/hosts/<host>/`.
- Step 7 now lists the current `flake.nix` `nixosConfigurations` hostnames and clarifies `installer` is ISO-only (not a target install).
