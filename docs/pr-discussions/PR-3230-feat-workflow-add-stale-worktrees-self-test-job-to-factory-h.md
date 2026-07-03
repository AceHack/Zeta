---
pr_number: 3230
title: "feat(workflow): add stale-worktrees self-test job to factory-hygiene-audit-cadence"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T20:34:01Z"
merged_at: "2026-05-14T20:42:27Z"
closed_at: "2026-05-14T20:42:27Z"
head_ref: "feat/factory-hygiene-add-worktrees-job-otto-cli-2026-05-14-v2"
base_ref: "main"
archived_at: "2026-05-14T20:55:51Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3230: feat(workflow): add stale-worktrees self-test job to factory-hygiene-audit-cadence

## PR description

Composes the third hygiene tool (`audit-stale-worktrees.ts` from PR #3225) into the daily cron from PR #3212. Workflow now self-tests all 3 hygiene tools each day at 14:37 UTC.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T20:36:10Z)

## Pull request overview

Adds a third factory-hygiene workflow job so the stale-worktrees audit tool’s unit tests run in the daily hygiene cadence.

**Changes:**

- Adds `stale-worktrees-self-test` job on Ubuntu 24.04.
- Checks out the repo, installs Bun, and runs `tools/hygiene/audit-stale-worktrees.test.ts`.

## Review threads

### Thread 1: .github/workflows/factory-hygiene-audit-cadence.yml:114 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T20:36:09Z):

P1: The new stale-worktrees self-test job is not reachable from PRs that change only the stale-worktrees tool or its test, because `on.pull_request.paths` still lists only the first two hygiene tools plus this workflow. This undermines the PR self-test cadence for the newly composed tool; add the stale-worktrees source/test paths to the workflow trigger.

### Thread 2: .github/workflows/factory-hygiene-audit-cadence.yml:114 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T20:36:09Z):

P2: Adding the third hygiene job leaves the workflow's file-level documentation stale: the header still describes this as a cadence for two tools and lists only the rule-cross-refs and memory-index audits. Update that summary/composes-with text so future maintainers do not miss that stale-worktrees is part of the daily cadence.

## General comments

### @chatgpt-codex-connector (2026-05-14T20:34:05Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
