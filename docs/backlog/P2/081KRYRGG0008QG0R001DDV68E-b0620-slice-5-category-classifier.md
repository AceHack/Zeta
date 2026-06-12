---
id: B-0678
zetaid: 081KRYRGG0008QG0R001DDV68E
status: open
priority: P2
title: B-0620 slice 5 category classifier
created: 2026-05-19
last_updated: 2026-05-20
type: feature
composes_with:
  - B-0620  # multi-account + multi-vendor inventory consolidation
  - B-0610  # amazon-orders-extract v3 design pass
depends_on:
  - B-0676 # B-0620 slice 4 consolidator script
---

# B-0678: B-0620 slice 5 category classifier

## Context

This is Slice 5 peeled from the B-0620 blob.
It operationalizes the category classification for the consolidated inventory records.

## Scope

Category-classifier (initial heuristic, refined over time) that maps each record to:

- `revenue-generating` (revenue-facing capex)
- `rnd` (R&D-gift inventory)
- `pending`

using the same financial substrate category split as the consolidator row.

## Acceptance

- [ ] Classifier module implemented with mapping logic based on product keywords and categories.
- [ ] Integrates with the consolidator script (`B-0676`).
- [ ] Committable hardware inventory substrate output correctly categorizes products.
