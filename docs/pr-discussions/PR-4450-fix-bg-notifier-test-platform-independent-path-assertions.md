---
pr_number: 4450
title: "fix(bg-notifier-test): platform-independent path assertions"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-20T20:14:59Z"
merged_at: "2026-05-20T20:17:43Z"
closed_at: "2026-05-20T20:17:43Z"
head_ref: "fix/b0501-test-windows-path-portability-2026-05-20"
base_ref: "main"
archived_at: "2026-05-21T01:14:12Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4450: fix(bg-notifier-test): platform-independent path assertions

## PR description

## Summary

Follow-up to [#4449](https://github.com/Lucent-Financial-Group/Zeta/pull/4449) — addresses the lingering Copilot P1 review finding on \`tools/bg/backlog-ready-notifier.test.ts\` that landed after merge: the test hard-coded forward-slash paths in \`defaultHistoryFile\` assertions, which would fail on Windows where \`path.join\` returns backslashes.

No Windows workflow exists today, so this is a portability hardening rather than a CI fix.

## Test plan

- [x] Computed expected values with \`path.join\` (matches the implementation)
- [x] 49/49 tests still pass on Linux
- [x] \`tsc --noEmit -p tsconfig.json\` clean
- [x] 081KRHWGX0008QG0R0000P5YP2 claim already released before this PR

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-20T20:16:33Z)

## Pull request overview

Hardens `backlog-ready-notifier`’s assignment-history tests by making `defaultHistoryFile` path assertions platform-independent (matching the production implementation’s `path.join` behavior), avoiding Windows-specific separator failures.

**Changes:**
- Updated the `defaultHistoryFile` test to compute expected paths with `node:path.join`.
- Added a brief comment explaining why the assertion must not hard-code `/` separators.
