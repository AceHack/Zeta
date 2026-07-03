---
pr_number: 3695
title: "shard(tick): 2026-05-16T02:52Z \u2014 audit filter triage (17\u219210) + baseline-cleanup question"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T02:54:23Z"
merged_at: "2026-05-16T03:02:45Z"
closed_at: "2026-05-16T03:02:45Z"
head_ref: "shard/tick-0252z-otto-cli-2026-05-16"
base_ref: "main"
archived_at: "2026-05-16T03:14:34Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3695: shard(tick): 2026-05-16T02:52Z — audit filter triage (17→10) + baseline-cleanup question

## PR description

Tick 8 substantive landing: filter improvement on PR #3692's audit script (`isPlaceholderTarget` skips ellipsis/paren/identifier placeholders), reducing baseline 17 → 10 findings. The 10 remaining are real wrong-depth `..` bugs in 2 shards.

Open question for next tick: tick-shard immutability discipline strict vs pragmatic — can the 10 be edited in-place (treat as bug-fix), or do they need a grandfather mechanism (Stryker-baseline-style)?

GraphQL rate-limit still 0; resets 02:55:28Z. 3 PRs queued un-armed: #3690 #3692 #3693.

Co-Authored-By: Claude <noreply@anthropic.com>

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T02:56:42Z)

## Pull request overview

This PR adds a new tick shard documenting the 02:52Z audit-filter triage work, including the PR #3692 placeholder-target filter improvement and the remaining baseline-cleanup decision.

**Changes:**

- Records the 17→10 audit finding reduction after placeholder filtering.
- Documents the open strategy question for tick-shard relative-path baseline cleanup.
- Captures current PR queue state and next-tick candidates.

## Review threads

### Thread 1: docs/hygiene-history/ticks/2026/05/16/0252Z.md:4 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T02:56:42Z):

P1: This new shard links to `0249Z.md`, but that file is not present in `docs/hygiene-history/ticks/2026/05/16/` on this branch, so the parent-tick link will be broken if this PR lands before or without the separate 0249Z shard PR.

### Thread 2: docs/hygiene-history/ticks/2026/05/16/0252Z.md:96 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T02:56:42Z):

P1: The next-tick guidance computes the 081KRMEXM0008QG0R000ARAR7P claim expiry as roughly one hour after a 01:44Z claim, but the claim rule says bus claim envelopes have a 24h TTL by default. This would send the next tick to treat an active claim as expired about 23 hours too early, risking duplicate work on the same backlog row.

### Thread 3: docs/hygiene-history/ticks/2026/05/16/0252Z.md:53 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T02:56:42Z):

P1: This cites an `ID allocation discipline` section in `.claude/rules/claim-acquire-before-worktree-work.md`, but that section does not exist in the rule, and the searched rule text does not contain the referenced tick-shard immutability language. The open decision is therefore grounded on an unverifiable cross-reference.
