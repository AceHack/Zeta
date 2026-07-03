---
pr_number: 3694
title: "fix(b-0545): adopt 081KRHWGX0008QG0R001XFRAHC collision renumber"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T02:53:21Z"
merged_at: "2026-05-16T02:55:42Z"
closed_at: "2026-05-16T02:55:42Z"
head_ref: "codex/b0545-b0498-renumber-adopt-20260516"
base_ref: "main"
archived_at: "2026-05-16T03:14:35Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3694: fix(b-0545): adopt 081KRHWGX0008QG0R001XFRAHC collision renumber

## PR description

## Summary

- adopts the existing Otto 081KRHWGX0008QG0R001XFRAHC collision-renumber fix onto current main without rewriting Otto's branch
- renumbers the Riven cursor-terminal backlog row to 081KRMEXM0008QG0R00037RGNY and preserves breadcrumbs
- regenerates docs/BACKLOG.md so the generated index matches the row rename

## Verification

- git diff --check
- bun tools/hygiene/audit-backlog-items.ts --enforce-duplicate-ids
- bun tools/backlog/generate-index.ts --check

## Coordination

This unblocks PR #3674's factory-wide duplicate-ID gate once merged.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T02:55:55Z)

## Pull request overview

Adopts the existing duplicate backlog ID collision fix by renumbering the Riven cursor-terminal backlog row from **081KRHWGX0008QG0R001XFRAHC → 081KRMEXM0008QG0R00037RGNY**, updating cross-references, and regenerating the generated backlog index so it matches the per-row files.

**Changes:**

- Updated the Riven cursor-terminal research design doc to reference **081KRMEXM0008QG0R00037RGNY** (with renumber breadcrumb).
- Updated backlog row files to reflect the renumber (frontmatter + breadcrumbs) and updated the collision-sweep row to point at the new ID.
- Regenerated `docs/BACKLOG.md` to drop the old 081KRHWGX0008QG0R001XFRAHC entry and add 081KRMEXM0008QG0R00037RGNY.

### Reviewed changes

Copilot reviewed 4 out of 4 changed files in this pull request and generated 1 comment.

| File | Description |
| ---- | ----------- |
| docs/research/2026-05-15-riven-cursor-terminal-loop-design.md | Updates the referenced backlog ID to 081KRMEXM0008QG0R00037RGNY with renumber context. |
| docs/backlog/P2/081KRMEXM0008QG0R000ARAR7P-b0498-collision-renumber-sweep-2026-05-15.md | Records the collision/renumber sweep and links to the new 081KRMEXM0008QG0R00037RGNY row. |
| docs/backlog/P1/081KRMEXM0008QG0R00037RGNY-riven-cursor-terminal-background-loop-ide-native-autonomous-gate-2026-05-15.md | Renumbers the row to 081KRMEXM0008QG0R00037RGNY and adds `renumbered_from` / `renumbered_per` breadcrumbs. |
| docs/BACKLOG.md | Regenerates the index to reflect the renumbered row. |


<details>
<summary>Comments suppressed due to low confidence (2)</summary>

**docs/backlog/P2/081KRMEXM0008QG0R000ARAR7P-b0498-collision-renumber-sweep-2026-05-15.md:10**

* Per `tools/backlog/README.md` the `last_updated` frontmatter field is required and must be updated on every content edit. This row's frontmatter is missing `last_updated` entirely; add it (likely `2026-05-16` given this edit).
```
status: done
created: 2026-05-15
completed: 2026-05-16
filed_by: otto-cli
completed_by: otto-cli
```
**docs/backlog/P2/081KRMEXM0008QG0R000ARAR7P-b0498-collision-renumber-sweep-2026-05-15.md:96**

* This new “Resolution” section states the renumber target is 081KRMEXM0008QG0R00037RGNY, but earlier in the same document the “Next free ID” / “Sweep scope” sections still describe renumbering to 081KRMEXM0008QG0R00278KS63. Please update those earlier sections (or explicitly label them as historical/estimates) to avoid leaving contradictory guidance in a single row file.
```
## Resolution (2026-05-16)

Renumber executed in this same PR:

- Renamed `docs/backlog/P1/081KRHWGX0008QG0R001XFRAHC-riven-cursor-terminal-*-2026-05-15.md` → `docs/backlog/P1/081KRMEXM0008QG0R00037RGNY-riven-cursor-terminal-*-2026-05-15.md`
```
</details>

## Review threads

### Thread 1: docs/backlog/P2/081KRMEXM0008QG0R000ARAR7P-b0498-collision-renumber-sweep-2026-05-15.md:6 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T02:55:55Z):

`status: done` is not a valid backlog-row status (schema allows `open`/`closed`/`superseded-by-*`/`deferred`/`decomposed`). It will also render as unchecked in the generated `docs/BACKLOG.md` because the generator only treats `closed`/`superseded-by-*` as closed. Use `status: closed` here if the intention is to mark 081KRMEXM0008QG0R000ARAR7P complete.

This issue also appears in the following locations of the same file:

- line 6
- line 92

## General comments

### @chatgpt-codex-connector (2026-05-16T02:53:24Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
