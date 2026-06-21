---
pr_number: 5410
title: "fix(P0-iter-5.4): nixos-install --fallback is NOT a valid flag \u2192 use --option fallback true (empirical USB install failure Aaron 2026-05-27)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T06:50:14Z"
merged_at: "2026-05-27T06:52:41Z"
closed_at: "2026-05-27T06:52:41Z"
head_ref: "fix/p0-nixos-install-fallback-flag-not-supported-2026-05-27"
base_ref: "main"
archived_at: "2026-05-27T19:25:22Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5410: fix(P0-iter-5.4): nixos-install --fallback is NOT a valid flag → use --option fallback true (empirical USB install failure Aaron 2026-05-27)

## PR description

## Summary

**P0 install blocker fix-fwd.** Aaron's 2026-05-27 USB boot test (ISO ci26490417201 / commit 282648d02) hit:

```
Running nixos-install --flake /mnt/etc/zeta/full-ai-cluster#control-plane --fallback ...
/run/current-system/sw/bin/nixos-install: unknown option `--fallback`
[zeta-first-boot] Install failed. See output above.
```

Install dropped to interactive shell; cluster bring-up completely blocked.

## Root cause

PR #5383 added `--fallback` as a top-level flag to `nixos-install`. The flag exists in `nix-build`/`nix-store` but NOT in `nixos-install`. The Nix-option pass-through convention `--option fallback true` IS supported (same shape as the existing `--option connect-timeout 10` / `--option stalled-download-timeout 60` / `--option download-attempts 3` already in the same invocation).

## Fix

1-line change `--fallback \` → `--option fallback true \` + comment update with empirical anchor.

## Operator unblock (live-USB shell right now)

```bash
sed -i 's|^  --fallback \\|  --option fallback true \\|' /run/current-system/sw/bin/zeta-install
zeta-install control-plane
```

## Composes with

- **081KSGS9H0008QG0R00120EEHM** — installer-config-bugs canonical bag (adds Bug 9 to the catalog)
- **081KSGS9H0008QG0R003X5Y2A5** — WiFi-reproducibility substrate; this fix preserves the intent (build-from-source fallback) using the correct API
- PR #5383 (the original `--fallback` addition; supersedes via API correction)

## Test plan

- [ ] Next ISO build from this fix → fresh USB flash → first-boot install completes (no `unknown option` error)
- [ ] cache.nixos.org timeout fallback still operates (verify via `--option fallback true` semantics: Nix builds from source when substituter fails)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-27T06:50:20Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
