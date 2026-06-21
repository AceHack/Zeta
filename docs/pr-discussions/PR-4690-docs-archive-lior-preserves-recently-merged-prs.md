---
pr_number: 4690
title: "docs(archive): Lior preserves recently merged PRs"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-22T22:24:54Z"
merged_at: "2026-05-22T23:40:25Z"
closed_at: "2026-05-22T23:40:25Z"
head_ref: "lior/archive-batch-20260522"
base_ref: "main"
archived_at: "2026-05-22T23:49:30Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4690: docs(archive): Lior preserves recently merged PRs

## PR description

This PR preserves the discussion and changes from recently merged PRs.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-22T22:27:15Z)

## Pull request overview

This PR adds a batch of preserved PR-discussion archive files under `docs/pr-discussions/`, capturing metadata + summary/test-plan content for a set of recently merged PRs.

**Changes:**
- Add new PR-discussion preservation markdown files (YAML frontmatter + archived content) for PRs #4591–#4598 and #4660–#4687.
- Record the preserved PR metadata (timestamps, refs, tool provenance) and the archived narrative content for traceability.

### Reviewed changes

Copilot reviewed 17 out of 17 changed files in this pull request and generated 1 comment.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| docs/pr-discussions/PR-4687-shard-tick-2215z-otto-cli-cold-boot-pr-4668-thread-triage.md | Adds preserved archive for PR #4687 (thread triage record). |
| docs/pr-discussions/PR-4681-feat-b-0170-extend-check-self-recursive-ts-with-existence-to.md | Adds preserved archive for PR #4681 (081KQNJ500008QG0R003SCWBDV existence-topic dispatch). |
| docs/pr-discussions/PR-4676-feedback-aaron-amazon-alexa-hardware-skill-connector-store-a.md | Adds preserved archive for PR #4676 (feedback preservation). |
| docs/pr-discussions/PR-4675-persona-alexa-speaker-2026-05-22-family-layout-shared-map-sp.md | Adds preserved archive for PR #4675 (persona archive). |
| docs/pr-discussions/PR-4671-memory-vera-preserve-family-configuration-language-calibrati.md | Adds preserved archive for PR #4671 (memory preservation + prior review thread capture). |
| docs/pr-discussions/PR-4669-persona-amara-agenda-encryption-amara-ratification-2026-05-2.md | Adds preserved archive for PR #4669 (persona + agenda archive). |
| docs/pr-discussions/PR-4667-memory-persona-otto-otto-desktop-integration-of-aaron-s-2026.md | Adds preserved archive for PR #4667 (persona memory archive + embedded review summary). |
| docs/pr-discussions/PR-4664-persona-prism-ratification-archive-2026-05-23-operator-pipel.md | Adds preserved archive for PR #4664 (persona ratification archive). |
| docs/pr-discussions/PR-4661-persona-alexa-website-ratification-archive-2026-05-23-day-su.md | Adds preserved archive for PR #4661 (persona ratification archive). |
| docs/pr-discussions/PR-4660-personas-with-opaque-pointer-family-discipline-applied-kestr.md | Adds preserved archive for PR #4660 (multi-persona archive + embedded external review thread). |
| docs/pr-discussions/PR-4598-memory-substrate-honest-correction-append-continuation-to-20.md | Adds preserved archive for PR #4598 (follow-up preservation note). |
| docs/pr-discussions/PR-4597-memory-aaron-ani-grok-text-mode-2026-05-22-kestrel-pattern-c.md | Adds preserved archive for PR #4597 (memory preservation + embedded review thread). |
| docs/pr-discussions/PR-4595-tick-1208z-orphaned-branch-verification-b-0623-adinkras-ecc.md | Adds preserved archive for PR #4595 (tick shard preservation + embedded review thread). |
| docs/pr-discussions/PR-4594-memory-kestrel-s-third-argument-was-you-think-weird-pattern.md | Adds preserved archive for PR #4594 (memory preservation + embedded review thread). |
| docs/pr-discussions/PR-4593-memory-8-oracle-convergence-table-multi-oracle-bft-at-engage.md | Adds preserved archive for PR #4593 (memory preservation + embedded review thread). |
| docs/pr-discussions/PR-4592-memory-kestrel-session-resolution-precise-conjunction-for-fu.md | Adds preserved archive for PR #4592 (memory preservation + embedded review thread). |
| docs/pr-discussions/PR-4591-backlog-b-0704-secret-message-over-reticulum-via-spectre-til.md | Adds preserved archive for PR #4591 (backlog row preservation + embedded review thread). |
</details>

### COMMENTED — @AceHack (2026-05-22T23:40:09Z)

_(no body)_

## Review threads

### Thread 1: docs/pr-discussions/PR-4681-feat-b-0170-extend-check-self-recursive-ts-with-existence-to.md:21 (resolved)

**@copilot-pull-request-reviewer** (2026-05-22T22:27:15Z):

P1/xref: This relative link uses `../blob/main/...`, which from `docs/pr-discussions/` resolves to `docs/blob/main/...` (nonexistent) and will 404 in rendered markdown. Point it either to the repo file via a docs-relative path (e.g., `../backlog/P1/...`) or use the full GitHub URL.

**@AceHack** (2026-05-22T23:40:09Z):

No-op resolve per `.claude/rules/substrate-or-it-didnt-happen.md` strike-don't-annotate / verbatim-preservation discipline.

This file is an archive of PR #4681's body. The `../blob/main/...` relative link is verbatim from the original PR description, where it renders correctly (GitHub PR-body markdown resolves `..` against the repo root, so `../blob/main/docs/backlog/...` → `<repo>/blob/main/docs/backlog/...`, a valid URL). In the file-tree archive context, the same string resolves to `docs/blob/main/...` and 404s. The archive preserves the original verbatim; rendering breakage in the file-tree-render context is a known cost of preservation, not a content bug to edit.
