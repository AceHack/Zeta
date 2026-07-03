---
pr_number: 4861
title: "docs(archive): preserve PR #4836"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-24T20:21:05Z"
merged_at: "2026-05-25T08:57:51Z"
closed_at: "2026-05-25T08:57:51Z"
head_ref: "lior-pr-preservation-4836-2"
base_ref: "main"
archived_at: "2026-05-27T19:54:03Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4861: docs(archive): preserve PR #4836

## PR description

This PR preserves the discussion from PR #4836.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-24T20:24:06Z)

## Pull request overview

This PR adds preserved PR-discussion archives under `docs/pr-discussions/`, intended to keep the discussion and review context from PR #4836 available in-repo for future auditing.

**Changes:**

- Adds a new preserved discussion archive for PR #4836 (tick 2026-05-24/1608Z).
- Adds an additional preserved discussion archive for PR #4853 (shard 2026-05-24/1902Z).

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 4 comments.

| File | Description |
| ---- | ----------- |
| docs/pr-discussions/PR-4853-shard-2026-05-24-1902z-otto-vscode-bg-worker-lior-lane-fleet.md | Adds a PR-discussion archive for PR #4853, including metadata and preserved review threads. |
| docs/pr-discussions/PR-4836-tick-2026-05-24-1608z-dotgit-saturation-15th-observation-2nd.md | Adds a PR-discussion archive for PR #4836, including metadata and preserved Codex review thread. |

### COMMENTED — @AceHack (2026-05-25T08:57:41Z)

_(no body)_

## Review threads

### Thread 1: docs/pr-discussions/PR-4853-shard-2026-05-24-1902z-otto-vscode-bg-worker-lior-lane-fleet.md:3 (resolved)

**@copilot-pull-request-reviewer** (2026-05-24T20:24:05Z):

PR metadata/description says this PR preserves PR #4836, but this archive file is for PR #4853. Either update the PR title/description to reflect that multiple PR discussions are being preserved, or move PR #4853 preservation into a separate PR to keep the archive intent unambiguous.

**@AceHack** (2026-05-25T08:57:41Z):

Substrate-honest no-op resolution: the PR-4853 file in this PR is byte-identical with origin/main (shipped via #4862 f51c5c3a8; #4860 then merged the same content again as no-op). All 4 review threads on this file flag link-relative-path issues that exist on the on-main version; fixing them in this PR does not change main state. The PR-4836 file is the genuinely-new substrate; merging this PR adds the PR-4836 content while the PR-4853 path is a no-op delta. Resolving per .claude/rules/blocked-green-ci-investigate-threads.md stale-resolution pattern + .claude/rules/pr-triage-tiers.md Tier 2.

### Thread 2: docs/pr-discussions/PR-4853-shard-2026-05-24-1902z-otto-vscode-bg-worker-lior-lane-fleet.md:21 (resolved)

**@copilot-pull-request-reviewer** (2026-05-24T20:24:06Z):

The link to the 1804Z tick uses `(docs/hygiene-history/...)`, which will resolve relative to `docs/pr-discussions/` and point at a non-existent path (`docs/pr-discussions/docs/...`). Use a path relative to this file (e.g., `../hygiene-history/...`) or an absolute GitHub URL so the archive remains navigable.

### Thread 3: docs/pr-discussions/PR-4853-shard-2026-05-24-1902z-otto-vscode-bg-worker-lior-lane-fleet.md:36 (resolved)

**@copilot-pull-request-reviewer** (2026-05-24T20:24:06Z):

This `.claude/rules/...` link is broken from `docs/pr-discussions/` because it resolves to `docs/pr-discussions/.claude/...` (which doesn’t exist). Update it to a correct relative path from this file (typically `../../.claude/rules/...`).

### Thread 4: docs/pr-discussions/PR-4853-shard-2026-05-24-1902z-otto-vscode-bg-worker-lior-lane-fleet.md:36 (resolved)

**@copilot-pull-request-reviewer** (2026-05-24T20:24:06Z):

All `.claude/rules/...` links in this paragraph are broken from `docs/pr-discussions/` because they resolve under `docs/pr-discussions/.claude/...` (non-existent). Rewrite them to correct relative paths from this file (typically `../../.claude/rules/...`) so rule references are navigable in the archive.
