---
pr_number: 5894
title: "docs(research): Add shadow lesson log on worktree hygiene"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-28T17:29:07Z"
merged_at: "2026-05-28T19:34:38Z"
closed_at: "2026-05-28T19:34:38Z"
head_ref: "lior/drift-report-worktree-hygiene"
base_ref: "main"
archived_at: "2026-05-28T19:39:58Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5894: docs(research): Add shadow lesson log on worktree hygiene

## PR description

This PR adds a shadow lesson log entry detailing the discovery of excessive stale git worktrees and recommends corrective actions.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-28T17:32:04Z)

## Pull request overview

This PR adds a research shadow lesson log documenting stale git worktree accumulation and proposing operational cleanup discipline.

**Changes:**

- Adds a new `docs/research` lesson log for the 2026-05-28 worktree hygiene incident.
- Describes observed impact, hypothesized root cause, and recommended lifecycle cleanup steps.

### COMMENTED — @copilot-pull-request-reviewer (2026-05-28T19:32:57Z)

Copilot encountered an error and was unable to review this pull request. You can try again by re-requesting a review.

## Review threads

### Thread 1: docs/research/shadow-lesson-log-worktree-hygiene-2026-05-28.md:29 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T17:32:03Z):

P1: This guidance conflicts with the current worktree hygiene rule, which requires agent worktrees under `~/.zeta/agents/<persona>/<stream-id>/` and explicitly forbids `/tmp`, `/private/tmp`, and the operator's primary repo. Reword this to name the canonical persistent per-persona location instead of a generic temporary location so the lesson does not preserve outdated placement guidance.

### Thread 2: docs/research/shadow-lesson-log-worktree-hygiene-2026-05-28.md:31 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T17:32:04Z):

P1: Recommending `--force` as the preferred cleanup path contradicts the repository's worktree force-remove guard and can discard uncommitted peer or in-flight agent work. Make plain `git worktree remove <path>` the default, and reserve `--force` only after an explicit clean/ownership or handoff check.

## General comments

### @chatgpt-codex-connector (2026-05-28T17:29:13Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @AceHack (2026-05-28T19:31:14Z)

Addressed Copilot threads:

- **`--force` cleanup guidance** (thread 2): fixed in `8b1868c` — softened the recommendation to align with the force-remove guard in `.claude/rules/claim-acquire-before-worktree-work.md` (a stale-looking worktree may be peer in-flight state; prefer a fresh worktree at a distinct path). This prevents the note from propagating a pattern the framework carved against.
- **Worktree location** (thread 1): this is a write-time research observation ("designated, temporary location"); the canonical `~/.zeta/agents/<persona>/<stream-id>/` location lives in `.claude/rules/agent-worktree-hygiene-...` and is the normative source. Genre-appropriate; the observation is not normative guidance.
