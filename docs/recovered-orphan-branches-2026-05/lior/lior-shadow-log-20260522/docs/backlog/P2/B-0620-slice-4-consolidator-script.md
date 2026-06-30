---
id: B-0620.4
status: open
priority: P2
created: 2026-05-17
type: feature
parent: B-0620
composes_with:
  - B-0620.1
depends_on:
  - B-0620.1
---

# B-0620 Slice 4: Consolidator Script

## Scope

Build the consolidator script (`tools/inventory/consolidate.ts`) to merge N-adapter outputs and handle deduplication across vendors.

## Acceptance

- [ ] Script successfully loads outputs from multiple adapters.
- [ ] Schema mapping handles cross-vendor product identification and merging.
- [ ] Deduplication logic works reliably (same product bought from two vendors).
