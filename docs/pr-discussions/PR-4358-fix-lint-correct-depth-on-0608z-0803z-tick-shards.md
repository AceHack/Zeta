---
pr_number: 4358
title: "fix(lint): correct ../ depth on 0608Z + 0803Z tick shards"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-19T08:22:02Z"
merged_at: "2026-05-19T08:24:34Z"
closed_at: "2026-05-19T08:24:34Z"
head_ref: "fix/0608z-tick-shard-relative-path-depth-2026-05-19"
base_ref: "main"
archived_at: "2026-05-19T08:39:58Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4358: fix(lint): correct ../ depth on 0608Z + 0803Z tick shards

## PR description

## Summary

- Tick shards at `docs/hygiene-history/ticks/YYYY/MM/DD/X.md` need **6** levels of `../` to reach repo-root `.claude/rules/`, not 5
- PR #4343 introduced 10 broken relative-path links on `0608Z.md` (NEW lint findings; non-required check so didn't block merge)
- PR #4357 inherited the pattern; my own lint-fix commit `9c9c8e69` raced with auto-merge and lost (the CLEAN-gate transition fired on the first commit because lint is non-required; 0803Z.md merged with 3 broken links still present)
- This PR fixes BOTH files in one drop; `audit-tick-shard-relative-paths --enforce --baseline` now passes with **0 NEW findings** (12 grandfathered baseline unchanged)

## Substrate-honest framing

The `--baseline` mode of the audit lets historical findings sit and blocks NEW ones; this PR closes the NEW-findings frontier introduced by the last two PRs. Grandfathered 12 are separate substrate-engineering scope.

## Test plan

- [x] `bun tools/hygiene/audit-tick-shard-relative-paths.ts --enforce --baseline` exits 0
- [x] ls-tree HEAD = 53 (matches origin/main cfba8a64; no canary corruption)
- [x] branch-show-current guard passed pre-commit
- [x] Only the two tick-shard files modified

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-19T08:24:20Z)

## Pull request overview

This PR fixes broken relative links from tick shards under `docs/hygiene-history/ticks/YYYY/MM/DD/` to files under repo-root `.claude/rules/` by correcting the required directory traversal depth from 5 to 6 `../` segments.

**Changes:**

- Update `.claude/rules/*` relative links in `0608Z.md` to use `../../../../../../` (6 levels) instead of the prior too-shallow depth.
- Update `.claude/rules/*` relative links in `0803Z.md` to use `../../../../../../` (6 levels) instead of the prior too-shallow depth.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| docs/hygiene-history/ticks/2026/05/19/0608Z.md | Fix multiple `.claude/rules/*` links by increasing relative path depth to repo root. |
| docs/hygiene-history/ticks/2026/05/19/0803Z.md | Fix `.claude/rules/*` links by increasing relative path depth to repo root. |
