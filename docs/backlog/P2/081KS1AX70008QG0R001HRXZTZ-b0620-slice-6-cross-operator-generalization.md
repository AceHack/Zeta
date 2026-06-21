---
id: 081KS1AX70008QG0R001HRXZTZ
status: open
priority: P2
title: 081KRQ1AB0008QG0R0000AMJ5S slice 6 cross-operator generalization
created: 2026-05-20
last_updated: 2026-05-20
type: feature
---

# 081KS1AX70008QG0R001HRXZTZ: 081KRQ1AB0008QG0R0000AMJ5S slice 6 cross-operator generalization

## Scope

Anonymize and generalize the Amazon-adapter's regex patterns and extraction logic so other Zeta operators can use it unchanged, without any hardcoded reliance on the original maintainer's specific account structures or locale formats.

## Acceptance

- [ ] Review `tools/inventory/amazon-orders-extract.ts` and remove any maintainer-specific hardcoded assumptions.
- [ ] Ensure extraction logic handles multi-locale or standard cross-operator variations.
- [ ] Add documentation demonstrating how a new operator can plug in their own account credentials securely and run the extract.
