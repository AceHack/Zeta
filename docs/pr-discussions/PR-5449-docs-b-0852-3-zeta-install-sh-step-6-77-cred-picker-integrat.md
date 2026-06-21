---
pr_number: 5449
title: "docs(081KSKBP80008QG0R003ETGS01): zeta-install.sh Step 6.77 cred-picker integration row \u2014 interactive bake-in + zflash CLI override (Aaron 2026-05-27 USB push)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T13:32:59Z"
merged_at: "2026-05-27T13:34:21Z"
closed_at: "2026-05-27T13:34:21Z"
head_ref: "backlog/b-0852-3-cred-picker-integration-row-2026-05-27"
base_ref: "main"
archived_at: "2026-05-27T19:23:52Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5449: docs(081KSKBP80008QG0R003ETGS01): zeta-install.sh Step 6.77 cred-picker integration row — interactive bake-in + zflash CLI override (Aaron 2026-05-27 USB push)

## PR description

## Summary

Files 081KSKBP80008QG0R003ETGS01 backlog row capturing operator's 2026-05-27 three-message framing on device-flow-at-setup vs token-at-zflash. Implementation (081KSKBP80008QG0R003AX2A69.3a picker + 081KSKBP80008QG0R003AX2A69.3b zflash CLI flags) starts immediately in follow-up PR.

## Operator USB push

> *"lets keep pushing forward and get cred persistance any anthing else we can make it in before i test again"*

This row is the substrate-engineering anchor; the picker implementation lands separately to maximize chance of reaching next ISO before operator's USB test.

## Sub-rows planned

- 081KSKBP80008QG0R003AX2A69.3a — Step 6.77 interactive picker (consumes 081KSKBP80008QG0R003AX2A69.2b persist CLI)
- 081KSKBP80008QG0R003AX2A69.3b — zflash CLI override flags (per-cred non-interactive; AI-callable)
- 081KSKBP80008QG0R003AX2A69.3c — passphrase-source policy
- 081KSKBP80008QG0R003AX2A69.3d — empirical USB test of full chain

## Test plan

- [x] Single-file documentation row + BACKLOG.md regen
- [x] Substrate-inventory pass per .claude/rules/verify-existing-substrate-before-authoring.md cited inline
- [x] All upstream sub-rows merged (081KSKBP80008QG0R003AX2A69.1/.2a/.2b/.5/.10)
- [x] Per .claude/rules/agent-worktree-hygiene-never-hold-main-...: isolated worktree; never touched operator's primary checkout

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-27T13:33:08Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
