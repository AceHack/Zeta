---
pr_number: 5132
title: "fix(backlog P0): renumber 4 peer classifier-bypass rows 081KSGS9H0008QG0R001EKTS5A-0803 \u2192 081KSGS9H0008QG0R001K8P0FJ-0810 \u2014 resolves ID-uniqueness lint failure"
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

# PR #5132: fix(backlog P0): renumber 4 peer classifier-bypass rows 081KSGS9H0008QG0R001EKTS5A-0803 → 081KSGS9H0008QG0R001K8P0FJ-0810 — resolves ID-uniqueness lint failure

## PR description

## Summary — P0 fixing blocking lint

The **081KRMEXM0008QG0R000HHAG77 ID-uniqueness gate** is failing on main with 4 duplicate-ID groups (081KSGS9H0008QG0R001EKTS5A/0801/0802/0803). Each ID has TWO files:

- Peer Otto-CLI's #5124 classifier-bypass decomposition rows (landed 2026-05-26)
- My #5123 iter-6 cluster-update backlog cluster (landed 2026-05-26, slightly EARLIER on main)

Per the agent-roster-reference-card ID-allocation discipline ("PRs in flight are also state") + first-merge-wins precedent: peer Otto's later-landing rows get renumbered to 081KSGS9H0008QG0R001K8P0FJ-0810. My iter-6 rows keep 081KSGS9H0008QG0R001EKTS5A-0805.

## Renumber mapping

| Old | New | Slug |
|---|---|---|
| 081KSGS9H0008QG0R001EKTS5A | 081KSGS9H0008QG0R001K8P0FJ | classifier-bypass-findings-schema-and-redaction-rules |
| 081KSGS9H0008QG0R002T6J6FS | 081KSGS9H0008QG0R00287K8FR | zeta-safety-substrate-inventory-for-classifier-floor |
| 081KSGS9H0008QG0R003GM7TYN | 081KSGS9H0008QG0R001HC663P | operator-refusal-pattern-for-classifier-bypass-requests |
| 081KSGS9H0008QG0R00280HHA7 | 081KSGS9H0008QG0R002CY8Q24 | classifier-bypass-knights-guild-ratification-and-lift-gate |

Each: `git mv` + `id:` frontmatter rewrite + cross-references within renamed files. `docs/BACKLOG.md` regenerated.

Empirically validated locally: `bun tools/hygiene/audit-backlog-items.ts --enforce-duplicate-ids` clean (0 duplicate-ID groups).

## Why this matters

The 081KRMEXM0008QG0R000HHAG77 gate is REQUIRED CI — it's blocking PR #5131 (verify-existing-substrate-before-authoring rule landing) and will block ALL future PRs until resolved.

## Fourth empirical anchor for the verify-existing-substrate-before-authoring rule (#5131)

Peer Otto's #5124 didn't run the ID-uniqueness pre-check before authoring at 081KSGS9H0008QG0R001EKTS5A — same failure mode the rule landing in parallel via PR #5131 is designed to prevent. Empirical evidence is mounting.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
