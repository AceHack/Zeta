---
pr_number: 5358
title: "hygiene: validate bash retirement allowlist integrity"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T23:50:03Z"
merged_at: "2026-05-26T23:52:41Z"
closed_at: "2026-05-26T23:52:41Z"
head_ref: "claim/codex-loop-bash-retirement-allowlist-integrity-20260526"
base_ref: "main"
archived_at: "2026-05-27T19:30:23Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5358: hygiene: validate bash retirement allowlist integrity

## PR description

## Summary

- validate the retained shell allowlist for duplicate and out-of-order entries before classifying repo `.sh` drift
- surface allowlist integrity counts in the bash-retirement inventory report
- cover duplicate, unsorted, and rendered integrity-error cases in the focused Bun test

## Checks

- `bun test tools/hygiene/check-bash-retirement-inventory.test.ts`
- `bun run hygiene:check-bash-retirement-inventory`
- `node_modules/.bin/tsc --noEmit -p tsconfig.json`

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T23:52:55Z)

## Pull request overview

This PR hardens the bash-retirement inventory guard (`tools/hygiene/check-bash-retirement-inventory.ts`) by validating that the retained-shell allowlist itself is sorted and de-duplicated before using it to classify repo `.sh` drift, and it surfaces integrity counts in the report output.

**Changes:**

- Add allowlist integrity inspection (duplicate detection + out-of-order detection) and treat integrity drift as a first-class “drift” condition.
- Extend the rendered report with allowlist integrity counts and a dedicated integrity-errors section that suppresses normal drift classification until fixed.
- Add focused Bun tests covering duplicate/unsorted allowlist detection and integrity-error rendering (partial).

### Reviewed changes

Copilot reviewed 3 out of 3 changed files in this pull request and generated 2 comments.

| File | Description |
| ---- | ----------- |
| tools/hygiene/check-bash-retirement-inventory.ts | Adds allowlist integrity validation and report rendering for integrity errors/counts. |
| tools/hygiene/check-bash-retirement-inventory.test.ts | Adds tests for allowlist integrity drift and one integrity rendering path. |
| docs/claims/codex-loop-bash-retirement-allowlist-integrity-20260526.md | Adds a live claim artifact (should be released/removed before merge per protocol). |

## Review threads

### Thread 1: docs/claims/codex-loop-bash-retirement-allowlist-integrity-20260526.md:24 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-26T23:52:55Z):

P0: Per docs/claims/README.md and docs/AGENT-CLAIM-PROTOCOL.md, live claim files under docs/claims/ must be released (deleted) in the same PR that lands the work; this PR currently adds a claim file, which would leave completed claims accumulating on main. Also, the file doesn’t follow the claim template (opaque Session ID + Harness + bullet fields) and includes direct agent identity plus a local worktree path; please remove this file before merge (or rewrite to the protocol shape if it must remain temporarily).

### Thread 2: tools/hygiene/check-bash-retirement-inventory.test.ts:118 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-26T23:52:55Z):

P1: renderReport gained a dedicated “Out-of-order entries” integrity section, but the tests only assert the duplicate-entry rendering path. Add a focused renderReport test for the unsorted allowlist case to lock in the expected header/line formatting and ensure drift sections stay suppressed when only order violations are present.

## General comments

### @chatgpt-codex-connector (2026-05-26T23:50:09Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
