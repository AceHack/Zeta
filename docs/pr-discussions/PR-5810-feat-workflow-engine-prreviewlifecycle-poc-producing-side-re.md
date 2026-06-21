---
pr_number: 5810
title: "feat(workflow-engine): PrReviewLifecycle PoC \u2014 producing-side review work substrate (Aaron 'does it give you time to look at prs and put comments'); 18 tests pass"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-28T13:10:47Z"
merged_at: "2026-05-28T13:44:20Z"
closed_at: "2026-05-28T13:44:20Z"
head_ref: "otto-cli/b-0867-pr-review-lifecycle-poc-substrate-naming-substrate-producing-side-review-work-companion-to-b-0867-20-receiving-side-aaron-2026-05-28"
base_ref: "main"
archived_at: "2026-05-28T14:13:01Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5810: feat(workflow-engine): PrReviewLifecycle PoC — producing-side review work substrate (Aaron 'does it give you time to look at prs and put comments'); 18 tests pass

## PR description

Per Aaron 2026-05-28: AutoLoopLifetime (PR #5805) only models SHIP work, not REVIEW work. This DU makes producing-side review-substrate explicit.

## PrReviewLifecycle (7 variants)

observe → identify-finding → compose → **verify-finding** (grep substrate-anchor before posting) → post → follow-up → conclude

## ReviewFindingKind taxonomy (8 shapes)

bug / design-question / substrate-engineering-suggestion / naming-improvement / test-gap / substrate-honest-praise / documentation-gap / composes-with-substrate

## Composes with

- 081KSNY2Z0008QG0R003WFDCJ9 ReviewLifetime (PR #5758; receiving-side; sibling)
- AutoLoopLifetime (PR #5805; will integrate)
- fighting-past-self-vs-peer-agent + asymmetric-authorship + honor-those-that-came-before + grep-substrate-anchors

**18 tests pass / 0 fail.**

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-28T13:14:25Z)

## Pull request overview

Adds a new workflow-engine PoC substrate for **producing-side PR review work** (as distinct from receiving-side review gates), modeling review as a small lifecycle DU with a dispatch function and accompanying invariants/tests.

**Changes:**
- Introduces `PrReviewLifecycle` + `ReviewFindingKind`/`ReviewFinding` data shapes for producing-side review work.
- Adds `dispatchPrReviewTransition` plus small helper exports (`PR_REVIEW_LIFECYCLE_UNIVERSE`, `isPeerAgentTerritory`, `newReviewContext`).
- Adds Bun tests covering the lifecycle universe and main transition paths.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 4 comments.

| File | Description |
| ---- | ----------- |
| tools/workflow-engine/pr-review-lifecycle.ts | New producing-side review lifecycle DU, finding taxonomy, transition dispatcher, and helpers. |
| tools/workflow-engine/pr-review-lifecycle.test.ts | New invariant/unit tests for the review lifecycle and helpers. |

## Review threads

### Thread 1: tools/workflow-engine/pr-review-lifecycle.ts:10 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:14:24Z):

This is a current-state code surface, but it includes direct personal-name attribution (e.g., “Per Aaron …”) and also introduces a name-coded lane value (`"human-aaron"` in `authorLane`). Per the repo’s “No name attribution in code, docs, or skills” rule (docs/AGENT-BEST-PRACTICES.md:671+), please rewrite these to role-refs (e.g., “the human maintainer”) and use a role-based lane identifier rather than a name.

### Thread 2: tools/workflow-engine/pr-review-lifecycle.ts:113 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:14:24Z):

`PrReviewFeedback`’s `PeerAgentTerritory` uses `lane: string`, which loses the type-safety of `ReviewContext["authorLane"]` and can drift from the allowed lane universe over time. Prefer typing this as `lane: ReviewContext["authorLane"]` (or extracting a shared `AuthorLane` alias) so feedback and context stay consistent.

### Thread 3: tools/workflow-engine/pr-review-lifecycle.test.ts:35 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:14:25Z):

Several “happy path” tests only assert inside `if (r.ok) { ... }` without first asserting that `r.ok` is `true`. If the implementation accidentally returns `ok: false`, these tests will pass vacuously. Add `expect(r.ok).toBe(true)` (or an `else` that fails) before asserting on `r.outcome`.

### Thread 4: tools/workflow-engine/pr-review-lifecycle.ts:187 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:14:25Z):

In `verify-finding`, the transition can advance to `post` even when `context.findings` is empty, and it only validates `context.findings[0]` (ignoring additional findings). It also treats a missing `substrateAnchors` as “substantiated” (it only fails when the array is present but empty), which undermines the “verify before posting” contract. Consider (a) failing fast with `NoActionableFinding` when there are no findings, and (b) validating the specific finding(s) intended for posting, requiring anchors to be present + non-empty (or making exemptions explicit by kind).

## General comments

### @chatgpt-codex-connector (2026-05-28T13:10:54Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
