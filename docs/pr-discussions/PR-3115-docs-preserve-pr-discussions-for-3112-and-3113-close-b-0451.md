---
pr_number: 3115
title: "docs: preserve PR discussions for 3112 and 3113; close 081KRFA460008QG0R00308W7FJ"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T08:13:07Z"
merged_at: "2026-05-14T08:21:26Z"
closed_at: "2026-05-14T08:21:27Z"
head_ref: "lior/preserve-prs-3112-3113"
base_ref: "main"
archived_at: "2026-05-14T08:25:45Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3115: docs: preserve PR discussions for 3112 and 3113; close 081KRFA460008QG0R00308W7FJ

## PR description

Preserving recently merged PRs per step 4b PR archive discipline.

Also closes 081KRFA460008QG0R00308W7FJ (duplicate row-ID substrate cleanup) — all 12 collision
groups resolved, audit tool exits 0. CI-wiring follow-up tracked in
081KRFA460008QG0R00308W7FJ Future work section (separate slice, does not block closure).

Closes #081KRFA460008QG0R00308W7FJ

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T08:16:38Z)

## Pull request overview

This PR primarily preserves GitHub PR discussion archives for merged PRs #3112 and #3113 under `docs/pr-discussions/`, but it also includes a hygiene tick shard and closes backlog item 081KRFA460008QG0R00308W7FJ.

**Changes:**

- Adds generated PR discussion archives for PR #3112 and PR #3113.
- Adds a hygiene-history tick shard for 2026-05-14T05:21Z.
- Marks 081KRFA460008QG0R00308W7FJ closed and updates `docs/BACKLOG.md` accordingly.

### Reviewed changes

Copilot reviewed 5 out of 5 changed files in this pull request and generated 2 comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| `docs/pr-discussions/PR-3113-docs-lior-antigravity-check-pr-preservation-and-blob-drift-l.md` | Adds preserved PR #3113 discussion metadata and review content. |
| `docs/pr-discussions/PR-3112-docs-b-0289-green-lantern-hardware-spec-local-inference-requ.md` | Adds preserved PR #3112 discussion metadata, reviews, and review threads. |
| `docs/hygiene-history/ticks/2026/05/14/0521Z.md` | Adds tick-session notes covering PR gate status and 081KRFA460008QG0R00308W7FJ closure work. |
| `docs/backlog/P1/081KRFA460008QG0R00308W7FJ-duplicate-row-id-substrate-cleanup-2026-05-13.md` | Marks 081KRFA460008QG0R00308W7FJ closed and updates acceptance criteria status. |
| `docs/BACKLOG.md` | Updates the generated backlog index to show 081KRFA460008QG0R00308W7FJ as closed. |
</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T08:22:18Z)

## Pull request overview

Copilot reviewed 3 out of 3 changed files in this pull request and generated no new comments.

## Review threads

### Thread 1: docs/backlog/P1/081KRFA460008QG0R00308W7FJ-duplicate-row-id-substrate-cleanup-2026-05-13.md:93 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T08:16:37Z):

This closes 081KRFA460008QG0R00308W7FJ while leaving one acceptance criterion unchecked. If CI wiring is no longer required for this row, move it out of the acceptance-criteria checklist and link/create the follow-up row; otherwise keep the backlog item open until the criterion is complete.

### Thread 2: docs/backlog/P1/081KRFA460008QG0R00308W7FJ-duplicate-row-id-substrate-cleanup-2026-05-13.md:5 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T08:16:37Z):

The PR title and description only describe preserving PR discussions for #3112/#3113, but this change also closes backlog item 081KRFA460008QG0R00308W7FJ. Please either update the PR metadata to include the backlog closure or split this state change into a separate PR so reviewers can evaluate the scope accurately.
