---
pr_number: 3860
title: "substrate: fenced shell transcript hygiene \u2014 command output vs derived summary"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T10:49:50Z"
merged_at: "2026-05-16T10:51:29Z"
closed_at: "2026-05-16T10:51:29Z"
head_ref: "otto-cli-fenced-transcript-hygiene-2026-05-16"
base_ref: "main"
archived_at: "2026-05-16T11:19:07Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3860: substrate: fenced shell transcript hygiene — command output vs derived summary

## PR description

## Summary

Memory file documenting forward-substrate signal from [PR #3856](https://github.com/Lucent-Financial-Group/Zeta/pull/3856) Copilot review thread #2: fenced shell transcripts must distinguish literal command output from derived summary lines.

**Authored under** counter-with-escalation brief-ack #6 forced decomposition per [`.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`](.claude/rules/holding-without-named-dependency-is-standing-by-failure.md).

## What the rule says

Inside a fenced shell block:

1. `$ command` lines = copy-paste invocations
2. Following lines = literal tool output
3. Derived summaries (manual aggregation, prose) → `#`-comment inside fence OR prose outside fence OR separate labeled fence

Mixing the two breaks copy-paste reproducibility: the transcript looks runnable but isn't.

## Why memory file, not `.claude/rules/`

Single finding so far. Per the suspect-by-default Copilot finding-classes threshold in [`.claude/rules/blocked-green-ci-investigate-threads.md`](.claude/rules/blocked-green-ci-investigate-threads.md) (two-or-more across distinct PRs = "suspect-by-default"), promotion to `.claude/rules/` waits on a second occurrence.

## Empirical anchor

[PR #3856 thread on line 32](https://github.com/Lucent-Financial-Group/Zeta/pull/3856) — flagged `0 + 0 = 0 corrected-tag annotations` as manual summary inside a `grep -c` transcript. Substrate-honest replacement forms documented in the memory file.

## Test plan

- [ ] CI green (docs-only PR; gate checks only)
- [ ] CodeQL "source code seen" canary verified (per [`.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md`](.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md): commit tree count should match origin/main ± a few entries)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T10:52:49Z)

## Pull request overview

Adds durable substrate guidance clarifying how to write reproducible fenced shell transcripts by separating literal command output from any derived/manual summary, and records a brief tick shard noting no new action needed post-session-close.

**Changes:**

- Added a new `memory/feedback_*.md` entry defining the fenced shell transcript hygiene rule and anchoring it to PR #3856’s example.
- Added a new tick shard file for 2026-05-16T10:43Z capturing post-session-close state and peer activity.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 1 comment.

| File | Description |
| ---- | ----------- |
| memory/feedback_fenced_shell_transcript_hygiene_command_output_vs_derived_summary_otto_cli_2026_05_16.md | Documents the rule for distinguishing literal tool output vs derived summaries inside fenced shell transcripts, with an empirical anchor and “composes with” links. |
| docs/hygiene-history/ticks/2026/05/16/1043Z.md | Adds a short post-session-close tick shard recording current status and peer activity. |

## Review threads

### Thread 1: memory/feedback_fenced_shell_transcript_hygiene_command_output_vs_derived_summary_otto_cli_2026_05_16.md:2 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T10:52:49Z):

Frontmatter `name:` is a short slug (`fenced-shell-transcript-hygiene`) rather than a human-readable title. This makes it harder to scan MEMORY indexes/search results; consider expanding `name:` to a descriptive title/sentence while keeping the filename/topic as the stable slug.
