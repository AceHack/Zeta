---
pr_number: 3065
title: "fix(backlog): resolve 081KR2E4K0008QG0R000ARCH0X-0373 collisions \u2014 renumber P2 contributor-compliance set \u2192 081KRA5AR0008QG0R0029YWXYW-0455"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-13T23:32:45Z"
merged_at: "2026-05-14T00:04:09Z"
closed_at: "2026-05-14T00:04:09Z"
head_ref: "fix/b0370-0373-id-collision-renumber-p2-set-to-b0452-b0455-2026-05-14"
base_ref: "main"
archived_at: "2026-05-14T00:06:43Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3065: fix(backlog): resolve 081KR2E4K0008QG0R000ARCH0X-0373 collisions — renumber P2 contributor-compliance set → 081KRA5AR0008QG0R0029YWXYW-0455

## PR description

## Summary

Third per-collision cleanup from the [081KRFA460008QG0R00308W7FJ](../backlog/P1/081KRFA460008QG0R00308W7FJ-duplicate-row-id-substrate-cleanup-2026-05-13.md) sweep. Four collisions form one connected cluster (081KQ8P5D0008QG0R003ZF64GG parent + internal `depends_on` chain).

## The collisions

| ID | Earlier P1 ([#2269](https://github.com/Lucent-Financial-Group/Zeta/pull/2269), 2026-05-09) | Later P2 ([#2683](https://github.com/Lucent-Financial-Group/Zeta/pull/2683), 2026-05-11) |
|---|---|---|
| 081KR2E4K0008QG0R000ARCH0X | durable-computation-checkpoint-interface-extension | contributor-compliance-core-document-authoring |
| 081KR2E4K0008QG0R001733JTN | pages-seo-metadata-jsonld-social-preview | contributor-compliance-cross-reference-integration |
| 081KR2E4K0008QG0R0015BCPF7 | pages-sitemap-robots-ai-crawler-policy | t1-t2-self-audit-and-cadenced-review-trajectories |
| 081KR50HA0008QG0R001NNPEXC | alignment-proof-primitive-ladder-one-type-one-property | t4-t5-onboarding-and-drift-retrospective-trajectories |

## Resolution: keep P1 set, renumber P2 set

Per first-merged-wins + external-references:

- The P1 set was filed 2 days earlier via [#2269](https://github.com/Lucent-Financial-Group/Zeta/pull/2269) (itself a prior collision-resolution sweep).
- 081KR2E4K0008QG0R000ARCH0X P1 + 081KR50HA0008QG0R001NNPEXC P1 are already shipped (`[x]` in BACKLOG.md).
- External P1 references in [PR review history](../history/pr-reviews/PR-2369-fix-backlog-refresh-generated-index-after-pr-2367.md) and a [memory file](../../memory/feedback_shadow_lesson_log_otto_catches_2026_05_07.md).
- The P2 set's references are internal (parent + chain) — editable in this PR.

→ Keep P1 set; renumber P2 set as a unit:

```
081KR2E4K0008QG0R000ARCH0X → 081KRA5AR0008QG0R0029YWXYW (contributor-compliance-core)
081KR2E4K0008QG0R001733JTN → 081KRA5AR0008QG0R0004P7SWS (cross-reference-integration)
081KR2E4K0008QG0R0015BCPF7 → 081KRA5AR0008QG0R003F6TA3A (T1+T2 trajectories)
081KR50HA0008QG0R001NNPEXC → 081KRA5AR0008QG0R0033TJSAF (T4+T5 trajectories)
```

## Internal-chain remap

- `081KRA5AR0008QG0R0004P7SWS.depends_on: [081KR2E4K0008QG0R000ARCH0X]` → `[081KRA5AR0008QG0R0029YWXYW]`
- `081KRA5AR0008QG0R003F6TA3A.depends_on: [081KR2E4K0008QG0R000ARCH0X]` → `[081KRA5AR0008QG0R0029YWXYW]`
- `081KRA5AR0008QG0R0033TJSAF.depends_on: [081KR2E4K0008QG0R000ARCH0X, 081KR2E4K0008QG0R001733JTN]` → `[081KRA5AR0008QG0R0029YWXYW, 081KRA5AR0008QG0R0004P7SWS]`
- [081KQ8P5D0008QG0R003ZF64GG](../backlog/P2/081KQ8P5D0008QG0R003ZF64GG-public-company-contributor-compliance-doc-and-cadenced-trajectories-aaron-2026-04-28.md) parent body §Decomposition updated to new IDs with renumber note

Each row has `renumbered_from: B-NNNN` + reason in frontmatter.

## Empirical effect

| Signal | Before | After |
|---|---|---|
| Duplicate-ID groups | 11 | 7 |

[081KRFA460008QG0R00308W7FJ](../backlog/P1/081KRFA460008QG0R00308W7FJ-duplicate-row-id-substrate-cleanup-2026-05-13.md) cleanup progress: **1/12 → 9/12** (after [#3058](https://github.com/Lucent-Financial-Group/Zeta/pull/3058) merges too).

Remaining 3 groups: `081KRA5AR0008QG0R000Y6102S` (3-way), `081KRA5AR0008QG0R0035N4S6C`, `081KRA5AR0008QG0R000C3P8KP`.

## Test plan

- [x] All 4 P2 files renamed (`git mv` preserves history where possible)
- [x] Internal `depends_on` chain remapped (3 rows)
- [x] 081KQ8P5D0008QG0R003ZF64GG parent body §Decomposition updated
- [x] `bun tools/backlog/generate-index.ts` regenerated `docs/BACKLOG.md`
- [x] Inline audit confirms 11 → 7
- [x] Worktree-isolated build (`/tmp/zeta-b0370-fix`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-13T23:34:04Z)

## Pull request overview

Mechanical renumber of the P2 contributor-compliance child set (081KR2E4K0008QG0R000ARCH0X–081KR50HA0008QG0R001NNPEXC → 081KRA5AR0008QG0R0029YWXYW–081KRA5AR0008QG0R0033TJSAF) to resolve ID collisions with an earlier-filed P1 set, plus remap of the internal `depends_on` chain and parent decomposition section in 081KQ8P5D0008QG0R003ZF64GG.

**Changes:**
- Renamed/renumbered four P2 rows (081KR2E4K0008QG0R000ARCH0X–081KR50HA0008QG0R001NNPEXC → 081KRA5AR0008QG0R0029YWXYW–081KRA5AR0008QG0R0033TJSAF) with `renumbered_from` + reason in frontmatter and updated body titles
- Remapped internal `depends_on` references (`[081KR2E4K0008QG0R000ARCH0X]` → `[081KRA5AR0008QG0R0029YWXYW]`, `[081KR2E4K0008QG0R000ARCH0X, 081KR2E4K0008QG0R001733JTN]` → `[081KRA5AR0008QG0R0029YWXYW, 081KRA5AR0008QG0R0004P7SWS]`) and updated 081KQ8P5D0008QG0R003ZF64GG §Decomposition with renumber note and new children list
- Regenerated `docs/BACKLOG.md` to reflect the new IDs in the P2 section

### Reviewed changes

Copilot reviewed 7 out of 7 changed files in this pull request and generated no comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| docs/backlog/P2/081KRA5AR0008QG0R0029YWXYW-contributor-compliance-core-document-authoring.md | Renumber from 081KR2E4K0008QG0R000ARCH0X; add renumbered_from + reason |
| docs/backlog/P2/081KRA5AR0008QG0R0004P7SWS-contributor-compliance-cross-reference-integration.md | Renumber from 081KR2E4K0008QG0R001733JTN; remap depends_on to 081KRA5AR0008QG0R0029YWXYW |
| docs/backlog/P2/081KRA5AR0008QG0R003F6TA3A-t1-t2-self-audit-and-cadenced-review-trajectories.md | Renumber from 081KR2E4K0008QG0R0015BCPF7; remap depends_on to 081KRA5AR0008QG0R0029YWXYW |
| docs/backlog/P2/081KRA5AR0008QG0R0033TJSAF-t4-t5-onboarding-and-drift-retrospective-trajectories.md | Renumber from 081KR50HA0008QG0R001NNPEXC; remap depends_on to [081KRA5AR0008QG0R0029YWXYW, 081KRA5AR0008QG0R0004P7SWS] |
| docs/backlog/P2/081KQ8P5D0008QG0R003ZF64GG-...-aaron-2026-04-28.md | Update §Decomposition with new child IDs + renumber note |
| docs/BACKLOG.md | Regenerated index — P2 entries moved to new IDs |
</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-13T23:37:56Z)

## Pull request overview

Copilot reviewed 8 out of 8 changed files in this pull request and generated no new comments.

### COMMENTED — @copilot-pull-request-reviewer (2026-05-13T23:44:16Z)

## Pull request overview

Copilot reviewed 10 out of 10 changed files in this pull request and generated no new comments.

### COMMENTED — @copilot-pull-request-reviewer (2026-05-13T23:51:25Z)

## Pull request overview

Copilot reviewed 11 out of 11 changed files in this pull request and generated no new comments.

### COMMENTED — @copilot-pull-request-reviewer (2026-05-13T23:57:38Z)

## Pull request overview

Copilot reviewed 12 out of 12 changed files in this pull request and generated no new comments.

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T00:03:34Z)

## Pull request overview

Copilot reviewed 13 out of 13 changed files in this pull request and generated no new comments.

## General comments

### @chatgpt-codex-connector (2026-05-13T23:32:49Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
