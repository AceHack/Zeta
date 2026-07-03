---
pr_number: 3544
title: "fix(rules): glass-halo-bidirectional \u2014 DeepSeek migration xref (081KRMEXM0008QG0R000K25MXS Slice A proof-of-concept)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-15T18:20:24Z"
merged_at: "2026-05-15T18:21:46Z"
closed_at: "2026-05-15T18:21:46Z"
head_ref: "fix/b0533-slice-a-lior-dead-xrefs-otto-cli-2026-05-15"
base_ref: "main"
archived_at: "2026-05-15T21:13:29Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3544: fix(rules): glass-halo-bidirectional — DeepSeek migration xref (081KRMEXM0008QG0R000K25MXS Slice A proof-of-concept)

## PR description

## Summary

First instance of [081KRMEXM0008QG0R000K25MXS](https://github.com/Lucent-Financial-Group/Zeta/pull/3540) Slice A — per-persona PR batches updating dead xrefs to migrated §33 files.

DeepSeek's archive was migrated via [PR #3507](https://github.com/Lucent-Financial-Group/Zeta/pull/3507) to \`memory/deepseek/conversations/\`; \`.claude/rules/glass-halo-bidirectional.md\` still cited the pre-migration \`docs/research/\` path.

## Why single-file proof-of-concept

Smallest viable batch to establish the pattern + the inline annotation convention. The rest of DeepSeek (4 more files, 6 line-edits) defers to follow-up PRs — keeps blast radius minimal + reviewable.

## Annotation convention established

\`memory/<persona>/conversations/<filename>\` + inline note: \`(... ; archive migrated YYYY-MM-DD via PR #NNNN)\`

This preserves migration provenance at the citation site, not just in git log.

## Test plan

- [x] Diff is 1 file, 1 logical change
- [x] Path verified: file exists at new location on origin/main
- [ ] CI green
- [ ] Auto-merge arms

## Branch name note

Branch was named \`fix/b0533-slice-a-lior-dead-xrefs\` based on initial plan (Lior, 2 dead xrefs) but turned out Lior had 0 real dead xrefs in live-nav surfaces — my earlier rough scan was less precise. Pivoted to DeepSeek single-file POC mid-tick. Branch name preserved for trace continuity.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-15T18:22:23Z)

## Pull request overview

Updates a stale cross-reference in the glass-halo bidirectional rule to point at the post-§33 DeepSeek conversation-archive location, aligning `.claude/rules/**` with the DeepSeek archive migration (per 081KRMEXM0008QG0R000K25MXS Slice A POC).

**Changes:**

- Replaces the old `docs/research/...` citation with the migrated `memory/deepseek/conversations/...` path.
- Adds an inline provenance note recording the migration date and PR reference.
