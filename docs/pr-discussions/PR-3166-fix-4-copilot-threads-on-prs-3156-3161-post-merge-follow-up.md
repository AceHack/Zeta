---
pr_number: 3166
title: "fix: 4 Copilot threads on PRs #3156 + #3161 (post-merge follow-up)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T18:33:17Z"
merged_at: "2026-05-14T18:35:35Z"
closed_at: "2026-05-14T18:35:35Z"
head_ref: "fix/copilot-4-threads-on-pr3156-pr3161-followup-2026-05-14"
base_ref: "main"
archived_at: "2026-05-14T18:39:08Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3166: fix: 4 Copilot threads on PRs #3156 + #3161 (post-merge follow-up)

## PR description

### Summary

Both #3156 (081KRHWGX0008QG0R002DPG02X row) and #3161 (1822Z shard) auto-merged before Copilot's review threads could be addressed — autoMerge is armed once CI passes, and Copilot's findings were advisory (not \`required_conversation_resolution\`). Fixing the 4 findings on main as a small follow-up.

### Findings + fixes

**PR #3156 (081KRHWGX0008QG0R002DPG02X \`docs/backlog/P3/081KRHWGX0008QG0R002DPG02X-stale-worktree-prune-cadence-mechanization-2026-05-14.md\`)**:

1. Frontmatter \`type: feature\` vs body "P3 friction-reducer" — changed \`type: feature\` → \`type: chore\` (matches the \`chore(backlog)\` commit prefix; resolves semantic mismatch)
2. \`Composes with\` listed bare filenames (\`claim-acquire-before-worktree-work.md\`, \`encoding-rules-without-mechanizing.md\`) — added full \`.claude/rules/\` paths for unambiguous nav

**PR #3161 (\`docs/hygiene-history/ticks/2026/05/14/1822Z.md\`)**:

3. "~17/47" → "8/47 (~17%)" — internal-consistency fix (8 rules audited, not 17; aligns with lines 41 + 62)
4. "per per-tick" → "per-tick" — grammar nit

### Why this PR

The auto-merge happened ~3 minutes after the prior PRs' CI passed, before I could see Copilot's threads. Substrate-honest follow-up is to fix on main rather than leave the findings unaddressed.

The 4 threads on the merged PRs will be resolved via GraphQL \`resolveReviewThread\` after this lands.

### Test plan

- [x] 081KRHWGX0008QG0R002DPG02X frontmatter aligns with commit prefix
- [x] 081KRHWGX0008QG0R002DPG02X Composes-with paths are full + navigable
- [x] 1822Z shard count is internally consistent
- [x] Grammar nit fixed

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T18:34:40Z)

## Pull request overview

Small follow-up that addresses 4 Copilot review findings on the already-merged PRs #3156 and #3161, applied directly on main.

**Changes:**

- Fix 081KRHWGX0008QG0R002DPG02X frontmatter `type` from `feature` to `chore` and expand bare rule filenames to full `.claude/rules/` paths in the Composes-with list.
- Correct "~17/47" to "8/47 (~17%)" for internal consistency and fix a "per per-tick" grammar nit in the 1822Z tick shard.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P3/081KRHWGX0008QG0R002DPG02X-stale-worktree-prune-cadence-mechanization-2026-05-14.md | Frontmatter type semantic fix; full paths for Composes-with rule references. |
| docs/hygiene-history/ticks/2026/05/14/1822Z.md | Numeric consistency fix (8/47, ~17%) and grammar fix ("per-tick"). |
