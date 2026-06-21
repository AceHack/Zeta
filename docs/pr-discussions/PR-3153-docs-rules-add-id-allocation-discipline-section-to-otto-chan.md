---
pr_number: 3153
title: "docs(rules): add ID allocation discipline section to otto-channels reference card"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T18:11:12Z"
merged_at: "2026-05-14T18:16:19Z"
closed_at: "2026-05-14T18:16:19Z"
head_ref: "otto-channels-id-allocation-discipline-redo-2026-05-14"
base_ref: "main"
archived_at: "2026-05-14T18:23:24Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3153: docs(rules): add ID allocation discipline section to otto-channels reference card

## PR description

## Summary

Yesterday's 081KRFA460008QG0R002DG8KPZ collision empirically validated a gap in the otto-channels reference rule: agents pick monotonically-increasing IDs (B-NNNN backlog row numbers) by checking on-disk state but NOT in-flight PRs — race-mode manifests when peer Otto is filing concurrently.

Adds new section **\"ID allocation discipline (multi-surface)\"** to [.claude/rules/otto-channels-reference-card.md](.claude/rules/otto-channels-reference-card.md) requiring BOTH:

1. **On-disk check** (\`find docs/backlog → grep B-[0-9]+ → tail\`)
2. **In-flight check** (\`gh pr list --state all --search \"B-NNNN\"\`)

The on-disk check shows merged state; the in-flight check shows what peer Otto is filing concurrently. Skip either and the race manifests.

## Empirical anchor

2026-05-13 collision:

- Otto on Desktop picked 081KRFA460008QG0R002DG8KPZ for [PR #3052](https://github.com/Lucent-Financial-Group/Zeta/pull/3052) (resolving an earlier 081KRFA460008QG0R001SXP0C2 collision)
- Otto on CLI had 081KRFA460008QG0R002DG8KPZ-bg-services-slice-5 in flight via [PR #3046](https://github.com/Lucent-Financial-Group/Zeta/pull/3046)
- Otto on CLI flagged #3052 \"Request Changes\" (blocked auto-merge), shipped corrected [PR #3053](https://github.com/Lucent-Financial-Group/Zeta/pull/3053) with 081KRFA460008QG0R001QFS6EV
- Drift in [PR #3054 shadow lesson log](https://github.com/Lucent-Financial-Group/Zeta/pull/3054)

## Substrate-honest takeaway

The \`refresh-before-decide\` invariant (\`.claude/rules/refresh-before-decide.md\`) applies at the per-ID-allocation scope, not just per-tick. The \"highest on disk + 1\" heuristic is incomplete; PRs in flight are also state.

## Why now

This PR is the re-authoring of work that was lost in 2026-05-13 session crash (the original was on \`/tmp/zeta-otto-desktop\` which got cleaned up during the gap). The substrate gap is still real, the empirical anchor still holds, the rule update is still valuable.

## Composition

- Item 7 added to Operational discipline list (pointing at new section)
- Composes-with entries added for PR #3053, PR #3054, \`refresh-before-decide.md\`
- \`/tmp/zeta-otto-id-alloc\` added as example task-specific worktree path

## Test plan

- [ ] CI passes (markdownlint + memory frontmatter checks)
- [ ] Future Otto cold-boots read the new section at session start
- [ ] Next ID allocation across Ottos exercises the discipline (will surface if successful)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-14T18:12:21Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `0d4d0e1218`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T18:15:39Z)

## Pull request overview

Updates the Otto inter-surface communication reference card to codify ID allocation discipline across local backlog state and GitHub PR state, addressing the 081KRFA460008QG0R002DG8KPZ collision scenario described in the PR.

**Changes:**
- Adds ID allocation as an operational discipline item.
- Adds a new multi-surface ID allocation section with on-disk and in-flight PR checks.
- Adds composition links to the collision-resolution PRs and refresh-before-decide rule.

## Review threads

### Thread 1: .claude/rules/otto-channels-reference-card.md:61 (resolved)

**@chatgpt-codex-connector** (2026-05-14T18:12:21Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Replace GNU-only find flag in ID-allocation command**

The new on-disk check uses `find ... -printf`, which is a GNU `find` extension and fails on BSD/macOS `find` (the same Desktop environment implied by `/Users/...` paths in this file). In that environment this step errors before producing IDs, so operators are likely to skip or improvise the check and reintroduce the collision risk this section is meant to prevent; use a portable form (e.g., `-exec basename` or an explicit platform note) so the procedure is runnable on both surfaces.

Useful? React with 👍 / 👎.

### Thread 2: .claude/rules/otto-channels-reference-card.md:62 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T18:15:39Z):

P1: this on-disk check uses GNU `find -printf`, which is not available in the default BSD/macOS `find`. This rule is aimed at the Desktop/CLI worktrees shown above, including macOS paths, and the repo has previously treated `find -printf` as a portability bug; use a BSD/macOS-portable form instead so the allocation discipline works on the developer machines it is documenting.

## General comments

### @AceHack (2026-05-14T18:16:16Z)

This concern was already addressed in commit `1636908` (pushed before this review) — `find -printf` was replaced with portable `find ... -type f | grep -oE "B-[0-9]+"` per Codex P2 thread PRRT_kwDOSF9kNM6CJju2 (resolved). Same finding, different reviewer. Resolving thread.
