---
pr_number: 5218
title: "feat(081KSGS9H0008QG0R001EKTS5A iter-6.0): bump nixpkgs + nix-darwin 24.11 \u2192 25.11 'Xantusia' (current stable; EOL recovery)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T16:41:56Z"
merged_at: "2026-05-26T16:44:44Z"
closed_at: "2026-05-26T16:44:44Z"
head_ref: "otto-cli/b0800-iter-6-0-bump-nixpkgs-24-11-to-25-11-xantusia-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:39:19Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5218: feat(081KSGS9H0008QG0R001EKTS5A iter-6.0): bump nixpkgs + nix-darwin 24.11 → 25.11 'Xantusia' (current stable; EOL recovery)

## PR description

## Summary — P1 EOL recovery

The maintainer 2026-05-26: *"24.11 is a 2 year old version you found a 25.11 when you searched latest we need to make sure we are on latest too"*.

Per WebSearch (per `.claude/rules/dep-pin-search-first-authority.md` landed earlier today):

- **NixOS 25.11 "Xantusia"** — current stable; released 2025-11-30; EOL 2026-06-30
- Our `nixos-24.11` pin had been EOL since **2025-06-30** (~11 months out-of-support) — substantive supply-chain-security gap

## Changes

| File | Old | New |
|---|---|---|
| `full-ai-cluster/flake.nix` nixpkgs.url | `nixos-24.11` | `nixos-25.11` |
| `full-ai-cluster/flake.nix` nix-darwin.url | `nix-darwin-24.11` | `nix-darwin-25.11` |
| `full-ai-cluster/flake.nix` stateVersion | `24.11` | `25.11` |
| `full-ai-cluster/usb-nixos-installer/flake.nix` nixpkgs+stateVersion | `24.11` | `25.11` |
| `full-ai-cluster/nixos/modules/common.nix` stateVersion default | `24.11` | `25.11` |
| `full-ai-cluster/nixos/hosts/worker-template/default.nix` stateVersion | `24.11` | `25.11` |
| `full-ai-cluster/usb-nixos-installer/nixos/installer/configuration.nix` stateVersion | `24.11` | `25.11` |
| `full-ai-cluster/README.md` + `tools/zflash.ts` | nix-darwin-24.11 / zeta-installer-24.11.iso refs | bumped |
| Both `flake.lock` files | regenerated via `nix flake update` | nixpkgs pinned to `b77b3de` (2026-05-22) |

## stateVersion bump rationale

NixOS guidance: `stateVersion` is sticky — don't bump on already-installed hosts without explicit migration. **PC1 + future cluster nodes are fresh-install scope per the maintainer 2026-05-26** (no persistent K8s workloads yet → safe to bump). Already-installed hosts with their own `nixos/hosts/<name>/configuration.nix` should NOT bump per-host stateVersion in this PR — only the defaults move.

## Validation

- ✅ `nix flake check --no-build --show-trace` on aarch64-darwin (operator Mac) — all attributes evaluate clean
- ⏳ CI ISO build will validate full x86_64-linux build path
- After merge: artifact filename becomes `zeta-installer-25.11.iso` (per stateVersion convention)

## Composes with

- 081KSGS9H0008QG0R002T6J6FS–081KSGS9H0008QG0R002BC2ZR7 iter-6 cluster-update arc (already on main; this is iter-6 sub-target 0 the urgent EOL recovery)
- `.claude/rules/dep-pin-search-first-authority.md` (this PR is exactly the discipline the rule encodes — WebSearch-grounded version bump with citation)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-26T16:42:02Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
