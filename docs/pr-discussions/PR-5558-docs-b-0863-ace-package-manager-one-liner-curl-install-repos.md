---
pr_number: 5558
title: "docs(081KSKBP80008QG0R000F4311E): Ace package manager \u2014 one-liner curl-install repository for fast-moving tools (operator 2026-05-27)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T17:56:42Z"
merged_at: "2026-05-27T18:00:13Z"
closed_at: "2026-05-27T18:00:13Z"
head_ref: "backlog/b-0863-ace-package-manager-one-liner-curl-install-repository-fast-moving-tools-2026-05-27"
base_ref: "main"
archived_at: "2026-05-27T18:51:28Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5558: docs(081KSKBP80008QG0R000F4311E): Ace package manager — one-liner curl-install repository for fast-moving tools (operator 2026-05-27)

## PR description

## Summary

Operator-directed substrate-engineering target row:

> *\"we can keep a reposity of them for things that change too fast
> for homebrew and such. hermes would be a candidate\"*

Files 081KSKBP80008QG0R000F4311E for the Ace package manager one-liner `curl ... | bash`
install repository pattern. Hermes-agent named as canonical first
candidate (PR #5547 added to brew manifest short-term; one-liner
pattern is medium-term substrate).

## Key content

- Substrate-engineering problem (Homebrew lag vs AI agent release cadence)
- Ace one-liner pattern with vendor + URL + verify-pattern + trust-assumption + brew-fallback
- 6-component implementation decomposition (081KSKBP80008QG0R000F4311E.1 schema → 081KSKBP80008QG0R000F4311E.6 install.sh integration)
- Composition with 081KR2E4K0008QG0R002YE3MMD Ace + 081KSGS9H0008QG0R0031PBNGA package-of-packages + 5 framework rules

Priority P2 — substrate-engineering target; opportunistic implementation.

## Test plan

- [x] Markdownlint clean
- [x] Substrate-inventory pass per verify-existing-substrate-before-authoring
- [x] BACKLOG.md regenerated
- [x] Composes with PR #5547 hermes-agent brew addition
- [ ] CI passes (auto-merge to fire on green)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-27T17:56:46Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
