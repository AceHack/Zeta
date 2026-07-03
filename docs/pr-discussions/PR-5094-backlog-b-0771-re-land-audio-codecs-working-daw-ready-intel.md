---
pr_number: 5094
title: "backlog(081KSE6WT0008QG0R0022D6GN8): re-land audio codecs working (DAW-ready) + Intel NPU/VPU exposed + ONNX as operator contract"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T04:59:16Z"
merged_at: "2026-05-26T05:01:15Z"
closed_at: "2026-05-26T05:01:15Z"
head_ref: "otto-cli/reland-b0771-0500z"
base_ref: "main"
archived_at: "2026-05-27T19:44:35Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5094: backlog(081KSE6WT0008QG0R0022D6GN8): re-land audio codecs working (DAW-ready) + Intel NPU/VPU exposed + ONNX as operator contract

## PR description

## Summary

Re-land of stale-DIRTY [PR #5058](https://github.com/Lucent-Financial-Group/Zeta/pull/5058) (Tier-3 per [`pr-triage-tiers.md`](.claude/rules/pr-triage-tiers.md)).

- Same 081KSE6WT0008QG0R0022D6GN8 row (269 lines from PR #5058 head `cf9f8e2fc`)
- `docs/BACKLOG.md` regenerated against current origin/main
- 2 pre-emptive lint fixes: MD022 (wrapped heading), MD012 (collapsed double-blank that resulted from the MD022 fix)

Follow-up: close #5058 with substrate-recoverable cross-link.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T05:01:35Z)

## Pull request overview

Adds a new P2 backlog row (081KSE6WT0008QG0R0022D6GN8) capturing the planned substrate work to make audio (DAW-ready) and Intel NPU/VPU resources usable on Zeta cluster nodes, and regenerates the main backlog index to include the new row.

**Changes:**

- Added `docs/backlog/P2/081KSE6WT0008QG0R0022D6GN8-...md` backlog row detailing problem/target/acceptance for audio stack + NPU exposure + ONNX runtime contract.
- Regenerated `docs/BACKLOG.md` to include the new 081KSE6WT0008QG0R0022D6GN8 entry.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 1 comment.

| File | Description |
| ---- | ----------- |
| docs/backlog/P2/081KSE6WT0008QG0R0022D6GN8-audio-codecs-working-plus-intel-npu-vpu-exposed-for-daw-and-ai-workloads-aaron-2026-05-25.md | New backlog row describing audio + Intel NPU/VPU enablement scope and acceptance criteria. |
| docs/BACKLOG.md | Generated backlog index updated to include 081KSE6WT0008QG0R0022D6GN8. |

## Review threads

### Thread 1: docs/backlog/P2/081KSE6WT0008QG0R0022D6GN8-audio-codecs-working-plus-intel-npu-vpu-exposed-for-daw-and-ai-workloads-aaron-2026-05-25.md:12 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-26T05:01:35Z):

`depends_on` references `081KSGS9H0008QG0R002T3BJ2R`, but there is no corresponding backlog row file with `id: 081KSGS9H0008QG0R002T3BJ2R` under `docs/backlog/**` (and `docs/BACKLOG.md` has no 081KSGS9H0008QG0R002T3BJ2R entry). This breaks backlog dependency/xref integrity; either add the missing `081KSGS9H0008QG0R002T3BJ2R` row file (preferred) or change this dependency to an existing row ID / remove it until the row exists.

## General comments

### @chatgpt-codex-connector (2026-05-26T04:59:20Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
