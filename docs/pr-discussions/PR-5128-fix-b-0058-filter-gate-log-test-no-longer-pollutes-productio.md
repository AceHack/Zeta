---
pr_number: 5128
title: "fix(081KQ3HBZ0008QG0R002S674CG): filter-gate-log test no longer pollutes production ethics-decision log"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T08:13:49Z"
merged_at: "2026-05-26T08:22:32Z"
closed_at: "2026-05-26T08:22:32Z"
head_ref: "otto-cli/filter-gate-log-test-pollution-fix-2026-05-26"
base_ref: "main"
archived_at: "2026-05-26T13:29:29Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5128: fix(081KQ3HBZ0008QG0R002S674CG): filter-gate-log test no longer pollutes production ethics-decision log

## PR description

## Summary

- `tools/alignment/filter_gate_log.test.ts:302` ran `main()` with production args, so every test run wrote `skill:test-entry` entries to the real production log at `tools/alignment/out/filter-gate-log.jsonl`.
- Empirical anchor: 2026-05-25T22:52Z Lior test run left 2 polluting entries in the local checkout. The file was never committed because it carried only test pollution; per 081KQ3HBZ0008QG0R002S674CG responsibility #3 it is supposed to carry only real ethics-gate decisions.
- Fix adds an env-var override (`FILTER_GATE_LOG_PATH`) for `logFilePath()` and updates the polluting test to use `mkdtempSync` + try/finally cleanup.

## What changed

- `tools/alignment/filter_gate_log.ts`: `logFilePath()` now checks `process.env.FILTER_GATE_LOG_PATH` first; defaults to repo path. Additive; no API break.
- `tools/alignment/filter_gate_log.test.ts`: the previously-polluting `--record` test now creates a tempdir, sets the env override, asserts the entry was actually written (stronger than the old `expect(code).toBe(0)` check), and cleans up in `finally`.

## Test plan

- [x] `bun test tools/alignment/filter_gate_log.test.ts` — 33/33 pass
- [x] `bun test tools/alignment/` — 141/141 pass (no other tests affected)
- [x] After test run, no `tools/alignment/out/filter-gate-log.jsonl` is created
- [x] `audit_candidate_failures.ts` (only other consumer of `logFilePath()`) reads via the same function — env override works transparently
- [x] Commit canary (`ls-tree HEAD~1 == HEAD == 61`) per `codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T08:16:36Z)

## Pull request overview

Prevents `filter_gate_log` tests from writing `skill:test-entry` records into the real production ethics-decision log by adding a configurable log-path override and updating the polluting CLI test to write to a temp location.

**Changes:**
- Add `FILTER_GATE_LOG_PATH` env override to `logFilePath()` (default remains the repo log path).
- Update the `--record` CLI test to write to a temp log file and assert the entry is actually written.

### Reviewed changes

Copilot reviewed 3 out of 3 changed files in this pull request and generated 2 comments.

| File | Description |
| ---- | ----------- |
| tools/alignment/filter_gate_log.ts | Adds env-var override for log path (keeps default repo log). |
| tools/alignment/filter_gate_log.test.ts | Uses a temp directory + env override to keep tests from polluting the production log. |

## Review threads

### Thread 1: tools/alignment/filter_gate_log.ts:108 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T08:16:35Z):

P2: The comment says tests set FILTER_GATE_LOG_PATH to a tempdir, but logFilePath() treats it as the full log *file* path. If someone follows the comment and sets the env var to a directory, recordEntry() will attempt to append to a directory and fail (EISDIR). Suggest clarifying the comment to say it must be a file path (and optionally trimming whitespace so a value like "   " doesn’t get treated as a real path).

### Thread 2: tools/alignment/filter_gate_log.test.ts:328 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T08:16:35Z):

P1: This test mutates process.env.FILTER_GATE_LOG_PATH and then unconditionally deletes it. If the variable was already set in the caller’s environment (or by another test), this will clobber it for the remainder of the test run. Save the previous value before setting it and restore it in finally (set it back if defined, otherwise delete).

## General comments

### @chatgpt-codex-connector (2026-05-26T08:13:56Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
