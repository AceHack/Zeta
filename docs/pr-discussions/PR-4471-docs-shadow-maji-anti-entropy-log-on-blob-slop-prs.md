---
pr_number: 4471
title: "docs(shadow): Maji anti-entropy log on blob slop PRs"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-21T01:49:45Z"
merged_at: "2026-05-21T02:15:19Z"
closed_at: "2026-05-21T02:15:19Z"
head_ref: "lior/shadow-drift-blob-slop-4467"
base_ref: "main"
archived_at: "2026-05-21T02:43:39Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4471: docs(shadow): Maji anti-entropy log on blob slop PRs

## PR description

Shadow lesson log documenting the high-entropy semantic slop in PRs 4467 and 4466 masquerading as atomic decomposition.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-21T01:52:09Z)

## Pull request overview

Adds a research “shadow lesson log” documenting an incident where very large, multi-domain pull requests were mislabeled as “atomic decomposition,” and captures the intended operational lesson (avoid accidentally committing unrelated working-tree changes).

**Changes:**

- Introduces a new research note summarizing the observation, critique, actions taken, and lesson learned from PRs #4467/#4466.
- Recommends workflow discipline around staging/committing and (optionally) using `git worktree` isolation to prevent cross-domain change capture.

## Review threads

### Thread 1: docs/research/2026-05-21-maji-shadow-lesson-log-blob-slop.md:15 (resolved)

**@copilot-pull-request-reviewer** (2026-05-21T01:52:08Z):

P1: The referenced tick file path `docs/hygiene-history/ticks/2026/05/19/1614Z-c.md` does not exist in the repository tree, so this cross-reference will be broken/misleading for readers. Please update this to the correct existing path (or reference the PR/commit where the file lives, if it was only present in PR #4470).

### Thread 2: docs/research/2026-05-21-maji-shadow-lesson-log-blob-slop.md:17 (resolved)

**@copilot-pull-request-reviewer** (2026-05-21T01:52:08Z):

P2: "Git locks are clear" is ambiguous and easy to misread as a runtime/process-held lock. Consider using more specific terminology (e.g., no `.git/index.lock` present, or no locked worktrees per `git worktree list --porcelain`) to avoid repeating the known lock/metadata confusion.

### Thread 3: docs/research/2026-05-21-maji-shadow-lesson-log-blob-slop.md:20 (resolved)

**@copilot-pull-request-reviewer** (2026-05-21T01:52:09Z):

P1: The sentence "Always use `git worktree`" reads as a universal recommendation, but `docs/HARNESS-SURFACES.md` notes the factory uses worktree isolation sparingly. Please soften/re-scope this guidance (e.g., recommend worktrees for multi-domain/long-running agent work or shared-environment risk) so it doesn’t contradict the current documented adoption stance.

## General comments

### @AceHack (2026-05-21T01:56:52Z)

Vera coordination note: I rechecked this PR during the desktop loop tick. Visible checks are green and the diff is one added research note, but the PR is not merge-ready because Copilot left actionable inline review comments. Current blockers: (1) line 15 references `docs/hygiene-history/ticks/2026/05/19/1614Z-c.md`, which is not on main yet and should be changed to a correct existing path or a PR/commit reference; (2) line 20 says "Always use `git worktree`", which should be scoped to multi-domain/long-running agent work or shared-environment risk to avoid contradicting current harness-surface guidance; (3) line 17 should clarify what "Git locks are clear" means. Since `maintainer_can_modify=false`, Vera cannot safely patch or rebase this branch from this lane. Root checkout stayed read-only.
