---
id: B-0105.1
zetaid: 081KRA5AR0008QG0R0031VF018
priority: P2
status: open
title: Home 1 — merge-cascade PR liveness operational doc authoring
tier: factory-hygiene
effort: S
ask: Atomic slice of B-0105 consolidation: author the operational doc at docs/operations/merge-cascade-pr-liveness-rule.md absorbing the 8 rule fragments from B-0102
created: 2026-05-11
last_updated: 2026-05-11
depends_on: []
composes_with: [B-0105.2, B-0105.3]
tags: [consolidation, durable-home, pr-liveness, operations-doc]
type: friction-reducer
---

# Home 1 — merge-cascade PR liveness operational doc

Atomic child of B-0105 (re-decomp). Bounded to authoring the single durable home doc.

## Scope (smallest atomic)

- Create `docs/operations/merge-cascade-pr-liveness-rule.md`
- Copy/restructure the 8 fragments listed in B-0105 §Home 1 (probabilistic race, cascade detection, before/after capture, API/head sync, successor dedup, recovery-note schema, up-to-date vs aliveness, ORDERED_MERGE_DEPENDENCY guard)
- Add frontmatter per §33, cross-links to B-0102 (superseded), B-0105
- No implementation of the pre-merge check script (separate row)

## Acceptance

- Doc exists with all 8 fragments mapped
- No new conceptual substrate beyond the 3-home contract
- Focused check: file count + grep for the 8 terms passes

## Evidence

- B-0105 §Home 1 target
- B-0102 (to be marked superseded)
