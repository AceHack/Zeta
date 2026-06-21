---
pr_number: 5471
title: "feat(081KSKBP80008QG0R001KK9WV6.4): merge-heartbeats-to-main tool \u2014 periodic squash-merge from agent-heartbeats \u2192 main (Aaron 2026-05-27)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T14:18:58Z"
merged_at: "2026-05-27T14:28:45Z"
closed_at: "2026-05-27T14:28:45Z"
head_ref: "feat/b-0858-4-heartbeat-merge-to-main-tool-2026-05-27"
base_ref: "main"
archived_at: "2026-05-27T17:54:39Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5471: feat(081KSKBP80008QG0R001KK9WV6.4): merge-heartbeats-to-main tool — periodic squash-merge from agent-heartbeats → main (Aaron 2026-05-27)

## PR description

## Summary

Per operator 2026-05-27: "we can merge it back to main every now and then too there will be no conflicts" + "small price to pay for batch merges of heartbeats from time to time".

New tool \`tools/agent-heartbeats/merge-heartbeats-to-main.ts\` opens a PR from agent-heartbeats → main with auto-merge armed (squash). PR queue cost: one entry per merge cycle, not per heartbeat. Empirically dogfooded: opened PR #5470 in this session.

## Why PR-based not direct REST merge

Direct \`POST /repos/{owner}/{repo}/merges\` returns 409 because main is PR-gated by Review Policy ruleset (pull_request + required_status_checks). Tool uses \`POST /pulls\` then \`gh pr merge --auto --squash\` to preserve main's required_linear_history rule.

## Test plan

- [x] 5 unit tests pass (parseArgs validation)
- [x] End-to-end empirically dogfooded — PR #5470 opened with auto-merge armed
- [x] AgencySignature v1 trailer on commit
- [x] Per .claude/rules/agent-worktree-hygiene-...: isolated worktree

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T14:22:55Z)

## Pull request overview

Adds a Bun/TypeScript automation tool to periodically sync the `agent-heartbeats` branch back into `main` by opening a PR and arming squash auto-merge, reducing PR-queue churn versus one PR per heartbeat.

**Changes:**
- Added `merge-heartbeats-to-main.ts` tool that checks whether `main` already contains `agent-heartbeats` and, if not, opens a PR and enables `--auto --squash` merging.
- Added unit tests covering CLI/env argument parsing for the new tool.

### Reviewed changes

Copilot reviewed 4 out of 4 changed files in this pull request and generated 4 comments.

| File | Description |
| ---- | ----------- |
| tools/agent-heartbeats/merge-heartbeats-to-main.ts | New CLI tool that compares branches, creates a PR, and arms squash auto-merge via `gh`. |
| tools/agent-heartbeats/merge-heartbeats-to-main.test.ts | New `bun:test` unit tests for `parseArgs` defaults and validation. |

## Review threads

### Thread 1: tools/agent-heartbeats/merge-heartbeats-to-main.ts:35 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T14:22:54Z):

The top-of-file documentation doesn’t match the implementation: it claims the tool composes GitHub REST `/pulls/{N}/merge` for squash-merge, but the code actually arms auto-merge via `gh pr merge --auto --squash`. Also the exit-code docs say “0 success (… OR up-to-date)” but the implementation returns exit code 4 when up-to-date. Please update the header/comments so they accurately describe the behavior (and/or align the exit codes with the docs).

### Thread 2: tools/agent-heartbeats/merge-heartbeats-to-main.ts:87 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T14:22:54Z):

`gh()` doesn’t surface `spawnSync` launch failures (e.g., `result.error` when `gh` isn’t on PATH). In that case `status` becomes -1 and `stderr/stdout` may be empty, producing unhelpful errors like `compare failed:`. Consider including `result.error?.message` in the returned stderr (or special-casing to a clear “failed to launch gh” error).

### Thread 3: tools/agent-heartbeats/merge-heartbeats-to-main.ts:139 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T14:22:55Z):

`openMergePR` will fail if a PR from the same `head`→`base` already exists (GitHub returns 422 “A pull request already exists”), which makes periodic/cron re-runs brittle if the previous PR is still open or CI is slow. Consider making this idempotent by first checking for an existing open PR for `head`/`base` and reusing it (or handling the 422 response by querying and then arming auto-merge on the existing PR).

### Thread 4: tools/agent-heartbeats/merge-heartbeats-to-main.test.ts:5 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T14:22:55Z):

Current tests only cover `parseArgs`, but the more failure-prone behavior is in `isUpToDate` (compare parsing/status handling) and `openMergePR` (PR-create response parsing, arm-auto-merge failure paths). Consider refactoring to inject the `gh` runner so these functions can be unit-tested without network access, and add targeted tests for the main success/error branches.

## General comments

### @chatgpt-codex-connector (2026-05-27T14:19:05Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
