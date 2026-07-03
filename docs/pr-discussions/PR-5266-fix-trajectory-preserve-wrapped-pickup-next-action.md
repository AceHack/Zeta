---
pr_number: 5266
title: "fix(trajectory): preserve wrapped pickup next action"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T18:00:20Z"
merged_at: "2026-05-26T18:10:01Z"
closed_at: "2026-05-26T18:10:01Z"
head_ref: "codex/codex-loop-backlog-next-action-continuation-20260526"
base_ref: "main"
archived_at: "2026-05-26T20:20:16Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5266: fix(trajectory): preserve wrapped pickup next action

## PR description

## Summary

- preserve continuation lines for top-level trajectory metadata fields such as Next concrete action
- add focused readTrajectoryPackets coverage for wrapped next-action text

## Checks

- bun test tools/trajectories/autonomous-pickup.test.ts
- bunx prettier --check tools/trajectories/autonomous-pickup.ts tools/trajectories/autonomous-pickup.test.ts
- git diff --check

## Local gap

- bun run typecheck could not run in this isolated worktree because tsc is not installed locally (script exited 127).

Claim: claim/codex-loop-backlog-next-action-continuation-20260526

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T18:02:14Z)

## Pull request overview

This PR fixes trajectory metadata parsing in the Tier-1 autonomous trajectory pickup tool so that wrapped/continued lines for top-level fields (notably “Next concrete action”) are preserved instead of being dropped. This keeps multi-line next-action text intact when generating the execution prompt, and adds a focused regression test to lock the behavior in.

**Changes:**

- Extend field parsing to join “continuation” lines until a clear boundary (blank line, heading, bullet, table row, or next field-like line).
- Update `firstField(...)` to use the continuation-aware field reader.
- Add a filesystem-backed test that asserts `readTrajectoryPackets(...)` preserves wrapped next-action text.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| tools/trajectories/autonomous-pickup.ts | Adds continuation-aware metadata field parsing so wrapped “Next concrete action” text is preserved. |
| tools/trajectories/autonomous-pickup.test.ts | Adds a regression test verifying `readTrajectoryPackets` keeps wrapped next-action lines together. |

## General comments

### @chatgpt-codex-connector (2026-05-26T18:05:47Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
