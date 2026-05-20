---
pr_number: 4380
title: "feat(B-0590): decompose slice 5 - bare-metal install automation (B-0672)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-19T16:11:39Z"
merged_at: "2026-05-19T16:13:07Z"
closed_at: "2026-05-19T16:13:07Z"
head_ref: "lior/decompose-b0590-slice5"
base_ref: "main"
archived_at: "2026-05-19T16:30:47Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4380: feat(B-0590): decompose slice 5 - bare-metal install automation (B-0672)

## PR description

Peeled off slice 5 from B-0590. Lior anti-entropy.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-19T16:15:17Z)

## Pull request overview

This PR adds a new P2 backlog row for B-0672 (“B-0590 slice 5: Bare-metal install automation”) and updates the generated backlog index to include it.

**Changes:**
- Added `docs/backlog/P2/B-0672-b0590-slice5-bare-metal-install-automation.md` with frontmatter + scope/success criteria.
- Updated `docs/BACKLOG.md` to list the new B-0672 row under P2.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 2 comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P2/B-0672-b0590-slice5-bare-metal-install-automation.md | New per-row backlog item describing the “slice 5” bare-metal install automation scope. |
| docs/BACKLOG.md | Adds the B-0672 entry to the P2 index list. |


<details>
<summary>Comments suppressed due to low confidence (1)</summary>

**docs/backlog/P2/B-0672-b0590-slice5-bare-metal-install-automation.md:11**
* P2: `composes_with` repeats `B-0590` which is already listed in `depends_on`. `tools/backlog/lint-frontmatter.ts` flags this as a redundant edge; keep the stronger `depends_on` edge and drop the duplicate from `composes_with` (or vice versa if it’s not actually a hard prerequisite).
```
depends_on: [B-0590, B-0671]
composes_with: [B-0590]
```
</details>

## Review threads

### Thread 1: docs/backlog/P2/B-0672-b0590-slice5-bare-metal-install-automation.md:7 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-19T16:15:16Z):

P1: `effort` value `M-L` doesn’t match the documented backlog schema (`effort` is `S`/`M`/`L` per tools/backlog/README.md). Please switch to a single size (or omit the field) so downstream tooling and human triage stay consistent.

This issue also appears on line 10 of the same file.

### Thread 2: docs/backlog/P2/B-0672-b0590-slice5-bare-metal-install-automation.md:11 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-19T16:15:16Z):

P1: `depends_on` references `B-0590` and `B-0671`, but there are no corresponding backlog row files/IDs in `docs/backlog/**` (and no entries in `docs/BACKLOG.md`). Either add those rows in this PR, or remove/adjust these references so dependencies point only at existing rows.
