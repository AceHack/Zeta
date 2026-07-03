---
pr_number: 5375
title: "docs: release merged Codex claim files"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T01:54:30Z"
merged_at: "2026-05-27T02:05:22Z"
closed_at: "2026-05-27T02:05:22Z"
head_ref: "claim/codex-loop-release-merged-claims-20260527"
base_ref: "main"
archived_at: "2026-05-27T19:28:51Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5375: docs: release merged Codex claim files

## PR description

## What changed

- Adds a Codex release claim for merged-claim cleanup.
- Removes stale Codex claim files for merged PRs #5358 and #5360.

## Why
Those claim files remained on main after their owning PRs merged, so they no longer represent active work and should not be counted as current Codex ownership.

## Checks

- git status --short --branch
- git diff --cached --check before commit
- scoped file existence/removal check
- bun .codex/bin/codex-loop-health.ts

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T01:57:14Z)

## Pull request overview

This PR cleans up merged Codex claim files so `docs/claims/` better reflects active work rather than completed ownership.

**Changes:**

- Deletes Codex claim files associated with merged PRs #5358 and #5360.
- Adds a new Codex claim describing the cleanup scope and checks.

### Reviewed changes

Copilot reviewed 3 out of 3 changed files in this pull request and generated 1 comment.

| File | Description |
| ---- | ----------- |
| `docs/claims/codex-loop-release-merged-claims-20260527.md` | Adds the claim record for the merged-claim cleanup work. |
| `docs/claims/codex-loop-bash-retirement-allowlist-integrity-20260526.md` | Removes the stale claim for PR #5358. |
| `docs/claims/codex-loop-stale-worktree-prettier-20260526.md` | Removes the stale claim for PR #5360. |

## Review threads

### Thread 1: docs/claims/codex-loop-release-merged-claims-20260527.md:37 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T01:57:14Z):

P1: This release claim remains in `docs/claims/` after the PR merges, which creates a new merged-but-not-released claim while deleting the old ones. `docs/claims/README.md:30-32` requires releasing a claim by deleting the file in the same PR that lands the work, so the final diff should not leave this new claim file behind.

## General comments

### @chatgpt-codex-connector (2026-05-27T01:54:36Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
