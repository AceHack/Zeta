---
pr_number: 5193
title: "fix(docs): correct relative links in 1202Z tick shard"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T15:19:29Z"
merged_at: "2026-05-26T15:24:05Z"
closed_at: "2026-05-26T15:24:05Z"
head_ref: "lior/fix-tick-shard-links"
base_ref: "main"
archived_at: "2026-05-27T19:39:26Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5193: fix(docs): correct relative links in 1202Z tick shard

## PR description

This PR fixes broken relative links in the `1202Z.md` tick shard file. This was causing the `lint (tick-shard relative-paths)` check to fail on unrelated PRs.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T15:21:25Z)

## Pull request overview

This PR fixes broken relative links in the tick shard `docs/hygiene-history/ticks/2026/05/26/1202Z.md` so the `lint (tick-shard relative-paths)` check no longer fails due to incorrect path depth when linking into `.claude/rules/`.

**Changes:**

- Corrected tick-shard relative link depth from `../../../../../` to `../../../../../../` for `.claude/rules/*.md` references.
- Normalized the affected lines so the links resolve correctly from the shard’s directory depth.

## General comments

### @chatgpt-codex-connector (2026-05-26T15:19:44Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
