---
pr_number: 3707
title: "shard(tick): 2026-05-16T03:22Z \u2014 PR #3690 markdownlint MD038 unblock + sweep"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T03:23:33Z"
merged_at: "2026-05-16T03:31:21Z"
closed_at: "2026-05-16T03:31:21Z"
head_ref: "shard/tick-0322z-otto-cli-2026-05-16"
base_ref: "main"
archived_at: "2026-05-16T03:37:34Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3707: shard(tick): 2026-05-16T03:22Z — PR #3690 markdownlint MD038 unblock + sweep

## PR description

PR #3690 had been 'armed, awaiting CI' since tick 6 (~70 min ago) — diagnosed today as a REQUIRED check FAILURE on lint (markdownlint). MD038/no-space-in-code triggered on backslash-quote-git-space-backslash-quote (trailing space in code span) at 0240Z.md:20. Fixed via commit 81b2f1a.

Sweep of all 2026-05-16 shards on main: 0 other MD038 violations.

Lesson: required-check failures are distinct merge-block class from unresolved-threads + non-required warnings. poll-pr-gate.ts's nextAction field disambiguates ('fix-failed-checks' vs 'resolve-threads' vs 'wait-ci' vs 'none').

Co-Authored-By: Claude <noreply@anthropic.com>

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T03:26:10Z)

## Pull request overview

This PR adds a tick-history shard documenting the PR #3690 markdownlint MD038 investigation, fix, and follow-up operational lessons.

**Changes:**

- Adds the 2026-05-16T03:22Z hygiene-history tick shard.
- Records the required-check failure diagnosis for PR #3690.
- Captures MD038 lessons and next-tick follow-up candidates.

### COMMENTED — @AceHack (2026-05-16T03:30:13Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-16T03:30:23Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-16T03:30:33Z)

_(no body)_

## Review threads

### Thread 1: docs/hygiene-history/ticks/2026/05/16/0322Z.md:44 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T03:26:09Z):

This inline code span still contains a trailing space (`` `git ` ``), so MD038/no-space-in-code will fail on this newly added shard just like the violation this PR is documenting. Since docs/hygiene-history is not ignored by markdownlint, rephrase this without putting the trailing space inside the inline code delimiters.

**@AceHack** (2026-05-16T03:30:13Z):

Verified false positive: `bun x markdownlint-cli2 docs/hygiene-history/ticks/2026/05/16/0322Z.md` exits 0 on the current head. The two `` `git ` `` instances (L35 inside the verbatim markdownlint error output; L41 inside the original-snippet code block) both live INSIDE ` ```text ` fenced code blocks, where MD038/no-space-in-code does NOT apply — the rule is specific to inline code spans. They are intentional faithful renderings of the underlying violation this shard documents (per the MD038 spec linked in the rule). Resolving as not-an-issue.

### Thread 2: docs/hygiene-history/ticks/2026/05/16/0322Z.md:58 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T03:26:10Z):

This appears to duplicate “main” in the phrase “on origin/main main,” which makes the sweep target unclear.

**@AceHack** (2026-05-16T03:30:23Z):

Fixed in b2c7357ec — tightened to `` `bun x markdownlint-cli2 docs/hygiene-history/ticks/2026/05/16/*.md` on `origin/main` (20 shards) → exit 0 ``. The "main main" duplication was a typo; the intent was to name the ref the sweep ran against.

### Thread 3: docs/hygiene-history/ticks/2026/05/16/0322Z.md:33 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T03:26:10Z):

This path does not exist in the current tree (the 05/16 shard directory jumps from 0234Z.md to 0249Z.md). If this shard can merge before PR #3690 lands the 0240Z file, this leaves a dead cross-reference and makes the reproduced lint command non-reproducible from main; either land/include the target first or make clear that the path exists only on the PR #3690 branch.

**@AceHack** (2026-05-16T03:30:33Z):

Cross-reference now resolves: PR #3690 merged at 2ba2c70b6 and `docs/hygiene-history/ticks/2026/05/16/0240Z.md` is present on `origin/main`. Verified via `git ls-tree origin/main docs/hygiene-history/ticks/2026/05/16/` — file is at row 17 of 25 entries. The reproduced lint command points to a real file and the cross-link is live. Concern was time-of-review accurate; superseded by the merge.
