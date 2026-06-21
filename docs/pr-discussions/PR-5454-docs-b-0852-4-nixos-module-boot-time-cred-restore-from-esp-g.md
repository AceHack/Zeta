---
pr_number: 5454
title: "docs(081KSKBP80008QG0R002XBRGN8): NixOS module boot-time cred-restore from ESP \u2014 gates end-to-end USB test (Aaron 2026-05-27 USB push)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T13:42:04Z"
merged_at: "2026-05-27T13:43:58Z"
closed_at: "2026-05-27T13:43:58Z"
head_ref: "backlog/b-0852-4-nixos-module-boot-restore-row-2026-05-27"
base_ref: "main"
archived_at: "2026-05-27T19:23:49Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5454: docs(081KSKBP80008QG0R002XBRGN8): NixOS module boot-time cred-restore from ESP — gates end-to-end USB test (Aaron 2026-05-27 USB push)

## PR description

## Summary

Files 081KSKBP80008QG0R002XBRGN8 row capturing the boot-time companion to 081KSKBP80008QG0R003AX2A69.3a picker (PR #5450).

**Why this gates the USB test**: picker writes blob → reboot → without 081KSKBP80008QG0R002XBRGN8 the blob is ignored. With 081KSKBP80008QG0R002XBRGN8: full persist → restore → use chain on real USB hardware.

## Sub-rows

- 4a NixOS module + systemd unit
- 4b interactive systemd-ask-password mode
- 4c file-based env-injected passphrase (simpler; first to ship)
- 4d wire into common.nix
- 4e empirical USB end-to-end test

Order: 4a → 4c → 4d → 4e → 4b.

## Test plan

- [x] Single-file row + BACKLOG.md regen
- [x] Substrate-inventory pass cited inline
- [x] AgencySignature v1 trailer block on commit (heartbeat-via-commit per CLAUDE.md PR #5451)
- [x] Per .claude/rules/agent-worktree-hygiene-never-hold-main-...: isolated worktree

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-27T13:42:08Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
