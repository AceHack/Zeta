---
pr_number: 3666
title: "fix(hygiene): clear all 22 dead \u00a733 migration xrefs (perpetual non-required-check)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T01:24:11Z"
merged_at: "2026-05-16T01:25:46Z"
closed_at: "2026-05-16T01:25:46Z"
head_ref: "fix/section-33-migration-xrefs-22-dead-otto-cli-2026-05-16"
base_ref: "main"
archived_at: "2026-05-16T01:37:26Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3666: fix(hygiene): clear all 22 dead §33 migration xrefs (perpetual non-required-check)

## PR description

## Summary

The `lint (§33 migration xrefs)` check has been firing as a non-required failure on **every PR this session** (PRs #3626, #3628, #3631, #3636, #3639, #3641, #3646, #3647, #3650, #3652, #3653, #3654, #3657, #3661, #3662, #3663). Root cause: the `docs/research/` → `memory/otto/cli/claude/conversations/` migration ([081KRMEXM0008QG0R000K25MXS](https://github.com/Lucent-Financial-Group/Zeta/blob/main/docs/backlog/P1/081KRMEXM0008QG0R000K25MXS-section-33-migration-xrefs-audit-script-and-ci-gate-2026-05-15.md)) left 22 dead references across 18 files.

**Mechanical bulk fix**: 12 unique target filenames substituted in-place in 18 source files. Each substitution is `docs/research/<NAME>.md` → `memory/otto/cli/claude/conversations/<NAME>.md` for a SPECIFIC filename (no blanket replacement of `docs/research/` — only the 12 known-migrated filenames).

**Verification**:

- `bun tools/hygiene/audit-section-33-migration-xrefs.ts --enforce` was **22 dead xrefs** before this commit, **0 dead xrefs** after
- Pure-substitution diff: **+22/-22**, no content changes
- All 12 target files verified to exist in `memory/otto/cli/claude/conversations/`
- ls-tree canary clean (53/53 root entries)

## Files changed

```
18 files changed, 22 insertions(+), 22 deletions(-)
- 1 .claude/rules/claim-acquire-before-worktree-work.md
- 6 docs/backlog/P*/B-*.md (081KQ0YZ80008QG0R001QJJTVF, 081KQ8P5D0008QG0R001BH93SA, 081KQX9B50008QG0R001W40ZH8, 081KR2E4K0008QG0R00289GE8Z, 081KR7JY10008QG0R000R503K2, 081KPYCJH0008QG0R003MDS51N, 081KQTPYE0008QG0R001W237MZ, 081KQ0YZ80008QG0R002T6TM7Z — 8 backlog rows total; some have 2 hits)
- 9 memory/feedback_*.md
- 1 memory/CURRENT-aaron.md
- 1 memory/user_*.md
```

## Remaining drift

The other 4 perpetual non-required-check failures remain:

- `lint (backlog ID uniqueness)` — 081KRHWGX0008QG0R001XFRAHC collision already scoped at [081KRMEXM0008QG0R000ARAR7P](https://github.com/Lucent-Financial-Group/Zeta/blob/main/docs/backlog/P2/081KRMEXM0008QG0R000ARAR7P-b0498-collision-renumber-sweep-2026-05-15.md)
- `lint (tsc tools)` — needs separate investigation
- `check docs/BACKLOG.md generated-index drift` — needs regen pass
- `check MEMORY.md generated-index drift` — needs regen pass

## Test plan

- [x] `audit-section-33-migration-xrefs.ts --enforce` returns 0 dead xrefs (was 22)
- [x] Pure-substitution property: 12 sed expressions, each scoped to a specific filename
- [x] Pre/post-commit ls-tree canary clean (53/53; Lior gone)
- [ ] CI green (docs-only; expect `lint (§33 migration xrefs)` to FLIP from fail → pass)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T01:28:11Z)

## Pull request overview

This PR fixes the perpetual `lint (§33 migration xrefs)` failure by updating stale cross-references that still point at `docs/research/<NAME>.md` to instead point at the migrated archive location `memory/otto/cli/claude/conversations/<NAME>.md`.

**Changes:**

- Updated 22 xrefs across memory files, backlog rows, and a `.claude/rules` doc to the post-migration archive paths.
- Kept changes scoped to specific known-migrated filenames (no blanket `docs/research/` rewrite).
- Updated `memory/CURRENT-aaron.md` and related memos to reference the new archived conversation paths.

### Reviewed changes

Copilot reviewed 18 out of 18 changed files in this pull request and generated 8 comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| `.claude/rules/claim-acquire-before-worktree-work.md` | Updates a §33-migrated xref to the new archive location. |
| `docs/backlog/P1/081KQ0YZ80008QG0R001QJJTVF-alignment-md-rewrite.md` | Updates a migrated research xref to `memory/otto/cli/claude/conversations/…`. |
| `docs/backlog/P1/081KQ8P5D0008QG0R001BH93SA-finish-monolith-to-per-row-migration-no-residue-aaron-2026-04-28.md` | Updates the backlog-split design xref to the new archive location. |
| `docs/backlog/P1/081KQX9B50008QG0R001W40ZH8-shadow-work-as-ai-debugger-for-regular-people-product-pitch-2026-05-06.md` | Updates a migrated conversation xref in “Composes with”. |
| `docs/backlog/P1/081KR2E4K0008QG0R00289GE8Z-wake-time-otto-nn-anchor-backfill.md` | Updates slice-1 and slice-2 landing pointers to the new archive location. |
| `docs/backlog/P1/081KR7JY10008QG0R000R503K2-inter-agent-ephemeral-communication-bus-nats-protocol.md` | Updates the multi-agent review doc xref to the new archive location. |
| `docs/backlog/P2/081KPYCJH0008QG0R003MDS51N-example-schema-self-reference.md` | Updates the referenced design spec xref to the new archive location. |
| `docs/backlog/P2/081KQTPYE0008QG0R001W237MZ-bigint-and-bignumber-integration-aaron-2026-05-05.md` | Updates an Aurora cross-review xref to the new archive location. |
| `docs/backlog/P3/081KQ0YZ80008QG0R002T6TM7Z-otto-287-noether-formalization.md` | Updates Noether-formalization xrefs to the new archive location. |
| `memory/CURRENT-aaron.md` | Updates an Otto-261 audit-coverage xref to the new archive location. |
| `memory/feedback_aaron_multi_foreground_surface_otto_activation_routines_git_tracked_approval_friction_lane_split_2026_05_13.md` | Updates canonical bootstream xrefs to the new archive location. |
| `memory/feedback_aaron_otto_identity_stays_unified_across_surfaces_aaron_offered_split_otto_chose_one_coherent_identity_glass_halo_both_sides_2026_05_13.md` | Updates canonical bootstream xref to the new archive location. |
| `memory/feedback_alignment_md_rewrite_matrix_pill_spread_via_rigor_2026_04_25.md` | Updates Noether-formalization xref to the new archive location. |
| `memory/feedback_charlie_kirk_argument_style_IS_bio_weapon_style_at_human_scale_architecture_mechanizes_it_aaron_2026_05_05.md` | Updates a migrated conversation xref to the new archive location. |
| `memory/feedback_clean_mirror_not_curating_validator_agent_loop_preservation_principle_razor_runs_downstream_aaron_2026_05_05.md` | Updates a migrated conversation xref to the new archive location. |
| `memory/feedback_loss_primitive_zeta_economics_concession_at_substrate_level_spectral_residue_chaos_internal_itron_nation_state_provenance_aaron_2026_05_05.md` | Updates a migrated conversation xref to the new archive location. |
| `memory/feedback_multi_harness_alignment_convergence_design_future_skill_domain_aaron_2026_05_03.md` | Updates a migrated conversation xref to the new archive location. |
| `memory/user_aaron_turtles_all_the_way_down_methodology_seeks_ultimate_generalization_2026_04_25.md` | Updates Noether-formalization xref to the new archive location. |
</details>

## Review threads

### Thread 1: docs/backlog/P3/081KQ0YZ80008QG0R002T6TM7Z-otto-287-noether-formalization.md:33 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T01:28:09Z):

P1: This backlog row’s body was edited (xref update), but `last_updated` in the YAML frontmatter wasn’t bumped. Per tools/backlog/README.md, `last_updated` must be updated on every content edit; please update it for this row.

### Thread 2: docs/backlog/P2/081KQTPYE0008QG0R001W237MZ-bigint-and-bignumber-integration-aaron-2026-05-05.md:101 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T01:28:09Z):

P1: This backlog row’s content changed (xref update) but the YAML frontmatter `last_updated` wasn’t updated. The backlog schema requires `last_updated` to be bumped on every content edit (tools/backlog/README.md).

### Thread 3: docs/backlog/P2/081KPYCJH0008QG0R003MDS51N-example-schema-self-reference.md:97 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T01:28:10Z):

P1: This backlog row was edited (xref update) but `last_updated` in the YAML frontmatter wasn’t bumped. Please update `last_updated` to reflect this content change, per tools/backlog/README.md.

### Thread 4: docs/backlog/P1/081KR7JY10008QG0R000R503K2-inter-agent-ephemeral-communication-bus-nats-protocol.md:55 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T01:28:10Z):

P1: This backlog row’s body changed (xref update) but the YAML frontmatter `last_updated` wasn’t updated. The per-row schema requires bumping `last_updated` on every content edit (tools/backlog/README.md).

### Thread 5: docs/backlog/P1/081KR2E4K0008QG0R00289GE8Z-wake-time-otto-nn-anchor-backfill.md:86 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T01:28:10Z):

P1: This backlog row content was edited (xref updates in the slice landing pointers), but `last_updated` in the YAML frontmatter wasn’t bumped. Please update `last_updated` per the per-row schema in tools/backlog/README.md.

### Thread 6: docs/backlog/P1/081KQX9B50008QG0R001W40ZH8-shadow-work-as-ai-debugger-for-regular-people-product-pitch-2026-05-06.md:55 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T01:28:10Z):

P1: This backlog row’s body was edited (xref update in Composes with), but `last_updated` in the YAML frontmatter wasn’t bumped. The backlog schema requires updating `last_updated` on every content edit (tools/backlog/README.md).

### Thread 7: docs/backlog/P1/081KQ8P5D0008QG0R001BH93SA-finish-monolith-to-per-row-migration-no-residue-aaron-2026-04-28.md:113 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T01:28:11Z):

P1: This backlog row content changed (xref update) but the YAML frontmatter `last_updated` wasn’t bumped. Please update `last_updated` for this row per tools/backlog/README.md.

### Thread 8: docs/backlog/P1/081KQ0YZ80008QG0R001QJJTVF-alignment-md-rewrite.md:74 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T01:28:11Z):

P1: This backlog row’s body was edited (xref update), but `last_updated` in the YAML frontmatter wasn’t bumped. Per tools/backlog/README.md, `last_updated` should be updated on every content edit.
