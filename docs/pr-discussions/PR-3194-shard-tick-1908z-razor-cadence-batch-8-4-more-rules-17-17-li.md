---
pr_number: 3194
title: "shard(tick): 1908Z \u2014 razor-cadence batch 8 (4 more rules, 17/17 LIVE)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T19:12:48Z"
merged_at: "2026-05-14T19:14:31Z"
closed_at: "2026-05-14T19:14:31Z"
head_ref: "shard/tick-1908Z-razor-cadence-batch8-otto-cli-2026-05-14"
base_ref: "main"
archived_at: "2026-05-14T19:18:08Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3194: shard(tick): 1908Z — razor-cadence batch 8 (4 more rules, 17/17 LIVE)

## PR description

Batch 8 razor-cadence audit. 17/17 LIVE. Cumulative: **32/50 rules (64%); 185/186 LIVE (99.5%)**.

Reference taxonomy now stable: concrete | glob | template-path | backlog-ID | legacy-noted | transient | anti-pattern. Each requires distinct audit logic.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T19:15:18Z)

## Pull request overview

Adds the 19:08Z hygiene tick shard documenting batch 8 of the razor-cadence cross-reference audit and its cumulative progress.

**Changes:**

- Records batch 8 audit results for four additional `.claude/rules` files.
- Adds cumulative audit visibility and a developing reference-classification taxonomy.
- Captures lessons for distinguishing stale pointers from legacy, transient, template, and anti-pattern references.

## Review threads

### Thread 1: docs/hygiene-history/ticks/2026/05/14/1908Z.md:29 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T19:15:17Z):

P1: The template-path count is internally inconsistent: the batch table lists 4 template paths for `claude-code-loading-taxonomy.md`, and the parenthetical here names four classes (skills, agents, tick-shards, user-scope MEMORY.md), but the count/status says 5/5. Please reconcile the count (or name the fifth class) so the 17/17 total is auditable.

### Thread 2: docs/hygiene-history/ticks/2026/05/14/1908Z.md:63 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T19:15:18Z):

P1: This backticked audit command is not valid shell syntax (`wc` treats `>=` and `1` as filenames/operands rather than a comparison). Since this line is defining the mechanizable taxonomy, please rewrite it as prose or use a valid test/count expression so future automation does not copy a broken check.
