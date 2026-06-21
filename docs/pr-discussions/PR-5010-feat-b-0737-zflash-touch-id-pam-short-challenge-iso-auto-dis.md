---
pr_number: 5010
title: "feat(081KSE6WT0008QG0R003WZAQKV): zflash + Touch ID PAM + short challenge + ISO auto-discovery \u2014 'I execute, you fingerprint' (carry-over from #4997)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T22:26:11Z"
merged_at: "2026-05-25T22:28:48Z"
closed_at: "2026-05-25T22:28:48Z"
head_ref: "feat/b0737-zflash-resquash-aaron-2026-05-25"
base_ref: "main"
archived_at: "2026-05-25T22:41:54Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5010: feat(081KSE6WT0008QG0R003WZAQKV): zflash + Touch ID PAM + short challenge + ISO auto-discovery — 'I execute, you fingerprint' (carry-over from #4997)

## PR description

## Summary

Carry-over from PR #4997 which got force-pushed to no-diff state in error + GitHub auto-closed + refused reopen. This PR carries the same 081KSE6WT0008QG0R003WZAQKV zflash substrate + all 7 Copilot+Codex review fixes from the original PR's iteration trail, squashed onto current origin/main.

Aaron 2026-05-25 verbatim: *"minimize for humain to easy to type one liners and add sudo via touch and then maybe even you can executie and i have to approve with my fingerprint."*

## What ships

- **`full-ai-cluster/tools/flash-usb.ts`** — existing destructive-tool authoring contract (081KSE6WT0008QG0R0005XASX2) + new `--short` flag for `yes <4-hex>` challenge format + strict flag allowlist (P0 fix)
- **`full-ai-cluster/tools/zflash.ts`** — thin Bun wrapper; auto-discovers newest `~/Downloads/zeta-installer-*.iso`; invokes flash-usb `--short` with stdio inheritance; strict allowlist for `-h`/`--help`; bails on >1 positional arg
- **`full-ai-cluster/tools/zflash-setup.ts`** — idempotent Touch ID PAM installer; prepends `auth sufficient pam_tid.so` to `/etc/pam.d/sudo` via `sudo tee` (CR/LF preserved via heuristic); optional `--install-alias` adds shell-quoted alias to `~/.zshrc`; documents that `sudo tee` is not crash-atomic + trade-off rationale
- All 3 files use `fileURLToPath()` for safe filesystem path derivation (handles spaces + unicode in checkout paths)
- Shell-quoted alias via `shellQuoteForAlias()` helper
- All `spawnSync("sudo"/"tee", ...)` calls have `eslint-disable-next-line sonarjs/no-os-command-from-path` with rationale
- **081KSE6WT0008QG0R003WZAQKV backlog row** documenting the substrate

## After merge + one-time setup

```bash
bun full-ai-cluster/tools/zflash-setup.ts --install-alias
# Asks for sudo password ONCE; installs Touch ID PAM; adds shell alias
# Then forever after:
zflash               # ~5 chars
> yes a3f9           # ~8 chars (per-run nonce, type what's printed)
[Touch ID prompt]    # 1 fingerprint
Flash complete.
```

Agent-driven mode: **1 fingerprint, no keystrokes** (agent types nonce; Touch ID PAM is the irreversible-action consent gate the agent cannot spoof).

## Composes with

- 081KSE6WT0008QG0R0005XASX2 (destructive-tool authoring contract)
- 081KSE6WT0008QG0R003WW3YJQ (desktop admin consent pattern — this PR's substrate IS the empirical anchor)
- 081KSE6WT0008QG0R002YBWBB1 (leverage-class safety substrate — Layer 1 provenance)
- 081KSE6WT0008QG0R003BG8M6J / 081KSE6WT0008QG0R0025170CV (Linux + Windows variant scope)
- 081KSE6WT0008QG0R000YYH3DY (reference k8s stack — zflash is part of bring-up)

## Test plan

- [x] All prior 7 Copilot+Codex review findings addressed (strict args + URL-decode + shell-quote + sonar suppressions + comment fixes + indentation)
- [x] Files import + execute clean (smoke-tested via `bun -e "import('...').then(...)"`)
- [x] Squash onto current origin/main avoids the BACKLOG.md regen conflicts the prior PR hit during rebase
- [x] BACKLOG.md regenerated via `BACKLOG_WRITE_FORCE=1 bun tools/backlog/generate-index.ts`

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-25T22:26:14Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
