---
id: B-0620.2
status: open
priority: P2
created: 2026-05-17
type: feature
composes_with:
  - B-0620.1  # vendor-adapter interface
---

# B-0620 Slice 2: Specialized hardware vendor adapter #1

## Scope
Implement the first specialized hardware vendor adapter (e.g. Minisforum or Beelink direct). This informs the per-vendor pattern by providing a concrete implementation alongside Amazon.

## Acceptance
- [ ] Implement `extract(year): InventoryRecord[]` for specialized vendor.
- [ ] Verify output matches the unified normalized record schema.
- [ ] Confirm human-driven execution model only (no agent-driven scraping).
