---
pr_number: 4453
title: "docs(shadow): Maji anti-entropy finding + PR preservation"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-20T21:45:05Z"
merged_at: "2026-05-20T22:50:58Z"
closed_at: "2026-05-20T22:50:58Z"
head_ref: "maji/shadow-log-and-preservation-1850Z"
base_ref: "main"
archived_at: "2026-05-20T23:06:43Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4453: docs(shadow): Maji anti-entropy finding + PR preservation

## PR description

Entropy reduction and memory curation. Bypassing git worktree due to lock contention.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-20T21:47:32Z)

## Pull request overview

Adds new documentation artifacts to preserve recent “shadow” findings and PR discussion transcripts, aligning with the repo’s PR-preservation and research-history practices while working around local git lock contention.

**Changes:**

- Added a new shadow lesson log capturing an anti-entropy finding from the 18:30Z–18:50Z window.
- Added PR discussion archive markdown for PRs #4447, #4448, #4449, and #4450 (frontmatter + preserved narrative/review snapshots).
- Updated the preserved metadata timestamp (`archived_at`) for the existing PR #4446 archive entry.

### Reviewed changes

Copilot reviewed 6 out of 6 changed files in this pull request and generated no comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| docs/research/2026-05-20-shadow-lesson-log-maji-anti-entropy-1850Z.md | New shadow lesson log research artifact documenting the anti-entropy finding/remediation notes. |
| docs/pr-discussions/PR-4450-fix-bg-notifier-test-platform-independent-path-assertions.md | Adds preserved PR #4450 discussion transcript (metadata + summary). |
| docs/pr-discussions/PR-4449-feat-bg-notifier-b-0501-slice-5a-assignment-history-cooldown.md | Adds preserved PR #4449 discussion transcript (metadata + preserved review/triage threads). |
| docs/pr-discussions/PR-4448-docs-shadow-lior-anti-entropy-report-on-tool-blindness-induc.md | Adds preserved PR #4448 discussion transcript (metadata + review snapshot). |
| docs/pr-discussions/PR-4447-docs-archive-lior-pr-preservation-batch-4446-4442.md | Adds preserved PR #4447 discussion transcript (metadata + review snapshot). |
| docs/pr-discussions/PR-4446-docs-shard-tick-1807z-fresh-session-cold-boot-under-multi-co.md | Updates `archived_at` timestamp in the preserved PR #4446 archive entry. |
</details>

## General comments

### @AceHack (2026-05-20T21:45:34Z)

Vera triage 2026-05-20T21:45Z: owner-only PENDING CI.

I kept the contested root checkout read-only. Live local state still shows the stale May 18 `.git/index.lock`, 103 locked worktree markers, 304 registered worktrees, and active root git maintenance/repack/pack-objects processes. The root dirty count is now 310; I did not write there. Paginated REST currently sees 206 open PRs.

Current #4453 state:

- head `1ed02ef44c5c1e7149cbcf7c830e68565a082310` on `maji/shadow-log-and-preservation-1850Z`
- `maintainer_can_modify=false`
- REST `mergeable=true`, `mergeable_state=blocked`
- GraphQL `MERGEABLE`
- no review threads or review comments visible yet
- CI is still queued/running across CodeQL, Agent/Prepare, path gate, submit-nuget, CodeQL language analyses, and most lint jobs; only `matrix setup` is complete success at this recheck.

Next toe-safe action: wait for #4453's jobs and review to finish, then owner/maintainer can patch any resulting blockers or merge if all gates pass and the preservation/shadow content is intended to land as-is.

### @AceHack (2026-05-20T21:48:38Z)

Vera recheck 2026-05-20T21:49Z: owner-ready, all visible gates green.

I kept the contested root checkout read-only. Live local state still shows the stale May 18 `.git/index.lock`, 103 locked worktree markers, 304 registered worktrees, and active root git maintenance/repack/pack-objects processes. The root dirty count remains 310; I did not write there. Paginated REST currently sees 206 open PRs.

Current #4453 state:

- head `1ed02ef44c5c1e7149cbcf7c830e68565a082310` on `maji/shadow-log-and-preservation-1850Z`
- `maintainer_can_modify=false`
- REST `mergeable=true`, `mergeable_state=clean`
- GraphQL `MERGEABLE`
- all visible check-runs completed `success`/`skipped`
- no review threads or review comments visible

Next toe-safe action: owner/maintainer can merge #4453 if the preservation/shadow content is intended to land as-is.
