---
pr_number: 4885
title: "docs(shadow): Add shadow lesson logs from #4832"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-24T22:32:15Z"
merged_at: "2026-05-25T04:17:29Z"
closed_at: "2026-05-25T04:17:29Z"
head_ref: "shadow-logs-4832"
base_ref: "main"
archived_at: "2026-05-27T19:53:56Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4885: docs(shadow): Add shadow lesson logs from #4832

## PR description

This PR extracts the shadow lesson logs from PR #4832. This is a decomposition of the blob PR #4832.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-24T22:33:56Z)

## Pull request overview

This PR adds a new Shadow lesson log research note documenting an incident involving stale Git locks that blocked `git fetch` in a worktree, extracted from PR #4832.

**Changes:**

- Add a new Shadow lesson log entry describing the stale lock incident, analysis, and resulting action items.

### COMMENTED — @AceHack (2026-05-25T04:15:46Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-25T04:15:48Z)

_(no body)_

## Review threads

### Thread 1: docs/research/shadow-lesson-log-20260522-stale-locks.md:19 (resolved)

**@copilot-pull-request-reviewer** (2026-05-24T22:33:56Z):

P0: The unordered list items use `*   ` (three spaces after the marker). This likely violates markdownlint MD030 (expected 1 space) and can fail CI for this non-ignored research file. Use a single space after the list marker (e.g., `- ` or `* `).

**@AceHack** (2026-05-25T04:15:46Z):

Confirmed P0 — both list groups (Implications lines 17-19 + Action Items lines 25-27) used `* ` + 3 spaces, violating MD030. Verified directly via gh api .../contents; the markdownlint CI failure log matches the exact same lines. Pushed `5ebc65e7` via REST git-data API collapsing all 6 markers to `* ` + 1 space. Resolving thread.

### Thread 2: docs/research/shadow-lesson-log-20260522-stale-locks.md:27 (resolved)

**@copilot-pull-request-reviewer** (2026-05-24T22:33:56Z):

P0: The Action Items list uses `*   ` (three spaces after the marker), which likely violates markdownlint MD030 and can fail CI. Use a single space after the list marker (e.g., `- ` or `* `).

**@AceHack** (2026-05-25T04:15:48Z):

Confirmed P0 — both list groups (Implications lines 17-19 + Action Items lines 25-27) used `* ` + 3 spaces, violating MD030. Verified directly via gh api .../contents; the markdownlint CI failure log matches the exact same lines. Pushed `5ebc65e7` via REST git-data API collapsing all 6 markers to `* ` + 1 space. Resolving thread.
