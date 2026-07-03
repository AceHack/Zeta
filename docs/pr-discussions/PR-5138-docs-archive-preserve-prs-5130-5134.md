---
pr_number: 5138
title: "docs(archive): preserve PRs 5130-5134"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T12:13:39Z"
merged_at: "2026-05-26T13:17:59Z"
closed_at: "2026-05-26T13:17:59Z"
head_ref: "lior/pr-preservation-batch-1-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:39:33Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5138: docs(archive): preserve PRs 5130-5134

## PR description

Preserving discussions for recently merged pull requests.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T12:23:52Z)

## Pull request overview

This PR adds PR-discussion archive entries under `docs/pr-discussions/` for recently merged PRs #5130–#5134, preserving their summaries, metadata, and review-thread context as part of the repository’s PR preservation workflow.

**Changes:**

- Added archived discussion markdown for PRs #5130–#5134 (frontmatter + captured narrative/review content).
- Captured cross-links to related PRs/rules/backlog context within each archived entry.

### Reviewed changes

Copilot reviewed 5 out of 5 changed files in this pull request and generated 2 comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| docs/pr-discussions/PR-5130-fix-b-0806-substrate-honest-correction-ace-agenda-already-en.md | Archive entry for PR #5130 discussion and review context. |
| docs/pr-discussions/PR-5131-rule-verify-existing-substrate-before-authoring-sibling-to-d.md | Archive entry for PR #5131 discussion and review context. |
| docs/pr-discussions/PR-5132-fix-backlog-p0-renumber-4-peer-classifier-bypass-rows-b-0800.md | Archive entry for PR #5132 discussion and review context. |
| docs/pr-discussions/PR-5133-backlog-b-0811-re-land-of-b-0741-closed-prematurely-in-stale.md | Archive entry for PR #5133 discussion and review context. |
| docs/pr-discussions/PR-5134-rule-refresh-before-decide-extends-to-working-tree-reads-100.md | Archive entry for PR #5134 discussion and review context. |
</details>

## Review threads

### Thread 1: docs/pr-discussions/PR-5134-rule-refresh-before-decide-extends-to-working-tree-reads-100.md:56 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T12:23:51Z):

Links to `.claude/rules/*.md` are written as relative paths (e.g. `(.claude/rules/zeta-expected-branch.md)`), which resolve relative to `docs/pr-discussions/` and therefore point at a non-existent `docs/pr-discussions/.claude/...`. Use repo-root-relative links like `/.claude/rules/...` (as seen in other PR discussion archives) so the references work when browsing on GitHub.

### Thread 2: docs/pr-discussions/PR-5134-rule-refresh-before-decide-extends-to-working-tree-reads-100.md:56 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T12:23:52Z):

The `Composes with` section uses relative links like `(.claude/rules/refresh-before-decide.md)`, which are broken from `docs/pr-discussions/` (they resolve to `docs/pr-discussions/.claude/...`). Prefer repo-root-relative links (`/.claude/rules/...`) so these cross-references stay navigable in the archive.

## General comments

### @chatgpt-codex-connector (2026-05-26T12:13:44Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @AceHack (2026-05-26T13:16:11Z)

Both Copilot threads addressed in `bb9e938`: 7 relative `.claude/rules/...` links → `/.claude/rules/...` (repo-root-relative), matching the conventional pattern in other archives. Verify-before-fix: line 56 inspected, 7 broken occurrences in lines 44/45/51-56 confirmed. Canary clean (`ls-tree HEAD~1 = HEAD = 61`).
