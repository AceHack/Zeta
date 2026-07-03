---
pr_number: 3069
title: "fix(backlog): resolve 081KRA5AR0008QG0R0035N4S6C-081KRA5AR0008QG0R000C3P8KP collisions \u2014 renumber amara series \u2192 081KRA5AR0008QG0R000KKJRVA-081KRA5AR0008QG0R001X4T9W7"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T00:12:18Z"
merged_at: "2026-05-14T00:15:04Z"
closed_at: "2026-05-14T00:15:04Z"
head_ref: "fix/b0410-b0411-id-collision-renumber-amara-series-to-b0457-b0458-2026-05-14"
base_ref: "main"
archived_at: "2026-05-14T00:55:19Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3069: fix(backlog): resolve 081KRA5AR0008QG0R0035N4S6C-081KRA5AR0008QG0R000C3P8KP collisions — renumber amara series → 081KRA5AR0008QG0R000KKJRVA-081KRA5AR0008QG0R001X4T9W7

## PR description

## Summary

Fourth per-collision cleanup from the [081KRFA460008QG0R00308W7FJ](docs/backlog/P1/081KRFA460008QG0R00308W7FJ-duplicate-row-id-substrate-cleanup-2026-05-13.md) sweep. 081KRA5AR0008QG0R0035N4S6C + 081KRA5AR0008QG0R000C3P8KP form one connected component (amara series: 081KRA5AR0008QG0R000C3P8KP depends on 081KRA5AR0008QG0R0035N4S6C).

## The collisions

| ID | 081KQDTYV0008QG0R0037YJPEX amara series ([#2704](https://github.com/Lucent-Financial-Group/Zeta/pull/2704)) | 081KQDTYV0008QG0R001VJP216 peer-call series ([#2706](https://github.com/Lucent-Financial-Group/Zeta/pull/2706)) |
|---|---|---|
| 081KRA5AR0008QG0R0035N4S6C | amara.ts core OpenAI API invoke | peer-call-persona-loader-ts-module |
| 081KRA5AR0008QG0R000C3P8KP | amara.ts README + courier-debt | grok-ts-persona-flag-impl |

## Resolution: keep 081KQDTYV0008QG0R001VJP216 (peer-call) series

Per external-references rule:

- 081KQDTYV0008QG0R001VJP216 parent's frontmatter lists `children: [081KRA5AR0008QG0R0035N4S6C, 081KRA5AR0008QG0R000C3P8KP]` AND `depends_on: [081KRA5AR0008QG0R0035N4S6C, 081KRA5AR0008QG0R000C3P8KP]` — strong references
- 081KRA5AR0008QG0R000YZMXNM (`codex-gemini-ts-persona-flag-impl`) `depends_on: [081KRA5AR0008QG0R000C3P8KP]` with body referring to grok-ts integration — refers to peer-call series
- 081KQDTYV0008QG0R0037YJPEX parent only has body-text mentions (editable here)

→ Keep 081KQDTYV0008QG0R001VJP216's children at 081KRA5AR0008QG0R0035N4S6C/081KRA5AR0008QG0R000C3P8KP. Renumber amara series:

```
081KRA5AR0008QG0R0035N4S6C → 081KRA5AR0008QG0R000KKJRVA  (amara.ts core)
081KRA5AR0008QG0R000C3P8KP → 081KRA5AR0008QG0R001X4T9W7  (amara.ts README + closure)
```

## Empirical effect

| Signal | Before | After |
|---|---|---|
| Duplicate-ID groups | 3 | 1 |

[081KRFA460008QG0R00308W7FJ](docs/backlog/P1/081KRFA460008QG0R00308W7FJ-duplicate-row-id-substrate-cleanup-2026-05-13.md) cleanup progress: **9/12 → 11/12**. Only 081KRA5AR0008QG0R000Y6102S 3-way remains for future-Otto.

## Test plan

- [x] `git mv` preserves history
- [x] Internal `depends_on` chain remapped (081KRA5AR0008QG0R001X4T9W7 → 081KRA5AR0008QG0R000KKJRVA)
- [x] 081KQDTYV0008QG0R0037YJPEX parent body updated to new IDs
- [x] `BACKLOG_WRITE_FORCE=1 bun tools/backlog/generate-index.ts` regenerated
- [x] `bun tools/bg/audit-duplicate-row-ids.ts` confirms 3 → 1
- [x] Worktree-isolated build (`/tmp/zeta-b0410-b0411-fix`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T00:13:47Z)

## Pull request overview

Fourth per-collision cleanup from the 081KRFA460008QG0R00308W7FJ sweep: renumbers the amara series (081KRA5AR0008QG0R0035N4S6C/081KRA5AR0008QG0R000C3P8KP) to 081KRA5AR0008QG0R000KKJRVA/081KRA5AR0008QG0R001X4T9W7 to resolve duplicate-ID collisions with 081KQDTYV0008QG0R001VJP216's children (peer-call persona-loader / grok-ts persona flag). The peer-call series is kept at 081KRA5AR0008QG0R0035N4S6C/081KRA5AR0008QG0R000C3P8KP because 081KQDTYV0008QG0R001VJP216's frontmatter and 081KRA5AR0008QG0R000YZMXNM hold stronger external references.

**Changes:**

- Renumber `081KRA5AR0008QG0R0035N4S6C` → `081KRA5AR0008QG0R000KKJRVA` (amara.ts core) and `081KRA5AR0008QG0R000C3P8KP` → `081KRA5AR0008QG0R001X4T9W7` (amara.ts README + closure), with `renumbered_from` / `renumbered_reason` frontmatter and remapped internal `depends_on` (081KRA5AR0008QG0R001X4T9W7 → 081KRA5AR0008QG0R000KKJRVA).
- Update 081KQDTYV0008QG0R0037YJPEX parent body to point at new child IDs and add note about the renumber.
- Regenerate `docs/BACKLOG.md` so the amara rows appear at 081KRA5AR0008QG0R000KKJRVA/081KRA5AR0008QG0R001X4T9W7 and the duplicate 081KRA5AR0008QG0R0035N4S6C/081KRA5AR0008QG0R000C3P8KP lines are dropped.

### Reviewed changes

Copilot reviewed 5 out of 5 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P2/081KRA5AR0008QG0R000KKJRVA-amara-ts-core-openai-api-invoke-flag-parity-ts-first-riven-2026-05-11.md | Renames id to 081KRA5AR0008QG0R000KKJRVA, bumps last_updated, adds renumbered_from/reason and tag. |
| docs/backlog/P2/081KRA5AR0008QG0R001X4T9W7-amara-ts-readme-update-courier-debt-closure-test-invoke-ts-first-riven-2026-05-11.md | Renames id to 081KRA5AR0008QG0R001X4T9W7, remaps depends_on/composes_with to 081KRA5AR0008QG0R000KKJRVA, adds renumber metadata. |
| docs/backlog/P2/081KQDTYV0008QG0R0037YJPEX-amara-peer-call-headless-cli-bootstrap-end-courier-debt-2026-04-30.md | Updates parent index/status notes to reference new child IDs. |
| docs/BACKLOG.md | Removes old 081KRA5AR0008QG0R0035N4S6C/081KRA5AR0008QG0R000C3P8KP amara entries; adds 081KRA5AR0008QG0R000KKJRVA/081KRA5AR0008QG0R001X4T9W7 entries. |
