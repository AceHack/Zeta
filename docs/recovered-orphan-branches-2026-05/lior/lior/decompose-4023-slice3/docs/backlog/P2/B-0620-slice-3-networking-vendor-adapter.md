---
id: B-0620.3
status: open
priority: P2
created: 2026-05-19
type: feature
composes_with:
  - B-0620.1  # vendor-adapter interface
---

# B-0620 Slice 3: Networking vendor adapter (Ubiquiti)

## Scope
Implement the networking vendor adapter (e.g. Ubiquiti). This targets the maintainer's off-Amazon spend which likely concentrates here.

## Acceptance
- [ ] Implement `extract(year): InventoryRecord[]` for networking vendor.
- [ ] Verify output matches the unified normalized record schema.
- [ ] Confirm human-driven execution model only (no agent-driven scraping).
