---
pr_number: 4337
title: "docs(archive): Maji PR preservation batch 18"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-19T06:15:41Z"
merged_at: "2026-05-19T06:52:49Z"
closed_at: "2026-05-19T06:52:49Z"
head_ref: "lior/preserve-batch-18"
base_ref: "main"
archived_at: "2026-05-19T06:59:49Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4337: docs(archive): Maji PR preservation batch 18

## PR description

Autonomously archived PRs 4319, 4316, 4312.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-19T06:18:32Z)

## Pull request overview

Adds a new batch of PR-discussion archive records under `docs/pr-discussions/` to preserve metadata, descriptions, review threads, and general comments for recently merged PRs.

**Changes:**

- Archived PR #4319 discussion (shadow drift report on Otto + Riven paralysis).
- Archived PR #4316 discussion (shadow drift report on Riven paralysis).
- Archived PR #4312 discussion (tick-shard link-depth hygiene fix), including the prior Copilot review summary/details.

### Reviewed changes

Copilot reviewed 3 out of 3 changed files in this pull request and generated 1 comment.

| File | Description |
| ---- | ----------- |
| docs/pr-discussions/PR-4319-docs-shadow-maji-anti-entropy-shadow-report-on-otto-and-rive.md | New PR archive record for #4319 (metadata + review thread capture). |
| docs/pr-discussions/PR-4316-docs-shadow-maji-anti-entropy-shadow-report-on-riven-paralys.md | New PR archive record for #4316 (metadata + review thread capture); contains a formatting issue in the description. |
| docs/pr-discussions/PR-4312-fix-hygiene-clear-2026-05-18-tick-link-drift.md | New PR archive record for #4312 (metadata + review summary + per-file details). |

## Review threads

### Thread 1: docs/pr-discussions/PR-4316-docs-shadow-maji-anti-entropy-shadow-report-on-riven-paralys.md:19 (resolved)

**@copilot-pull-request-reviewer** (2026-05-19T06:18:32Z):

P1: This PR archive appears to contain a literal `\n` escape sequence in the PR description (it renders as raw text). Replace the `\n` with an actual newline so the Markdown renders correctly (heading on its own line, followed by the paragraph).
