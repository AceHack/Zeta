---
pr_number: 4893
title: "fix(lint): correct broken relative-path link in 0008Z shard (race-merged from #4892)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T00:15:56Z"
merged_at: "2026-05-25T00:17:43Z"
closed_at: "2026-05-25T00:17:44Z"
head_ref: "otto-cli/fix-broken-relative-path-link-0008z-shard-2026-05-25"
base_ref: "main"
archived_at: "2026-05-27T19:53:55Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4893: fix(lint): correct broken relative-path link in 0008Z shard (race-merged from #4892)

## PR description

## Summary

- **Race-merged follow-up fix** for PR #4892
- PR #4892 squash-merged before the lint fix could land on the same branch (the documented auto-merge-race-with-follow-up-commit anti-pattern per `.claude/rules/blocked-green-ci-investigate-threads.md` fired)
- Main now has `lint (tick-shard relative-paths)` non-required check FAILING on 0008Z line 86 (broken relative-path link to user-scope memory dir that's out-of-repo)
- This PR's single-commit fix replaces the bracketed link with inline prose describing the user-scope reference
- Local audit clean: 0 broken relative-path links across 1162 shards

## Addresses

- Codex P2 thread `PRRT_kwDOSF9kNM6EbiNO` on merged PR #4892 (will resolve once this lands)

## Test plan

- [x] Local lint audit clean (`bun tools/hygiene/audit-tick-shard-relative-paths.ts --enforce --baseline`)
- [x] Pre-commit branch guard passed
- [x] Post-commit canary: ls-tree=55 preserved
- [x] Worktree off `origin/main` (current main HEAD `64dfe3869`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T00:17:25Z)

## Pull request overview

Fixes a failing tick-shard lint check by removing a broken relative-path Markdown link that pointed to an out-of-repo, user-scope memory directory, replacing it with inline prose that preserves the intended reference without creating an invalid link.

**Changes:**

- Replaced an out-of-repo relative Markdown link with inline explanatory text.
- Preserved the “user-scope-only / not in repo” intent while eliminating the link target that breaks the `tick-shard relative-paths` audit.
