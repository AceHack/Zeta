---
pr_number: 3789
title: "shard(tick): 2026-05-16T06:51Z otto-bg-worker \u2014 pure-git tier; rate-floor refinement"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T06:56:33Z"
merged_at: "2026-05-16T06:58:39Z"
closed_at: "2026-05-16T06:58:39Z"
head_ref: "shard/tick-0651z-otto-bg-worker-2026-05-16"
base_ref: "main"
archived_at: "2026-05-16T07:09:39Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3789: shard(tick): 2026-05-16T06:51Z otto-bg-worker — pure-git tier; rate-floor refinement

## PR description

## Summary

- Fresh cold-boot session as Otto's bg-worker
- Catch-43 cron sentinel re-armed (`d1437088`, `* * * * *`, `<<autonomous-loop>>`)
- Rate-budget arc: 417 → 0 inside a single `gh pr view` call → pivot to pure-git tier
- Empirical refinement: 417 floor is NOT safe under concurrent peer-agent draw

## Substrate

Shard file: [`docs/hygiene-history/ticks/2026/05/16/0651Z.md`](../hygiene-history/ticks/2026/05/16/0651Z.md)

Documents the named-dependency wait (GraphQL reset at 06:55:57Z, ~5 min from shard-write time) and the pure-git pivot. Refines empirical floor data in [`.claude/rules/refresh-world-model-poll-pr-gate.md`](../../.claude/rules/refresh-world-model-poll-pr-gate.md) — the "200-1000 = at most 1 PR" guidance assumes no concurrent draw, which is not always true when peer-Otto + Lior + Vera + Riven share Aaron's user-token.

## Test plan

- [x] Pure-git workflow (no GraphQL during commit/push)
- [x] Branch matches `ZETA_EXPECTED_BRANCH` shape
- [x] Shard structure matches PR #3787 (0644Z) convention
- [x] Named dependency for the pure-git tier IS bounded + specific (GraphQL reset @ 06:55:57Z) — not Standing-by failure mode

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T06:58:06Z)

## Pull request overview

Adds a new hygiene-history tick shard documenting a cold-boot bg-worker session that hit GitHub GraphQL rate-limit exhaustion mid `poll-pr-gate.ts` call, then pivoted to the pure-git operational tier with an explicit bounded reset dependency.

**Changes:**

- Added a tick shard capturing the rate-budget arc (417 → 0 within one tool invocation) and the resulting pure-git pivot.
- Recorded the named dependency (GraphQL reset timestamp) to avoid “standing-by” ambiguity.
- Linked the observation back to the relevant operational rule for rate-limit tier guidance.
