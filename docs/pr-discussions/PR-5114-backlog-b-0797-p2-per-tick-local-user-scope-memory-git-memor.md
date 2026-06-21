---
pr_number: 5114
title: "backlog(081KSGS9H0008QG0R0033YXK4D P2) + per-tick: local user-scope memory \u2194 git-memory delta audit + migrate as autonomous-loop sometimes-task (Aaron 2026-05-26)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T06:41:01Z"
merged_at: "2026-05-26T06:42:16Z"
closed_at: "2026-05-26T06:42:16Z"
head_ref: "otto-cli/b0797-local-memory-to-git-migration-autonomous-loop-sometime-task-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:42:52Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5114: backlog(081KSGS9H0008QG0R0033YXK4D P2) + per-tick: local user-scope memory ↔ git-memory delta audit + migrate as autonomous-loop sometimes-task (Aaron 2026-05-26)

## PR description

Aaron 2026-05-26: '*are you backloging that or just putting in in memories on this machine only? how much in local memories are missing from git?*' + '*yes can you direct your background service on the local only memories as part of its natural loop sometimes as an option?*'. Empirical audit: 841 local-only memory files vs 1645 in-repo; substantive 2026-05-25 substrate trapped locally. Per-tick discipline Step 3 gets priority 4 (sometimes-task: local-memory delta audit + migrate). Token-bounded (1-3 files per tick); per-file classification (MIGRATE / SUPERSEDE / KEEP-LOCAL / NEEDS-OPERATOR-REVIEW); MIGRATE → per-file PR. Sub-targets cover audit-tool, classifier, sometimes-task hook, heuristics, + one-time 841-file backfill. Composes with 081KSE6WT0008QG0R003CMCX84 + 081KSGS9H0008QG0R00153CQ8B + 081KSGS9H0008QG0R0027HJZYH + substrate-or-it-didn't-happen + never-be-idle.

## General comments

### @chatgpt-codex-connector (2026-05-26T06:41:04Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
