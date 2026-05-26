---
pr_number: 5132
title: "fix(backlog P0): renumber 4 peer classifier-bypass rows B-0800-0803 \u2192 B-0807-0810 \u2014 resolves ID-uniqueness lint failure"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T08:33:26Z"
merged_at: "2026-05-26T08:35:08Z"
closed_at: "2026-05-26T08:35:08Z"
head_ref: "otto-cli/p0-fix-dup-ids-b0800-0803-renumber-peer-classifier-bypass-rows-2026-05-26"
base_ref: "main"
archived_at: "2026-05-26T12:13:12Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5132: fix(backlog P0): renumber 4 peer classifier-bypass rows B-0800-0803 → B-0807-0810 — resolves ID-uniqueness lint failure

## PR description

## Summary — P0 fixing blocking lint

The **B-0535 ID-uniqueness gate** is failing on main with 4 duplicate-ID groups (B-0800/0801/0802/0803). Each ID has TWO files:
- Peer Otto-CLI's #5124 classifier-bypass decomposition rows (landed 2026-05-26)
- My #5123 iter-6 cluster-update backlog cluster (landed 2026-05-26, slightly EARLIER on main)

Per the agent-roster-reference-card ID-allocation discipline ("PRs in flight are also state") + first-merge-wins precedent: peer Otto's later-landing rows get renumbered to B-0807-0810. My iter-6 rows keep B-0800-0805.

## Renumber mapping

| Old | New | Slug |
|---|---|---|
| B-0800 | B-0807 | classifier-bypass-findings-schema-and-redaction-rules |
| B-0801 | B-0808 | zeta-safety-substrate-inventory-for-classifier-floor |
| B-0802 | B-0809 | operator-refusal-pattern-for-classifier-bypass-requests |
| B-0803 | B-0810 | classifier-bypass-knights-guild-ratification-and-lift-gate |

Each: `git mv` + `id:` frontmatter rewrite + cross-references within renamed files. `docs/BACKLOG.md` regenerated.

Empirically validated locally: `bun tools/hygiene/audit-backlog-items.ts --enforce-duplicate-ids` clean (0 duplicate-ID groups).

## Why this matters

The B-0535 gate is REQUIRED CI — it's blocking PR #5131 (verify-existing-substrate-before-authoring rule landing) and will block ALL future PRs until resolved.

## Fourth empirical anchor for the verify-existing-substrate-before-authoring rule (#5131)

Peer Otto's #5124 didn't run the ID-uniqueness pre-check before authoring at B-0800 — same failure mode the rule landing in parallel via PR #5131 is designed to prevent. Empirical evidence is mounting.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
