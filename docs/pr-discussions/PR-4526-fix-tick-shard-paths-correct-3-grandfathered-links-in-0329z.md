---
pr_number: 4526
title: "fix(tick-shard-paths): correct 3 grandfathered links in 0329Z.md + trim baseline"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-21T11:42:32Z"
merged_at: "2026-05-21T11:46:48Z"
closed_at: "2026-05-21T11:46:48Z"
head_ref: "fix/grandfathered-tick-shard-paths-0329z-2026-05-21"
base_ref: "main"
archived_at: "2026-05-21T11:55:05Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4526: fix(tick-shard-paths): correct 3 grandfathered links in 0329Z.md + trim baseline

## PR description

## Summary

Slow-steady audit-baseline cleanup, batch 2 (post #4525). 0329Z.md at `docs/hygiene-history/ticks/2026/05/15/` (6 levels deep from repo root) had 3 grandfathered `docs/backlog/` links with 4 `..` instead of 5. Same one-too-few-`..` bug class as #4523/#4524/#4525.

## Fixes

- Line 6: `backlog/P3/081KRHWGX0008QG0R001HMWM1W-...md`: 4 `..` → 5 `..`
- Line 7: `backlog/P3/081KRMEXM0008QG0R000T0A28T-...md`: 4 `..` → 5 `..`
- Line 20: `backlog/P3/081KRMEXM0008QG0R000T0A28T-...md`: 4 `..` → 5 `..`

## Baseline trim

3 entries for 0329Z.md removed (34 → 31). Local audit: `scanned 1137 tick shards; 11 broken relative-path links (11 grandfathered by baseline, 0 new)`. Down from 14 grandfathered post-#4525.

## Test plan

- [x] Local `audit-tick-shard-relative-paths.ts --enforce --baseline` reports 0 new findings
- [x] Substrate unchanged (only relative-path depth corrected; prose identical)
- [x] Pattern matches the broader cluster; continuing slow-steady cleanup

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-21T11:44:22Z)

## Pull request overview

This PR continues the tick-shard relative-path audit cleanup by correcting broken `docs/backlog/**` links in a specific tick shard and trimming the corresponding grandfathered entries from the audit baseline.

**Changes:**

- Fixes three `docs/backlog/**` relative links in `docs/hygiene-history/ticks/2026/05/15/0329Z.md` by adding the missing `..` segment.
- Removes the now-fixed findings for `0329Z.md` from `tools/hygiene/audit-tick-shard-relative-paths.baseline.json`.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 1 comment.

| File | Description |
| ---- | ----------- |
| docs/hygiene-history/ticks/2026/05/15/0329Z.md | Updates three `docs/backlog/**` relative links to the correct depth. |
| tools/hygiene/audit-tick-shard-relative-paths.baseline.json | Trims baseline entries corresponding to the fixed links in `0329Z.md`. |

## Review threads

### Thread 1: docs/hygiene-history/ticks/2026/05/15/0329Z.md:7 (resolved)

**@copilot-pull-request-reviewer** (2026-05-21T11:44:21Z):

The two backlog-related bullets (081KRHWGX0008QG0R001HMWM1W/081KRMEXM0008QG0R000T0A28T) are no longer nested under the preceding “PR #3342” bullet; they’re now top-level list items. This changes the shard’s structure and contradicts the PR description’s claim that only relative-path depth was corrected. Suggest restoring the original nesting/indentation while keeping the updated ../../../../../backlog/... targets.

## General comments

### @AceHack (2026-05-21T11:46:43Z)

@copilot-pull-request-reviewer FP: verified via `git show` against main `555623234` that all 4 "Headline" bullets (lines 5/6/7/8) were top-level peers WITH NO NESTING before the edit, and remain so after. The `replace_all` Edit only changed the relative-path depth (4 `..` → 5 `..`); markdown structure unchanged. The PR description's claim is accurate.
