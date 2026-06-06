---
id: B-0105.2
zetaid: 081KRA5AR0008QG0R002JS7GRB
priority: P2
status: open
title: Home 3 — reviewer-artifact snapshot-mismatch taxonomy memory file authoring
tier: factory-hygiene
effort: S
ask: Atomic slice of B-0105 consolidation: author the memory file at memory/feedback_reviewer_artifact_snapshot_mismatch_taxonomy_2026_04_29.md absorbing the 5+1 bucket table + remedies from B-0101
created: 2026-05-11
last_updated: 2026-05-11
depends_on: []
composes_with: [B-0105.1, B-0105.3]
tags: [consolidation, durable-home, reviewer-taxonomy, memory-file]
type: friction-reducer
---

# Home 3 — reviewer artifact snapshot mismatch taxonomy

Atomic child of B-0105 (re-decomp). Bounded to authoring the single memory durable home.

## Scope (smallest atomic)

- Create `memory/feedback_reviewer_artifact_snapshot_mismatch_taxonomy_2026_04_29.md`
- Copy/restructure the 5+1 bucket table (REAL_DEFECT, BACKWARD_STALE_SNAPSHOT, FORWARD_CROSS_PR_REFERENCE, DISPLAY_ARTIFACT, INCOMPLETE_CONTEXT, NEEDS_HUMAN_REVIEW), SNAPSHOT_MISMATCH parent, per-bucket remedies, forward-ref rule
- Add proper memory frontmatter + §33 header
- Cross-link to B-0101 (superseded), B-0105, MEMORY.md
- No taxonomy evolution (future row)

## Acceptance

- Memory file exists with complete taxonomy
- Index pointer ready for B-0105.3
- Focused check: 6 buckets + 2 rules present

## Evidence

- B-0105 §Home 3 target
- B-0101 (to be marked superseded)
