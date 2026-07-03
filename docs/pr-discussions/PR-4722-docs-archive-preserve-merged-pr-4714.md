---
pr_number: 4722
title: "docs(archive): preserve merged PR #4714"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-23T11:02:04Z"
merged_at: "2026-05-23T13:30:24Z"
closed_at: "2026-05-23T13:30:24Z"
head_ref: "lior-archive-4714"
base_ref: "main"
archived_at: "2026-05-23T15:56:58Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4722: docs(archive): preserve merged PR #4714

## PR description

This PR preserves the discussion archive for merged PR #4714.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-23T11:04:20Z)

## Pull request overview

This PR adds a preserved discussion archive for merged PR #4714 under `docs/pr-discussions/`, capturing the PR metadata, description, and bot comments for historical reference.

**Changes:**

- Add a new PR discussion archive markdown file for PR #4714.
- Include YAML frontmatter with PR metadata (timestamps, refs, archive tool).
- Store the PR description content and follow-up bot messages in the archive.

## Review threads

### Thread 1: docs/pr-discussions/PR-4714-deps-bump-the-nuget-minor-patch-group-with-3-updates.md:38 (resolved)

**@copilot-pull-request-reviewer** (2026-05-23T11:04:18Z):

P0: These bullets contain an invisible Unicode codepoint (the U+200B zero-width space between `#` and the issue number, e.g. `[#1907]`). This will trigger the repo’s Semgrep `invisible-unicode-in-text` rule and fail CI. Strip the zero-width characters (use plain ASCII like `[#1907]`, or wrap in backticks if you need to avoid linkification).

### Thread 2: docs/pr-discussions/PR-4714-deps-bump-the-nuget-minor-patch-group-with-3-updates.md:69 (resolved)

**@copilot-pull-request-reviewer** (2026-05-23T11:04:19Z):

P0: This section also includes U+200B zero-width spaces in the `[#....]` references. The Semgrep `invisible-unicode-in-text` rule applies to `**/*.md`, so these characters will break the build. Remove the invisible codepoints and keep the text purely ASCII.

### Thread 3: docs/pr-discussions/PR-4714-deps-bump-the-nuget-minor-patch-group-with-3-updates.md:104 (resolved)

**@copilot-pull-request-reviewer** (2026-05-23T11:04:19Z):

P0: Lines here contain an invisible Unicode character (U+200B) inside `@meziantou` / `@Copilot`. This triggers the Semgrep `invisible-unicode-in-text` rule and will fail CI. Replace the mentions with plain ASCII (e.g. `@meziantou`, `@Copilot`) or another visible escape (like backticks) instead of zero-width characters.

### Thread 4: docs/pr-discussions/PR-4714-deps-bump-the-nuget-minor-patch-group-with-3-updates.md:114 (resolved)

**@copilot-pull-request-reviewer** (2026-05-23T11:04:19Z):

P0: This bullet uses a U+200B zero-width space inside `@Copilot`. Semgrep `invisible-unicode-in-text` will flag this in `*.md`. Remove the zero-width character (use ASCII `@Copilot` / backticks).

### Thread 5: docs/pr-discussions/PR-4714-deps-bump-the-nuget-minor-patch-group-with-3-updates.md:124 (resolved)

**@copilot-pull-request-reviewer** (2026-05-23T11:04:19Z):

P0: This bullet contains U+200B zero-width space inside `@meziantou`, which will be rejected by Semgrep `invisible-unicode-in-text`. Strip the invisible codepoint and keep the mention purely ASCII.

### Thread 6: docs/pr-discussions/PR-4714-deps-bump-the-nuget-minor-patch-group-with-3-updates.md:134 (resolved)

**@copilot-pull-request-reviewer** (2026-05-23T11:04:19Z):

P0: U+200B zero-width space appears in `@meziantou` on this line. This will fail the Semgrep invisible-Unicode check. Replace with ASCII `@meziantou` (or use backticks) and ensure no hidden Unicode remains.

### Thread 7: docs/pr-discussions/PR-4714-deps-bump-the-nuget-minor-patch-group-with-3-updates.md:144 (resolved)

**@copilot-pull-request-reviewer** (2026-05-23T11:04:20Z):

P0: U+200B zero-width space appears in `@meziantou` on this line, which will be flagged by Semgrep `invisible-unicode-in-text`. Strip the invisible character so the archive remains ASCII-clean.

### Thread 8: docs/pr-discussions/PR-4714-deps-bump-the-nuget-minor-patch-group-with-3-updates.md:154 (resolved)

**@copilot-pull-request-reviewer** (2026-05-23T11:04:20Z):

P0: This bullet includes a U+200B zero-width space inside `@meziantou`. The repo’s invisible-Unicode Semgrep rule applies to all Markdown files, so this will break CI. Remove the zero-width character and keep the text ASCII.

## General comments

### @AceHack (2026-05-23T12:38:51Z)

Vera CI triage (root read-only, no branch edits).

I inspected the failing checks on head `c141c596cd080a63419ab5831d330d26c3195ef1`.

Blocking checks:

- `lint (no conflict markers)`: failed during toolchain setup, not conflict-marker content. `mise` failed installing `aqua:rhysd/actionlint@1.7.12` because the GitHub API returned `401 Unauthorized` for the release tag request.
- `lint (semgrep)`: real content blocker. Semgrep reported 23 blocking `invisible-unicode-in-text` findings in `docs/pr-discussions/PR-4714-deps-bump-the-nuget-minor-patch-group-with-3-updates.md`.

The semgrep hits are zero-width/invisible characters in issue/PR references and handles, including refs like `#1907`, `#1912`, `#1723`, `#1313`, `#1337`, `#1828`, `#1927`, `#1933`, and handles such as `@meziantou` / `@Copilot` where the archived text contains hidden characters.

Next branch-side fix: strip the invisible Unicode characters from that archive markdown, then rerun CI. Rerun-only is not enough while the semgrep findings remain.

I did not push a fix because this PR is Lior-owned (`lior-archive-4714`) and Lior is active locally; Vera stayed remote-only.

### @AceHack (2026-05-23T13:08:03Z)

All checks have now passed. The invisible unicode characters have been stripped.
