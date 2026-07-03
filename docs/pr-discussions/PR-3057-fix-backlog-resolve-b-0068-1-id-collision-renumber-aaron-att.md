---
pr_number: 3057
title: "fix(backlog): resolve 081KRA5AR0008QG0R001JVT5FX ID collision \u2014 renumber Aaron-attributed row \u2192 081KR7JY10008QG0R0025F6QVP"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-13T23:10:51Z"
merged_at: "2026-05-13T23:14:38Z"
closed_at: "2026-05-13T23:14:38Z"
head_ref: "fix/b0068.1-id-collision-renumber-aaron-to-b0068.4-2026-05-13"
base_ref: "main"
archived_at: "2026-05-14T00:20:11Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3057: fix(backlog): resolve 081KRA5AR0008QG0R001JVT5FX ID collision — renumber Aaron-attributed row → 081KR7JY10008QG0R0025F6QVP

## PR description

## Summary

First per-collision cleanup from the 081KRFA460008QG0R00308W7FJ sweep (12 duplicate-ID groups surfaced by [`tools/bg/audit-duplicate-row-ids.ts`](tools/bg/audit-duplicate-row-ids.ts) in [#3056](https://github.com/Lucent-Financial-Group/Zeta/pull/3056)).

## The collision

| File | Filed | Scope |
|---|---|---|
| `081KRA5AR0008QG0R001JVT5FX-forge-cli-ollama-research-slice-aaron-2026-05-10.md` | 2026-05-10 ([#2430](https://github.com/Lucent-Financial-Group/Zeta/pull/2430)) | Forge CLI + Ollama harness integration research slice |
| `081KRA5AR0008QG0R001JVT5FX-forge-cli-ollama-research-xs-riven-2026-05-11.md` | 2026-05-11 ([#2650](https://github.com/Lucent-Financial-Group/Zeta/pull/2650)) | Forge CLI + Ollama bridge research pass (WebSearch + capability matrix, XS) |

## Resolution

Per the per-collision resolution rule (keep the row with external references):

- The [081KQ8P5D0008QG0R002E1G72J parent row's body](docs/backlog/P2/081KQ8P5D0008QG0R002E1G72J-local-ai-trajectory-forge-ollama-direct-integration-aaron-2026-04-28.md) describes Riven's scope ("081KRA5AR0008QG0R001JVT5FX (XS, P2, root): Forge CLI + Ollama bridge research (WebSearch + matrix). Unblocks 081KRA5AR0008QG0R001BTRYN0.")
- Sibling rows `081KRA5AR0008QG0R002TPJ4NC` and `081KRA5AR0008QG0R001BTRYN0` reference "081KRA5AR0008QG0R001JVT5FX" in `depends_on` / `composes_with` — semantically referring to Riven's atomic XS series
- Aaron's row has **no external references** (verified via `grep`)

→ Keep Riven's row at 081KRA5AR0008QG0R001JVT5FX; renumber Aaron's to next-free **081KR7JY10008QG0R0025F6QVP** with `renumbered_from: 081KRA5AR0008QG0R001JVT5FX` + reason recorded.

This bends "first-merged-wins" in favor of the external-references rule, matching [#3053](https://github.com/Lucent-Financial-Group/Zeta/pull/3053)'s precedent.

## Empirical effect

Against pre-#3056 `origin/main`:

| Signal | Before | After |
|---|---|---|
| Duplicate-ID groups | 12 | 11 |

Once #3056 (the audit tool) merges, future Otto can verify via `bun tools/bg/audit-duplicate-row-ids.ts`.

## Test plan

- [x] `git mv` preserves history
- [x] Inline duplicate-ID audit on the branch reports 11 (down from 12)
- [x] `bun tools/backlog/generate-index.ts` regenerated `docs/BACKLOG.md` cleanly
- [x] Worktree-isolated build (`/tmp/zeta-b0068-fix`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-13T23:13:59Z)

## Pull request overview

Resolves a duplicate backlog-row ID collision by renumbering the Aaron-authored `081KRA5AR0008QG0R001JVT5FX` row to `081KR7JY10008QG0R0025F6QVP`, keeping the externally-referenced `081KRA5AR0008QG0R001JVT5FX` row intact, and updating the generated backlog index accordingly.

**Changes:**

- Renumbered the per-row file frontmatter from `id: 081KRA5AR0008QG0R001JVT5FX` to `id: 081KR7JY10008QG0R0025F6QVP`, recording `renumbered_from` / `renumbered_reason` and updating `last_updated`.
- Updated the row’s H1 header to reflect the new ID and renumber provenance.
- Regenerated `docs/BACKLOG.md` to replace the old `081KRA5AR0008QG0R001JVT5FX` entry with `081KR7JY10008QG0R0025F6QVP`.

### Reviewed changes

Copilot reviewed 3 out of 3 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P2/081KR7JY10008QG0R0025F6QVP-forge-cli-ollama-research-slice-aaron-2026-05-10.md | Updates row ID + renumber provenance metadata for the collision fix. |
| docs/BACKLOG.md | Regenerated index reflecting the new `081KR7JY10008QG0R0025F6QVP` row ID. |


<details>
<summary>Comments suppressed due to low confidence (3)</summary>

**docs/backlog/P2/081KR7JY10008QG0R0025F6QVP-forge-cli-ollama-research-slice-aaron-2026-05-10.md:5**

* The row title still says "081KQ8P5D0008QG0R002E1G72J child 1" even though this row is now 081KR7JY10008QG0R0025F6QVP and 081KRA5AR0008QG0R001JVT5FX already exists. This is likely to confuse readers of docs/BACKLOG.md; consider updating the title to avoid implying it's the first child (e.g., reference the renumber or describe the scope without a child-number).

**docs/backlog/P2/081KR7JY10008QG0R0025F6QVP-forge-cli-ollama-research-slice-aaron-2026-05-10.md:8**

* This child row doesn’t declare `parent: 081KQ8P5D0008QG0R002E1G72J`, unlike the other 081KQ8P5D0008QG0R002E1G72J.* siblings (e.g., docs/backlog/P2/081KRA5AR0008QG0R001JVT5FX-…:6, 081KRA5AR0008QG0R002TPJ4NC-…:6, 081KRA5AR0008QG0R001BTRYN0-…:6) and many other dotted IDs (e.g., docs/backlog/P2/081KR2E4K0008QG0R0003J0FB8-…:9). Adding `parent: 081KQ8P5D0008QG0R002E1G72J` would make the relationship machine-readable and keep frontmatter consistent.

**docs/backlog/P2/081KR7JY10008QG0R0025F6QVP-forge-cli-ollama-research-slice-aaron-2026-05-10.md:11**

* `renumbered_reason` says this cleanup is "tracked in 081KRFA460008QG0R00308W7FJ", but there is no 081KRFA460008QG0R00308W7FJ backlog row in this branch, and 081KRFA460008QG0R00308W7FJ is referenced elsewhere as a different planned item (docs/backlog/P1/081KRFA460008QG0R002DG8KPZ-…:136-138). To avoid a dangling/ambiguous reference, consider linking to the concrete tracking row path (once it exists) or referencing the PR/issue that tracks the cleanup instead of the bare ID.

</details>
