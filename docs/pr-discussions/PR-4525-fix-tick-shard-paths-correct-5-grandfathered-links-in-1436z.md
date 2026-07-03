---
pr_number: 4525
title: "fix(tick-shard-paths): correct 5 grandfathered links in 1436Z.md + trim baseline"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-21T11:26:25Z"
merged_at: "2026-05-21T11:29:26Z"
closed_at: "2026-05-21T11:29:26Z"
head_ref: "fix/grandfathered-tick-shard-paths-1436z-2026-05-21"
base_ref: "main"
archived_at: "2026-05-21T11:55:06Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4525: fix(tick-shard-paths): correct 5 grandfathered links in 1436Z.md + trim baseline

## PR description

## Summary

Slow-steady audit-baseline cleanup, post PR #4524. 1436Z.md is at `docs/hygiene-history/ticks/2026/05/15/` (6 levels deep), so links to sibling top-level dirs need:

- 5 `..` for `docs/backlog/` (sibling of `hygiene-history` under `docs/`)
- 6 `..` for `.claude/rules/` (sibling of `docs/`)

All 5 grandfathered links had one `..` too few — same bug class as PR #4524 (0822Z.md) and the PR #4523-fix-commit cycle (1019Z.md).

## Fixes

- Line 6: 4× `backlog/` links: 4 `..` → 5 `..`
- Line 30: 1× `.claude/rules/` link: 5 `..` → 6 `..`
- Line 36: 2× `backlog/` links: 4 `..` → 5 `..`

## Baseline trim

5 entries for 1436Z.md removed from `tools/hygiene/audit-tick-shard-relative-paths.baseline.json` (39 → 34 entries; some pre-existing entries refer to files already fixed elsewhere — separate cleanup).

Local audit: `scanned 1137 tick shards; 14 broken relative-path links (14 grandfathered by baseline, 0 new)`. Down from 19 grandfathered post-#4524.

## Test plan

- [x] Local `audit-tick-shard-relative-paths.ts --enforce --baseline` reports 0 new findings
- [x] Substrate unchanged (only relative-path depth corrected; prose identical)
- [x] Same bug-class as my prior 2 PRs (#4523 commit + #4524) — pattern is the docs/hygiene-history/ticks/YYYY/MM/DD/ depth being underestimated when authoring shards from inside the dir

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-21T11:29:04Z)

## Pull request overview

This PR continues the post-#4524 tick-shard path-audit cleanup by fixing incorrect relative link depths in a deep tick shard (`docs/hygiene-history/ticks/2026/05/15/1436Z.md`) and trimming the corresponding grandfathered entries from the relative-path audit baseline.

**Changes:**

- Correct `docs/backlog/**` relative links in `1436Z.md` from 4× `..` to 5× `..` (properly reaching `docs/` before `backlog/`).
- Correct the `.claude/rules/**` relative link in `1436Z.md` from 5× `..` to 6× `..` (properly reaching repo root before `.claude/`).
- Remove the 5 now-fixed findings for `1436Z.md` from `tools/hygiene/audit-tick-shard-relative-paths.baseline.json`.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| docs/hygiene-history/ticks/2026/05/15/1436Z.md | Fixes relative link depths for `docs/backlog/**` and `.claude/rules/**` targets at this shard’s directory depth. |
| tools/hygiene/audit-tick-shard-relative-paths.baseline.json | Drops baseline entries that correspond to the fixed links in `1436Z.md`. |
