---
pr_number: 5407
title: "hygiene(bash-retirement): check stale category metadata"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T06:37:42Z"
merged_at: "2026-05-27T06:58:22Z"
closed_at: "2026-05-27T06:58:22Z"
head_ref: "claim/codex-loop-bash-retirement-category-map-integrity-20260527"
base_ref: "main"
archived_at: "2026-05-27T19:25:23Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5407: hygiene(bash-retirement): check stale category metadata

## PR description

## Summary

- Validate that the retained-shell category map has no stale entries outside EXPECTED_RETAINED_SHELL.
- Surface stale category metadata in the bash-retirement inventory report.
- Add focused coverage for stale category detection and report rendering.

## Checks

- PASS: bun test tools/hygiene/check-bash-retirement-inventory.test.ts
- PASS: bun tools/hygiene/check-bash-retirement-inventory.ts --enforce
- PASS: git diff --check and git diff --cached --check
- BLOCKED locally: bun run typecheck (tsc is not installed in this worktree environment)
- BLOCKED locally: bunx eslint tools/hygiene/check-bash-retirement-inventory.ts tools/hygiene/check-bash-retirement-inventory.test.ts (ESLint 10 requires jiti for TypeScript config loading)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T06:39:57Z)

## Pull request overview

Adds an integrity check to the bash-retirement inventory guard to detect stale entries in the retained-shell category map (category metadata that references files no longer in `EXPECTED_RETAINED_SHELL`), and surfaces these errors in both the rendered report and tests.

**Changes:**

- Extend allowlist integrity inspection to flag stale category-map entries.
- Render stale category-map drift in the human-readable inventory report (including a new summary counter).
- Add targeted tests covering stale category detection and report rendering.

### Reviewed changes

Copilot reviewed 3 out of 3 changed files in this pull request and generated 2 comments.

| File | Description |
| ---- | ----------- |
| tools/hygiene/check-bash-retirement-inventory.ts | Adds stale category-map detection to allowlist integrity checks and report output. |
| tools/hygiene/check-bash-retirement-inventory.test.ts | Adds coverage for stale category detection and report rendering. |
| docs/claims/codex-loop-bash-retirement-category-map-integrity-20260527.md | Introduces a claim file documenting the work scope (should be released/removed when landing). |

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T06:48:58Z)

## Pull request overview

Copilot reviewed 2 out of 2 changed files in this pull request and generated no new comments.

## Review threads

### Thread 1: docs/claims/codex-loop-bash-retirement-category-map-integrity-20260527.md:17 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T06:39:56Z):

This PR adds a new claim file under docs/claims/, but the claim protocol requires deleting the claim file in the same PR that lands the work. Since this PR appears to be the landing PR for the work, please remove this claim file (or replace it with a release commit that deletes it) so docs/claims/ does not accumulate completed claims.

### Thread 2: tools/hygiene/check-bash-retirement-inventory.ts:338 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T06:39:56Z):

The allowlist integrity report now includes “stale category entries”, but the section’s explanatory sentence (just above this block) still says the allowlist must be “unique and sorted” before drift is classified. Please update that wording to reflect all enforced integrity constraints (including category metadata consistency / no stale category entries) so the report doesn’t mislead readers.

## General comments

### @chatgpt-codex-connector (2026-05-27T06:47:31Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
