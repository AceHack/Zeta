---
id: 081KRA5AR0008QG0R0031VF018
priority: P2
status: open
title: Home 1 — merge-cascade PR liveness operational doc authoring
tier: factory-hygiene
effort: S
ask: Atomic slice of 081KQB8J40008QG0R0021GX1HK consolidation: author the operational doc at docs/operations/merge-cascade-pr-liveness-rule.md absorbing the 8 rule fragments from 081KQB8J40008QG0R002DQ0FDR
created: 2026-05-11
last_updated: 2026-05-11
depends_on: []
composes_with: [081KRA5AR0008QG0R002JS7GRB, 081KRA5AR0008QG0R001QT2ZXQ]
tags: [consolidation, durable-home, pr-liveness, operations-doc]
type: friction-reducer
---

# Home 1 — merge-cascade PR liveness operational doc

Atomic child of 081KQB8J40008QG0R0021GX1HK (re-decomp). Bounded to authoring the single durable home doc.

## Scope (smallest atomic)

- Create `docs/operations/merge-cascade-pr-liveness-rule.md`
- Copy/restructure the 8 fragments listed in 081KQB8J40008QG0R0021GX1HK §Home 1 (probabilistic race, cascade detection, before/after capture, API/head sync, successor dedup, recovery-note schema, up-to-date vs aliveness, ORDERED_MERGE_DEPENDENCY guard)
- Add frontmatter per §33, cross-links to 081KQB8J40008QG0R002DQ0FDR (superseded), 081KQB8J40008QG0R0021GX1HK
- No implementation of the pre-merge check script (separate row)

## Acceptance

- Doc exists with all 8 fragments mapped
- No new conceptual substrate beyond the 3-home contract
- Focused check: file count + grep for the 8 terms passes

## Evidence

- 081KQB8J40008QG0R0021GX1HK §Home 1 target
- 081KQB8J40008QG0R002DQ0FDR (to be marked superseded)
