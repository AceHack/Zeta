---
pr_number: 5174
title: "docs(archive): preserve PR discussions batch 1"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T13:30:03Z"
merged_at: "2026-05-26T16:00:38Z"
closed_at: "2026-05-26T16:00:38Z"
head_ref: "lior/preserve-batch-1"
base_ref: "main"
archived_at: "2026-05-27T19:39:31Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5174: docs(archive): preserve PR discussions batch 1

## PR description

This PR preserves the discussions for a batch of recently merged PRs, following the preservation discipline.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T13:34:28Z)

## Pull request overview

This PR adds new `docs/pr-discussions/` archive entries for recently merged PRs (batch 1), preserving their descriptions/reviews/threads as durable history substrate.

**Changes:**

- Add new PR discussion archives for PRs #5126–#5129.
- Update the existing PR #5134 archive metadata and rewrite several rule links.

### Reviewed changes

Copilot reviewed 5 out of 5 changed files in this pull request and generated 2 comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| docs/pr-discussions/PR-5134-rule-refresh-before-decide-extends-to-working-tree-reads-100.md | Updates `archived_at` and rewrites several `.claude/rules/*` links (currently makes them non-navigable from the archive location). |
| docs/pr-discussions/PR-5129-backlog-b-0806-iter-7-p2-ansible-gitops-crossplane-compositi.md | New preserved discussion archive for PR #5129. |
| docs/pr-discussions/PR-5128-fix-b-0058-filter-gate-log-test-no-longer-pollutes-productio.md | New preserved discussion archive for PR #5128. |
| docs/pr-discussions/PR-5127-docs-b-0798-add-classifier-bypass-research-boundary.md | New preserved discussion archive for PR #5127. |
| docs/pr-discussions/PR-5126-rule-2-wake-time-substrate-lessons-from-session-2026-05-26-d.md | New preserved discussion archive for PR #5126. |
</details>

## Review threads

### Thread 1: docs/pr-discussions/PR-5134-rule-refresh-before-decide-extends-to-working-tree-reads-100.md:45 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T13:34:27Z):

P1/xref: These links were changed to `.claude/rules/...`, which (when rendered from `docs/pr-discussions/`) resolves to `docs/pr-discussions/.claude/...` and will 404 because `.claude/` lives at the repo root. Use a repo-root-absolute target like `/.claude/rules/zeta-expected-branch.md` and `/.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md` (or a full GitHub URL) so the preserved archive stays navigable.

### Thread 2: docs/pr-discussions/PR-5134-rule-refresh-before-decide-extends-to-working-tree-reads-100.md:56 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T13:34:27Z):

P1/xref: The `.claude/rules/...` link targets here are directory-relative from `docs/pr-discussions/`, so they resolve to `docs/pr-discussions/.claude/...` (nonexistent) and won’t open on GitHub. Prefer repo-root-absolute links (e.g., starting with `/.claude/rules/...`) or full `https://github.com/.../blob/...` URLs for durable archive citations.

## General comments

### @chatgpt-codex-connector (2026-05-26T13:30:10Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @AceHack (2026-05-26T15:58:31Z)

Addressed: converted relative `.claude/rules/...` links to `../../.claude/rules/...` (relative-up-two from `docs/pr-discussions/`), which renders correctly on GitHub. Both line 45 + 56 references plus all other occurrences in the file fixed in latest commit.
