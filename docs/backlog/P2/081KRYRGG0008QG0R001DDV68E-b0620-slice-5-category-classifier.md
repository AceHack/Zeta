---
id: 081KRYRGG0008QG0R001DDV68E
status: open
priority: P2
title: 081KRQ1AB0008QG0R0000AMJ5S slice 5 category classifier
created: 2026-05-19
last_updated: 2026-05-20
type: feature
composes_with:
  - 081KRQ1AB0008QG0R0000AMJ5S  # multi-account + multi-vendor inventory consolidation
  - 081KRQ1AB0008QG0R002TZ063S  # amazon-orders-extract v3 design pass
depends_on:
  - 081KS1AX70008QG0R001Y9EN85 # 081KRQ1AB0008QG0R0000AMJ5S slice 4 consolidator script
---

# 081KRYRGG0008QG0R001DDV68E: 081KRQ1AB0008QG0R0000AMJ5S slice 5 category classifier

## Context

This is Slice 5 peeled from the 081KRQ1AB0008QG0R0000AMJ5S blob.
It operationalizes the category classification for the consolidated inventory records.

## Scope

Category-classifier (initial heuristic, refined over time) that maps each record to:

- `revenue-generating` (revenue-facing capex)
- `rnd` (R&D-gift inventory)
- `pending`

using the same financial substrate category split as the consolidator row.

## Acceptance

- [ ] Classifier module implemented with mapping logic based on product keywords and categories.
- [ ] Integrates with the consolidator script (`081KS1AX70008QG0R001Y9EN85`).
- [ ] Committable hardware inventory substrate output correctly categorizes products.
