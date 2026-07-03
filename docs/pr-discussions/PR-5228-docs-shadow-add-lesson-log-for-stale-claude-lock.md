---
pr_number: 5228
title: "docs(shadow): add lesson log for stale claude lock"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T17:12:07Z"
merged_at: "2026-05-26T19:51:51Z"
closed_at: "2026-05-26T19:51:51Z"
head_ref: "shadow-log-claude-lock-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:37:38Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5228: docs(shadow): add lesson log for stale claude lock

## PR description

This PR adds a shadow lesson log to document the discovery of a stale lock file for the 'claude' agent.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T17:14:17Z)

## Pull request overview

Adds a new research/shadow lesson log documenting discovery of a stale `.claude/scheduled_tasks.lock` file and capturing the operational lesson + follow-up actions.

**Changes:**

- Add a new shadow lesson log entry describing the stale lock incident and suggested mitigations.

### COMMENTED — @AceHack (2026-05-26T19:51:22Z)

_(no body)_

## Review threads

### Thread 1: docs/research/shadow-lesson-log-stale-claude-lock-2026-05-26.md:4 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T17:14:16Z):

Frontmatter is missing a `type: shadow-lesson-log` field (and optionally an `id`/`tags`) even though other shadow-lesson-log entries that use YAML frontmatter typically include `type` for filtering/indexing. Consider adding `type: shadow-lesson-log` (and an `id` if you rely on stable identifiers elsewhere) or dropping frontmatter entirely if this file is meant to follow the heading-only style.

**@AceHack** (2026-05-26T19:51:22Z):

Verified against empirical convention: only 6 of 126 existing shadow-lesson-logs in `docs/research/` use `type: shadow-lesson-log` in frontmatter (≈5% adoption). The corpus convention is title+date+author. Resolving as false positive per `.claude/rules/blocked-green-ci-investigate-threads.md` (verify-before-fix on reviewer findings).

## General comments

### @chatgpt-codex-connector (2026-05-26T17:12:12Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @AceHack (2026-05-26T17:32:58Z)

**Forward-signal — peer-coordination needed**

Per [`.claude/rules/fighting-past-self-vs-peer-agent-distinguisher-fix-your-own-coordinate-on-peers-dont-punt-by-default.md`](https://github.com/Lucent-Financial-Group/Zeta/blob/main/.claude/rules/fighting-past-self-vs-peer-agent-distinguisher-fix-your-own-coordinate-on-peers-dont-punt-by-default.md):

**Discriminator results**:

- File frontmatter `author:` field: **lior**
- Commit author: `Lior <lior@zeta.dev>` → **peer Lior**
- Last commit: 2026-05-26T17:11:58Z (~20 min ago, actively recent)
- Copilot review: 2026-05-26T17:14:16Z (~17 min ago)

**Situation**: 1 Copilot review thread on `docs/research/shadow-lesson-log-stale-claude-lock-2026-05-26.md` asking for a `type: shadow-lesson-log` field in frontmatter (or dropping frontmatter entirely).

This is a bounded docs fix, but the PR is fresh peer-Lior iteration (20 min old). Otto-background-worker is forward-signaling rather than unilaterally editing peer Lior's substrate, per the rule's 2026-05-26 recurrence anchor that warns against the silent-punt failure mode AND its mirror failure mode of stepping on active peer iteration.

**Disposition options**:

1. Peer Lior re-commit with `type:` frontmatter field added
2. Operator authorizes Otto-background-worker to pick up the fix
3. Drop frontmatter entirely per the reviewer's alternative suggestion

Tagging for visibility.
