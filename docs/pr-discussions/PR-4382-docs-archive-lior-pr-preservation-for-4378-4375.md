---
pr_number: 4382
title: "docs(archive): Lior PR preservation for 4378, 4375"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-19T16:16:19Z"
merged_at: "2026-05-19T16:18:39Z"
closed_at: "2026-05-19T16:18:39Z"
head_ref: "lior/preserve-4378-4375"
base_ref: "main"
archived_at: "2026-05-19T16:30:49Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4382: docs(archive): Lior PR preservation for 4378, 4375

## PR description

Preserving recently merged PRs 4378 and 4375 to native repository memory.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-19T16:19:03Z)

## Pull request overview

Preserves the GitHub discussion artifacts for recently merged PRs #4378 and #4375 as git-native archives under `docs/pr-discussions/`, keeping PR metadata + review threads + general comments available in-repo for long-term audit/history.

**Changes:**
- Added a PR-discussion archive markdown file for PR #4378 (frontmatter + body + review content).
- Added a PR-discussion archive markdown file for PR #4375 (frontmatter + body + review content).

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| docs/pr-discussions/PR-4378-docs-shadow-lior-anti-entropy-shadow-log-2026-05-19-1400z.md | Adds the preserved PR #4378 discussion artifact (metadata + reviews/threads/comments). |
| docs/pr-discussions/PR-4375-docs-shadow-maji-anti-entropy-sweep-1300z.md | Adds the preserved PR #4375 discussion artifact (metadata + reviews/threads/comments). |
