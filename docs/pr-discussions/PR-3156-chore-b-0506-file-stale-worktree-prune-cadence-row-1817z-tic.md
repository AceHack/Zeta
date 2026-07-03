---
pr_number: 3156
title: "chore(b-0506): file stale-worktree prune cadence row + 1817Z tick shard"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T18:21:37Z"
merged_at: "2026-05-14T18:23:27Z"
closed_at: "2026-05-14T18:23:27Z"
head_ref: "chore/b-0506-stale-worktree-prune-cadence-2026-05-14"
base_ref: "main"
archived_at: "2026-05-14T18:34:06Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3156: chore(b-0506): file stale-worktree prune cadence row + 1817Z tick shard

## PR description

## Summary

Two-commit shipment for tick 2026-05-14T18:17Z:

1. **081KRHWGX0008QG0R002DPG02X backlog row** (P3 friction-reducer): mechanize \`git worktree prune --expire=now\` via small TypeScript audit tool + per-tick or daily cadence wire-up
2. **1817Z tick shard**: documents the 23-stale-worktree manual cleanup that triggered the mechanization row + side observation about an accidental stash-pop

## Why now

Prior tick (PR #3154, 1813Z shard) flagged the recurring "branch already used by worktree at <path>" lockout pattern when investigating PR #3153's Codex thread. The pattern was empirically caused by 23 stale \`/private/tmp/zeta-*\` worktree admin entries from yesterday's session crash — all with non-existent on-disk directories.

\`git worktree prune --expire=now -v\` cleared all 23 in one shot at 18:17Z (worktree count 163 → 140). Manual command works; mechanization captured as P3 backlog row.

## ID allocation discipline

Per PR #3153's newly-merged otto-channels reference card ID-allocation discipline (both on-disk + in-flight check):

\`\`\`
$ find docs/backlog -name "B-*.md" -type f | grep -oE "B-[0-9]+" | sort -u -t- -k2 -n | tail -3
081KRHWGX0008QG0R0027YXBTB
081KRHWGX0008QG0R000PVB6FF
081KRHWGX0008QG0R002C038BJ

$ gh pr list --state open --search "081KRHWGX0008QG0R002DPG02X OR 081KRHWGX0008QG0R000E8BHQ9 OR 081KRHWGX0008QG0R002S107P7" --json number,title
(empty)
\`\`\`

081KRHWGX0008QG0R002DPG02X safe — no on-disk collision, no in-flight contention.

## Side observation: stash-pop hazard

The shard captures a substrate-honest observation: a long-standing prior-session stash (\`stash@{0}: WIP on feat/b-0400-slice3-claim-coordinator\`) auto-popped during a \`git stash push <untracked-file>\` workflow and introduced conflict markers in unrelated files (\`tools/bus/claim.{ts,test.ts}\`). Both files were reset to \`origin/main\` state; stash content discarded (alternative SHA-256 lock-path variant; current encodeURIComponent approach is live and tested).

## Test plan

- [x] 081KRHWGX0008QG0R002DPG02X row created in \`docs/backlog/P3/\` with full frontmatter
- [x] On-disk + in-flight ID-allocation check passed
- [x] 1817Z shard committed at canonical path
- [x] Stash-pop hazard substrate-honestly preserved in shard

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T18:25:16Z)

## Pull request overview

Adds a new factory-hygiene backlog row (081KRHWGX0008QG0R002DPG02X) and a tick shard documenting the empirical stale-worktree cleanup that motivated it, to reduce recurring “branch already used by worktree” lockouts after session crashes.

**Changes:**

- Added tick shard for 2026-05-14T18:17Z documenting pruning 23 stale worktree admin entries and the motivating incident.
- Added P3 backlog row 081KRHWGX0008QG0R002DPG02X proposing mechanization (TS audit tool + cadence) for `git worktree prune --expire=now`.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 2 comments.

| File | Description |
| ---- | ----------- |
| docs/hygiene-history/ticks/2026/05/14/1817Z.md | New tick shard capturing the stale-worktree cleanup and related operational observations. |
| docs/backlog/P3/081KRHWGX0008QG0R002DPG02X-stale-worktree-prune-cadence-mechanization-2026-05-14.md | New P3 backlog row proposing a mechanized stale-worktree prune cadence/tooling. |

## Review threads

### Thread 1: docs/backlog/P3/081KRHWGX0008QG0R002DPG02X-stale-worktree-prune-cadence-mechanization-2026-05-14.md:14 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T18:25:15Z):

Frontmatter `type: feature` conflicts with the PR description calling 081KRHWGX0008QG0R002DPG02X a “P3 friction-reducer”. If this row is meant to be tracked as a friction-reducer (as the text later implies), align either the PR description or the row’s `type` so tooling/triage doesn’t categorize it inconsistently.

### Thread 2: docs/backlog/P3/081KRHWGX0008QG0R002DPG02X-stale-worktree-prune-cadence-mechanization-2026-05-14.md:55 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T18:25:15Z):

The “Composes with” section references `claim-acquire-before-worktree-work.md` and `encoding-rules-without-mechanizing.md` without their `.claude/rules/` path. Since both files live under `.claude/rules/`, consider spelling the full path to make the reference unambiguous and easier to navigate/search.

## General comments

### @chatgpt-codex-connector (2026-05-14T18:21:44Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
