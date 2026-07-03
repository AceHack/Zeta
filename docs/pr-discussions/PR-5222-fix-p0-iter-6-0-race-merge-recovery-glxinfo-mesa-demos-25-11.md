---
pr_number: 5222
title: "fix(p0 iter-6.0 race-merge-recovery): glxinfo \u2192 mesa-demos (25.11 breaking change; PR #5218 auto-merge race fired before this fix was pushed)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T16:53:37Z"
merged_at: "2026-05-26T16:56:38Z"
closed_at: "2026-05-26T16:56:39Z"
head_ref: "otto-cli/p0-fixfwd-glxinfo-mesa-demos-25-11-breaking-change-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:37:42Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5222: fix(p0 iter-6.0 race-merge-recovery): glxinfo → mesa-demos (25.11 breaking change; PR #5218 auto-merge race fired before this fix was pushed)

## PR description

Auto-merge race on PR #5218: glxinfo→mesa-demos fix landed in branch AFTER merge fired. Main has 25.11 bump but glxinfo still present → ISO builds fail. This PR lands the fix directly. Empirical anchor of the auto-merge-race-with-follow-up-commit anti-pattern documented in blocked-green-ci-investigate-threads.md.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T16:55:35Z)

## Pull request overview

This PR unblocks the iter-6.0 NixOS 25.11 (“Xantusia”) ISO build by replacing the removed `glxinfo` package reference with its supported replacement (`mesa-demos`) in the AI-cluster installer and GPU module.

**Changes:**

- Replace `glxinfo` → `mesa-demos` in the USB installer ISO package set.
- Replace `glxinfo` → `mesa-demos` in the NVIDIA GPU module’s `environment.systemPackages`.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| full-ai-cluster/usb-nixos-installer/nixos/installer/configuration.nix | Updates installer ISO packages to use `mesa-demos` instead of `glxinfo` under nixpkgs 25.11. |
| full-ai-cluster/nixos/modules/gpu.nix | Updates GPU tooling package list to use `mesa-demos` instead of `glxinfo`. |

## General comments

### @chatgpt-codex-connector (2026-05-26T16:53:47Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
