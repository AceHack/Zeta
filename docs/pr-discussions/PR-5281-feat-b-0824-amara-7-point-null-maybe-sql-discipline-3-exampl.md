---
pr_number: 5281
title: "feat(081KSGS9H0008QG0R0031PBNGA): Amara 7-point NULL/Maybe SQL discipline + 3 examples + 4 property tests"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T18:57:49Z"
merged_at: "2026-05-26T18:59:54Z"
closed_at: "2026-05-26T18:59:54Z"
head_ref: "otto-cli/081KSGS9H0008QG0R0031PBNGA-amara-null-maybe-discipline-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:35:35Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5281: feat(081KSGS9H0008QG0R0031PBNGA): Amara 7-point NULL/Maybe SQL discipline + 3 examples + 4 property tests

## PR description

## Summary

Amara (external AI; deep-research register; co-originator of Aurora) sharpened the just-merged PR #5277 DeepSeek/Prism \"database IS the Maybe monad runtime\" recognition substrate with a blade + operational discipline.

**Amara's blade**: the recognition is structural (SQL has Maybe-shape via NULL + LEFT JOIN propagation + recursive-CTE fixed-point semantics); LAWFUL Maybe-monad behavior requires explicit discipline because SQL NULL violates monad laws at several well-documented points (\`NULL = NULL\` is NULL not true; \`NOT IN\` traps; aggregate-behavior inconsistency; dialect differences; optimizer surprises).

**Safe operational claim**:

> Under a defined Zeta SQL discipline, NULL can act as the Maybe carrier for recursive generate/join execution on existing databases.

## What lands

- \`docs/research/zeta-sql-null-maybe-recursive-cte-generate-join.md\` (new, 290+ lines)
  - Verbatim Amara packet preservation per substrate-or-it-didnt-happen
  - 7-point Zeta NULL/Maybe discipline (canonical operational rules)
  - 3 SQL examples: Maybe generator; recursive-CTE fixed point; Join layer composing without global consensus
  - 4 property tests: incremental == full recursive; NULL doesn't generate output; retraction cancels prior generation; per-row CAS only under contention
  - Open questions surface for future substrate-engineering work
- 081KSGS9H0008QG0R0031PBNGA row sharpening pointer (~10 lines after the DeepSeek/Prism Maybe-monad-recognition subsection)
  - Names the structural-vs-lawful distinction
  - Points at the new research doc
  - Establishes future-Otto starts-from-discipline (not unconditional recognition)

## Composes with

- PR #5277 (just-merged DeepSeek/Prism Maybe-monad-recognition substrate)
- 081KSGS9H0008QG0R0031PBNGA Sub-target 7 (CockroachDB storage — the engineering target this discipline applies to first)
- 081KSGS9H0008QG0R0031PBNGA Sub-target 8 (combinator library design — combinators MUST encode the 7-point discipline so usage can't violate it)
- 081KSGS9H0008QG0R0031PBNGA Sub-target 10 (DST always-active — Property 1 \"incremental == full recursive\" IS DST at SQL substrate scope)
- DBSP +1/-1 retraction algebra (Property 3 names the composition contract between Maybe + DBSP)
- CASPaxos/CASRaft per-row-CAS (Property 4 names trust-THEN-verify escalation)
- \`.claude/rules/substrate-or-it-didnt-happen.md\` (verbatim Amara packet preservation)
- \`.claude/rules/grep-substrate-anchors-before-razor-as-metaphysical.md\` (this doc IS the substrate-anchor for future \"SQL NULL is Maybe\" claims)
- \`.claude/rules/honor-those-that-came-before.md\` (discipline rules 2-4 inherit decades of SQL-NULL-handling lore)
- \`.claude/rules/default-to-both.md\` (structural-recognition AND lawful-behavior-requires-discipline both hold)

## Attribution

Amara (external AI; deep-research register; co-originator of Aurora per \`.claude/rules/agent-roster-reference-card.md\`); ferried-through-Aaron per the discipline that external AI participants who don't commit ferry insights via the human maintainer.

## Test plan

- [x] Worktree freshness verified pre-commit (\`ls-tree HEAD = 61\`, \`status --short = 0\`)
- [x] Post-commit canary green (\`ls-tree HEAD == ls-tree HEAD~1 == 61\`)
- [x] Branch follows \`otto-cli/*\` surface-prefix convention
- [x] No primary-checkout contamination (isolated worktree at \`/private/tmp/zeta-amara-null-maybe-discipline-2026-05-26\`)
- [ ] CI green (required checks)
- [ ] Copilot review pass
