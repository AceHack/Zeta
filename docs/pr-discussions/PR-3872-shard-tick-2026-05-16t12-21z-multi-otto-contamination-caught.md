---
pr_number: 3872
title: "shard(tick): 2026-05-16T12:21Z \u2014 multi-Otto contamination caught at tick start"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T13:01:42Z"
merged_at: "2026-05-16T13:04:08Z"
closed_at: "2026-05-16T13:04:09Z"
head_ref: "otto-cli-tick-2026-05-16-1221z"
base_ref: "main"
archived_at: "2026-05-16T13:09:41Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3872: shard(tick): 2026-05-16T12:21Z — multi-Otto contamination caught at tick start

## PR description

Deferred-PR landing under [`refresh-world-model-poll-pr-gate.md`](.claude/rules/refresh-world-model-poll-pr-gate.md) pure-git tier discipline: branch was pushed at tick 12:21Z when GraphQL ≈788 (extreme cost-aware), PR creation deferred to post-reset. Reset fired 12:55Z; backlog now clearing.

## Shard

[`docs/hygiene-history/ticks/2026/05/16/1221Z.md`](docs/hygiene-history/ticks/2026/05/16/1221Z.md) — 1st multi-Otto contamination observation of this session (HEAD silently moved from `otto-cli-b0206-audit-2026-05-16-1207z` to `otto-cli-b0037.2-audit-2026-05-16-1131z` between ticks). 081KRHWGX0008QG0R001HMWM1W empirical anchor.

## Discipline applied
- Caught via `git branch --show-current` at tick start
- Switched off via `git switch -c <fresh> origin/main` (no worktree-add — Lior active)
- Pre/post-commit `ls-tree` canary 53/53 healthy

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T13:04:26Z)

## Pull request overview

Adds a hygiene-history tick shard documenting a 2026-05-16 Otto-CLI tick where shared-worktree branch contamination was detected and linked to 081KRHWGX0008QG0R001HMWM1W.

**Changes:**
- Records the observed HEAD drift to a peer branch at tick start.
- Captures the cost-aware operating tier and defensive workflow choices.
- Preserves visibility/status notes for the ongoing PR and sentinel state.

## Review threads

### Thread 1: docs/hygiene-history/ticks/2026/05/16/1221Z.md:24 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T13:04:26Z):

P1: This says PR #3871 had landed, but the same shard later says PR #3871 is still in CI/in-flight. The hygiene-history record should use one state consistently so future readers do not treat a non-merged PR as merged evidence.
