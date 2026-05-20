---
id: B-0677
status: open
priority: P2
title: B-0620 slice 6 cross-operator generalization
created: 2026-05-20
last_updated: 2026-05-20
type: feature
---

# B-0677: B-0620 slice 6 cross-operator generalization

## Scope

Anonymize and generalize the Amazon-adapter's regex patterns and extraction logic so other Zeta operators can use it unchanged, without any hardcoded reliance on the original maintainer's specific account structures or locale formats.

## Acceptance

- [ ] Review `tools/inventory/amazon-orders-extract.ts` and remove any maintainer-specific hardcoded assumptions.
- [ ] Ensure extraction logic handles multi-locale or standard cross-operator variations.
- [ ] Add documentation demonstrating how a new operator can plug in their own account credentials securely and run the extract.
