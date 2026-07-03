---
pr_number: 5360
title: "hygiene: format stale worktree auditor"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T23:58:28Z"
merged_at: "2026-05-27T00:01:33Z"
closed_at: "2026-05-27T00:01:33Z"
head_ref: "claim/codex-loop-stale-worktree-prettier-20260526"
base_ref: "main"
archived_at: "2026-05-27T19:30:21Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5360: hygiene: format stale worktree auditor

## PR description

## Summary

- normalize `audit-stale-worktrees` and its focused test to the repository Prettier style
- add a Codex claim record for the bounded formatting slice
- leave stale-worktree audit behavior unchanged

## Checks

- `bun test tools/hygiene/audit-stale-worktrees.test.ts`
- `node_modules/.bin/prettier --check tools/hygiene/audit-stale-worktrees.ts tools/hygiene/audit-stale-worktrees.test.ts`
- `node_modules/.bin/tsc --noEmit -p tsconfig.json`

## General comments

### @chatgpt-codex-connector (2026-05-26T23:58:33Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
