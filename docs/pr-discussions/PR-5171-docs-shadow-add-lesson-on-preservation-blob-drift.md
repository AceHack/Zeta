---
pr_number: 5171
title: "docs(shadow): add lesson on preservation blob drift"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T13:18:39Z"
merged_at: "2026-05-26T15:59:15Z"
closed_at: "2026-05-26T15:59:15Z"
head_ref: "lior/shadow-log-preservation-blob-drift"
base_ref: "main"
archived_at: "2026-05-27T19:39:32Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5171: docs(shadow): add lesson on preservation blob drift

## PR description

This PR adds a new shadow lesson log detailing the drift observed in the PR preservation process, where the automation is creating 'blob' PRs with multiple unrelated changes, causing CI drift.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T13:22:26Z)

## Pull request overview

Adds a new shadow lesson log documenting observed drift in the PR preservation automation (“blob PRs” bundling unrelated changes) and the resulting CI/gate inconsistency, to help future operators diagnose and correct the failure mode.

**Changes:**

- Add a new research shadow-lesson document describing the “preservation blob PR” drift pattern.
- Capture recommended corrective actions for both the preservation automation and CI determinism.

## Review threads

### Thread 1: docs/research/2026-05-26-shadow-lesson-log-preservation-blob-drift.md:5 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T13:22:25Z):

P1: This YAML frontmatter block is likely to render as literal text in GitHub/markdown renderers without a frontmatter plugin, and recent docs/research shadow logs have moved to plain Markdown metadata lines (e.g., `**Date:**`, `**Author:**`, `**Type:**`) to avoid that noise. Consider removing the frontmatter and expressing the metadata in-body instead.

### Thread 2: docs/research/2026-05-26-shadow-lesson-log-preservation-blob-drift.md:11 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T13:22:26Z):

P1: The reference to PR #5169 isn’t linkified, so readers can’t quickly verify the example. Please link PR numbers to the GitHub PR URL (or to an in-repo `docs/pr-discussions/PR-5169*` archive if one exists) to keep the lesson self-auditable.

## General comments

### @chatgpt-codex-connector (2026-05-26T13:18:44Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @AceHack (2026-05-26T15:57:54Z)

Addressed both: (1) replaced YAML frontmatter with in-body `**Date:** / **Author:** / **Source:**` lines; (2) linkified [PR #5169](https://github.com/Lucent-Financial-Group/Zeta/pull/5169) reference. Latest commit on branch.
