---
pr_number: 2752
title: "fix(dashboard): 081KDW5GVK008QG0R0026JFKMV rename Zeta Factory to Zeta Plant"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-11T20:52:53Z"
merged_at: "2026-05-11T21:08:41Z"
closed_at: "2026-05-11T21:08:41Z"
head_ref: "fix/b-0417-rename-factory-to-plant"
base_ref: "main"
archived_at: "2026-05-11T21:19:51Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #2752: fix(dashboard): 081KDW5GVK008QG0R0026JFKMV rename Zeta Factory to Zeta Plant

## PR description

Updates terminology from 'Factory' to 'Plant' to reflect the organic, living nature of the BFT array as a growing substrate rather than a mechanical assembly line.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-11T20:54:57Z)

## Pull request overview

Updates the demo dashboard’s visible branding from “Zeta Factory” to “Zeta Plant” to reflect the new terminology used across the project.

**Changes:**
- Renamed the HTML document title to “Zeta Plant Dashboard”.
- Updated the header branding text from “Zeta Factory” to “Zeta Plant” (including the subtitle).

### COMMENTED — @copilot-pull-request-reviewer (2026-05-11T21:02:47Z)

## Pull request overview

Copilot reviewed 1 out of 1 changed files in this pull request and generated 1 comment.

## Review threads

### Thread 1: demo/index.html:6 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:54:57Z):

P1: Terminology rename looks incomplete vs PR description. This page still shows user-visible text containing “factory” (e.g., “Syncing factory operations...” around line 606 and the rate-limit hint “The factory will automatically retry.” around line 963). Please update the remaining user-facing strings (and optionally the nearby HTML comment “TAB 1: FACTORY”) so the dashboard consistently uses “Plant”.

### Thread 2: demo/index.html:600 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T21:02:47Z):

P1: The UI copy has been renamed to “Plant”, but the tab wiring still uses the old “factory” identifier (`switchTab('factory', ...)` / `id="tab-factory"`). This mismatch makes the rename incomplete and is easy to trip over in future edits. Consider renaming the tab id and switchTab argument to `plant` (and updating any related references), or keep the comment/header terminology aligned with the internal id if you intentionally want to preserve the old identifier.

## General comments

### @chatgpt-codex-connector (2026-05-11T20:57:33Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @chatgpt-codex-connector (2026-05-11T21:00:25Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
