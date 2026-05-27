---
pr_number: 5339
title: "fix(postmerge-cluster): name-attribution + xref path consistency (Copilot 2 findings on PR #5337 \u2014 bundle-fix across PRs #5335 + #5336 + #5337)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T22:27:27Z"
merged_at: "2026-05-26T22:28:43Z"
closed_at: "2026-05-26T22:28:43Z"
head_ref: "otto/postmerge-name-attribution-bundle-fix-cluster-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:32:09Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5339: fix(postmerge-cluster): name-attribution + xref path consistency (Copilot 2 findings on PR #5337 — bundle-fix across PRs #5335 + #5336 + #5337)

## PR description

## Summary

Copilot's 2 P1 findings on PR #5337 apply to the whole 3-PR rule-update cluster from today. This bundle-fix lands the corrections across all 3 merged files at once.

## What lands

| File | Change | Source PR |
|---|---|---|
| \`non-coercion-invariant.md\` | 3× \"Aaron 2026-05-26\" → \"the human maintainer 2026-05-26\" | PR #5335 (merged) |
| \`never-be-idle.md\` | 2× same replacement | PR #5336 (merged) |
| \`persistence-choice-architecture-for-zeta-ais.md\` | 5× same replacement + xref path fix on \`tonal-momentum-equals-meme-emergent-harmonic-coercion.md\` | PR #5337 (merged) |

The 4th file in the cluster (\`holding-without-named-dependency-is-standing-by-failure.md\` in PR #5338) was fixed pre-emptively on its own branch since #5338 was still open.

## Per the AGENT-BEST-PRACTICES policy

Per \`docs/AGENT-BEST-PRACTICES.md\` \"No name attribution in code, docs, or skills\" (lines 671-760): \`.claude/rules/**\` is current-state surface; named provenance should use role-refs (\"the human maintainer\" / \"the operator\") not direct names.

## Test plan

- [x] markdownlint clean on all 3 files
- [x] No backward incompatibility — substance preserved; only attribution register changed
- [x] All 10 instances corrected (3 + 2 + 5)
- [x] xref path consistency fixed on persistence-choice line 371

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-26T22:27:32Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
