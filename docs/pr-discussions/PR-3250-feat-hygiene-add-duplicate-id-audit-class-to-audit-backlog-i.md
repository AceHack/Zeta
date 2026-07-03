---
pr_number: 3250
title: "feat(hygiene): add duplicate-ID audit class to audit-backlog-items.ts"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T21:17:33Z"
merged_at: "2026-05-14T21:20:12Z"
closed_at: "2026-05-14T21:20:12Z"
head_ref: "otto/audit-backlog-duplicate-ids-2026-05-14"
base_ref: "main"
archived_at: "2026-05-14T21:31:41Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3250: feat(hygiene): add duplicate-ID audit class to audit-backlog-items.ts

## PR description

## Summary

Adds an 8th audit class to [`tools/hygiene/audit-backlog-items.ts`](tools/hygiene/audit-backlog-items.ts) that detects multiple per-row files claiming the same `id: B-NNNN` — a factory-wide uniqueness violation per `tools/backlog/README.md`.

## Why now

PR [#3247](https://github.com/Lucent-Financial-Group/Zeta/pull/3247)'s review surfaced the issue: Copilot caught two files both claiming `id: 081KR2E4K0008QG0R001F0YB5S`. The collision was renumbered out-of-band, but the audit-time gap remained — no automated check would have caught the collision at author-time. This commit closes that gap by extending the existing audit tool.

## Output format

Mirrors the sibling `report*` functions in the same file:

```text
## 8. Duplicate IDs (factory-wide uniqueness violation)
**Duplicate-ID groups: N**
### B-NNNN (M files claim this ID)
  - <path1> (tier=Px, status=...)
  - <path2> ...
Resolution: renumber all-but-one ... + renumbered_from breadcrumb
```

Summary block also gets a new line: `Duplicate-ID groups: N`.

## Verifies live

When run today on `origin/main` branch (before [#3247](https://github.com/Lucent-Financial-Group/Zeta/pull/3247) merges):

```text
## 8. Duplicate IDs (factory-wide uniqueness violation)

**Duplicate-ID groups: 1**

### 081KR2E4K0008QG0R001F0YB5S (2 files claim this ID)
  - docs/backlog/P1/081KR2E4K0008QG0R001F0YB5S-new-surface-audit-alignment-check.md (tier=P1, status=open)
  - docs/backlog/P1/081KR2E4K0008QG0R001F0YB5S-claude-md-as-process-not-doctrine.md (tier=P1, status=open)
```

Once #3247 merges (renaming the new file to 081KRHWGX0008QG0R003N033PD), the audit will report 0 duplicate-ID groups.

## Pattern compliance

Extends the existing tool per [`skill-router-as-substrate-inventory.md`](.claude/rules/skill-router-as-substrate-inventory.md): "extend or correct it instead of duplicating." `audit-backlog-items.ts` already audited 7 ID-integrity classes (broken edges, orphan rows, top-blocked, etc.); the 8th composes naturally.

## Test plan

- [x] `bun tools/hygiene/audit-backlog-items.ts` runs cleanly (audit completes)
- [x] Duplicate-ID class fires correctly on the current main state (1 group: 081KR2E4K0008QG0R001F0YB5S)
- [x] `tsc --noEmit` clean
- [x] Summary line surfaces in the output
- [x] Composite branch-guard + `gh pr create --head` used
- [ ] CI clears
- [ ] Auto-merge

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T21:18:38Z)

## Pull request overview

Adds an 8th audit class to `tools/hygiene/audit-backlog-items.ts` that detects duplicate `id: B-NNNN` claims across per-row backlog files, closing an audit-time gap surfaced by PR #3247.

**Changes:**

- New `reportDuplicateIds` function groups rows by `id` and reports collisions with resolution guidance.
- Wired into `main()` and added a `Duplicate-ID groups: N` line to the summary block.
- Header comment updated to document audit class #8.
