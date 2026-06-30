---
id: B-0620.1
status: open
priority: P2
created: 2026-05-17
type: feature
composes_with:
  - B-0610
  - B-0620
---

# B-0620 Slice 1: Vendor adapter interface

## Scope
Define `Vendor adapter interface` + extract Amazon adapter out of amazon-orders-extract.ts into `tools/inventory/vendors/amazon.ts` (composition with B-0610 v3 design pass — the extraction logic refinement lives here).

## Acceptance
- [ ] Vendor-adapter interface defined (per-vendor adapter implements common `extract(year): InventoryRecord[]` shape)
- [ ] Amazon adapter ported from amazon-orders-extract.ts into `tools/inventory/vendors/amazon.ts`
