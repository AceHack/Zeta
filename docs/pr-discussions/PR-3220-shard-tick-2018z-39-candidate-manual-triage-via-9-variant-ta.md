---
pr_number: 3220
title: "shard(tick): 2018Z \u2014 39-candidate manual triage via 9-variant taxonomy"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T20:20:33Z"
merged_at: "2026-05-14T20:22:17Z"
closed_at: "2026-05-14T20:22:18Z"
head_ref: "shard/tick-2018Z-39-candidate-triage-otto-cli-2026-05-14"
base_ref: "main"
archived_at: "2026-05-14T20:25:06Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3220: shard(tick): 2018Z — 39-candidate manual triage via 9-variant taxonomy

## PR description

Ran the audit-rule-cross-refs tool ([PR #3202](https://github.com/Lucent-Financial-Group/Zeta/pull/3202)) + applied the 9-variant taxonomy manually to all 39 candidates.

**Result**: 37 healthy variants + 2 entries pointing at the 1 real defect ([081KRHWGX0008QG0R002E3BCDS](docs/backlog/P3/081KRHWGX0008QG0R002E3BCDS-author-missing-wwjd-grey-honest-memory-file-2026-05-14.md), already captured).

**False-positive rate**: 38/39 = 97% — Layer A is high-recall + low-precision; Layer B semantic classification is genuinely load-bearing. The 9-variant taxonomy was the right artifact.

Bonus: Layer B heuristics for each variant (LLM-or-regex tractable) noted in the shard's "Notes for future-Otto" section.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T20:23:08Z)

## Pull request overview

Adds a new hygiene-history tick shard documenting the manual triage of `audit-rule-cross-refs.ts` output using the established 9-variant taxonomy, including counts and “future mechanization” heuristics.

**Changes:**
- Add a 2026-05-14 20:18Z tick shard capturing 39-candidate classification results.
- Record variant-specific heuristics intended to inform a future Layer B mechanization pass.

## Review threads

### Thread 1: docs/hygiene-history/ticks/2026/05/14/2018Z.md:3 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T20:23:07Z):

P1: This tick shard starts with an H1 heading, but the tick-shard schema docs/tools expect the first non-empty line to be a 6-column `| ... |` row (docs/hygiene-history/ticks/README.md:51-63; enforced by tools/hygiene/check-tick-history-shard-schema.ts via its first-line `COL1_RE`). In the current form this file will be flagged as schema-invalid if/when that validator is run. Consider adding the canonical schema row as the first line (and keep the narrative sections below), or update the schema/tooling if heading-first is now the intended standard.
