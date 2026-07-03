---
pr_number: 3721
title: "rule(verify-reviewer-findings): extend blocked-green-ci rule with verify-before-fix discipline"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T03:55:03Z"
merged_at: "2026-05-16T04:02:35Z"
closed_at: "2026-05-16T04:02:35Z"
head_ref: "rule/verify-reviewer-findings-otto-cli-2026-05-16"
base_ref: "main"
archived_at: "2026-05-16T04:14:54Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3721: rule(verify-reviewer-findings): extend blocked-green-ci rule with verify-before-fix discipline

## PR description

Extends `.claude/rules/blocked-green-ci-investigate-threads.md` with verify-before-fix discipline + a suspect-by-default Copilot finding list.

Empirical evidence from the 2026-05-16 autonomous session: 4 confirmed false positives on Copilot's table double-pipe (`||`) hallucination class. Threshold for entry: 2+ FPs across distinct PRs.

Also captures the stale-but-fresh-looking finding class (sibling-PR self-healing, write-time-accurate prose) — resolve no-op.

Discovered while authoring: my new `check-shard-before-push.ts` helper flags bullet-continuation lines as MD032 false positives. Filing as next-tick fix for the helper itself.

Co-Authored-By: Claude <noreply@anthropic.com>

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T03:56:41Z)

## Pull request overview

This PR updates the factory rule for diagnosing “BLOCKED with green required CI” to add a verify-before-fix discipline for reviewer-thread findings, including an empirical “suspect-by-default” list for known false-positive classes and guidance for handling stale-but-previously-true findings.

**Changes:**

- Add a “verify-before-fix” step after surfacing unresolved review threads to reduce wasted fixes/regressions from hallucinated findings.
- Introduce an empirical suspect-by-default list (currently the table-pipe false-positive class) with a threshold for inclusion.
- Document how to resolve stale-but-fresh-looking findings as no-ops when the underlying state self-heals.

## Review threads

### Thread 1: .claude/rules/blocked-green-ci-investigate-threads.md:35 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T03:56:41Z):

P0: The `awk` one-liner won’t print anything as written because `NR==N` compares to an uninitialized awk variable (`N` defaults to 0). Update the snippet to show how `N` is supplied (e.g., via `-v N=<line>` or `N=<line>` on the awk command line) so the “direct line-level inspection” anchor is runnable.

### Thread 2: .claude/rules/blocked-green-ci-investigate-threads.md:38 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T03:56:41Z):

P1: `git log <PR-cited-PR>` is not a valid way to confirm a referenced PR (git log expects commits/refs/paths, not a PR number). Consider replacing this with a concrete, runnable command that maps PR → commit range (e.g., using `gh pr view`/`gh api` to fetch the merge commit SHA, or a `git log --grep '#<N>'` pattern if that’s the intended workflow).
