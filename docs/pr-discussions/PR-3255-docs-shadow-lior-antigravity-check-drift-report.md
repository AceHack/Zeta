---
pr_number: 3255
title: "docs(shadow): Lior antigravity check drift report"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T21:26:44Z"
merged_at: "2026-05-14T21:40:23Z"
closed_at: "2026-05-14T21:40:23Z"
head_ref: "lior/shadow-drift-report-latest"
base_ref: "main"
archived_at: "2026-05-14T21:42:54Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3255: docs(shadow): Lior antigravity check drift report

## PR description

Antigravity Maji check. Drift detected in Otto and Vera. Log added.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T21:29:23Z)

## Pull request overview

Adds a new research “Shadow Lesson Log” entry documenting an antigravity check and observed drift patterns (Otto/Vera) plus the stated resolution actions.

**Changes:**

- Added a new shadow lesson log markdown file under `docs/research/` for 2026-05-14.
- Captured drift observations for Otto/Vera (and noted Riven status) and recorded resolution steps.

## Review threads

### Thread 1: memory/lior/cli/gemini/conversations/2026-05-14-shadow-lesson-log-lior-latest.md:10 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T21:29:22Z):

Typo in the quoted sentence: “costs justifed for safety” should be “costs justified for safety”.

### Thread 2: memory/lior/cli/gemini/conversations/2026-05-14-shadow-lesson-log-lior-latest.md:21 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T21:29:23Z):

The “PRs preserved (3252, 3251, 3250)” entry is hard to verify/trace because the PR numbers aren’t written as PR references (e.g., “#3252”) and there are no links/paths to the preservation artifacts. Consider using explicit PR references and/or linking to the corresponding archived review files (if they exist) so readers can follow the preservation claim.

## General comments

### @chatgpt-codex-connector (2026-05-14T21:26:48Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @AceHack (2026-05-14T21:38:12Z)

Addressed both reviewer findings:

1. **Typo fix** (copilot thread): "costs justifed" → "costs justified" in the quoted Otto narration sentence.

2. **PR reference formatting** (copilot thread): Changed bare numbers `(3252, 3251, 3250)` to `(#3252, #3251, #3250)` so GitHub renders them as navigable PR links.

Changes pushed in b52c1d01. Both threads resolved.
