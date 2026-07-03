---
pr_number: 5402
title: "hygiene(bash-retirement): Expose retained shell categories"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T05:32:05Z"
merged_at: "2026-05-27T05:41:34Z"
closed_at: "2026-05-27T05:41:34Z"
head_ref: "claim/codex-loop-bash-retirement-category-summary-20260527"
base_ref: "main"
archived_at: "2026-05-27T19:27:05Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5402: hygiene(bash-retirement): Expose retained shell categories

## PR description

## Summary

- add explicit category metadata for each retained shell allowlist entry
- surface retained category counts and uncategorized allowlist drift in the report
- cover category summary rendering and integrity enforcement in focused Bun tests

## Tests

- `bun test tools/hygiene/check-bash-retirement-inventory.test.ts`
- `bun tools/hygiene/check-bash-retirement-inventory.ts --enforce`

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T05:34:21Z)

## Pull request overview

This PR strengthens the bash-retirement hygiene guard by adding explicit category metadata for each retained `.sh` allowlist entry, surfacing category counts in the report output, and enforcing that allowlist entries are categorized.

**Changes:**

- Add retained-shell category metadata and include category summaries in the inventory report (including JSON output).
- Extend allowlist integrity checks to fail on uncategorized allowlist entries.
- Add Bun tests covering category summary rendering and integrity enforcement.

### Reviewed changes

Copilot reviewed 3 out of 3 changed files in this pull request and generated 1 comment.

| File | Description |
| ---- | ----------- |
| tools/hygiene/check-bash-retirement-inventory.ts | Adds retained shell category mapping, integrity enforcement for uncategorized entries, and category summary rendering. |
| tools/hygiene/check-bash-retirement-inventory.test.ts | Adds assertions and new tests for category summaries and uncategorized allowlist enforcement. |
| docs/claims/codex-loop-bash-retirement-category-summary-20260527.md | Adds a claim record related to this work (should be removed before merge per claim protocol). |

### COMMENTED — @AceHack (2026-05-27T05:35:47Z)

_(no body)_

## Review threads

### Thread 1: docs/claims/codex-loop-bash-retirement-category-summary-20260527.md:17 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T05:34:21Z):

Claim files under docs/claims/ are meant to be temporary coordination artifacts and must be deleted in the same PR that lands the work. Please remove this claim file (git rm) before merging, per docs/AGENT-CLAIM-PROTOCOL.md ("When you open a PR... delete the claim file in the same PR").

**@AceHack** (2026-05-27T05:35:47Z):

Removed the temporary claim file in release commit 4a261cea6. Focused checks still pass: `bun test tools/hygiene/check-bash-retirement-inventory.test.ts`, `bun tools/hygiene/check-bash-retirement-inventory.ts --enforce`, and `git diff --check`.

## General comments

### @chatgpt-codex-connector (2026-05-27T05:32:10Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
