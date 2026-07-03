---
pr_number: 4362
title: "shard(0816Z): Lint-frontier closure + auto-merge-race lesson"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-19T08:35:52Z"
merged_at: "2026-05-19T08:37:31Z"
closed_at: "2026-05-19T08:37:31Z"
head_ref: "shard/tick-0816z-otto-cli-pure-git-tier-lint-fix-2026-05-19"
base_ref: "main"
archived_at: "2026-05-19T08:39:57Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4362: shard(0816Z): Lint-frontier closure + auto-merge-race lesson

## PR description

## Summary

Tick shard for 0816Z (Otto-CLI cycle-new after PR #4357 + #4356 merged). Pushed-but-un-PRed via Pure-git tier discipline; opening now post-reset.

Documents:

- Lint-frontier closure via PR #4358 (10 + 3 NEW findings on 0608Z.md + 0803Z.md fixed)
- Auto-merge-race lesson: arming auto-merge with non-required-check failing + follow-up commit can race (PR #4357's `9c9c8e69` lint fix lost to the race; PR #4358 shipped the fix instead)

## Test plan

- [x] Shard at canonical `docs/hygiene-history/ticks/2026/05/19/0816Z.md`
- [x] Relative paths use 6-level `../` (correct depth)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-19T08:38:09Z)

## Pull request overview

Adds the 0816Z hygiene-history tick shard documenting the closure of the “tick-shard relative-path” lint frontier (handled in PR #4358) and capturing an operational lesson about auto-merge races when non-required checks are failing.

**Changes:**

- Introduces a new tick shard at `docs/hygiene-history/ticks/2026/05/19/0816Z.md`.
- Records the lint-frontier context (0608Z/0803Z relative-path findings) and the auto-merge timing failure mode.

## Review threads

### Thread 1: docs/hygiene-history/ticks/2026/05/19/0816Z.md:12 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-19T08:38:08Z):

Markdown table in “Step 1 — Refresh” uses `||` at the start of each row (e.g., `|| Signal | Value |`). This renders as an extra empty column / malformed table in most Markdown renderers and differs from other tick shards (which use single `|`). Use single leading pipes for the header/separator/rows so the table renders correctly.

## General comments

### @chatgpt-codex-connector (2026-05-19T08:35:57Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
