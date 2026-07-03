---
pr_number: 5022
title: "feat(pr-preservation): implement idempotency check and CRLF/LF hygiene"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T22:53:23Z"
merged_at: "2026-05-25T22:59:52Z"
closed_at: "2026-05-25T22:59:52Z"
head_ref: "lior/archive-pr-idempotency"
base_ref: "main"
archived_at: "2026-05-25T23:52:05Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5022: feat(pr-preservation): implement idempotency check and CRLF/LF hygiene

## PR description

## Summary

Addresses Lior PR discussion archive issues:

- **Spurious Timestamp-Only Diffs**: `tools/pr-preservation/archive-pr.ts` now reads any existing discussion archive for the PR first, and performs a normalization comparison where `archived_at` is masked. If no other metadata or thread changes exist, it skips writing entirely, preventing spurious timestamp-only diffs.
- **CRLF/LF Line Endings Leakage**: Enforces all generated content to replace `\r\n` with `\n` prior to comparing or writing.
- **Worldview Refresh Test Failure**: Fixed the prompt assertion test in `tools/codex-loop-tick.test.ts` to correctly expect the `refresh-worldview.ts` script without backticks, matching the timeout wrapper.

## Verification

- Verified against local PR #5016 (safely outputs `skipped writing ... (only archived_at timestamp changed)`).
- Full `bun test` test suite completed successfully (1422 passed, 0 failed).

Co-Authored-By: Gemini <noreply@google.com>

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T22:56:03Z)

## Pull request overview

This PR improves the PR-discussion archiving tool to be idempotent and to avoid noisy diffs, by skipping rewrites when the only change is the `archived_at` timestamp and by normalizing generated output to LF line endings. It also updates a Codex loop prompt contract test to match the current prompt text.

**Changes:**

- Add an idempotency check in `archive-pr.ts` that compares normalized content with `archived_at` masked and skips writing when only the timestamp changed.
- Normalize generated and existing archive content from CRLF to LF prior to compare/write to prevent mixed line endings in generated markdown.
- Update `codex-loop-tick` prompt assertion to expect the `refresh-worldview` script substring as it appears in the timeout-wrapped command.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| tools/pr-preservation/archive-pr.ts | Skips timestamp-only rewrites and enforces LF normalization for stable PR discussion archives. |
| tools/codex-loop-tick.test.ts | Aligns prompt contract test with the actual timeout-wrapped `refresh-worldview` command text. |

## General comments

### @AceHack (2026-05-25T22:59:38Z)

This is a valuable improvement to the PR preservation script. It addresses a real issue and will reduce noise in the repository. I'm merging this.
