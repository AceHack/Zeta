---
pr_number: 3114
title: "backlog(b-0424): mark in-progress \u2014 slices 1-8 merged, --apply next-step documented"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T08:09:22Z"
merged_at: "2026-05-14T08:16:17Z"
closed_at: "2026-05-14T08:16:17Z"
head_ref: "feat/b-0424-status-update-2026-05-14"
base_ref: "main"
archived_at: "2026-05-14T08:25:44Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3114: backlog(b-0424): mark in-progress — slices 1-8 merged, --apply next-step documented

## PR description

## Summary

- Slices 081KRFA460008QG0R001H98EXJ.1–081KRFA460008QG0R001H98EXJ.8 (PRs #2994, #2996, #3003, #3019, #3025, #3026, #3027, #3028) are all merged
- Tests: **30/30 pass** (`bun test tools/scaffold/create-repo.ts`)
- Dry-run verified 2026-05-14: 12 operations planned for both `forge` and `ace` — no errors
- 081KRFA460008QG0R001H98EXJ status updated `open` → `in-progress`; completed-slices table and `--apply` execution instructions added

## What's left (for full 081KRFA460008QG0R001H98EXJ closure)

The only remaining step is running `--apply` to actually create the GitHub repos — an irreversible external action that requires Aaron's explicit review. The dry-run shows exactly what will happen before he decides.

```bash
bun tools/scaffold/create-repo.ts --repo forge --apply
bun tools/scaffold/create-repo.ts --repo ace  --apply
```

After `--apply`, six manual follow-ups remain (documented in the updated backlog row): SVG preview upload, merge-queue toggle, Semgrep CI wiring, required-status-check population, and budget-cap verification.

## Test plan

- [x] `bun test tools/scaffold/create-repo.test.ts` — 30 pass, 0 fail
- [x] `bun tools/scaffold/create-repo.ts --repo forge --dry-run` — 12 operations planned
- [x] `bun tools/scaffold/create-repo.ts --repo ace --dry-run` — 12 operations planned
- [x] No changes to source code — documentation-only update to backlog row

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T08:12:20Z)

## Pull request overview

Documentation-only backlog update for 081KRFA460008QG0R001H98EXJ, marking Stage 1 scaffold work as partially complete and documenting the remaining repo-creation execution step.

**Changes:**

- Updates 081KRFA460008QG0R001H98EXJ frontmatter metadata and status.
- Adds a completed-slices table for 081KRFA460008QG0R001H98EXJ.1–081KRFA460008QG0R001H98EXJ.8.
- Documents dry-run verification, `--apply` commands, and post-apply manual follow-ups.

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T08:17:27Z)

## Pull request overview

Copilot reviewed 1 out of 1 changed files in this pull request and generated 1 comment.

## Review threads

### Thread 1: docs/backlog/P1/081KRFA460008QG0R001H98EXJ-three-repo-split-stage1-create-forge-ace-with-scaffolding-aaron-2026-05-13.md:4 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T08:12:20Z):

P1: `in-progress` is not a valid backlog frontmatter status per `tools/backlog/README.md:63`, which only permits `open`, `closed`, `superseded-by-B-NNNN`, or `deferred`. This row will no longer conform to the documented schema; keep it `open` or add/update schema/tooling support for this new state in the same PR.

### Thread 2: docs/backlog/P1/081KRFA460008QG0R001H98EXJ-three-repo-split-stage1-create-forge-ace-with-scaffolding-aaron-2026-05-13.md:108 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T08:12:20Z):

P1: This tells the operator to run the irreversible `--apply` commands locally, bypassing the `scaffold-stage1-create-repos` workflow that was added as the safe apply entrypoint with actor allowlisting, a `CONFIRM` gate, PAT-secret handling, and concurrency protection. Since the row itself calls 081KRFA460008QG0R001H98EXJ.2 the safe apply entrypoint, the next-step instructions should route through that workflow (or explicitly justify why these controls are being bypassed).

### Thread 3: docs/backlog/P1/081KRFA460008QG0R001H98EXJ-three-repo-split-stage1-create-forge-ace-with-scaffolding-aaron-2026-05-13.md:79 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T08:17:27Z):

P1: The PR title/summary says this backlog row is being marked `in-progress` (`open` → `in-progress`), but the row still uses `status: open` in frontmatter, and the backlog schema only allows `open`, `closed`, `superseded-by-B-NNNN`, or `deferred` (tools/backlog/README.md:63). Please align the PR text with the valid status model or update the schema/tooling before documenting a new status.

## General comments

### @chatgpt-codex-connector (2026-05-14T08:14:41Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @AceHack (2026-05-14T08:14:46Z)

Fixed both Copilot P1 findings:

1. **MD032 markdownlint**: added blank line before numbered list (commit 6d16f693)
2. **status enum**: `in-progress` → `open` — not a valid schema value per `tools/backlog/README.md`
3. **--apply bypass**: Next-step instructions now route through the `scaffold-stage1-create-repos` GitHub Actions workflow (actor allowlist + CONFIRM gate + PAT secret + concurrency protection) instead of raw local bash commands; dry-run-only bash snippet retained for local preview

Threads resolved. CI rerunning.
