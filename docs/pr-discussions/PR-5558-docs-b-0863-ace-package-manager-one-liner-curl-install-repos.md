---
pr_number: 5558
title: "docs(B-0863): Ace package manager \u2014 one-liner curl-install repository for fast-moving tools (operator 2026-05-27)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T17:56:42Z"
merged_at: "2026-05-27T18:00:13Z"
closed_at: "2026-05-27T18:00:13Z"
head_ref: "backlog/b-0863-ace-package-manager-one-liner-curl-install-repository-fast-moving-tools-2026-05-27"
base_ref: "main"
archived_at: "2026-05-27T19:06:08Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5558: docs(B-0863): Ace package manager — one-liner curl-install repository for fast-moving tools (operator 2026-05-27)

## PR description

## Summary

Operator-directed substrate-engineering target row:

> *\"we can keep a reposity of them for things that change too fast
> for homebrew and such. hermes would be a candidate\"*

Files B-0863 for the Ace package manager one-liner `curl ... | bash`
install repository pattern. Hermes-agent named as canonical first
candidate (PR #5547 added to brew manifest short-term; one-liner
pattern is medium-term substrate).

## Key content

- Substrate-engineering problem (Homebrew lag vs AI agent release cadence)
- Ace one-liner pattern with vendor + URL + verify-pattern + trust-assumption + brew-fallback
- 6-component implementation decomposition (B-0863.1 schema → B-0863.6 install.sh integration)
- Composition with B-0288 Ace + B-0824 package-of-packages + 5 framework rules

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
