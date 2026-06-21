---
pr_number: 3058
title: "fix(backlog): resolve 081KQ8P5D0008QG0R0002TN22C.x ID collisions \u2014 renumber Riven ts-* series .1-.4 \u2192 .5-.8"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-13T23:19:54Z"
merged_at: "2026-05-13T23:37:43Z"
closed_at: "2026-05-13T23:37:43Z"
head_ref: "fix/b0090.x-id-collision-renumber-riven-to-0090.5-0090.8-2026-05-13"
base_ref: "main"
archived_at: "2026-05-14T00:20:10Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3058: fix(backlog): resolve 081KQ8P5D0008QG0R0002TN22C.x ID collisions — renumber Riven ts-* series .1-.4 → .5-.8

## PR description

## Summary

Second per-collision cleanup from the [081KRFA460008QG0R00308W7FJ](docs/backlog/P1/081KRFA460008QG0R00308W7FJ-duplicate-row-id-substrate-cleanup-2026-05-13.md) sweep. Two complete 081KQ8P5D0008QG0R0002TN22C decompositions had landed with overlapping sub-row IDs:

| Sub-ID | First filer (2026-05-10, [#2503](https://github.com/Lucent-Financial-Group/Zeta/pull/2503)) | Second filer (2026-05-11, [#2680](https://github.com/Lucent-Financial-Group/Zeta/pull/2680)) |
|---|---|---|
| 081KDVJT3E008QG0R003GV8BHV | Riven ts-worktree-survey | lost-substrate-3-bucket-taxonomy |
| 081KDVJT3E008QG0R00183ME0R | Riven ts-orphan-branch-survey | worktree-branch-delta-audit |
| 081KDVJT3E008QG0R000P3YGTX | Riven ts-closed-pr-survey | closed-not-merged-pr-scan |
| 081KDVJT3E008QG0R002GGF22P | Riven ts-draft-pr-aged-survey | cadence-and-hygiene-history-hook |

## Resolution

The 081KQ8P5D0008QG0R0002TN22C parent body describes the SECOND decomposition explicitly as canonical (3-bucket-taxonomy / worktree-delta / closed-not-merged / cadence-hook, lines 14-17 + 39-42). Per the external-references rule (same as [#3053](https://github.com/Lucent-Financial-Group/Zeta/pull/3053), [#3057](https://github.com/Lucent-Financial-Group/Zeta/pull/3057)), the second set keeps the original IDs; Riven's ts-* series renumbered as a unit:

```
081KDVJT3E008QG0R003GV8BHV → 081KDVJT3E008QG0R000SCFYN5  (TS worktree survey)
081KDVJT3E008QG0R00183ME0R → 081KDVJT3E008QG0R001Q5R4K5  (TS orphan branch survey)
081KDVJT3E008QG0R000P3YGTX → 081KDVJT3E008QG0R002KCTTDG  (TS closed-PR survey)
081KDVJT3E008QG0R002GGF22P → 081KDVJT3E008QG0R001TDYYMD  (TS draft-PR aged survey)
```

Internal `depends_on: [081KDVJT3E008QG0R003GV8BHV]` cross-refs in siblings remapped to `081KDVJT3E008QG0R000SCFYN5` (the renumbered Riven root). Body text references updated. `renumbered_from` + reason recorded in each frontmatter.

## Empirical effect

Inline duplicate-ID count on the branch:

| Before | After |
|---|---|
| 11 dup groups | 7 dup groups |

[081KRFA460008QG0R00308W7FJ](docs/backlog/P1/081KRFA460008QG0R00308W7FJ-duplicate-row-id-substrate-cleanup-2026-05-13.md) cleanup progress: **1/12 → 5/12** (081KRA5AR0008QG0R001JVT5FX in [#3057](https://github.com/Lucent-Financial-Group/Zeta/pull/3057) already merged; 081KDVJT3E008QG0R003GV8BHV-4 in this PR).

Remaining 7: 081KR2E4K0008QG0R000ARCH0X-0373 (4 cross-priority bleed), 081KRA5AR0008QG0R000Y6102S (3-way), 081KRA5AR0008QG0R0035N4S6C, 081KRA5AR0008QG0R000C3P8KP.

## Test plan

- [x] All 4 Riven files renamed + frontmatter id updated + body title updated
- [x] Internal `depends_on` chain remapped (`.6/.7/.8` now point at `.5`)
- [x] `bun tools/backlog/generate-index.ts` regenerated `docs/BACKLOG.md` cleanly
- [x] Inline audit confirms 11 → 7
- [x] Worktree-isolated build (`/tmp/zeta-b0090-fix`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-13T23:21:03Z)

## Pull request overview

Renames Riven's four 081KQ8P5D0008QG0R0002TN22C.x atomic child rows (.1-.4 → .5-.8) to resolve ID collisions with a second 081KQ8P5D0008QG0R0002TN22C decomposition, remaps internal `depends_on` references, and regenerates the backlog index.

**Changes:**
- Delete old `081KQ8P5D0008QG0R0002TN22C.{1,2,3,4}-...riven...md` files and add `081KQ8P5D0008QG0R0002TN22C.{5,6,7,8}-...riven...md` with `renumbered_from` + reason frontmatter
- Remap internal `depends_on: [081KDVJT3E008QG0R003GV8BHV]` → `[081KDVJT3E008QG0R000SCFYN5]` on the renumbered siblings
- Regenerate `docs/BACKLOG.md` to reflect the new IDs

### Reviewed changes

Copilot reviewed 10 out of 10 changed files in this pull request and generated no comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| docs/backlog/P2/081KDVJT3E008QG0R003GV8BHV-ts-worktree-survey-atomic-riven-2026-05-10.md | Old .1 row deleted (renumbered to .5) |
| docs/backlog/P2/081KDVJT3E008QG0R00183ME0R-ts-orphan-branch-survey-atomic-riven-2026-05-10.md | Old .2 row deleted (renumbered to .6) |
| docs/backlog/P2/081KDVJT3E008QG0R000P3YGTX-ts-closed-pr-survey-atomic-riven-2026-05-10.md | Old .3 row deleted (renumbered to .7) |
| docs/backlog/P2/081KDVJT3E008QG0R002GGF22P-ts-draft-pr-aged-survey-atomic-riven-2026-05-10.md | Old .4 row deleted (renumbered to .8) |
| docs/backlog/P2/081KDVJT3E008QG0R000SCFYN5-ts-worktree-survey-atomic-riven-2026-05-10.md | New row, renumbered_from 081KDVJT3E008QG0R003GV8BHV, deps cleared |
| docs/backlog/P2/081KDVJT3E008QG0R001Q5R4K5-ts-orphan-branch-survey-atomic-riven-2026-05-10.md | New row, renumbered_from 081KDVJT3E008QG0R00183ME0R, depends_on remapped to .5 |
| docs/backlog/P2/081KDVJT3E008QG0R002KCTTDG-ts-closed-pr-survey-atomic-riven-2026-05-10.md | New row, renumbered_from 081KDVJT3E008QG0R000P3YGTX, depends_on remapped to .5 |
| docs/backlog/P2/081KDVJT3E008QG0R001TDYYMD-ts-draft-pr-aged-survey-atomic-riven-2026-05-10.md | New row, renumbered_from 081KDVJT3E008QG0R002GGF22P, depends_on remapped to .5 |
| docs/BACKLOG.md | Regenerated index reflecting the new IDs |
</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-13T23:27:22Z)

## Pull request overview

Copilot reviewed 11 out of 11 changed files in this pull request and generated no new comments.
