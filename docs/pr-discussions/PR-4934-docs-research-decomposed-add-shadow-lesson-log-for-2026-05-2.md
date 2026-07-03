---
pr_number: 4934
title: "docs(research): DECOMPOSED - add shadow lesson log for 2026-05-24 (from #4817)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T13:47:56Z"
merged_at: "2026-05-25T14:37:19Z"
closed_at: "2026-05-25T14:37:19Z"
head_ref: "lior-atomic-shadow-log-4817"
base_ref: "main"
archived_at: "2026-05-27T19:50:12Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4934: docs(research): DECOMPOSED - add shadow lesson log for 2026-05-24 (from #4817)

## PR description

This PR is a decomposition of #4817, containing only the shadow lesson log.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T13:50:09Z)

## Pull request overview

Adds a new research “shadow lesson log” documenting the purpose and operational value of the `deferred-to-human` label, as a decomposed subset of #4817.

**Changes:**

- Add a 2026-05-24 shadow lesson log describing when/why to use the `deferred-to-human` label.
- Capture implications for agent behavior around deferral and sensitive-data scenarios.

## Review threads

### Thread 1: docs/research/2026-05-24-shadow-lesson-log.md:7 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T13:50:09Z):

The summary cites PRs `#4730` and `#4727` and says the `deferred-to-human` label was applied to this cluster, but the repo’s 2026-05-24 triage substrate appears to identify the privacy PRs as `#4733/#4735/#4737/#4739` (docs/hygiene-history/ticks/2026/05/24/0441Z.md), while the only explicitly documented `deferred-to-human` application that day is to PR `#4816` (docs/hygiene-history/ticks/2026/05/24/1333Z.md). Please adjust the referenced PR numbers and/or the claim about which PR(s) were labeled so this log matches the recorded substrate.

## General comments

### @AceHack (2026-05-25T13:52:37Z)

@copilot, this PR is a clean decomposition of #4817. The change is atomic and the checks are passing. Ready for final review and merge.

### @AceHack (2026-05-25T14:35:25Z)

Copilot finding verified real per direct inspection of cited substrate (`docs/hygiene-history/ticks/2026/05/24/0441Z.md` + `1333Z.md`).

Fixed in `cf522cae` via REST API bypass (avoids worktree pack-dir contention with 3-proc Lior peer activity per `.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md`):

- PR numbers corrected: `#4730/#4727` → `#4733/#4735/#4737/#4739` (Class A privacy cluster per 0441Z)
- `deferred-to-human` label scope corrected: only #4816 received the label (1333Z); privacy cluster left for authoring lane to address
- Added explicit anchors to both tick shards

Per `.claude/rules/blocked-green-ci-investigate-threads.md` verify-before-fix discipline.

Co-Authored-By: Claude <noreply@anthropic.com>
