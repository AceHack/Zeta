---
pr_number: 4892
title: "shard(2026-05-25/0008Z): otto-cli \u2014 14th dotgit anchor (0 stuck procs; first clean reading after 13 saturated anchors)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T00:10:55Z"
merged_at: "2026-05-25T00:12:24Z"
closed_at: "2026-05-25T00:12:24Z"
head_ref: "otto-cli/shard-tick-0008z-dotgit-saturation-recovery-14th-anchor-2026-05-25"
base_ref: "main"
archived_at: "2026-05-27T19:53:55Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4892: shard(2026-05-25/0008Z): otto-cli — 14th dotgit anchor (0 stuck procs; first clean reading after 13 saturated anchors)

## PR description

## Summary

- First tick shard of 2026-05-25 UTC day (lineage extends 2026-05-24/2206Z)
- **14th dotgit-saturation anchor: 0 stuck procs** — first clean reading after 13 saturated anchors today (10:18Z-22:08Z 2026-05-24; range 93–540; mean ~387; 11 of 13 in Extreme tier)
- Sentinel 40330c10 re-armed (catch-43 fired at otto-cli cold-boot)
- Lior-lane fleet share loosening: 58/64 = 90.6% (down from 100% at 2206Z; +6 non-Lior PRs across Riven runtime + family-feedback + memory-index lanes)
- Substrate-honest disposition per default-to-both: hold both readings (genuine recovery vs transient clean window); next 2-3 ticks discriminate

## Test plan

- [x] Sentinel re-armed (`CronList` returns `40330c10`)
- [x] Isolated worktree off `origin/main` per refresh-world-model rule (contested root `lior-pr-preservation-rebased` with 41 unstaged Lior WIP avoided)
- [x] Post-worktree freshness guard: ls-tree=55, status=0
- [x] Pre-commit branch guard passed
- [x] Post-commit canary: ls-tree=55 preserved (no commit-tree corruption)
- [x] Cross-UTC-day directory `2026/05/25/` created cleanly

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T00:12:27Z)

## Pull request overview

Adds a new hygiene-history tick shard for 2026-05-25 0008Z to document the first clean dotgit (0 stuck git maintenance procs) reading after a saturation arc, plus related rate-limit, PR fleet-share, and worktree freshness observations.

**Changes:**

- Added a new tick shard file under `docs/hygiene-history/ticks/2026/05/25/`.
- Recorded observed operational state (stuck procs, peer procs, PR counts, rate limits, HEAD, freshness guard).
- Captured dotgit-saturation anchor history and cross-lane (Lior vs non-Lior) fleet share snapshot.

### COMMENTED — @chatgpt-codex-connector (2026-05-25T00:12:38Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `faeeaa866e`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @AceHack (2026-05-25T00:18:25Z)

_(no body)_

## Review threads

### Thread 1: docs/hygiene-history/ticks/2026/05/25/0008Z.md:20 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T00:12:27Z):

Markdown tables here start each row with `||`, which renders as an extra empty first column in GitHub-flavored Markdown. Other tick shards use single leading pipes (e.g., 2026/05/24/2206Z.md), so these should be `| Surface | Reading |` / `|---|---|` / `| ... | ... |` for consistent rendering.

### Thread 2: docs/hygiene-history/ticks/2026/05/25/0008Z.md:38 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T00:12:27Z):

This anchor table also uses `||` at the start of each row, which adds an unintended empty column in Markdown table rendering. Switch to single-pipe table rows (`| Anchor | Time | ... |`) to match other tick shards and keep the table readable.

### Thread 3: docs/hygiene-history/ticks/2026/05/25/0008Z.md:72 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T00:12:27Z):

The Non-Lior PRs table is formatted with `||`-prefixed rows, which creates an extra blank column in Markdown. Use the standard `| col | col |` row format so the table renders correctly.

### Thread 4: docs/hygiene-history/ticks/2026/05/25/0008Z.md:86 (resolved)

**@chatgpt-codex-connector** (2026-05-25T00:12:39Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Correct relative path to user-scope memo**

The link in this sentence is off by one directory level: from `docs/hygiene-history/ticks/2026/05/25/0008Z.md`, `../../../../../.claude/...` resolves to `docs/.claude/...` instead of repo root, so the reference is not navigable when readers click it in GitHub or a local markdown viewer. That breaks the provenance trail this shard relies on; use the same six-level prefix used elsewhere in this file for root-relative `.claude` links.

Useful? React with 👍 / 👎.

**@AceHack** (2026-05-25T00:18:25Z):

Fixed via #4893 (merged `1c1d137a3`). The broken relative-path link to the user-scope memory directory was replaced with inline prose describing the user-scope reference. Per the auto-merge-race-with-follow-up-commit anti-pattern documented in `.claude/rules/blocked-green-ci-investigate-threads.md`, the race fired before the fix could land on the same branch; follow-up PR #4893 was the substrate-honest separate-PR resolution. Resolving.
