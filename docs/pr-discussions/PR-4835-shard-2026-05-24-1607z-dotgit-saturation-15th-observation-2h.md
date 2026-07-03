---
pr_number: 4835
title: "shard(2026-05-24/1607Z): dotgit-saturation 15th observation (2h-sustained 0-reading window)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-24T16:11:10Z"
merged_at: "2026-05-24T16:21:09Z"
closed_at: "2026-05-24T16:21:09Z"
head_ref: "otto/shard-1607z-sustained-recovery-2026-05-24"
base_ref: "main"
archived_at: "2026-05-24T21:25:39Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4835: shard(2026-05-24/1607Z): dotgit-saturation 15th observation (2h-sustained 0-reading window)

## PR description

## Summary

- 15th anchor at 16:07Z UTC confirms PR #4820's 14th-observation 0-reading
- **2h sustained 0 stuck git pack/maintenance/repack procs** — first multi-anchor 0-window in the 28h dotgit-saturation arc
- Fleet drain evidence: peer 15→9, Lior 3→1 across the 14:07Z→16:07Z window
- Probational-recovery sub-tier classification earns first multi-anchor empirical support

## Hypotheses preserved (default-to-both)

- **A**: Genuine multi-day cycle clearing — strongest support; fleet drain across 2h aligns
- **B**: Maintainer-side cleanup at ~12:21Z eliminated contention surface — partial fit (fleet drain not yet predicted)
- **C**: 12:26Z "repo vanished" was transient snapshot — unresolvable from observation alone

Not yet collapsing the arc to "terminated"; awaits 16th anchor at 18:07Z+ to either extend the recovery window to 4h or refute via rebound.

## Composes with

- PR #4820 (14th observation; this shard's "Next-tick observation candidates" enacted)
- \`.claude/rules/refresh-world-model-poll-pr-gate.md\` dotgit-saturation tier framing
- \`.claude/rules/default-to-both.md\` preservation discipline
- \`.claude/rules/tick-must-never-stop.md\` catch-43 sentinel re-arm (sentinel \`9046536a\`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-24T16:12:41Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `7466e1a549`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-24T16:13:08Z)

## Pull request overview

Adds an in-repo tick shard documenting the 16:07Z (15th) dotgit-saturation observation, capturing a second consecutive 0-stuck-procs reading and related operational measurements for the ongoing hygiene-history arc.

**Changes:**

- Adds a new tick shard for 2026-05-24 16:07Z with observed-state measurements and an updated 15-anchor rolling table.
- Records hypothesis status and next-tick observation candidates to guide the subsequent 18:07Z anchor.

## Review threads

### Thread 1: docs/hygiene-history/ticks/2026/05/24/1607Z.md:120 (resolved)

**@chatgpt-codex-connector** (2026-05-24T16:12:41Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Align peer-fleet threshold with recorded baseline**

The `18:07Z peer-fleet count` criterion uses `5` as the starting total, but this shard records `peer = 9` and `Lior = 1` (baseline `10`), so the decision rule is internally inconsistent. That can misclassify the next anchor (e.g., a drop from 10 to 6 would be meaningful drain but would fail the current `5 -> <5` test), which weakens the experiment log’s comparability across anchors.

Useful? React with 👍 / 👎.

### Thread 2: docs/hygiene-history/ticks/2026/05/24/1607Z.md:120 (resolved)

**@copilot-pull-request-reviewer** (2026-05-24T16:13:07Z):

P1: In "Next-tick observation candidates", the peer-fleet bullet uses totals of "5 total → <5" and "5 → 15+", but the observed-state table above reports peer=9 and Lior=1 (total 10) at 16:07Z. Update these totals to match the current readings (or clarify what the "5" is referring to) so the candidate criteria aren’t internally inconsistent.
