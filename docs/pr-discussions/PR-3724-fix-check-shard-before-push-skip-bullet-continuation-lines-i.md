---
pr_number: 3724
title: "fix(check-shard-before-push): skip bullet-continuation lines in MD032 scan"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T04:03:03Z"
merged_at: "2026-05-16T04:05:45Z"
closed_at: "2026-05-16T04:05:45Z"
head_ref: "fix/checkmd032-bullet-continuation-otto-cli-2026-05-16"
base_ref: "main"
archived_at: "2026-05-16T04:14:53Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3724: fix(check-shard-before-push): skip bullet-continuation lines in MD032 scan

## PR description

Helper bug discovered in tick 19 while running the helper on `.claude/rules/blocked-green-ci-investigate-threads.md` — `checkMd032` flagged 3 bullet-continuation lines as paragraphs (prev line was 2-space-indented continuation of a list item). Markdownlint correctly ignores these.

Fix: add `isContinuationLine(line)` predicate; skip when prev is a continuation line.

3 smoke tests: bullet-continuation FP cleared; real paragraph-before-bullet still caught; existing-clean-shard regression ok. `tsc --noEmit` exit 0.

Co-Authored-By: Claude <noreply@anthropic.com>

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T04:04:11Z)

## Pull request overview

Fixes a false-positive in the MD032 helper scan: bullet-continuation lines (leading whitespace) were being treated as paragraphs preceding a list, triggering spurious findings. Adds an `isContinuationLine` predicate and skips when the previous line is a continuation.

**Changes:**

- Add `isContinuationLine(line)` helper detecting leading whitespace.
- Skip MD032 trigger when previous line is a continuation line.
