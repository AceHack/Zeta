---
pr_number: 5328
title: "feat(cluster-inventory): port capture to bun"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T21:41:18Z"
merged_at: "2026-05-26T22:02:36Z"
closed_at: "2026-05-26T22:02:36Z"
head_ref: "claim/codex-loop-cluster-inventory-ts-bash-guard-20260526"
base_ref: "main"
archived_at: "2026-05-27T19:32:18Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5328: feat(cluster-inventory): port capture to bun

## PR description

## Summary

- port full-ai-cluster cluster inventory capture from shell to Bun/TypeScript
- widen the bash-retirement guard to the repo-wide retained shell allowlist
- update trajectory and cluster-inventory docs with the new retained shell count

## Checks

- bun test full-ai-cluster/tools/cluster-inventory/capture.test.ts tools/hygiene/check-bash-retirement-inventory.test.ts
- bun tools/hygiene/check-bash-retirement-inventory.ts --enforce
- git diff --check

Note: bun run typecheck could not run locally because tsc is not installed in this worktree.

## General comments

### @chatgpt-codex-connector (2026-05-26T21:53:19Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
